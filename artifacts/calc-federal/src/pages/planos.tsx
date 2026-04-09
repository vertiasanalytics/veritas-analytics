import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  CheckCircle2, Crown, Coins, Star, Zap, Building2,
  Loader2, AlertCircle, Copy, Clock, QrCode, PartyPopper,
  CreditCard, Smartphone, ExternalLink, Shield,
  ArrowRight, Sparkles, Lock, Users, TrendingUp, Award,
  FileText, BarChart3, Globe, HeadphonesIcon, Rocket,
  GraduationCap, MessageCircle, Receipt, TicketPercent,
  Banknote, ShieldCheck, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const fmtBRL2 = (n: number) =>
  "R$\u00a0" + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Termo de Adesão ─────────────────────────────────────────────────────────
const TERMS_TEXT = `TERMO DE ADESÃO E CONDIÇÕES DE USO — VERITAS ANALYTICS
Versão 1.0 — Atualizado em 06/04/2026

1. OBJETO
O presente Termo de Adesão regula o acesso e a utilização da plataforma Veritas Analytics, ambiente digital destinado à realização de cálculos judiciais, perícias contábeis, análises econômicas, geração de relatórios técnicos, gestão operacional e demais funcionalidades disponibilizadas ao assinante, conforme o plano contratado.

2. ACEITE ELETRÔNICO
Ao marcar a opção "Li e concordo com os Termos de Uso" e prosseguir com a contratação, o usuário manifesta aceite eletrônico livre, informado e inequívoco, com validade jurídica, nos termos da legislação brasileira aplicável, inclusive do Código Civil, do Marco Civil da Internet e da legislação relativa à formalização eletrônica de contratos.

3. CADASTRO E RESPONSABILIDADE DO USUÁRIO
O usuário declara que prestará informações verídicas, completas e atualizadas no momento da contratação, responsabilizando-se integralmente pela exatidão dos dados fornecidos. O Veritas Analytics poderá suspender ou limitar o acesso em caso de inconsistência cadastral, uso indevido, fraude ou violação deste Termo.

4. ACESSO À PLATAFORMA
O acesso à plataforma será realizado por meio de login e senha vinculados ao titular da conta. A senha é pessoal, única e intransferível, sendo vedado o compartilhamento com terceiros, salvo quando o plano contratado prever estrutura multiusuário com acessos próprios e individualizados.

5. PLANOS, CRÉDITOS E UTILIZAÇÃO
5.1. Os créditos disponibilizados no âmbito do plano não são cumulativos.
5.2. Créditos não utilizados dentro do respectivo ciclo de vigência serão automaticamente expirados ao término do período aplicável, sem geração de saldo para o mês subsequente.
5.3. Havendo esgotamento dos créditos disponibilizados no plano, o usuário deverá adquirir novos créditos, migrar de plano ou aguardar a renovação do ciclo.
5.4. Créditos possuem natureza de licença de uso operacional da plataforma.

6. PREÇOS, COBRANÇA E RENOVAÇÃO
Os preços, periodicidades, condições promocionais, descontos, cupons e meios de pagamento serão apresentados na tela de contratação. A contratação poderá ocorrer em modalidade mensal, anual ou personalizada. Promoções e cupons não geram direito adquirido para renovações futuras.

7. NATUREZA DA FERRAMENTA
O Veritas Analytics constitui ferramenta de apoio técnico-profissional. Os cálculos, relatórios e documentos emitidos pelo sistema devem ser conferidos pelo usuário antes de qualquer protocolo, assinatura ou tomada de decisão. A responsabilidade pelo uso profissional dos resultados é exclusiva do usuário.

8. PROTEÇÃO DE DADOS
O tratamento de dados pessoais observará a legislação brasileira aplicável, especialmente a LGPD. Os dados serão utilizados para viabilizar autenticação, contratação, faturamento, suporte e segurança.

9. LIMITAÇÃO DE RESPONSABILIDADE
Na máxima extensão admitida em lei, o Veritas Analytics não responde por prejuízos decorrentes de interpretação jurídica do usuário, parametrização inadequada ou resultados utilizados sem revisão técnica.

10. FORO
Fica eleito o foro da Comarca de Teófilo Otoni/MG para dirimir controvérsias oriundas deste Termo.`.trim();

// ─── Cupons ──────────────────────────────────────────────────────────────────
type Coupon = { code: string; type: "percent" | "fixed"; value: number; description: string };
const COUPONS: Record<string, Coupon> = {
  OAB25:     { code: "OAB25",     type: "percent", value: 25, description: "25% de desconto" },
  VERITAS10: { code: "VERITAS10", type: "percent", value: 10, description: "10% de desconto" },
  IFES20:    { code: "IFES20",    type: "percent", value: 20, description: "20% — plano Educacional" },
  WELCOME50: { code: "WELCOME50", type: "fixed",   value: 50, description: "R$ 50,00 de desconto" },
};

// ─── Tipos da API ─────────────────────────────────────────────────────────────
interface PlanPricing {
  base: number; pixPrice: number; cardPrice: number;
  card3x: number; maxInstallments: number;
}
interface Plan {
  id: number; name: string; slug: string;
  price_monthly: number; credits_monthly: number; max_users: number;
  pricing: PlanPricing;
}
interface Subscription {
  id: number; plan_id: number; plan_name: string; status: string;
  starts_at: string; ends_at: string;
  credits_monthly: number; max_users: number; price_monthly: number;
}
interface PlansData {
  plans: Plan[];
  currentSubscription: Subscription | null;
  wallet: { balance: number; subscription_balance: number; extra_balance: number };
  teamCount: number;
}
interface CreditPackage {
  id: string; name: string; credits: number; bonus: number; price: number;
}
interface PixModalData {
  txid: string; valor: number;
  pixCopiaECola: string; pixQrBase64?: string;
  label: string; creditos?: number;
  pollEndpoint: string; simulateEndpoint: string;
}
interface CardModalData {
  txid: string; valor: number; checkoutUrl: string;
  label: string; creditos?: number;
  pollEndpoint: string; simulateEndpoint: string;
}

// ─── Catálogo estático ────────────────────────────────────────────────────────
type BillingPeriod = "mensal" | "anual";

interface PlanCatalog {
  slug: string; nome: string; tag: string;
  destaque: boolean; isCorporativo?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  precoMensal: number; precoAnual: number;
  parceladoAnual: number; economiaAnual: number;
  creditsMensal: number | null; creditsAnual: number | null;
  beneficios: { icon: React.ComponentType<{ className?: string }>; texto: string }[];
  bonus: string[]; maxUsuarios: number;
  headerGradient: string; cardBorder: string;
  badgeBg: string; badgeText: string;
  btnClass: string; accentColor: string;
  ringClass: string; accentGradient: string;
}

const CATALOG: PlanCatalog[] = [
  {
    slug: "educacional", nome: "Educacional", tag: "Universidades e IFES",
    destaque: false,
    icon: GraduationCap,
    precoMensal: 67.27, precoAnual: 807.20, parceladoAnual: 67.27, economiaAnual: 0,
    creditsMensal: 10, creditsAnual: 120, maxUsuarios: 3,
    beneficios: [
      { icon: TrendingUp, texto: "Módulos principais" },
      { icon: FileText,   texto: "Uso acadêmico e institucional" },
      { icon: BarChart3,  texto: "Simulações e treinamento" },
      { icon: Users,      texto: "1 a 3 usuários" },
    ],
    bonus: ["Controle administrativo educacional"],
    headerGradient: "from-[#073d2e] to-[#0f5c42]",
    cardBorder: "border-emerald-700",
    badgeBg: "bg-emerald-900/40", badgeText: "text-emerald-200",
    btnClass: "bg-emerald-600 hover:bg-emerald-500 text-white",
    accentColor: "text-emerald-300",
    ringClass: "ring-emerald-500",
    accentGradient: "from-emerald-500 to-teal-500",
  },
  {
    slug: "essencial", nome: "Essencial", tag: "Profissionais autônomos",
    destaque: false,
    icon: Star,
    precoMensal: 149.90, precoAnual: 1439.00, parceladoAnual: 119.92, economiaAnual: 20,
    creditsMensal: 40, creditsAnual: 480, maxUsuarios: 1,
    beneficios: [
      { icon: TrendingUp, texto: "Cálculos previdenciários" },
      { icon: BarChart3,  texto: "Atualização monetária" },
      { icon: FileText,   texto: "Cálculo do valor da causa" },
      { icon: CreditCard, texto: "Controle financeiro básico" },
      { icon: Users,      texto: "1 usuário" },
    ],
    bonus: [],
    headerGradient: "from-[#1a3a5c] to-[#1e4d7a]",
    cardBorder: "border-slate-700",
    badgeBg: "bg-[#1a3a5c]/60", badgeText: "text-blue-200",
    btnClass: "bg-blue-600 hover:bg-blue-500 text-white",
    accentColor: "text-blue-300",
    ringClass: "ring-blue-500",
    accentGradient: "from-sky-500 to-blue-500",
  },
  {
    slug: "profissional", nome: "Profissional", tag: "Peritos e escritórios recorrentes",
    destaque: true,
    icon: Zap,
    precoMensal: 249.90, precoAnual: 2399.00, parceladoAnual: 199.92, economiaAnual: 20,
    creditsMensal: 100, creditsAnual: 1200, maxUsuarios: 3,
    beneficios: [
      { icon: Award,        texto: "Tudo do Essencial" },
      { icon: ArrowRight,   texto: "Contas a receber e a pagar" },
      { icon: TrendingUp,   texto: "Fluxo de caixa" },
      { icon: FileText,     texto: "Clientes e contratos" },
      { icon: ExternalLink, texto: "Relatórios profissionais" },
      { icon: Users,        texto: "Até 3 usuários" },
    ],
    bonus: ["Atualizações automáticas", "Suporte prioritário"],
    headerGradient: "from-[#2d1b69] to-[#4c2a9e]",
    cardBorder: "border-violet-500",
    badgeBg: "bg-violet-900/40", badgeText: "text-violet-200",
    btnClass: "bg-violet-600 hover:bg-violet-500 text-white",
    accentColor: "text-violet-300",
    ringClass: "ring-violet-400",
    accentGradient: "from-violet-500 to-fuchsia-500",
  },
  {
    slug: "avancado", nome: "Business", tag: "Escritórios estruturados",
    destaque: false,
    icon: Building2,
    precoMensal: 449.90, precoAnual: 4319.00, parceladoAnual: 359.92, economiaAnual: 20,
    creditsMensal: 250, creditsAnual: 3000, maxUsuarios: 8,
    beneficios: [
      { icon: Crown,    texto: "Tudo do Profissional" },
      { icon: Globe,    texto: "Custas, depósitos e alvarás" },
      { icon: TrendingUp, texto: "Repasses e sócios" },
      { icon: BarChart3, texto: "Tributos e retenções" },
      { icon: FileText,  texto: "Conciliação bancária" },
      { icon: Award,     texto: "Relatórios gerenciais" },
      { icon: Users,     texto: "Até 8 usuários" },
    ],
    bonus: ["Suporte dedicado", "Acesso antecipado", "Consultoria técnica inicial"],
    headerGradient: "from-[#3d2200] to-[#7c4a00]",
    cardBorder: "border-amber-600",
    badgeBg: "bg-amber-900/30", badgeText: "text-amber-200",
    btnClass: "bg-amber-500 hover:bg-amber-400 text-[#1a0a00] font-bold",
    accentColor: "text-amber-300",
    ringClass: "ring-amber-500",
    accentGradient: "from-amber-400 to-orange-500",
  },
  {
    slug: "corporativo", nome: "Corporativo", tag: "Grandes escritórios e instituições",
    destaque: false, isCorporativo: true,
    icon: Crown,
    precoMensal: 0, precoAnual: 0, parceladoAnual: 0, economiaAnual: 0,
    creditsMensal: null, creditsAnual: null, maxUsuarios: 9999,
    beneficios: [
      { icon: Crown,          texto: "Escopo personalizado" },
      { icon: Users,          texto: "Usuários sob medida" },
      { icon: Sparkles,       texto: "Créditos sob medida" },
      { icon: Globe,          texto: "Governança institucional" },
      { icon: HeadphonesIcon, texto: "Suporte dedicado" },
      { icon: Rocket,         texto: "Integrações específicas" },
    ],
    bonus: ["Gerente de conta exclusivo", "SLA garantido 99,9%", "Onboarding personalizado"],
    headerGradient: "from-[#1a0a30] to-[#2d1060]",
    cardBorder: "border-purple-500",
    badgeBg: "bg-purple-900/40", badgeText: "text-purple-200",
    btnClass: "bg-gradient-to-r from-purple-600 to-violet-500 hover:brightness-110 text-white font-bold",
    accentColor: "text-purple-300",
    ringClass: "ring-purple-500",
    accentGradient: "from-purple-500 to-indigo-500",
  },
];

// ─── Hooks de dados ───────────────────────────────────────────────────────────
function usePlans() {
  return useQuery<PlansData>({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/plans`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Erro ao carregar planos");
      return res.json();
    },
  });
}
function useCreditPackages() {
  return useQuery<{ packages: CreditPackage[] }>({
    queryKey: ["wallet-packages"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/wallet`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      return res.json();
    },
  });
}

// ─── Modal Pix ────────────────────────────────────────────────────────────────
function PixModal({ data, onClose, onPaid }: {
  data: PixModalData | null; onClose: () => void; onPaid: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"pending" | "paid" | "expired">("pending");
  const [simulating, setSimulating] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const { toast } = useToast();

  const poll = useCallback(async () => {
    if (!data || status !== "pending") return;
    try {
      const r = await fetch(data.pollEndpoint, { headers: getAuthHeaders() });
      const b = await r.json();
      if (b.status === "paid") { setStatus("paid"); onPaid(); }
      else if (b.status === "expired") setStatus("expired");
    } catch { /* silencioso */ }
  }, [data, status, onPaid]);

  useEffect(() => {
    if (!data || status !== "pending") return;
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, [data, status, poll]);

  useEffect(() => {
    if (!data) return;
    setStatus("pending"); setTimeLeft(30 * 60);
    const t = setInterval(() => setTimeLeft(s => {
      if (s <= 1) { clearInterval(t); setStatus("expired"); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [data]);

  const copy = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.pixCopiaECola);
    setCopied(true); toast({ title: "Código Pix copiado!" });
    setTimeout(() => setCopied(false), 3000);
  };

  const simulate = async () => {
    if (!data || simulating) return;
    setSimulating(true);
    try {
      const r = await fetch(data.simulateEndpoint, { method: "POST", headers: getAuthHeaders() });
      const b = await r.json();
      if (r.ok) { setStatus("paid"); onPaid(); }
      else toast({ title: "Erro", description: b.error, variant: "destructive" });
    } catch { toast({ title: "Erro ao simular", variant: "destructive" }); }
    finally { setSimulating(false); }
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <Dialog open={!!data} onOpenChange={o => { if (!o && status !== "pending") onClose(); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl">
        {status === "paid" ? (
          <div className="flex flex-col items-center gap-4 py-12 px-6 text-center bg-gradient-to-b from-emerald-50 to-white">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center shadow-inner">
              <PartyPopper className="h-10 w-10 text-emerald-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-emerald-700">Pagamento confirmado!</p>
              <p className="text-sm text-slate-500 mt-1 max-w-xs">
                <strong>{data?.label}</strong>
                {data?.creditos ? ` — ${data.creditos} créditos adicionados.` : " ativado com sucesso."}
              </p>
            </div>
            <Button onClick={onClose} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8">Continuar</Button>
          </div>
        ) : status === "expired" ? (
          <div className="flex flex-col items-center gap-4 py-12 px-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <div>
              <p className="font-bold text-red-700 text-lg">Cobrança expirada</p>
              <p className="text-sm text-slate-400 mt-1">Gere um novo Pix para tentar novamente.</p>
            </div>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </div>
        ) : !data ? null : (
          <>
            {/* Header compacto */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-emerald-100 leading-none mb-0.5">Pagamento via PIX · 5% de desconto</p>
                  <p className="font-semibold text-sm leading-tight">{data.label}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-black tracking-tight">{fmtBRL2(data.valor)}</p>
                <p className="text-xs text-emerald-200">a pagar</p>
              </div>
            </div>

            {/* Corpo em duas colunas: QR + Instruções */}
            <div className="flex gap-0 divide-x divide-slate-100">
              {/* Coluna QR */}
              <div className="flex flex-col items-center justify-center p-5 gap-3 min-w-[180px]">
                {data.pixQrBase64 ? (
                  <div className="p-2 rounded-xl border-2 border-emerald-200 bg-white shadow-sm">
                    <img src={`data:image/png;base64,${data.pixQrBase64}`} alt="QR Pix" className="w-36 h-36 rounded-md" />
                  </div>
                ) : (
                  <div className="w-36 h-36 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <QrCode className="h-10 w-10" />
                    <span className="text-xs text-center">Use o código</span>
                  </div>
                )}
                <p className="text-xs text-slate-400 text-center">Escaneie com o app do seu banco</p>
              </div>

              {/* Coluna instruções */}
              <div className="flex-1 p-5 flex flex-col gap-3 justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Pix Copia e Cola</p>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500 font-mono break-all leading-relaxed max-h-16 overflow-y-auto">
                    {data.pixCopiaECola}
                  </div>
                  <Button onClick={copy} className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white gap-2" size="sm">
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? "Copiado!" : "Copiar código Pix"}
                  </Button>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    Expira em <strong className="text-slate-700 ml-1">{fmt(timeLeft)}</strong>
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-500 font-medium">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Aguardando…
                  </span>
                </div>

                <Button
                  variant="ghost" size="sm"
                  className="w-full text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 border border-dashed border-amber-200"
                  onClick={simulate} disabled={simulating}
                >
                  {simulating && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  Simular confirmação (ambiente de teste)
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal Cartão ─────────────────────────────────────────────────────────────
function CardModal({ data, onClose, onPaid }: {
  data: CardModalData | null; onClose: () => void; onPaid: () => void;
}) {
  const [status, setStatus] = useState<"pending" | "paid" | "expired">("pending");
  const [simulating, setSimulating] = useState(false);
  const [opened, setOpened] = useState(false);
  const { toast } = useToast();

  const poll = useCallback(async () => {
    if (!data || status !== "pending") return;
    try {
      const r = await fetch(data.pollEndpoint, { headers: getAuthHeaders() });
      const b = await r.json();
      if (b.status === "paid") { setStatus("paid"); onPaid(); }
      else if (b.status === "expired") setStatus("expired");
    } catch { /* silencioso */ }
  }, [data, status, onPaid]);

  useEffect(() => {
    if (!data || status !== "pending") return;
    setStatus("pending"); setOpened(false);
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, [data]);

  const openCheckout = () => { if (!data) return; window.open(data.checkoutUrl, "_blank", "noopener,noreferrer"); setOpened(true); };

  const simulate = async () => {
    if (!data || simulating) return;
    setSimulating(true);
    try {
      const r = await fetch(data.simulateEndpoint, { method: "POST", headers: getAuthHeaders() });
      const b = await r.json();
      if (r.ok) { setStatus("paid"); onPaid(); }
      else toast({ title: "Erro", description: b.error, variant: "destructive" });
    } catch { toast({ title: "Erro ao simular", variant: "destructive" }); }
    finally { setSimulating(false); }
  };

  return (
    <Dialog open={!!data} onOpenChange={o => { if (!o && status !== "pending") onClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
        {status === "paid" ? (
          <div className="flex flex-col items-center gap-4 py-12 px-6 text-center bg-gradient-to-b from-blue-50 to-white">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center shadow-inner">
              <PartyPopper className="h-10 w-10 text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-blue-700">Pagamento aprovado!</p>
              <p className="text-sm text-slate-500 mt-1">
                <strong>{data?.label}</strong>{data?.creditos ? ` — ${data.creditos} créditos adicionados.` : " ativado com sucesso."}
              </p>
            </div>
            <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white px-8">Continuar</Button>
          </div>
        ) : status === "expired" ? (
          <div className="flex flex-col items-center gap-4 py-12 px-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <p className="font-bold text-red-700 text-lg">Sessão expirada</p>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </div>
        ) : !data ? null : (
          <>
            <div className="bg-gradient-to-br from-[#009EE3] to-[#006FA8] px-6 pt-6 pb-5 text-white">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">MP</div>
                <span className="font-semibold">Mercado Pago</span>
              </div>
              <p className="text-xs text-blue-100 mb-1">{data.label}</p>
              <p className="text-4xl font-bold tracking-tight">{fmtBRL2(data.valor)}</p>
              <p className="text-xs text-blue-100 mt-1">Cartão de crédito ou débito</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-600"><Shield className="h-4 w-4 text-blue-500 shrink-0" /><span>Pagamento seguro via Mercado Pago</span></div>
                <div className="flex items-center gap-2 text-slate-600"><CreditCard className="h-4 w-4 text-blue-500 shrink-0" /><span>Visa, Mastercard, Elo, Hipercard, Amex</span></div>
                <div className="flex items-center gap-2 text-slate-600"><CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" /><span>Confirmação automática em segundos</span></div>
              </div>
              <Button onClick={openCheckout} className="w-full bg-[#009EE3] hover:bg-[#007ab8] text-white gap-2 h-12 text-base font-semibold shadow-sm">
                <ExternalLink className="h-4 w-4" />
                {opened ? "Reabrir checkout" : "Pagar agora com Mercado Pago"}
              </Button>
              {opened && (
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 bg-blue-50 rounded-lg py-2.5">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                  Aguardando confirmação do pagamento…
                </div>
              )}
              <Button
                variant="ghost" size="sm"
                className="w-full text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 border border-dashed border-amber-200"
                onClick={simulate} disabled={simulating}
              >
                {simulating && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Simular confirmação (apenas ambiente de teste)
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Card do Plano (compacto) ─────────────────────────────────────────────────
function PlanCard({
  cat, isActive, isSelected, onSelect,
}: {
  cat: PlanCatalog; isActive: boolean; isSelected: boolean;
  onSelect: (slug: string) => void;
}) {
  const Icon = cat.icon;
  return (
    <div
      onClick={() => !cat.isCorporativo && onSelect(cat.slug)}
      className={cn(
        "relative flex flex-col rounded-3xl overflow-hidden transition-all duration-300 border cursor-pointer",
        "hover:-translate-y-1 hover:shadow-2xl",
        cat.destaque ? `${cat.cardBorder} border-2 shadow-xl shadow-violet-900/30` : `${cat.cardBorder} shadow-lg`,
        isSelected && `ring-2 ${cat.ringClass} scale-[1.02]`
      )}
      style={{ background: "linear-gradient(160deg, #0a1628 0%, #111827 100%)" }}
    >
      {/* Badge Mais Escolhido */}
      {cat.destaque && (
        <div className="absolute top-0 inset-x-0 flex justify-center z-10">
          <span className="bg-gradient-to-r from-violet-500 via-purple-500 to-violet-600 text-white text-xs font-bold px-5 py-1.5 rounded-b-2xl shadow-lg tracking-wide flex items-center gap-1.5">
            <Award className="h-3 w-3" /> Mais escolhido
          </span>
        </div>
      )}

      {/* Faixa de cor superior */}
      <div className={cn("h-1.5 w-full bg-gradient-to-r", cat.accentGradient)} />

      {/* Header */}
      <div className={cn("bg-gradient-to-br p-5 text-white", cat.headerGradient, cat.destaque && "pt-8")}>
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-base leading-tight">{cat.nome}</p>
            <p className="text-xs text-white/60">{cat.tag}</p>
          </div>
          {isActive && (
            <span className="ml-auto bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold px-2 py-0.5 rounded-full">
              Ativo
            </span>
          )}
        </div>
        {/* Preço */}
        <div className="mt-3">
          {cat.isCorporativo ? (
            <p className="text-xl font-extrabold text-white leading-tight">Sob<br/>consulta</p>
          ) : (
            <div className="flex items-baseline gap-1 flex-wrap">
              <span className="text-2xl font-extrabold tracking-tight text-white leading-none">{fmtBRL2(cat.precoMensal)}</span>
              <span className="text-white/60 text-xs">/mês</span>
            </div>
          )}
        </div>
      </div>

      {/* Corpo */}
      <div className="flex-1 flex flex-col p-4 gap-3">
        {/* Créditos */}
        {cat.creditsMensal != null && (
          <div className={cn("rounded-xl border border-white/10 px-3 py-2.5", cat.badgeBg)}>
            <div className="flex items-center gap-1.5">
              <Coins className={cn("h-3.5 w-3.5", cat.accentColor)} />
              <span className={cn("text-xl font-extrabold text-white")}>{cat.creditsMensal}</span>
              <span className="text-sm text-white/60">créditos/mês</span>
            </div>
          </div>
        )}

        {/* Benefícios */}
        <ul className="space-y-1.5">
          {cat.beneficios.slice(0, 4).map((b, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
              <Check className={cn("h-3.5 w-3.5 shrink-0", cat.accentColor)} />
              {b.texto}
            </li>
          ))}
          {cat.beneficios.length > 4 && (
            <li className="text-xs text-slate-500">+{cat.beneficios.length - 4} funcionalidades</li>
          )}
        </ul>

        <div className="flex-1" />

        {/* CTA */}
        {isActive ? (
          <div className="flex items-center justify-center gap-2 text-sm text-emerald-400 font-semibold py-2.5 bg-emerald-900/20 border border-emerald-700/40 rounded-2xl">
            <CheckCircle2 className="h-4 w-4" /> Plano atual
          </div>
        ) : cat.isCorporativo ? (
          <a
            href="mailto:contato@veritasanalytics.com.br?subject=Interesse%20no%20Plano%20Corporativo"
            onClick={e => e.stopPropagation()}
            className={cn("flex items-center justify-center w-full h-10 text-sm font-bold gap-2 rounded-2xl shadow-lg transition-transform hover:scale-[1.02]", cat.btnClass)}
          >
            <MessageCircle className="h-4 w-4" />
            Falar com comercial
          </a>
        ) : (
          <button
            className={cn(
              "w-full h-10 text-sm font-bold gap-2 rounded-2xl shadow-lg transition-all flex items-center justify-center",
              isSelected
                ? `${cat.btnClass} opacity-90 scale-[0.98]`
                : `${cat.btnClass} hover:scale-[1.02]`
            )}
          >
            {isSelected ? (
              <><CheckCircle2 className="h-4 w-4" /> Selecionado</>
            ) : (
              <>Selecionar plano <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Painel de Checkout (Resumo da Contratação) ───────────────────────────────
function CheckoutPanel({
  cat, billing, setBilling,
  apiPlan, loading, onPix, onCard,
  currentSubscription,
}: {
  cat: PlanCatalog; billing: BillingPeriod;
  setBilling: (v: BillingPeriod) => void;
  apiPlan: Plan | undefined; loading: "pix" | "card" | null;
  onPix: (cat: PlanCatalog, apiPlan: Plan | undefined, netPrice: number) => void;
  onCard: (cat: PlanCatalog, apiPlan: Plan | undefined, netPrice: number) => void;
  currentSubscription: Subscription | null;
}) {
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card" | "boleto">("card");
  const [holderName, setHolderName] = useState("");
  const [holderDoc, setHolderDoc] = useState("");
  const [holderEmail, setHolderEmail] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsExpanded, setTermsExpanded] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; percentual: number; description: string } | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const { toast } = useToast();

  const basePrice = billing === "anual" ? cat.precoAnual : cat.precoMensal;

  const discountAmount = appliedCoupon && !cat.isCorporativo
    ? Math.round(basePrice * (appliedCoupon.percentual / 100) * 100) / 100
    : 0;
  const netPrice = Math.max(0, basePrice - discountAmount);
  const pixPrice  = Math.round(netPrice * 0.95 * 100) / 100;
  const cardPrice = netPrice;

  const canSubmit = !cat.isCorporativo &&
    acceptedTerms &&
    holderName.trim().length >= 3 &&
    holderEmail.includes("@") &&
    holderDoc.replace(/\D/g, "").length >= 11;

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) { setCouponMsg({ text: "Digite um código de cupom.", ok: false }); return; }
    setValidatingCoupon(true);
    try {
      const r = await fetch(`${BASE}/api/admin/cupons/validar`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const b = await r.json();
      if (!r.ok || !b.valid) {
        setAppliedCoupon(null);
        setCouponMsg({ text: b.error ?? "Cupom inválido ou inativo.", ok: false });
      } else {
        setAppliedCoupon({ code: b.code, percentual: b.percentual, description: b.description });
        setCouponMsg({ text: `✓ ${b.description} aplicado!`, ok: true });
      }
    } catch {
      setCouponMsg({ text: "Erro ao validar cupom. Tente novamente.", ok: false });
    } finally {
      setValidatingCoupon(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null); setCouponInput(""); setCouponMsg(null);
  }

  function handleConfirm() {
    if (!canSubmit) return;
    if (paymentMethod === "boleto") {
      toast({ title: "Boleto em breve", description: "Pagamento via boleto estará disponível em breve. Use Pix ou Cartão.", variant: "destructive" });
      return;
    }
    if (paymentMethod === "pix") onPix(cat, apiPlan, pixPrice);
    else onCard(cat, apiPlan, cardPrice);
  }

  const inputCls = "w-full h-11 rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-400/60 focus:bg-white/8 transition";

  return (
    <aside className="w-full">
      <div className="sticky top-6 rounded-3xl border border-white/10 bg-[#0d1a30] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="border-b border-white/10 px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Resumo da contratação</p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={cn("w-8 h-8 rounded-xl bg-gradient-to-br flex items-center justify-center text-white", cat.accentGradient)}>
                <cat.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold text-white leading-tight">{cat.nome}</p>
                <p className="text-xs text-slate-400">{cat.tag}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Toggle Mensal/Anual */}
          <div>
            <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wider">Periodicidade</p>
            <div className="grid grid-cols-2 gap-1.5 bg-white/5 rounded-2xl p-1">
              {(["mensal", "anual"] as BillingPeriod[]).map(opt => (
                <button
                  key={opt}
                  onClick={() => setBilling(opt)}
                  className={cn(
                    "relative rounded-xl py-2.5 text-sm font-semibold transition-all",
                    billing === opt
                      ? "bg-white text-slate-900 shadow-md"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  {opt === "mensal" ? "Mensal" : "Anual"}
                  {opt === "anual" && (
                    <span className={cn(
                      "absolute -top-2 -right-1 text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none",
                      billing === "anual" ? "bg-emerald-500 text-white" : "bg-emerald-600/80 text-white"
                    )}>
                      20% OFF
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Cupom */}
          {!cat.isCorporativo && (
            <div>
              <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <TicketPercent className="h-3.5 w-3.5 text-amber-400" /> Cupom de desconto
              </p>
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-emerald-900/30 border border-emerald-500/30 rounded-xl px-3 py-2.5">
                  <div>
                    <p className="font-mono text-sm font-bold text-emerald-300">{appliedCoupon.code}</p>
                    <p className="text-xs text-emerald-400">{appliedCoupon.description}</p>
                  </div>
                  <button onClick={removeCoupon} className="text-xs text-slate-400 hover:text-red-400 underline transition">Remover</button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      value={couponInput}
                      onChange={e => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === "Enter" && applyCoupon()}
                      placeholder="Código do cupom"
                      className={cn(inputCls, "flex-1 uppercase tracking-widest")}
                    />
                    <button
                      onClick={applyCoupon}
                      disabled={validatingCoupon}
                      className="px-4 h-11 rounded-xl bg-white text-slate-900 text-sm font-bold hover:opacity-90 transition shrink-0 disabled:opacity-60 flex items-center gap-1.5"
                    >
                      {validatingCoupon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Aplicar
                    </button>
                  </div>
                  {couponMsg && (
                    <p className={cn("text-xs mt-1.5", couponMsg.ok ? "text-emerald-400" : "text-red-400")}>
                      {couponMsg.text}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Preços */}
          {!cat.isCorporativo && (
            <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Valor base</span>
                <span className="font-semibold text-white">{fmtBRL2(basePrice)}{billing === "mensal" ? "/mês" : "/ano"}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Desconto ({appliedCoupon?.percentual}%)</span>
                  <span className="font-semibold text-emerald-400">- {fmtBRL2(discountAmount)}</span>
                </div>
              )}
              {paymentMethod === "pix" && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Desconto Pix (5%)</span>
                  <span className="font-semibold text-emerald-400">- {fmtBRL2(Math.round(netPrice * 0.05 * 100) / 100)}</span>
                </div>
              )}
              <div className="border-t border-white/10 pt-2 flex items-center justify-between">
                <span className="font-bold text-white">Total</span>
                <span className="text-xl font-black text-white">
                  {fmtBRL2(paymentMethod === "pix" ? pixPrice : netPrice)}
                  <span className="text-sm font-normal text-slate-400">{billing === "mensal" ? "/mês" : ""}</span>
                </span>
              </div>
            </div>
          )}

          {/* Forma de pagamento */}
          {!cat.isCorporativo ? (
            <div>
              <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-sky-400" /> Forma de pagamento
              </p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "card",   label: "Cartão",  icon: CreditCard },
                  { id: "pix",    label: "PIX",     icon: Zap },
                  { id: "boleto", label: "Boleto",  icon: Receipt },
                ] as { id: "card" | "pix" | "boleto"; label: string; icon: React.ComponentType<{ className?: string }> }[]).map(m => {
                  const MIcon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id)}
                      className={cn(
                        "rounded-xl border py-3 text-sm font-semibold transition-all flex flex-col items-center gap-1.5",
                        paymentMethod === m.id
                          ? "border-violet-400/60 bg-violet-500/15 text-white"
                          : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/8 hover:text-white"
                      )}
                    >
                      <MIcon className="h-4 w-4" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
              {paymentMethod === "card" && (
                <p className="text-xs text-slate-500 mt-1.5 text-center">Visa · Master · Elo · Hipercard · Amex</p>
              )}
              {paymentMethod === "pix" && (
                <p className="text-xs text-emerald-400 mt-1.5 text-center">5% de desconto no Pix</p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-sm text-slate-300">
                Para o plano Corporativo, o fechamento ocorre mediante proposta personalizada, definição de volume, integrações e SLA.
              </p>
            </div>
          )}

          {/* Dados do titular */}
          {!cat.isCorporativo && (
            <div>
              <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wider">Dados do titular</p>
              <div className="space-y-2">
                <input value={holderName} onChange={e => setHolderName(e.target.value)} placeholder="Nome completo" className={inputCls} />
                <input value={holderDoc} onChange={e => setHolderDoc(e.target.value)} placeholder="CPF ou CNPJ" className={inputCls} />
                <input value={holderEmail} onChange={e => setHolderEmail(e.target.value)} placeholder="E-mail" type="email" className={inputCls} />
              </div>
            </div>
          )}

          {/* Termo de Adesão */}
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <button
              onClick={() => setTermsExpanded(!termsExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-white hover:bg-white/5 transition"
            >
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-400" />
                Termo de Adesão à Plataforma Veritas Analytics
              </span>
              <span className="text-slate-400 text-xs">{termsExpanded ? "▲" : "▼"}</span>
            </button>
            {termsExpanded && (
              <div className="border-t border-white/10 px-4 pb-3">
                <div className="max-h-40 overflow-y-auto mt-3 text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">
                  {TERMS_TEXT}
                </div>
                <button
                  onClick={() => setTermsExpanded(false)}
                  className="text-xs text-violet-400 hover:text-violet-300 mt-2 underline"
                >
                  Ver termo completo
                </button>
              </div>
            )}
            <label className="flex items-start gap-3 px-4 pb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={e => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-violet-500"
              />
              <span className="text-xs text-slate-300 leading-5">
                Declaro que li e concordo com os <strong className="text-white">Termos de Uso</strong> e <strong className="text-white">Política de Privacidade</strong> da Veritas Analytics
              </span>
            </label>
          </div>

          {/* Botão confirmar */}
          {cat.isCorporativo ? (
            <a
              href="mailto:contato@veritasanalytics.com.br?subject=Plano%20Corporativo"
              className="flex items-center justify-center gap-2 w-full h-13 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 text-white font-bold text-sm shadow-lg shadow-purple-900/30 hover:brightness-110 transition"
            >
              <MessageCircle className="h-4 w-4" />
              Falar com comercial
            </a>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={!canSubmit || !!loading}
              className={cn(
                "w-full h-13 py-3.5 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2",
                canSubmit && !loading
                  ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-900/30 hover:brightness-110"
                  : "bg-slate-700/60 text-slate-400 cursor-not-allowed"
              )}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {loading ? "Processando…" : "Confirmar Compra Segura"}
            </button>
          )}

          {/* Trust badge */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 pb-1">
            <Shield className="h-3.5 w-3.5 text-emerald-600" />
            Ambiente 100% seguro · Seus dados protegidos
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function PlanosPage() {
  const { data, isLoading, error } = usePlans();
  const { data: walletData } = useCreditPackages();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [billing, setBilling] = useState<BillingPeriod>("anual");
  const [selectedCatSlug, setSelectedCatSlug] = useState<string>("profissional");

  const [pixModal,       setPixModal]       = useState<PixModalData | null>(null);
  const [cardModal,      setCardModal]      = useState<CardModalData | null>(null);
  const [loadingPayment, setLoadingPayment] = useState<"pix" | "card" | null>(null);

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["plans"] });
    qc.invalidateQueries({ queryKey: ["wallet"] });
  }, [qc]);

  const closeAll = useCallback(() => {
    setPixModal(null); setCardModal(null); refresh();
  }, [refresh]);

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/plans/cancel`, { method: "DELETE", headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Erro ao cancelar");
      return r.json();
    },
    onSuccess: () => { toast({ title: "Assinatura cancelada." }); refresh(); },
    onError:   () =>  toast({ title: "Erro ao cancelar", variant: "destructive" }),
  });

  const startPlanPix = async (cat: PlanCatalog, apiPlan: Plan | undefined, netPrice: number) => {
    if (!apiPlan) { toast({ title: "Plano indisponível", variant: "destructive" }); return; }
    const pixPrice = Math.round(netPrice * 0.95 * 100) / 100;
    setLoadingPayment("pix");
    try {
      const r = await fetch(`${BASE}/api/plans/${apiPlan.id}/subscribe`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ billing, valor: pixPrice }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? "Erro ao gerar Pix");
      setPixModal({
        txid: b.txid, valor: pixPrice,
        pixCopiaECola: b.pixCopiaECola, pixQrBase64: b.pixQrBase64,
        label: `Plano ${b.planName}${billing === "anual" ? " (Anual)" : ""}`, creditos: b.creditos,
        pollEndpoint:     `${BASE}/api/plans/pix/${b.txid}`,
        simulateEndpoint: `${BASE}/api/plans/pix/${b.txid}/simulate`,
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setLoadingPayment(null); }
  };

  const startPlanCard = async (cat: PlanCatalog, apiPlan: Plan | undefined, netPrice: number) => {
    if (!apiPlan) { toast({ title: "Plano indisponível", variant: "destructive" }); return; }
    const card3x = billing === "anual"
      ? cat.parceladoAnual
      : Math.round(netPrice / 3 * 100) / 100;
    const maxInstallments = billing === "anual" ? 12 : 3;
    setLoadingPayment("card");
    try {
      const r = await fetch(`${BASE}/api/plans/${apiPlan.id}/subscribe/checkout`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ billing, valor: netPrice, maxInstallments }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? "Erro ao criar checkout");
      setCardModal({
        txid: b.txid, valor: netPrice, checkoutUrl: b.checkoutUrl,
        label: `Plano ${b.planName}${billing === "anual" ? " (Anual)" : ""}`, creditos: b.creditos,
        pollEndpoint:     `${BASE}/api/plans/pix/${b.txid}`,
        simulateEndpoint: `${BASE}/api/plans/pix/${b.txid}/simulate`,
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setLoadingPayment(null); }
  };

  const startCreditPix = async (pkg: CreditPackage) => {
    setLoadingPayment("pix");
    try {
      const r = await fetch(`${BASE}/api/wallet/purchase`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? "Erro ao gerar Pix");
      setPixModal({
        txid: b.txid, valor: b.valor,
        pixCopiaECola: b.pixCopiaECola, pixQrBase64: b.pixQrBase64,
        label: `Pacote ${b.packageName ?? pkg.name}`, creditos: b.creditos,
        pollEndpoint:     `${BASE}/api/wallet/pix/${b.txid}`,
        simulateEndpoint: `${BASE}/api/wallet/pix/${b.txid}/simulate`,
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setLoadingPayment(null); }
  };

  const startCreditCard = async (pkg: CreditPackage) => {
    setLoadingPayment("card");
    try {
      const r = await fetch(`${BASE}/api/wallet/purchase/checkout`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? "Erro ao criar checkout");
      setCardModal({
        txid: b.txid, valor: b.valor, checkoutUrl: b.checkoutUrl,
        label: `Pacote ${b.packageName ?? pkg.name}`, creditos: b.creditos,
        pollEndpoint:     `${BASE}/api/wallet/pix/${b.txid}`,
        simulateEndpoint: `${BASE}/api/wallet/pix/${b.txid}/simulate`,
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setLoadingPayment(null); }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-red-500 gap-2">
        <AlertCircle className="h-5 w-5" /><span>Erro ao carregar os planos</span>
      </div>
    );
  }

  const { plans, currentSubscription, wallet } = data;
  const packages = walletData?.packages ?? [];
  const apiBySlug = new Map<string, Plan>(plans.map(p => [p.slug?.toLowerCase() ?? p.name.toLowerCase(), p]));
  const selectedCat = CATALOG.find(c => c.slug === selectedCatSlug) ?? CATALOG[2];
  const selectedApiPlan = apiBySlug.get(selectedCatSlug) ?? plans.find(p => p.name.toLowerCase().startsWith(selectedCatSlug));

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #080f1c 0%, #0d1b2e 40%, #0f2035 100%)" }}>

      <PixModal  data={pixModal}  onClose={closeAll} onPaid={refresh} />
      <CardModal data={cardModal} onClose={closeAll} onPaid={refresh} />

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] rounded-full opacity-10"
            style={{ background: "radial-gradient(ellipse, #4c8ef7 0%, transparent 70%)" }} />
        </div>
        <div className="relative max-w-screen-xl mx-auto px-6 pt-12 pb-10 text-center">
          <div className="inline-flex items-center gap-2 border border-blue-500/30 bg-blue-500/10 rounded-full px-4 py-1.5 text-xs text-blue-300 font-medium mb-5">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            Veritas Analytics — Planos e Assinaturas
          </div>
          <h1 className="font-cinzel text-3xl md:text-4xl font-bold text-white mb-3 max-w-3xl mx-auto leading-tight">
            Escolha o <span className="text-violet-400">plano ideal</span> para potencializar seus cálculos jurídicos
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto mb-8">
            Acesso completo à plataforma Veritas Analytics, com créditos mensais <strong className="text-slate-200">não cumulativos</strong>.
          </p>

          {/* Stats */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { label: "Saldo total",  value: `${Number(wallet?.balance ?? 0)} créditos`,              icon: Coins,  color: "text-blue-400" },
              { label: "Assinatura",   value: `${Number(wallet?.subscription_balance ?? 0)} créditos`, icon: Star,   color: "text-violet-400" },
              { label: "Avulsos",      value: `${Number(wallet?.extra_balance ?? 0)} créditos`,        icon: Zap,    color: "text-amber-400" },
              { label: "Plano atual",  value: currentSubscription?.plan_name ?? "Nenhum",              icon: Crown,  color: "text-emerald-400" },
            ].map(k => (
              <div key={k.label}
                className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
                <k.icon className={cn("h-4 w-4 shrink-0", k.color)} />
                <div className="text-left">
                  <p className="text-xs text-slate-500">{k.label}</p>
                  <p className="text-sm font-semibold text-white">{k.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 pb-16 space-y-8">

        {/* Banner assinatura ativa */}
        {currentSubscription && (
          <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="font-bold text-emerald-300">Plano {currentSubscription.plan_name} ativo</p>
                <p className="text-sm text-emerald-500">
                  {currentSubscription.credits_monthly} cr/mês · Até {currentSubscription.max_users} usuário(s) ·
                  Renovação em {new Date(currentSubscription.ends_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
            <Button
              variant="outline" size="sm"
              className="border-emerald-700 text-emerald-400 hover:bg-emerald-900/30 shrink-0 bg-transparent"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Cancelar assinatura
            </Button>
          </div>
        )}

        {/* ── Layout principal: Cards + Checkout ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">

          {/* Cards dos Planos */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              {CATALOG.map(cat => {
                const apiPlan = apiBySlug.get(cat.slug) ?? plans.find(p => p.name.toLowerCase().startsWith(cat.slug));
                const isActive   = !!(currentSubscription && apiPlan && currentSubscription.plan_id === apiPlan.id);
                const isSelected = cat.slug === selectedCatSlug;
                return (
                  <PlanCard
                    key={cat.slug}
                    cat={cat}
                    isActive={isActive}
                    isSelected={isSelected}
                    onSelect={setSelectedCatSlug}
                  />
                );
              })}
            </div>

            {/* Trust bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: ShieldCheck, text: "Tecnologia confiável",   color: "text-emerald-400" },
                { icon: Zap,         text: "Mais de 7 módulos",      color: "text-amber-400" },
                { icon: Sparkles,    text: "Atualizações constantes", color: "text-violet-400" },
                { icon: HeadphonesIcon, text: "Suporte especializado", color: "text-sky-400" },
              ].map(({ icon: Ic, text, color }) => (
                <div key={text} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3 py-2.5">
                  <Ic className={cn("h-4 w-4 shrink-0", color)} />
                  <span className="text-xs text-slate-300">{text}</span>
                </div>
              ))}
            </div>

            {/* Política de créditos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { title: "Política de créditos", body: "Créditos válidos apenas no período do plano · Não são cumulativos (reset mensal) · Novos créditos devem ser adquiridos" },
                { title: "Por que Veritas Analytics?", body: "Cálculos precisos e atualizados · Metodologia validada por peritos · Relatórios aptos para processos" },
                { title: "Precisa de ajuda?", body: "(33) 9999-9999\nSeg-Sex 8h-18h" },
              ].map(b => (
                <div key={b.title} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                  <p className="text-xs font-bold text-white mb-1.5">{b.title}</p>
                  <p className="text-xs text-slate-400 whitespace-pre-line leading-5">{b.body}</p>
                </div>
              ))}
            </div>

            {/* Créditos Avulsos */}
            {packages.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Banknote className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Créditos Avulsos</h2>
                    <p className="text-xs text-slate-500">Sem mensalidade · Os créditos nunca expiram</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  {packages.map((pkg, i) => {
                    const total = pkg.credits + pkg.bonus;
                    const perCredit = (pkg.price / total).toFixed(2).replace(".", ",");
                    const isBest = i === packages.length - 1;
                    return (
                      <div
                        key={pkg.id}
                        className={cn(
                          "relative rounded-2xl border p-4 flex flex-col gap-3 transition-all hover:-translate-y-1 hover:shadow-xl",
                          "bg-white/5 backdrop-blur-sm",
                          isBest ? "border-amber-500/50" : "border-white/10"
                        )}
                      >
                        {isBest && (
                          <span className="absolute top-0 right-4 -translate-y-1/2 bg-amber-500 text-[#1a0a00] text-xs font-bold px-3 py-0.5 rounded-full shadow">
                            Melhor valor
                          </span>
                        )}
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-white">{pkg.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">R$ {perCredit}/crédito</p>
                          </div>
                          {pkg.bonus > 0 && (
                            <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">+{pkg.bonus} bônus</span>
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-4xl font-extrabold text-amber-400">{total}</p>
                          <p className="text-sm text-slate-500">créditos</p>
                        </div>
                        <p className="text-center text-xl font-bold text-white">{fmtBRL2(pkg.price)}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 text-xs rounded-xl" onClick={() => startCreditPix(pkg)} disabled={!!loadingPayment}>
                            <Smartphone className="h-3.5 w-3.5" /> Pix
                          </Button>
                          <Button size="sm" className="bg-[#009EE3] hover:bg-[#007ab8] text-white gap-1.5 text-xs rounded-xl" onClick={() => startCreditCard(pkg)} disabled={!!loadingPayment}>
                            <CreditCard className="h-3.5 w-3.5" /> Cartão
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Painel de Checkout */}
          <CheckoutPanel
            cat={selectedCat}
            billing={billing}
            setBilling={setBilling}
            apiPlan={selectedApiPlan}
            loading={loadingPayment}
            onPix={startPlanPix}
            onCard={startPlanCard}
            currentSubscription={currentSubscription}
          />
        </div>

        {/* Rodapé */}
        <div className="flex flex-wrap items-center justify-center gap-6 py-4 border-t border-white/10">
          {[
            { icon: Lock,         text: "Pagamento 100% seguro" },
            { icon: Shield,       text: "Dados protegidos" },
            { icon: CheckCircle2, text: "Ativação imediata" },
            { icon: Rocket,       text: "Plataforma atualizada" },
          ].map(({ icon: Ic, text }) => (
            <div key={text} className="flex items-center gap-1.5 text-xs text-slate-500">
              <Ic className="h-3.5 w-3.5 text-slate-600" />
              {text}
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-slate-600 pb-4">
          Veritas Analytics © {new Date().getFullYear()} — Plataforma de Cálculos Judiciais Federais
        </p>
      </div>
    </div>
  );
}
