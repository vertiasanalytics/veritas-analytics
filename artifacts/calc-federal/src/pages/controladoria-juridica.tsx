import React, { useMemo, useState } from "react";
import { useCtrlData } from "@/hooks/use-ctrl-data";
import { Link } from "wouter";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import { hasAccess, PLAN_LABEL, PLAN_MIN, CTRL_RECORDS_LIMIT, type PlanSlug } from "@/lib/plan-access";
import {
  ConciliacaoBancariaPage,
  ConfiguracoesFinanceirasPage,
  CustasDepositosAlvarasPage,
  InteligenciaFinanceiraPage,
  RelatoriosGerenciaisPage,
  RepassesSociosPage,
  TributosRetencoesPage,
} from "./FinancialMissingModulesPages";
import {
  BadgeDollarSign, Bell, Briefcase, Building2, Calculator, CheckCircle2,
  ChevronDown, CircleDollarSign, CreditCard, Crown, FileBarChart2,
  FileSpreadsheet, Filter, Landmark, LayoutDashboard, Lock, PieChart, Receipt,
  Scale, Search, ShieldCheck, Users, Wallet, AlertTriangle, ArrowDownCircle,
  ArrowUpCircle, CalendarRange, Gavel, FileText, Banknote, Target, X, Plus,
  TrendingUp, TrendingDown, Pencil, DollarSign,
  HardDrive, Download, Upload, RefreshCw, CheckCheck, Clock, Trash2,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart as RePieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterOption = { label: string; value: string };

type KPI = {
  title: string; value: number; variation?: number; icon: React.ReactNode;
  color: string; subtitle?: string;
};

export type Receivable = {
  id: string; cliente: string; processo: string; contrato: string;
  vencimento: string; valor: number;
  status: "Aberto" | "Vencido" | "Recebido Parcial" | "Liquidado";
};

export type Payable = {
  id: string; fornecedor: string; categoria: string; processo?: string;
  vencimento: string; valor: number; status: "Aberto" | "Vencido" | "Pago";
};

export type AlertItem = { id: string; title: string; description: string; severity: "alta" | "media" | "baixa" };
export type ActivityItem = { id: string; title: string; description: string; value?: number; time: string };
type NavItem = { key: string; label: string; icon: React.ReactNode };

export type Cliente = {
  id: string; nome: string; cnpjCpf: string; tipo: "PF" | "PJ";
  responsavel: string; email: string; telefone: string;
  origem: string; status: "Ativo" | "Inativo" | "Prospecto";
  processos: number; valorCarteira: number;
};

export type Fornecedor = {
  id: string; nome: string; cnpjCpf: string; tipo: "PF" | "PJ";
  email: string; telefone: string;
  categoria: "Tribunal" | "Cartório" | "Banco" | "Perito" | "Correspondente" | "Fornecedor Geral" | "Outro";
  status: "Ativo" | "Inativo";
};

export type Contrato = {
  id: string; numero: string; cliente: string; tipo: string;
  valor: number; periodicidade: string; percentualExito: number;
  inicio: string; fim: string; status: "Vigente" | "Encerrado" | "Em renovação";
};

export type ProcessoFinanceiro = {
  id: string; numero: string; cliente: string; area: string;
  responsavel: string; valorCausa: number; receitaTotal: number;
  despesaTotal: number; margem: number; status: "Ativo" | "Encerrado" | "Suspenso";
};

// ─── Formatters ───────────────────────────────────────────────────────────────

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}%`;
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const today = () => new Date().toLocaleDateString("pt-BR");
/** Converte "YYYY-MM" → "MM/AAAA" para exibição */
const fmtMes = (v: string) => {
  if (!v || v === "—") return v;
  const parts = v.split("-");
  if (parts.length >= 2) return `${parts[1]}/${parts[0]}`;
  return v;
};

function cx(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ");
}

// ─── Static config ────────────────────────────────────────────────────────────

const colorsPie = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444"];

const navItems: NavItem[] = [
  { key: "dashboard",    label: "Dashboard Executivo",         icon: <LayoutDashboard size={16} /> },
  { key: "receitas",     label: "Receitas e Honorários",       icon: <BadgeDollarSign size={16} /> },
  { key: "despesas",     label: "Despesas e Custas",           icon: <Receipt size={16} /> },
  { key: "receber",      label: "Contas a Receber",            icon: <ArrowUpCircle size={16} /> },
  { key: "pagar",        label: "Contas a Pagar",              icon: <ArrowDownCircle size={16} /> },
  { key: "caixa",        label: "Fluxo de Caixa",              icon: <Wallet size={16} /> },
  { key: "clientes",     label: "Clientes e Contratos",        icon: <Users size={16} /> },
  { key: "processos",    label: "Processos Financeiros",       icon: <Scale size={16} /> },
  { key: "custas",       label: "Custas, Depósitos e Alvarás", icon: <Landmark size={16} /> },
  { key: "repasses",     label: "Repasses e Sócios",           icon: <Banknote size={16} /> },
  { key: "tributos",     label: "Tributos e Retenções",        icon: <Calculator size={16} /> },
  { key: "conciliacao",  label: "Conciliação Bancária",        icon: <CreditCard size={16} /> },
  { key: "relatorios",   label: "Relatórios Gerenciais",       icon: <FileBarChart2 size={16} /> },
  { key: "inteligencia", label: "Inteligência Financeira",     icon: <Target size={16} /> },
  { key: "config",       label: "Configurações Financeiras",   icon: <Briefcase size={16} /> },
  { key: "backup",       label: "Backup e Restauração",        icon: <HardDrive size={16} /> },
];

const statusStyles: Record<string, string> = {
  Aberto:              "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  Vencido:             "bg-red-500/15 text-red-300 border border-red-500/30",
  "Recebido Parcial":  "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  Liquidado:           "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  Pago:                "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  Ativo:               "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  Inativo:             "bg-slate-500/15 text-slate-400 border border-slate-500/30",
  Prospecto:           "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  Vigente:             "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  Encerrado:           "bg-slate-500/15 text-slate-400 border border-slate-500/30",
  "Em renovação":      "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  Suspenso:            "bg-red-500/15 text-red-300 border border-red-500/30",
};

const titleMap: Record<string, string> = {
  dashboard:"Controladoria Jurídica", receitas:"Receitas e Honorários", despesas:"Despesas e Custas",
  receber:"Contas a Receber", pagar:"Contas a Pagar", caixa:"Fluxo de Caixa",
  clientes:"Clientes e Contratos", processos:"Processos Financeiros",
  custas:"Custas, Depósitos e Alvarás", repasses:"Repasses e Sócios", tributos:"Tributos e Retenções",
  conciliacao:"Conciliação Bancária", relatorios:"Relatórios Gerenciais",
  inteligencia:"Inteligência Financeira", config:"Configurações Financeiras",
};

const subtitleMap: Record<string, string> = {
  dashboard:"Gestão financeira completa e integrada para escritórios de advocacia.",
  receitas:"Gerencie honorários contratuais, êxito, sucumbência, reembolsos e receitas consultivas.",
  despesas:"Controle despesas operacionais, custas processuais, diligências e reembolsáveis.",
  receber:"Acompanhe cobranças abertas, vencidas, recebidas parcialmente e liquidadas.",
  pagar:"Monitore obrigações do escritório, agenda financeira e aprovações.",
  caixa:"Visualize o caixa realizado, projetado, cenários e tendências futuras.",
  clientes:"Centralize clientes, contratos, regras de cobrança e percentuais financeiros.",
  processos:"Acompanhe rentabilidade, receitas, despesas e DRE por processo judicial.",
  custas:"Controle custas, depósitos judiciais, alvarás e documentação comprobatória.",
  repasses:"Automatize distribuição entre sócios, associados e correspondentes.",
  tributos:"Organize retenções, estimativas tributárias e mapas de apoio à contabilidade.",
  conciliacao:"Concilie extratos, movimentos bancários e classificações financeiras.",
  relatorios:"Gere relatórios executivos, DRE gerencial e visões por processo e cliente.",
  inteligencia:"Transforme dados financeiros em insight estratégico e previsibilidade.",
  config:"Defina regras gerais, centros de custo, categorias e contas bancárias.",
};

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={cx("rounded-full px-2.5 py-1 text-xs font-semibold", statusStyles[value] ?? "bg-white/10 text-white border border-white/10")}>
      {value}
    </span>
  );
}

function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center">
      <div className="text-slate-500">{icon ?? <FileText size={28} />}</div>
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
      <FileBarChart2 size={26} className="text-slate-500" />
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
}

function DarkCard({ title, subtitle, icon, rightAction, children }: {
  title: string; subtitle?: string; icon?: React.ReactNode;
  rightAction?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0b1830]/90 p-5 shadow-[0_12px_60px_rgba(0,0,0,0.25)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {icon && <div className="rounded-2xl bg-white/5 p-2.5 text-slate-200">{icon}</div>}
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {rightAction}
      </div>
      {children}
    </div>
  );
}

function KPIGrid({ items }: { items: KPI[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.title} className={cx("rounded-3xl border p-5 shadow-xl backdrop-blur-sm", item.color)}>
          <div className="mb-4 flex items-center justify-between">
            <div className="rounded-2xl bg-white/10 p-3 text-white">{item.icon}</div>
            {typeof item.variation === "number" && (
              <span className={cx("rounded-full px-2.5 py-1 text-xs font-semibold", item.variation >= 0 ? "bg-emerald-500/20 text-emerald-200" : "bg-red-500/20 text-red-200")}>
                {pct(item.variation)}
              </span>
            )}
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">{item.title}</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-white">{brl(item.value)}</div>
          {item.subtitle && <div className="mt-1 text-sm text-white/75">{item.subtitle}</div>}
        </div>
      ))}
    </div>
  );
}

function SmallStat({ icon, label, value, tone = "blue" }: { icon: React.ReactNode; label: string; value: string; tone?: "blue" | "green" | "amber" | "red" | "purple" }) {
  const tc = { blue:"bg-blue-500/10 text-blue-300 ring-blue-400/20", green:"bg-emerald-500/10 text-emerald-300 ring-emerald-400/20", amber:"bg-amber-500/10 text-amber-300 ring-amber-400/20", red:"bg-red-500/10 text-red-300 ring-red-400/20", purple:"bg-purple-500/10 text-purple-300 ring-purple-400/20" }[tone];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className={cx("rounded-xl p-2 ring-1", tc)}>{icon}</div>
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</span>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  );
}

function TableReceivables({ rows, onBaixar, onDelete }: { rows: Receivable[]; onBaixar?: (r: Receivable) => void; onDelete?: (id: string) => void }) {
  if (rows.length === 0) return <EmptyState message="Nenhum recebível cadastrado ainda. Use 'Nova Receita' para lançar." icon={<ArrowUpCircle size={28} />} />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-y-2">
        <thead>
          <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-400">
            <th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Processo</th>
            <th className="px-3 py-2">Contrato</th><th className="px-3 py-2">Vencimento</th>
            <th className="px-3 py-2">Valor</th><th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="rounded-2xl bg-white/[0.03] text-sm text-slate-200 ring-1 ring-white/5">
              <td className="rounded-l-2xl px-3 py-3 font-medium">{row.cliente}</td>
              <td className="px-3 py-3 text-slate-300 text-xs">{row.processo || "—"}</td>
              <td className="px-3 py-3 text-slate-300">{row.contrato || "—"}</td>
              <td className="px-3 py-3 font-mono">{fmtMes(row.vencimento)}</td>
              <td className="px-3 py-3 font-semibold text-white">{brl(row.valor)}</td>
              <td className="px-3 py-3"><StatusBadge value={row.status} /></td>
              <td className="rounded-r-2xl px-3 py-3">
                <div className="flex gap-1.5">
                  {row.status !== "Liquidado" && onBaixar && (
                    <button onClick={() => onBaixar(row)} className="rounded-xl bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25">
                      Baixar
                    </button>
                  )}
                  {onDelete && (
                    <button onClick={() => onDelete(row.id)} className="rounded-xl bg-white/5 p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-300">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablePayables({ rows, onPagar, onDelete }: { rows: Payable[]; onPagar?: (p: Payable) => void; onDelete?: (id: string) => void }) {
  if (rows.length === 0) return <EmptyState message="Nenhuma conta a pagar cadastrada ainda. Use 'Nova Despesa' para lançar." icon={<ArrowDownCircle size={28} />} />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-y-2">
        <thead>
          <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-400">
            <th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2">Categoria</th>
            <th className="px-3 py-2">Vencimento</th><th className="px-3 py-2">Valor</th>
            <th className="px-3 py-2">Status</th><th className="px-3 py-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="rounded-2xl bg-white/[0.03] text-sm text-slate-200 ring-1 ring-white/5">
              <td className="rounded-l-2xl px-3 py-3 font-medium">{row.fornecedor}</td>
              <td className="px-3 py-3 text-slate-300">{row.categoria}</td>
              <td className="px-3 py-3 font-mono">{fmtMes(row.vencimento)}</td>
              <td className="px-3 py-3 font-semibold text-white">{brl(row.valor)}</td>
              <td className="px-3 py-3"><StatusBadge value={row.status} /></td>
              <td className="rounded-r-2xl px-3 py-3">
                <div className="flex gap-1.5">
                  {row.status !== "Pago" && onPagar && (
                    <button onClick={() => onPagar(row)} className="rounded-xl bg-blue-500/15 px-2.5 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-500/25">
                      Pagar
                    </button>
                  )}
                  {onDelete && (
                    <button onClick={() => onDelete(row.id)} className="rounded-xl bg-white/5 p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-300">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertsList({ items }: { items: AlertItem[] }) {
  const ss = { alta:"border-red-500/30 bg-red-500/10 text-red-200", media:"border-amber-500/30 bg-amber-500/10 text-amber-200", baixa:"border-blue-500/30 bg-blue-500/10 text-blue-200" };
  if (items.length === 0) return <EmptyState message="Nenhum insight disponível. Lance receitas e despesas para gerar análises." icon={<Target size={28} />} />;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="font-semibold text-white text-sm">{item.title}</div>
            <span className={cx("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", ss[item.severity])}>{item.severity}</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-300">{item.description}</p>
        </div>
      ))}
    </div>
  );
}

function ActivityList({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return <EmptyState message="Nenhuma movimentação registrada ainda." icon={<CheckCircle2 size={28} />} />;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className={cx("mt-0.5 rounded-full p-2 flex-shrink-0", item.value && item.value < 0 ? "bg-red-500/15 text-red-300" : "bg-blue-500/15 text-blue-300")}>
            {item.value && item.value < 0 ? <ArrowDownCircle size={14} /> : <CheckCircle2 size={14} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-white text-sm">{item.title}</div>
              <div className="text-xs text-slate-400">{item.time}</div>
            </div>
            <div className="mt-1 text-xs text-slate-300">{item.description}</div>
            {typeof item.value === "number" && (
              <div className={cx("mt-1.5 text-sm font-semibold", item.value < 0 ? "text-red-300" : "text-emerald-300")}>
                {item.value < 0 ? brl(item.value) : `+ ${brl(item.value)}`}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Drawer / Modal shared ────────────────────────────────────────────────────

function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-[#07101f] border-l border-white/10 flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 flex-shrink-0">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function FF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</label>
      {children}
    </div>
  );
}

const ic = "w-full rounded-2xl border border-white/10 bg-[#0c1a31] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-400/50 focus:ring-2 focus:ring-blue-500/20";

// ─── Modals ───────────────────────────────────────────────────────────────────

const RESP_OPTIONS = ["Dr. Vasconcelos", "Dra. Ana Lima", "Dr. Marcos Costa"];
const FORMAS = ["Pix", "Boleto", "Transferência", "Cartão", "Dinheiro"];
const TIPOS_RECEITA = ["Honorário Contratual","Honorário de Êxito","Honorário Mensal","Honorário por Ato","Sucumbência","Reembolso","Consultoria","Receita com Perícia Oficial","Receita com Perícia Extrajudicial","Receita Contábil Diversa"];
const CATEGORIAS = ["Custas Processuais","Aluguel","Correspondência","Licença de Software","Diligências","Tributária","Marketing","Salários","Outros"];

/* ─── Inline entity picker (select existing + quick-register form) ─────────── */

const CATS_FORNECEDOR = ["Tribunal", "Cartório", "Banco", "Perito", "Correspondente", "Fornecedor Geral", "Outro"] as const;

function ClientePickerField({ clientes, value, onChange, onCadastrar }: {
  clientes: Cliente[]; value: string;
  onChange: (v: string) => void;
  onCadastrar: (item: Omit<Cliente, "id">) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [nf, setNf] = useState({ tipo: "PF" as "PF" | "PJ", nome: "", cnpjCpf: "", telefone: "" });

  function salvar() {
    if (!nf.nome.trim()) return;
    onCadastrar({ ...nf, email: "", responsavel: RESP_OPTIONS[0], origem: "Manual", status: "Ativo", processos: 0, valorCarteira: 0 });
    onChange(nf.nome.trim());
    setNf({ tipo: "PF", nome: "", cnpjCpf: "", telefone: "" });
    setShowForm(false);
  }

  return (
    <FF label="Cliente *">
      <div className="flex gap-2">
        <select value={value} onChange={e => onChange(e.target.value)} className={cx(ic, "flex-1 min-w-0")}>
          <option value="">Selecionar cliente cadastrado</option>
          {clientes.map(c => <option key={c.id} value={c.nome}>{c.nome}{c.cnpjCpf ? ` — ${c.cnpjCpf}` : ""}</option>)}
        </select>
        <button type="button" title={showForm ? "Fechar formulário" : "Cadastrar novo cliente"}
          onClick={() => setShowForm(v => !v)}
          className="shrink-0 flex items-center gap-1 rounded-2xl border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-300 hover:bg-blue-500/20 transition-colors">
          <Plus size={12} />{showForm ? "Fechar" : "Novo"}
        </button>
      </div>
      {showForm && (
        <div className="mt-3 rounded-2xl border border-blue-400/20 bg-[#0a1628] p-4 space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Cadastro rápido de cliente</div>
          <div className="flex gap-2">
            {(["PF", "PJ"] as const).map(t => (
              <button key={t} type="button" onClick={() => setNf(p => ({ ...p, tipo: t }))}
                className={cx("flex-1 rounded-xl border py-1.5 text-xs font-semibold transition-colors", nf.tipo === t ? "border-blue-400/40 bg-blue-500/20 text-blue-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10")}>
                {t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
              </button>
            ))}
          </div>
          <input placeholder={nf.tipo === "PJ" ? "Razão social *" : "Nome completo *"} value={nf.nome}
            onChange={e => setNf(p => ({ ...p, nome: e.target.value }))} className={ic} />
          <input placeholder={nf.tipo === "PJ" ? "CNPJ (opcional)" : "CPF (opcional)"} value={nf.cnpjCpf}
            onChange={e => setNf(p => ({ ...p, cnpjCpf: e.target.value }))} className={ic} />
          <input placeholder="Telefone (opcional)" value={nf.telefone}
            onChange={e => setNf(p => ({ ...p, telefone: e.target.value }))} className={ic} />
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-xs text-slate-300 hover:bg-white/10">Cancelar</button>
            <button type="button" onClick={salvar}
              className="flex-1 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700">Cadastrar e Selecionar</button>
          </div>
        </div>
      )}
    </FF>
  );
}

function FornecedorPickerField({ fornecedores, value, onChange, onCadastrar }: {
  fornecedores: Fornecedor[]; value: string;
  onChange: (v: string) => void;
  onCadastrar: (item: Omit<Fornecedor, "id">) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [nf, setNf] = useState({ tipo: "PJ" as "PF" | "PJ", nome: "", cnpjCpf: "", telefone: "", categoria: "Fornecedor Geral" as Fornecedor["categoria"] });

  function salvar() {
    if (!nf.nome.trim()) return;
    onCadastrar({ ...nf, email: "", status: "Ativo" });
    onChange(nf.nome.trim());
    setNf({ tipo: "PJ", nome: "", cnpjCpf: "", telefone: "", categoria: "Fornecedor Geral" });
    setShowForm(false);
  }

  return (
    <FF label="Fornecedor / Beneficiário *">
      <div className="flex gap-2">
        <select value={value} onChange={e => onChange(e.target.value)} className={cx(ic, "flex-1 min-w-0")}>
          <option value="">Selecionar fornecedor cadastrado</option>
          {fornecedores.map(f => <option key={f.id} value={f.nome}>{f.nome}{f.cnpjCpf ? ` — ${f.cnpjCpf}` : ""}</option>)}
        </select>
        <button type="button" title={showForm ? "Fechar formulário" : "Cadastrar novo fornecedor"}
          onClick={() => setShowForm(v => !v)}
          className="shrink-0 flex items-center gap-1 rounded-2xl border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-xs font-bold text-orange-300 hover:bg-orange-500/20 transition-colors">
          <Plus size={12} />{showForm ? "Fechar" : "Novo"}
        </button>
      </div>
      {showForm && (
        <div className="mt-3 rounded-2xl border border-orange-400/20 bg-[#0a1628] p-4 space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-orange-400">Cadastro rápido de fornecedor</div>
          <div className="flex gap-2">
            {(["PF", "PJ"] as const).map(t => (
              <button key={t} type="button" onClick={() => setNf(p => ({ ...p, tipo: t }))}
                className={cx("flex-1 rounded-xl border py-1.5 text-xs font-semibold transition-colors", nf.tipo === t ? "border-orange-400/40 bg-orange-500/20 text-orange-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10")}>
                {t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
              </button>
            ))}
          </div>
          <input placeholder={nf.tipo === "PJ" ? "Razão social *" : "Nome completo *"} value={nf.nome}
            onChange={e => setNf(p => ({ ...p, nome: e.target.value }))} className={ic} />
          <select value={nf.categoria} onChange={e => setNf(p => ({ ...p, categoria: e.target.value as Fornecedor["categoria"] }))} className={ic}>
            {CATS_FORNECEDOR.map(c => <option key={c}>{c}</option>)}
          </select>
          <input placeholder={nf.tipo === "PJ" ? "CNPJ (opcional)" : "CPF (opcional)"} value={nf.cnpjCpf}
            onChange={e => setNf(p => ({ ...p, cnpjCpf: e.target.value }))} className={ic} />
          <input placeholder="Telefone (opcional)" value={nf.telefone}
            onChange={e => setNf(p => ({ ...p, telefone: e.target.value }))} className={ic} />
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-xs text-slate-300 hover:bg-white/10">Cancelar</button>
            <button type="button" onClick={salvar}
              className="flex-1 rounded-xl bg-orange-600 py-2 text-xs font-bold text-white hover:bg-orange-700">Cadastrar e Selecionar</button>
          </div>
        </div>
      )}
    </FF>
  );
}

function NovaReceitaDrawer({ open, onClose, clientes, onCadastrarCliente, onSave }: {
  open: boolean; onClose: () => void;
  clientes: Cliente[];
  onCadastrarCliente: (item: Omit<Cliente, "id">) => void;
  onSave: (item: Omit<Receivable, "id">) => void;
}) {
  const blank = { cliente: "", processo: "", contrato: "", tipo: "Honorário Contratual", valor: "", vencimento: "", forma: "Pix", obs: "" };
  const [f, setF] = useState(blank);
  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  function submit() {
    if (!f.cliente || !f.valor || !f.vencimento) return;
    onSave({ cliente: f.cliente, processo: f.processo, contrato: f.contrato || f.tipo, vencimento: f.vencimento, valor: Number(f.valor), status: "Aberto" });
    setF(blank);
    onClose();
  }

  return (
    <Drawer open={open} onClose={onClose} title="Nova Receita / Honorário">
      <div className="space-y-4">
        <ClientePickerField
          clientes={clientes}
          value={f.cliente}
          onChange={v => setF(p => ({ ...p, cliente: v }))}
          onCadastrar={onCadastrarCliente}
        />
        <FF label="Tipo de honorário">
          <select value={f.tipo} onChange={upd("tipo")} className={ic}>
            {TIPOS_RECEITA.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FF>
        <div className="grid grid-cols-2 gap-3">
          <FF label="Valor (R$) *"><input type="number" min="0" placeholder="0,00" value={f.valor} onChange={upd("valor")} className={ic} /></FF>
          <FF label="Vencimento *"><input type="month" value={f.vencimento} onChange={upd("vencimento")} className={ic} /></FF>
        </div>
        <FF label="Processo (opcional)"><input placeholder="Nº do processo" value={f.processo} onChange={upd("processo")} className={ic} /></FF>
        <FF label="Nº Contrato (opcional)"><input placeholder="CONT-0000-000" value={f.contrato} onChange={upd("contrato")} className={ic} /></FF>
        <FF label="Forma de cobrança">
          <select value={f.forma} onChange={upd("forma")} className={ic}>{FORMAS.map(t => <option key={t}>{t}</option>)}</select>
        </FF>
        <FF label="Observação"><textarea rows={3} placeholder="Observações..." value={f.obs} onChange={upd("obs")} className={ic} /></FF>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Cancelar</button>
          <button onClick={submit} className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110">Lançar Receita</button>
        </div>
      </div>
    </Drawer>
  );
}

function NovaDespesaDrawer({ open, onClose, fornecedores, onCadastrarFornecedor, onSave }: {
  open: boolean; onClose: () => void;
  fornecedores: Fornecedor[];
  onCadastrarFornecedor: (item: Omit<Fornecedor, "id">) => void;
  onSave: (item: Omit<Payable, "id">) => void;
}) {
  const blank = { fornecedor: "", categoria: "Custas Processuais", valor: "", vencimento: "", processo: "", reembolsavel: "Não", obs: "" };
  const [f, setF] = useState(blank);
  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  function submit() {
    if (!f.fornecedor || !f.valor || !f.vencimento) return;
    onSave({ fornecedor: f.fornecedor, categoria: f.categoria, vencimento: f.vencimento, valor: Number(f.valor), processo: f.processo || undefined, status: "Aberto" });
    setF(blank);
    onClose();
  }

  return (
    <Drawer open={open} onClose={onClose} title="Nova Despesa / Custa">
      <div className="space-y-4">
        <FornecedorPickerField
          fornecedores={fornecedores}
          value={f.fornecedor}
          onChange={v => setF(p => ({ ...p, fornecedor: v }))}
          onCadastrar={onCadastrarFornecedor}
        />
        <FF label="Categoria">
          <select value={f.categoria} onChange={upd("categoria")} className={ic}>
            {CATEGORIAS.map(t => <option key={t}>{t}</option>)}
          </select>
        </FF>
        <div className="grid grid-cols-2 gap-3">
          <FF label="Valor (R$) *"><input type="number" min="0" placeholder="0,00" value={f.valor} onChange={upd("valor")} className={ic} /></FF>
          <FF label="Vencimento *"><input type="month" value={f.vencimento} onChange={upd("vencimento")} className={ic} /></FF>
        </div>
        <FF label="Processo vinculado (opcional)"><input placeholder="Nº do processo" value={f.processo} onChange={upd("processo")} className={ic} /></FF>
        <FF label="Reembolsável do cliente?">
          <select value={f.reembolsavel} onChange={upd("reembolsavel")} className={ic}><option>Não</option><option>Sim</option></select>
        </FF>
        <FF label="Observação"><textarea rows={3} placeholder="Observações..." value={f.obs} onChange={upd("obs")} className={ic} /></FF>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Cancelar</button>
          <button onClick={submit} className="flex-1 rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110">Lançar Despesa</button>
        </div>
      </div>
    </Drawer>
  );
}

function BaixaModal({ item, onClose, onUpdate }: { item: Receivable | null; onClose: () => void; onUpdate: (id: string, status: Receivable["status"]) => void }) {
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 7));
  const [forma, setForma] = useState("Pix");
  const [tipo, setTipo] = useState<"total" | "parcial">("total");

  if (!item) return null;
  const expectedVal = String(item.valor);

  function submit() {
    const v = Number(valor || expectedVal);
    const newStatus: Receivable["status"] = tipo === "total" ? "Liquidado" : "Recebido Parcial";
    onUpdate(item!.id, newStatus);
    onClose();
  }

  return (
    <Drawer open={!!item} onClose={onClose} title="Registrar Recebimento">
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-sm text-slate-400">Cliente</div>
          <div className="font-semibold text-white mt-1">{item.cliente}</div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-400">{item.contrato}</span>
            <span className="text-lg font-bold text-white">{brl(item.valor)}</span>
          </div>
        </div>
        <FF label="Tipo de baixa">
          <div className="flex gap-2">
            {(["total","parcial"] as const).map(t => (
              <button key={t} onClick={() => setTipo(t)} className={cx("flex-1 rounded-2xl border py-2 text-sm font-semibold transition-colors", tipo === t ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10")}>
                {t === "total" ? "Total" : "Parcial"}
              </button>
            ))}
          </div>
        </FF>
        <FF label={`Valor recebido (R$) — total: ${brl(item.valor)}`}>
          <input type="number" value={valor || expectedVal} onChange={e => setValor(e.target.value)} className={ic} />
        </FF>
        <FF label="Competência (mm/aaaa)"><input type="month" value={data} onChange={e => setData(e.target.value)} className={ic} /></FF>
        <FF label="Forma">
          <select value={forma} onChange={e => setForma(e.target.value)} className={ic}>{FORMAS.map(t => <option key={t}>{t}</option>)}</select>
        </FF>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Cancelar</button>
          <button onClick={submit} className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-500 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110">Confirmar Baixa</button>
        </div>
      </div>
    </Drawer>
  );
}

function PagamentoModal({ item, onClose, onUpdate }: { item: Payable | null; onClose: () => void; onUpdate: (id: string) => void }) {
  const [data, setData] = useState(new Date().toISOString().slice(0, 7));
  const [forma, setForma] = useState("Pix");
  if (!item) return null;

  return (
    <Drawer open={!!item} onClose={onClose} title="Registrar Pagamento">
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-sm text-slate-400">Fornecedor</div>
          <div className="font-semibold text-white mt-1">{item.fornecedor}</div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-400">{item.categoria}</span>
            <span className="text-lg font-bold text-white">{brl(item.valor)}</span>
          </div>
        </div>
        <FF label="Competência (mm/aaaa)"><input type="month" value={data} onChange={e => setData(e.target.value)} className={ic} /></FF>
        <FF label="Forma">
          <select value={forma} onChange={e => setForma(e.target.value)} className={ic}>
            {["Pix","Transferência","Boleto","Cartão","Dinheiro","Débito automático"].map(t => <option key={t}>{t}</option>)}
          </select>
        </FF>
        <FF label="Comprovante / Obs"><textarea rows={3} placeholder="Informações do comprovante..." className={ic} /></FF>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Cancelar</button>
          <button onClick={() => { onUpdate(item.id); onClose(); }} className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110">Confirmar Pagamento</button>
        </div>
      </div>
    </Drawer>
  );
}

function NovoClienteDrawer({ open, onClose, onSave }: {
  open: boolean; onClose: () => void;
  onSave: (item: Omit<Cliente, "id">) => void;
}) {
  const blank = { tipo: "PF" as "PF"|"PJ", nome: "", cnpjCpf: "", email: "", telefone: "", responsavel: RESP_OPTIONS[0], origem: "Indicação" };
  const [f, setF] = useState(blank);
  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  function submit() {
    if (!f.nome) return;
    onSave({ ...f, status: "Ativo", processos: 0, valorCarteira: 0 });
    setF(blank); onClose();
  }

  return (
    <Drawer open={open} onClose={onClose} title="Novo Cliente">
      <div className="space-y-4">
        <FF label="Tipo">
          <div className="flex gap-2">
            {(["PF","PJ"] as const).map(t => (
              <button key={t} onClick={() => setF(p => ({ ...p, tipo: t }))} className={cx("flex-1 rounded-2xl border py-2 text-sm font-semibold transition-colors", f.tipo === t ? "border-blue-400/40 bg-blue-500/20 text-blue-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10")}>
                {t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
              </button>
            ))}
          </div>
        </FF>
        <FF label={f.tipo === "PJ" ? "Razão Social *" : "Nome Completo *"}><input placeholder={f.tipo === "PJ" ? "Nome da empresa" : "Nome do cliente"} value={f.nome} onChange={upd("nome")} className={ic} /></FF>
        <FF label={f.tipo === "PJ" ? "CNPJ" : "CPF"}><input placeholder={f.tipo === "PJ" ? "00.000.000/0001-00" : "000.000.000-00"} value={f.cnpjCpf} onChange={upd("cnpjCpf")} className={ic} /></FF>
        <FF label="E-mail"><input type="email" placeholder="email@exemplo.com" value={f.email} onChange={upd("email")} className={ic} /></FF>
        <FF label="Telefone"><input type="tel" placeholder="(11) 99999-9999" value={f.telefone} onChange={upd("telefone")} className={ic} /></FF>
        <FF label="Responsável">
          <select value={f.responsavel} onChange={upd("responsavel")} className={ic}>{RESP_OPTIONS.map(r => <option key={r}>{r}</option>)}</select>
        </FF>
        <FF label="Origem">
          <select value={f.origem} onChange={upd("origem")} className={ic}>{["Indicação","Site","OAB","Prospecção","Parceria","Outro"].map(t => <option key={t}>{t}</option>)}</select>
        </FF>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Cancelar</button>
          <button onClick={submit} className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110">Cadastrar</button>
        </div>
      </div>
    </Drawer>
  );
}

function NovoFornecedorDrawer({ open, onClose, onSave }: {
  open: boolean; onClose: () => void;
  onSave: (item: Omit<Fornecedor, "id">) => void;
}) {
  const blank = { tipo: "PJ" as "PF" | "PJ", nome: "", cnpjCpf: "", email: "", telefone: "", categoria: "Fornecedor Geral" as Fornecedor["categoria"] };
  const [f, setF] = useState(blank);
  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  function submit() {
    if (!f.nome) return;
    onSave({ ...f, status: "Ativo" });
    setF(blank); onClose();
  }

  return (
    <Drawer open={open} onClose={onClose} title="Novo Fornecedor">
      <div className="space-y-4">
        <FF label="Tipo">
          <div className="flex gap-2">
            {(["PF", "PJ"] as const).map(t => (
              <button key={t} onClick={() => setF(p => ({ ...p, tipo: t }))}
                className={cx("flex-1 rounded-2xl border py-2 text-sm font-semibold transition-colors", f.tipo === t ? "border-orange-400/40 bg-orange-500/20 text-orange-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10")}>
                {t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
              </button>
            ))}
          </div>
        </FF>
        <FF label={f.tipo === "PJ" ? "Razão Social *" : "Nome Completo *"}>
          <input placeholder={f.tipo === "PJ" ? "Nome da empresa / tribunal" : "Nome do beneficiário"} value={f.nome} onChange={upd("nome")} className={ic} />
        </FF>
        <FF label="Categoria">
          <select value={f.categoria} onChange={upd("categoria")} className={ic}>
            {CATS_FORNECEDOR.map(c => <option key={c}>{c}</option>)}
          </select>
        </FF>
        <FF label={f.tipo === "PJ" ? "CNPJ" : "CPF"}>
          <input placeholder={f.tipo === "PJ" ? "00.000.000/0001-00" : "000.000.000-00"} value={f.cnpjCpf} onChange={upd("cnpjCpf")} className={ic} />
        </FF>
        <FF label="E-mail"><input type="email" placeholder="email@exemplo.com" value={f.email} onChange={upd("email")} className={ic} /></FF>
        <FF label="Telefone"><input type="tel" placeholder="(11) 99999-9999" value={f.telefone} onChange={upd("telefone")} className={ic} /></FF>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Cancelar</button>
          <button onClick={submit} className="flex-1 rounded-2xl bg-gradient-to-r from-orange-600 to-red-500 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110">Cadastrar</button>
        </div>
      </div>
    </Drawer>
  );
}

function NovoContratoDrawer({ open, onClose, clientes, onSave }: {
  open: boolean; onClose: () => void; clientes: Cliente[];
  onSave: (item: Omit<Contrato, "id">) => void;
}) {
  const blank = { numero: "", cliente: "", tipo: "Honorários Contratuais", valor: "", periodicidade: "Mensal", percentualExito: "0", inicio: "", fim: "" };
  const [f, setF] = useState(blank);
  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  function submit() {
    if (!f.cliente || !f.valor || !f.inicio) return;
    onSave({ numero: f.numero || `CONT-${new Date().getFullYear()}-${uid().slice(0, 4).toUpperCase()}`, cliente: f.cliente, tipo: f.tipo, valor: Number(f.valor), periodicidade: f.periodicidade, percentualExito: Number(f.percentualExito), inicio: f.inicio, fim: f.fim || "—", status: "Vigente" });
    setF(blank); onClose();
  }

  return (
    <Drawer open={open} onClose={onClose} title="Novo Contrato">
      <div className="space-y-4">
        <FF label="Cliente *">
          <select value={f.cliente} onChange={upd("cliente")} className={ic}>
            <option value="">Selecionar cliente</option>
            {clientes.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
        </FF>
        <FF label="Tipo">
          <select value={f.tipo} onChange={upd("tipo")} className={ic}>
            {["Honorários Contratuais","Honorários de Êxito","Consultoria Jurídica","Pericial","Previdenciário","Trabalhista"].map(t => <option key={t}>{t}</option>)}
          </select>
        </FF>
        <div className="grid grid-cols-2 gap-3">
          <FF label="Valor (R$) *"><input type="number" min="0" value={f.valor} onChange={upd("valor")} className={ic} /></FF>
          <FF label="% Êxito"><input type="number" min="0" max="100" value={f.percentualExito} onChange={upd("percentualExito")} className={ic} /></FF>
        </div>
        <FF label="Periodicidade">
          <select value={f.periodicidade} onChange={upd("periodicidade")} className={ic}>{["Mensal","Trimestral","Semestral","Anual","Êxito","Por ato"].map(t => <option key={t}>{t}</option>)}</select>
        </FF>
        <div className="grid grid-cols-2 gap-3">
          <FF label="Início * (mm/aaaa)"><input type="month" value={f.inicio} onChange={upd("inicio")} className={ic} /></FF>
          <FF label="Término (mm/aaaa)"><input type="month" value={f.fim} onChange={upd("fim")} className={ic} /></FF>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Cancelar</button>
          <button onClick={submit} className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110">Salvar Contrato</button>
        </div>
      </div>
    </Drawer>
  );
}

function NovoProcessoDrawer({ open, onClose, clientes, onSave }: {
  open: boolean; onClose: () => void; clientes: Cliente[];
  onSave: (item: Omit<ProcessoFinanceiro, "id">) => void;
}) {
  const blank = { numero: "", cliente: "", area: "Previdenciário", responsavel: RESP_OPTIONS[0], valorCausa: "", receitaTotal: "0", despesaTotal: "0" };
  const [f, setF] = useState(blank);
  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  function submit() {
    if (!f.numero || !f.cliente) return;
    const rec = Number(f.receitaTotal), desp = Number(f.despesaTotal);
    const margem = rec > 0 ? ((rec - desp) / rec) * 100 : 0;
    onSave({ numero: f.numero, cliente: f.cliente, area: f.area, responsavel: f.responsavel, valorCausa: Number(f.valorCausa), receitaTotal: rec, despesaTotal: desp, margem, status: "Ativo" });
    setF(blank); onClose();
  }

  return (
    <Drawer open={open} onClose={onClose} title="Novo Processo Financeiro">
      <div className="space-y-4">
        <FF label="Nº do Processo *"><input placeholder="0000000-00.0000.0.00.0000" value={f.numero} onChange={upd("numero")} className={ic} /></FF>
        <FF label="Cliente *">
          <select value={f.cliente} onChange={upd("cliente")} className={ic}>
            <option value="">Selecionar</option>
            {clientes.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
        </FF>
        <div className="grid grid-cols-2 gap-3">
          <FF label="Área">
            <select value={f.area} onChange={upd("area")} className={ic}>{["Previdenciário","Pericial","Trabalhista","Civil","Tributário"].map(t => <option key={t}>{t}</option>)}</select>
          </FF>
          <FF label="Responsável">
            <select value={f.responsavel} onChange={upd("responsavel")} className={ic}>{RESP_OPTIONS.map(r => <option key={r}>{r}</option>)}</select>
          </FF>
        </div>
        <FF label="Valor da Causa (R$)"><input type="number" min="0" value={f.valorCausa} onChange={upd("valorCausa")} className={ic} /></FF>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Cancelar</button>
          <button onClick={submit} className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110">Cadastrar Processo</button>
        </div>
      </div>
    </Drawer>
  );
}

// ─── Tooltip style ────────────────────────────────────────────────────────────

const ttStyle = { contentStyle: { background: "#0b1830", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, color: "#fff" } };

// ─── Dashboard View ───────────────────────────────────────────────────────────

function DashboardView({ receivables, payables, activities, alerts, onNovaReceita, onNovaDespesa }: {
  receivables: Receivable[]; payables: Payable[];
  activities: ActivityItem[]; alerts: AlertItem[];
  onNovaReceita: () => void; onNovaDespesa: () => void;
}) {
  const aReceber = receivables.filter(r => r.status !== "Liquidado").reduce((s, r) => s + r.valor, 0);
  const aPagar = payables.filter(p => p.status !== "Pago").reduce((s, p) => s + p.valor, 0);
  const vencidos = receivables.filter(r => r.status === "Vencido").reduce((s, r) => s + r.valor, 0);

  const kpis: KPI[] = [
    { title: "A Receber", value: aReceber, icon: <ArrowUpCircle size={22} />, color: "border-emerald-400/20 bg-gradient-to-br from-emerald-500/20 to-emerald-700/10", subtitle: `${receivables.filter(r=>r.status!=="Liquidado").length} cobranças ativas` },
    { title: "A Pagar", value: aPagar, icon: <ArrowDownCircle size={22} />, color: "border-red-400/20 bg-gradient-to-br from-red-500/20 to-red-700/10", subtitle: `${payables.filter(p=>p.status!=="Pago").length} obrigações` },
    { title: "Caixa Projetado", value: aReceber - aPagar, icon: <Wallet size={22} />, color: "border-blue-400/20 bg-gradient-to-br from-blue-500/20 to-cyan-700/10", subtitle: "Saldo previsto" },
    { title: "Inadimplência", value: vencidos, icon: <AlertTriangle size={22} />, color: "border-amber-400/20 bg-gradient-to-br from-amber-500/20 to-orange-700/10", subtitle: `${receivables.filter(r=>r.status==="Vencido").length} vencidos` },
  ];

  const pendingPayables = payables.filter(p => p.status !== "Pago").slice(0, 4);

  // ── Dados para gráficos ─────────────────────────────────────────────────────
  const cashFlowData = useMemo(() => {
    const map: Record<string, { mes: string; receita: number; despesa: number; saldo: number }> = {};
    receivables.forEach(r => {
      const k = r.vencimento || "—";
      if (!map[k]) map[k] = { mes: fmtMes(k), receita: 0, despesa: 0, saldo: 0 };
      map[k].receita += r.valor;
    });
    payables.forEach(p => {
      const k = p.vencimento || "—";
      if (!map[k]) map[k] = { mes: fmtMes(k), receita: 0, despesa: 0, saldo: 0 };
      map[k].despesa += p.valor;
    });
    return Object.keys(map)
      .filter(k => k !== "—")
      .sort()
      .map(k => ({ ...map[k], saldo: map[k].receita - map[k].despesa }));
  }, [receivables, payables]);

  const honorariosData = useMemo(() => {
    const map: Record<string, number> = {};
    receivables.forEach(r => {
      const area = r.contrato || "Outros";
      map[area] = (map[area] || 0) + r.valor;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [receivables]);

  const tooltipStyle = { background: "#0c1a31", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 12 } as const;

  return (
    <div className="space-y-6">
      <KPIGrid items={kpis} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <DarkCard title="Contas a Receber" subtitle="Últimos lançamentos de honorários" icon={<ArrowUpCircle size={18} />}
            rightAction={<button onClick={onNovaReceita} className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"><Plus size={12} /> Nova</button>}>
            <TableReceivables rows={receivables.slice(0, 5)} />
          </DarkCard>
        </div>
        <div className="xl:col-span-4">
          <DarkCard
            title="Fluxo de Caixa"
            subtitle={cashFlowData.length > 0 ? "Entradas e saídas por competência" : "Lance movimentações para visualizar"}
            icon={<Wallet size={18} />}
          >
            <div className="h-[320px]">
              {cashFlowData.length === 0 ? (
                <EmptyChart label="Lance receitas e despesas para gerar o gráfico de fluxo de caixa." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cashFlowData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cfRec" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="cfDes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="mes" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} width={42} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [brl(v), n === "receita" ? "Receita" : n === "despesa" ? "Despesa" : "Saldo"]} />
                    <Legend formatter={(v: string) => v === "receita" ? "Receita" : v === "despesa" ? "Despesa" : "Saldo"} wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} />
                    <Area type="monotone" dataKey="receita" stroke="#22c55e" strokeWidth={2} fill="url(#cfRec)" dot={false} name="receita" />
                    <Area type="monotone" dataKey="despesa" stroke="#ef4444" strokeWidth={2} fill="url(#cfDes)" dot={false} name="despesa" />
                    <Area type="monotone" dataKey="saldo" stroke="#60a5fa" strokeWidth={1.5} fill="none" strokeDasharray="4 2" dot={false} name="saldo" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </DarkCard>
        </div>
        <div className="xl:col-span-3">
          <DarkCard title="Próximos Vencimentos" subtitle="Obrigações pendentes" icon={<CalendarRange size={18} />}>
            {pendingPayables.length === 0 ? <EmptyState message="Nenhum vencimento cadastrado." icon={<CalendarRange size={28} />} /> : (
              <div className="space-y-3">
                {pendingPayables.map(item => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-white text-sm truncate">{item.fornecedor}</div>
                      <StatusBadge value={item.status} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-mono">{fmtMes(item.vencimento)}</span>
                      <span className="font-bold text-white">{brl(item.valor)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DarkCard>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <DarkCard title="Contas a Pagar" subtitle="Despesas e obrigações" icon={<ArrowDownCircle size={18} />}
            rightAction={<button onClick={onNovaDespesa} className="flex items-center gap-1.5 rounded-xl bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/25"><Plus size={12} /> Nova</button>}>
            <TablePayables rows={payables.slice(0, 5)} />
          </DarkCard>
        </div>
        <div className="xl:col-span-4">
          <DarkCard
            title="Receitas × Despesas"
            subtitle={cashFlowData.length > 0 ? "Comparativo mensal" : "Lance dados para visualizar"}
            icon={<FileBarChart2 size={18} />}
          >
            <div className="h-[310px]">
              {cashFlowData.length === 0 ? (
                <EmptyChart label="Lance receitas e despesas para gerar o gráfico comparativo." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashFlowData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} width={42} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [brl(v), n === "receita" ? "Receita" : "Despesa"]} />
                    <Legend formatter={(v: string) => v === "receita" ? "Receita" : "Despesa"} wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} />
                    <Bar dataKey="receita" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={28} name="receita" />
                    <Bar dataKey="despesa" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} name="despesa" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </DarkCard>
        </div>
        <div className="xl:col-span-4">
          <DarkCard
            title="Honorários por Área"
            subtitle={honorariosData.length > 0 ? "Composição das receitas" : "Lance dados para visualizar"}
            icon={<PieChart size={18} />}
          >
            <div className="h-[310px]">
              {honorariosData.length === 0 ? (
                <EmptyChart label="Cadastre honorários por área para visualizar a composição." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={honorariosData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="44%"
                      outerRadius={88}
                      innerRadius={48}
                      paddingAngle={3}
                    >
                      {honorariosData.map((_, i) => (
                        <Cell key={i} fill={colorsPie[i % colorsPie.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [brl(v)]} />
                    <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} />
                  </RePieChart>
                </ResponsiveContainer>
              )}
            </div>
          </DarkCard>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <DarkCard title="Atividade Financeira Recente" subtitle="Movimentações e eventos" icon={<FileText size={18} />}>
            <ActivityList items={activities} />
          </DarkCard>
        </div>
        <div className="xl:col-span-4">
          <DarkCard title="Indicadores Gerenciais" subtitle="Resumo executivo do período" icon={<FileBarChart2 size={18} />}>
            <div className="grid grid-cols-2 gap-3">
              <SmallStat icon={<ArrowUpCircle size={16} />} label="Receita bruta" value={brl(receivables.reduce((s,r)=>s+r.valor,0))} tone="green" />
              <SmallStat icon={<ArrowDownCircle size={16} />} label="Despesa total" value={brl(payables.reduce((s,p)=>s+p.valor,0))} tone="red" />
              <SmallStat icon={<CheckCircle2 size={16} />} label="Liquidados" value={brl(receivables.filter(r=>r.status==="Liquidado").reduce((s,r)=>s+r.valor,0))} tone="purple" />
              <SmallStat icon={<Users size={16} />} label="Lançamentos" value={String(receivables.length + payables.length)} tone="blue" />
            </div>
          </DarkCard>
        </div>
        <div className="xl:col-span-3">
          <DarkCard title="Insights Automáticos" subtitle="Sinais críticos" icon={<Target size={18} />}>
            <AlertsList items={alerts} />
          </DarkCard>
        </div>
      </div>
    </div>
  );
}

// ─── Select field ─────────────────────────────────────────────────────────────

function SelectField({ label, options, value, onChange, icon }: { label: string; options: FilterOption[]; value: string; onChange: (v: string) => void; icon?: React.ReactNode }) {
  return (
    <div className="min-w-[160px]">
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</label>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
        <select value={value} onChange={e => onChange(e.target.value)} className={cx("w-full appearance-none rounded-2xl border border-white/10 bg-[#0c1a31] px-4 py-2.5 text-sm text-white outline-none transition focus:border-blue-400/50 focus:ring-2 focus:ring-blue-500/20", icon ? "pl-10" : undefined)}>
          {options.map(o => <option key={o.value} value={o.value} className="bg-[#0c1a31] text-white">{o.label}</option>)}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

// ─── Clientes e Contratos View ────────────────────────────────────────────────

function ClientesContratosView({ clientes, contratos, onNovoCliente, onNovoContrato }: {
  clientes: Cliente[]; contratos: Contrato[];
  onNovoCliente: () => void; onNovoContrato: () => void;
}) {
  const [tab, setTab] = useState<"clientes" | "contratos">("clientes");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SmallStat icon={<Users size={16} />} label="Total de clientes" value={String(clientes.length)} tone="blue" />
        <SmallStat icon={<CheckCircle2 size={16} />} label="Clientes ativos" value={String(clientes.filter(c => c.status === "Ativo").length)} tone="green" />
        <SmallStat icon={<FileText size={16} />} label="Contratos vigentes" value={String(contratos.filter(c => c.status === "Vigente").length)} tone="purple" />
        <SmallStat icon={<DollarSign size={16} />} label="Carteira total" value={brl(clientes.reduce((s, c) => s + c.valorCarteira, 0))} tone="amber" />
      </div>
      <DarkCard title="Clientes e Contratos" subtitle="Gestão completa da carteira do escritório" icon={<Users size={18} />}
        rightAction={
          <div className="flex gap-2">
            <button onClick={tab === "clientes" ? onNovoCliente : onNovoContrato} className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-bold text-white shadow-lg hover:brightness-110">
              <Plus size={15} /> {tab === "clientes" ? "Novo Cliente" : "Novo Contrato"}
            </button>
          </div>
        }>
        <div className="mb-5 flex gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          {(["clientes","contratos"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={cx("flex-1 rounded-xl py-2 text-sm font-semibold capitalize transition-all", tab === t ? "bg-blue-500/25 text-blue-200" : "text-slate-400 hover:text-white")}>
              {t === "clientes" ? "Clientes" : "Contratos"}
            </button>
          ))}
        </div>
        {tab === "clientes" ? (
          clientes.length === 0 ? <EmptyState message="Nenhum cliente cadastrado. Use 'Novo Cliente' para começar." icon={<Users size={28} />} /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                    <th className="px-3 py-2">Nome</th><th className="px-3 py-2">CPF/CNPJ</th>
                    <th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Responsável</th>
                    <th className="px-3 py-2">Origem</th><th className="px-3 py-2">Processos</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map(c => (
                    <tr key={c.id} className="rounded-2xl bg-white/[0.03] text-sm text-slate-200 ring-1 ring-white/5">
                      <td className="rounded-l-2xl px-3 py-3 font-semibold text-white">{c.nome}</td>
                      <td className="px-3 py-3 text-slate-300 text-xs">{c.cnpjCpf || "—"}</td>
                      <td className="px-3 py-3"><span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs text-blue-300">{c.tipo}</span></td>
                      <td className="px-3 py-3 text-slate-300">{c.responsavel}</td>
                      <td className="px-3 py-3 text-slate-300">{c.origem}</td>
                      <td className="px-3 py-3 text-center">{c.processos}</td>
                      <td className="rounded-r-2xl px-3 py-3"><StatusBadge value={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          contratos.length === 0 ? <EmptyState message="Nenhum contrato cadastrado. Use 'Novo Contrato' para começar." icon={<FileText size={28} />} /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                    <th className="px-3 py-2">Número</th><th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Valor</th>
                    <th className="px-3 py-2">Periodicidade</th><th className="px-3 py-2">% Êxito</th>
                    <th className="px-3 py-2">Início</th><th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {contratos.map(ct => (
                    <tr key={ct.id} className="rounded-2xl bg-white/[0.03] text-sm text-slate-200 ring-1 ring-white/5">
                      <td className="rounded-l-2xl px-3 py-3 text-xs text-blue-300 font-mono">{ct.numero}</td>
                      <td className="px-3 py-3 font-medium">{ct.cliente}</td>
                      <td className="px-3 py-3 text-slate-300">{ct.tipo}</td>
                      <td className="px-3 py-3 font-semibold text-white">{brl(ct.valor)}</td>
                      <td className="px-3 py-3 text-slate-300">{ct.periodicidade}</td>
                      <td className="px-3 py-3 text-center">{ct.percentualExito > 0 ? `${ct.percentualExito}%` : "—"}</td>
                      <td className="px-3 py-3 text-slate-300 font-mono">{fmtMes(ct.inicio)}</td>
                      <td className="rounded-r-2xl px-3 py-3"><StatusBadge value={ct.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </DarkCard>
    </div>
  );
}

// ─── Processos Financeiros View ────────────────────────────────────────────────

function ProcessosFinanceirosView({ processos, onNovoProcesso }: { processos: ProcessoFinanceiro[]; onNovoProcesso: () => void }) {
  const [detail, setDetail] = useState<ProcessoFinanceiro | null>(null);
  const totalReceita = processos.reduce((s, p) => s + p.receitaTotal, 0);
  const totalDespesa = processos.reduce((s, p) => s + p.despesaTotal, 0);
  const margemMedia = processos.length > 0 ? processos.reduce((s, p) => s + p.margem, 0) / processos.length : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SmallStat icon={<Scale size={16} />} label="Processos ativos" value={String(processos.filter(p => p.status === "Ativo").length)} tone="blue" />
        <SmallStat icon={<TrendingUp size={16} />} label="Receita total" value={brl(totalReceita)} tone="green" />
        <SmallStat icon={<TrendingDown size={16} />} label="Despesa total" value={brl(totalDespesa)} tone="red" />
        <SmallStat icon={<Target size={16} />} label="Margem média" value={margemMedia > 0 ? `${margemMedia.toFixed(1)}%` : "—"} tone="purple" />
      </div>
      {detail ? (
        <DarkCard title={`Processo ${detail.numero.slice(0, 22)}…`} subtitle={`${detail.cliente} — ${detail.area}`} icon={<Scale size={18} />}
          rightAction={<button onClick={() => setDetail(null)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10">← Voltar</button>}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-6">
            <SmallStat icon={<Gavel size={16} />} label="Valor da causa" value={brl(detail.valorCausa)} tone="blue" />
            <SmallStat icon={<TrendingUp size={16} />} label="Receita total" value={brl(detail.receitaTotal)} tone="green" />
            <SmallStat icon={<TrendingDown size={16} />} label="Despesa total" value={brl(detail.despesaTotal)} tone="red" />
            <SmallStat icon={<Target size={16} />} label="Margem" value={`${detail.margem.toFixed(1)}%`} tone="purple" />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-sm font-semibold text-white mb-4">DRE do Processo</div>
            <div className="space-y-2 text-sm">
              {[
                { label: "Receita bruta", value: detail.receitaTotal, cls: "text-emerald-300" },
                { label: "(-) Custas e diligências", value: -detail.despesaTotal * 0.4, cls: "text-red-300" },
                { label: "(-) Despesas operacionais", value: -detail.despesaTotal * 0.6, cls: "text-red-300" },
                { label: "= Resultado operacional", value: detail.receitaTotal - detail.despesaTotal, cls: "text-white font-bold text-base" },
              ].map(row => (
                <div key={row.label} className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-300">{row.label}</span>
                  <span className={row.cls}>{brl(row.value)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-1">
                <span className="text-slate-300 font-semibold">Margem operacional</span>
                <span className="text-purple-300 font-bold">{detail.margem.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </DarkCard>
      ) : (
        <DarkCard title="Processos Financeiros" subtitle="Rentabilidade e DRE por processo judicial" icon={<Scale size={18} />}
          rightAction={<button onClick={onNovoProcesso} className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-bold text-white shadow-lg hover:brightness-110"><Plus size={15} /> Novo Processo</button>}>
          {processos.length === 0 ? <EmptyState message="Nenhum processo cadastrado. Use 'Novo Processo' para começar." icon={<Scale size={28} />} /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                    <th className="px-3 py-2">Nº Processo</th><th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Área</th><th className="px-3 py-2">Responsável</th>
                    <th className="px-3 py-2">Valor da Causa</th><th className="px-3 py-2">Receita</th>
                    <th className="px-3 py-2">Despesa</th><th className="px-3 py-2">Margem</th>
                    <th className="px-3 py-2">Status</th><th className="px-3 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {processos.map(p => (
                    <tr key={p.id} className="rounded-2xl bg-white/[0.03] text-sm text-slate-200 ring-1 ring-white/5">
                      <td className="rounded-l-2xl px-3 py-3 text-xs text-blue-300 font-mono">{p.numero.slice(0, 18)}…</td>
                      <td className="px-3 py-3 font-medium">{p.cliente}</td>
                      <td className="px-3 py-3 text-slate-300">{p.area}</td>
                      <td className="px-3 py-3 text-slate-300">{p.responsavel}</td>
                      <td className="px-3 py-3 font-semibold text-white">{brl(p.valorCausa)}</td>
                      <td className="px-3 py-3 text-emerald-300">{brl(p.receitaTotal)}</td>
                      <td className="px-3 py-3 text-red-300">{brl(p.despesaTotal)}</td>
                      <td className="px-3 py-3"><span className={cx("font-bold", p.margem >= 70 ? "text-emerald-300" : p.margem >= 50 ? "text-amber-300" : "text-red-300")}>{p.margem.toFixed(1)}%</span></td>
                      <td className="px-3 py-3"><StatusBadge value={p.status} /></td>
                      <td className="rounded-r-2xl px-3 py-3">
                        <button onClick={() => setDetail(p)} className="rounded-xl bg-blue-500/15 px-2.5 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-500/25">Detalhar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DarkCard>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function UpgradeGateCtrl({ planRequired, feature }: { planRequired: string; feature: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-2xl border border-amber-400/20 bg-amber-500/5">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center ring-1 ring-amber-400/20">
          <ShieldCheck size={28} className="text-amber-300" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">{feature}</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Este módulo está disponível a partir do plano{" "}
            <span className="font-semibold text-amber-300">{planRequired}</span>.
            Faça upgrade para desbloquear acesso completo.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/planos">
            <button className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors shadow-sm">
              <Crown size={15} /> Ver Planos
            </button>
          </Link>
          <Link href="/">
            <button className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 text-sm font-medium transition-colors">
              Voltar ao Dashboard
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Backup & Restore View ────────────────────────────────────────────────────

const LS_LAST_BACKUP = "veritas_ctrl_last_backup";

type BackupModule = { label: string; count: number; icon: React.ReactNode; color: string };

function BackupView({
  receivables, payables, clientes, fornecedores, contratos, processos, onRefresh,
}: {
  receivables: Receivable[]; payables: Payable[]; clientes: Cliente[];
  fornecedores: Fornecedor[]; contratos: Contrato[]; processos: ProcessoFinanceiro[];
  onRefresh: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<"success" | "error" | null>(null);
  const [restoreMsg, setRestoreMsg] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(() => localStorage.getItem(LS_LAST_BACKUP));

  const modules: BackupModule[] = [
    { label: "Receitas (a receber)",    count: receivables.length,  icon: <ArrowUpCircle size={15} />,   color: "text-green-400" },
    { label: "Despesas (a pagar)",       count: payables.length,     icon: <ArrowDownCircle size={15} />, color: "text-red-400" },
    { label: "Clientes",                 count: clientes.length,     icon: <Users size={15} />,           color: "text-blue-400" },
    { label: "Fornecedores",             count: fornecedores.length, icon: <Building2 size={15} />,       color: "text-purple-400" },
    { label: "Contratos",                count: contratos.length,    icon: <FileText size={15} />,        color: "text-amber-400" },
    { label: "Processos Financeiros",    count: processos.length,    icon: <Scale size={15} />,           color: "text-cyan-400" },
  ];

  const totalRecords = modules.reduce((s, m) => s + m.count, 0);

  async function handleExport() {
    setDownloading(true);
    try {
      const res = await fetch("/api/controladoria/backup", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Falha ao gerar backup");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `veritas_controladoria_backup_${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const now = new Date().toLocaleString("pt-BR");
      localStorage.setItem(LS_LAST_BACKUP, now);
      setLastBackup(now);
    } catch (e: any) {
      setRestoreStatus("error");
      setRestoreMsg("Erro ao exportar: " + (e?.message ?? ""));
    } finally {
      setDownloading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setConfirmOpen(true);
    e.target.value = "";
  }

  async function handleConfirmRestore() {
    if (!pendingFile) return;
    setConfirmOpen(false);
    setRestoring(true);
    setRestoreStatus(null);
    try {
      const text = await pendingFile.text();
      const data = JSON.parse(text);
      const res = await fetch("/api/controladoria/restore", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Erro desconhecido");
      setRestoreStatus("success");
      setRestoreMsg(`${result.imported} registro(s) restaurado(s) com sucesso.`);
      onRefresh();
    } catch (e: any) {
      setRestoreStatus("error");
      setRestoreMsg("Erro ao restaurar: " + (e?.message ?? ""));
    } finally {
      setRestoring(false);
      setPendingFile(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <DarkCard title="Backup e Restauração" subtitle="Exportação e importação de todos os dados da Controladoria" icon={<HardDrive size={18} />}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Export */}
          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-green-300 font-semibold text-sm">
              <Download size={16} /> Exportar Backup Local
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Gera um arquivo <strong className="text-white">.json</strong> com todos os seus dados da Controladoria — receitas, despesas, clientes, fornecedores, contratos e processos. Guarde em local seguro.
            </p>
            {lastBackup && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock size={11} /> Último backup: <span className="text-slate-400">{lastBackup}</span>
              </div>
            )}
            <button
              onClick={handleExport}
              disabled={downloading}
              className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-green-500 disabled:opacity-60 transition"
            >
              {downloading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              {downloading ? "Gerando..." : "Baixar Backup (.json)"}
            </button>
          </div>

          {/* Restore */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
              <Upload size={16} /> Restaurar Backup
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Importa um arquivo de backup <strong className="text-white">.json</strong> exportado por esta plataforma. Os dados são <strong className="text-amber-300">adicionados</strong> aos existentes (sem exclusão).
            </p>
            <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 px-3 py-2 text-xs text-amber-300/80">
              Atenção: a restauração <strong>não apaga</strong> dados atuais — apenas insere registros do backup.
            </div>
            <label className="mt-auto cursor-pointer flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-amber-500 transition">
              {restoring ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
              {restoring ? "Restaurando..." : "Selecionar Arquivo"}
              <input type="file" accept=".json,application/json" className="hidden" onChange={handleFileChange} disabled={restoring} />
            </label>
          </div>

          {/* Stats */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm">
              <HardDrive size={16} /> Dados Atuais
            </div>
            <div className="text-2xl font-bold text-white">{totalRecords} <span className="text-sm font-normal text-slate-400">registros</span></div>
            <div className="space-y-2 mt-1">
              {modules.map(m => (
                <div key={m.label} className="flex items-center justify-between text-xs">
                  <div className={`flex items-center gap-1.5 ${m.color}`}>{m.icon} {m.label}</div>
                  <span className="font-semibold text-white tabular-nums">{m.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Feedback banner */}
        {restoreStatus && (
          <div className={`mt-4 flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium ${restoreStatus === "success" ? "bg-green-500/15 text-green-300 border border-green-500/25" : "bg-red-500/15 text-red-300 border border-red-500/25"}`}>
            {restoreStatus === "success" ? <CheckCheck size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
            <span>{restoreMsg}</span>
            <button onClick={() => setRestoreStatus(null)} className="ml-auto"><X size={14} /></button>
          </div>
        )}
      </DarkCard>

      {/* Info card */}
      <DarkCard title="Sobre o Sistema de Backup" subtitle="Boas práticas de segurança de dados" icon={<ShieldCheck size={18} />}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">O que é incluído no backup</h4>
            <ul className="space-y-1.5 text-xs text-slate-400">
              {["Contas a receber e honorários", "Contas a pagar e despesas", "Clientes e contratos", "Fornecedores", "Processos financeiros", "Histórico de atividades (últimas 500)"].map(item => (
                <li key={item} className="flex items-center gap-2"><CheckCheck size={11} className="text-green-400 shrink-0" />{item}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Recomendações</h4>
            <ul className="space-y-1.5 text-xs text-slate-400">
              {[
                "Faça backup semanalmente ou antes de grandes alterações",
                "Armazene o arquivo em nuvem (Google Drive, OneDrive, Dropbox)",
                "O arquivo é legível e pode ser aberto em qualquer editor JSON",
                "Para migrar dados entre contas: exporte na conta A e restaure na conta B",
              ].map(item => (
                <li key={item} className="flex items-center gap-2"><ShieldCheck size={11} className="text-blue-400 shrink-0" />{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </DarkCard>

      {/* Confirm restore modal */}
      {confirmOpen && pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl border border-amber-500/30 bg-[#151c2c] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-amber-500/15 p-2"><AlertTriangle size={20} className="text-amber-400" /></div>
              <h3 className="text-lg font-bold text-white">Confirmar Restauração</h3>
            </div>
            <p className="text-sm text-slate-300 mb-2">Arquivo selecionado:</p>
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs font-mono text-slate-300 mb-4 truncate">{pendingFile.name}</div>
            <p className="text-sm text-slate-400 mb-6">
              Os dados do backup serão <strong className="text-white">adicionados</strong> ao banco. Nenhum registro atual será excluído. Deseja continuar?
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setConfirmOpen(false); setPendingFile(null); }} className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10">Cancelar</button>
              <button onClick={handleConfirmRestore} className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white hover:bg-amber-500">
                <Upload size={14} className="inline mr-1.5" />Restaurar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers para limite mensal da Controladoria (Plano Educacional) ─────────


export default function ControladoriaJuridica() {
  const { user } = useAuth();
  const { data: subData } = useSubscription();
  const planSlug = subData?.planSlug ?? null;
  const isAdmin = user?.role === "admin";

  // ── Server-persisted data via useCtrlData hook ─────────────────────────────
  const {
    loading: dataLoading,
    receivables, payables, activities, alerts,
    clientes, fornecedores, contratos, processos,
    monthlyCount,
    addReceivable: apiAddReceivable,
    updateReceivableStatus: apiUpdateReceivableStatus,
    deleteReceivable: apiDeleteReceivable,
    addPayable: apiAddPayable,
    updatePayableStatus: apiUpdatePayableStatus,
    deletePayable: apiDeletePayable,
    addCliente: apiAddCliente,
    addFornecedor: apiAddFornecedor,
    addContrato: apiAddContrato,
    addProcesso: apiAddProcesso,
    clearAlerts,
    refetchAll,
  } = useCtrlData();

  // Limite mensal de registros para o plano educacional
  const ctrlLimit = isAdmin ? null : (CTRL_RECORDS_LIMIT[planSlug as PlanSlug] ?? null);
  const ctrlLimitReached = ctrlLimit !== null && monthlyCount >= ctrlLimit;

  const [selected, setSelected] = useState("dashboard");

  // ── Filters ────────────────────────────────────────────────────────────────
  const [filtCliente, setFiltCliente] = useState("all");
  const [filtProcesso, setFiltProcesso] = useState("all");
  const [filtAdvogado, setFiltAdvogado] = useState("all");
  const [filtUnidade, setFiltUnidade] = useState("all");
  const [filtPeriodo, setFiltPeriodo] = useState("30");
  const [busca, setBusca] = useState("");

  // ── Modal states ───────────────────────────────────────────────────────────
  const [showNovaReceita, setShowNovaReceita] = useState(false);
  const [showNovaDespesa, setShowNovaDespesa] = useState(false);
  const [baixaItem, setBaixaItem] = useState<Receivable | null>(null);
  const [pagamentoItem, setPagamentoItem] = useState<Payable | null>(null);
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [showNovoFornecedor, setShowNovoFornecedor] = useState(false);
  const [showNovoContrato, setShowNovoContrato] = useState(false);
  const [showNovoProcesso, setShowNovoProcesso] = useState(false);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);

  // ── Export CSV ─────────────────────────────────────────────────────────────
  function exportCSV() {
    let rows: string[] = [];
    let filename = "controladoria_export.csv";

    if (selected === "recebiveis" || selected === "dashboard") {
      filename = "recebiveis.csv";
      rows = [
        "ID,Cliente,Processo,Contrato,Vencimento,Valor,Status",
        ...receivables.map(r =>
          [r.id, r.cliente, r.processo, r.contrato, r.vencimento,
            r.valor.toFixed(2), r.status].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
        ),
      ];
    } else if (selected === "despesas") {
      filename = "despesas.csv";
      rows = [
        "ID,Fornecedor,Categoria,Processo,Vencimento,Valor,Status",
        ...payables.map(p =>
          [p.id, p.fornecedor, p.categoria, p.processo ?? "", p.vencimento,
            p.valor.toFixed(2), p.status].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
        ),
      ];
    } else if (selected === "clientes") {
      filename = "clientes_contratos.csv";
      rows = [
        "Tipo,ID,Nome,CNPJ_CPF,Tipo_Pessoa,Email,Telefone",
        ...clientes.map(c =>
          ["Cliente", c.id, c.nome, c.cnpjCpf, c.tipo, c.email ?? "", c.telefone ?? ""]
            .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
        ),
      ];
    } else if (selected === "processos") {
      filename = "processos.csv";
      rows = [
        "ID,Número,Cliente,Área,Responsável,Valor_Causa,Receita_Total,Despesa_Total,Margem,Status",
        ...processos.map(p =>
          [p.id, p.numero, p.cliente, p.area, p.responsavel,
            p.valorCausa.toFixed(2), p.receitaTotal.toFixed(2), p.despesaTotal.toFixed(2),
            p.margem.toFixed(2), p.status]
            .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
        ),
      ];
    } else {
      rows = ["Módulo não possui dados exportáveis ainda."];
    }

    const bom = "\uFEFF";
    const blob = new Blob([bom + rows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Action handlers (delegate to server via useCtrlData hook) ──────────────

  function addReceivable(item: Omit<Receivable, "id">) {
    if (ctrlLimitReached) return;
    apiAddReceivable(item);
  }

  function addPayable(item: Omit<Payable, "id">) {
    if (ctrlLimitReached) return;
    apiAddPayable(item);
  }

  function updateReceivableStatus(id: string, status: Receivable["status"]) {
    apiUpdateReceivableStatus(id, status);
  }

  function updatePayableStatus(id: string) {
    apiUpdatePayableStatus(id);
  }

  function deleteReceivable(id: string) { apiDeleteReceivable(id); }
  function deletePayable(id: string) { apiDeletePayable(id); }

  function addCliente(item: Omit<Cliente, "id">) {
    if (ctrlLimitReached) return;
    apiAddCliente(item);
  }
  function addFornecedor(item: Omit<Fornecedor, "id">) {
    if (ctrlLimitReached) return;
    apiAddFornecedor(item);
  }
  function addContrato(item: Omit<Contrato, "id">) {
    if (ctrlLimitReached) return;
    apiAddContrato(item);
  }
  function addProcesso(item: Omit<ProcessoFinanceiro, "id">) {
    if (ctrlLimitReached) return;
    apiAddProcesso(item);
  }

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filteredReceivables = useMemo(() => receivables.filter(r => {
    const q = busca.toLowerCase().trim();
    return !q || r.cliente.toLowerCase().includes(q) || r.processo.toLowerCase().includes(q) || r.contrato.toLowerCase().includes(q);
  }), [receivables, busca]);

  const filteredPayables = useMemo(() => payables.filter(p => {
    const q = busca.toLowerCase().trim();
    return !q || p.fornecedor.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q);
  }), [payables, busca]);

  // ── KPI derivados ──────────────────────────────────────────────────────────
  const aReceber = receivables.filter(r => r.status !== "Liquidado").reduce((s, r) => s + r.valor, 0);
  const aPagar = payables.filter(p => p.status !== "Pago").reduce((s, p) => s + p.valor, 0);
  const vencidos = receivables.filter(r => r.status === "Vencido").reduce((s, r) => s + r.valor, 0);
  const receitaBruta = receivables.reduce((s, r) => s + r.valor, 0);
  const despesaTotal = payables.reduce((s, p) => s + p.valor, 0);
  const jaPagos = payables.filter(p => p.status === "Pago").reduce((s, p) => s + p.valor, 0);

  // ── Fluxo de Caixa Projetado ───────────────────────────────────────────────
  const fluxoCaixaData = useMemo(() => {
    // Build a 12-month window: 3 months back + 8 months forward from today
    const today = new Date();
    const months: { key: string; label: string }[] = [];
    for (let i = -3; i <= 8; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "").replace(" ", "/");
      months.push({ key, label });
    }
    // Aggregate values per month-key
    const entradas: Record<string, number> = {};
    const saidas: Record<string, number> = {};
    receivables.forEach(r => {
      const mk = (r.vencimento ?? "").slice(0, 7);
      if (mk) entradas[mk] = (entradas[mk] ?? 0) + r.valor;
    });
    payables.forEach(p => {
      const mk = (p.vencimento ?? "").slice(0, 7);
      if (mk) saidas[mk] = (saidas[mk] ?? 0) + p.valor;
    });
    let saldoAcum = 0;
    return months.map(m => {
      const e = entradas[m.key] ?? 0;
      const s = saidas[m.key] ?? 0;
      saldoAcum += e - s;
      return { mes: m.label, entradas: e, saidas: s, saldo: saldoAcum };
    });
  }, [receivables, payables]);

  const hasFluxoData = receivables.length > 0 || payables.length > 0;

  // ── Plan access per nav key ────────────────────────────────────────────────
  const isNavAllowed = (key: string) => hasAccess(planSlug, `ctrl:${key}`, isAdmin);

  // ── View content ───────────────────────────────────────────────────────────
  const renderContent = () => {
    if (!isNavAllowed(selected)) {
      const navItem = navItems.find(n => n.key === selected);
      const planKey = `ctrl:${selected}` as keyof typeof PLAN_MIN;
      const requiredSlug = PLAN_MIN[planKey] as PlanSlug | undefined;
      const requiredLabel = requiredSlug ? (PLAN_LABEL[requiredSlug] ?? "Profissional") : "Profissional";
      return <UpgradeGateCtrl planRequired={requiredLabel} feature={navItem?.label ?? selected} />;
    }
    switch (selected) {
      case "dashboard":
        return <DashboardView receivables={receivables} payables={payables} activities={activities} alerts={alerts} onNovaReceita={() => setShowNovaReceita(true)} onNovaDespesa={() => setShowNovaDespesa(true)} />;

      case "receitas":
        return (
          <DarkCard title="Receitas e Honorários" subtitle="Honorários contratuais, êxito, sucumbência e reembolsos" icon={<BadgeDollarSign size={18} />}
            rightAction={<button onClick={() => setShowNovaReceita(true)} className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-bold text-white shadow-lg hover:brightness-110"><Plus size={15} /> Nova Receita</button>}>
            <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
              <SmallStat icon={<BadgeDollarSign size={16} />} label="Receita bruta" value={brl(receitaBruta)} tone="green" />
              <SmallStat icon={<Gavel size={16} />} label="Liquidado" value={brl(receivables.filter(r=>r.status==="Liquidado").reduce((s,r)=>s+r.valor,0))} tone="purple" />
              <SmallStat icon={<AlertTriangle size={16} />} label="Em atraso" value={brl(vencidos)} tone="amber" />
              <SmallStat icon={<Users size={16} />} label="Clientes" value={String(clientes.filter(c=>c.status==="Ativo").length)} tone="blue" />
            </div>
            <TableReceivables rows={filteredReceivables} onBaixar={r => setBaixaItem(r)} onDelete={deleteReceivable} />
          </DarkCard>
        );

      case "despesas":
        return (
          <DarkCard title="Despesas e Custas" subtitle="Saídas operacionais, processuais e reembolsáveis" icon={<Receipt size={18} />}
            rightAction={<button onClick={() => setShowNovaDespesa(true)} className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 px-4 py-2 text-sm font-bold text-white shadow-lg hover:brightness-110"><Plus size={15} /> Nova Despesa</button>}>
            <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
              <SmallStat icon={<Receipt size={16} />} label="Despesas total" value={brl(despesaTotal)} tone="red" />
              <SmallStat icon={<FileText size={16} />} label="Pendentes" value={brl(aPagar)} tone="amber" />
              <SmallStat icon={<Banknote size={16} />} label="Vencidas" value={brl(payables.filter(p=>p.status==="Vencido").reduce((s,p)=>s+p.valor,0))} tone="blue" />
              <SmallStat icon={<CheckCircle2 size={16} />} label="Pagas" value={brl(jaPagos)} tone="green" />
            </div>
            <TablePayables rows={filteredPayables} onPagar={p => setPagamentoItem(p)} onDelete={deletePayable} />
          </DarkCard>
        );

      case "receber":
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <SmallStat icon={<ArrowUpCircle size={16} />} label="Total a receber" value={brl(aReceber)} tone="blue" />
              <SmallStat icon={<AlertTriangle size={16} />} label="Vencidos" value={brl(vencidos)} tone="red" />
              <SmallStat icon={<CheckCircle2 size={16} />} label="Liquidados" value={brl(receivables.filter(r=>r.status==="Liquidado").reduce((s,r)=>s+r.valor,0))} tone="green" />
              <SmallStat icon={<Target size={16} />} label="Lançamentos" value={String(receivables.length)} tone="purple" />
            </div>
            <DarkCard title="Contas a Receber" subtitle="Cobranças ativas, vencidas e liquidadas" icon={<ArrowUpCircle size={18} />}
              rightAction={<button onClick={() => setShowNovaReceita(true)} className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-500 px-4 py-2 text-sm font-bold text-white shadow-lg hover:brightness-110"><Plus size={15} /> Nova Cobrança</button>}>
              <TableReceivables rows={filteredReceivables} onBaixar={r => setBaixaItem(r)} onDelete={deleteReceivable} />
            </DarkCard>
          </div>
        );

      case "pagar":
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <SmallStat icon={<ArrowDownCircle size={16} />} label="Total a pagar" value={brl(aPagar)} tone="blue" />
              <SmallStat icon={<AlertTriangle size={16} />} label="Vencidas" value={brl(payables.filter(p=>p.status==="Vencido").reduce((s,p)=>s+p.valor,0))} tone="red" />
              <SmallStat icon={<CheckCircle2 size={16} />} label="Pagas" value={brl(jaPagos)} tone="green" />
              <SmallStat icon={<CalendarRange size={16} />} label="Lançamentos" value={String(payables.length)} tone="amber" />
            </div>
            <DarkCard title="Contas a Pagar" subtitle="Agenda financeira e obrigações do escritório" icon={<ArrowDownCircle size={18} />}
              rightAction={<button onClick={() => setShowNovaDespesa(true)} className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 px-4 py-2 text-sm font-bold text-white shadow-lg hover:brightness-110"><Plus size={15} /> Nova Despesa</button>}>
              <TablePayables rows={filteredPayables} onPagar={p => setPagamentoItem(p)} onDelete={deletePayable} />
            </DarkCard>
          </div>
        );

      case "caixa":
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <SmallStat icon={<Wallet size={16} />} label="Saldo projetado" value={brl(aReceber - aPagar)} tone="blue" />
              <SmallStat icon={<ArrowUpCircle size={16} />} label="Entradas previstas" value={brl(aReceber)} tone="green" />
              <SmallStat icon={<ArrowDownCircle size={16} />} label="Saídas previstas" value={brl(aPagar)} tone="red" />
              <SmallStat icon={<Target size={16} />} label="Já liquidado" value={brl(receivables.filter(r=>r.status==="Liquidado").reduce((s,r)=>s+r.valor,0))} tone="purple" />
            </div>
            <DarkCard title="Fluxo de Caixa Projetado" subtitle="Entradas, saídas e saldo acumulado — janela de 12 meses" icon={<Wallet size={18} />}>
              {!hasFluxoData ? (
                <div className="h-[360px]"><EmptyChart label="Lance receitas e despesas para visualizar o fluxo de caixa projetado." /></div>
              ) : (
                <div className="h-[360px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={fluxoCaixaData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0.03} />
                        </linearGradient>
                        <linearGradient id="gradSaidas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.03} />
                        </linearGradient>
                        <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="mes" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                      <Tooltip
                        contentStyle={{ background: "#0c1a31", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: 12 }}
                        labelStyle={{ color: "#e2e8f0", fontWeight: 600, marginBottom: 4 }}
                        formatter={(value: number, name: string) => [
                          new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value),
                          name === "entradas" ? "Entradas" : name === "saidas" ? "Saídas" : "Saldo Acumulado",
                        ]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                        formatter={v => v === "entradas" ? "Entradas" : v === "saidas" ? "Saídas" : "Saldo Acumulado"}
                      />
                      <Area type="monotone" dataKey="entradas" stroke="#22c55e" strokeWidth={2} fill="url(#gradEntradas)" dot={false} />
                      <Area type="monotone" dataKey="saidas" stroke="#ef4444" strokeWidth={2} fill="url(#gradSaidas)" dot={false} />
                      <Area type="monotone" dataKey="saldo" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gradSaldo)" dot={false} strokeDasharray="0" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </DarkCard>
          </div>
        );

      case "clientes":
        return <ClientesContratosView clientes={clientes} contratos={contratos} onNovoCliente={() => setShowNovoCliente(true)} onNovoContrato={() => setShowNovoContrato(true)} />;

      case "processos":
        return <ProcessosFinanceirosView processos={processos} onNovoProcesso={() => setShowNovoProcesso(true)} />;

      case "custas":      return <CustasDepositosAlvarasPage />;
      case "repasses":    return <RepassesSociosPage />;
      case "tributos":    return <TributosRetencoesPage />;
      case "conciliacao": return <ConciliacaoBancariaPage />;
      case "relatorios":  return <RelatoriosGerenciaisPage />;
      case "inteligencia":return <InteligenciaFinanceiraPage />;
      case "config":      return <ConfiguracoesFinanceirasPage />;
      case "backup":      return <BackupView receivables={receivables} payables={payables} clientes={clientes} fornecedores={fornecedores} contratos={contratos} processos={processos} onRefresh={refetchAll} />;
      default:            return <DashboardView receivables={receivables} payables={payables} activities={activities} alerts={alerts} onNovaReceita={() => setShowNovaReceita(true)} onNovaDespesa={() => setShowNovaDespesa(true)} />;
    }
  };

  if (dataLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-[linear-gradient(180deg,#06101f_0%,#081426_100%)] text-slate-400 gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <span className="text-sm">Carregando dados da Controladoria…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.15),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.10),_transparent_25%),linear-gradient(180deg,#06101f_0%,#081426_100%)] text-slate-100">

      {/* Drawers / Modals */}
      <NovaReceitaDrawer
        open={showNovaReceita}
        onClose={() => setShowNovaReceita(false)}
        clientes={clientes}
        onCadastrarCliente={addCliente}
        onSave={addReceivable}
      />
      <NovaDespesaDrawer
        open={showNovaDespesa}
        onClose={() => setShowNovaDespesa(false)}
        fornecedores={fornecedores}
        onCadastrarFornecedor={addFornecedor}
        onSave={addPayable}
      />
      <BaixaModal item={baixaItem} onClose={() => setBaixaItem(null)} onUpdate={updateReceivableStatus} />
      <PagamentoModal item={pagamentoItem} onClose={() => setPagamentoItem(null)} onUpdate={updatePayableStatus} />
      <NovoClienteDrawer open={showNovoCliente} onClose={() => setShowNovoCliente(false)} onSave={addCliente} />
      <NovoFornecedorDrawer open={showNovoFornecedor} onClose={() => setShowNovoFornecedor(false)} onSave={addFornecedor} />
      <NovoContratoDrawer open={showNovoContrato} onClose={() => setShowNovoContrato(false)} clientes={clientes} onSave={addContrato} />
      <NovoProcessoDrawer open={showNovoProcesso} onClose={() => setShowNovoProcesso(false)} clientes={clientes} onSave={addProcesso} />

      {/* ── Alerts Side Panel ── */}
      {showAlertsPanel && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setShowAlertsPanel(false)} />
          <div className="fixed right-0 top-0 z-50 flex h-full w-[380px] flex-col bg-[#06101f] shadow-2xl border-l border-white/10">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-amber-300" />
                <h3 className="font-semibold text-white">Central de Alertas</h3>
                {alerts.length > 0 && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">{alerts.length}</span>
                )}
              </div>
              <button onClick={() => setShowAlertsPanel(false)} className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
                  <Bell size={36} className="opacity-30" />
                  <p className="text-sm">Nenhum alerta no momento.</p>
                  <p className="text-xs text-slate-600 text-center">Os alertas são gerados automaticamente conforme você lança receitas, despesas e contratos.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(["alta", "media", "baixa"] as const).map(sev => {
                    const group = alerts.filter(a => a.severity === sev);
                    if (group.length === 0) return null;
                    const sevStyle = {
                      alta: { border: "border-red-500/30", bg: "bg-red-500/10", label: "text-red-300", dot: "bg-red-400", text: "Alta prioridade" },
                      media: { border: "border-amber-500/30", bg: "bg-amber-500/10", label: "text-amber-300", dot: "bg-amber-400", text: "Média prioridade" },
                      baixa: { border: "border-blue-500/30", bg: "bg-blue-500/10", label: "text-blue-300", dot: "bg-blue-400", text: "Baixa prioridade" },
                    }[sev];
                    return (
                      <div key={sev}>
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${sevStyle.dot}`} />
                          <span className={`text-[11px] font-semibold uppercase tracking-wide ${sevStyle.label}`}>{sevStyle.text}</span>
                        </div>
                        <div className="space-y-2">
                          {group.map(alert => (
                            <div key={alert.id} className={`rounded-2xl border ${sevStyle.border} ${sevStyle.bg} px-4 py-3`}>
                              <p className={`text-sm font-medium ${sevStyle.label}`}>{alert.title}</p>
                              <p className="mt-0.5 text-xs text-slate-400">{alert.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {alerts.length > 0 && (
              <div className="border-t border-white/10 px-5 py-3">
                <button
                  onClick={() => { clearAlerts(); setShowAlertsPanel(false); }}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-2 text-sm text-slate-300 hover:bg-white/10 transition"
                >
                  Limpar todos os alertas
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 border-b border-white/10 px-6 py-4 flex-shrink-0 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-amber-500/15 p-2.5 text-amber-300 ring-1 ring-amber-400/20"><ShieldCheck size={20} /></div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">{titleMap[selected]}</h2>
            <p className="mt-0.5 text-xs text-slate-400">{subtitleMap[selected]}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowAlertsPanel(true)} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10">
            <Bell size={15} /> Alertas
            {alerts.filter(a => a.severity === "alta").length > 0 && (
              <span className="rounded-full bg-red-500/80 px-1.5 py-0.5 text-[10px] font-bold text-white">{alerts.filter(a => a.severity === "alta").length}</span>
            )}
          </button>
          <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-2xl border border-blue-400/25 bg-blue-500/15 px-4 py-2 text-sm font-medium text-blue-200 transition hover:bg-blue-500/20">
            <FileSpreadsheet size={15} /> Exportar CSV
          </button>
          <button onClick={() => setShowNovaReceita(true)} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:brightness-110">
            <CircleDollarSign size={15} /> Nova Receita
          </button>
        </div>
      </div>

      {/* ── Main area: sidebar + content ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left sidebar navigation ── */}
        <aside className="flex w-52 flex-shrink-0 flex-col border-r border-white/10 overflow-y-auto" style={{ background: "#060e1e" }}>
          {/* Módulo label */}
          <div className="px-4 pt-4 pb-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Módulos</span>
          </div>
          <nav className="flex flex-col gap-0.5 px-2 pb-4">
            {navItems.map(item => {
              const active = selected === item.key;
              const allowed = isNavAllowed(item.key);
              return (
                <button
                  key={item.key}
                  onClick={() => allowed && setSelected(item.key)}
                  title={!allowed ? `Disponível no plano ${PLAN_LABEL[PLAN_MIN[item.key as keyof typeof PLAN_MIN] as PlanSlug] ?? ""}` : undefined}
                  className={cx(
                    "flex w-full items-center gap-2.5 rounded-xl border-l-2 px-3 py-2.5 text-left text-[12px] font-medium transition-all duration-150 select-none",
                    active
                      ? allowed
                        ? "border-amber-400 bg-amber-500/10 text-amber-200"
                        : "border-amber-500/30 bg-amber-900/10 text-amber-400/60"
                      : allowed
                        ? "border-transparent text-slate-400 hover:border-slate-600 hover:bg-white/5 hover:text-slate-200"
                        : "border-transparent text-slate-600 cursor-default"
                  )}
                >
                  <span className={cx("flex-shrink-0", active ? (allowed ? "text-amber-300" : "text-amber-500/40") : allowed ? "text-slate-500" : "text-slate-700")}>
                    {item.icon}
                  </span>
                  <span className={cx("flex-1 truncate", !allowed && "opacity-60")}>{item.label}</span>
                  {!allowed && <Lock size={10} className="flex-shrink-0 text-amber-600/50" />}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Content area (filters + main view) ── */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Filters */}
        <div className="border-b border-white/10 px-6 py-3 flex-shrink-0">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
              <SelectField label="Cliente" options={[{label:"Todos os clientes",value:"all"},...clientes.map(c=>({label:c.nome,value:c.id}))]} value={filtCliente} onChange={setFiltCliente} icon={<Users size={15} />} />
              <SelectField label="Processo" options={[{label:"Todos os processos",value:"all"},...processos.map(p=>({label:p.numero.slice(0,18)+"…",value:p.id}))]} value={filtProcesso} onChange={setFiltProcesso} icon={<Scale size={15} />} />
              <SelectField label="Responsável" options={[{label:"Todos",value:"all"},...RESP_OPTIONS.map(r=>({label:r,value:r}))]} value={filtAdvogado} onChange={setFiltAdvogado} icon={<Gavel size={15} />} />
              <SelectField label="Unidade" options={[{label:"Todas as unidades",value:"all"},{label:"Matriz",value:"m"},{label:"Unid. Pericial",value:"p"}]} value={filtUnidade} onChange={setFiltUnidade} icon={<Building2 size={15} />} />
              <SelectField label="Período" options={[{label:"Últimos 30 dias",value:"30"},{label:"Últimos 90 dias",value:"90"},{label:"Ano atual",value:"365"}]} value={filtPeriodo} onChange={setFiltPeriodo} icon={<CalendarRange size={15} />} />
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <div className="relative min-w-[220px]">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente, processo, fornecedor..."
                  className="w-full rounded-2xl border border-white/10 bg-[#0c1a31] px-9 py-2 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-400/50 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <button className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10">
                <Filter size={15} /> Filtros
              </button>
            </div>
          </div>
        </div>

        {/* Limite mensal Plano Educacional */}
        {ctrlLimit !== null && (
          <div className={`mx-6 mt-4 mb-1 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm flex-shrink-0 ${
            ctrlLimitReached
              ? "border-red-500/40 bg-red-900/20 text-red-300"
              : monthlyCount >= ctrlLimit * 0.7
              ? "border-amber-500/40 bg-amber-900/15 text-amber-300"
              : "border-blue-500/30 bg-blue-900/15 text-blue-300"
          }`}>
            <div className="flex items-center gap-2">
              {ctrlLimitReached
                ? <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                : <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />}
              <span>
                {ctrlLimitReached
                  ? <>Limite mensal atingido. Seu plano Educacional permite <strong>{ctrlLimit} registros/mês</strong> na Controladoria. Os registros serão liberados no início do próximo mês.</>
                  : <><strong>{monthlyCount}</strong> de <strong>{ctrlLimit}</strong> registros mensais usados — Plano Educacional.</>
                }
              </span>
            </div>
            {ctrlLimitReached && (
              <a href="/planos" className="flex-shrink-0 rounded-xl bg-amber-500 px-3 py-1 text-xs font-bold text-black hover:bg-amber-400 transition">
                Fazer Upgrade
              </a>
            )}
          </div>
        )}

        {/* Main view */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{renderContent()}</div>
        </div>{/* /content-area */}
      </div>{/* /sidebar+content-wrapper */}
    </div>
  );
}
