import { useState, useEffect, useCallback } from "react";
import { formatDateTime } from "@/lib/utils";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Coins, CreditCard, CheckCircle, Clock, AlertCircle, Copy,
  Star, Zap, TrendingUp, ArrowUpCircle, ArrowDownCircle, Loader2, Info
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface WalletData {
  balance: number;
  subscriptionBalance: number;
  extraBalance: number;
  totalBought: number;
  totalUsed: number;
  transactions: Transaction[];
  pendingCharges: PixCharge[];
  packages: Package[];
}

interface Package {
  id: string;
  name: string;
  credits: number;
  price: number;
  bonus: number;
  popular: boolean;
}

interface PixCharge {
  id: number;
  txid: string;
  valor: number;
  creditos: number;
  status: string;
  package_id: string;
  pix_copia_cola: string;
  expires_at: string;
  paid_at?: string;
  created_at: string;
  pixQrBase64?: string;
  provider?: string;
}

interface Transaction {
  id: number;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
  reference_id?: string;
  created_at: string;
}

function useWallet() {
  return useQuery<WalletData>({
    queryKey: ["wallet"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/wallet`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Erro ao carregar carteira");
      return res.json();
    },
    refetchInterval: 10_000,
  });
}

function TransactionBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; className: string }> = {
    purchase:     { label: "Compra",       className: "bg-green-100 text-green-800 border-green-200" },
    debit:        { label: "Débito",       className: "bg-red-100 text-red-800 border-red-200" },
    bonus:        { label: "Bônus",        className: "bg-blue-100 text-blue-800 border-blue-200" },
    refund:       { label: "Estorno",      className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    adjustment:   { label: "Ajuste",       className: "bg-purple-100 text-purple-800 border-purple-200" },
    grant:        { label: "Doação",       className: "bg-cyan-100 text-cyan-800 border-cyan-200" },
    subscription: { label: "Assinatura",   className: "bg-violet-100 text-violet-800 border-violet-200" },
  };
  const t = map[type] ?? { label: type, className: "bg-gray-100 text-gray-700" };
  return <Badge variant="outline" className={`text-xs ${t.className}`}>{t.label}</Badge>;
}

// Modal de Pix ───────────────────────────────────────────────────────────────
function PixModal({ charge, onClose, onPaid }: { charge: PixCharge; onClose: () => void; onPaid: () => void }) {
  const { toast } = useToast();
  const [status, setStatus] = useState(charge.status);
  const [timeLeft, setTimeLeft] = useState(0);

  // Usa QR base64 do MP se disponível, senão API externa
  const qrUrl = charge.pixQrBase64
    ? `data:image/png;base64,${charge.pixQrBase64}`
    : `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(charge.pix_copia_cola)}&margin=12`;

  // Countdown
  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, new Date(charge.expires_at).getTime() - Date.now());
      setTimeLeft(diff);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [charge.expires_at]);

  // Poll status
  useEffect(() => {
    if (status !== "pending") return;
    const t = setInterval(async () => {
      const res = await fetch(`${BASE}/api/wallet/pix/${charge.txid}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.status !== "pending") {
          setStatus(data.status);
          if (data.status === "paid") onPaid();
        }
      }
    }, 2000);
    return () => clearInterval(t);
  }, [status, charge.txid, onPaid]);

  function copyPix() {
    navigator.clipboard.writeText(charge.pix_copia_cola);
    toast({ title: "Código Pix copiado!" });
  }

  const mm = String(Math.floor(timeLeft / 60000)).padStart(2, "0");
  const ss = String(Math.floor((timeLeft % 60000) / 1000)).padStart(2, "0");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard size={18} className="text-primary" />
            Pagamento via Pix
          </DialogTitle>
        </DialogHeader>

        {status === "paid" ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle size={56} className="text-green-500" />
            <p className="text-lg font-bold text-green-700">Pagamento confirmado!</p>
            <p className="text-muted-foreground text-sm text-center">{charge.creditos} créditos foram adicionados à sua carteira.</p>
            <Button className="w-full" onClick={onClose}>Fechar</Button>
          </div>
        ) : timeLeft === 0 ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <AlertCircle size={48} className="text-red-400" />
            <p className="text-lg font-semibold text-red-600">Cobrança expirada</p>
            <Button variant="outline" onClick={onClose}>Fechar e tentar novamente</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumo */}
            <div className="bg-muted/50 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground">Valor a pagar</p>
                <p className="text-2xl font-bold text-foreground">R$ {Number(charge.valor).toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Créditos</p>
                <p className="text-2xl font-bold text-primary">{charge.creditos}</p>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center gap-3">
              <img src={qrUrl} alt="QR Code Pix" className="rounded-xl border border-border w-[220px] h-[220px]" />
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock size={14} /> Expira em <span className="font-mono font-bold text-foreground">{mm}:{ss}</span>
              </div>
            </div>

            {/* Copia e cola */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Pix Copia e Cola</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-muted rounded-lg px-3 py-2 text-xs font-mono text-muted-foreground truncate">
                  {charge.pix_copia_cola}
                </div>
                <Button size="sm" variant="outline" onClick={copyPix}>
                  <Copy size={14} />
                </Button>
              </div>
            </div>

            {/* Aguardando confirmação */}
            <div className="pt-2 border-t border-border">
              <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
                <Loader2 size={16} className="animate-spin text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">Aguardando confirmação do pagamento</p>
                  <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">
                    Após o Pix ser recebido, os créditos serão liberados automaticamente em até 2 minutos.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 mt-2 px-1">
                <Info size={13} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Realize o pagamento escaneando o QR code ou usando o código Pix Copia e Cola acima. Esta janela pode ser fechada — você receberá os créditos assim que o pagamento for confirmado.
                </p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Página principal ─────────────────────────────────────────────────────────────
export default function Creditos() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: wallet, isLoading } = useWallet();
  const [activeCharge, setActiveCharge] = useState<PixCharge | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const purchaseMut = useMutation({
    mutationFn: async (packageId: string) => {
      const res = await fetch(`${BASE}/api/wallet/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data as PixCharge;
    },
    onSuccess: (data: any) => {
      // Normaliza snake_case para compatibilidade com o modal
      setActiveCharge({ ...data, expires_at: data.expiresAt ?? data.expires_at });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao gerar cobrança", description: err.message, variant: "destructive" });
    },
  });

  const handlePaid = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["user-stats"] });
  }, [qc]);

  const packages = wallet?.packages ?? [];
  const pkgIcons: Record<string, React.ElementType> = { starter: Coins, plus: Zap, pro: TrendingUp };

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Coins size={22} /> Carteira de Créditos
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Compre créditos para usar os módulos da plataforma.</p>
      </div>

      {/* Saldo atual */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Saldo Total",        value: isLoading ? "—" : String(wallet?.balance ?? 0), icon: Coins, color: "#3b82f6" },
          { label: "Cred. Assinatura",   value: isLoading ? "—" : String(wallet?.subscriptionBalance ?? 0), icon: Star, color: "#7c3aed" },
          { label: "Cred. Avulsos",      value: isLoading ? "—" : String(wallet?.extraBalance ?? 0), icon: Zap, color: "#f59e0b" },
          { label: "Total Utilizado",    value: isLoading ? "—" : String(wallet?.totalUsed ?? 0), icon: ArrowDownCircle, color: "#10b981" },
        ].map((s) => (
          <Card key={s.label} className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 opacity-5" style={{ backgroundColor: s.color }} />
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl flex-shrink-0" style={{ backgroundColor: `${s.color}20` }}>
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{s.label}</p>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pacotes */}
      <div>
        <h2 className="text-lg font-display font-semibold mb-4">Comprar Créditos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {packages.map((pkg) => {
            const Icon = pkgIcons[pkg.id] ?? Coins;
            return (
              <Card key={pkg.id} className={`relative transition-all hover:shadow-lg ${pkg.popular ? "border-primary border-2 shadow-md" : "border-border"}`}>
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-white px-3 py-0.5 flex items-center gap-1">
                      <Star size={11} /> Mais Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-2 pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2.5 rounded-xl bg-primary/10"><Icon className="w-6 h-6 text-primary" /></div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">R$ {pkg.price.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">por compra</p>
                    </div>
                  </div>
                  <CardTitle className="text-lg font-display">{pkg.name}</CardTitle>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-2 border-t border-border">
                      <span className="text-sm text-muted-foreground">Créditos</span>
                      <span className="font-bold text-foreground">{pkg.credits}</span>
                    </div>
                    {pkg.bonus > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-green-700">Bônus incluído</span>
                        <span className="font-semibold text-green-700">+{pkg.bonus}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-2 border-t border-border">
                      <span className="text-sm font-medium">Total recebido</span>
                      <span className="text-xl font-bold text-primary">{pkg.credits + pkg.bonus}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      R$ {(pkg.price / (pkg.credits + pkg.bonus)).toFixed(2)} por crédito
                    </p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={pkg.popular ? "default" : "outline"}
                    disabled={purchaseMut.isPending}
                    onClick={() => purchaseMut.mutate(pkg.id)}
                  >
                    {purchaseMut.isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : <CreditCard size={14} className="mr-2" />}
                    Comprar via Pix
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Cobranças pendentes */}
      {(wallet?.pendingCharges?.length ?? 0) > 0 && (
        <div>
          <h2 className="text-lg font-display font-semibold mb-3">Cobranças Pendentes</h2>
          <div className="space-y-3">
            {wallet!.pendingCharges.map((c) => (
              <Card key={c.txid} className="border-yellow-200 bg-yellow-50/50">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Compra: {c.creditos} créditos — R$ {Number(c.valor).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Expira: {formatDateTime(c.expires_at)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setActiveCharge(c)}>
                    Ver Pix
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Histórico de transações */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-display font-semibold">Histórico de Transações</h2>
          {!showHistory && (wallet?.transactions?.length ?? 0) > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(true)} className="text-primary">Ver tudo</Button>
          )}
        </div>
        {isLoading ? (
          <div className="border border-border rounded-xl p-8 flex justify-center">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : (wallet?.transactions?.length ?? 0) === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Coins size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma transação ainda. Compre seus primeiros créditos acima.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden sm:table-cell">Descrição</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Créditos</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Saldo</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Data</th>
                </tr>
              </thead>
              <tbody>
                {wallet!.transactions.map((tx) => (
                  <tr key={tx.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3"><TransactionBadge type={tx.type} /></td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell text-xs">{tx.description}</td>
                    <td className={`px-4 py-3 text-right font-bold ${tx.amount > 0 ? "text-green-700" : "text-red-600"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">{tx.balance_after}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden lg:table-cell">
                      {formatDateTime(tx.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Pix */}
      {activeCharge && (
        <PixModal
          charge={activeCharge}
          onClose={() => setActiveCharge(null)}
          onPaid={() => { setActiveCharge(null); qc.invalidateQueries({ queryKey: ["wallet"] }); }}
        />
      )}
    </div>
  );
}
