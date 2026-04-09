import React, { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { getAuthHeaders } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Plus, Pencil, Trash2, FileText,
  Users, CalendarClock, Wallet, Download,
  AlertTriangle, Landmark, Loader2, KeyRound, ShieldCheck,
  Upload, UserCheck, RefreshCw,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

type ConvenioStatus = "ativo" | "suspenso" | "cancelado" | "encerrado";
type UsuarioStatus = "ativo" | "inativo" | "bloqueado";

type Convenio = {
  id: string;
  codigo: string;
  nomeConvenio: string;
  tipoConvenio: string;
  contratanteNome: string;
  contratanteDocumento?: string;
  emailFinanceiro?: string;
  telefoneFinanceiro?: string;
  responsavelNome?: string;
  responsavelCargo?: string;
  responsavelEmail?: string;
  dataInicio: string;
  dataFim: string;
  dataRenovacao?: string;
  status: ConvenioStatus;
  renovacaoAutomatica: boolean;
  prazoAvisoPrevioDias: number;
  valorContratado: number;
  valorPago: number;
  limiteCreditosMensal: number;
  limiteUsuarios: number;
  observacoes?: string;
  canceladoEm?: string;
  canceladoMotivo?: string;
  prorrogadoEm?: string;
  prorrogadoNovaDataFim?: string;
  criterioValidacao: string;
  exigeListaElegiveis: boolean;
  dominioEmailPermitido?: string;
  creditosIniciaisUsuario: number;
};

type ConvenioUsuario = {
  id: string;
  convenioId: string;
  nome: string;
  cpf?: string;
  numeroOab?: string;
  ufOab?: string;
  matricula?: string;
  dataNascimento?: string;
  telefone?: string;
  email: string;
  cargoProfissional?: string;
  especialidade?: string;
  cidade?: string;
  estado?: string;
  endereco?: string;
  status: UsuarioStatus;
  creditosIniciais: number;
  creditosDisponiveis: number;
  creditosCompradosTotal: number;
  creditosUtilizadosTotal: number;
  ultimoLoginEm?: string;
  primeiroAcessoPendente?: boolean;
  redefinirSenhaObrigatoria?: boolean;
  origemVinculo?: string;
};

type UsuarioFormData = ConvenioUsuario & {
  senha: string;
  confirmarSenha: string;
  exigirTrocaSenha: boolean;
};

type Elegivel = {
  id: string;
  convenioId: string;
  nome?: string;
  cpf?: string;
  email?: string;
  numeroOab?: string;
  ufOab?: string;
  matricula?: string;
  status: "ativo" | "inativo";
  createdAt: string;
  updatedAt: string;
};

type StatsResponse = {
  summary: {
    totalUsuarios: number;
    usuariosAtivos: number;
    totalCreditosUsados: number;
    totalCreditosComprados: number;
    totalTempo: number;
  };
  porUsuario: {
    usuarioId: string;
    nome: string;
    tempo: number;
    creditosUsados: number;
    creditosComprados: number;
    modulos: string[];
  }[];
  porModulo: {
    modulo: string;
    tempo: number;
    creditosUsados: number;
    creditosComprados: number;
  }[];
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function currencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}
function dateBR(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR");
}
function dateTimeBR(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("pt-BR");
}
function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}
function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function diffDays(targetDate: string): number {
  const now = new Date();
  const target = new Date(targetDate);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function statusBadgeClass(status: string): string {
  switch (status) {
    case "ativo":     return "bg-green-100 text-green-700 border-green-200";
    case "suspenso":  return "bg-amber-100 text-amber-700 border-amber-200";
    case "cancelado": return "bg-red-100 text-red-700 border-red-200";
    case "encerrado": return "bg-slate-100 text-slate-700 border-slate-200";
    case "inativo":   return "bg-slate-100 text-slate-700 border-slate-200";
    case "bloqueado": return "bg-red-100 text-red-700 border-red-200";
    default:          return "bg-blue-100 text-blue-700 border-blue-200";
  }
}

// ─── Report HTML generator ────────────────────────────────────────────────────

export function generateVeritasConvenioReportHtml(params: {
  convenio: Convenio;
  stats: StatsResponse;
  periodoLabel?: string;
}): string {
  const { convenio, stats, periodoLabel = "Período consolidado" } = params;
  const { summary, porUsuario, porModulo } = stats;

  const linhasUsuarios = porUsuario.map((item) => `
    <tr>
      <td>${escapeHtml(item.nome)}</td>
      <td>${escapeHtml(formatDuration(item.tempo))}</td>
      <td>${escapeHtml((item.modulos ?? []).join(", ") || "—")}</td>
      <td>${item.creditosUsados}</td>
      <td>${item.creditosComprados}</td>
    </tr>`).join("");

  const linhasModulo = porModulo.map((item) => `
    <tr>
      <td>${escapeHtml(item.modulo)}</td>
      <td>${escapeHtml(formatDuration(item.tempo))}</td>
      <td>${item.creditosUsados}</td>
      <td>${item.creditosComprados}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Relatório de Utilização do Convênio</title>
<style>
:root { --vb:#17365d; --vm:#6b7280; --vbr:#dbe3ee; --vbg:#f8fafc; --vr:#b91c1c; }
* { box-sizing:border-box; }
body { margin:0; padding:28px; font-family:"Segoe UI",Arial,sans-serif; color:#1f2937; background:#fff; line-height:1.35; }
.header { border-bottom:3px solid var(--vb); padding-bottom:10px; margin-bottom:18px; }
.brand { color:var(--vb); font-size:25px; font-weight:700; }
.subtitle { color:var(--vm); font-size:12px; margin-top:4px; }
.doc-title { margin-top:8px; color:var(--vb); font-size:20px; font-weight:600; }
.section-title { margin-top:24px; margin-bottom:8px; color:var(--vb); font-size:18px; font-weight:700; border-bottom:2px solid var(--vb); padding-bottom:5px; }
.meta-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px 18px; margin-top:12px; }
.meta-item { border:1px solid var(--vbr); border-radius:8px; padding:10px 12px; }
.meta-label { font-size:11px; color:var(--vm); text-transform:uppercase; }
.meta-value { font-size:15px; font-weight:600; margin-top:3px; }
.summary-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:12px; }
.summary-card { border:1px solid var(--vbr); border-top:4px solid var(--vb); border-radius:8px; padding:10px 12px; }
.summary-label { font-size:11px; color:var(--vm); text-transform:uppercase; }
.summary-value { margin-top:6px; font-size:20px; font-weight:700; color:var(--vb); }
table { width:100%; border-collapse:collapse; margin-top:10px; font-size:12px; }
thead th { background:var(--vb); color:#fff; text-align:left; padding:9px 8px; }
tbody td { padding:8px; border:1px solid var(--vbr); }
tbody tr:nth-child(even) { background:#fafcff; }
.totals { margin-top:16px; border:1px solid var(--vbr); border-radius:8px; padding:12px; background:var(--vbg); }
.totals-row { display:flex; justify-content:space-between; margin:4px 0; font-size:13px; }
.totals-row strong { color:var(--vb); }
.footer { margin-top:28px; padding-top:10px; border-top:1px solid var(--vbr); color:#4b5563; font-size:11px; display:flex; justify-content:space-between; }
.danger { color:var(--vr); }
</style>
</head>
<body>
<div class="header">
  <div class="brand">VERITAS ANALYTICS</div>
  <div class="subtitle">Plataforma de Cálculos Judiciais e Gestão Institucional</div>
  <div class="doc-title">Relatório de Utilização do Convênio</div>
</div>
<div class="section-title">I — Dados do Convênio</div>
<div class="meta-grid">
  <div class="meta-item"><div class="meta-label">Convênio</div><div class="meta-value">${escapeHtml(convenio.nomeConvenio)}</div></div>
  <div class="meta-item"><div class="meta-label">Contratante</div><div class="meta-value">${escapeHtml(convenio.contratanteNome)}</div></div>
  <div class="meta-item"><div class="meta-label">Código</div><div class="meta-value">${escapeHtml(convenio.codigo)}</div></div>
  <div class="meta-item"><div class="meta-label">Status</div><div class="meta-value">${escapeHtml(convenio.status)}</div></div>
  <div class="meta-item"><div class="meta-label">Início</div><div class="meta-value">${escapeHtml(dateBR(convenio.dataInicio))}</div></div>
  <div class="meta-item"><div class="meta-label">Término</div><div class="meta-value">${escapeHtml(dateBR(convenio.dataFim))}</div></div>
  <div class="meta-item"><div class="meta-label">Valor contratado</div><div class="meta-value">${escapeHtml(currencyBRL(convenio.valorContratado))}</div></div>
  <div class="meta-item"><div class="meta-label">Valor pago</div><div class="meta-value">${escapeHtml(currencyBRL(convenio.valorPago))}</div></div>
</div>
<div class="section-title">II — Síntese Operacional</div>
<div class="summary-grid">
  <div class="summary-card"><div class="summary-label">Período</div><div class="summary-value" style="font-size:16px">${escapeHtml(periodoLabel)}</div></div>
  <div class="summary-card"><div class="summary-label">Usuários cadastrados</div><div class="summary-value">${summary.totalUsuarios}</div></div>
  <div class="summary-card"><div class="summary-label">Usuários ativos</div><div class="summary-value">${summary.usuariosAtivos}</div></div>
  <div class="summary-card"><div class="summary-label">Tempo total</div><div class="summary-value" style="font-size:16px">${escapeHtml(formatDuration(summary.totalTempo))}</div></div>
  <div class="summary-card"><div class="summary-label">Créditos usados</div><div class="summary-value">${summary.totalCreditosUsados}</div></div>
  <div class="summary-card"><div class="summary-label">Créditos comprados</div><div class="summary-value">${summary.totalCreditosComprados}</div></div>
  <div class="summary-card"><div class="summary-label">Saldo financeiro</div><div class="summary-value" style="font-size:16px">${escapeHtml(currencyBRL(convenio.valorContratado - convenio.valorPago))}</div></div>
  <div class="summary-card"><div class="summary-label">Emissão</div><div class="summary-value" style="font-size:14px">${escapeHtml(new Date().toLocaleString("pt-BR"))}</div></div>
</div>
<div class="section-title">III — Utilização por Usuário</div>
<table>
  <thead><tr><th>Usuário</th><th>Tempo logado</th><th>Módulos</th><th>Créditos usados</th><th>Créditos comprados</th></tr></thead>
  <tbody>${linhasUsuarios || `<tr><td colspan="5">Nenhum registro encontrado.</td></tr>`}</tbody>
</table>
<div class="section-title">IV — Consolidação por Módulo</div>
<table>
  <thead><tr><th>Módulo</th><th>Tempo total</th><th>Créditos usados</th><th>Créditos comprados</th></tr></thead>
  <tbody>${linhasModulo || `<tr><td colspan="4">Nenhum registro encontrado.</td></tr>`}</tbody>
</table>
<div class="section-title">V — Totais Financeiros e Operacionais</div>
<div class="totals">
  <div class="totals-row"><span>Valor contratado</span><strong>${escapeHtml(currencyBRL(convenio.valorContratado))}</strong></div>
  <div class="totals-row"><span>Valor pago</span><strong>${escapeHtml(currencyBRL(convenio.valorPago))}</strong></div>
  <div class="totals-row"><span>Saldo em aberto</span><strong class="danger">${escapeHtml(currencyBRL(convenio.valorContratado - convenio.valorPago))}</strong></div>
  <div class="totals-row"><span>Créditos utilizados</span><strong>${summary.totalCreditosUsados}</strong></div>
  <div class="totals-row"><span>Créditos comprados</span><strong>${summary.totalCreditosComprados}</strong></div>
</div>
<div class="footer">
  <div>Veritas Analytics — Relatório institucional automatizado</div>
  <div>Gerado em ${escapeHtml(new Date().toLocaleString("pt-BR"))} · Não dispensa análise profissional</div>
</div>
</body>
</html>`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NumberInput({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <Input type="number" min={min} value={value}
      onChange={(e) => onChange(Number(e.target.value || 0))} />
  );
}

function MetricCard({ title, value, icon }: { title: string; value: string; icon?: React.ReactNode }) {
  return (
    <Card className="rounded-2xl border-slate-200 shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
          </div>
          {icon ? <div className="rounded-xl bg-slate-100 p-2 text-slate-700">{icon}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { ...opts, headers: { ...getAuthHeaders(), ...(opts?.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

function jsonPost(url: string, body: unknown) {
  return apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
function jsonPut(url: string, body: unknown) {
  return apiFetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
function apiDelete(url: string) {
  return apiFetch(url, { method: "DELETE" });
}

// ─── Empty form factories ─────────────────────────────────────────────────────

const todayISO = new Date().toISOString().slice(0, 10);
const nextYearISO = addDays(todayISO, 365);

function generateConvenioCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${seg()}-${seg()}`;
}

function emptyConvenioForm(): Convenio {
  return {
    id: "", codigo: generateConvenioCode(), nomeConvenio: "", tipoConvenio: "OAB",
    contratanteNome: "", contratanteDocumento: "", emailFinanceiro: "",
    telefoneFinanceiro: "", responsavelNome: "", responsavelCargo: "", responsavelEmail: "",
    dataInicio: todayISO, dataFim: nextYearISO, dataRenovacao: "",
    status: "ativo", renovacaoAutomatica: false, prazoAvisoPrevioDias: 30,
    valorContratado: 0, valorPago: 0, limiteCreditosMensal: 10, limiteUsuarios: 100,
    observacoes: "",
    criterioValidacao: "oab_uf", exigeListaElegiveis: false,
    dominioEmailPermitido: "", creditosIniciaisUsuario: 0,
  };
}

function emptyUsuarioForm(convenioId: string): UsuarioFormData {
  return {
    id: "", convenioId, nome: "", cpf: "", numeroOab: "", ufOab: "MG",
    dataNascimento: "", telefone: "", email: "",
    cargoProfissional: "Advogado", especialidade: "", cidade: "", estado: "MG",
    endereco: "", status: "ativo",
    creditosIniciais: 10, creditosDisponiveis: 10, creditosCompradosTotal: 0, creditosUtilizadosTotal: 0,
    ultimoLoginEm: "", primeiroAcessoPendente: true, redefinirSenhaObrigatoria: true,
    senha: "", confirmarSenha: "", exigirTrocaSenha: true,
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminConvenios() {
  const { } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");

  const [convenioForm, setConvenioForm] = useState<Convenio>(emptyConvenioForm());
  const [editingConvenioId, setEditingConvenioId] = useState<string | null>(null);
  const [convenioDialogOpen, setConvenioDialogOpen] = useState(false);

  const [usuarioForm, setUsuarioForm] = useState<UsuarioFormData>(emptyUsuarioForm(""));
  const [editingUsuarioId, setEditingUsuarioId] = useState<string | null>(null);
  const [usuarioDialogOpen, setUsuarioDialogOpen] = useState(false);

  // ── Elegíveis state ────────────────────────────────────────────────────────
  const [elegivelSearch, setElegivelSearch] = useState("");
  const [elegivelForm, setElegivelForm] = useState<Partial<Elegivel>>({});
  const [editingElegivelId, setEditingElegivelId] = useState<string | null>(null);
  const [elegivelDialogOpen, setElegivelDialogOpen] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: convenios = [], isLoading: loadingConvenios } = useQuery<Convenio[]>({
    queryKey: ["convenios"],
    queryFn: () => apiFetch(`${BASE}/api/convenios`),
  });

  useEffect(() => {
    if (!selectedId && convenios.length > 0) {
      setSelectedId(convenios[0].id);
    }
  }, [convenios, selectedId]);

  const { data: usuarios = [], isLoading: loadingUsuarios } = useQuery<ConvenioUsuario[]>({
    queryKey: ["convenios", selectedId, "usuarios"],
    queryFn: () => apiFetch(`${BASE}/api/convenios/${selectedId}/usuarios`),
    enabled: !!selectedId,
  });

  const { data: statsData, isLoading: loadingStats } = useQuery<StatsResponse>({
    queryKey: ["convenios", selectedId, "stats"],
    queryFn: () => apiFetch(`${BASE}/api/convenios/${selectedId}/stats`),
    enabled: !!selectedId,
  });

  const { data: elegiveis = [], isLoading: loadingElegiveis, refetch: refetchElegiveis } = useQuery<Elegivel[]>({
    queryKey: ["convenios", selectedId, "elegiveis"],
    queryFn: () => apiFetch(`${BASE}/api/convenios/${selectedId}/elegiveis`),
    enabled: !!selectedId,
  });

  // ── Derived state ──────────────────────────────────────────────────────────

  const filteredConvenios = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return convenios;
    return convenios.filter((c) =>
      [c.nomeConvenio, c.contratanteNome, c.codigo, c.status]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [convenios, search]);

  const selectedConvenio = useMemo(
    () => convenios.find((c) => c.id === selectedId) ?? filteredConvenios[0] ?? null,
    [convenios, selectedId, filteredConvenios]
  );

  const stats = statsData?.summary ?? {
    totalUsuarios: 0, usuariosAtivos: 0, totalCreditosUsados: 0, totalCreditosComprados: 0, totalTempo: 0,
  };
  const usoAgregadoPorUsuario = statsData?.porUsuario ?? [];
  const usoAgregadoPorModulo = statsData?.porModulo ?? [];

  // ── Mutations ──────────────────────────────────────────────────────────────

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["convenios"] });
    if (selectedId) {
      qc.invalidateQueries({ queryKey: ["convenios", selectedId] });
    }
  };

  const createConvenio = useMutation({
    mutationFn: (data: Omit<Convenio, "id">) => jsonPost(`${BASE}/api/convenios`, data),
    onSuccess: (created: Convenio) => {
      qc.invalidateQueries({ queryKey: ["convenios"] });
      setSelectedId(created.id);
      setConvenioDialogOpen(false);
      toast({ title: "Convênio criado com sucesso" });
    },
    onError: (err: Error) => toast({ title: "Erro ao criar convênio", description: err.message, variant: "destructive" }),
  });

  const updateConvenio = useMutation({
    mutationFn: (data: Convenio) => jsonPut(`${BASE}/api/convenios/${data.id}`, data),
    onSuccess: () => {
      invalidate();
      setConvenioDialogOpen(false);
      toast({ title: "Convênio atualizado" });
    },
    onError: (err: Error) => toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" }),
  });

  const deleteConvenio = useMutation({
    mutationFn: (id: string) => apiDelete(`${BASE}/api/convenios/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["convenios"] });
      setSelectedId("");
      toast({ title: "Convênio excluído" });
    },
    onError: (err: Error) => toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" }),
  });

  const cancelarConvenio = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      jsonPost(`${BASE}/api/convenios/${id}/cancelar`, { motivo }),
    onSuccess: () => { invalidate(); toast({ title: "Convênio cancelado" }); },
    onError: (err: Error) => toast({ title: "Erro ao cancelar", description: err.message, variant: "destructive" }),
  });

  const renovarConvenio = useMutation({
    mutationFn: ({ id, novaDataFim }: { id: string; novaDataFim: string }) =>
      jsonPost(`${BASE}/api/convenios/${id}/renovar`, { novaDataFim }),
    onSuccess: () => { invalidate(); toast({ title: "Convênio renovado" }); },
    onError: (err: Error) => toast({ title: "Erro ao renovar", description: err.message, variant: "destructive" }),
  });

  const prorrogarConvenio = useMutation({
    mutationFn: ({ id, novaDataFim }: { id: string; novaDataFim: string }) =>
      jsonPost(`${BASE}/api/convenios/${id}/prorrogar`, { novaDataFim }),
    onSuccess: () => { invalidate(); toast({ title: "Convênio prorrogado" }); },
    onError: (err: Error) => toast({ title: "Erro ao prorrogar", description: err.message, variant: "destructive" }),
  });

  const createUsuario = useMutation({
    mutationFn: (data: ConvenioUsuario) =>
      jsonPost(`${BASE}/api/convenios/${selectedId}/usuarios`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["convenios", selectedId, "usuarios"] });
      qc.invalidateQueries({ queryKey: ["convenios", selectedId, "stats"] });
      setUsuarioDialogOpen(false);
      toast({ title: "Usuário cadastrado" });
    },
    onError: (err: Error) => toast({ title: "Erro ao cadastrar usuário", description: err.message, variant: "destructive" }),
  });

  const updateUsuario = useMutation({
    mutationFn: (data: ConvenioUsuario) =>
      jsonPut(`${BASE}/api/convenios/${selectedId}/usuarios/${data.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["convenios", selectedId, "usuarios"] });
      qc.invalidateQueries({ queryKey: ["convenios", selectedId, "stats"] });
      setUsuarioDialogOpen(false);
      toast({ title: "Usuário atualizado" });
    },
    onError: (err: Error) => toast({ title: "Erro ao atualizar usuário", description: err.message, variant: "destructive" }),
  });

  const deleteUsuario = useMutation({
    mutationFn: (uid: string) =>
      apiDelete(`${BASE}/api/convenios/${selectedId}/usuarios/${uid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["convenios", selectedId, "usuarios"] });
      qc.invalidateQueries({ queryKey: ["convenios", selectedId, "stats"] });
      toast({ title: "Usuário removido" });
    },
    onError: (err: Error) => toast({ title: "Erro ao remover usuário", description: err.message, variant: "destructive" }),
  });

  const createElegivel = useMutation({
    mutationFn: (data: Partial<Elegivel>) =>
      jsonPost(`${BASE}/api/convenios/${selectedId}/elegiveis`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["convenios", selectedId, "elegiveis"] });
      setElegivelDialogOpen(false);
      setElegivelForm({});
      setEditingElegivelId(null);
      toast({ title: "Elegível cadastrado" });
    },
    onError: (err: Error) => toast({ title: "Erro ao cadastrar elegível", description: err.message, variant: "destructive" }),
  });

  const updateElegivel = useMutation({
    mutationFn: (data: Partial<Elegivel> & { id: string }) =>
      jsonPut(`${BASE}/api/convenios/elegiveis/${data.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["convenios", selectedId, "elegiveis"] });
      setElegivelDialogOpen(false);
      setElegivelForm({});
      setEditingElegivelId(null);
      toast({ title: "Elegível atualizado" });
    },
    onError: (err: Error) => toast({ title: "Erro ao atualizar elegível", description: err.message, variant: "destructive" }),
  });

  const deleteElegivel = useMutation({
    mutationFn: (id: string) => apiDelete(`${BASE}/api/convenios/elegiveis/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["convenios", selectedId, "elegiveis"] });
      toast({ title: "Elegível removido" });
    },
    onError: (err: Error) => toast({ title: "Erro ao remover elegível", description: err.message, variant: "destructive" }),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleOpenNewConvenio() {
    setConvenioForm(emptyConvenioForm());
    setEditingConvenioId(null);
    setConvenioDialogOpen(true);
  }
  function handleEditConvenio(c: Convenio) {
    setConvenioForm(c);
    setEditingConvenioId(c.id);
    setConvenioDialogOpen(true);
  }
  function handleSaveConvenio() {
    if (!convenioForm.nomeConvenio?.trim()) {
      toast({ title: "Informe o nome do convênio", variant: "destructive" });
      return;
    }
    if (editingConvenioId) {
      updateConvenio.mutate({ ...convenioForm, id: editingConvenioId });
    } else {
      createConvenio.mutate(convenioForm);
    }
  }
  function handleDeleteConvenio(id: string) {
    if (!window.confirm("Deseja realmente excluir este convênio?")) return;
    deleteConvenio.mutate(id);
  }
  function handleCancelar(c: Convenio) {
    const motivo = window.prompt("Informe o motivo do cancelamento:", c.canceladoMotivo ?? "");
    if (motivo === null) return;
    cancelarConvenio.mutate({ id: c.id, motivo });
  }
  function handleRenovar(c: Convenio) {
    const novaDataFim = window.prompt("Nova data de término (YYYY-MM-DD):", addDays(c.dataFim, 365));
    if (!novaDataFim) return;
    renovarConvenio.mutate({ id: c.id, novaDataFim });
  }
  function handleProrrogar(c: Convenio) {
    const novaDataFim = window.prompt("Data prorrogada (YYYY-MM-DD):", addDays(c.dataFim, 30));
    if (!novaDataFim) return;
    prorrogarConvenio.mutate({ id: c.id, novaDataFim });
  }
  function handleOpenNewUsuario() {
    setUsuarioForm(emptyUsuarioForm(selectedId));
    setEditingUsuarioId(null);
    setUsuarioDialogOpen(true);
  }
  function handleEditUsuario(u: ConvenioUsuario) {
    setUsuarioForm({ ...u, senha: "", confirmarSenha: "", exigirTrocaSenha: false });
    setEditingUsuarioId(u.id);
    setUsuarioDialogOpen(true);
  }
  function handleSaveUsuario() {
    if (!usuarioForm.nome || !usuarioForm.email) return;
    if (!editingUsuarioId) {
      if (!usuarioForm.senha) { toast({ title: "Informe a senha do usuário", variant: "destructive" }); return; }
      if (usuarioForm.senha.length < 8) { toast({ title: "A senha deve ter ao menos 8 caracteres", variant: "destructive" }); return; }
      if (!/[a-zA-Z]/.test(usuarioForm.senha) || !/[0-9]/.test(usuarioForm.senha)) {
        toast({ title: "A senha deve conter ao menos 1 letra e 1 número", variant: "destructive" }); return;
      }
      if (usuarioForm.senha !== usuarioForm.confirmarSenha) {
        toast({ title: "As senhas não coincidem", variant: "destructive" }); return;
      }
    }
    if (usuarioForm.senha && usuarioForm.senha !== usuarioForm.confirmarSenha) {
      toast({ title: "As senhas não coincidem", variant: "destructive" }); return;
    }
    if (editingUsuarioId) {
      updateUsuario.mutate({ ...usuarioForm, id: editingUsuarioId });
    } else {
      createUsuario.mutate(usuarioForm);
    }
  }
  function handleDeleteUsuario(uid: string) {
    if (!window.confirm("Deseja excluir este usuário do convênio?")) return;
    deleteUsuario.mutate(uid);
  }

  // ── Elegíveis handlers ─────────────────────────────────────────────────────
  function handleOpenNewElegivel() {
    setElegivelForm({ status: "ativo" });
    setEditingElegivelId(null);
    setElegivelDialogOpen(true);
  }
  function handleEditElegivel(e: Elegivel) {
    setElegivelForm(e);
    setEditingElegivelId(e.id);
    setElegivelDialogOpen(true);
  }
  function handleSaveElegivel() {
    if (!elegivelForm.nome && !elegivelForm.cpf && !elegivelForm.email && !elegivelForm.numeroOab && !elegivelForm.matricula) {
      toast({ title: "Informe ao menos um campo de identificação", variant: "destructive" }); return;
    }
    if (editingElegivelId) {
      updateElegivel.mutate({ ...elegivelForm, id: editingElegivelId });
    } else {
      createElegivel.mutate(elegivelForm);
    }
  }
  function handleDeleteElegivel(id: string) {
    if (!window.confirm("Deseja excluir este elegível?")) return;
    deleteElegivel.mutate(id);
  }
  async function handleImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    setCsvImporting(true);
    const formData = new FormData();
    formData.append("csv", file);
    e.target.value = "";
    try {
      const res = await fetch(`${BASE}/api/convenios/${selectedId}/elegiveis/import-csv`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Erro na importação", description: data.error, variant: "destructive" }); return; }
      toast({ title: `Importação concluída: ${data.inseridos} inseridos, ${data.ignorados} ignorados.` });
      refetchElegiveis();
    } catch {
      toast({ title: "Erro ao importar CSV", variant: "destructive" });
    } finally {
      setCsvImporting(false);
    }
  }

  const filteredElegiveis = elegiveis.filter((e) => {
    const q = elegivelSearch.trim().toLowerCase();
    if (!q) return true;
    return [e.nome, e.cpf, e.email, e.numeroOab, e.matricula]
      .some((v) => v?.toLowerCase().includes(q));
  });

  function handleGenerateReport() {
    if (!selectedConvenio || !statsData) return;
    const html = generateVeritasConvenioReportHtml({
      convenio: selectedConvenio,
      stats: statsData,
      periodoLabel: `${dateBR(selectedConvenio.dataInicio)} a ${dateBR(selectedConvenio.dataFim)}`,
    });
    const w = window.open("", "_blank", "width=1200,height=900");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Convênios Institucionais</h1>
            <p className="mt-1 text-sm text-slate-600">
              Gestão administrativa, financeira, cadastral e analítica do módulo de convênios.
            </p>
          </div>
          <Button onClick={handleOpenNewConvenio}>
            <Plus className="mr-2 h-4 w-4" /> Novo convênio
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">

          {/* ── Left: list ── */}
          <Card className="h-fit border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Lista de convênios</CardTitle>
              <CardDescription>Localize, selecione e administre os contratos institucionais.</CardDescription>
              <div className="relative pt-2">
                <Search className="absolute left-3 top-5 h-4 w-4 text-slate-400" />
                <Input className="pl-9" placeholder="Localizar convênio..."
                  value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingConvenios ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
              ) : filteredConvenios.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
                  Nenhum convênio encontrado.
                </div>
              ) : (
                filteredConvenios.map((convenio) => {
                  const dias = diffDays(convenio.dataFim);
                  const isSelected = convenio.id === selectedConvenio?.id;
                  return (
                    <button
                      key={convenio.id}
                      type="button"
                      onClick={() => setSelectedId(convenio.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isSelected ? "border-blue-300 bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{convenio.nomeConvenio}</div>
                          <div className="mt-1 text-xs text-slate-500">{convenio.contratanteNome}</div>
                          <div className="mt-1 text-xs text-slate-400">Código: {convenio.codigo}</div>
                        </div>
                        <Badge className={`border ${statusBadgeClass(convenio.status)}`}>{convenio.status}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div><span className="font-medium">Fim:</span> {dateBR(convenio.dataFim)}</div>
                        <div><span className="font-medium">Pago:</span> {currencyBRL(convenio.valorPago)}</div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className={dias <= 30 ? "font-medium text-red-600" : "text-slate-500"}>
                          {dias <= 0 ? "Vencido" : dias <= 30 ? `Vence em ${dias} dia(s)` : `${dias} dia(s) restantes`}
                        </span>
                        {dias <= 30 && (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <AlertTriangle className="h-3.5 w-3.5" /> alerta
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* ── Right: detail ── */}
          <div className="space-y-6">
            {!selectedConvenio ? (
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="py-12 text-center text-slate-500">
                  {loadingConvenios ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : "Selecione um convênio para continuar."}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Summary card */}
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <CardTitle className="text-2xl">{selectedConvenio.nomeConvenio}</CardTitle>
                      <CardDescription className="mt-1">{selectedConvenio.contratanteNome}</CardDescription>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge className={`border ${statusBadgeClass(selectedConvenio.status)}`}>{selectedConvenio.status}</Badge>
                        <Badge variant="outline">{selectedConvenio.tipoConvenio}</Badge>
                        <Badge variant="outline">Código: {selectedConvenio.codigo}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditConvenio(selectedConvenio)}>
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleRenovar(selectedConvenio)}>
                        <CalendarClock className="mr-2 h-4 w-4" /> Renovar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleProrrogar(selectedConvenio)}>
                        <CalendarClock className="mr-2 h-4 w-4" /> Prorrogar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleCancelar(selectedConvenio)}>
                        <AlertTriangle className="mr-2 h-4 w-4" /> Cancelar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteConvenio(selectedConvenio.id)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <MetricCard icon={<Landmark className="h-4 w-4" />} title="Valor contratado" value={currencyBRL(selectedConvenio.valorContratado)} />
                      <MetricCard icon={<Wallet className="h-4 w-4" />} title="Valor pago" value={currencyBRL(selectedConvenio.valorPago)} />
                      <MetricCard icon={<Users className="h-4 w-4" />} title="Usuários ativos" value={`${stats.usuariosAtivos}/${stats.totalUsuarios}`} />
                      <MetricCard icon={<CalendarClock className="h-4 w-4" />} title="Vigência"
                        value={`${dateBR(selectedConvenio.dataInicio)} → ${dateBR(selectedConvenio.dataFim)}`} />
                    </div>
                    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <MetricCard title="Créditos usados" value={String(stats.totalCreditosUsados)} />
                      <MetricCard title="Créditos comprados" value={String(stats.totalCreditosComprados)} />
                      <MetricCard title="Tempo total de uso" value={formatDuration(stats.totalTempo)} />
                      <MetricCard title="Saldo financeiro" value={currencyBRL(selectedConvenio.valorContratado - selectedConvenio.valorPago)} />
                    </div>
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <InfoBlock label="Responsável" value={selectedConvenio.responsavelNome ?? "—"} />
                      <InfoBlock label="E-mail financeiro" value={selectedConvenio.emailFinanceiro ?? "—"} />
                      <InfoBlock label="Telefone financeiro" value={selectedConvenio.telefoneFinanceiro ?? "—"} />
                      <InfoBlock label="Limite mensal de créditos" value={String(selectedConvenio.limiteCreditosMensal)} />
                      <InfoBlock label="Limite de usuários" value={String(selectedConvenio.limiteUsuarios)} />
                      <InfoBlock label="Observações" value={selectedConvenio.observacoes ?? "—"} />
                    </div>
                  </CardContent>
                </Card>

                {/* Tabs */}
                <Tabs defaultValue="usuarios" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="usuarios">Usuários</TabsTrigger>
                    <TabsTrigger value="elegiveis">Elegíveis</TabsTrigger>
                    <TabsTrigger value="utilizacao">Utilização</TabsTrigger>
                    <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                    <TabsTrigger value="relatorio">Relatório PDF</TabsTrigger>
                  </TabsList>

                  {/* Tab: Usuários */}
                  <TabsContent value="usuarios">
                    <Card className="border-slate-200 shadow-sm">
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                          <CardTitle>Usuários do convênio</CardTitle>
                          <CardDescription>Cadastro e administração de usuários vinculados ao convênio.</CardDescription>
                        </div>
                        <Button onClick={handleOpenNewUsuario}>
                          <Plus className="mr-2 h-4 w-4" /> Novo usuário
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {loadingUsuarios ? (
                          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>OAB</TableHead>
                                <TableHead>E-mail</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Créditos</TableHead>
                                <TableHead>Último login</TableHead>
                                <TableHead>Acesso</TableHead>
                                <TableHead className="w-[120px] text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {usuarios.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={8} className="text-center text-slate-500">
                                    Nenhum usuário cadastrado.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                usuarios.map((u) => (
                                  <TableRow key={u.id}>
                                    <TableCell>
                                      <div className="font-medium">{u.nome}</div>
                                      <div className="text-xs text-slate-500">{u.especialidade ?? "—"}</div>
                                    </TableCell>
                                    <TableCell>
                                      {u.numeroOab ? `${u.numeroOab}/${u.ufOab}` : u.matricula ? `Mat: ${u.matricula}` : "—"}
                                    </TableCell>
                                    <TableCell>
                                      <div>{u.email}</div>
                                      {u.origemVinculo === "cadastro_via_convenio" && (
                                        <div className="text-xs text-blue-600 mt-0.5">Auto-cadastro</div>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <Badge className={`border ${statusBadgeClass(u.status)}`}>{u.status}</Badge>
                                    </TableCell>
                                    <TableCell>{u.creditosDisponiveis}</TableCell>
                                    <TableCell>{dateTimeBR(u.ultimoLoginEm)}</TableCell>
                                    <TableCell>
                                      {u.primeiroAcessoPendente ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                                          <KeyRound className="h-3 w-3" /> 1º acesso
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-xs text-green-700">
                                          <ShieldCheck className="h-3.5 w-3.5" /> ok
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex justify-end gap-2">
                                        <Button size="sm" variant="outline" onClick={() => handleEditUsuario(u)}>
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button size="sm" variant="destructive" onClick={() => handleDeleteUsuario(u.id)}>
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab: Elegíveis */}
                  <TabsContent value="elegiveis">
                    <Card className="border-slate-200 shadow-sm">
                      <CardHeader>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4 text-blue-600" /> Lista de Elegíveis
                            </CardTitle>
                            <CardDescription className="mt-1">
                              Usuários autorizados a ingressar neste convênio. Total: {elegiveis.length}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <label className="cursor-pointer">
                              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCsv} />
                              <Button variant="outline" size="sm" asChild>
                                <span>
                                  {csvImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                  Importar CSV
                                </span>
                              </Button>
                            </label>
                            <Button size="sm" onClick={handleOpenNewElegivel}>
                              <Plus className="mr-2 h-4 w-4" /> Novo elegível
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            className="pl-9"
                            placeholder="Buscar por nome, CPF, e-mail, OAB ou matrícula..."
                            value={elegivelSearch}
                            onChange={(e) => setElegivelSearch(e.target.value)}
                          />
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          CSV aceita colunas: <code className="text-xs bg-slate-100 px-1 rounded">nome, cpf, email, numero_oab, uf_oab, matricula</code>
                        </p>
                      </CardHeader>
                      <CardContent className="p-0">
                        {loadingElegiveis ? (
                          <div className="flex justify-center py-10">
                            <Loader2 className="animate-spin h-6 w-6 text-slate-400" />
                          </div>
                        ) : filteredElegiveis.length === 0 ? (
                          <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                            <UserCheck className="h-8 w-8" />
                            <p className="text-sm">{elegivelSearch ? "Nenhum elegível encontrado." : "Nenhum elegível cadastrado ainda."}</p>
                            {!elegivelSearch && (
                              <p className="text-xs text-slate-400">Adicione manualmente ou importe um CSV com a lista.</p>
                            )}
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-slate-50">
                                  <TableHead>Nome</TableHead>
                                  <TableHead>E-mail</TableHead>
                                  <TableHead>CPF</TableHead>
                                  <TableHead>OAB</TableHead>
                                  <TableHead>Matrícula</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredElegiveis.map((e) => (
                                  <TableRow key={e.id} className="text-sm">
                                    <TableCell className="font-medium">{e.nome ?? "—"}</TableCell>
                                    <TableCell className="text-slate-500">{e.email ?? "—"}</TableCell>
                                    <TableCell>{e.cpf ?? "—"}</TableCell>
                                    <TableCell>{e.numeroOab ? `${e.numeroOab}/${e.ufOab}` : "—"}</TableCell>
                                    <TableCell>{e.matricula ?? "—"}</TableCell>
                                    <TableCell>
                                      <Badge className={e.status === "ativo"
                                        ? "bg-green-100 text-green-700 border border-green-200"
                                        : "bg-slate-100 text-slate-600 border border-slate-200"}>
                                        {e.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-1">
                                        <Button size="sm" variant="ghost" onClick={() => handleEditElegivel(e)}>
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteElegivel(e.id)}>
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Dialog Elegível */}
                    <Dialog open={elegivelDialogOpen} onOpenChange={setElegivelDialogOpen}>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>{editingElegivelId ? "Editar elegível" : "Novo elegível"}</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-3">
                          <div>
                            <Label className="text-sm">Nome</Label>
                            <Input className="mt-1" placeholder="Nome completo" value={elegivelForm.nome ?? ""} onChange={(e) => setElegivelForm((p) => ({ ...p, nome: e.target.value }))} />
                          </div>
                          <div>
                            <Label className="text-sm">E-mail</Label>
                            <Input className="mt-1" type="email" placeholder="email@exemplo.com" value={elegivelForm.email ?? ""} onChange={(e) => setElegivelForm((p) => ({ ...p, email: e.target.value }))} />
                          </div>
                          <div>
                            <Label className="text-sm">CPF</Label>
                            <Input className="mt-1" placeholder="000.000.000-00" value={elegivelForm.cpf ?? ""} onChange={(e) => setElegivelForm((p) => ({ ...p, cpf: e.target.value }))} />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2">
                              <Label className="text-sm">Número OAB</Label>
                              <Input className="mt-1" placeholder="000000" value={elegivelForm.numeroOab ?? ""} onChange={(e) => setElegivelForm((p) => ({ ...p, numeroOab: e.target.value }))} />
                            </div>
                            <div>
                              <Label className="text-sm">UF OAB</Label>
                              <Input className="mt-1 uppercase" placeholder="UF" maxLength={2} value={elegivelForm.ufOab ?? ""} onChange={(e) => setElegivelForm((p) => ({ ...p, ufOab: e.target.value.toUpperCase() }))} />
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm">Matrícula</Label>
                            <Input className="mt-1" placeholder="Matrícula institucional" value={elegivelForm.matricula ?? ""} onChange={(e) => setElegivelForm((p) => ({ ...p, matricula: e.target.value }))} />
                          </div>
                          <div>
                            <Label className="text-sm">Status</Label>
                            <Select value={elegivelForm.status ?? "ativo"} onValueChange={(v) => setElegivelForm((p) => ({ ...p, status: v as "ativo" | "inativo" }))}>
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ativo">Ativo</SelectItem>
                                <SelectItem value="inativo">Inativo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setElegivelDialogOpen(false)}>Cancelar</Button>
                          <Button onClick={handleSaveElegivel} disabled={createElegivel.isPending || updateElegivel.isPending}>
                            {(createElegivel.isPending || updateElegivel.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TabsContent>

                  {/* Tab: Utilização */}
                  <TabsContent value="utilizacao">
                    <div className="grid gap-4 xl:grid-cols-2">
                      <Card className="border-slate-200 shadow-sm">
                        <CardHeader>
                          <CardTitle>Utilização por usuário</CardTitle>
                          <CardDescription>Tempo logado, módulos utilizados e créditos por usuário.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {loadingStats ? (
                            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Usuário</TableHead>
                                  <TableHead>Tempo</TableHead>
                                  <TableHead>Módulos</TableHead>
                                  <TableHead>Usados</TableHead>
                                  <TableHead>Comprados</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {usoAgregadoPorUsuario.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={5} className="text-center text-slate-500">Sem dados de uso.</TableCell>
                                  </TableRow>
                                ) : (
                                  usoAgregadoPorUsuario.map((item) => (
                                    <TableRow key={item.usuarioId}>
                                      <TableCell>{item.nome}</TableCell>
                                      <TableCell>{formatDuration(item.tempo)}</TableCell>
                                      <TableCell className="max-w-[200px] text-xs">
                                        {(item.modulos ?? []).join(", ") || "—"}
                                      </TableCell>
                                      <TableCell>{item.creditosUsados}</TableCell>
                                      <TableCell>{item.creditosComprados}</TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="border-slate-200 shadow-sm">
                        <CardHeader>
                          <CardTitle>Uso consolidado por módulo</CardTitle>
                          <CardDescription>Visão operacional dos módulos efetivamente utilizados.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {loadingStats ? (
                            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Módulo</TableHead>
                                  <TableHead>Tempo total</TableHead>
                                  <TableHead>Créditos usados</TableHead>
                                  <TableHead>Comprados</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {usoAgregadoPorModulo.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={4} className="text-center text-slate-500">Sem dados de uso.</TableCell>
                                  </TableRow>
                                ) : (
                                  usoAgregadoPorModulo.map((item) => (
                                    <TableRow key={item.modulo}>
                                      <TableCell>{item.modulo}</TableCell>
                                      <TableCell>{formatDuration(item.tempo)}</TableCell>
                                      <TableCell>{item.creditosUsados}</TableCell>
                                      <TableCell>{item.creditosComprados}</TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  {/* Tab: Financeiro */}
                  <TabsContent value="financeiro">
                    <Card className="border-slate-200 shadow-sm">
                      <CardHeader>
                        <CardTitle>Resumo financeiro</CardTitle>
                        <CardDescription>Valores contratados, pagos e saldo do convênio.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <MetricCard title="Valor contratado" value={currencyBRL(selectedConvenio.valorContratado)} />
                          <MetricCard title="Valor pago" value={currencyBRL(selectedConvenio.valorPago)} />
                          <MetricCard title="Saldo em aberto" value={currencyBRL(selectedConvenio.valorContratado - selectedConvenio.valorPago)} />
                          <MetricCard title="Créditos utilizados" value={String(stats.totalCreditosUsados)} />
                        </div>
                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                          <InfoBlock label="Data de início" value={dateBR(selectedConvenio.dataInicio)} />
                          <InfoBlock label="Data de fim" value={dateBR(selectedConvenio.dataFim)} />
                          <InfoBlock label="Renovação automática" value={selectedConvenio.renovacaoAutomatica ? "Sim" : "Não"} />
                          <InfoBlock label="Prazo aviso prévio (dias)" value={String(selectedConvenio.prazoAvisoPrevioDias)} />
                          {selectedConvenio.canceladoMotivo && (
                            <InfoBlock label="Motivo do cancelamento" value={selectedConvenio.canceladoMotivo} />
                          )}
                          {selectedConvenio.canceladoEm && (
                            <InfoBlock label="Cancelado em" value={dateTimeBR(selectedConvenio.canceladoEm)} />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab: Relatório PDF */}
                  <TabsContent value="relatorio">
                    <Card className="border-slate-200 shadow-sm">
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                          <CardTitle>Relatório PDF estilo Veritas</CardTitle>
                          <CardDescription>
                            Geração do relatório institucional com padrão visual compatível com os laudos do sistema.
                          </CardDescription>
                        </div>
                        <Button onClick={handleGenerateReport} disabled={loadingStats}>
                          <Download className="mr-2 h-4 w-4" /> Gerar relatório
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                          O gerador produz HTML pronto para impressão ou conversão em PDF com{" "}
                          <span className="font-semibold">window.print()</span> no frontend, ou com{" "}
                          <span className="font-semibold">Puppeteer</span> no backend.
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-4">
                          <p className="mb-3 text-sm font-medium text-slate-900">Seções geradas:</p>
                          <ul className="space-y-1.5 text-sm text-slate-600">
                            {[
                              "I — Dados do convênio",
                              "II — Síntese operacional",
                              "III — Utilização por usuário",
                              "IV — Consolidação por módulo",
                              "V — Totais financeiros e operacionais",
                            ].map((s) => (
                              <li key={s} className="flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-slate-400" /> {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </div>

        {/* ── Dialog: Convênio ── */}
        <Dialog open={convenioDialogOpen} onOpenChange={setConvenioDialogOpen}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{editingConvenioId ? "Editar convênio" : "Novo convênio"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2 md:grid-cols-2">
              <FormField label="Código do convênio">
                <div className="flex gap-2 mt-1">
                  <Input
                    readOnly={!editingConvenioId}
                    value={convenioForm.codigo}
                    onChange={(e) => editingConvenioId && setConvenioForm({ ...convenioForm, codigo: e.target.value })}
                    className={!editingConvenioId ? "font-mono font-bold tracking-widest bg-slate-50 cursor-default" : "font-mono font-bold tracking-widest"}
                  />
                  {!editingConvenioId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Gerar novo código"
                      onClick={() => setConvenioForm({ ...convenioForm, codigo: generateConvenioCode() })}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {!editingConvenioId && (
                  <p className="text-xs text-slate-500 mt-1">
                    Código gerado automaticamente. Compartilhe-o com os usuários para que possam se cadastrar.
                  </p>
                )}
              </FormField>
              <FormField label="Tipo de convênio">
                <Input value={convenioForm.tipoConvenio} onChange={(e) => setConvenioForm({ ...convenioForm, tipoConvenio: e.target.value })} />
              </FormField>
              <FormField label="Nome do convênio">
                <Input value={convenioForm.nomeConvenio} onChange={(e) => setConvenioForm({ ...convenioForm, nomeConvenio: e.target.value })} />
              </FormField>
              <FormField label="Contratante">
                <Input value={convenioForm.contratanteNome} onChange={(e) => setConvenioForm({ ...convenioForm, contratanteNome: e.target.value })} />
              </FormField>
              <FormField label="Documento">
                <Input value={convenioForm.contratanteDocumento ?? ""} onChange={(e) => setConvenioForm({ ...convenioForm, contratanteDocumento: e.target.value })} />
              </FormField>
              <FormField label="E-mail financeiro">
                <Input value={convenioForm.emailFinanceiro ?? ""} onChange={(e) => setConvenioForm({ ...convenioForm, emailFinanceiro: e.target.value })} />
              </FormField>
              <FormField label="Telefone financeiro">
                <Input value={convenioForm.telefoneFinanceiro ?? ""} onChange={(e) => setConvenioForm({ ...convenioForm, telefoneFinanceiro: e.target.value })} />
              </FormField>
              <FormField label="Responsável">
                <Input value={convenioForm.responsavelNome ?? ""} onChange={(e) => setConvenioForm({ ...convenioForm, responsavelNome: e.target.value })} />
              </FormField>
              <FormField label="Cargo do responsável">
                <Input value={convenioForm.responsavelCargo ?? ""} onChange={(e) => setConvenioForm({ ...convenioForm, responsavelCargo: e.target.value })} />
              </FormField>
              <FormField label="E-mail do responsável">
                <Input value={convenioForm.responsavelEmail ?? ""} onChange={(e) => setConvenioForm({ ...convenioForm, responsavelEmail: e.target.value })} />
              </FormField>
              <FormField label="Data de início">
                <Input type="date" value={convenioForm.dataInicio} onChange={(e) => setConvenioForm({ ...convenioForm, dataInicio: e.target.value })} />
              </FormField>
              <FormField label="Data de término">
                <Input type="date" value={convenioForm.dataFim} onChange={(e) => setConvenioForm({ ...convenioForm, dataFim: e.target.value })} />
              </FormField>
              <FormField label="Data de renovação">
                <Input type="date" value={convenioForm.dataRenovacao ?? ""} onChange={(e) => setConvenioForm({ ...convenioForm, dataRenovacao: e.target.value })} />
              </FormField>
              <FormField label="Status">
                <Select value={convenioForm.status} onValueChange={(v: ConvenioStatus) => setConvenioForm({ ...convenioForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">ativo</SelectItem>
                    <SelectItem value="suspenso">suspenso</SelectItem>
                    <SelectItem value="cancelado">cancelado</SelectItem>
                    <SelectItem value="encerrado">encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Valor contratado">
                <NumberInput value={convenioForm.valorContratado} onChange={(v) => setConvenioForm({ ...convenioForm, valorContratado: v })} />
              </FormField>
              <FormField label="Valor pago">
                <NumberInput value={convenioForm.valorPago} onChange={(v) => setConvenioForm({ ...convenioForm, valorPago: v })} />
              </FormField>
              <FormField label="Limite créditos/mês">
                <NumberInput value={convenioForm.limiteCreditosMensal} onChange={(v) => setConvenioForm({ ...convenioForm, limiteCreditosMensal: v })} />
              </FormField>
              <FormField label="Limite de usuários">
                <NumberInput value={convenioForm.limiteUsuarios} onChange={(v) => setConvenioForm({ ...convenioForm, limiteUsuarios: v })} />
              </FormField>
              <FormField label="Prazo de aviso prévio (dias)">
                <NumberInput value={convenioForm.prazoAvisoPrevioDias} onChange={(v) => setConvenioForm({ ...convenioForm, prazoAvisoPrevioDias: v })} />
              </FormField>
              <div className="md:col-span-2">
                <FormField label="Observações">
                  <Textarea rows={4} value={convenioForm.observacoes ?? ""} onChange={(e) => setConvenioForm({ ...convenioForm, observacoes: e.target.value })} />
                </FormField>
              </div>

              {/* ── Seção de elegibilidade ── */}
              <div className="md:col-span-2">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-900">Configuração de Elegibilidade</span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Critério de validação">
                      <Select value={convenioForm.criterioValidacao ?? "oab_uf"} onValueChange={(v) => setConvenioForm({ ...convenioForm, criterioValidacao: v })}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="oab_uf">OAB + UF</SelectItem>
                          <SelectItem value="cpf">CPF</SelectItem>
                          <SelectItem value="email">E-mail exato</SelectItem>
                          <SelectItem value="dominio_email">Domínio de e-mail</SelectItem>
                          <SelectItem value="matricula">Matrícula</SelectItem>
                          <SelectItem value="misto">Misto (múltiplos campos)</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Créditos iniciais por usuário conveniado">
                      <NumberInput value={convenioForm.creditosIniciaisUsuario ?? 0} onChange={(v) => setConvenioForm({ ...convenioForm, creditosIniciaisUsuario: v })} />
                    </FormField>
                    {convenioForm.criterioValidacao === "dominio_email" && (
                      <div className="md:col-span-2">
                        <FormField label="Domínio de e-mail permitido (ex: oab.org.br)">
                          <Input
                            placeholder="exemplo.org.br"
                            value={convenioForm.dominioEmailPermitido ?? ""}
                            onChange={(e) => setConvenioForm({
                              ...convenioForm,
                              dominioEmailPermitido: e.target.value.replace(/^@+/, ""),
                            })}
                            onBlur={(e) => setConvenioForm({
                              ...convenioForm,
                              dominioEmailPermitido: e.target.value.replace(/^@+/, "").toLowerCase().trim(),
                            })}
                          />
                        </FormField>
                      </div>
                    )}
                    <div className="md:col-span-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={convenioForm.exigeListaElegiveis ?? true}
                          onChange={(e) => setConvenioForm({ ...convenioForm, exigeListaElegiveis: e.target.checked })}
                          className="rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700">
                          Exige lista de elegíveis (whitelist) para ingresso via convênio
                        </span>
                      </label>
                      <p className="text-xs text-slate-500 mt-1 ml-6">
                        Se marcado, o usuário deve constar na aba "Elegíveis" para se cadastrar. Se desmarcado, qualquer pessoa com os critérios corretos pode ingressar.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConvenioDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveConvenio}
                disabled={createConvenio.isPending || updateConvenio.isPending}>
                {(createConvenio.isPending || updateConvenio.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar convênio
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Dialog: Usuário ── */}
        <Dialog open={usuarioDialogOpen} onOpenChange={setUsuarioDialogOpen}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{editingUsuarioId ? "Editar usuário" : "Novo usuário do convênio"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2 md:grid-cols-2">
              <FormField label="Nome">
                <Input value={usuarioForm.nome} onChange={(e) => setUsuarioForm({ ...usuarioForm, nome: e.target.value })} />
              </FormField>
              <FormField label="CPF">
                <Input value={usuarioForm.cpf ?? ""} onChange={(e) => setUsuarioForm({ ...usuarioForm, cpf: e.target.value })} />
              </FormField>
              <FormField label="Número OAB">
                <Input value={usuarioForm.numeroOab} onChange={(e) => setUsuarioForm({ ...usuarioForm, numeroOab: e.target.value })} />
              </FormField>
              <FormField label="UF OAB">
                <Input value={usuarioForm.ufOab} onChange={(e) => setUsuarioForm({ ...usuarioForm, ufOab: e.target.value.toUpperCase() })} />
              </FormField>
              <FormField label="Data de nascimento">
                <Input type="date" value={usuarioForm.dataNascimento ?? ""} onChange={(e) => setUsuarioForm({ ...usuarioForm, dataNascimento: e.target.value })} />
              </FormField>
              <FormField label="Telefone">
                <Input value={usuarioForm.telefone ?? ""} onChange={(e) => setUsuarioForm({ ...usuarioForm, telefone: e.target.value })} />
              </FormField>
              <FormField label="E-mail">
                <Input type="email" value={usuarioForm.email} onChange={(e) => setUsuarioForm({ ...usuarioForm, email: e.target.value })} />
              </FormField>
              <FormField label="Cargo profissional">
                <Input value={usuarioForm.cargoProfissional ?? ""} onChange={(e) => setUsuarioForm({ ...usuarioForm, cargoProfissional: e.target.value })} />
              </FormField>
              <FormField label="Especialidade">
                <Input value={usuarioForm.especialidade ?? ""} onChange={(e) => setUsuarioForm({ ...usuarioForm, especialidade: e.target.value })} />
              </FormField>
              <FormField label="Cidade">
                <Input value={usuarioForm.cidade ?? ""} onChange={(e) => setUsuarioForm({ ...usuarioForm, cidade: e.target.value })} />
              </FormField>
              <FormField label="Estado">
                <Input value={usuarioForm.estado ?? ""} onChange={(e) => setUsuarioForm({ ...usuarioForm, estado: e.target.value.toUpperCase() })} />
              </FormField>
              <FormField label="Status">
                <Select value={usuarioForm.status} onValueChange={(v: UsuarioStatus) => setUsuarioForm({ ...usuarioForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">ativo</SelectItem>
                    <SelectItem value="inativo">inativo</SelectItem>
                    <SelectItem value="bloqueado">bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Créditos iniciais">
                <NumberInput value={usuarioForm.creditosIniciais} onChange={(v) => setUsuarioForm({ ...usuarioForm, creditosIniciais: v })} />
              </FormField>
              <FormField label="Créditos disponíveis">
                <NumberInput value={usuarioForm.creditosDisponiveis} onChange={(v) => setUsuarioForm({ ...usuarioForm, creditosDisponiveis: v })} />
              </FormField>
              <FormField label="Créditos comprados">
                <NumberInput value={usuarioForm.creditosCompradosTotal} onChange={(v) => setUsuarioForm({ ...usuarioForm, creditosCompradosTotal: v })} />
              </FormField>
              <FormField label="Créditos utilizados">
                <NumberInput value={usuarioForm.creditosUtilizadosTotal} onChange={(v) => setUsuarioForm({ ...usuarioForm, creditosUtilizadosTotal: v })} />
              </FormField>
              <div className="md:col-span-2">
                <FormField label="Endereço">
                  <Textarea rows={3} value={usuarioForm.endereco ?? ""} onChange={(e) => setUsuarioForm({ ...usuarioForm, endereco: e.target.value })} />
                </FormField>
              </div>

              {/* Seção de senha */}
              <div className="md:col-span-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-slate-600" />
                    <span className="text-sm font-semibold text-slate-800">
                      {editingUsuarioId ? "Redefinição de senha (opcional)" : "Senha provisória"}
                    </span>
                  </div>
                  {editingUsuarioId && (
                    <p className="text-xs text-slate-500">
                      Deixe em branco para manter a senha atual. Preencha para redefinir.
                    </p>
                  )}
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label={editingUsuarioId ? "Nova senha" : "Senha provisória"}>
                      <Input
                        type="password"
                        placeholder="Mín. 8 chars, 1 letra, 1 número"
                        value={usuarioForm.senha}
                        onChange={(e) => setUsuarioForm({ ...usuarioForm, senha: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Confirmar senha">
                      <Input
                        type="password"
                        placeholder="Repita a senha"
                        value={usuarioForm.confirmarSenha}
                        onChange={(e) => setUsuarioForm({ ...usuarioForm, confirmarSenha: e.target.value })}
                      />
                    </FormField>
                  </div>
                  {(usuarioForm.senha || !editingUsuarioId) && (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={usuarioForm.exigirTrocaSenha}
                        onChange={(e) => setUsuarioForm({ ...usuarioForm, exigirTrocaSenha: e.target.checked })}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700">Exigir troca de senha no primeiro acesso</span>
                    </label>
                  )}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                    A senha será armazenada com hash criptográfico (bcrypt). Nunca é visível após salva.
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUsuarioDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveUsuario}
                disabled={createUsuario.isPending || updateUsuario.isPending}>
                {(createUsuario.isPending || updateUsuario.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar usuário
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
