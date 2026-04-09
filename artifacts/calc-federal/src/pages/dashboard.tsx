import { Link } from "wouter";
import { formatDate } from "@/lib/utils";
import {
  Landmark, Scale, Briefcase, ArrowRight,
  Users, BarChart3, CreditCard, TrendingUp, TrendingDown, Coins, Activity, CheckCircle,
  DollarSign, ShoppingCart, Clock, Zap, RefreshCw, Gavel, Calculator,
  Microscope, Lock, Crown, Star, FileText, GraduationCap, Tag, Phone, MessageCircle, HardHat, Clock3
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { hasAccess } from "@/lib/plan-access";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

interface AdminStats {
  userCount: number;
  calcCount: number;
  chargesPaid: number;
  chargesPending: number;
  chargesExpired: number;
  creditosTotalVendidos: number;
  receitaTotal: number;
  receitaPendente: number;
  recentSales: RecentSale[];
  topUsers: TopUser[];
}

interface RecentSale {
  txid: string;
  valor: number;
  creditos: number;
  package_id: string;
  paid_at: string;
  nome: string;
  email: string;
}

interface TopUser {
  nome: string;
  email: string;
  balance: number;
  total_bought: number;
  total_used: number;
}

function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/stats/admin`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

function useUserStats() {
  return useQuery<{ credits: number; creditsUsed: number; creditsBought: number; calcCount: number }>({
    queryKey: ["user-stats"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/stats/user`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}

const STAT_COLORS = {
  blue:    { bg: "rgba(59,130,246,0.12)",  icon: "#3b82f6", bar: "rgba(59,130,246,0.06)"  },
  cyan:    { bg: "rgba(6,182,212,0.12)",   icon: "#06b6d4", bar: "rgba(6,182,212,0.06)"   },
  indigo:  { bg: "rgba(99,102,241,0.12)",  icon: "#6366f1", bar: "rgba(99,102,241,0.06)"  },
  emerald: { bg: "rgba(16,185,129,0.12)",  icon: "#10b981", bar: "rgba(16,185,129,0.06)"  },
  amber:   { bg: "rgba(245,158,11,0.12)",  icon: "#f59e0b", bar: "rgba(245,158,11,0.06)"  },
  rose:    { bg: "rgba(244,63,94,0.12)",   icon: "#f43f5e", bar: "rgba(244,63,94,0.06)"   },
};

type StatColor = keyof typeof STAT_COLORS;

function StatCard({ icon: Icon, label, value, color, sub }: { icon: React.ElementType; label: string; value: string | number; color: StatColor; sub?: string }) {
  const c = STAT_COLORS[color];
  return (
    <Card className="relative overflow-hidden border-0 shadow-sm">
      <div className="absolute inset-0" style={{ backgroundColor: c.bar }} />
      <CardContent className="p-5 flex items-center gap-4">
        <div className="p-3 rounded-xl flex-shrink-0" style={{ backgroundColor: c.bg }}>
          <Icon className="w-6 h-6" style={{ color: c.icon }} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-foreground leading-tight">
            {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
          </p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function Skeleton() {
  return <Card className="border-0 shadow-sm"><CardContent className="p-5"><div className="h-16 bg-muted animate-pulse rounded-lg" /></CardContent></Card>;
}

// ─── Module definitions ────────────────────────────────────────────────────────
const USER_MODULES = [
  {
    id: "previdenciario",
    title: "Previdenciário",
    icon: Landmark,
    desc: "Cálculos previdenciários conforme o Manual CJF 2025.",
    available: true,
    planKey: null,
    color: { border: "border-blue-200", bg: "bg-blue-50/50", icon: "bg-blue-100 text-blue-700", badge: "bg-blue-100 text-blue-700 border-blue-200" },
    sistemas: [
      { title: "Atualização Financeira",    url: "/cases/new",      icon: RefreshCw,    available: true,  credits: 5, planKey: "mod:previdenciario"  },
      { title: "Liquidação de Sentença",    url: "/previdenciario", icon: Gavel,        available: true,  credits: 5, planKey: "mod:previdenciario"  },
      { title: "Cálculo do Valor da Causa", url: "/valor-causa",    icon: Calculator,   available: true,  credits: 3, planKey: "mod:valor-causa"     },
    ],
  },
  {
    id: "trabalhista",
    title: "Trabalhista",
    icon: Scale,
    desc: "Verbas rescisórias, FGTS, INSS, IRRF e cálculos trabalhistas por competência.",
    available: true,
    planKey: "mod:trabalhista",
    color: { border: "border-violet-200", bg: "bg-violet-50/50", icon: "bg-violet-100 text-violet-700", badge: "bg-violet-100 text-violet-700 border-violet-200" },
    sistemas: [
      { title: "Cálculo Trabalhista (PJe-Calc)", url: "/trabalhista", icon: Scale, available: true, credits: 5, planKey: "mod:trabalhista" },
      { title: "Insalubridade & Periculosidade", url: "/trabalhista?tab=insalubridade", icon: HardHat, available: true, credits: 5, planKey: "mod:trabalhista" },
      { title: "Horas Extras & Reflexos", url: "/trabalhista?tab=horas-extras", icon: Clock3, available: true, credits: 5, planKey: "mod:trabalhista" },
    ],
  },
  {
    id: "pericial",
    title: "Pericial",
    icon: Briefcase,
    desc: "Laudos periciais contábeis e apuração de danos.",
    available: true,
    planKey: null,
    color: { border: "border-amber-200", bg: "bg-amber-50/50", icon: "bg-amber-100 text-amber-700", badge: "bg-amber-100 text-amber-700 border-amber-200" },
    sistemas: [
      { title: "Revisão de Cálculo de Juros", url: "/pericial/juros-amortizacao",   icon: Calculator,   available: true, credits: 5, planKey: "mod:juros-amortizacao"   },
      { title: "Lucro Cessante (DCF)",        url: "/pericial/lucro-cessante-dcf", icon: TrendingDown, available: true, credits: 5, planKey: "mod:dcf"                },
      { title: "Análise de Balanços",         url: "/pericial/analise-balanco",    icon: Microscope,   available: true, credits: 5, planKey: "mod:analise-balanco"    },
      { title: "Extrator Contracheque SIAPE", url: "/pericial/contracheque-siape", icon: FileText,     available: true, credits: 5, planKey: "mod:contracheque-siape" },
    ],
  },
  {
    id: "honorarios",
    title: "Proposição de Honorários",
    icon: DollarSign,
    desc: "Proposição técnica de honorários periciais contábeis e advocatícios com PDF e integração à Controladoria.",
    available: true,
    planKey: null,
    color: { border: "border-green-200", bg: "bg-green-50/50", icon: "bg-green-100 text-green-700", badge: "bg-green-100 text-green-700 border-green-200" },
    sistemas: [
      { title: "Honorários Periciais Contábeis", url: "/pericial/honorarios-periciais",  icon: FileText,   available: true, credits: 0, planKey: "mod:honorarios-periciais"  },
      { title: "Honorários Advocatícios",        url: "/juridico/honorarios-juridicos",  icon: Gavel,      available: true, credits: 0, planKey: "mod:honorarios-juridicos"  },
    ],
  },
  {
    id: "familia",
    title: "Família",
    icon: Users,
    desc: "Análise técnico-jurídica para revisão de pensão alimentícia com motor de cenários revisionais e relatório completo.",
    available: true,
    planKey: null,
    color: { border: "border-rose-200", bg: "bg-rose-50/50", icon: "bg-rose-100 text-rose-700", badge: "bg-rose-100 text-rose-700 border-rose-200" },
    sistemas: [
      { title: "Revisão de Pensão Alimentícia", url: "/familia/revisao-pensao", icon: Scale, available: true, credits: 5, planKey: "mod:familia" },
    ],
  },
  {
    id: "civel",
    title: "Cível",
    icon: Gavel,
    desc: "Apuração de danos emergentes e lucros cessantes com parâmetros financeiros, auditoria jurídica e relatório técnico.",
    available: true,
    planKey: null,
    color: { border: "border-orange-200", bg: "bg-orange-50/50", icon: "bg-orange-100 text-orange-700", badge: "bg-orange-100 text-orange-700 border-orange-200" },
    sistemas: [
      { title: "Cálculo de Danos Materiais", url: "/civel/danos-emergentes", icon: Calculator, available: true, credits: 5, planKey: "mod:danos-emergentes" },
    ],
  },
  {
    id: "estadual",
    title: "Estadual",
    icon: Scale,
    desc: "Liquidação de sentença estadual com memória discriminada do crédito, correção monetária, juros, honorários e relatório técnico-jurídico.",
    available: true,
    planKey: null,
    color: { border: "border-violet-200", bg: "bg-violet-50/50", icon: "bg-violet-100 text-violet-700", badge: "bg-violet-100 text-violet-700 border-violet-200" },
    sistemas: [
      { title: "Liquidação de Sentença Estadual", url: "/estadual/liquidacao-sentenca", icon: Gavel, available: true, credits: 5, planKey: "mod:liquidacao-estadual" },
      { title: "Índice TJMG (ICGJ/TJMG)", url: "/indicadores/tjmg", icon: TrendingUp, available: true, credits: 0, planKey: null },
    ],
  },
];

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard() {
  const { data: stats, isLoading } = useAdminStats();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pkgNames: Record<string, string> = { starter: "Starter", plus: "Plus", pro: "Pro" };

  const handleRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["admin-stats"] });
    setRefreshing(false);
  };

  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão gerencial do sistema Veritas Analytics.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2 flex-shrink-0">
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Atualizar
        </Button>
      </div>

      {/* Stats principais */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Plataforma</h2>
        <motion.div variants={container} initial="hidden" animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <motion.div variants={item}>{isLoading ? <Skeleton /> : <StatCard icon={Users} label="Usuários" value={stats?.userCount ?? 0} color="blue" />}</motion.div>
          <motion.div variants={item}>{isLoading ? <Skeleton /> : <StatCard icon={BarChart3} label="Cálculos" value={stats?.calcCount ?? 0} color="cyan" />}</motion.div>
          <motion.div variants={item}>{isLoading ? <Skeleton /> : <StatCard icon={CreditCard} label="Créditos Vendidos" value={stats?.creditosTotalVendidos ?? 0} color="indigo" />}</motion.div>
          <motion.div variants={item}>{isLoading ? <Skeleton /> : <StatCard icon={TrendingUp} label="Receita Realizada" value={`R$ ${fmt(stats?.receitaTotal ?? 0)}`} color="emerald" />}</motion.div>
        </motion.div>
      </div>

      {/* Stats financeiros Pix */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Financeiro — Cobranças Pix</h2>
        <motion.div variants={container} initial="hidden" animate="show"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div variants={item}>{isLoading ? <Skeleton /> : (
            <StatCard icon={CheckCircle} label="Cobranças Pagas" value={stats?.chargesPaid ?? 0} color="emerald"
              sub={`R$ ${fmt(stats?.receitaTotal ?? 0)}`} />
          )}</motion.div>
          <motion.div variants={item}>{isLoading ? <Skeleton /> : (
            <StatCard icon={Clock} label="Cobranças Pendentes" value={stats?.chargesPending ?? 0} color="amber"
              sub={`R$ ${fmt(stats?.receitaPendente ?? 0)} aguardando`} />
          )}</motion.div>
          <motion.div variants={item}>{isLoading ? <Skeleton /> : (
            <StatCard icon={ShoppingCart} label="Expiradas / Canceladas" value={stats?.chargesExpired ?? 0} color="rose" />
          )}</motion.div>
        </motion.div>
      </div>

      {/* Módulos de Cálculo */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display font-semibold text-foreground">Módulos de Cálculo</h2>
          <span className="text-xs text-muted-foreground">Acesso direto às ferramentas</span>
        </div>
        <motion.div variants={container} initial="hidden" animate="show"
          className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {USER_MODULES.map((mod) => (
            <motion.div key={mod.id} variants={item}>
              <Card className={`h-full flex flex-col transition-all duration-200 ${mod.available ? `${mod.color.border} ${mod.color.bg} hover:shadow-md` : `border-dashed opacity-70 ${mod.color.border} ${mod.color.bg}`}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-lg ${mod.color.icon}`}>
                      <mod.icon className="w-5 h-5" />
                    </div>
                    <Badge className={`text-xs border ${mod.color.badge}`}>
                      {mod.available ? "Disponível" : "Em breve"}
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-display">{mod.title}</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">{mod.desc}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pt-0 pb-3">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sistemas</p>
                    {mod.sistemas.map((sis) =>
                      sis.available ? (
                        <Link key={sis.title} href={sis.url}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-white/70 border border-white/80 shadow-sm hover:bg-blue-50/80 hover:border-blue-200 transition-colors group">
                          <sis.icon className="w-3.5 h-3.5 flex-shrink-0 text-blue-600" />
                          <span className="flex-1 text-[12px] leading-tight text-foreground font-medium group-hover:text-blue-700">
                            {sis.title}
                          </span>
                          <span className="text-[10px] text-blue-600/70 font-medium">{sis.credits > 0 ? `${sis.credits} cr.` : "Grátis"}</span>
                          <ArrowRight className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      ) : (
                        <div key={sis.title}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-muted/30">
                          <sis.icon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground/50" />
                          <span className="flex-1 text-[12px] leading-tight text-muted-foreground/60">
                            {sis.title}
                          </span>
                          <Lock className="w-3 h-3 text-muted-foreground/30" />
                        </div>
                      )
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  {mod.available ? (
                    <Link href={mod.sistemas.find((s) => s.available)?.url ?? "#"} className="w-full">
                      <Button className="w-full text-sm gap-1.5">
                        Acessar Módulo <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  ) : (
                    <Button disabled variant="outline" className="w-full text-sm">
                      Em Desenvolvimento
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Perito Assistente */}
      <Card className="border-[#17365d]/30 bg-gradient-to-r from-[#17365d]/5 to-blue-50/60 shadow-sm">
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="p-3 rounded-xl bg-[#17365d]/10 flex-shrink-0">
            <Briefcase className="w-6 h-6 text-[#17365d]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-[#17365d] text-sm">Perito Assistente</p>
              <Badge className="text-[10px] bg-[#17365d]/10 text-[#17365d] border-[#17365d]/20">Dr. Vasconcelos Reis Wakim · CRCMG 082870/O-8</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Suporte pericial especializado em cálculos judiciais · Trabalhista · Previdenciário · Cível · Família
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            <a href="https://wa.me/5533999991914?text=Olá%20Dr.%20Vasconcelos%2C%20sou%20usuário%20do%20Veritas%20Analytics%20e%20gostaria%20de%20solicitar%20suporte%20pericial." target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="gap-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </Button>
            </a>
            <Link href="/perito-assistente">
              <Button size="sm" variant="outline" className="gap-1.5 border-[#17365d]/30 text-[#17365d] hover:bg-[#17365d]/5 text-xs">
                <ArrowRight className="w-3.5 h-3.5" /> Ver página
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Últimas vendas + Top usuários */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimas vendas */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <DollarSign size={16} className="text-primary" /> Últimas Vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : (stats?.recentSales?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma venda ainda.</p>
            ) : (
              <div className="space-y-2">
                {stats!.recentSales.map((s) => (
                  <div key={s.txid} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/40">
                    <div>
                      <p className="text-sm font-medium">{s.nome}</p>
                      <p className="text-xs text-muted-foreground">Pacote {pkgNames[s.package_id] ?? s.package_id} · {s.creditos} créditos</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-700">R$ {fmt(Number(s.valor))}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(s.paid_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top usuários por créditos */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Zap size={16} className="text-primary" /> Maiores Compradores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : (stats?.topUsers?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum dado de carteira ainda.</p>
            ) : (
              <div className="space-y-2">
                {stats!.topUsers.map((u, idx) => (
                  <div key={u.email} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/40">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{idx + 1}</span>
                      <div>
                        <p className="text-sm font-medium">{u.nome}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">{Number(u.total_bought)} comprados</p>
                      <p className="text-xs text-muted-foreground">Saldo: {Number(u.balance)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ferramentas Administrativas */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ferramentas Administrativas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Link href="/admin/tabelas-fiscais">
            <Card className="h-full cursor-pointer hover:shadow-md transition-all border-blue-200 bg-blue-50/40 hover:bg-blue-50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700"><FileText className="w-5 h-5" /></div>
                <div>
                  <p className="text-sm font-semibold text-blue-800">Tabelas Fiscais</p>
                  <p className="text-xs text-blue-500">Atualizar INSS / IRRF</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/suporte">
            <Card className="h-full cursor-pointer hover:shadow-md transition-all border-orange-200 bg-orange-50/40 hover:bg-orange-50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 text-orange-700"><Activity className="w-5 h-5" /></div>
                <div>
                  <p className="text-sm font-semibold text-orange-800">Chamados de Suporte</p>
                  <p className="text-xs text-orange-500">Gerenciar tickets</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/usuarios">
            <Card className="h-full cursor-pointer hover:shadow-md transition-all border-violet-200 bg-violet-50/40 hover:bg-violet-50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-100 text-violet-700"><Users className="w-5 h-5" /></div>
                <div>
                  <p className="text-sm font-semibold text-violet-800">Usuários</p>
                  <p className="text-xs text-violet-500">Gestão de contas</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/backup">
            <Card className="h-full cursor-pointer hover:shadow-md transition-all border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700"><RefreshCw className="w-5 h-5" /></div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Backup & Restore</p>
                  <p className="text-xs text-emerald-500">Exportar / restaurar dados</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/educacional">
            <Card className="h-full cursor-pointer hover:shadow-md transition-all border-sky-200 bg-sky-50/40 hover:bg-sky-50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-sky-100 text-sky-700"><GraduationCap className="w-5 h-5" /></div>
                <div>
                  <p className="text-sm font-semibold text-sky-800">Plano Educacional</p>
                  <p className="text-xs text-sky-500">Gestão de assinantes IFES</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/cupons">
            <Card className="h-full cursor-pointer hover:shadow-md transition-all border-pink-200 bg-pink-50/40 hover:bg-pink-50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-pink-100 text-pink-700"><Tag className="w-5 h-5" /></div>
                <div>
                  <p className="text-sm font-semibold text-pink-800">Cupons</p>
                  <p className="text-xs text-pink-500">Gerar e gerenciar descontos</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/acessos">
            <Card className="h-full cursor-pointer hover:shadow-md transition-all border-teal-200 bg-teal-50/40 hover:bg-teal-50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-100 text-teal-700"><BarChart3 className="w-5 h-5" /></div>
                <div>
                  <p className="text-sm font-semibold text-teal-800">Relatório de Acessos</p>
                  <p className="text-xs text-teal-500">Monitorar visitas e UFs</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

    </div>
  );
}

// ─── User Dashboard ───────────────────────────────────────────────────────────
export function UserDashboard() {
  const { data: stats, isLoading } = useUserStats();
  const { user } = useAuth();
  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/plans`, { headers: getAuthHeaders() });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
  });
  const sub = plansData?.currentSubscription ?? null;
  const subBal = Number(plansData?.wallet?.subscription_balance ?? 0);
  const extraBal = Number(plansData?.wallet?.extra_balance ?? 0);
  const planSlug: string | null = (sub as any)?.slug ?? null;
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Bem-vindo, {user?.nome?.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Plataforma de Cálculos Judiciais Federais — Veritas Analytics
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/planos">
            <Button variant="outline" size="sm" className="gap-2 border-violet-300 text-violet-700 hover:bg-violet-50 flex-shrink-0">
              <Crown className="w-4 h-4" /> Planos
            </Button>
          </Link>
          <Link href="/creditos">
            <Button variant="outline" size="sm" className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 flex-shrink-0">
              <CreditCard className="w-4 h-4" /> Créditos
            </Button>
          </Link>
        </div>
      </div>

      {/* Banner de assinatura */}
      {sub ? (
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Crown className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="font-semibold text-violet-800 text-sm">Plano {sub.plan_name} ativo</p>
              <p className="text-xs text-violet-500 flex items-center gap-2 mt-0.5">
                <Star className="h-3 w-3" /> {subBal} créditos de assinatura
                <Zap className="h-3 w-3 ml-1" /> {extraBal} créditos avulsos
                · Vence {new Date(sub.ends_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>
          <Link href="/planos">
            <Button variant="outline" size="sm" className="border-violet-300 text-violet-700 text-xs">
              Gerenciar plano
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Crown className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-800 text-sm">Sem plano ativo</p>
              <p className="text-xs text-amber-500 mt-0.5">
                Assine um plano para obter créditos mensais e gerenciar sua equipe
              </p>
            </div>
          </div>
          <Link href="/planos">
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white text-xs">
              Ver planos
            </Button>
          </Link>
        </div>
      )}

      {/* Stats da carteira */}
      <motion.div variants={container} initial="hidden" animate="show"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div variants={item}>
          {isLoading ? <Skeleton /> : (
            <StatCard icon={Coins} label="Créditos Disponíveis" value={stats?.credits ?? 0} color="blue"
              sub={`${stats?.creditsBought ?? 0} adquiridos no total`} />
          )}
        </motion.div>
        <motion.div variants={item}>
          {isLoading ? <Skeleton /> : (
            <StatCard icon={Activity} label="Créditos Utilizados" value={stats?.creditsUsed ?? 0} color="cyan" />
          )}
        </motion.div>
        <motion.div variants={item}>
          {isLoading ? <Skeleton /> : (
            <StatCard icon={CheckCircle} label="Cálculos Realizados" value={stats?.calcCount ?? 0} color="indigo" />
          )}
        </motion.div>
      </motion.div>

      {/* Módulos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display font-semibold text-foreground">Módulos de Cálculo</h2>
          <span className="text-xs text-muted-foreground">
            {USER_MODULES.filter((m) => m.available).length} de {USER_MODULES.length} módulos no plano
          </span>
        </div>

        <motion.div variants={container} initial="hidden" animate="show"
          className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {USER_MODULES.map((mod) => {
            const sistemas = mod.sistemas.map((sis) => ({
              ...sis,
              accessAllowed: sis.available
                ? hasAccess(planSlug, sis.planKey ?? "", isAdmin)
                : false,
            }));
            const hasAnyAccess = sistemas.some((s) => s.accessAllowed);
            const firstAccessibleUrl = sistemas.find((s) => s.accessAllowed)?.url ?? "/planos";

            return (
              <motion.div key={mod.id} variants={item}>
                <Card className={`h-full flex flex-col transition-all duration-200 ${mod.available ? `${mod.color.border} ${mod.color.bg} hover:shadow-md` : `border-dashed opacity-70 ${mod.color.border} ${mod.color.bg}`}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-2 rounded-lg ${mod.color.icon}`}>
                        <mod.icon className="w-5 h-5" />
                      </div>
                      <Badge className={`text-xs border ${mod.color.badge}`}>
                        {mod.available ? "Disponível" : "Em breve"}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-display">{mod.title}</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">{mod.desc}</CardDescription>
                  </CardHeader>

                  {/* Lista de sistemas */}
                  <CardContent className="flex-1 pt-0 pb-3">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sistemas</p>
                      {sistemas.map((sis) =>
                        sis.accessAllowed ? (
                          <Link key={sis.title} href={sis.url}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-white/70 border border-white/80 shadow-sm hover:bg-blue-50/80 hover:border-blue-200 transition-colors group">
                            <sis.icon className="w-3.5 h-3.5 flex-shrink-0 text-blue-600" />
                            <span className="flex-1 text-[12px] leading-tight text-foreground font-medium group-hover:text-blue-700">
                              {sis.title}
                            </span>
                            <span className="text-[10px] text-blue-600/70 font-medium">{sis.credits > 0 ? `${sis.credits} cr.` : "Grátis"}</span>
                            <ArrowRight className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        ) : sis.available ? (
                          <Link key={sis.title} href="/planos"
                            className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-amber-50/60 border border-amber-200/60 hover:bg-amber-50 transition-colors group cursor-pointer">
                            <sis.icon className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                            <span className="flex-1 text-[12px] leading-tight text-amber-700/70">
                              {sis.title}
                            </span>
                            <Lock className="w-3 h-3 text-amber-400" />
                          </Link>
                        ) : (
                          <div key={sis.title}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-muted/30">
                            <sis.icon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground/50" />
                            <span className="flex-1 text-[12px] leading-tight text-muted-foreground/60">
                              {sis.title}
                            </span>
                            <Lock className="w-3 h-3 text-muted-foreground/30" />
                          </div>
                        )
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="pt-0">
                    {mod.available ? (
                      hasAnyAccess ? (
                        <Link href={firstAccessibleUrl} className="w-full">
                          <Button className="w-full text-sm gap-1.5">
                            Acessar Módulo <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      ) : (
                        <Link href="/planos" className="w-full">
                          <Button variant="outline" className="w-full text-sm gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50">
                            <Lock className="w-3.5 h-3.5" /> Fazer Upgrade
                          </Button>
                        </Link>
                      )
                    ) : (
                      <Button disabled variant="outline" className="w-full text-sm">
                        Em Desenvolvimento
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Perito Assistente */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="border-[#17365d]/30 bg-gradient-to-r from-[#17365d]/5 to-blue-50/60 shadow-sm">
          <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="p-3 rounded-xl bg-[#17365d]/10 flex-shrink-0">
              <Briefcase className="w-6 h-6 text-[#17365d]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-[#17365d] text-sm">Perito Assistente</p>
                <Badge className="text-[10px] bg-[#17365d]/10 text-[#17365d] border-[#17365d]/20">Dr. Vasconcelos Reis Wakim · CRCMG 082870/O-8</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Suporte pericial especializado em cálculos judiciais · Trabalhista · Previdenciário · Cível · Família
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0 flex-wrap">
              <a href="https://wa.me/5533999991914?text=Olá%20Dr.%20Vasconcelos%2C%20sou%20usuário%20do%20Veritas%20Analytics%20e%20gostaria%20de%20solicitar%20suporte%20pericial." target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="gap-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs">
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </Button>
              </a>
              <Link href="/perito-assistente">
                <Button size="sm" variant="outline" className="gap-1.5 border-[#17365d]/30 text-[#17365d] hover:bg-[#17365d]/5 text-xs">
                  <ArrowRight className="w-3.5 h-3.5" /> Ver detalhes
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Aviso de créditos baixos */}
      {!isLoading && (stats?.credits ?? 0) < 5 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-amber-200 bg-amber-50/60">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                <Coins className="w-5 h-5 text-amber-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">Saldo de créditos baixo</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Você tem <strong>{stats?.credits ?? 0} créditos</strong>. Adquira mais para continuar usando os módulos.
                </p>
              </div>
              <Link href="/creditos">
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 flex-shrink-0">
                  <CreditCard className="w-4 h-4" /> Comprar
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === "admin") return <AdminDashboard />;
  return <UserDashboard />;
}
