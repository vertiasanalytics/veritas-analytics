import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp, ExternalLink, Info, Search, ChevronDown, ChevronUp,
  BarChart3, CalendarDays, Database, BookOpen, ArrowUpRight, ArrowDownRight,
  Minus, RefreshCw, Download, AlertCircle, CheckCircle2, Clock, Shield,
  FileWarning, Wifi, WifiOff, FileText, Upload, FileCheck, Building2,
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface EmbeddedRecord { period: string; rate: number; accumulated: number; }

interface IndexSeries {
  key: string; name: string; fullName: string;
  source: string; sourceUrl: string; sourceType: string;
  legislation: string; useCase: string;
  startPeriod: string; endPeriod: string; totalRecords: number;
  stats: { avgRate: number; maxRate: number; minRate: number; accumulated: number };
  records: EmbeddedRecord[];
}

interface CatalogueEntry {
  key: string; name: string; fullName: string; description: string;
  sourceType: "official_online" | "official_documental" | "no_official_api";
  source: string; sourceUrl: string | null;
  legislation: string; useCase: string;
  startPeriod: string; endPeriod: string;
  periodicidade: string; engineRole: string; observacao: string | null;
  hasEmbeddedData: boolean; hasPdfData?: boolean;
  hasLiveApi: boolean; syncableTypes: string[];
  embeddedRecords: number; pdfRecords?: number; pdfLastImport?: string | null;
  cachedRecords: number; lastSync: string | null;
}

interface PdfRecord {
  periodo: string; indiceTipo: string; coefEmReal: number;
  fonteDoc: string; importadoEm: string;
}

interface PdfDataResponse {
  success: boolean; rows: PdfRecord[];
  byType: Record<string, number>; total: number; fonte: string;
}

interface SyncResult {
  success: boolean; synced: number; message: string;
  results: Array<{ type: string; count: number; status: string; message?: string }>;
  errors: string[];
}

interface ImportPdfResult {
  success: boolean; inserted: number; updated: number; total: number;
  byType: Record<string, number>; warnings: string[]; skipped: number; fonte: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const INDEX_COLORS: Record<string, { bg: string; badge: string; accent: string; border: string }> = {
  IPCA_E:   { bg: "bg-blue-50 dark:bg-blue-950/30",       badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",         accent: "text-blue-700 dark:text-blue-400",    border: "border-blue-200 dark:border-blue-800"    },
  INPC:     { bg: "bg-emerald-50 dark:bg-emerald-950/30", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200", accent: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800" },
  POUPANCA: { bg: "bg-amber-50 dark:bg-amber-950/30",     badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",     accent: "text-amber-700 dark:text-amber-400",  border: "border-amber-200 dark:border-amber-800"  },
  SELIC:    { bg: "bg-purple-50 dark:bg-purple-950/30",   badge: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", accent: "text-purple-700 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800" },
  IRSM:     { bg: "bg-slate-50 dark:bg-slate-900/30",     badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",     accent: "text-slate-600 dark:text-slate-400",  border: "border-slate-200 dark:border-slate-700"  },
  BTN:      { bg: "bg-orange-50 dark:bg-orange-950/30",   badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", accent: "text-orange-700 dark:text-orange-400",border: "border-orange-200 dark:border-orange-800"},
  OTN:      { bg: "bg-teal-50 dark:bg-teal-950/30",       badge: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",         accent: "text-teal-700 dark:text-teal-400",    border: "border-teal-200 dark:border-teal-800"    },
  ORTN:     { bg: "bg-rose-50 dark:bg-rose-950/30",       badge: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",         accent: "text-rose-700 dark:text-rose-400",    border: "border-rose-200 dark:border-rose-800"    },
  UFIR:     { bg: "bg-violet-50 dark:bg-violet-950/30",   badge: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200", accent: "text-violet-700 dark:text-violet-400",border: "border-violet-200 dark:border-violet-800"},
  IGP_DI:   { bg: "bg-cyan-50 dark:bg-cyan-950/30",       badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",           accent: "text-cyan-700 dark:text-cyan-400",     border: "border-cyan-200 dark:border-cyan-800"    },
};
const DEFAULT_COLORS = INDEX_COLORS["IPCA_E"];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtPeriod(p: string) {
  if (!p) return "";
  const [y, m] = p.split("-");
  const months = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  const mi = parseInt(m) - 1;
  return mi >= 0 && mi < 12 ? `${months[mi]}/${y}` : p;
}
function fmtRate(r: number)  { return `${(r * 100).toFixed(4)}%`; }
function fmtAccum(a: number) { return a.toFixed(6); }
function fmtCoef(c: number)  { return c.toLocaleString("pt-BR", { minimumFractionDigits: 10, maximumFractionDigits: 10 }); }
function fmtDateTime(iso: string) {
  const BRT = "America/Sao_Paulo";
  const normalized = /[Z+]/.test(iso) ? iso : iso.replace(" ", "T") + "Z";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRT, dateStyle: "short", timeStyle: "short",
  }).format(new Date(normalized));
}

function RateIndicator({ rate }: { rate: number }) {
  if (rate > 0.0001) return <span className="flex items-center gap-0.5 text-emerald-600 font-mono text-sm">{fmtRate(rate)} <ArrowUpRight className="w-3 h-3" /></span>;
  if (rate < -0.0001) return <span className="flex items-center gap-0.5 text-red-500 font-mono text-sm">{fmtRate(rate)} <ArrowDownRight className="w-3 h-3" /></span>;
  return <span className="flex items-center gap-0.5 text-muted-foreground font-mono text-sm">{fmtRate(rate)} <Minus className="w-3 h-3" /></span>;
}

function SourceBadge({ sourceType }: { sourceType: string }) {
  if (sourceType === "official_online")
    return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"><Wifi className="w-3 h-3" /> Oficial Online</span>;
  if (sourceType === "official_documental")
    return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"><Shield className="w-3 h-3" /> Documental Oficial</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"><WifiOff className="w-3 h-3" /> Sem API Oficial</span>;
}

function Trf1Badge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-700">
      <FileCheck className="w-3 h-3" /> TRF1 — Tabela Oficial
    </span>
  );
}

function exportCSV(records: EmbeddedRecord[], name: string) {
  const header = "Competência;Taxa (%);Fator Acumulado";
  const rows = records.map((r) => `${fmtPeriod(r.period)};${(r.rate * 100).toFixed(6)};${r.accumulated.toFixed(8)}`);
  const csv  = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href = url; a.download = `${name}_taxas.csv`; a.click();
  URL.revokeObjectURL(url);
}

function exportPdfCSV(rows: PdfRecord[], name: string) {
  const header = "Competência;Índice;Coef. em Real;Fonte";
  const lines  = rows.map((r) => `${fmtPeriod(r.periodo)};${r.indiceTipo};${r.coefEmReal.toFixed(10)};${r.fonteDoc}`);
  const csv    = [header, ...lines].join("\n");
  const blob   = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement("a"); a.href = url; a.download = `${name}_trf1_coef.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// StatCard
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 rounded-lg bg-background border">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-lg font-bold font-mono">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IndexPanel — monthly rates table for indices with embedded data
// ─────────────────────────────────────────────────────────────────────────────

function IndexPanel({ series, isLoading }: { series?: IndexSeries; isLoading: boolean }) {
  const [search, setSearch]         = useState("");
  const [sort, setSort]             = useState<"period" | "rate" | "accumulated">("period");
  const [sortDir, setSortDir]       = useState<"asc" | "desc">("desc");
  const [yearFilter, setYearFilter] = useState("todos");

  const years = useMemo(() => {
    if (!series) return [];
    return [...new Set(series.records.map((r) => r.period.substring(0, 4)))].sort().reverse();
  }, [series]);

  const filtered = useMemo(() => {
    if (!series) return [];
    let rows = series.records;
    if (yearFilter !== "todos") rows = rows.filter((r) => r.period.startsWith(yearFilter));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.period.includes(q) || fmtPeriod(r.period).toLowerCase().includes(q));
    }
    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sort === "period")    cmp = a.period.localeCompare(b.period);
      else if (sort === "rate") cmp = a.rate - b.rate;
      else                      cmp = a.accumulated - b.accumulated;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [series, search, sort, sortDir, yearFilter]);

  const toggleSort = (col: typeof sort) => {
    if (sort === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(col); setSortDir("desc"); }
  };

  const SortIcon = ({ col }: { col: typeof sort }) => {
    if (sort !== col) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  if (isLoading) return <div className="space-y-3 py-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>;
  if (!series) return null;

  const colors = INDEX_COLORS[series.key] ?? DEFAULT_COLORS;

  return (
    <div className="space-y-5">
      <div className={`rounded-xl p-4 ${colors.bg} border ${colors.border}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-xl font-bold ${colors.accent}`}>{series.name}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>{series.totalRecords} registros</span>
              <SourceBadge sourceType={series.sourceType ?? "official_online"} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{series.fullName}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => exportCSV(series.records, series.name)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border ${colors.border} hover:bg-background/80 transition-colors ${colors.accent}`}>
              <Download className="w-3 h-3" /> Exportar CSV
            </button>
            <a href={series.sourceUrl} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-1.5 text-xs font-medium underline-offset-2 hover:underline ${colors.accent}`}>
              <Database className="w-3.5 h-3.5" />{series.source}<ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <StatCard label="Período" value={`${fmtPeriod(series.startPeriod)} — ${fmtPeriod(series.endPeriod)}`} />
          <StatCard label="Taxa Média Mensal" value={fmtRate(series.stats.avgRate)} />
          <StatCard label="Fator Acumulado" value={`× ${fmtAccum(series.stats.accumulated)}`} sub="multiplicador do período completo" />
          <StatCard label="Máxima / Mínima" value={`${fmtRate(series.stats.maxRate)} / ${fmtRate(series.stats.minRate)}`} />
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <BookOpen className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span><strong>Fundamentação legal:</strong> {series.legislation}</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span><strong>Aplicação:</strong> {series.useCase}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Filtrar por competência (ex: 2010, jan/2005...)" className="pl-9 h-9 text-sm"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue placeholder="Ano" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os anos</SelectItem>
            {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} de {series.records.length} registros</span>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <ScrollArea className="h-[480px]">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
              <TableRow>
                <TableHead className="w-[130px] cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("period")}>
                  <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />Competência <SortIcon col="period" /></span>
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("rate")}>
                  <span className="flex items-center justify-end gap-1">Taxa Mensal <SortIcon col="rate" /></span>
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("accumulated")}>
                  <span className="flex items-center justify-end gap-1">Fator Acumulado <SortIcon col="accumulated" /></span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell></TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.period} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-sm">{fmtPeriod(r.period)}</TableCell>
                    <TableCell className="text-right"><RateIndicator rate={r.rate} /></TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">× {fmtAccum(r.accumulated)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PdfDataPanel — for indices with data imported from TRF1 PDF
// ─────────────────────────────────────────────────────────────────────────────

function PdfDataPanel({
  entry, pdfData, isLoading,
}: {
  entry: CatalogueEntry;
  pdfData?: PdfDataResponse;
  isLoading: boolean;
}) {
  const [search, setSearch]         = useState("");
  const [yearFilter, setYearFilter] = useState("todos");
  const [sortDir, setSortDir]       = useState<"asc" | "desc">("desc");

  const colors = INDEX_COLORS[entry.key] ?? DEFAULT_COLORS;
  const rows   = pdfData?.rows ?? [];

  const years = useMemo(
    () => [...new Set(rows.map((r) => r.periodo.substring(0, 4)))].sort().reverse(),
    [rows],
  );

  const filtered = useMemo(() => {
    let data = rows;
    if (yearFilter !== "todos") data = data.filter((r) => r.periodo.startsWith(yearFilter));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((r) => r.periodo.includes(q) || fmtPeriod(r.periodo).toLowerCase().includes(q));
    }
    return [...data].sort((a, b) => {
      const cmp = a.periodo.localeCompare(b.periodo);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, search, yearFilter, sortDir]);

  if (isLoading) return <div className="space-y-3 py-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>;

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className={`rounded-xl p-4 ${colors.bg} border ${colors.border}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-xl font-bold ${colors.accent}`}>{entry.name}</h2>
              {rows.length > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>{rows.length} registros</span>
              )}
              <SourceBadge sourceType={entry.sourceType} />
              {rows.length > 0 && entry.key !== "IRSM" && <Trf1Badge />}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{entry.fullName}</p>
          </div>
          {rows.length > 0 && (
            <button onClick={() => exportPdfCSV(rows, entry.name)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border ${colors.border} hover:bg-background/80 transition-colors ${colors.accent}`}>
              <Download className="w-3 h-3" /> Exportar CSV
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
          <StatCard label="Vigência" value={`${fmtPeriod(entry.startPeriod)} — ${fmtPeriod(entry.endPeriod)}`} />
          <StatCard label="Periodicidade" value={entry.periodicidade} />
          <StatCard label="Registros importados"
            value={rows.length > 0 ? String(rows.length) : "0"}
            sub={rows.length === 0 ? "aguardando importação"
              : entry.key === "IRSM" ? "Tabela IBGE (série histórica)"
              : "Tabela TRF1 (PDF oficial)"} />
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <BookOpen className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span><strong>Fundamentação legal:</strong> {entry.legislation}</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span><strong>Aplicação:</strong> {entry.useCase}</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <TrendingUp className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span><strong>Motor (engine):</strong> {entry.engineRole}</span>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-5">
          <div className="flex items-start gap-3">
            <FileWarning className="w-5 h-5 mt-0.5 text-slate-500 shrink-0" />
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Dados não importados</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {entry.key === "IRSM"
                  ? <>Os dados históricos do IRSM (IBGE) ainda não foram importados. Clique em{" "}<strong>"Importar Tabela TRF1"</strong> no cabeçalho da página — o processo também carrega automaticamente os 34 registros do IRSM (dez/1991 a jun/1994).</>
                  : <>Os dados do PDF TRF1 ainda não foram importados para este índice. Clique em{" "}<strong>"Importar Tabela TRF1"</strong> no cabeçalho da página para carregar os registros históricos.</>
                }
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Origin notice */}
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Origem Documental Oficial</p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-0.5">
                  {entry.key === "IRSM"
                    ? "IBGE — Diretoria de Pesquisas, Departamento de Índices de Preços, Sistema Nacional de Índices de Preços ao Consumidor"
                    : (pdfData?.fonte ?? "TRF1 — Tabela de Índices Mensais (AesCveisemGeral)")}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {entry.key === "IRSM"
                    ? <>Coluna <strong>Nº Índice (dez/93=100)</strong>: valor acumulado do IRSM com base DEZ/1993 = 100.
                        Meses jun–ago/1992 e mai–jun/1993 com variações arbitradas pelo governo.
                        Set/1992 e jul/1993 são meses residuais apurados por subtração (Portaria 478/1992 e IN IBGE).</>
                    : <>Coluna <strong>Coef. em Real</strong>: fator acumulado de atualização monetária, representando
                        o multiplicador necessário para converter o valor nominal daquele mês para Reais (BRL).
                        Utilizado no cálculo do fator B<sub>conv</sub> do motor de correção monetária.</>
                  }
                </p>
                {rows[0]?.importadoEm && (
                  <p className="text-xs text-blue-500 dark:text-blue-400 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Importado em {fmtDateTime(rows[0].importadoEm)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Filtrar por competência (ex: 1985, jul/1967...)" className="pl-9 h-9 text-sm"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue placeholder="Ano" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os anos</SelectItem>
                {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <button
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-input hover:bg-muted transition-colors text-muted-foreground"
            >
              {sortDir === "desc" ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              {sortDir === "desc" ? "Mais recente primeiro" : "Mais antigo primeiro"}
            </button>
            <span className="text-xs text-muted-foreground">{filtered.length} de {rows.length} registros</span>
          </div>

          {/* Table */}
          <div className="rounded-lg border overflow-hidden">
            <ScrollArea className="h-[480px]">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                  <TableRow>
                    <TableHead className="w-[120px]">
                      <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />Competência</span>
                    </TableHead>
                    <TableHead className="w-[90px] text-center">Índice</TableHead>
                    <TableHead className="text-right">
                      {entry.key === "IRSM" ? "Nº Índice (dez/93=100)" : "Coef. em Real"}
                    </TableHead>
                    <TableHead className="hidden md:table-cell text-xs text-muted-foreground font-normal">
                      <span className="flex items-center justify-end gap-1"><FileCheck className="w-3 h-3" />Origem</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell></TableRow>
                  ) : (
                    filtered.map((r) => (
                      <TableRow key={`${r.periodo}-${r.indiceTipo}`} className="hover:bg-muted/40">
                        <TableCell className="font-mono text-sm">{fmtPeriod(r.periodo)}</TableCell>
                        <TableCell className="text-center">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${colors.badge}`}>{r.indiceTipo}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">{fmtCoef(r.coefEmReal)}</TableCell>
                        <TableCell className="hidden md:table-cell text-right">
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                            <FileCheck className="w-3 h-3" />
                            {entry.key === "IRSM" ? "IBGE Oficial" : "TRF1 Oficial"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HistoricalInfoPanel — for indices without any embedded/PDF data (IRSM)
// ─────────────────────────────────────────────────────────────────────────────

function HistoricalInfoPanel({ entry }: { entry: CatalogueEntry }) {
  const colors = INDEX_COLORS[entry.key] ?? DEFAULT_COLORS;
  return (
    <div className="space-y-5">
      <div className={`rounded-xl p-5 ${colors.bg} border ${colors.border}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-xl font-bold ${colors.accent}`}>{entry.name}</h2>
              <SourceBadge sourceType={entry.sourceType} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{entry.fullName}</p>
          </div>
          {entry.sourceUrl && (
            <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-1.5 text-xs font-medium underline-offset-2 hover:underline ${colors.accent}`}>
              <Database className="w-3.5 h-3.5" />Ver fonte<ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
          <StatCard label="Vigência" value={`${fmtPeriod(entry.startPeriod)} — ${fmtPeriod(entry.endPeriod)}`} />
          <StatCard label="Periodicidade" value={entry.periodicidade} />
          <StatCard label="Registros no Cache" value={entry.cachedRecords > 0 ? String(entry.cachedRecords) : "—"} sub={entry.cachedRecords === 0 ? "sem dados sincronizados" : undefined} />
        </div>
      </div>

      <div className="rounded-xl border p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
          <div><p className="text-sm font-medium">Descrição</p><p className="text-sm text-muted-foreground mt-0.5">{entry.description}</p></div>
        </div>
        <Separator />
        <div className="flex items-start gap-3">
          <BookOpen className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
          <div><p className="text-sm font-medium">Fundamentação legal</p><p className="text-sm text-muted-foreground mt-0.5">{entry.legislation}</p></div>
        </div>
        <Separator />
        <div className="flex items-start gap-3">
          <BarChart3 className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
          <div><p className="text-sm font-medium">Aplicação nos cálculos judiciais</p><p className="text-sm text-muted-foreground mt-0.5">{entry.useCase}</p></div>
        </div>
        <Separator />
        <div className="flex items-start gap-3">
          <TrendingUp className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
          <div><p className="text-sm font-medium">Papel no motor de cálculo (engine)</p><p className="text-sm text-muted-foreground mt-0.5">{entry.engineRole}</p></div>
        </div>
        {entry.observacao && (
          <>
            <Separator />
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Observação sobre a fonte</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">{entry.observacao}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {!entry.hasLiveApi && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-4">
          <div className="flex items-start gap-3">
            <FileWarning className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Disponibilidade via API online</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Este índice <strong>não possui endpoint de API governamental online</strong> para consulta automática.
                Os valores históricos estão disponíveis em publicações do BCB/IBGE validadas conforme o{" "}
                <strong>Manual de Cálculos da Justiça Federal (CJF 2025)</strong>.
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Para fins de cálculo judicial, o motor utiliza os fatores de conversão (B<sub>conv</sub>) pré-calculados
                a partir dessas séries históricas validadas.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LiveDataPanel — exibe dados cacheados do BD para índices com API online
// ─────────────────────────────────────────────────────────────────────────────

interface CachedIndexRow { id: number; indexType: string; period: string; rate: number; source: string; fetchedAt: string; }
interface CachedIndexResponse { success: boolean; indexes: CachedIndexRow[]; total: number; }

function LiveDataPanel({ entry }: { entry: CatalogueEntry }) {
  const colors = INDEX_COLORS[entry.key] ?? DEFAULT_COLORS;
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading } = useQuery<CachedIndexResponse>({
    queryKey: ["indexes-cached", entry.key],
    queryFn: () => fetch(`${API_BASE}/api/indexes?type=${entry.key}`).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const rows = data?.indexes ?? [];
  const filtered = search
    ? rows.filter((r) => r.period.includes(search))
    : rows;
  const displayed = showAll ? filtered : filtered.slice(-60).reverse();
  const rates = rows.map((r) => r.rate * 100);
  const avg = rates.length ? rates.reduce((s, v) => s + v, 0) / rates.length : 0;
  const max = rates.length ? Math.max(...rates) : 0;
  const min = rates.length ? Math.min(...rates) : 0;

  return (
    <div className="space-y-5">
      <div className={`rounded-xl p-5 ${colors.bg} border ${colors.border}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-xl font-bold ${colors.accent}`}>{entry.name}</h2>
              <SourceBadge sourceType={entry.sourceType} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{entry.fullName}</p>
          </div>
          {entry.sourceUrl && (
            <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-1.5 text-xs font-medium underline-offset-2 hover:underline ${colors.accent}`}>
              <Database className="w-3.5 h-3.5" />Ver fonte<ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <StatCard label="Vigência" value={`${fmtPeriod(entry.startPeriod)} — ${fmtPeriod(entry.endPeriod)}`} />
          <StatCard label="Registros no BD" value={isLoading ? "..." : String(rows.length)} sub={entry.cachedRecords === 0 ? "sincronize para obter dados" : undefined} />
          <StatCard label="Média mensal" value={rates.length ? `${avg.toFixed(4)}%` : "—"} />
          <StatCard label="Variação" value={rates.length ? `min ${min.toFixed(2)}% / max ${max.toFixed(2)}%` : "—"} />
        </div>
      </div>

      <div className="rounded-xl border p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
          <div><p className="text-sm font-medium">Descrição</p><p className="text-sm text-muted-foreground mt-0.5">{entry.description}</p></div>
        </div>
        <Separator />
        <div className="flex items-start gap-3">
          <BookOpen className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
          <div><p className="text-sm font-medium">Fundamentação legal</p><p className="text-sm text-muted-foreground mt-0.5">{entry.legislation}</p></div>
        </div>
        {entry.observacao && (
          <>
            <Separator />
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Observação</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">{entry.observacao}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {rows.length === 0 && !isLoading && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Nenhum dado sincronizado ainda</p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">Use o botão "Sincronizar Fontes Oficiais" para baixar os dados da API do Banco Central (SGS série 190). O período padrão é de 2 anos.</p>
          </div>
        </div>
      )}

      {(isLoading || rows.length > 0) && (
        <div className="rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30">
            <p className="text-sm font-medium">Série histórica sincronizada</p>
            <Input
              placeholder="Filtrar por período (ex: 2024-01)"
              className="h-7 text-xs w-52"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ScrollArea className="h-80">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead className="py-2 text-xs">Competência</TableHead>
                  <TableHead className="py-2 text-xs text-right">Taxa mensal (%)</TableHead>
                  <TableHead className="py-2 text-xs hidden md:table-cell">Fonte</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                    ))
                  : displayed.map((row) => {
                      const pct = row.rate * 100;
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="py-1.5 text-xs font-mono font-medium">{fmtPeriod(row.period)}</TableCell>
                          <TableCell className="py-1.5 text-xs text-right tabular-nums font-semibold">
                            <span className={pct > 0 ? "text-red-600 dark:text-red-400" : pct < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}>
                              {pct >= 0 ? "+" : ""}{pct.toFixed(4)}%
                            </span>
                          </TableCell>
                          <TableCell className="py-1.5 text-[10px] text-muted-foreground hidden md:table-cell truncate max-w-[200px]">{row.source}</TableCell>
                        </TableRow>
                      );
                    })
                }
              </TableBody>
            </Table>
          </ScrollArea>
          {filtered.length > 60 && (
            <div className="px-4 py-2 border-t text-center">
              <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => setShowAll((v) => !v)}>
                {showAll ? <><ChevronUp className="w-3 h-3" />Mostrar últimos 60</> : <><ChevronDown className="w-3 h-3" />Ver todos os {filtered.length} registros</>}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CatalogueCard
// ─────────────────────────────────────────────────────────────────────────────

function CatalogueCard({ entry, isActive, onClick }: { entry: CatalogueEntry; isActive: boolean; onClick: () => void }) {
  const colors = INDEX_COLORS[entry.key] ?? DEFAULT_COLORS;
  return (
    <button onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all cursor-pointer hover:shadow-md ${
        isActive ? `${colors.bg} ${colors.border} shadow-sm ring-2 ring-primary/30` : "bg-card border-border hover:border-muted-foreground/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-base font-bold ${isActive ? colors.accent : ""}`}>{entry.name}</span>
            <SourceBadge sourceType={entry.sourceType} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.fullName}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="w-3 h-3 shrink-0" />
          <span className="font-mono">{fmtPeriod(entry.startPeriod)} — {fmtPeriod(entry.endPeriod)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Database className="w-3 h-3 shrink-0" />
          {entry.hasEmbeddedData
            ? <span>{entry.embeddedRecords} reg. embarcados</span>
            : entry.pdfRecords && entry.pdfRecords > 0
              ? <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1"><FileCheck className="w-3 h-3" />{entry.pdfRecords} reg. TRF1</span>
              : entry.cachedRecords > 0
                ? <span className="text-emerald-600 dark:text-emerald-400">{entry.cachedRecords} reg. sincronizados</span>
                : <span className="italic">Sem dados embarcados</span>
          }
        </div>
        {entry.lastSync ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3 shrink-0" /><span>Sincronizado {fmtDateTime(entry.lastSync)}</span>
          </div>
        ) : entry.pdfLastImport ? (
          <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
            <FileCheck className="w-3 h-3 shrink-0" /><span>TRF1 {fmtDateTime(entry.pdfLastImport)}</span>
          </div>
        ) : entry.hasLiveApi ? (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <Clock className="w-3 h-3 shrink-0" /><span>Aguardando sincronização</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <WifiOff className="w-3 h-3 shrink-0" /><span>Sem API online disponível</span>
          </div>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

const PDF_DATA_TYPES = ["ORTN", "OTN", "BTN", "UFIR", "IPCA_E", "IRSM"];

export default function IndicesPage() {
  const queryClient = useQueryClient();
  const { toast }   = useToast();
  const [activeTab, setActiveTab] = useState("IPCA_E");

  const { data: embeddedData, isLoading: embLoading } = useQuery<{ success: boolean; indices: IndexSeries[] }>({
    queryKey: ["indexes-embedded"],
    queryFn: () => fetch(`${API_BASE}/api/indexes/embedded`).then((r) => r.json()),
    staleTime: 30 * 60 * 1000,
  });

  const { data: catalogueData, isLoading: catLoading } = useQuery<{ success: boolean; catalogue: CatalogueEntry[] }>({
    queryKey: ["indexes-catalogue"],
    queryFn: () => fetch(`${API_BASE}/api/indexes/catalogue`).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: pdfData, isLoading: pdfLoading } = useQuery<PdfDataResponse>({
    queryKey: ["indexes-pdf-all"],
    queryFn: () => fetch(`${API_BASE}/api/indexes/pdf-data`).then((r) => r.json()),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const syncMutation = useMutation<SyncResult, Error, string>({
    mutationFn: (indexType) =>
      fetch(`${API_BASE}/api/indexes/sync`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ indexType }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["indexes-catalogue"] });
      if (data.success) toast({ title: "Sincronização concluída", description: data.message });
      else toast({ title: "Sincronização parcial", description: data.errors.slice(0, 2).join("; "), variant: "destructive" });
    },
    onError: (err) => toast({ title: "Erro na sincronização", description: err.message, variant: "destructive" }),
  });

  const importPdfMutation = useMutation<ImportPdfResult, Error>({
    mutationFn: () =>
      fetch(`${API_BASE}/api/indexes/import-pdf`, {
        method: "POST", headers: { "Content-Type": "application/json" },
      }).then((r) => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["indexes-catalogue"] });
      queryClient.invalidateQueries({ queryKey: ["indexes-pdf-all"] });
      if (data.success) {
        const types = Object.entries(data.byType).map(([t, n]) => `${t}: ${n}`).join(", ");
        toast({
          title: "Tabela TRF1 importada",
          description: `${data.inserted} inseridos, ${data.updated} atualizados — ${types}`,
        });
      } else {
        toast({ title: "Erro na importação", description: "Falha ao importar dados do PDF", variant: "destructive" });
      }
    },
    onError: (err) => toast({ title: "Erro na importação", description: err.message, variant: "destructive" }),
  });

  const embeddedMap = useMemo(() => {
    const m = new Map<string, IndexSeries>();
    for (const s of (embeddedData?.indices ?? [])) m.set(s.key, s);
    return m;
  }, [embeddedData]);

  const pdfByType = useMemo(() => {
    const m = new Map<string, PdfRecord[]>();
    for (const r of (pdfData?.rows ?? [])) {
      const arr = m.get(r.indiceTipo) ?? [];
      arr.push(r);
      m.set(r.indiceTipo, arr);
    }
    return m;
  }, [pdfData]);

  const catalogue   = catalogueData?.catalogue ?? [];
  const isLoading   = embLoading || catLoading;
  const isSyncing   = syncMutation.isPending;
  const isImporting = importPdfMutation.isPending;

  const handleSyncAll    = useCallback(() => syncMutation.mutate("ALL"), [syncMutation]);
  const handleImportPdf  = useCallback(() => importPdfMutation.mutate(), [importPdfMutation]);

  const onlineCount   = catalogue.filter((c) => c.sourceType === "official_online").length;
  const noApiCount    = catalogue.filter((c) => c.sourceType === "no_official_api").length;
  const syncedCount   = catalogue.filter((c) => c.lastSync !== null).length;
  const pdfTotalCount = catalogue.reduce((s, c) => s + (c.pdfRecords ?? 0), 0);

  function renderTabContent(entry: CatalogueEntry) {
    if (entry.hasEmbeddedData) {
      return <IndexPanel series={embeddedMap.get(entry.key)} isLoading={embLoading} />;
    }
    if (PDF_DATA_TYPES.includes(entry.key)) {
      const typeRows = pdfByType.get(entry.key) ?? [];
      const panelData: PdfDataResponse = {
        success: true, rows: typeRows,
        byType: { [entry.key]: typeRows.length },
        total: typeRows.length,
        fonte: "TRF1 — Tabela de Índices Mensais (AesCveisemGeral)",
      };
      return <PdfDataPanel entry={entry} pdfData={panelData} isLoading={pdfLoading} />;
    }
    if (entry.hasLiveApi) {
      return <LiveDataPanel entry={entry} />;
    }
    return <HistoricalInfoPanel entry={entry} />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Índices Econômicos</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Catálogo completo dos índices utilizados em cálculos da Justiça Federal — Manual CJF 2025
          </p>
        </div>
        <div className="flex items-center gap-2 self-start flex-wrap">
          <Button variant="outline" size="sm" onClick={handleImportPdf} disabled={isImporting || isLoading} className="gap-2">
            <Upload className={`w-4 h-4 ${isImporting ? "animate-pulse" : ""}`} />
            {isImporting ? "Importando..." : "Importar Tabela TRF1"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSyncAll} disabled={isSyncing} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar Fontes Oficiais"}
          </Button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total de Índices",     value: catalogue.length || 9, icon: Database,   color: "text-primary"     },
          { label: "Fonte Oficial Online", value: onlineCount || 4,      icon: Wifi,       color: "text-emerald-600" },
          { label: "Sem API Online",       value: noApiCount || 1,       icon: WifiOff,    color: "text-slate-500"   },
          { label: "Registros TRF1 (PDF)", value: pdfTotalCount,         icon: FileCheck,  color: "text-blue-600"    },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="py-3">
            <CardContent className="px-4 py-0 flex items-center gap-3">
              <Icon className={`w-5 h-5 shrink-0 ${color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold font-mono">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Catalogue grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" /> Catálogo de Índices
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Clique em um índice para ver detalhes, séries históricas e fundamentação legal
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:grid-cols-5">
              {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:grid-cols-5">
              {catalogue.map((entry) => (
                <CatalogueCard key={entry.key} entry={entry} isActive={activeTab === entry.key}
                  onClick={() => setActiveTab(entry.key)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Detail tabs */}
      <Card>
        <CardContent className="p-5">
          {isLoading ? (
            <div className="space-y-3 py-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <ScrollArea className="w-full">
                <TabsList className="mb-5 flex-wrap h-auto gap-1">
                  {catalogue.map((entry) => (
                    <TabsTrigger key={entry.key} value={entry.key} className="px-4">
                      {entry.name}
                      {!entry.hasEmbeddedData && entry.pdfRecords && entry.pdfRecords > 0
                        ? <span className="ml-1.5 text-[10px] text-blue-500 font-medium">TRF1</span>
                        : !entry.hasEmbeddedData
                          ? <span className="ml-1.5 text-[10px] opacity-50">hist.</span>
                          : null
                      }
                    </TabsTrigger>
                  ))}
                </TabsList>
              </ScrollArea>

              {catalogue.map((entry) => (
                <TabsContent key={entry.key} value={entry.key} className="mt-0">
                  {renderTabContent(entry)}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Import result */}
      {importPdfMutation.data && (
        <Card className={importPdfMutation.data.success ? "border-blue-200" : "border-red-200"}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {importPdfMutation.data.success
                ? <FileCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                : <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              }
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {importPdfMutation.data.success
                    ? `Tabela TRF1 importada — ${importPdfMutation.data.inserted} inseridos, ${importPdfMutation.data.updated} atualizados (${importPdfMutation.data.total} total)`
                    : "Falha na importação do PDF"
                  }
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(importPdfMutation.data.byType).map(([t, n]) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800">
                      {t}: {n} reg.
                    </span>
                  ))}
                </div>
                {importPdfMutation.data.warnings.length > 0 && (
                  <p className="text-xs text-amber-700">
                    {importPdfMutation.data.warnings.length} aviso(s): {importPdfMutation.data.warnings.slice(0, 2).join("; ")}
                    {importPdfMutation.data.warnings.length > 2 ? "..." : ""}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Fonte: {importPdfMutation.data.fonte} · {importPdfMutation.data.skipped} linhas ignoradas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync result */}
      {syncMutation.data && (
        <Card className={syncMutation.data.success ? "border-emerald-200" : "border-amber-200"}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {syncMutation.data.success
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                : <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              }
              <div className="space-y-2">
                <p className="text-sm font-medium">{syncMutation.data.message}</p>
                <div className="flex flex-wrap gap-2">
                  {syncMutation.data.results.map((r) => (
                    <span key={r.type} className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                      {r.type}: {r.status === "ok" ? `${r.count} reg.` : "erro"}
                    </span>
                  ))}
                </div>
                {syncMutation.data.errors.length > 0 && (
                  <ul className="text-xs space-y-0.5">
                    {syncMutation.data.errors.map((e, i) => <li key={i} className="text-amber-700">⚠ {e}</li>)}
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TJMG — Índice Estadual */}
      <Separator />
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-700" />
            Índices Estaduais — TJMG (ICGJ)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Fator de Atualização Monetária do TJMG — tabela de fatores acumulados utilizada em liquidações na Justiça Estadual de Minas Gerais
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border border-blue-200 bg-white p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Índice</p>
                <p className="font-semibold text-blue-800">ICGJ/TJMG</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-white p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Fonte</p>
                <p className="font-semibold">Portal TJMG</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-white p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Aplicação</p>
                <p className="font-semibold">Liquidação estadual MG</p>
              </div>
            </div>
            <Link href="/indicadores/tjmg">
              <Button className="gap-2 bg-blue-700 hover:bg-blue-800 text-white whitespace-nowrap">
                <BarChart3 className="w-4 h-4" />
                Acessar Índice TJMG
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-xs text-muted-foreground border-t pt-4 space-y-2">
        <p className="font-semibold">Sobre os dados e fontes</p>
        <p>
          Os índices com <strong>Fonte Oficial Online</strong> (IPCA-E, INPC, SELIC, Poupança) são obtidos
          de APIs governamentais: <strong>IBGE SIDRA</strong> (séries 13522 e 188) e <strong>BCB SGS</strong> (séries 4390 e 195).
          Os dados históricos embarcados cobrem 07/1994 — 11/2021 para IPCA-E/INPC, e 12/2021 — atualidade para SELIC.
        </p>
        <p>
          Os índices <strong>ORTN, OTN, BTN, UFIR</strong> têm dados importados diretamente da{" "}
          <strong>Tabela de Índices Mensais TRF1 (AesCveisemGeral)</strong>, documento oficial com coeficientes
          em Real acumulados. O <strong>IRSM</strong> (fev/1992–jan/1993) não possui fonte documental digital
          estruturada disponível e utiliza fatores pré-calculados no motor (B<sub>conv</sub>).
        </p>
        <p className="italic">
          Nota: a coluna <strong>Coef. em Real</strong> da tabela TRF1 representa o fator acumulado de atualização
          monetária — não a variação percentual mensal. Para converter um valor nominal de determinado mês para
          Reais, multiplica-se pelo coeficiente correspondente ao mês da competência.
        </p>
      </div>
    </div>
  );
}
