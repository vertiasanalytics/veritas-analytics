import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import { isEducationalPlan } from "@/lib/plan-access";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GraduationCap,
  Coins,
  TrendingDown,
  Calendar,
  RefreshCw,
  Gift,
  Clock,
  BookOpen,
  BarChart3,
  User,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ChevronRight,
  Search,
} from "lucide-react";
import { EducationalWatermark } from "@/components/educational-watermark";
import { formatDateTime } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface EduWalletData {
  balance: number;
  subscriptionBalance: number;
  extraBalance: number;
  totalUsed: number;
  planSlug: string | null;
  allowAccumulation: boolean;
  educationalWatermark: boolean;
  transactions: EduTransaction[];
}

interface EduTransaction {
  id: number;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
  reference_id?: string;
  created_at: string;
}

interface SearchUser {
  id: number;
  email: string;
  nome: string;
  planSlug?: string;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useEduWallet() {
  return useQuery<EduWalletData>({
    queryKey: ["wallet"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/wallet`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Erro ao carregar carteira");
      return res.json();
    },
    refetchInterval: 15_000,
  });
}

function useAllUsers() {
  return useQuery<SearchUser[]>({
    queryKey: ["all-users"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/users`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Erro ao carregar usuários");
      return res.json();
    },
  });
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

function extractModuleFromDescription(desc: string): string {
  const prefixes = ["Módulo: ", "Cálculo: ", "Uso: "];
  for (const p of prefixes) {
    if (desc.includes(p)) return desc.split(p)[1]?.trim() ?? desc;
  }
  if (desc.startsWith("Débito:")) return desc.replace("Débito:", "").trim();
  return desc.length > 40 ? desc.slice(0, 40) + "…" : desc;
}

function currentCycleLabel() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function nextResetDate() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  title,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  title: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={`p-2 rounded-xl ${color}`}>
          <Icon size={16} className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function TxTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    debit:        { label: "Uso",        cls: "bg-red-100 text-red-700" },
    grant:        { label: "Bônus",      cls: "bg-blue-100 text-blue-700" },
    subscription: { label: "Renovação",  cls: "bg-violet-100 text-violet-700" },
    purchase:     { label: "Compra",     cls: "bg-green-100 text-green-700" },
    bonus:        { label: "Bônus",      cls: "bg-blue-100 text-blue-700" },
  };
  const t = map[type] ?? { label: type, cls: "bg-gray-100 text-gray-600" };
  return <Badge variant="outline" className={`text-xs px-2 py-0.5 border-0 ${t.cls}`}>{t.label}</Badge>;
}

// ─── Modal de concessão de créditos (admin) ───────────────────────────────────

function GrantModal({ onClose }: { onClose: () => void }) {
  const { data: users = [] } = useAllUsers();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [amount, setAmount] = useState("10");
  const [motivo, setMotivo] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.nome ?? "").toLowerCase().includes(q)
    ).slice(0, 8);
  }, [users, search]);

  const grant = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/wallet/admin/grant`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser!.id,
          amount: Number(amount),
          motivo: motivo || undefined,
        }),
      });
      if (!res.ok) throw new Error("Erro ao conceder créditos");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Créditos concedidos com sucesso!" });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["edu-subscribers"] });
      onClose();
    },
    onError: () => toast({ title: "Erro ao conceder créditos", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift size={18} className="text-blue-600" />
            Conceder Créditos Educacionais
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Busca de usuário */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Usuário beneficiário</label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por nome ou email…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelectedUser(null); }}
                className="pl-8 h-9 text-sm"
              />
            </div>
            {search && !selectedUser && (
              <div className="border rounded-xl divide-y max-h-40 overflow-y-auto">
                {filtered.length === 0 && (
                  <p className="text-xs text-slate-400 px-3 py-2">Nenhum usuário encontrado</p>
                )}
                {filtered.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { setSelectedUser(u); setSearch(""); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors"
                  >
                    <p className="text-sm font-medium">{u.nome || u.email}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </button>
                ))}
              </div>
            )}
            {selectedUser && (
              <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2 border border-blue-100">
                <User size={14} className="text-blue-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-800 truncate">{selectedUser.nome || selectedUser.email}</p>
                  <p className="text-xs text-blue-500">{selectedUser.email}</p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="text-xs text-blue-400 hover:text-blue-600">trocar</button>
              </div>
            )}
          </div>

          {/* Quantidade */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Quantidade de créditos</label>
            <Input
              type="number"
              min="1"
              max="500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Motivo */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Motivo (opcional)</label>
            <Textarea
              rows={2}
              placeholder="Ex.: Apoio à pesquisa de TCC – turma 2026/1"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="text-sm resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1"
              disabled={!selectedUser || Number(amount) <= 0 || grant.isPending}
              onClick={() => grant.mutate()}
            >
              {grant.isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : <Gift size={14} className="mr-2" />}
              Conceder
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function PainelEducacional() {
  const { user } = useAuth();
  const { data: subData } = useSubscription();
  const { data: wallet, isLoading } = useEduWallet();
  const [showGrant, setShowGrant] = useState(false);

  const isAdmin = user?.role === "admin";
  const planSlug = subData?.planSlug ?? null;
  const isEdu = isEducationalPlan(planSlug) || isAdmin;

  const cycle = currentCycleLabel();
  const nextReset = nextResetDate();

  // Analytics a partir das transações
  const cycleTransactions = useMemo(() => {
    if (!wallet?.transactions) return [];
    // Filtra pelo ciclo atual (YYYY-MM no created_at)
    return wallet.transactions.filter(
      (t) => t.created_at.slice(0, 7) === cycle
    );
  }, [wallet, cycle]);

  const totalExecutions = useMemo(
    () => cycleTransactions.filter((t) => t.type === "debit").length,
    [cycleTransactions]
  );

  const mostUsedModule = useMemo(() => {
    const count: Record<string, number> = {};
    cycleTransactions
      .filter((t) => t.type === "debit")
      .forEach((t) => {
        const mod = extractModuleFromDescription(t.description);
        count[mod] = (count[mod] || 0) + 1;
      });
    return Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  }, [cycleTransactions]);

  const creditosUsados = wallet
    ? Math.max(0, -(wallet.subscriptionBalance - 20) + wallet.totalUsed)
    : 0;
  const monthlyGranted = 20;
  const subBalance = wallet?.subscriptionBalance ?? 0;
  const extraBalance = wallet?.extraBalance ?? 0;
  const totalBalance = wallet?.balance ?? 0;
  const pctUsed = Math.min(100, Math.round(((monthlyGranted - subBalance) / monthlyGranted) * 100));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-blue-600" size={28} />
      </div>
    );
  }

  if (!isEdu) {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center space-y-4 px-4">
        <GraduationCap size={48} className="text-slate-300 mx-auto" />
        <h2 className="text-xl font-semibold text-slate-700">Plano Educacional não ativo</h2>
        <p className="text-slate-500 text-sm">
          Este painel está disponível apenas para usuários com Plano Educacional.
          Entre em contato com o administrador da sua instituição para solicitar acesso.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap size={22} className="text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-800">Painel Educacional</h1>
            <Badge className="bg-blue-100 text-blue-700 border-0 text-xs font-semibold">IFES</Badge>
          </div>
          <p className="text-sm text-slate-500">
            Ciclo atual: <span className="font-medium text-slate-700">{cycle}</span>
            {" · "}
            Próxima renovação: <span className="font-medium text-slate-700">{nextReset}</span>
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowGrant(true)} className="gap-2 shrink-0">
            <Gift size={15} />
            Conceder Créditos
          </Button>
        )}
      </div>

      {/* Watermark banner */}
      <EducationalWatermark />

      {/* KPI Cards — créditos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={Coins}
          title="Créditos mensais"
          value={monthlyGranted}
          sub="concedidos pelo plano"
          color="bg-blue-500"
        />
        <KpiCard
          icon={TrendingDown}
          title="Créditos de assinatura"
          value={subBalance}
          sub="saldo atual"
          color="bg-amber-500"
        />
        <KpiCard
          icon={Gift}
          title="Créditos extras"
          value={extraBalance}
          sub="bônus acumulados"
          color="bg-green-500"
        />
        <KpiCard
          icon={Coins}
          title="Saldo total"
          value={totalBalance}
          sub="disponível para uso"
          color="bg-violet-500"
        />
      </div>

      {/* Barra de progresso do ciclo */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">Progresso do Ciclo {cycle}</span>
          </div>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <RefreshCw size={12} />
            Sem acúmulo — créditos expiram no fim do mês
          </span>
        </div>
        <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              pctUsed >= 90 ? "bg-red-500" : pctUsed >= 70 ? "bg-amber-500" : "bg-blue-500"
            }`}
            style={{ width: `${pctUsed}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>{monthlyGranted - subBalance} créditos utilizados</span>
          <span>{subBalance} restantes de {monthlyGranted}</span>
        </div>
        {pctUsed >= 90 && (
          <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            <AlertTriangle size={14} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-700">Créditos mensais quase esgotados. Utilize com moderação ou contate o administrador.</p>
          </div>
        )}
      </div>

      {/* KPI Cards — uso */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          icon={BarChart3}
          title="Cálculos no ciclo"
          value={totalExecutions}
          sub={`execuções em ${cycle}`}
          color="bg-slate-600"
        />
        <KpiCard
          icon={BookOpen}
          title="Módulo mais usado"
          value={mostUsedModule}
          color="bg-indigo-500"
        />
        <KpiCard
          icon={CheckCircle2}
          title="Status do plano"
          value="Ativo"
          sub="Plano Educacional IFES"
          color="bg-emerald-500"
        />
      </div>

      {/* Regras do plano */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap size={16} className="text-blue-600" />
          <span className="text-sm font-semibold text-blue-800">Regras do Plano Educacional</span>
        </div>
        <ul className="space-y-1.5 text-sm text-blue-700">
          <li className="flex items-start gap-2">
            <ChevronRight size={14} className="mt-0.5 shrink-0 text-blue-400" />
            <span><strong>20 créditos mensais</strong> liberados automaticamente no início de cada ciclo</span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight size={14} className="mt-0.5 shrink-0 text-blue-400" />
            <span><strong>Sem acúmulo</strong> — créditos não utilizados expiram no último dia do mês</span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight size={14} className="mt-0.5 shrink-0 text-blue-400" />
            <span><strong>Fins educacionais</strong> — todos os relatórios incluem marca d'água "Uso Educacional"</span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight size={14} className="mt-0.5 shrink-0 text-blue-400" />
            <span><strong>Módulos disponíveis:</strong> Previdenciário, Valor da Causa, Juros e Amortização</span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight size={14} className="mt-0.5 shrink-0 text-blue-400" />
            <span>Créditos bônus concedidos pelo administrador não expiram com o ciclo mensal</span>
          </li>
        </ul>
      </div>

      {/* Histórico de transações */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Histórico de Uso — Ciclo Atual</h2>
          </div>
          <Badge variant="outline" className="text-xs text-slate-500">
            {cycleTransactions.length} transações
          </Badge>
        </div>

        {cycleTransactions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma transação neste ciclo ainda.</p>
            <p className="text-xs mt-1">Use os módulos de cálculo para começar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3">Módulo / Descrição</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3 text-right">Créditos</th>
                  <th className="px-5 py-3 text-right">Saldo após</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cycleTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap text-xs">
                      {formatDateTime(t.created_at)}
                    </td>
                    <td className="px-5 py-3 text-slate-700 max-w-xs">
                      <span className="line-clamp-1">
                        {extractModuleFromDescription(t.description)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <TxTypeBadge type={t.type} />
                    </td>
                    <td className={`px-5 py-3 text-right font-semibold tabular-nums ${
                      t.amount < 0 ? "text-red-600" : "text-green-600"
                    }`}>
                      {t.amount > 0 ? `+${t.amount}` : t.amount}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600 tabular-nums">
                      {t.balance_after}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Todas as transações (se houver mais fora do ciclo atual) */}
      {(wallet?.transactions?.length ?? 0) > cycleTransactions.length && (
        <p className="text-xs text-slate-400 text-center pb-4">
          Mostrando apenas transações do ciclo atual ({cycle}). Histórico completo em{" "}
          <a href={`${BASE}/creditos`} className="text-blue-500 underline underline-offset-2">Meus Créditos</a>.
        </p>
      )}

      {/* Modal de concessão */}
      {showGrant && <GrantModal onClose={() => setShowGrant(false)} />}
    </div>
  );
}
