import React, { useState, useEffect } from "react";
import {
  Landmark, Banknote, Calculator, CreditCard, FileBarChart2, Settings2,
  Sparkles, X, Plus, Pencil, Eye, CheckCircle2, AlertTriangle, Download,
  Upload, RotateCcw, Save, ClipboardList, Filter, RefreshCw, FileText,
  Trash2, ChevronDown, History, MoreHorizontal,
} from "lucide-react";

// ─── Shared helpers ───────────────────────────────────────────────────────────

const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const now = () => new Date().toLocaleDateString("pt-BR");
const nowTime = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function SideDrawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-[#07101f] border-l border-white/10 flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 flex-shrink-0">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function DetailDrawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-xl bg-[#07101f] border-l border-white/10 flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 flex-shrink-0">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-5 py-3 shadow-2xl backdrop-blur-sm">
      <CheckCircle2 size={16} className="text-emerald-300 flex-shrink-0" />
      <span className="text-sm font-medium text-emerald-200">{msg}</span>
      <button onClick={onClose} className="ml-2 text-emerald-400 hover:text-white"><X size={14} /></button>
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

function KPI({ label, value, tone = "blue" }: { label: string; value: string; tone?: string }) {
  const t: Record<string, string> = {
    blue:   "border-blue-400/20 bg-gradient-to-br from-blue-500/15 to-blue-700/8 text-blue-300",
    green:  "border-emerald-400/20 bg-gradient-to-br from-emerald-500/15 to-emerald-700/8 text-emerald-300",
    amber:  "border-amber-400/20 bg-gradient-to-br from-amber-500/15 to-amber-700/8 text-amber-300",
    red:    "border-red-400/20 bg-gradient-to-br from-red-500/15 to-red-700/8 text-red-300",
    purple: "border-purple-400/20 bg-gradient-to-br from-purple-500/15 to-purple-700/8 text-purple-300",
  };
  return (
    <div className={cx("rounded-3xl border p-5 shadow-xl", t[tone] ?? t.blue)}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function Card({ title, subtitle, icon, children, rightAction }: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode; rightAction?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0b1830]/90 p-5 shadow-[0_12px_60px_rgba(0,0,0,0.25)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {icon && <div className="rounded-2xl bg-white/5 p-2.5 text-slate-200">{icon}</div>}
          <div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {rightAction}
      </div>
      {children}
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const map: Record<string, string> = {
    Lançada:          "bg-blue-500/15 text-blue-300 border border-blue-500/30",
    Paga:             "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    Reembolsada:      "bg-purple-500/15 text-purple-300 border border-purple-500/30",
    Ativo:            "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    Levantado:        "bg-purple-500/15 text-purple-300 border border-purple-500/30",
    Bloqueado:        "bg-red-500/15 text-red-300 border border-red-500/30",
    Expedido:         "bg-blue-500/15 text-blue-300 border border-blue-500/30",
    Pendente:         "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    Provisionado:     "bg-blue-500/15 text-blue-300 border border-blue-500/30",
    Pago:             "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    Calculado:        "bg-blue-500/15 text-blue-300 border border-blue-500/30",
    Conferido:        "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    Exportado:        "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    Conciliado:       "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    "Não conciliado": "bg-red-500/15 text-red-300 border border-red-500/30",
    Ignorado:         "bg-slate-500/15 text-slate-400 border border-slate-500/30",
  };
  return (
    <span className={cx("rounded-full px-2.5 py-1 text-xs font-semibold", map[value] ?? "bg-white/10 text-white")}>
      {value}
    </span>
  );
}

function EmptyBlock({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center">
      <div className="text-slate-500"><FileText size={28} /></div>
      <p className="font-semibold text-white text-sm">{title}</p>
      <p className="text-xs text-slate-400 max-w-xs">{description}</p>
    </div>
  );
}

function PageShell({ icon, title, subtitle, children, actions }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-[#0b1830]/90 p-6 shadow-[0_12px_60px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-300 ring-1 ring-amber-400/20">{icon}</div>
            <div>
              <h2 className="text-2xl font-bold text-white">{title}</h2>
              <p className="mt-1 text-sm text-slate-300">{subtitle}</p>
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Btn ─────────────────────────────────────────────────────────────────────

function Btn({ onClick, children, variant = "primary", icon, small, disabled }: { onClick: () => void; children: React.ReactNode; variant?: "primary"|"secondary"|"danger"|"ghost"; icon?: React.ReactNode; small?: boolean; disabled?: boolean }) {
  const vs = {
    primary:   "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg hover:brightness-110",
    secondary: "border border-blue-400/25 bg-blue-500/15 text-blue-200 hover:bg-blue-500/25",
    danger:    "bg-red-500/15 text-red-300 border border-red-500/25 hover:bg-red-500/25",
    ghost:     "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
  };
  return (
    <button disabled={disabled} onClick={onClick} className={cx("inline-flex items-center gap-2 rounded-2xl font-medium transition-all", small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm", vs[variant], disabled && "opacity-50 pointer-events-none")}>
      {icon}{children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 — CUSTAS, DEPÓSITOS E ALVARÁS
// ═══════════════════════════════════════════════════════════════════════════════

type Custa = { id: string; cliente: string; processo: string; tipo: string; data: string; valor: number; reembolsavel: boolean; status: "Lançada"|"Paga"|"Reembolsada" };
type Deposito = { id: string; processo: string; data: string; valor: number; bankRef: string; status: "Ativo"|"Levantado"|"Bloqueado" };
type Alvara = { id: string; processo: string; emissao: string; levantamento: string; beneficiario: string; valor: number; status: "Expedido"|"Levantado"|"Pendente" };

const TIPOS_CUSTA = ["Custas iniciais","Custas recursais","Diligências","Honorários periciais","Despesas postais","Outras"];
const TIPOS_DEP = ["Depósito recursal","Garantia do juízo","Depósito de custas","Outros"];

export function CustasDepositosAlvarasPage() {
  const [tab, setTab] = useState<"custas"|"depositos"|"alvaras">("custas");
  const [custas, setCustas] = useState<Custa[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [alvaras, setAlvaras] = useState<Alvara[]>([]);
  const [toast, setToast] = useState("");

  // Drawer states
  const [showNovaCusta, setShowNovaCusta] = useState(false);
  const [showNovoDeposito, setShowNovoDeposito] = useState(false);
  const [showNovoAlvara, setShowNovoAlvara] = useState(false);
  const [editCusta, setEditCusta] = useState<Custa | null>(null);
  const [viewItem, setViewItem] = useState<Custa | Deposito | Alvara | null>(null);

  // Custa form
  const blankC = { cliente: "", processo: "", tipo: "Custas iniciais", data: "", valor: "", reembolsavel: "Não" };
  const [fc, setFc] = useState(blankC);
  const updC = (k: keyof typeof blankC) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => setFc(p => ({ ...p, [k]: e.target.value }));

  function submitCusta() {
    if (!fc.processo || !fc.valor || !fc.data) return;
    const item: Custa = { id: uid(), cliente: fc.cliente, processo: fc.processo, tipo: fc.tipo, data: fc.data, valor: Number(fc.valor), reembolsavel: fc.reembolsavel === "Sim", status: "Lançada" };
    if (editCusta) setCustas(prev => prev.map(c => c.id === editCusta.id ? { ...item, id: editCusta.id } : c));
    else setCustas(prev => [item, ...prev]);
    setFc(blankC); setEditCusta(null); setShowNovaCusta(false);
    setToast(editCusta ? "Custa atualizada com sucesso!" : "Custa lançada com sucesso!");
  }

  function startEditCusta(c: Custa) {
    setFc({ cliente: c.cliente, processo: c.processo, tipo: c.tipo, data: c.data, valor: String(c.valor), reembolsavel: c.reembolsavel ? "Sim" : "Não" });
    setEditCusta(c); setShowNovaCusta(true);
  }

  function updateCustaStatus(id: string, status: Custa["status"]) {
    setCustas(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    setToast("Status atualizado!");
  }

  function deleteCusta(id: string) { setCustas(prev => prev.filter(c => c.id !== id)); setToast("Custa excluída."); }

  // Depósito form
  const blankD = { processo: "", data: "", valor: "", bankRef: "", tipo: "Depósito recursal" };
  const [fd, setFd] = useState(blankD);
  const updD = (k: keyof typeof blankD) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => setFd(p => ({ ...p, [k]: e.target.value }));

  function submitDeposito() {
    if (!fd.processo || !fd.valor || !fd.data) return;
    setDepositos(prev => [{ id: uid(), processo: fd.processo, data: fd.data, valor: Number(fd.valor), bankRef: fd.bankRef || `DEP-${new Date().getFullYear()}-${uid().slice(0,4).toUpperCase()}`, status: "Ativo" }, ...prev]);
    setFd(blankD); setShowNovoDeposito(false); setToast("Depósito registrado!");
  }

  function marcarLevantado(id: string) { setDepositos(prev => prev.map(d => d.id === id ? { ...d, status: "Levantado" } : d)); setToast("Depósito marcado como levantado."); }

  // Alvará form
  const blankA = { processo: "", emissao: "", beneficiario: "", valor: "" };
  const [fa, setFa] = useState(blankA);
  const updA = (k: keyof typeof blankA) => (e: React.ChangeEvent<HTMLInputElement>) => setFa(p => ({ ...p, [k]: e.target.value }));

  function submitAlvara() {
    if (!fa.processo || !fa.beneficiario || !fa.valor) return;
    setAlvaras(prev => [{ id: uid(), processo: fa.processo, emissao: fa.emissao || now(), levantamento: "—", beneficiario: fa.beneficiario, valor: Number(fa.valor), status: "Expedido" }, ...prev]);
    setFa(blankA); setShowNovoAlvara(false); setToast("Alvará registrado!");
  }

  function marcarAlvaraLevantado(id: string) {
    setAlvaras(prev => prev.map(a => a.id === id ? { ...a, status: "Levantado", levantamento: now() } : a));
    setToast("Alvará marcado como levantado.");
  }

  const totalCustas = custas.reduce((s, c) => s + c.valor, 0);
  const totalDep = depositos.filter(d => d.status === "Ativo").reduce((s, d) => s + d.valor, 0);
  const totalAlv = alvaras.reduce((s, a) => s + a.valor, 0);
  const reemb = custas.filter(c => c.reembolsavel && c.status !== "Reembolsada").reduce((s, c) => s + c.valor, 0);

  const tabs = [{ key: "custas", label: "Custas" }, { key: "depositos", label: "Depósitos" }, { key: "alvaras", label: "Alvarás" }] as const;

  return (
    <PageShell title="Custas, Depósitos e Alvarás" subtitle="Gestão processual-financeira: custos, depósitos judiciais e levantamentos." icon={<Landmark size={22} />}
      actions={
        <div className="flex gap-2">
          {tab === "custas" && <Btn onClick={() => { setEditCusta(null); setFc(blankC); setShowNovaCusta(true); }} icon={<Plus size={14} />}>Nova Custa</Btn>}
          {tab === "depositos" && <Btn onClick={() => setShowNovoDeposito(true)} icon={<Plus size={14} />}>Novo Depósito</Btn>}
          {tab === "alvaras" && <Btn onClick={() => setShowNovoAlvara(true)} icon={<Plus size={14} />}>Novo Alvará</Btn>}
          <Btn variant="secondary" onClick={() => setToast("Relatório exportado com sucesso!")} icon={<Download size={14} />}>Exportar</Btn>
        </div>
      }>
      {toast && <Toast msg={toast} onClose={() => setToast("")} />}

      {/* NovaCusta Drawer */}
      <SideDrawer open={showNovaCusta} onClose={() => { setShowNovaCusta(false); setEditCusta(null); }} title={editCusta ? "Editar Custa" : "Nova Custa"}>
        <div className="space-y-4">
          <FF label="Cliente"><input placeholder="Nome do cliente" value={fc.cliente} onChange={updC("cliente")} className={ic} /></FF>
          <FF label="Processo *"><input placeholder="Nº do processo" value={fc.processo} onChange={updC("processo")} className={ic} /></FF>
          <FF label="Tipo"><select value={fc.tipo} onChange={updC("tipo")} className={ic}>{TIPOS_CUSTA.map(t => <option key={t}>{t}</option>)}</select></FF>
          <div className="grid grid-cols-2 gap-3">
            <FF label="Valor (R$) *"><input type="number" min="0" value={fc.valor} onChange={updC("valor")} className={ic} /></FF>
            <FF label="Data *"><input type="date" value={fc.data} onChange={updC("data")} className={ic} /></FF>
          </div>
          <FF label="Reembolsável do cliente?"><select value={fc.reembolsavel} onChange={updC("reembolsavel")} className={ic}><option>Não</option><option>Sim</option></select></FF>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowNovaCusta(false); setEditCusta(null); }} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Cancelar</button>
            <button onClick={submitCusta} className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110">Salvar</button>
          </div>
        </div>
      </SideDrawer>

      {/* NovoDeposito Drawer */}
      <SideDrawer open={showNovoDeposito} onClose={() => setShowNovoDeposito(false)} title="Novo Depósito Judicial">
        <div className="space-y-4">
          <FF label="Processo *"><input placeholder="Nº do processo" value={fd.processo} onChange={updD("processo")} className={ic} /></FF>
          <FF label="Tipo"><select value={fd.tipo} onChange={updD("tipo")} className={ic}>{TIPOS_DEP.map(t => <option key={t}>{t}</option>)}</select></FF>
          <div className="grid grid-cols-2 gap-3">
            <FF label="Valor (R$) *"><input type="number" min="0" value={fd.valor} onChange={updD("valor")} className={ic} /></FF>
            <FF label="Data *"><input type="date" value={fd.data} onChange={updD("data")} className={ic} /></FF>
          </div>
          <FF label="Referência bancária"><input placeholder="DEP-2025-000" value={fd.bankRef} onChange={updD("bankRef")} className={ic} /></FF>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowNovoDeposito(false)} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Cancelar</button>
            <button onClick={submitDeposito} className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110">Registrar</button>
          </div>
        </div>
      </SideDrawer>

      {/* NovoAlvara Drawer */}
      <SideDrawer open={showNovoAlvara} onClose={() => setShowNovoAlvara(false)} title="Novo Alvará">
        <div className="space-y-4">
          <FF label="Processo *"><input placeholder="Nº do processo" value={fa.processo} onChange={updA("processo")} className={ic} /></FF>
          <FF label="Beneficiário *"><input placeholder="Nome do beneficiário" value={fa.beneficiario} onChange={updA("beneficiario")} className={ic} /></FF>
          <div className="grid grid-cols-2 gap-3">
            <FF label="Valor (R$) *"><input type="number" min="0" value={fa.valor} onChange={updA("valor")} className={ic} /></FF>
            <FF label="Data de emissão"><input type="date" value={fa.emissao} onChange={updA("emissao")} className={ic} /></FF>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowNovoAlvara(false)} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Cancelar</button>
            <button onClick={submitAlvara} className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110">Registrar</button>
          </div>
        </div>
      </SideDrawer>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPI label="Custas lançadas"    value={fmtBRL(totalCustas)} tone="amber" />
        <KPI label="Depósitos ativos"   value={fmtBRL(totalDep)}    tone="blue" />
        <KPI label="Alvarás registrados" value={fmtBRL(totalAlv)}   tone="green" />
        <KPI label="Reemb. pendente"    value={fmtBRL(reemb)}       tone="purple" />
      </div>

      <Card title="Movimentações" subtitle="Custas, depósitos judiciais e alvarás"
        rightAction={
          <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} className={cx("rounded-xl px-4 py-1.5 text-xs font-semibold transition-all", tab === t.key ? "bg-blue-500/25 text-blue-200" : "text-slate-400 hover:text-white")}>
                {t.label}
              </button>
            ))}
          </div>
        }>
        {tab === "custas" && (
          custas.length === 0 ? <EmptyBlock title="Nenhuma custa lançada" description="Use 'Nova Custa' para registrar custas processuais." /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead><tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  <th className="px-3 py-2">Processo</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Valor</th><th className="px-3 py-2">Reemb.</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Ações</th>
                </tr></thead>
                <tbody>
                  {custas.map(c => (
                    <tr key={c.id} className="rounded-2xl bg-white/[0.03] text-sm text-slate-200 ring-1 ring-white/5">
                      <td className="rounded-l-2xl px-3 py-3 text-xs text-blue-300 font-mono">{c.processo.slice(0,18)}</td>
                      <td className="px-3 py-3 text-slate-300">{c.tipo}</td>
                      <td className="px-3 py-3">{c.data}</td>
                      <td className="px-3 py-3 font-semibold text-white">{fmtBRL(c.valor)}</td>
                      <td className="px-3 py-3">{c.reembolsavel ? <span className="text-emerald-300 text-xs font-semibold">Sim</span> : <span className="text-slate-500 text-xs">Não</span>}</td>
                      <td className="px-3 py-3"><StatusPill value={c.status} /></td>
                      <td className="rounded-r-2xl px-3 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => setViewItem(c)} title="Visualizar" className="rounded-xl bg-white/5 p-1.5 text-slate-400 hover:bg-blue-500/20 hover:text-blue-300"><Eye size={13} /></button>
                          <button onClick={() => startEditCusta(c)} title="Editar" className="rounded-xl bg-white/5 p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><Pencil size={13} /></button>
                          {c.status === "Lançada" && <button onClick={() => updateCustaStatus(c.id, "Paga")} title="Marcar paga" className="rounded-xl bg-emerald-500/15 px-2 py-1.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/25">Pagar</button>}
                          {c.reembolsavel && c.status === "Paga" && <button onClick={() => updateCustaStatus(c.id, "Reembolsada")} className="rounded-xl bg-purple-500/15 px-2 py-1.5 text-[10px] font-medium text-purple-300 hover:bg-purple-500/25">Reemb.</button>}
                          <button onClick={() => deleteCusta(c.id)} title="Excluir" className="rounded-xl bg-white/5 p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-300"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === "depositos" && (
          depositos.length === 0 ? <EmptyBlock title="Nenhum depósito registrado" description="Use 'Novo Depósito' para registrar depósitos judiciais." /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead><tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  <th className="px-3 py-2">Processo</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Referência</th>
                  <th className="px-3 py-2">Valor</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Ações</th>
                </tr></thead>
                <tbody>
                  {depositos.map(d => (
                    <tr key={d.id} className="rounded-2xl bg-white/[0.03] text-sm text-slate-200 ring-1 ring-white/5">
                      <td className="rounded-l-2xl px-3 py-3 text-xs text-blue-300 font-mono">{d.processo.slice(0,18)}</td>
                      <td className="px-3 py-3">{d.data}</td>
                      <td className="px-3 py-3 text-xs text-slate-400 font-mono">{d.bankRef}</td>
                      <td className="px-3 py-3 font-semibold text-white">{fmtBRL(d.valor)}</td>
                      <td className="px-3 py-3"><StatusPill value={d.status} /></td>
                      <td className="rounded-r-2xl px-3 py-3">
                        <div className="flex gap-1.5">
                          {d.status === "Ativo" && <button onClick={() => marcarLevantado(d.id)} className="rounded-xl bg-purple-500/15 px-2 py-1.5 text-[10px] font-medium text-purple-300 hover:bg-purple-500/25">Levantar</button>}
                          <button onClick={() => setDepositos(prev => prev.filter(x => x.id !== d.id))} className="rounded-xl bg-white/5 p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-300"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === "alvaras" && (
          alvaras.length === 0 ? <EmptyBlock title="Nenhum alvará registrado" description="Use 'Novo Alvará' para registrar alvarás judiciais." /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead><tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  <th className="px-3 py-2">Processo</th><th className="px-3 py-2">Emissão</th><th className="px-3 py-2">Levantamento</th>
                  <th className="px-3 py-2">Beneficiário</th><th className="px-3 py-2">Valor</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Ações</th>
                </tr></thead>
                <tbody>
                  {alvaras.map(a => (
                    <tr key={a.id} className="rounded-2xl bg-white/[0.03] text-sm text-slate-200 ring-1 ring-white/5">
                      <td className="rounded-l-2xl px-3 py-3 text-xs text-blue-300 font-mono">{a.processo.slice(0,18)}</td>
                      <td className="px-3 py-3">{a.emissao}</td>
                      <td className="px-3 py-3 text-slate-400">{a.levantamento}</td>
                      <td className="px-3 py-3 font-medium">{a.beneficiario}</td>
                      <td className="px-3 py-3 font-semibold text-white">{fmtBRL(a.valor)}</td>
                      <td className="px-3 py-3"><StatusPill value={a.status} /></td>
                      <td className="rounded-r-2xl px-3 py-3">
                        <div className="flex gap-1.5">
                          {a.status === "Expedido" && <button onClick={() => marcarAlvaraLevantado(a.id)} className="rounded-xl bg-purple-500/15 px-2.5 py-1.5 text-[10px] font-medium text-purple-300 hover:bg-purple-500/25">Marcar levantamento</button>}
                          <button onClick={() => setAlvaras(prev => prev.filter(x => x.id !== a.id))} className="rounded-xl bg-white/5 p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-300"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </Card>

      {/* View Item Drawer */}
      <DetailDrawer open={!!viewItem} onClose={() => setViewItem(null)} title="Detalhes do Lançamento">
        {viewItem && (
          <div className="space-y-3">
            {Object.entries(viewItem).filter(([k]) => k !== "id").map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-xs uppercase tracking-widest text-slate-400">{k}</span>
                <span className="text-sm font-medium text-white">{typeof v === "boolean" ? (v ? "Sim" : "Não") : typeof v === "number" ? fmtBRL(v) : String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </DetailDrawer>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2 — REPASSES E SÓCIOS
// ═══════════════════════════════════════════════════════════════════════════════

type Repasse = { id: string; base: string; parceiro: string; funcao: string; percentual: number; valor: number; competencia: string; status: "Pendente"|"Provisionado"|"Pago" };

const FUNCOES = ["Sócio titular","Advogado responsável","Correspondente","Consultor","Associado"];

export function RepassesSociosPage() {
  const [repasses, setRepasses] = useState<Repasse[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Repasse | null>(null);
  const [viewDetail, setViewDetail] = useState<Repasse | null>(null);
  const [toast, setToast] = useState("");
  const blankR = { base: "", parceiro: "", funcao: "Sócio titular", percentual: "", valor: "", competencia: "" };
  const [fr, setFr] = useState(blankR);
  const updR = (k: keyof typeof blankR) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => setFr(p => ({ ...p, [k]: e.target.value }));

  function submitRepasse() {
    if (!fr.base || !fr.parceiro || !fr.valor) return;
    const item: Repasse = { id: uid(), base: fr.base, parceiro: fr.parceiro, funcao: fr.funcao, percentual: Number(fr.percentual), valor: Number(fr.valor), competencia: fr.competencia || now().slice(3), status: "Provisionado" };
    if (editItem) setRepasses(prev => prev.map(r => r.id === editItem.id ? { ...item, id: editItem.id } : r));
    else setRepasses(prev => [item, ...prev]);
    setFr(blankR); setEditItem(null); setShowForm(false);
    setToast(editItem ? "Repasse atualizado!" : "Repasse gerado com sucesso!");
  }

  function marcarPago(id: string) { setRepasses(prev => prev.map(r => r.id === id ? { ...r, status: "Pago" } : r)); setToast("Repasse marcado como pago!"); }

  const totalProv = repasses.filter(r => r.status === "Provisionado").reduce((s, r) => s + r.valor, 0);
  const totalPago = repasses.filter(r => r.status === "Pago").reduce((s, r) => s + r.valor, 0);
  const totalPend = repasses.filter(r => r.status === "Pendente").reduce((s, r) => s + r.valor, 0);

  return (
    <PageShell title="Repasses e Sócios" subtitle="Distribuição automatizada de honorários entre participantes." icon={<Banknote size={22} />}
      actions={
        <div className="flex gap-2">
          <Btn onClick={() => { setEditItem(null); setFr(blankR); setShowForm(true); }} icon={<Plus size={14} />}>Gerar Repasse</Btn>
          <Btn variant="secondary" onClick={() => setToast("Relatório de repasses exportado!")} icon={<Download size={14} />}>Exportar</Btn>
        </div>
      }>
      {toast && <Toast msg={toast} onClose={() => setToast("")} />}

      <SideDrawer open={showForm} onClose={() => { setShowForm(false); setEditItem(null); }} title={editItem ? "Editar Repasse" : "Gerar Repasse"}>
        <div className="space-y-4">
          <FF label="Receita base *"><input placeholder="Descrição da receita" value={fr.base} onChange={updR("base")} className={ic} /></FF>
          <FF label="Participante *"><input placeholder="Nome do parceiro" value={fr.parceiro} onChange={updR("parceiro")} className={ic} /></FF>
          <FF label="Função"><select value={fr.funcao} onChange={updR("funcao")} className={ic}>{FUNCOES.map(f => <option key={f}>{f}</option>)}</select></FF>
          <div className="grid grid-cols-2 gap-3">
            <FF label="% participação"><input type="number" min="0" max="100" value={fr.percentual} onChange={updR("percentual")} className={ic} /></FF>
            <FF label="Valor (R$) *"><input type="number" min="0" value={fr.valor} onChange={updR("valor")} className={ic} /></FF>
          </div>
          <FF label="Competência"><input placeholder="Mês/Ano (ex: 03/2025)" value={fr.competencia} onChange={updR("competencia")} className={ic} /></FF>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowForm(false); setEditItem(null); }} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Cancelar</button>
            <button onClick={submitRepasse} className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110">Salvar</button>
          </div>
        </div>
      </SideDrawer>

      <DetailDrawer open={!!viewDetail} onClose={() => setViewDetail(null)} title="Detalhe do Repasse">
        {viewDetail && (
          <div className="space-y-3">
            {[["Receita base", viewDetail.base],["Participante", viewDetail.parceiro],["Função", viewDetail.funcao],["%", `${viewDetail.percentual}%`],["Valor", fmtBRL(viewDetail.valor)],["Competência", viewDetail.competencia],["Status", viewDetail.status]].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-xs uppercase tracking-widest text-slate-400">{k}</span>
                <span className="text-sm font-medium text-white">{v}</span>
              </div>
            ))}
          </div>
        )}
      </DetailDrawer>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPI label="Provisionado"  value={fmtBRL(totalProv)} tone="blue" />
        <KPI label="Pago"          value={fmtBRL(totalPago)} tone="green" />
        <KPI label="Pendente"      value={fmtBRL(totalPend)} tone="amber" />
        <KPI label="Participantes" value={String(new Set(repasses.map(r => r.parceiro)).size)} tone="purple" />
      </div>

      <Card title="Tabela de repasses" subtitle="Repasses calculados por receita base">
        {repasses.length === 0 ? <EmptyBlock title="Nenhum repasse gerado" description="Use 'Gerar Repasse' para calcular e distribuir honorários." /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead><tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-400">
                <th className="px-3 py-2">Receita base</th><th className="px-3 py-2">Participante</th><th className="px-3 py-2">Função</th>
                <th className="px-3 py-2">%</th><th className="px-3 py-2">Valor</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Ações</th>
              </tr></thead>
              <tbody>
                {repasses.map(r => (
                  <tr key={r.id} className="rounded-2xl bg-white/[0.03] text-sm text-slate-200 ring-1 ring-white/5">
                    <td className="rounded-l-2xl px-3 py-3 text-slate-300 max-w-[180px] truncate">{r.base}</td>
                    <td className="px-3 py-3 font-medium">{r.parceiro}</td>
                    <td className="px-3 py-3 text-slate-300">{r.funcao}</td>
                    <td className="px-3 py-3">{r.percentual > 0 ? `${r.percentual}%` : "—"}</td>
                    <td className="px-3 py-3 font-semibold text-white">{fmtBRL(r.valor)}</td>
                    <td className="px-3 py-3"><StatusPill value={r.status} /></td>
                    <td className="rounded-r-2xl px-3 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => setViewDetail(r)} className="rounded-xl bg-white/5 p-1.5 text-slate-400 hover:bg-blue-500/20 hover:text-blue-300"><Eye size={13} /></button>
                        <button onClick={() => { setEditItem(r); setFr({ base: r.base, parceiro: r.parceiro, funcao: r.funcao, percentual: String(r.percentual), valor: String(r.valor), competencia: r.competencia }); setShowForm(true); }} className="rounded-xl bg-white/5 p-1.5 text-slate-400 hover:bg-white/10"><Pencil size={13} /></button>
                        {r.status !== "Pago" && <button onClick={() => marcarPago(r.id)} className="rounded-xl bg-emerald-500/15 px-2 py-1.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/25">Marcar pago</button>}
                        <button onClick={() => { setRepasses(prev => prev.filter(x => x.id !== r.id)); setToast("Repasse excluído."); }} className="rounded-xl bg-white/5 p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-300"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3 — TRIBUTOS E RETENÇÕES
// ═══════════════════════════════════════════════════════════════════════════════

type Tributo = { id: string; competencia: string; cliente: string; tipo: "ISS"|"IRRF"|"CSLL"|"PIS"|"COFINS"; base: number; aliquota: number; valor: number; status: "Calculado"|"Conferido"|"Exportado" };

export function TributosRetencoesPage() {
  const [tributos, setTributos] = useState<Tributo[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [viewItem, setViewItem] = useState<Tributo | null>(null);
  const [filterComp, setFilterComp] = useState("");
  const [toast, setToast] = useState("");
  const blankT = { competencia: "", cliente: "", tipo: "ISS" as Tributo["tipo"], base: "", aliquota: "5" };
  const [ft, setFt] = useState(blankT);
  const updT = (k: keyof typeof blankT) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => setFt(p => ({ ...p, [k]: e.target.value }));

  function submitTributo() {
    if (!ft.competencia || !ft.cliente || !ft.base) return;
    const base = Number(ft.base), aliq = Number(ft.aliquota);
    setTributos(prev => [{ id: uid(), competencia: ft.competencia, cliente: ft.cliente, tipo: ft.tipo, base, aliquota: aliq, valor: base * aliq / 100, status: "Calculado" }, ...prev]);
    setFt(blankT); setShowForm(false); setToast("Tributo calculado e lançado!");
  }

  function conferir(id: string) { setTributos(prev => prev.map(t => t.id === id ? { ...t, status: "Conferido" } : t)); setToast("Tributo marcado como conferido!"); }
  function exportar(id: string) { setTributos(prev => prev.map(t => t.id === id ? { ...t, status: "Exportado" } : t)); setToast("Tributo exportado para contabilidade!"); }

  const filtered = filterComp ? tributos.filter(t => t.competencia.includes(filterComp)) : tributos;
  const comps = [...new Set(tributos.map(t => t.competencia))];

  return (
    <PageShell title="Tributos e Retenções" subtitle="Acompanhamento fiscal e retenções vinculadas às receitas." icon={<Calculator size={22} />}
      actions={
        <div className="flex gap-2">
          <Btn onClick={() => setShowForm(true)} icon={<Plus size={14} />}>Calcular Tributos</Btn>
          <Btn variant="secondary" onClick={() => { filtered.forEach(t => exportar(t.id)); setToast("Mapa exportado com sucesso!"); }} icon={<Download size={14} />}>Exportar Mapa</Btn>
        </div>
      }>
      {toast && <Toast msg={toast} onClose={() => setToast("")} />}

      <SideDrawer open={showForm} onClose={() => setShowForm(false)} title="Calcular Tributos">
        <div className="space-y-4">
          <FF label="Competência *"><input placeholder="MM/AAAA (ex: 03/2025)" value={ft.competencia} onChange={updT("competencia")} className={ic} /></FF>
          <FF label="Cliente *"><input placeholder="Nome do cliente" value={ft.cliente} onChange={updT("cliente")} className={ic} /></FF>
          <FF label="Tipo de tributo"><select value={ft.tipo} onChange={updT("tipo")} className={ic}>{(["ISS","IRRF","CSLL","PIS","COFINS"] as const).map(t => <option key={t}>{t}</option>)}</select></FF>
          <div className="grid grid-cols-2 gap-3">
            <FF label="Base de cálculo (R$) *"><input type="number" min="0" value={ft.base} onChange={updT("base")} className={ic} /></FF>
            <FF label="Alíquota (%)"><input type="number" min="0" max="100" step="0.5" value={ft.aliquota} onChange={updT("aliquota")} className={ic} /></FF>
          </div>
          {ft.base && ft.aliquota && (
            <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3">
              <div className="text-xs text-slate-400">Valor calculado</div>
              <div className="text-lg font-bold text-blue-300">{fmtBRL(Number(ft.base) * Number(ft.aliquota) / 100)}</div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowForm(false)} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Cancelar</button>
            <button onClick={submitTributo} className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110">Calcular e Lançar</button>
          </div>
        </div>
      </SideDrawer>

      <DetailDrawer open={!!viewItem} onClose={() => setViewItem(null)} title="Detalhe do Tributo">
        {viewItem && (
          <div className="space-y-3">
            {[["Competência", viewItem.competencia],["Cliente", viewItem.cliente],["Tipo", viewItem.tipo],["Base de cálculo", fmtBRL(viewItem.base)],["Alíquota", `${viewItem.aliquota}%`],["Valor do tributo", fmtBRL(viewItem.valor)],["Status", viewItem.status]].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-xs uppercase tracking-widest text-slate-400">{k}</span>
                <span className="text-sm font-medium text-white">{v}</span>
              </div>
            ))}
          </div>
        )}
      </DetailDrawer>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPI label="ISS apurado"    value={fmtBRL(tributos.filter(t=>t.tipo==="ISS").reduce((s,t)=>s+t.valor,0))} tone="green" />
        <KPI label="IRRF apurado"   value={fmtBRL(tributos.filter(t=>t.tipo==="IRRF").reduce((s,t)=>s+t.valor,0))} tone="blue" />
        <KPI label="Outros tributos" value={fmtBRL(tributos.filter(t=>!["ISS","IRRF"].includes(t.tipo)).reduce((s,t)=>s+t.valor,0))} tone="purple" />
        <KPI label="Competências"   value={String(comps.length)} tone="amber" />
      </div>

      <Card title="Mapa de retenções" subtitle="Tributos calculados por cliente e competência"
        rightAction={comps.length > 0 ? (
          <select value={filterComp} onChange={e => setFilterComp(e.target.value)} className="appearance-none rounded-2xl border border-white/10 bg-[#0c1a31] px-4 py-2 text-xs text-slate-300 outline-none">
            <option value="">Todas as competências</option>
            {comps.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : undefined}>
        {filtered.length === 0 ? <EmptyBlock title="Nenhum tributo lançado" description="Use 'Calcular Tributos' para lançar ISS, IRRF ou outras retenções." /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead><tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-400">
                <th className="px-3 py-2">Competência</th><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Base</th><th className="px-3 py-2">Alíquota</th><th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Status</th><th className="px-3 py-2">Ações</th>
              </tr></thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="rounded-2xl bg-white/[0.03] text-sm text-slate-200 ring-1 ring-white/5">
                    <td className="rounded-l-2xl px-3 py-3">{t.competencia}</td>
                    <td className="px-3 py-3 font-medium">{t.cliente}</td>
                    <td className="px-3 py-3"><span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs text-blue-300">{t.tipo}</span></td>
                    <td className="px-3 py-3 font-semibold text-white">{fmtBRL(t.base)}</td>
                    <td className="px-3 py-3">{t.aliquota}%</td>
                    <td className="px-3 py-3 font-semibold text-emerald-300">{fmtBRL(t.valor)}</td>
                    <td className="px-3 py-3"><StatusPill value={t.status} /></td>
                    <td className="rounded-r-2xl px-3 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => setViewItem(t)} className="rounded-xl bg-white/5 p-1.5 text-slate-400 hover:bg-blue-500/20 hover:text-blue-300"><Eye size={13} /></button>
                        {t.status === "Calculado" && <button onClick={() => conferir(t.id)} className="rounded-xl bg-amber-500/15 px-2 py-1.5 text-[10px] font-medium text-amber-300 hover:bg-amber-500/25">Conferir</button>}
                        {t.status === "Conferido" && <button onClick={() => exportar(t.id)} className="rounded-xl bg-emerald-500/15 px-2 py-1.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/25">Exportar</button>}
                        <button onClick={() => { setTributos(prev => prev.filter(x => x.id !== t.id)); setToast("Tributo excluído."); }} className="rounded-xl bg-white/5 p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-300"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4 — CONCILIAÇÃO BANCÁRIA
// ═══════════════════════════════════════════════════════════════════════════════

type Movimento = { id: string; data: string; descricao: string; valor: number; tipo: "Crédito"|"Débito"; status: "Não conciliado"|"Conciliado"|"Ignorado" };

export function ConciliacaoBancariaPage() {
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [showImport, setShowImport] = useState(false);
  const [viewMov, setViewMov] = useState<Movimento | null>(null);
  const [toast, setToast] = useState("");
  const blankM = { data: "", descricao: "", valor: "", tipo: "Crédito" as "Crédito"|"Débito" };
  const [fm, setFm] = useState(blankM);
  const updM = (k: keyof typeof blankM) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => setFm(p => ({ ...p, [k]: e.target.value }));

  function submitMovimento() {
    if (!fm.data || !fm.descricao || !fm.valor) return;
    setMovimentos(prev => [{ id: uid(), data: fm.data, descricao: fm.descricao, valor: Number(fm.valor), tipo: fm.tipo, status: "Não conciliado" }, ...prev]);
    setFm(blankM);
  }

  function importarAmostra() {
    const amostras: Movimento[] = [
      { id: uid(), data: now(), descricao: "TED recebida — Cliente", valor: 5000, tipo: "Crédito", status: "Não conciliado" },
      { id: uid(), data: now(), descricao: "Débito — Software Jurídico", valor: 890, tipo: "Débito", status: "Não conciliado" },
      { id: uid(), data: now(), descricao: "PIX recebido", valor: 3200, tipo: "Crédito", status: "Não conciliado" },
      { id: uid(), data: now(), descricao: "Tarifa bancária", valor: 210, tipo: "Débito", status: "Não conciliado" },
    ];
    setMovimentos(prev => [...amostras, ...prev]);
    setShowImport(false);
    setToast("4 movimentos importados com sucesso!");
  }

  function conciliarSelecionados() {
    setMovimentos(prev => prev.map(m => selected.has(m.id) ? { ...m, status: "Conciliado" } : m));
    setToast(`${selected.size} movimento(s) conciliado(s) com sucesso!`);
    setSelected(new Set());
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function marcarIgnorado(id: string) { setMovimentos(prev => prev.map(m => m.id === id ? { ...m, status: "Ignorado" } : m)); setToast("Movimento marcado como ignorado."); }

  const filtered = filterStatus === "Todos" ? movimentos : movimentos.filter(m => m.status === filterStatus);
  const naoConc = movimentos.filter(m => m.status === "Não conciliado").length;
  const conc = movimentos.filter(m => m.status === "Conciliado").length;

  return (
    <PageShell title="Conciliação Bancária" subtitle="Conferência entre extratos e lançamentos financeiros internos." icon={<CreditCard size={22} />}
      actions={
        <div className="flex gap-2">
          <Btn onClick={() => setShowImport(true)} icon={<Upload size={14} />}>Importar Extrato</Btn>
          {selected.size > 0 && <Btn onClick={conciliarSelecionados} variant="secondary" icon={<CheckCircle2 size={14} />}>Conciliar selecionados ({selected.size})</Btn>}
        </div>
      }>
      {toast && <Toast msg={toast} onClose={() => setToast("")} />}

      {/* Import modal */}
      <SideDrawer open={showImport} onClose={() => setShowImport(false)} title="Importar Extrato Bancário">
        <div className="space-y-5">
          <div className="rounded-2xl border-2 border-dashed border-white/10 p-8 text-center">
            <Upload size={32} className="mx-auto mb-3 text-slate-500" />
            <p className="text-sm text-slate-300 font-medium">Arraste o arquivo OFX/CSV aqui</p>
            <p className="text-xs text-slate-500 mt-1">ou use a importação de amostra abaixo</p>
            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10">
              <Upload size={14} /> Selecionar arquivo
              <input type="file" accept=".ofx,.csv" className="hidden" />
            </label>
          </div>
          <div className="text-center text-xs text-slate-500">— ou —</div>
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Adicionar manualmente</div>
            <div className="grid grid-cols-2 gap-3">
              <FF label="Data"><input type="date" value={fm.data} onChange={updM("data")} className={ic} /></FF>
              <FF label="Tipo"><select value={fm.tipo} onChange={updM("tipo")} className={ic}><option>Crédito</option><option>Débito</option></select></FF>
            </div>
            <FF label="Descrição"><input placeholder="Descrição do movimento" value={fm.descricao} onChange={updM("descricao")} className={ic} /></FF>
            <FF label="Valor (R$)"><input type="number" min="0" value={fm.valor} onChange={updM("valor")} className={ic} /></FF>
            <button onClick={submitMovimento} className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/10">Adicionar movimento</button>
          </div>
          <div className="pt-2 border-t border-white/10">
            <button onClick={importarAmostra} className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110">Importar amostra (4 movimentos)</button>
          </div>
        </div>
      </SideDrawer>

      <DetailDrawer open={!!viewMov} onClose={() => setViewMov(null)} title="Detalhe do Movimento">
        {viewMov && (
          <div className="space-y-3">
            {[["Data", viewMov.data],["Descrição", viewMov.descricao],["Tipo", viewMov.tipo],["Valor", fmtBRL(viewMov.valor)],["Status", viewMov.status]].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-xs uppercase tracking-widest text-slate-400">{k}</span>
                <span className="text-sm font-medium text-white">{v}</span>
              </div>
            ))}
          </div>
        )}
      </DetailDrawer>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPI label="Movimentos importados" value={String(movimentos.length)} tone="blue" />
        <KPI label="Conciliados"           value={String(conc)}             tone="green" />
        <KPI label="Não conciliados"       value={String(naoConc)}          tone="amber" />
        <KPI label="Ignorados"             value={String(movimentos.filter(m=>m.status==="Ignorado").length)} tone="red" />
      </div>

      <Card title="Extrato importado" subtitle="Movimentações e status de conciliação"
        rightAction={
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="appearance-none rounded-2xl border border-white/10 bg-[#0c1a31] px-4 py-2 text-xs text-slate-300 outline-none">
            {["Todos","Não conciliado","Conciliado","Ignorado"].map(s => <option key={s}>{s}</option>)}
          </select>
        }>
        {filtered.length === 0 ? <EmptyBlock title="Nenhum movimento importado" description="Use 'Importar Extrato' para carregar movimentos bancários." /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead><tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-400">
                <th className="px-3 py-2 w-8"></th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Valor</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Ações</th>
              </tr></thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id} className={cx("rounded-2xl text-sm text-slate-200 ring-1 ring-white/5", selected.has(m.id) ? "bg-blue-500/10" : "bg-white/[0.03]")}>
                    <td className="rounded-l-2xl px-3 py-3">
                      {m.status === "Não conciliado" && (
                        <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)} className="rounded accent-blue-500" />
                      )}
                    </td>
                    <td className="px-3 py-3">{m.data}</td>
                    <td className="px-3 py-3 font-medium max-w-[200px] truncate">{m.descricao}</td>
                    <td className="px-3 py-3"><span className={m.tipo === "Crédito" ? "text-emerald-300 font-medium" : "text-red-300 font-medium"}>{m.tipo}</span></td>
                    <td className="px-3 py-3"><span className={cx("font-semibold", m.tipo === "Crédito" ? "text-emerald-300" : "text-red-300")}>{m.tipo === "Crédito" ? "+" : "-"} {fmtBRL(m.valor)}</span></td>
                    <td className="px-3 py-3"><StatusPill value={m.status} /></td>
                    <td className="rounded-r-2xl px-3 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => setViewMov(m)} className="rounded-xl bg-white/5 p-1.5 text-slate-400 hover:bg-blue-500/20 hover:text-blue-300"><Eye size={13} /></button>
                        {m.status === "Não conciliado" && <button onClick={() => { setMovimentos(prev => prev.map(x => x.id === m.id ? { ...x, status: "Conciliado" } : x)); setToast("Movimento conciliado!"); }} className="rounded-xl bg-emerald-500/15 px-2 py-1.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/25">Conciliar</button>}
                        {m.status === "Não conciliado" && <button onClick={() => marcarIgnorado(m.id)} className="rounded-xl bg-white/5 px-2 py-1.5 text-[10px] font-medium text-slate-400 hover:bg-slate-500/25">Ignorar</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5 — RELATÓRIOS GERENCIAIS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Tipos locais para leitura do localStorage ───────────────────────────────
type LSReceivable = { id: string; cliente: string; processo: string; contrato: string; vencimento: string; valor: number; status: string };
type LSPayable    = { id: string; fornecedor: string; categoria: string; processo?: string; vencimento: string; valor: number; status: string };
type LSCliente    = { id: string; nome: string; cnpjCpf: string; tipo: string; status?: string };
type LSProcesso   = { id: string; numero: string; cliente: string; area: string; responsavel: string; valorCausa: number; receitaTotal: number; despesaTotal: number; margem: number; status: string };

function readLS<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; }
  catch { return fallback; }
}

type ReportState = "idle" | "generating" | "ready";
type ReportData  = { headers: string[]; rows: string[][] };

const REPORT_TEMPLATES = [
  { key: "receber",       title: "Contas a Receber",      desc: "Cobranças ativas, vencidas e liquidadas com filtro por cliente.", formato: "PDF + Excel" },
  { key: "pagar",         title: "Contas a Pagar",         desc: "Agenda de pagamentos, fornecedores e obrigações do período.",   formato: "PDF + Excel" },
  { key: "fluxo",         title: "Fluxo de Caixa",         desc: "Projeção mensal de entradas, saídas e saldo líquido.",           formato: "PDF + Excel" },
  { key: "dre",           title: "DRE Gerencial",          desc: "Demonstração de resultado consolidado por área de atuação.",    formato: "PDF" },
  { key: "inadimplencia", title: "Inadimplência",          desc: "Recebíveis vencidos, aging list e score de risco por cliente.", formato: "PDF + Excel" },
  { key: "rentabilidade", title: "Rentabilidade / Cliente",desc: "Margem, receita, custas e resultado líquido por cliente.",      formato: "PDF" },
  { key: "processos",     title: "Processos",              desc: "Sumário financeiro de todos os processos cadastrados.",         formato: "PDF + Excel" },
  { key: "clientes",      title: "Carteira de Clientes",   desc: "Base de clientes ativos e inativos com dados cadastrais.",      formato: "Excel" },
];

function buildReportData(key: string): ReportData {
  const receivables = readLS<LSReceivable[]>("ctrl_receivables", []);
  const payables    = readLS<LSPayable[]>("ctrl_payables", []);
  const clientes    = readLS<LSCliente[]>("ctrl_clientes", []);
  const processos   = readLS<LSProcesso[]>("ctrl_processos", []);
  const q = (v: unknown) => String(v ?? "—");
  const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  switch (key) {
    case "receber":
      return {
        headers: ["Cliente", "Processo", "Contrato", "Vencimento", "Valor", "Status"],
        rows: receivables.length
          ? receivables.map(r => [q(r.cliente), q(r.processo), q(r.contrato), q(r.vencimento), brl(r.valor), q(r.status)])
          : [["Nenhum recebível cadastrado", "", "", "", "", ""]],
      };
    case "pagar":
      return {
        headers: ["Fornecedor", "Categoria", "Processo", "Vencimento", "Valor", "Status"],
        rows: payables.length
          ? payables.map(p => [q(p.fornecedor), q(p.categoria), q(p.processo), q(p.vencimento), brl(p.valor), q(p.status)])
          : [["Nenhuma despesa cadastrada", "", "", "", "", ""]],
      };
    case "fluxo": {
      const today = new Date();
      const monthRows: string[][] = [];
      let accum = 0;
      for (let i = -3; i <= 8; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        const e = receivables.filter(r => (r.vencimento ?? "").startsWith(mk)).reduce((s, r) => s + r.valor, 0);
        const s = payables.filter(p => (p.vencimento ?? "").startsWith(mk)).reduce((s, p) => s + p.valor, 0);
        accum += e - s;
        monthRows.push([label, brl(e), brl(s), brl(e - s), brl(accum)]);
      }
      return { headers: ["Mês", "Entradas", "Saídas", "Líquido", "Saldo Acumulado"], rows: monthRows };
    }
    case "dre": {
      const totalRec  = receivables.reduce((s, r) => s + r.valor, 0);
      const totalPag  = payables.reduce((s, p) => s + p.valor, 0);
      const resultado = totalRec - totalPag;
      const pct = (v: number) => totalRec > 0 ? `${((v / totalRec) * 100).toFixed(1)}%` : "—";
      return {
        headers: ["Categoria", "Valor", "% da Receita"],
        rows: [
          ["Receita Bruta de Honorários", brl(totalRec), "100%"],
          ["(−) Despesas Operacionais Totais", `(${brl(totalPag)})`, pct(totalPag)],
          ["Resultado Operacional", brl(resultado), pct(resultado)],
          ["Recebíveis Liquidados", brl(receivables.filter(r=>r.status==="Liquidado").reduce((s,r)=>s+r.valor,0)), ""],
          ["Despesas Pagas", brl(payables.filter(p=>p.status==="Pago").reduce((s,p)=>s+p.valor,0)), ""],
        ],
      };
    }
    case "inadimplencia": {
      const today = new Date();
      const vencidos = receivables.filter(r => r.status === "Vencido");
      return {
        headers: ["Cliente", "Processo", "Vencimento", "Valor", "Dias em Atraso", "Risco"],
        rows: vencidos.length
          ? vencidos.map(r => {
              const venc = new Date(r.vencimento);
              const dias = isNaN(venc.getTime()) ? "—" : String(Math.max(0, Math.floor((today.getTime() - venc.getTime()) / 86400000)));
              const risco = typeof dias === "string" ? "—" : Number(dias) > 60 ? "Alto" : Number(dias) > 30 ? "Médio" : "Baixo";
              return [q(r.cliente), q(r.processo), q(r.vencimento), brl(r.valor), String(dias), risco];
            })
          : [["Nenhum recebível vencido", "", "", "", "", ""]],
      };
    }
    case "rentabilidade": {
      const clienteMap: Record<string, { rec: number; desp: number }> = {};
      receivables.forEach(r => {
        if (!clienteMap[r.cliente]) clienteMap[r.cliente] = { rec: 0, desp: 0 };
        clienteMap[r.cliente].rec += r.valor;
      });
      payables.forEach(p => {
        const cli = receivables.find(r => r.processo && r.processo === p.processo)?.cliente;
        if (cli && clienteMap[cli]) clienteMap[cli].desp += p.valor;
      });
      const rows = Object.entries(clienteMap).map(([cli, { rec, desp }]) => {
        const resultado = rec - desp;
        return [cli, brl(rec), brl(desp), brl(resultado), rec > 0 ? `${((resultado / rec) * 100).toFixed(1)}%` : "—"];
      });
      return {
        headers: ["Cliente", "Receita Total", "Despesas", "Resultado", "Margem"],
        rows: rows.length ? rows : [["Nenhum dado de receita cadastrado", "", "", "", ""]],
      };
    }
    case "processos":
      return {
        headers: ["Número", "Cliente", "Área", "Responsável", "Valor da Causa", "Receita Total", "Despesas", "Margem", "Status"],
        rows: processos.length
          ? processos.map(p => [q(p.numero), q(p.cliente), q(p.area), q(p.responsavel), brl(p.valorCausa), brl(p.receitaTotal), brl(p.despesaTotal), `${p.margem.toFixed(1)}%`, q(p.status)])
          : [["Nenhum processo cadastrado", "", "", "", "", "", "", "", ""]],
      };
    case "clientes":
      return {
        headers: ["Nome", "CNPJ / CPF", "Tipo", "Status"],
        rows: clientes.length
          ? clientes.map(c => [q(c.nome), q(c.cnpjCpf), q(c.tipo), q(c.status)])
          : [["Nenhum cliente cadastrado", "", "", ""]],
      };
    default:
      return { headers: ["Info"], rows: [["Relatório sem dados disponíveis."]] };
  }
}

export function RelatoriosGerenciaisPage() {
  const now2 = new Date();
  const defaultPeriodo = now2.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "");
  const [periodo, setPeriodo] = useState(defaultPeriodo);
  const [states, setStates]   = useState<Record<string, ReportState>>({});
  const [data, setData]       = useState<Record<string, ReportData>>({});
  const [preview, setPreview] = useState<typeof REPORT_TEMPLATES[0] | null>(null);
  const [toast, setToast]     = useState("");

  function gerarRelatorio(key: string) {
    setStates(p => ({ ...p, [key]: "generating" }));
    setTimeout(() => {
      const built = buildReportData(key);
      setData(p => ({ ...p, [key]: built }));
      setStates(p => ({ ...p, [key]: "ready" }));
      setToast("Relatório gerado com sucesso!");
    }, 900);
  }

  function exportarCSV(key: string) {
    const d = data[key];
    const tmpl = REPORT_TEMPLATES.find(r => r.key === key);
    if (!d) return;
    const bom = "\uFEFF";
    const lines = [d.headers.join(";"), ...d.rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(";"))];
    const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${tmpl?.title ?? key}.csv`; a.click();
    URL.revokeObjectURL(url);
    setToast("Download do CSV iniciado!");
  }

  function exportarPDF(key: string) {
    const d = data[key];
    const tmpl = REPORT_TEMPLATES.find(r => r.key === key);
    if (!d || !tmpl) return;
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${tmpl.title}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:32px;color:#111}
    .header{border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:20px}
    h1{font-size:18px;color:#1e3a5f;font-weight:700}
    .meta{font-size:12px;color:#555;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:11px}
    th{background:#1e3a5f;color:#fff;padding:8px 10px;text-align:left;white-space:nowrap}
    td{padding:7px 10px;border-bottom:1px solid #eee;vertical-align:top}
    tr:nth-child(even) td{background:#f8f9fb}
    .footer{margin-top:24px;font-size:10px;color:#999;border-top:1px solid #ddd;padding-top:8px}
    </style></head><body>
    <div class="header"><h1>${tmpl.title}</h1>
    <div class="meta">Período: ${periodo} &nbsp;|&nbsp; Veritas Analytics &nbsp;|&nbsp; Emissão: ${new Date().toLocaleDateString("pt-BR")}</div></div>
    <table><thead><tr>${d.headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${d.rows.map(r => `<tr>${r.map(v => `<td>${v}</td>`).join("")}</tr>`).join("")}</tbody></table>
    <div class="footer">Documento gerado pela Veritas Analytics — Plataforma de Cálculos Judiciais Federais</div>
    </body></html>`;
    const win = window.open("", "_blank", "width=900,height=700");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
    setToast("Janela de impressão/PDF aberta!");
  }

  const previewData = preview ? data[preview.key] : null;

  return (
    <PageShell title="Relatórios Gerenciais" subtitle="Relatórios executivos gerados a partir dos dados reais da Controladoria." icon={<FileBarChart2 size={22} />}
      actions={
        <div className="flex items-center gap-2">
          <input value={periodo} onChange={e => setPeriodo(e.target.value)} placeholder="Período" className="rounded-2xl border border-white/10 bg-[#0c1a31] px-4 py-2 text-sm text-white outline-none focus:border-blue-400/50 w-36" />
          <Btn variant="secondary" onClick={() => REPORT_TEMPLATES.forEach(r => gerarRelatorio(r.key))} icon={<RefreshCw size={14} />}>Gerar Todos</Btn>
        </div>
      }>
      {toast && <Toast msg={toast} onClose={() => setToast("")} />}

      {/* ── Preview drawer ── */}
      <DetailDrawer open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ""}>
        {preview && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-slate-300">{preview.desc}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs text-blue-300">{preview.formato}</span>
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300">{periodo}</span>
              </div>
            </div>
            {previewData ? (
              <div className="overflow-auto rounded-2xl border border-white/10">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      {previewData.headers.map((h, i) => (
                        <th key={i} className="px-3 py-2.5 text-left font-semibold text-slate-300 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-white/5 hover:bg-white/[0.03]">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2 text-slate-300">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
                <FileBarChart2 size={28} className="mx-auto mb-3 text-slate-500" />
                <p className="text-sm text-slate-400">Clique em "Gerar" no card do relatório primeiro.</p>
              </div>
            )}
            <div className="flex gap-3">
              {preview.formato.includes("PDF") && (
                <button onClick={() => { exportarPDF(preview.key); }} className="flex-1 rounded-2xl bg-red-500/15 py-3 text-sm font-semibold text-red-300 border border-red-500/25 hover:bg-red-500/25">
                  Imprimir / PDF
                </button>
              )}
              {preview.formato.includes("Excel") && (
                <button onClick={() => { exportarCSV(preview.key); }} className="flex-1 rounded-2xl bg-emerald-500/15 py-3 text-sm font-semibold text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/25">
                  Baixar CSV / Excel
                </button>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPI label="Modelos disponíveis" value={String(REPORT_TEMPLATES.length)} tone="blue" />
        <KPI label="Prontos"             value={String(Object.values(states).filter(s => s === "ready").length)} tone="green" />
        <KPI label="Gerando"             value={String(Object.values(states).filter(s => s === "generating").length)} tone="amber" />
        <KPI label="Período ativo"       value={periodo} tone="purple" />
      </div>

      <Card title="Biblioteca de relatórios" subtitle="Gere, visualize e exporte relatórios executivos com dados reais">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {REPORT_TEMPLATES.map(r => {
            const st = states[r.key] ?? "idle";
            return (
              <div key={r.key} className={cx("rounded-2xl border p-4 flex flex-col gap-3 transition-all",
                st === "ready" ? "border-emerald-400/25 bg-emerald-500/5" : "border-white/10 bg-white/[0.03]")}>
                <div className="flex items-start justify-between">
                  <div className="font-semibold text-white text-sm">{r.title}</div>
                  {st === "ready" && <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{r.desc}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] text-blue-300">{r.formato}</span>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">{periodo}</span>
                </div>
                <div className="flex gap-2 mt-auto">
                  {st === "idle" && (
                    <button onClick={() => gerarRelatorio(r.key)} className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 py-2 text-xs font-bold text-white hover:brightness-110">
                      Gerar
                    </button>
                  )}
                  {st === "generating" && (
                    <div className="flex-1 rounded-xl bg-blue-500/15 py-2 text-xs text-center text-blue-300 animate-pulse">Gerando…</div>
                  )}
                  {st === "ready" && (
                    <>
                      <button onClick={() => { setPreview(r); }} className="flex-1 rounded-xl bg-white/5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10">
                        Visualizar
                      </button>
                      {r.formato.includes("PDF") && (
                        <button onClick={() => exportarPDF(r.key)} className="rounded-xl bg-red-500/15 px-2.5 py-2 text-[10px] font-semibold text-red-300 hover:bg-red-500/25" title="Imprimir / PDF">
                          PDF
                        </button>
                      )}
                      {r.formato.includes("Excel") && (
                        <button onClick={() => exportarCSV(r.key)} className="rounded-xl bg-emerald-500/15 px-2.5 py-2 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/25" title="Baixar CSV">
                          CSV
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6 — INTELIGÊNCIA FINANCEIRA
// ═══════════════════════════════════════════════════════════════════════════════

type Insight = { id: string; titulo: string; descricao: string; severidade: "Alta"|"Média"|"Baixa"; categoria: string; data: string };
type InsightFilter = "Todos"|"Alta"|"Média"|"Baixa";

const INSIGHT_LIBRARY: Omit<Insight, "id"|"data">[] = [
  { titulo: "Receitas nulas no período", descricao: "Nenhuma receita foi lançada no sistema. Cadastre honorários e recebíveis para monitorar o faturamento.", severidade: "Alta", categoria: "Receitas" },
  { titulo: "Despesas ainda não registradas", descricao: "Lance as despesas operacionais do período para que o sistema calcule o saldo real e o fluxo de caixa.", severidade: "Alta", categoria: "Despesas" },
  { titulo: "Sistema pronto para uso", descricao: "O módulo de controladoria está zerado e configurado. Comece cadastrando clientes, contratos e lançando honorários.", severidade: "Baixa", categoria: "Sistema" },
  { titulo: "Clientes não cadastrados", descricao: "Nenhum cliente foi adicionado à carteira. Acesse o módulo Clientes e Contratos para estruturar sua base de clientes.", severidade: "Média", categoria: "Clientes" },
  { titulo: "Conciliação bancária pendente", descricao: "Importe os extratos bancários no módulo de Conciliação para cruzar os movimentos com os lançamentos internos.", severidade: "Média", categoria: "Conciliação" },
  { titulo: "Tributos não conferidos", descricao: "Assim que honorários forem lançados, calcule e confira os tributos devidos (ISS, IRRF) antes do prazo de recolhimento.", severidade: "Baixa", categoria: "Tributos" },
];

export function InteligenciaFinanceiraPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<InsightFilter>("Todos");
  const [viewInsight, setViewInsight] = useState<Insight | null>(null);
  const [toast, setToast] = useState("");

  function atualizarInsights() {
    setIsRefreshing(true);
    setTimeout(() => {
      const generated: Insight[] = INSIGHT_LIBRARY.map(ins => ({ ...ins, id: uid(), data: `${now()} ${nowTime()}` }));
      setInsights(generated);
      setIsRefreshing(false);
      setToast(`${generated.length} insights gerados com sucesso!`);
    }, 1500);
  }

  function dismissInsight(id: string) { setInsights(prev => prev.filter(i => i.id !== id)); setToast("Insight descartado."); }

  const filtered = filter === "Todos" ? insights : insights.filter(i => i.severidade === filter);
  const altaCount = insights.filter(i => i.severidade === "Alta").length;
  const mediaCount = insights.filter(i => i.severidade === "Média").length;

  const sevColors: Record<string, string> = {
    Alta: "border-red-500/30 bg-red-500/10",
    Média: "border-amber-500/30 bg-amber-500/10",
    Baixa: "border-blue-500/30 bg-blue-500/10",
  };
  const sevText: Record<string, string> = { Alta: "text-red-200", Média: "text-amber-200", Baixa: "text-blue-200" };

  return (
    <PageShell title="Inteligência Financeira" subtitle="Insights, tendências e riscos financeiros gerados automaticamente." icon={<Sparkles size={22} />}
      actions={
        <div className="flex gap-2">
          <Btn onClick={atualizarInsights} disabled={isRefreshing} icon={isRefreshing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}>
            {isRefreshing ? "Analisando…" : "Atualizar Insights"}
          </Btn>
          <Btn variant="secondary" onClick={() => setToast("Painel exportado com sucesso!")} icon={<Download size={14} />}>Exportar Painel</Btn>
        </div>
      }>
      {toast && <Toast msg={toast} onClose={() => setToast("")} />}

      <DetailDrawer open={!!viewInsight} onClose={() => setViewInsight(null)} title="Detalhe do Insight">
        {viewInsight && (
          <div className="space-y-4">
            <div className={cx("rounded-2xl border p-4", sevColors[viewInsight.severidade])}>
              <div className="flex items-center justify-between mb-2">
                <span className={cx("text-[10px] font-bold uppercase tracking-widest", sevText[viewInsight.severidade])}>{viewInsight.severidade}</span>
                <span className="text-[10px] text-slate-400">{viewInsight.data}</span>
              </div>
              <div className="font-semibold text-white">{viewInsight.titulo}</div>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{viewInsight.descricao}</p>
            <div className="flex gap-3">
              <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs text-blue-300">{viewInsight.categoria}</span>
            </div>
            <button onClick={() => { dismissInsight(viewInsight.id); setViewInsight(null); }} className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Descartar insight</button>
          </div>
        )}
      </DetailDrawer>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPI label="Insights gerados"  value={String(insights.length)} tone="blue" />
        <KPI label="Críticos (Alta)"   value={String(altaCount)}       tone="red" />
        <KPI label="Atenção (Média)"   value={String(mediaCount)}      tone="amber" />
        <KPI label="Informativo"       value={String(insights.filter(i=>i.severidade==="Baixa").length)} tone="green" />
      </div>

      <Card title="Insights automáticos" subtitle="Análises do sistema com base nos dados financeiros cadastrados"
        rightAction={insights.length > 0 ? (
          <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            {(["Todos","Alta","Média","Baixa"] as InsightFilter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={cx("rounded-xl px-3 py-1.5 text-xs font-semibold transition-all", filter === f ? "bg-blue-500/25 text-blue-200" : "text-slate-400 hover:text-white")}>
                {f}
              </button>
            ))}
          </div>
        ) : undefined}>
        {insights.length === 0 ? (
          <div className="py-8 text-center">
            {isRefreshing ? (
              <div className="flex flex-col items-center gap-3">
                <RefreshCw size={32} className="animate-spin text-blue-400" />
                <p className="text-sm text-slate-300 font-medium">Analisando dados financeiros…</p>
                <p className="text-xs text-slate-500">Isso pode levar alguns segundos</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Sparkles size={32} className="text-slate-500" />
                <p className="text-white font-semibold">Nenhum insight gerado ainda</p>
                <p className="text-slate-400 text-sm">Clique em "Atualizar Insights" para analisar o estado financeiro do escritório.</p>
                <button onClick={atualizarInsights} className="mt-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-2.5 text-sm font-bold text-white hover:brightness-110">Gerar insights agora</button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(ins => (
              <div key={ins.id} className={cx("rounded-2xl border p-4", sevColors[ins.severidade])}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-start gap-2">
                    <span className={cx("rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest flex-shrink-0", ins.severidade === "Alta" ? "border-red-500/40 text-red-200" : ins.severidade === "Média" ? "border-amber-500/40 text-amber-200" : "border-blue-500/40 text-blue-200")}>{ins.severidade}</span>
                    <div className="font-semibold text-white text-sm">{ins.titulo}</div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => setViewInsight(ins)} className="rounded-xl bg-white/5 p-1.5 text-slate-400 hover:bg-white/10"><Eye size={13} /></button>
                    <button onClick={() => dismissInsight(ins.id)} className="rounded-xl bg-white/5 p-1.5 text-slate-400 hover:bg-white/10"><X size={13} /></button>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{ins.descricao}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">{ins.categoria}</span>
                  <span className="text-[10px] text-slate-500">{ins.data}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7 — CONFIGURAÇÕES FINANCEIRAS
// ═══════════════════════════════════════════════════════════════════════════════

type AuditEntry = { id: string; acao: string; campo: string; anterior: string; novo: string; data: string };

const DEFAULT_CONFIG = {
  tributacaoISS: "5",
  tributacaoIRRF: "11",
  regimeRepasse: "Automático após liquidação",
  modeloRelatorio: "PDF + Excel",
  moeda: "BRL — Real Brasileiro",
  centrosCusto: ["Administrativo","Previdenciário","Pericial","Trabalhista","Consultivo"],
  categorias: ["Honorários contratuais","Honorários de êxito","Custas processuais","Reembolsáveis","Tributos"],
};

export function ConfiguracoesFinanceirasPage() {
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG });
  const [saved, setSaved] = useState(true);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [editParam, setEditParam] = useState<{ campo: string; valor: string } | null>(null);
  const [toast, setToast] = useState("");

  function updateConfig(campo: string, valor: string) {
    const anterior = (config as Record<string, string>)[campo] ?? "";
    setConfig(prev => ({ ...prev, [campo]: valor }));
    setSaved(false);
    setAuditLog(prev => [{ id: uid(), acao: "Edição de parâmetro", campo, anterior, novo: valor, data: `${now()} ${nowTime()}` }, ...prev]);
  }

  function salvar() {
    setSaved(true);
    setToast("Configurações salvas com sucesso!");
    setEditParam(null);
  }

  function restaurarPadrao() {
    const anterior = JSON.stringify(config);
    setConfig({ ...DEFAULT_CONFIG });
    setSaved(false);
    setAuditLog(prev => [{ id: uid(), acao: "Restaurar padrão", campo: "Configurações gerais", anterior, novo: "Padrão restaurado", data: `${now()} ${nowTime()}` }, ...prev]);
    setToast("Configurações restauradas para o padrão!");
  }

  const paramSimples = [
    { key: "tributacaoISS",    label: "Alíquota ISS padrão (%)" },
    { key: "tributacaoIRRF",   label: "Alíquota IRRF padrão (%)" },
    { key: "regimeRepasse",    label: "Regime de repasse" },
    { key: "modeloRelatorio",  label: "Modelo de exportação" },
    { key: "moeda",            label: "Moeda base" },
  ];

  return (
    <PageShell title="Configurações Financeiras" subtitle="Parâmetros estruturais do módulo de controladoria jurídica." icon={<Settings2 size={22} />}
      actions={
        <div className="flex gap-2">
          <Btn onClick={() => setShowAudit(true)} variant="ghost" icon={<History size={14} />}>Auditoria ({auditLog.length})</Btn>
          <Btn onClick={restaurarPadrao} variant="ghost" icon={<RotateCcw size={14} />}>Restaurar Padrão</Btn>
          <Btn onClick={salvar} disabled={saved} icon={<Save size={14} />}>
            {saved ? "Salvo" : "Salvar Alterações"}
          </Btn>
        </div>
      }>
      {toast && <Toast msg={toast} onClose={() => setToast("")} />}
      {!saved && (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-300 flex-shrink-0" />
          <span className="text-sm text-amber-200">Há alterações não salvas. Clique em "Salvar Alterações" para persistir.</span>
        </div>
      )}

      {/* Audit Drawer */}
      <DetailDrawer open={showAudit} onClose={() => setShowAudit(false)} title="Histórico de Auditoria">
        {auditLog.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <History size={28} className="text-slate-500" />
            <p className="text-sm text-slate-400">Nenhuma alteração registrada ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {auditLog.map(a => (
              <div key={a.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-white">{a.acao}</span>
                  <span className="text-xs text-slate-400">{a.data}</span>
                </div>
                <div className="text-xs text-slate-400">Campo: <span className="text-slate-200">{a.campo}</span></div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-red-500/10 px-3 py-2">
                    <div className="text-slate-500 mb-0.5">Anterior</div>
                    <div className="text-red-300 font-medium truncate">{String(a.anterior).slice(0, 40)}</div>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 px-3 py-2">
                    <div className="text-slate-500 mb-0.5">Novo</div>
                    <div className="text-emerald-300 font-medium truncate">{String(a.novo).slice(0, 40)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DetailDrawer>

      {/* Edit param drawer */}
      <SideDrawer open={!!editParam} onClose={() => setEditParam(null)} title="Editar Parâmetro">
        {editParam && (
          <div className="space-y-4">
            <FF label={editParam.campo}>
              <input value={editParam.valor} onChange={e => setEditParam(p => p ? { ...p, valor: e.target.value } : null)} className={ic} />
            </FF>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditParam(null)} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Cancelar</button>
              <button onClick={() => { if (editParam) { updateConfig(editParam.campo, editParam.valor); setEditParam(null); } }} className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110">Aplicar</button>
            </div>
          </div>
        )}
      </SideDrawer>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Parâmetros simples */}
        <Card title="Parâmetros tributários e gerais" subtitle="Edite os parâmetros estruturais do módulo" icon={<Settings2 size={18} />}>
          <div className="space-y-2">
            {paramSimples.map(p => (
              <div key={p.key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-widest">{p.label}</div>
                  <div className="text-sm font-semibold text-white mt-0.5">{(config as Record<string, string>)[p.key]}</div>
                </div>
                <button onClick={() => setEditParam({ campo: p.key, valor: (config as Record<string, string>)[p.key] })} className="rounded-xl bg-white/5 p-2 text-slate-400 hover:bg-white/10 hover:text-white">
                  <Pencil size={13} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Centros de custo */}
        <Card title="Centros de custo" subtitle="Adicione ou remova centros de custo" icon={<ClipboardList size={18} />}>
          <div className="space-y-2">
            {config.centrosCusto.map((cc, i) => (
              <div key={i} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="text-sm text-slate-200">{cc}</span>
                <button onClick={() => { setConfig(p => ({ ...p, centrosCusto: p.centrosCusto.filter((_, idx) => idx !== i) })); setSaved(false); }} className="rounded-xl p-1.5 text-slate-500 hover:bg-red-500/20 hover:text-red-300">
                  <X size={13} />
                </button>
              </div>
            ))}
            <button onClick={() => { const n = prompt("Novo centro de custo:"); if (n) { setConfig(p => ({ ...p, centrosCusto: [...p.centrosCusto, n] })); setSaved(false); } }} className="w-full rounded-2xl border border-dashed border-white/10 py-2.5 text-xs font-semibold text-slate-400 hover:border-blue-400/30 hover:text-blue-300 flex items-center justify-center gap-1.5">
              <Plus size={12} /> Adicionar centro de custo
            </button>
          </div>
        </Card>

        {/* Categorias */}
        <Card title="Categorias financeiras" subtitle="Classificação de receitas e despesas" icon={<ClipboardList size={18} />}>
          <div className="space-y-2">
            {config.categorias.map((cat, i) => (
              <div key={i} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="text-sm text-slate-200">{cat}</span>
                <button onClick={() => { setConfig(p => ({ ...p, categorias: p.categorias.filter((_, idx) => idx !== i) })); setSaved(false); }} className="rounded-xl p-1.5 text-slate-500 hover:bg-red-500/20 hover:text-red-300">
                  <X size={13} />
                </button>
              </div>
            ))}
            <button onClick={() => { const n = prompt("Nova categoria:"); if (n) { setConfig(p => ({ ...p, categorias: [...p.categorias, n] })); setSaved(false); } }} className="w-full rounded-2xl border border-dashed border-white/10 py-2.5 text-xs font-semibold text-slate-400 hover:border-blue-400/30 hover:text-blue-300 flex items-center justify-center gap-1.5">
              <Plus size={12} /> Adicionar categoria
            </button>
          </div>
        </Card>
      </div>

      <div className="flex justify-end gap-3">
        <Btn variant="ghost" onClick={restaurarPadrao} icon={<RotateCcw size={14} />}>Restaurar Padrão</Btn>
        <Btn onClick={salvar} disabled={saved} icon={<Save size={14} />}>{saved ? "Configurações salvas" : "Salvar Alterações"}</Btn>
      </div>
    </PageShell>
  );
}
