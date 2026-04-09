import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch, useLocation } from "wouter";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useDebitCredits } from "@/hooks/use-wallet";
import {
  Landmark, FilePlus2, FolderOpen, Settings, Plus, RefreshCw, Download,
  CheckCircle2, BarChart3, TrendingUp, AlertCircle, Search, MoreVertical,
  User, Scale, PercentCircle, FileText, ClipboardList, ChevronRight,
  Table as TableIcon, LineChart as LineChartIcon, Upload, KeyRound, Copy, Loader2,
  Share2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

import { buildLaudoPrevidenciario } from "@/modules/previdenciario";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface BenefitConfig {
  nome: string; nb: string; especie: string;
  dib: string; dip: string; der: string; dataSentenca: string; dataCalculo: string;
  tcAnos: number; tcMeses: number; tcDias: number;
  usarMedia80: boolean; coeficienteRmi: number;
  aplicarTeto: boolean; tetoRmi: number;
  usarRmiManual: boolean; rmiManual: number;
}

interface SalaryRow  { competencia: string; valorOriginal: number; }
interface RateRow    { competencia: string; taxa: number; }
interface PaymentRow { competencia: string; valorPago: number; }

interface JurosConfig {
  tipo: "simples" | "composto" | "nenhum";
  taxaMensal: number;
  termoInicial: "competencia" | "citacao";
  dataCitacao: string;
}

interface PrescricaoConfig { aplicar: boolean; marcoInterruptivo: string; anos: number; }

// ─────────────────────────────────────────────────────────────────────────────
// Prescrição Quinquenal — Tipos
// ─────────────────────────────────────────────────────────────────────────────
type QCalculationMode = "integral" | "quinquenio";

interface QMonthlyDifference {
  id: string;
  competencia: string;
  rubrica: string;
  valorOriginal: number;
  valorCorrigido?: number;
  juros?: number;
  total?: number;
}

interface QParsedCompetencia {
  year: number; month: number; key: string; label: string; date: Date;
}

interface QFilteredRow extends QMonthlyDifference {
  parsed: QParsedCompetencia;
  valorConsiderado: number;
  statusPrescricao: "EXIGIVEL" | "PRESCRITO";
}

interface QSummary {
  totalIntegral: number; totalExigivel: number; totalPrescrito: number;
  quantidadeIntegral: number; quantidadeExigivel: number; quantidadePrescrita: number;
  competenciaInicialIntegral?: string; competenciaFinalIntegral?: string;
  competenciaInicialExigivel?: string; competenciaFinalExigivel?: string;
  dataCorte: string | null;
}

interface SalaryResult {
  competencia: string; valorOriginal: number;
  moeda: string; fatorMoeda: number; valorEmReal: number;
  fatorCorrecao: number; valorCorrigido: number; considerado: boolean;
  indice: string;
}

interface RmaRow {
  competencia: string; valorRma: number; taxaReajuste: number;
  origemReajuste: string;   // Ex: "RMI inicial" | "Reajuste anual 2024 (INPC 12m)" | "Sem reajuste"
}

interface AtrasadoRow {
  competencia: string; valorDevido: number; valorPago: number;
  diferenca: number; fatorCorrecao: number; valorCorrigido: number;
  juros: number; totalAtualizado: number; observacao: string;
  origemValorBase: string;  // Ex: "RMI inicial" | "Após reajuste jan/2024"
}

interface CalcResult {
  sb: number; rmi: number; rmaAtual: number;
  totalBruto: number; totalCorrigido: number; totalJuros: number; totalAtualizado: number;
  salariosCorrigidos: SalaryResult[];
  rmaEvolution: RmaRow[];
  atrasados: AtrasadoRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine helpers — BUG FIX: renamed param to avoid shadowing toYM function
// ─────────────────────────────────────────────────────────────────────────────

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  r.setDate(1);
  return r;
}

function parseYM(s: string): Date {
  const clean = s.substring(0, 7);
  const [y, m] = clean.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

function toYM(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthsBetween(startYM: string, endYM: string): string[] {
  const out: string[] = [];
  let cur = parseYM(startYM);
  const end = parseYM(endYM);
  while (cur <= end) { out.push(toYM(cur)); cur = addMonths(cur, 1); }
  return out;
}

function buildRateMap(rates: RateRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rates) m.set(r.competencia.substring(0, 7), r.taxa);
  return m;
}

// ──── BUGFIX: param renamed from `toYM` → `endKey` to avoid shadowing the function
function fatorAcumulado(rateMap: Map<string, number>, fromKey: string, endKey: string): number {
  let fator = 1;
  let cur = addMonths(parseYM(fromKey), 1);
  const end = parseYM(endKey);
  while (cur <= end) {
    fator *= (1 + (rateMap.get(toYM(cur)) ?? 0));
    cur = addMonths(cur, 1);
  }
  return fator;
}

function r2(v: number) { return Math.round(v * 100) / 100; }

// ─────────────────────────────────────────────────────────────────────────────
// Prescrição Quinquenal — Funções puras
// ─────────────────────────────────────────────────────────────────────────────
const Q_MONTHS: Record<string, number> = { jan:1, fev:2, mar:3, abr:4, mai:5, jun:6, jul:7, ago:8, set:9, out:10, nov:11, dez:12 };
const Q_MONTH_LABELS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function qToMonthLabel(year: number, month: number): string {
  return `${Q_MONTH_LABELS[month - 1]}/${year}`;
}

function qParseCompetencia(input: string): QParsedCompetencia | null {
  const raw = input.trim().toLowerCase();
  // YYYY-MM (ISO — resultado do engine interno)
  const iso = raw.match(/^(\d{4})-(\d{2})$/);
  if (iso) {
    const year = Number(iso[1]), month = Number(iso[2]);
    if (month < 1 || month > 12) return null;
    return { year, month, key: raw, label: qToMonthLabel(year, month), date: new Date(year, month - 1, 1) };
  }
  // MM/AAAA ou MM/AA
  const slashNum = raw.match(/^(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slashNum) {
    const month = Number(slashNum[1]);
    let year = Number(slashNum[2]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    if (month < 1 || month > 12) return null;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    return { year, month, key, label: qToMonthLabel(year, month), date: new Date(year, month - 1, 1) };
  }
  // jan/AA ou jan/AAAA
  const slashNamed = raw.match(/^([a-zç]{3})\/(\d{2}|\d{4})$/i);
  if (slashNamed) {
    const month = Q_MONTHS[slashNamed[1] as keyof typeof Q_MONTHS];
    let year = Number(slashNamed[2]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    if (!month) return null;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    return { year, month, key, label: qToMonthLabel(year, month), date: new Date(year, month - 1, 1) };
  }
  return null;
}

function qGetQuinquenioStart(ajuizamento: string): Date | null {
  if (!ajuizamento) return null;
  const date = new Date(`${ajuizamento}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear() - 5, date.getMonth(), 1);
}

function qGetConsideredValue(row: QMonthlyDifference): number {
  if (typeof row.total === "number" && row.total > 0) return row.total;
  if (typeof row.valorCorrigido === "number" || typeof row.juros === "number") {
    return (row.valorCorrigido || 0) + (row.juros || 0);
  }
  return row.valorOriginal || 0;
}

function qApplyPrescription(
  rows: QMonthlyDifference[],
  mode: QCalculationMode,
  ajuizamento: string,
): { detailedRows: QFilteredRow[]; summary: QSummary } {
  const parsed = rows.map((row) => {
    const p = qParseCompetencia(row.competencia);
    if (!p) return null;
    return { row, parsed: p, valorConsiderado: qGetConsideredValue(row) };
  }).filter(Boolean) as Array<{ row: QMonthlyDifference; parsed: QParsedCompetencia; valorConsiderado: number }>;

  const sorted = [...parsed].sort((a, b) => a.parsed.date.getTime() - b.parsed.date.getTime());
  const startDate = mode === "quinquenio" ? qGetQuinquenioStart(ajuizamento) : null;

  const detailedRows: QFilteredRow[] = sorted.map(({ row, parsed: p, valorConsiderado }) => ({
    ...row,
    parsed: p,
    valorConsiderado,
    statusPrescricao: (!startDate || p.date.getTime() >= startDate.getTime()) ? "EXIGIVEL" : "PRESCRITO",
  }));

  const exigiveis = detailedRows.filter((r) => r.statusPrescricao === "EXIGIVEL");
  const prescritas = detailedRows.filter((r) => r.statusPrescricao === "PRESCRITO");

  return {
    detailedRows,
    summary: {
      totalIntegral:  detailedRows.reduce((a, r) => a + r.valorConsiderado, 0),
      totalExigivel:  exigiveis.reduce((a, r) => a + r.valorConsiderado, 0),
      totalPrescrito: prescritas.reduce((a, r) => a + r.valorConsiderado, 0),
      quantidadeIntegral:  detailedRows.length,
      quantidadeExigivel:  exigiveis.length,
      quantidadePrescrita: prescritas.length,
      competenciaInicialIntegral: detailedRows[0]?.parsed.label,
      competenciaFinalIntegral:   detailedRows[detailedRows.length - 1]?.parsed.label,
      competenciaInicialExigivel: exigiveis[0]?.parsed.label,
      competenciaFinalExigivel:   exigiveis[exigiveis.length - 1]?.parsed.label,
      dataCorte: startDate ? qToMonthLabel(startDate.getFullYear(), startDate.getMonth() + 1) : null,
    },
  };
}

function qGroupByRubrica(rows: QFilteredRow[]): Array<{ rubrica: string; totalExigivel: number; totalPrescrito: number; totalIntegral: number }> {
  const map = new Map<string, { totalExigivel: number; totalPrescrito: number; totalIntegral: number }>();
  for (const row of rows) {
    const cur = map.get(row.rubrica) || { totalExigivel: 0, totalPrescrito: 0, totalIntegral: 0 };
    cur.totalIntegral += row.valorConsiderado;
    if (row.statusPrescricao === "EXIGIVEL") cur.totalExigivel += row.valorConsiderado;
    else cur.totalPrescrito += row.valorConsiderado;
    map.set(row.rubrica, cur);
  }
  return Array.from(map.entries()).map(([rubrica, t]) => ({ rubrica, ...t }));
}

function qParseBrazilianCurrency(value: string): number {
  const n = Number(value.replace(/R\$/g,"").replace(/\s/g,"").replace(/\./g,"").replace(/,/g,"."));
  return Number.isFinite(n) ? n : 0;
}

function qParseTsv(text: string): QMonthlyDifference[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const hasHeader = /data|competencia|competência/i.test(lines[0]);
  return (hasHeader ? lines.slice(1) : lines).map((line, i) => {
    const parts = line.split(/\t|;/).map((s) => s.trim());
    return {
      id: String(i + 1),
      competencia: parts[0] || "",
      rubrica: parts[2] || "Diferença",
      valorOriginal: qParseBrazilianCurrency(parts[1] || "0"),
      total: qParseBrazilianCurrency(parts[1] || "0"),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabela de conversão de moeda histórica brasileira → Real
// Referência: Plano Real (MP 542/1994), Plano Collor (1990), Plano Verão (1989), Plano Cruzado (1986)
// ─────────────────────────────────────────────────────────────────────────────
const MOEDA_BRASIL = [
  { de: "1900-01", ate: "1986-02", moeda: "Cr$ (Cruzeiro)",       divisor: 2_750_000_000_000 },
  { de: "1986-03", ate: "1989-01", moeda: "Cz$ (Cruzado)",        divisor: 2_750_000_000     },
  { de: "1989-02", ate: "1990-02", moeda: "NCz$ (Cruzado Novo)",  divisor: 2_750_000         },
  { de: "1990-03", ate: "1993-07", moeda: "Cr$ (Cruzeiro)",       divisor: 2_750_000         },
  { de: "1993-08", ate: "1994-06", moeda: "CR$ (Cruzeiro Real)",  divisor: 2_750             },
  { de: "1994-07", ate: "9999-12", moeda: "R$ (Real)",            divisor: 1                 },
];

function getMoedaInfo(competencia: string): { moeda: string; divisor: number } {
  const ym = competencia.substring(0, 7);
  for (const m of MOEDA_BRASIL) {
    if (ym >= m.de && ym <= m.ate) return { moeda: m.moeda, divisor: m.divisor };
  }
  return { moeda: "R$ (Real)", divisor: 1 };
}

function fmtR(v: number) {
  return "R$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number) {
  return (v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + "%";
}

function fmtMes(ym: string) {
  if (!ym || ym.length < 7) return ym;
  const [y, m] = ym.split("-");
  const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${meses[parseInt(m) - 1]}/${y}`;
}

// ── Helpers CNIS ─────────────────────────────────────────────────────────────

function parseDateBR(s: string): string {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

interface CnisPeriodo {
  inicio: string; fim: string;
  anos: number; meses: number; dias: number;
  raw: string;
}

function parsePeriodosCNIS(text: string): CnisPeriodo[] {
  const periodos: CnisPeriodo[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const datas = trimmed.match(/\d{1,2}\/\d{1,2}\/\d{4}/g);
    if (!datas || datas.length < 2) continue;
    const inicio = parseDateBR(datas[0]);
    const fim    = parseDateBR(datas[1]);
    if (!inicio || !fim) continue;
    const d1 = new Date(inicio + "T00:00:00");
    const d2 = new Date(fim    + "T00:00:00");
    if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) continue;
    const { anos, meses, dias } = calcularPeriodoContribuicaoInternal(inicio, fim);
    periodos.push({ inicio, fim, anos, meses, dias, raw: trimmed });
  }
  return periodos;
}

function somarPeriodosTC(periodos: CnisPeriodo[]): { anos: number; meses: number; dias: number; sobreposicoes: number } {
  if (periodos.length === 0) return { anos: 0, meses: 0, dias: 0, sobreposicoes: 0 };
  const DAY = 86400000;
  const intervals = periodos
    .map((p) => ({ s: new Date(p.inicio + "T00:00:00").getTime(), e: new Date(p.fim + "T00:00:00").getTime() }))
    .sort((a, b) => a.s - b.s);
  const merged: Array<{ s: number; e: number }> = [];
  let cur = intervals[0];
  let sobreposicoes = 0;
  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i].s <= cur.e + DAY) {
      sobreposicoes++;
      cur = { s: cur.s, e: Math.max(cur.e, intervals[i].e) };
    } else {
      merged.push(cur);
      cur = intervals[i];
    }
  }
  merged.push(cur);
  let totalAnos = 0, totalMeses = 0, totalDias = 0;
  for (const { s, e } of merged) {
    const ini = new Date(s).toISOString().slice(0, 10);
    const fim = new Date(e).toISOString().slice(0, 10);
    const { anos, meses, dias } = calcularPeriodoContribuicaoInternal(ini, fim);
    totalAnos += anos; totalMeses += meses; totalDias += dias;
  }
  totalMeses += Math.floor(totalDias / 30); totalDias = totalDias % 30;
  totalAnos  += Math.floor(totalMeses / 12); totalMeses = totalMeses % 12;
  return { anos: totalAnos, meses: totalMeses, dias: totalDias, sobreposicoes };
}

// Calcula período de contribuição em anos, meses e dias (método civil)
function calcularPeriodoContribuicaoInternal(inicio: string, fim: string): { anos: number; meses: number; dias: number } {
  if (!inicio || !fim) return { anos: 0, meses: 0, dias: 0 };
  const d1 = new Date(inicio + "T00:00:00");
  const d2 = new Date(fim + "T00:00:00");
  if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) return { anos: 0, meses: 0, dias: 0 };

  let anos  = d2.getFullYear() - d1.getFullYear();
  let meses = d2.getMonth()    - d1.getMonth();
  let dias  = d2.getDate()     - d1.getDate();

  if (dias < 0) {
    meses -= 1;
    dias  += new Date(d2.getFullYear(), d2.getMonth(), 0).getDate();
  }
  if (meses < 0) {
    anos  -= 1;
    meses += 12;
  }
  return { anos: Math.max(0, anos), meses: Math.max(0, meses), dias: Math.max(0, dias) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core calculation engine
// ─────────────────────────────────────────────────────────────────────────────

function runCalc(
  cfg: BenefitConfig,
  salarios: SalaryRow[],
  corrRates: RateRow[],
  reajRates: RateRow[],
  pagamentos: PaymentRow[],
  juros: JurosConfig,
  prescricao: PrescricaoConfig,
  nomeIndice: string,
): CalcResult {
  const dibYM  = cfg.dib.substring(0, 7);
  const calcYM = cfg.dataCalculo.substring(0, 7);
  const corrMap = buildRateMap(corrRates);
  // reajMap não é mais usado: o reajuste anual é calculado internamente em "4. Evolução RMA"
  // a partir do corrMap (INPC acumulado nos 12 meses anteriores ao aniversário do DIB)

  // 1. Corrigir salários até DIB (com conversão de moeda histórica)
  const corrigidosRaw: SalaryResult[] = salarios
    .filter((s) => s.competencia && s.valorOriginal > 0)
    .map((s) => {
      const comp = s.competencia.substring(0, 7);
      // Converte moeda histórica (Cruzeiro, Cruzado, etc.) para Real antes de aplicar o índice
      const { moeda, divisor } = getMoedaInfo(comp);
      const valorEmReal = divisor > 1 ? r2(s.valorOriginal / divisor) : r2(s.valorOriginal);
      const fator = fatorAcumulado(corrMap, comp, dibYM);
      return {
        competencia: comp,
        valorOriginal: r2(s.valorOriginal),
        moeda,
        fatorMoeda: divisor > 1 ? divisor : 1,
        valorEmReal,
        fatorCorrecao: r2(fator * 10000) / 10000,
        valorCorrigido: r2(valorEmReal * fator),
        considerado: false,
        indice: nomeIndice,
      };
    })
    .sort((a, b) => a.competencia.localeCompare(b.competencia));

  // 2. Salário de Benefício (média 80% maiores)
  const sorted = [...corrigidosRaw].sort((a, b) => b.valorCorrigido - a.valorCorrigido);
  const qtd = cfg.usarMedia80 && sorted.length > 1 ? Math.max(1, Math.floor(sorted.length * 0.8)) : sorted.length;
  const consideradosSet = new Set(sorted.slice(0, qtd).map((r) => r.competencia + "|" + r.valorEmReal));
  const salariosCorrigidos: SalaryResult[] = corrigidosRaw.map((r) => ({
    ...r, considerado: consideradosSet.has(r.competencia + "|" + r.valorEmReal),
  }));
  const base = salariosCorrigidos.filter((r) => r.considerado);
  const sb = base.length > 0 ? r2(base.reduce((s, r) => s + r.valorCorrigido, 0) / base.length) : 0;

  // 3. RMI
  let rmi: number;
  if (cfg.usarRmiManual && cfg.rmiManual > 0) rmi = r2(cfg.rmiManual);
  else rmi = r2(sb * cfg.coeficienteRmi);
  if (cfg.aplicarTeto && cfg.tetoRmi > 0) rmi = Math.min(rmi, cfg.tetoRmi);

  // 4. Evolução RMA — reajuste anual aplicado no mês-aniversário do DIB
  //    O reajuste de benefícios acima do salário mínimo segue o INPC acumulado nos
  //    12 meses anteriores ao aniversário (Lei 8.213/1991, art. 41-A).
  //    Por isso calculamos a taxa anual diretamente do corrMap (INPC/IPCA-E)
  //    e aplicamos apenas uma vez por ano, na competência-aniversário.
  const dibMes = parseInt(dibYM.split("-")[1]);   // mês do DIB (1-12)
  const dibAno = parseInt(dibYM.split("-")[0]);

  const meses = monthsBetween(dibYM, calcYM);
  let valorRma = r2(rmi);
  let origemAtual = "RMI inicial";

  const rmaEvolution: RmaRow[] = meses.map((ym, i) => {
    if (i === 0) return { competencia: ym, valorRma: valorRma, taxaReajuste: 0, origemReajuste: origemAtual };

    const [yrCur, moCur] = ym.split("-").map(Number);
    const isAniversario = moCur === dibMes && yrCur > dibAno;

    if (isAniversario && corrMap.size > 0) {
      // Acumula os 12 meses anteriores ao aniversário (ex.: mar/23 → abr/22 a mar/23)
      // fatorAcumulado(from, end) calcula de [from+1m] até [end] inclusive
      const endAcum  = toYM(addMonths(parseYM(ym), -1));   // mês anterior ao aniversário
      const fromAcum = toYM(addMonths(parseYM(ym), -13));  // 13 meses antes → início do range
      const fatorAnual = fatorAcumulado(corrMap, fromAcum, endAcum);
      const taxaAnual  = r2((fatorAnual - 1) * 10000) / 10000;
      valorRma = r2(valorRma * fatorAnual);
      origemAtual = `Reajuste ${String(moCur).padStart(2, "0")}/${yrCur} (INPC 12m: ${fmtPct(taxaAnual)})`;
      return { competencia: ym, valorRma, taxaReajuste: taxaAnual, origemReajuste: origemAtual };
    }

    return { competencia: ym, valorRma, taxaReajuste: 0, origemReajuste: origemAtual };
  });

  // 5. Atrasados
  const pagMap = new Map(pagamentos.map((p) => [p.competencia.substring(0, 7), p.valorPago]));
  const compMin = prescricao.aplicar && prescricao.marcoInterruptivo
    ? (() => { const d = parseYM(prescricao.marcoInterruptivo.substring(0, 7)); d.setFullYear(d.getFullYear() - prescricao.anos); return toYM(d); })()
    : null;

  const atrasados: AtrasadoRow[] = rmaEvolution.map((row) => {
    const comp    = row.competencia;
    const devido  = r2(row.valorRma);
    const pago    = r2(pagMap.get(comp) ?? 0);
    const dif     = r2(devido - pago);
    const prescrita = compMin !== null && comp < compMin;

    let obs = "Sem diferença";
    if (prescrita) obs = "Prescrita";
    else if (pago === 0 && dif > 0) obs = "Sem pagamento";
    else if (dif > 0) obs = "Pago a menor";
    else if (dif < 0) obs = "Pago a maior";

    const fator = fatorAcumulado(corrMap, comp, calcYM);

    if (dif <= 0 || prescrita) return {
      competencia: comp, valorDevido: devido, valorPago: pago, diferenca: dif,
      fatorCorrecao: r2(fator * 10000) / 10000,
      valorCorrigido: Math.max(dif, 0), juros: 0, totalAtualizado: Math.max(dif, 0),
      observacao: obs, origemValorBase: row.origemReajuste,
    };

    const corr  = r2(dif * fator);
    let jurosMora = 0;
    if (juros.tipo !== "nenhum") {
      let inicioJuros = comp;
      let aplica = true;
      if (juros.termoInicial === "citacao" && juros.dataCitacao) {
        inicioJuros = juros.dataCitacao.substring(0, 7);
        aplica = comp >= inicioJuros;
      }
      if (aplica) {
        const mesesJ = Math.max(0, monthsBetween(inicioJuros, calcYM).length - 1);
        jurosMora = juros.tipo === "simples"
          ? r2(corr * juros.taxaMensal * mesesJ)
          : r2(corr * (Math.pow(1 + juros.taxaMensal, mesesJ) - 1));
      }
    }
    return {
      competencia: comp, valorDevido: devido, valorPago: pago, diferenca: dif,
      fatorCorrecao: r2(fator * 10000) / 10000,
      valorCorrigido: corr, juros: jurosMora, totalAtualizado: r2(corr + jurosMora),
      observacao: obs, origemValorBase: row.origemReajuste,
    };
  });

  const positivos = atrasados.filter((r) => r.observacao !== "Prescrita" && r.diferenca > 0);
  return {
    sb, rmi,
    rmaAtual: rmaEvolution.length > 0 ? rmaEvolution[rmaEvolution.length - 1].valorRma : rmi,
    totalBruto:      r2(positivos.reduce((s, r) => s + r.diferenca, 0)),
    totalCorrigido:  r2(positivos.reduce((s, r) => s + r.valorCorrigido, 0)),
    totalJuros:      r2(positivos.reduce((s, r) => s + r.juros, 0)),
    totalAtualizado: r2(positivos.reduce((s, r) => s + r.totalAtualizado, 0)),
    salariosCorrigidos, rmaEvolution, atrasados,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Parser
// ─────────────────────────────────────────────────────────────────────────────

function parseCSVSalarios(text: string): SalaryRow[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  const rows: SalaryRow[] = [];
  for (const line of lines) {
    // Skip header lines
    if (/competencia|competência|data|month|period/i.test(line)) continue;
    // Split by comma, semicolon, or tab
    const parts = line.split(/[,;\t]/).map((s) => s.trim().replace(/["']/g, ""));
    if (parts.length < 2) continue;
    let comp = parts[0];
    const valor = parseFloat(parts[1].replace(/\./g, "").replace(",", ".")) || 0;
    if (!valor) continue;
    // Normalize competencia: accept MM/YYYY → YYYY-MM
    if (/^\d{1,2}\/\d{4}$/.test(comp)) {
      const [m, y] = comp.split("/");
      comp = `${y}-${m.padStart(2, "0")}`;
    }
    // Accept YYYY-MM or YYYY-MM-DD
    if (/^\d{4}-\d{2}/.test(comp)) {
      comp = comp.substring(0, 7);
      rows.push({ competencia: comp, valorOriginal: valor });
    }
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabela de Tetos do INSS — vigência desde março/1994
// Fonte: Portarias Interministeriais MPS/MF e legislação previdenciária
// ─────────────────────────────────────────────────────────────────────────────

const TETOS_INSS: Array<{ inicio: string; valor: number; legislacao: string }> = [
  { inicio: "1994-03", valor:   582.06, legislacao: "Portaria 920/1994"                              },
  { inicio: "1995-05", valor:   832.66, legislacao: "Portaria 2.006/1995"                            },
  { inicio: "1996-05", valor:   957.56, legislacao: "Portaria 3.231/1996"                            },
  { inicio: "1997-06", valor:  1031.87, legislacao: "Ordem de Serviço 573/1997"                      },
  { inicio: "1998-06", valor:  1081.50, legislacao: "Portaria 4.478/1998"                            },
  { inicio: "1998-12", valor:  1200.00, legislacao: "EC 20/1998"                                     },
  { inicio: "1999-06", valor:  1255.32, legislacao: "Portaria 5.160/1999"                            },
  { inicio: "2000-06", valor:  1328.25, legislacao: "Portaria 6.211/2000"                            },
  { inicio: "2001-06", valor:  1430.00, legislacao: "Portaria 1.007/2001"                            },
  { inicio: "2002-06", valor:  1561.56, legislacao: "Portaria 535/2002"                              },
  { inicio: "2003-06", valor:  1869.34, legislacao: "Portaria 727/2003"                              },
  { inicio: "2004-01", valor:  2400.00, legislacao: "EC 41/2003"                                     },
  { inicio: "2004-05", valor:  2506.72, legislacao: "Portaria 479/2004"                              },
  { inicio: "2005-05", valor:  2668.15, legislacao: "Portaria 822/2005"                              },
  { inicio: "2006-04", valor:  2801.56, legislacao: "Portaria 119/2006"                              },
  { inicio: "2007-04", valor:  2894.28, legislacao: "Portaria 142/2007"                              },
  { inicio: "2008-03", valor:  3038.99, legislacao: "Portaria Interministerial 77/2008"              },
  { inicio: "2009-02", valor:  3218.90, legislacao: "Portaria Interministerial 48/2009"              },
  { inicio: "2010-01", valor:  3467.40, legislacao: "Portaria 333/2010"                              },
  { inicio: "2011-01", valor:  3691.74, legislacao: "Portaria Interministerial 407/2011"             },
  { inicio: "2012-01", valor:  3916.20, legislacao: "Portaria Interministerial 2/2012"               },
  { inicio: "2013-01", valor:  4159.00, legislacao: "Portaria Interministerial 15/2013"              },
  { inicio: "2014-01", valor:  4390.24, legislacao: "Portaria Interministerial 19/2014"              },
  { inicio: "2015-01", valor:  4663.75, legislacao: "Portaria Interministerial 13/2015"              },
  { inicio: "2016-01", valor:  5189.82, legislacao: "Portaria 1/2016"                               },
  { inicio: "2017-01", valor:  5531.31, legislacao: "Portaria 8/2017"                               },
  { inicio: "2018-01", valor:  5645.80, legislacao: "Portaria 15/2018"                              },
  { inicio: "2019-01", valor:  5839.45, legislacao: "Portaria 6/2019"                               },
  { inicio: "2020-01", valor:  6101.06, legislacao: "Portaria 01/4/2020"                            },
  { inicio: "2021-01", valor:  6433.57, legislacao: "Portaria SEPRT/ME 477/2021"                    },
  { inicio: "2022-01", valor:  7087.22, legislacao: "Portaria Interministerial MPS/MF 12/2022"      },
  { inicio: "2023-01", valor:  7507.49, legislacao: "Portaria Interministerial MPS/MF 26/2023"      },
  { inicio: "2024-01", valor:  7786.02, legislacao: "Portaria Interministerial MPS/MF 12/2024"      },
  { inicio: "2025-01", valor:  8157.41, legislacao: "Portaria Interministerial MPS/MF 6/2025"       },
  { inicio: "2026-01", valor:  8475.55, legislacao: "Portaria Interministerial MPS/MF 13/2026"      },
];

function getTetoInss(dataRef: string): { valor: number; vigencia: string; legislacao: string } | null {
  if (!dataRef || dataRef.length < 7) return null;
  const ym = dataRef.substring(0, 7);
  let best: typeof TETOS_INSS[0] | null = null;
  for (const t of TETOS_INSS) {
    if (t.inicio <= ym) best = t;
    else break;
  }
  if (!best) return null;
  return { valor: best.valor, vigencia: best.inicio, legislacao: best.legislacao };
}

// ─────────────────────────────────────────────────────────────────────────────
// Steps sidebar data
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: "Dados do Segurado",       id: "sec-dados"       },
  { n: 2, label: "Salários de Contribuição", id: "sec-salarios"   },
  { n: 3, label: "Cálculo da RMI",           id: "sec-kpi"        },
  { n: 4, label: "Evolução do Benefício",    id: "sec-kpi"        },
  { n: 5, label: "Atrasados",                id: "sec-atrasados"  },
  { n: 6, label: "Correção e Juros",         id: "sec-correcao"   },
  { n: 7, label: "Relatório Final",          id: "sec-resultado"  },
  { n: 8, label: "Prescrição Quinquenal",    id: "sec-quinquenio" },
];

const FERRAMENTAS = [
  { icon: TrendingUp,    label: "Índices e Reajustes"       },
  { icon: User,          label: "Teto Previdenciário"        },
  { icon: BarChart3,     label: "Simulações de Revisão"      },
  { icon: Scale,         label: "Comparativo INSS x Judicial"},
  { icon: FileText,      label: "Laudo Técnico"              },
];

const ESPECIES = [
  "Aposentadoria por Tempo de Contribuição",
  "Aposentadoria por Idade",
  "Aposentadoria por Invalidez",
  "Pensão por Morte",
  "Auxílio-doença",
  "Revisão de Benefício",
];

const INDEX_OPTIONS = [
  { value: "IPCA-E",   label: "IPCA-E (judicial)",    embeddedKey: "IPCA_E",   desc: "Art. 1º-F Lei 9.494/97 · EC 113/2021"         },
  { value: "INPC",     label: "INPC",                  embeddedKey: "INPC",     desc: "Lei 8.213/91 · Decreto 3.048/99"              },
  { value: "POUPANCA", label: "Poupança (BCB)",         embeddedKey: "POUPANCA", desc: "Art. 1º-F Lei 9.494/97 — juros Fazenda Pública" },
  { value: "SELIC",    label: "SELIC",                  embeddedKey: "SELIC",    desc: "EC 113/2021 · Lei 14.905/2024"                },
  { value: "Manual",   label: "Série personalizada",    embeddedKey: null,       desc: "Taxa personalizada informada manualmente"     },
];

const JUROS_OPTIONS = [
  { value: "simples",  label: "Simples"  },
  { value: "composto", label: "Composto" },
  { value: "nenhum",   label: "Nenhum"  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function PrevidenciarioPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const debitCredits = useDebitCredits();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const [activeStep, setActiveStep] = useState(1);
  const [creditoDebitado, setCreditoDebitado] = useState(false);
  const [chaveRecuperacao, setChaveRecuperacao] = useState<string | null>(null);
  const [salvandoCalculo, setSalvandoCalculo] = useState(false);
  const [recuperandoChave, setRecuperandoChave] = useState(false);

  // ── Form state ────────────────────────────────────────────────────────────
  const [cfg, setCfg] = useState<BenefitConfig>({
    nome: "", nb: "", especie: ESPECIES[0],
    dib: "", dip: "", der: "", dataSentenca: "", dataCalculo: "",
    tcAnos: 0, tcMeses: 0, tcDias: 0,
    usarMedia80: true, coeficienteRmi: 0.85,
    aplicarTeto: false, tetoRmi: 0,
    usarRmiManual: false, rmiManual: 0,
  });

  const [salarios,   setSalarios]   = useState<SalaryRow[]>([]);
  const [corrRates,  setCorrRates]  = useState<RateRow[]>([]);
  const [reajRates,  setReajRates]  = useState<RateRow[]>([]);
  const [pagamentos, setPagamentos] = useState<PaymentRow[]>([]);
  const [nomeIndice, setNomeIndice] = useState("IPCA-E");

  const [juros, setJuros] = useState<JurosConfig>({
    tipo: "simples", taxaMensal: 0.01,
    termoInicial: "competencia", dataCitacao: "",
  });
  const [prescricao, setPrescricao] = useState<PrescricaoConfig>({
    aplicar: true, marcoInterruptivo: "", anos: 5,
  });

  // ── Prescrição Quinquenal state ────────────────────────────────────────────
  const [quinquenioMode, setQuinquenioMode] = useState<QCalculationMode>("quinquenio");
  const [quinquenioUseManual, setQuinquenioUseManual] = useState(false);
  const [rawQuinquenioInput, setRawQuinquenioInput] = useState(
    "Data\tValor\tRubrica\njan/20\tR$ 632,12\tDiferença\njun/20\tR$ 1.500,00\tDiferença"
  );

  // ── Results ───────────────────────────────────────────────────────────────
  const [result, setResult] = useState<CalcResult | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [atrasadoSearch, setAtrasadoSearch] = useState("");
  const [rmaViewMode, setRmaViewMode] = useState<"chart" | "table">("chart");
  const [manualIndexText, setManualIndexText] = useState("");
  const [tcInicio, setTcInicio] = useState("");
  const [tcFim,    setTcFim]    = useState("");
  const [cnisOpen,    setCnisOpen]    = useState(false);
  const [cnisText,    setCnisText]    = useState("");
  const [periodosCnis, setPeriodosCnis] = useState<CnisPeriodo[]>([]);

  // ── Embedded index data ───────────────────────────────────────────────────
  const { data: embeddedData } = useQuery({
    queryKey: ["embedded-indexes"],
    queryFn: async () => { const r = await fetch(`${API_BASE}/api/indexes/embedded`); return r.json(); },
  });

  const loadEmbeddedIndex = useCallback((key: string, label: string) => {
    const idx = embeddedData?.indices?.find((i: any) => i.key === key);
    if (!idx?.records?.length) {
      toast({ title: `${label} não disponível`, description: "Dados embarcados não encontrados. Tente recarregar a página.", variant: "destructive" });
      return;
    }
    const rows: RateRow[] = idx.records.map((r: any) => ({ competencia: r.period, taxa: r.rate }));
    setCorrRates(rows);
    // reajRates é calculado internamente pelo engine a partir do corrMap (reajuste anual no aniversário do DIB)
    toast({ title: `${label} carregado`, description: `${rows.length} taxas mensais importadas.` });
  }, [embeddedData, toast]);

  const importManualIndex = useCallback(() => {
    const lines = manualIndexText.trim().split(/\r?\n/).filter((l) => l.trim());
    const rows: RateRow[] = [];
    for (const line of lines) {
      if (/competência|periodo|period|mes|mês/i.test(line)) continue;
      const parts = line.split(/[;,\t]/).map((s) => s.trim().replace(/["'%]/g, ""));
      if (parts.length < 2) continue;
      let comp = parts[0];
      const rawVal = parts[1].replace(",", ".");
      let taxa = parseFloat(rawVal);
      if (isNaN(taxa)) continue;
      // Se o valor estiver em percentual (ex: 0,45 → 0,0045), normalizar
      if (Math.abs(taxa) > 1) taxa = taxa / 100;
      // Normalizar competência
      if (/^\d{1,2}\/\d{4}$/.test(comp)) {
        const [m, y] = comp.split("/");
        comp = `${y}-${m.padStart(2, "0")}`;
      }
      if (/^\d{4}-\d{2}/.test(comp)) {
        rows.push({ competencia: comp.substring(0, 7), taxa });
      }
    }
    if (rows.length === 0) {
      toast({ title: "Nenhuma taxa importada", description: "Verifique o formato: competência;taxa (ex: 2020-01;0.0034 ou 01/2020;0,34%)", variant: "destructive" });
      return;
    }
    rows.sort((a, b) => a.competencia.localeCompare(b.competencia));
    setCorrRates(rows);
    toast({ title: "Série personalizada carregada", description: `${rows.length} taxas importadas.` });
  }, [manualIndexText, toast]);

  // Auto-carrega IPCA-E assim que os dados embarcados ficam disponíveis (evita cálculo sem índice)
  useEffect(() => {
    if (!embeddedData?.indices || corrRates.length > 0) return;
    const ipcae = embeddedData.indices.find((i: any) => i.key === "IPCA_E");
    if (ipcae?.records?.length) {
      const rows: RateRow[] = ipcae.records.map((r: any) => ({ competencia: r.period, taxa: r.rate }));
      setCorrRates(rows);
      setNomeIndice("IPCA-E");
    }
  }, [embeddedData]);

  // Auto-calcula Tempo de Contribuição quando as datas de início e fim são fornecidas
  useEffect(() => {
    if (!tcInicio || !tcFim) return;
    const { anos, meses, dias } = calcularPeriodoContribuicaoInternal(tcInicio, tcFim);
    setCfg((c) => ({ ...c, tcAnos: anos, tcMeses: meses, tcDias: dias }));
  }, [tcInicio, tcFim]);

  // Recuperação por chave pública via URL ?key=XXX
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const key = params.get("key");
    if (!key) return;
    setRecuperandoChave(true);
    fetch(`${API_BASE}/api/previdenciario/recover/${key.toUpperCase()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        const s = data.calcState;
        if (s.cfg)        setCfg(s.cfg);
        if (s.salarios)   setSalarios(s.salarios);
        if (s.corrRates)  setCorrRates(s.corrRates);
        if (s.reajRates)  setReajRates(s.reajRates);
        if (s.pagamentos) setPagamentos(s.pagamentos);
        if (s.juros)      setJuros(s.juros);
        if (s.prescricao) setPrescricao(s.prescricao);
        if (s.nomeIndice) setNomeIndice(s.nomeIndice);
        setChaveRecuperacao(data.publicKey);
        toast({ title: "Cálculo recuperado", description: `Chave: ${data.publicKey}` });
      })
      .catch(() => toast({ title: "Chave não encontrada", description: key, variant: "destructive" }))
      .finally(() => setRecuperandoChave(false));
  }, [searchString]);

  // ── Reset completo do cálculo ─────────────────────────────────────────────
  const resetCalculo = useCallback(() => {
    setCfg({
      nome: "", nb: "", especie: ESPECIES[0],
      dib: "", dip: "", der: "", dataSentenca: "", dataCalculo: "",
      tcAnos: 0, tcMeses: 0, tcDias: 0,
      usarMedia80: true, coeficienteRmi: 0.85,
      aplicarTeto: false, tetoRmi: 0,
      usarRmiManual: false, rmiManual: 0,
    });
    setSalarios([]);
    setCorrRates([]);
    setReajRates([]);
    setPagamentos([]);
    setNomeIndice("IPCA-E");
    setJuros({ tipo: "simples", taxaMensal: 0.01, termoInicial: "competencia", dataCitacao: "" });
    setPrescricao({ aplicar: true, marcoInterruptivo: "", anos: 5 });
    setResult(null);
    setCalcError(null);
    setAtrasadoSearch("");
    setManualIndexText("");
    setTcInicio("");
    setTcFim("");
    setCreditoDebitado(false);
    setActiveStep(1);
    setCnisOpen(false);
    setCnisText("");
    setPeriodosCnis([]);
  }, []);

  // ── Regra aplicável (auto) ────────────────────────────────────────────────
  const regra = useMemo(() => {
    if (!cfg.dib) return "—";
    return new Date(cfg.dib) < new Date("2019-11-13") ? "Pré-EC 103/2019" : "Pós-EC 103/2019";
  }, [cfg.dib]);

  const tcStr = useMemo(() =>
    `${cfg.tcAnos} anos, ${cfg.tcMeses} meses, ${cfg.tcDias} dias`,
    [cfg.tcAnos, cfg.tcMeses, cfg.tcDias]
  );

  // ── Situação do cálculo flags ─────────────────────────────────────────────
  const hasDados    = !!(cfg.nome && cfg.dib && cfg.dataCalculo);
  const hasSalarios = salarios.length > 0;
  const hasResult   = !!result;

  // ── CSV Import ────────────────────────────────────────────────────────────
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSVSalarios(text);
      if (rows.length === 0) {
        toast({ title: "Nenhum dado encontrado", description: "Verifique o formato do arquivo (competência;valor).", variant: "destructive" });
      } else {
        setSalarios(rows);
        toast({ title: `${rows.length} salários importados`, description: "Tabela atualizada com os dados do arquivo." });
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  }, [toast]);

  const upd = (k: keyof BenefitConfig, v: any) => setCfg((c) => ({ ...c, [k]: v }));

  // ── Calculate ─────────────────────────────────────────────────────────────
  const CREDITOS_PREVIDENCIARIO = 5;

  const calcular = useCallback(async () => {
    setCalcError(null);
    setLoading(true);
    try {
      if (!cfg.dib || !cfg.dataCalculo) throw new Error("Informe a DIB e a Data Final do cálculo.");
      if (salarios.filter((s) => s.valorOriginal > 0).length === 0 && !cfg.usarRmiManual)
        throw new Error("Importe ou adicione os salários de contribuição.");
      if (corrRates.length === 0)
        throw new Error("Nenhum índice de correção carregado. Aguarde o carregamento automático do IPCA-E ou selecione manualmente na seção Correção e Juros.");

      // Débito de créditos apenas na primeira execução da sessão
      if (!creditoDebitado) {
        const ok = await debitCredits(CREDITOS_PREVIDENCIARIO, "Liquidação Previdenciária");
        if (!ok) { setLoading(false); return; }
        setCreditoDebitado(true);
      }

      const r = runCalc(cfg, salarios, corrRates, reajRates, pagamentos, juros, prescricao, nomeIndice);
      setResult(r);
      setActiveStep(7);
      toast({ title: "Cálculo concluído", description: `Total atualizado: ${fmtR(r.totalAtualizado)}` });
    } catch (e: any) {
      setCalcError(e.message ?? "Erro no cálculo");
    } finally {
      setLoading(false);
    }
  }, [cfg, salarios, corrRates, reajRates, pagamentos, juros, prescricao, nomeIndice, toast, creditoDebitado, debitCredits]);

  // ── Gerar Laudo ───────────────────────────────────────────────────────────
  const gerarLaudo = useCallback(async () => {
    if (!result) return;

    const logoUrl = `${window.location.origin}${API_BASE}/veritasanalytics.png`;

    const agora = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
    const html = buildLaudoPrevidenciario({ cfg, result, user, juros, prescricao, regra, nomeIndice, tcStr, agora, logoUrl });

    const w = window.open("", "_blank", "width=1050,height=800,scrollbars=yes");
    if (!w) {
      toast({ title: "Popup bloqueado", description: "Permita popups para este site e tente novamente.", variant: "destructive" });
      return;
    }
    w.document.write(html);
    w.document.close();

    // Salva o estado do cálculo na API e injeta a chave no laudo
    setSalvandoCalculo(true);
    try {
      const calcState = { cfg, salarios, corrRates, reajRates, pagamentos, juros, prescricao, nomeIndice };
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/previdenciario/save`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ calcState }),
      });
      if (res.ok) {
        const data = await res.json();
        const chave: string = data.publicKey;
        setChaveRecuperacao(chave);
        // Injeta a chave no laudo já aberto
        try {
          const el = w.document.getElementById("laudo-chave");
          if (el) el.textContent = `Chave: ${chave}`;
        } catch (_) { /* cross-origin seguro */ }
      }
    } catch (_) {
      // silencioso — chave é opcional
    } finally {
      setSalvandoCalculo(false);
    }
  }, [result, cfg, salarios, pagamentos, juros, prescricao, nomeIndice, regra, tcStr, user, toast]);

  // ── Exportar para Valor da Causa ─────────────────────────────────────────
  const exportarParaValorCausa = useCallback(() => {
    if (!result) return;
    const payload = {
      source_module: "liquidacao_previdenciaria",
      segurado: cfg.nome,
      especie: cfg.especie,
      dib: cfg.dib,
      dip: cfg.dip,
      der: cfg.der,
      data_sentenca: cfg.dataSentenca,
      data_base_calculo: cfg.dataCalculo,
      rmi: result.rmi,
      rma: result.rmaAtual,
      export_timestamp: new Date().toISOString(),
    };
    localStorage.setItem("veritas_liquidacao_export", JSON.stringify(payload));
    setLocation("/valor-causa");
  }, [result, cfg, setLocation]);

  // ── Filtered atrasados ────────────────────────────────────────────────────
  const atrasadosFiltrados = useMemo(() => {
    if (!result) return [];
    if (!atrasadoSearch) return result.atrasados;
    return result.atrasados.filter((r) => fmtMes(r.competencia).includes(atrasadoSearch) || r.competencia.includes(atrasadoSearch));
  }, [result, atrasadoSearch]);

  // ── Prescrição Quinquenal — derived data ──────────────────────────────────
  const quinquenioBaseRows = useMemo<QMonthlyDifference[]>(() => {
    if (!result) return [];
    return result.atrasados
      .filter((a) => a.diferenca > 0)
      .map((a, i) => ({
        id: String(i + 1),
        competencia: a.competencia,
        rubrica: "Diferença apurada",
        valorOriginal: a.diferenca,
        valorCorrigido: a.valorCorrigido,
        juros: a.juros,
        total: a.totalAtualizado,
      }));
  }, [result]);

  const { detailedRows: qDetailedRows, summary: qSummary } = useMemo(() => {
    const rows = quinquenioUseManual ? qParseTsv(rawQuinquenioInput) : quinquenioBaseRows;
    const ajuizamento = prescricao.marcoInterruptivo || cfg.dataCalculo || "";
    return qApplyPrescription(rows, quinquenioMode, ajuizamento);
  }, [quinquenioBaseRows, quinquenioUseManual, rawQuinquenioInput, quinquenioMode, prescricao.marcoInterruptivo, cfg.dataCalculo]);

  const qGrouped = useMemo(() => qGroupByRubrica(qDetailedRows), [qDetailedRows]);

  const qMemoriaTecnica = useMemo(() => {
    if (quinquenioMode === "integral")
      return "Cálculo integral selecionado. Nenhum recorte prescricional foi aplicado às competências informadas.";
    if (!qSummary.dataCorte)
      return "Modo quinquenal selecionado, porém a data de ajuizamento não foi informada de forma válida.";
    const ajuizamento = prescricao.marcoInterruptivo || cfg.dataCalculo || "";
    return `Foi aplicado recorte técnico quinquenal por competência, a partir de ${qSummary.dataCorte}, contado retroativamente em 5 anos da data de ajuizamento informada (${ajuizamento}). O sistema não decide controvérsias jurídicas relativas à suspensão, interrupção ou afastamento da prescrição.`;
  }, [quinquenioMode, qSummary.dataCorte, prescricao.marcoInterruptivo, cfg.dataCalculo]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-screen -m-6 bg-[#f4f7fb]">

      {/* ═══ LEFT STEP SIDEBAR ═══ */}
      <div className="w-52 shrink-0 bg-[#0d1b2e] text-white flex flex-col py-5 px-3 gap-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 mb-2">Etapas do Cálculo</p>
        {STEPS.map((s) => (
          <button
            key={s.n}
            onClick={() => { setActiveStep(s.n); scrollTo(s.id); }}
            className={`flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeStep === s.n
                ? "bg-blue-600/30 text-blue-300 border border-blue-500/30"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold border ${
              activeStep === s.n ? "bg-blue-600 border-blue-500 text-white" : "border-slate-600 text-slate-400"
            }`}>{s.n}</span>
            <span className="leading-tight">{s.label}</span>
          </button>
        ))}

        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 mb-2">Ferramentas</p>
          {FERRAMENTAS.map((f) => (
            <button key={f.label} className="flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all">
              <f.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="leading-tight">{f.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto px-2 pt-4 border-t border-slate-700/50">
          <p className="text-[10px] text-slate-600 font-medium">Veritas Analytics v2.4</p>
          <p className="text-[10px] text-slate-600">Liquidação Previdenciária</p>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top header bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Liquidação Previdenciária - INSS</h1>
            <p className="text-xs text-slate-500">Cálculos específicos para benefícios do INSS (RMI, RMA e Atrasados)</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={resetCalculo}>
              <FilePlus2 className="w-3.5 h-3.5" /> Novo cálculo
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" /> Abrir processo
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><Settings className="w-4 h-4 text-slate-500" /></Button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5">
          {calcError && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{calcError}</span>
            </div>
          )}

          <div className="grid grid-cols-5 gap-5">

            {/* ──── LEFT MAIN COLUMN (3/5) ──── */}
            <div className="col-span-3 space-y-5">

              {/* Dados do Segurado */}
              <section id="sec-dados">
                <Card className="shadow-sm">
                  <CardHeader className="py-3 px-4 border-b">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600" /> Dados do Segurado
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="col-span-1 space-y-1">
                        <Label className="text-[11px] text-slate-500">Nome</Label>
                        <Input className="h-8 text-xs" placeholder="Nome completo" value={cfg.nome} onChange={(e) => upd("nome", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-500">NB (NIT)</Label>
                        <Input className="h-8 text-xs font-mono" placeholder="000.000.000-0" value={cfg.nb} onChange={(e) => upd("nb", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-500">Benefício</Label>
                        <Select value={cfg.especie} onValueChange={(v) => upd("especie", v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{ESPECIES.map((e) => <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-500">DIB</Label>
                        <Input className="h-8 text-xs" type="date" value={cfg.dib} onChange={(e) => upd("dib", e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-500">DER</Label>
                        <Input className="h-8 text-xs" type="date" value={cfg.der} onChange={(e) => upd("der", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-500">
                          DIP
                          <span className="ml-1 text-[10px] text-slate-400 font-normal">(Início do Pagamento)</span>
                        </Label>
                        <Input className="h-8 text-xs" type="date" value={cfg.dip} onChange={(e) => upd("dip", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-500">Data Sentença</Label>
                        <Input className="h-8 text-xs" type="date" value={cfg.dataSentenca} onChange={(e) => upd("dataSentenca", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-500">Regra Aplicável</Label>
                        <div className={`h-8 flex items-center px-2 rounded-md border text-xs font-semibold ${
                          regra.includes("Pré") ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-green-50 border-green-200 text-green-700"
                        }`}>{regra}</div>
                      </div>
                    </div>

                    {/* Tempo de Contribuição com cálculo automático */}
                    <div className="border border-slate-200 rounded-lg p-2.5 space-y-2 bg-slate-50/50">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] text-slate-600 font-medium">Tempo de Contribuição</Label>
                        <div className="flex items-center gap-2">
                          {tcInicio && tcFim && !cnisOpen && (
                            <span className="text-[10px] text-green-600 font-medium">✓ Período único</span>
                          )}
                          {periodosCnis.length > 0 && !cnisOpen && (
                            <span className="text-[10px] text-blue-600 font-medium">✓ {periodosCnis.length} períodos do CNIS</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setCnisOpen((o) => !o)}
                            className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border transition-all ${
                              cnisOpen ? "bg-blue-600 text-white border-blue-600" : "text-blue-600 border-blue-300 hover:bg-blue-50"
                            }`}
                          >
                            <ClipboardList className="w-3 h-3" />
                            Importar do CNIS
                          </button>
                        </div>
                      </div>

                      {/* ── Painel CNIS ── */}
                      {cnisOpen && (
                        <div className="space-y-2 border border-blue-200 rounded-lg p-2.5 bg-blue-50/40">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[10px] text-blue-700 leading-relaxed flex-1">
                              Cole o extrato de contribuições do CNIS (Meu INSS). O sistema identifica automaticamente todos os períodos com datas no formato <strong>DD/MM/AAAA</strong>.
                            </p>
                            {periodosCnis.length > 0 && (
                              <button type="button" onClick={() => { setCnisText(""); setPeriodosCnis([]); }}
                                className="text-[10px] text-slate-400 hover:text-red-500 shrink-0">Limpar</button>
                            )}
                          </div>
                          <textarea
                            rows={5}
                            placeholder={"Exemplo:\n01/01/1990   31/12/1995   Empresa Alfa\n01/03/1996 - 30/06/2005   Beta LTDA\n01/08/2005 a 31/12/2018   Gama SA"}
                            className="w-full rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-[11px] font-mono text-slate-700 resize-y focus:outline-none focus:ring-1 focus:ring-blue-400"
                            value={cnisText}
                            onChange={(e) => {
                              setCnisText(e.target.value);
                              setPeriodosCnis(parsePeriodosCNIS(e.target.value));
                            }}
                          />

                          {periodosCnis.length > 0 && (() => {
                            const totais = somarPeriodosTC(periodosCnis);
                            return (
                              <div className="space-y-1.5">
                                <div className="overflow-auto max-h-36 rounded border border-blue-200 bg-white">
                                  <table className="w-full text-[10px]">
                                    <thead>
                                      <tr className="bg-blue-50 text-blue-700">
                                        <th className="text-left px-2 py-1 font-semibold">Início</th>
                                        <th className="text-left px-2 py-1 font-semibold">Fim</th>
                                        <th className="text-right px-2 py-1 font-semibold">Período</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {periodosCnis.map((p, i) => (
                                        <tr key={i} className="border-t border-blue-100">
                                          <td className="px-2 py-0.5 font-mono">{new Date(p.inicio + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                                          <td className="px-2 py-0.5 font-mono">{new Date(p.fim    + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                                          <td className="px-2 py-0.5 text-right text-slate-600">{p.anos}a {p.meses}m {p.dias}d</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                {totais.sobreposicoes > 0 && (
                                  <p className="text-[10px] text-amber-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {totais.sobreposicoes} sobreposição(ões) detectada(s) e tratada(s)
                                  </p>
                                )}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="bg-white border border-blue-300 rounded-md px-3 py-1.5 text-xs font-bold text-blue-800 flex-1 text-center">
                                    Total: {totais.anos}a {totais.meses}m {totais.dias}d
                                  </div>
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                                    onClick={() => {
                                      const t = somarPeriodosTC(periodosCnis);
                                      upd("tcAnos",  t.anos);
                                      upd("tcMeses", t.meses);
                                      upd("tcDias",  t.dias);
                                      setTcInicio(""); setTcFim("");
                                      setCnisOpen(false);
                                      toast({ title: "TC aplicado", description: `${t.anos}a ${t.meses}m ${t.dias}d — ${periodosCnis.length} períodos do CNIS` });
                                    }}
                                  >
                                    Aplicar TC
                                  </Button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-slate-400">Início das contribuições</Label>
                          <Input className="h-8 text-xs" type="date" value={tcInicio}
                            onChange={(e) => setTcInicio(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-slate-400">
                            Fim das contribuições
                            {cfg.der && (
                              <button className="ml-1 text-blue-500 hover:underline" type="button"
                                onClick={() => setTcFim(cfg.der)}>
                                (usar DER)
                              </button>
                            )}
                          </Label>
                          <Input className="h-8 text-xs" type="date" value={tcFim}
                            onChange={(e) => setTcFim(e.target.value)} />
                        </div>
                      </div>
                      {tcInicio && tcFim && (
                        <div className="bg-white border border-green-200 rounded-md px-3 py-1.5 text-xs text-center font-semibold text-green-700">
                          {tcStr}
                        </div>
                      )}
                      <div className="border-t border-slate-200 pt-2">
                        <Label className="text-[10px] text-slate-400 mb-1.5 block">Ajuste manual (anos / meses / dias)</Label>
                        <div className="grid grid-cols-5 gap-2 items-end">
                          <div className="space-y-1 col-span-1">
                            <Label className="text-[11px] text-slate-500">Anos</Label>
                            <Input className="h-8 text-xs" type="number" min={0} value={cfg.tcAnos} onChange={(e) => { setTcInicio(""); setTcFim(""); upd("tcAnos", parseInt(e.target.value) || 0); }} />
                          </div>
                          <div className="space-y-1 col-span-1">
                            <Label className="text-[11px] text-slate-500">Meses</Label>
                            <Input className="h-8 text-xs" type="number" min={0} max={11} value={cfg.tcMeses} onChange={(e) => { setTcInicio(""); setTcFim(""); upd("tcMeses", parseInt(e.target.value) || 0); }} />
                          </div>
                          <div className="space-y-1 col-span-1">
                            <Label className="text-[11px] text-slate-500">Dias</Label>
                            <Input className="h-8 text-xs" type="number" min={0} max={31} value={cfg.tcDias}
                              onChange={(e) => { setTcInicio(""); setTcFim(""); upd("tcDias", parseInt(e.target.value) || 0); }} />
                          </div>
                          <div className="space-y-1 col-span-1">
                            <Label className="text-[11px] text-slate-500">Coef. RMI (%)</Label>
                            <Input className="h-8 text-xs" type="number" min={0} max={300} step={1}
                              value={cfg.coeficienteRmi * 100}
                              onChange={(e) => upd("coeficienteRmi", parseFloat(e.target.value) / 100 || 0)} />
                          </div>
                          <div className="space-y-1 col-span-1">
                            <Label className="text-[11px] text-slate-500">Data Final Cálculo</Label>
                            <Input className="h-8 text-xs" type="date" value={cfg.dataCalculo} onChange={(e) => { upd("dataCalculo", e.target.value); setPrescricao(p => ({ ...p, marcoInterruptivo: e.target.value })); }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* KPI Cards */}
              {result && (
                <section id="sec-kpi">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "RMI (Renda Mensal Inicial)", value: fmtR(result.rmi), sub: `Coeficiente aplicado: ${(cfg.coeficienteRmi * 100).toFixed(0)}%`, color: "blue" },
                      { label: `Última RMA (${fmtMes(cfg.dataCalculo.substring(0,7))})`, value: fmtR(result.rmaAtual), sub: result.rmi > 0 ? `↑ ${(((result.rmaAtual / result.rmi) - 1) * 100).toFixed(2)}% desde a DIB` : "", color: "green" },
                      { label: "Total de Atrasados", value: fmtR(result.totalBruto), sub: `${result.atrasados.filter(r => r.diferenca > 0 && r.observacao !== "Prescrita").length} competências apuradas`, color: "amber" },
                      { label: "Total Atualizado", value: fmtR(result.totalAtualizado), sub: `Correção + Juros até ${cfg.dataCalculo}`, color: "green" },
                    ].map((k) => (
                      <Card key={k.label} className={`shadow-sm border-l-4 ${k.color === "blue" ? "border-l-blue-500" : k.color === "green" ? "border-l-green-500" : "border-l-amber-500"}`}>
                        <CardContent className="p-3.5">
                          <p className="text-[11px] text-slate-500 font-medium mb-1">{k.label}</p>
                          <p className={`text-2xl font-extrabold tracking-tight ${k.color === "green" ? "text-green-700" : k.color === "amber" ? "text-amber-700" : "text-blue-700"}`}>{k.value}</p>
                          <p className="text-[11px] text-slate-400 mt-1">{k.sub}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {/* Salários de Contribuição */}
              <section id="sec-salarios">
                <Card className="shadow-sm">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-blue-600" /> Salários de Contribuição
                    </CardTitle>
                    <div className="flex items-center gap-1.5">
                      <input type="file" accept=".csv,.txt" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-3 h-3" /> Importar CSV
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setSalarios((s) => [...s, { competencia: "", valorOriginal: 0 }])}>
                        <Plus className="w-3 h-3" /> Adicionar
                      </Button>
                      <Button size="sm" className="h-7 text-xs gap-1" onClick={calcular} disabled={loading}>
                        <RefreshCw className="w-3 h-3" /> {loading ? "..." : "Atualizar"}
                      </Button>
                    </div>
                  </div>

                  {salarios.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-600">Nenhum salário importado</p>
                        <p className="text-xs text-slate-400 mt-1">Importe um arquivo CSV/TXT ou adicione manualmente</p>
                        <p className="text-xs text-slate-400">Formato: competência (AAAA-MM ou MM/AAAA) ; valor</p>
                      </div>
                      <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-3.5 h-3.5" /> Importar arquivo
                      </Button>
                    </div>
                  ) : (
                    <>
                      <ScrollArea className="h-64">
                        <Table>
                          <TableHeader className="sticky top-0 bg-slate-50">
                            <TableRow className="text-xs">
                              <TableHead className="py-2">Competência</TableHead>
                              <TableHead className="py-2 text-right">Valor Original</TableHead>
                              {result && <><TableHead className="py-2 text-center">Moeda</TableHead><TableHead className="py-2 text-right">Em Real</TableHead><TableHead className="py-2 text-center">Índice</TableHead><TableHead className="py-2 text-right">Corrigido</TableHead><TableHead className="py-2 text-center">✓</TableHead></>}
                              <TableHead className="py-2 w-8" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(result ? result.salariosCorrigidos : salarios.map((s) => ({ ...s, moeda: "R$ (Real)", fatorMoeda: 1, valorEmReal: s.valorOriginal, fatorCorrecao: 1, valorCorrigido: s.valorOriginal, considerado: false, indice: "" }))).map((row, i) => (
                              <TableRow key={i} className={`text-xs ${result && !row.considerado ? "opacity-50" : ""}`}>
                                <TableCell className="py-1.5 font-mono">{fmtMes(result ? row.competencia : (salarios[i]?.competencia ?? ""))}</TableCell>
                                <TableCell className="py-1.5 text-right tabular-nums">{result ? (row.fatorMoeda > 1 ? row.valorOriginal.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + ` ${row.moeda.split(" ")[0]}` : fmtR(row.valorOriginal)) : fmtR(salarios[i]?.valorOriginal ?? 0)}</TableCell>
                                {result && (
                                  <>
                                    <TableCell className="py-1.5 text-center">
                                      {row.fatorMoeda > 1
                                        ? <Badge className="text-[9px] px-1 py-0 bg-amber-100 text-amber-800 border-amber-300 border">{row.moeda.split("(")[1]?.replace(")", "") ?? row.moeda}</Badge>
                                        : <Badge variant="outline" className="text-[9px] px-1 py-0 text-slate-400">Real</Badge>
                                      }
                                    </TableCell>
                                    <TableCell className="py-1.5 text-right tabular-nums text-slate-600">{fmtR(row.valorEmReal)}</TableCell>
                                    <TableCell className="py-1.5 text-center">
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{row.indice}</Badge>
                                    </TableCell>
                                    <TableCell className="py-1.5 text-right tabular-nums font-semibold text-blue-700">{fmtR(row.valorCorrigido)}</TableCell>
                                    <TableCell className="py-1.5 text-center">{row.considerado ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 inline" /> : "—"}</TableCell>
                                  </>
                                )}
                                <TableCell className="py-1.5">
                                  <button className="text-red-400 hover:text-red-600 text-xs" onClick={() => setSalarios((s) => s.filter((_, j) => j !== i))}>✕</button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                      <div className="px-4 py-2 border-t flex items-center gap-4 text-xs text-slate-500">
                        <span>Total de salários: <strong>{salarios.length}</strong></span>
                        {result && <span className="text-blue-600 font-medium">80% maiores: <strong>{result.salariosCorrigidos.filter(r => r.considerado).length} salários</strong></span>}
                        {result && <button className="text-blue-500 hover:underline ml-auto">Visualizar todos</button>}
                      </div>
                    </>
                  )}
                </Card>
              </section>

              {/* Atrasados */}
              {result && (
                <section id="sec-atrasados">
                  <Card className="shadow-sm">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b flex-wrap gap-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Scale className="w-4 h-4 text-amber-600" /> Atrasados Apurados
                      </CardTitle>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500">Período</span>
                          <Select defaultValue="todos">
                            <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos" className="text-xs">Todos</SelectItem>
                              <SelectItem value="3anos" className="text-xs">3 anos</SelectItem>
                              <SelectItem value="5anos" className="text-xs">5 anos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500">Prescrição</span>
                          <Select defaultValue="5anos">
                            <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5anos" className="text-xs">5 anos</SelectItem>
                              <SelectItem value="10anos" className="text-xs">10 anos</SelectItem>
                              <SelectItem value="nenhuma" className="text-xs">Nenhuma</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="relative">
                          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                          <Input className="h-7 text-xs pl-6 w-36" placeholder="Buscar competência..." value={atrasadoSearch} onChange={(e) => setAtrasadoSearch(e.target.value)} />
                        </div>
                        <Button size="sm" className="h-7 text-xs gap-1" onClick={calcular}>
                          <RefreshCw className="w-3 h-3" /> Recalcular
                        </Button>
                      </div>
                    </div>
                    <ScrollArea className="h-72">
                      <Table>
                        <TableHeader className="sticky top-0 bg-slate-50">
                          <TableRow className="text-xs">
                            <TableHead className="py-2">Competência</TableHead>
                            <TableHead className="py-2 text-right" title="Valor de benefício devido nessa competência (evolui com reajuste anual INPC)">Devido</TableHead>
                            <TableHead className="py-2 text-right">Pago</TableHead>
                            <TableHead className="py-2 text-right">Diferença</TableHead>
                            <TableHead className="py-2 text-right" title="Fator de correção monetária acumulado (IPCA-E/SELIC) da competência até a data do cálculo">Fator Corr.</TableHead>
                            <TableHead className="py-2 text-right">Corrigido</TableHead>
                            <TableHead className="py-2 text-right">Total Atualiz.</TableHead>
                            <TableHead className="py-2 w-6" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {atrasadosFiltrados.map((r) => (
                            <TableRow key={r.competencia} className={`text-xs ${r.observacao === "Prescrita" ? "opacity-30" : ""}`}>
                              <TableCell className="py-1.5 font-mono">
                                <div>{fmtMes(r.competencia)}</div>
                                {r.origemValorBase && r.origemValorBase !== "RMI inicial" && (
                                  <div className="text-[9px] text-violet-500 leading-tight max-w-[80px] truncate" title={r.origemValorBase}>↑ reaj.</div>
                                )}
                              </TableCell>
                              <TableCell className="py-1.5 text-right tabular-nums" title={r.origemValorBase}>{fmtR(r.valorDevido)}</TableCell>
                              <TableCell className="py-1.5 text-right tabular-nums">{fmtR(r.valorPago)}</TableCell>
                              <TableCell className={`py-1.5 text-right tabular-nums font-semibold ${r.diferenca > 0 ? "text-amber-700" : "text-slate-400"}`}>{fmtR(r.diferenca)}</TableCell>
                              <TableCell className="py-1.5 text-right tabular-nums text-slate-500 font-mono text-[10px]">
                                {r.diferenca > 0 ? r.fatorCorrecao.toFixed(4) : "—"}
                              </TableCell>
                              <TableCell className="py-1.5 text-right tabular-nums text-slate-700">{r.diferenca > 0 ? fmtR(r.valorCorrigido) : "—"}</TableCell>
                              <TableCell className="py-1.5 text-right tabular-nums font-bold text-blue-700">{fmtR(r.totalAtualizado)}</TableCell>
                              <TableCell className="py-1.5"><button className="text-slate-300 hover:text-slate-600"><MoreVertical className="w-3 h-3" /></button></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                    <div className="px-4 py-2 border-t flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      <span>Total competências: <strong>{result.atrasados.length}</strong></span>
                      <span>Diferença bruta: <strong className="text-slate-700">{fmtR(result.totalBruto)}</strong></span>
                      <span className="font-bold text-blue-700">Total atualizado: {fmtR(result.totalAtualizado)}</span>
                    </div>
                  </Card>
                </section>
              )}

              {/* Prompt calcular (before result) */}
              {!result && (
                <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                  <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-600">Pronto para calcular</p>
                    <p className="text-xs text-slate-400 mt-1">Preencha os dados do segurado e importe os salários</p>
                  </div>
                  <Button className="h-9 px-6 gap-2" onClick={calcular} disabled={loading}>
                    <RefreshCw className="w-4 h-4" />
                    {loading ? "Calculando..." : (
                      creditoDebitado || user?.role === "admin"
                        ? "Calcular Liquidação"
                        : `Calcular Liquidação · ${CREDITOS_PREVIDENCIARIO} créditos`
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* ──── RIGHT PANEL (2/5) ──── */}
            <div className="col-span-2 space-y-4">

              {/* Situação do cálculo */}
              <Card className="shadow-sm">
                <CardHeader className="py-2.5 px-4 border-b">
                  <CardTitle className="text-xs text-slate-500 uppercase tracking-wide">Situação do cálculo</CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  {[
                    { label: "Documentos ok",        ok: hasDados    },
                    { label: "Salários importados",   ok: hasSalarios },
                    { label: "Regras identificadas",  ok: hasDados    },
                  ].map((item) => (
                    <div key={item.label} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md ${item.ok ? "bg-green-50 text-green-700" : "bg-slate-50 text-slate-400"}`}>
                      <CheckCircle2 className={`w-3.5 h-3.5 ${item.ok ? "text-green-600" : "text-slate-300"}`} />
                      <span className="font-medium">{item.label}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Configurações de Índice (accordion-like always visible) */}
              <section id="sec-correcao">
                <Card className="shadow-sm">
                  <CardHeader className="py-2.5 px-4 border-b">
                    <CardTitle className="text-xs flex items-center gap-1.5"><PercentCircle className="w-3.5 h-3.5 text-blue-600" />Correção e Juros</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-500">Índice de Correção</Label>
                      <div className="flex gap-1.5">
                        <Select value={nomeIndice} onValueChange={(v) => {
                          setNomeIndice(v);
                          const opt = INDEX_OPTIONS.find(o => o.value === v);
                          if (opt?.embeddedKey) loadEmbeddedIndex(opt.embeddedKey, opt.label);
                        }}>
                          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {INDEX_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value} className="text-xs">
                                <div className="flex flex-col">
                                  <span>{o.label}</span>
                                  <span className="text-[9px] text-slate-400 leading-tight">{o.desc}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {INDEX_OPTIONS.find(o => o.value === nomeIndice)?.embeddedKey && (
                          <Button size="sm" variant="outline" className="h-8 text-xs px-2 shrink-0" title="Recarregar taxas do índice selecionado"
                            onClick={() => {
                              const opt = INDEX_OPTIONS.find(o => o.value === nomeIndice);
                              if (opt?.embeddedKey) loadEmbeddedIndex(opt.embeddedKey, opt.label);
                            }}>
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      {corrRates.length > 0 && (
                        <p className="text-[10px] text-green-600">✓ {corrRates.length} taxas carregadas — {nomeIndice}</p>
                      )}
                    </div>

                    {/* Série personalizada */}
                    {nomeIndice === "Manual" && (
                      <div className="space-y-1.5 bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <Label className="text-[11px] text-amber-800 font-medium">Importar Série Personalizada</Label>
                        <p className="text-[10px] text-amber-700 leading-snug">
                          Cole as taxas mensais, uma por linha. Formato aceito:<br />
                          <code className="bg-amber-100 px-1 rounded">AAAA-MM;0,0045</code> ou <code className="bg-amber-100 px-1 rounded">MM/AAAA;0,45%</code>
                        </p>
                        <textarea
                          className="w-full h-28 text-[10px] font-mono border border-amber-300 rounded px-2 py-1.5 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder:text-slate-400"
                          placeholder={"2020-01;0.0034\n2020-02;0.0029\n2020-03;-0.0061\n..."}
                          value={manualIndexText}
                          onChange={(e) => setManualIndexText(e.target.value)}
                        />
                        <Button size="sm" className="h-7 text-xs w-full gap-1.5 bg-amber-600 hover:bg-amber-700 text-white" onClick={importManualIndex}>
                          <Download className="w-3 h-3" />Carregar série personalizada
                        </Button>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-500">Juros Moratórios</Label>
                      <div className="flex gap-1.5">
                        <Select value={juros.tipo} onValueChange={(v: any) => setJuros((j) => ({ ...j, tipo: v }))}>
                          <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>{JUROS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <div className="flex items-center flex-1 gap-1">
                          <Input className="h-8 text-xs text-right" type="number" step={0.1} min={0}
                            value={juros.taxaMensal * 100}
                            onChange={(e) => setJuros((j) => ({ ...j, taxaMensal: parseFloat(e.target.value) / 100 || 0 }))} />
                          <span className="text-xs text-slate-400">%/mês</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-500">Data Final</Label>
                      <Input className="h-8 text-xs" type="date" value={cfg.dataCalculo} onChange={(e) => upd("dataCalculo", e.target.value)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] text-slate-500">Prescrição quinquenal</Label>
                      <Switch checked={prescricao.aplicar} onCheckedChange={(v) => setPrescricao((p) => ({ ...p, aplicar: v }))} />
                    </div>
                    {prescricao.aplicar && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-slate-500">Marco</Label>
                          <Input className="h-8 text-xs" type="date" value={prescricao.marcoInterruptivo} onChange={(e) => setPrescricao((p) => ({ ...p, marcoInterruptivo: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-slate-500">Anos</Label>
                          <Input className="h-8 text-xs" type="number" min={1} max={20} value={prescricao.anos} onChange={(e) => setPrescricao((p) => ({ ...p, anos: parseInt(e.target.value) || 5 }))} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>

              {/* RMA Chart */}
              {result && (
                <Card className="shadow-sm">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b">
                    <CardTitle className="text-xs flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-green-600" />Evolução do Benefício (RMA)</CardTitle>
                    <div className="flex gap-1">
                      <Button size="sm" variant={rmaViewMode === "chart" ? "secondary" : "ghost"} className="h-6 w-6 p-0" onClick={() => setRmaViewMode("chart")}><LineChartIcon className="w-3 h-3" /></Button>
                      <Button size="sm" variant={rmaViewMode === "table" ? "secondary" : "ghost"} className="h-6 w-6 p-0" onClick={() => setRmaViewMode("table")}><TableIcon className="w-3 h-3" /></Button>
                    </div>
                  </div>
                  <CardContent className="p-3">
                    {rmaViewMode === "chart" ? (
                      <>
                        <ResponsiveContainer width="100%" height={180}>
                          <LineChart data={result.rmaEvolution.filter((_, i) => i % Math.max(1, Math.floor(result.rmaEvolution.length / 60)) === 0).map((r) => ({ name: r.competencia.substring(0, 4), val: r.valorRma }))}
                            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `R$${(v/1000).toFixed(1)}k`} width={48} />
                            <RTooltip formatter={(v: number) => fmtR(v)} contentStyle={{ fontSize: 11 }} />
                            <Line type="monotone" dataKey="val" stroke="#2563eb" dot={false} strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="mt-2 p-2 bg-blue-50 rounded-lg flex justify-between items-center">
                          <span className="text-[11px] text-blue-600 font-medium">RMA Atual ({fmtMes(cfg.dataCalculo.substring(0,7))})</span>
                          <span className="text-sm font-bold text-blue-800">{fmtR(result.rmaAtual)}</span>
                        </div>
                      </>
                    ) : (
                      <ScrollArea className="h-52">
                        <Table>
                          <TableHeader className="sticky top-0 bg-slate-50">
                            <TableRow>
                              <TableHead className="text-xs py-1">Competência</TableHead>
                              <TableHead className="text-xs py-1 text-right">RMA Vigente</TableHead>
                              <TableHead className="text-xs py-1 text-right">Reajuste</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.rmaEvolution.map((r) => (
                              <TableRow key={r.competencia} className={`text-xs ${r.taxaReajuste > 0 ? "bg-violet-50" : ""}`}>
                                <TableCell className="py-1 font-mono">{fmtMes(r.competencia)}</TableCell>
                                <TableCell className="py-1 text-right tabular-nums font-semibold">{fmtR(r.valorRma)}</TableCell>
                                <TableCell className="py-1 text-right">
                                  {r.taxaReajuste > 0
                                    ? <span className="text-violet-700 font-semibold">{fmtPct(r.taxaReajuste)}</span>
                                    : <span className="text-slate-300">—</span>}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Resultado Final */}
              {result && (
                <section id="sec-resultado">
                  <Card className="shadow-sm">
                    <CardHeader className="py-2.5 px-4 border-b">
                      <CardTitle className="text-xs flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-blue-600" />Resultado Final</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-3">
                      <Button size="sm" className="h-8 text-xs gap-1.5 w-full bg-[#0f2a4a] hover:bg-[#1e3a5f] text-white" onClick={gerarLaudo} disabled={salvandoCalculo}>
                        {salvandoCalculo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                        {salvandoCalculo ? "Salvando…" : "Gerar Laudo Técnico"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5 w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                        onClick={exportarParaValorCausa}
                        title="Exporta RMI, DIB, DER e demais dados para o módulo de Valor da Causa"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        Calcular Valor da Causa com estes dados
                      </Button>
                      {recuperandoChave && (
                        <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-2.5 py-2 text-xs text-blue-700">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />Recuperando cálculo…
                        </div>
                      )}
                      {chaveRecuperacao && (
                        <div className="rounded-md bg-slate-50 border border-slate-200 px-2.5 py-2 space-y-1">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                            <KeyRound className="w-3 h-3" />Chave de Recuperação
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs font-mono font-bold text-[#0f2a4a] tracking-wider">{chaveRecuperacao}</code>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700"
                              onClick={() => { navigator.clipboard.writeText(chaveRecuperacao); toast({ title: "Chave copiada!" }); }}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <p className="text-[9px] text-slate-400 leading-tight">Use esta chave para recuperar o cálculo a qualquer momento</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-700 text-white rounded-lg p-3">
                          <p className="text-[10px] text-slate-300 mb-1">Total Bruto de Atrasados</p>
                          <p className="text-base font-extrabold">{fmtR(result.totalBruto)}</p>
                        </div>
                        <div className="bg-green-600 text-white rounded-lg p-3">
                          <p className="text-[10px] text-green-100 mb-1">Total Atualizado (Correção + Juros)</p>
                          <p className="text-base font-extrabold">{fmtR(result.totalAtualizado)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </section>
              )}

              {/* RMI config (always visible) */}
              <Card className="shadow-sm">
                <CardHeader className="py-2.5 px-4 border-b">
                  <CardTitle className="text-xs text-slate-500">Configuração da RMI</CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-slate-500">Média 80% maiores</Label>
                    <Switch checked={cfg.usarMedia80} onCheckedChange={(v) => upd("usarMedia80", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-slate-500">Aplicar teto INSS</Label>
                    <Switch checked={cfg.aplicarTeto} onCheckedChange={(v) => {
                      if (v) {
                        const dataRef = cfg.dib || cfg.der || cfg.dataCalculo;
                        const teto = getTetoInss(dataRef);
                        if (teto) upd("tetoRmi", teto.valor);
                      }
                      upd("aplicarTeto", v);
                    }} />
                  </div>
                  {cfg.aplicarTeto && (() => {
                    const dataRef = cfg.dib || cfg.der || cfg.dataCalculo;
                    const tetoInfo = getTetoInss(dataRef);
                    const refLabel = cfg.dib ? "DIB" : cfg.der ? "DER" : "data-base";
                    const dateBtns = [
                      { label: "DIB",       date: cfg.dib         },
                      { label: "DER",       date: cfg.der         },
                      { label: "Data-base", date: cfg.dataCalculo },
                    ].filter((x) => x.date && getTetoInss(x.date));
                    return (
                      <div className="space-y-1.5">
                        {tetoInfo && (
                          <div className="rounded-md bg-amber-50 border border-amber-200 px-2.5 py-2 space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] text-amber-700 font-semibold">
                                Teto na {refLabel} ({fmtMes(tetoInfo.vigencia)})
                              </span>
                              <span className="text-[11px] font-bold text-amber-800">{fmtR(tetoInfo.valor)}</span>
                            </div>
                            <p className="text-[9.5px] text-amber-600 leading-tight">{tetoInfo.legislacao}</p>
                            {cfg.tetoRmi !== tetoInfo.valor && (
                              <button type="button" onClick={() => upd("tetoRmi", tetoInfo.valor)}
                                className="text-[9.5px] text-amber-700 hover:text-amber-900 underline">
                                ↺ Restaurar da tabela
                              </button>
                            )}
                          </div>
                        )}
                        <Input className="h-7 text-xs" type="number" placeholder="Valor do teto (R$)"
                          value={cfg.tetoRmi || ""}
                          onChange={(e) => upd("tetoRmi", parseFloat(e.target.value) || 0)} />
                        {dateBtns.length > 1 && (
                          <div className="flex gap-1">
                            {dateBtns.map((x) => {
                              const t = getTetoInss(x.date)!;
                              return (
                                <button key={x.label} type="button"
                                  onClick={() => upd("tetoRmi", t.valor)}
                                  className={`flex-1 text-[9px] border rounded px-1 py-0.5 text-center transition-colors leading-tight ${
                                    cfg.tetoRmi === t.valor
                                      ? "bg-amber-500 text-white border-amber-500"
                                      : "border-amber-300 text-amber-700 hover:bg-amber-50"
                                  }`}>
                                  {x.label}<br/>{fmtR(t.valor)}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-slate-500">RMI manual</Label>
                    <Switch checked={cfg.usarRmiManual} onCheckedChange={(v) => upd("usarRmiManual", v)} />
                  </div>
                  {cfg.usarRmiManual && <Input className="h-7 text-xs" type="number" placeholder="Valor da RMI" value={cfg.rmiManual} onChange={(e) => upd("rmiManual", parseFloat(e.target.value) || 0)} />}
                </CardContent>
              </Card>

            </div>{/* end right panel */}
          </div>{/* end grid */}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SEÇÃO 8 — PRESCRIÇÃO QUINQUENAL (full-width abaixo da grid)     */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <section id="sec-quinquenio" className="mt-4">
            <Card className="shadow-sm">
              <CardHeader className="py-3 px-4 border-b bg-[#0f2a4a]">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-sm text-white flex items-center gap-2">
                      <Scale className="w-4 h-4 text-blue-300" />
                      Prescrição Quinquenal — Análise por Competência
                    </CardTitle>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Motor técnico de recorte. Não substitui argumentação jurídica.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-[11px] text-slate-300">Modo</Label>
                      <Select value={quinquenioMode} onValueChange={(v) => setQuinquenioMode(v as QCalculationMode)}>
                        <SelectTrigger className="h-7 text-xs w-40 bg-white/10 border-white/20 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quinquenio" className="text-xs">Aplicar quinquênio</SelectItem>
                          <SelectItem value="integral" className="text-xs">Cálculo integral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-white/30 text-white hover:bg-white/10"
                      onClick={() => setQuinquenioUseManual((p) => !p)}
                    >
                      {quinquenioUseManual ? "Usar dados do cálculo" : "Entrada manual (TSV)"}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {/* Entrada manual TSV */}
                {quinquenioUseManual && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
                    <Label className="text-[11px] text-amber-800 font-medium">
                      Cole os dados em formato TSV (Data ⇥ Valor ⇥ Rubrica)
                    </Label>
                    <textarea
                      value={rawQuinquenioInput}
                      onChange={(e) => setRawQuinquenioInput(e.target.value)}
                      rows={8}
                      className="w-full font-mono text-xs border border-amber-300 rounded px-2 py-1.5 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder:text-slate-400"
                      placeholder={"Data\tValor\tRubrica\njan/20\tR$ 632,12\tVencimento Básico\n06/2021\tR$ 1.500,00\tRetribuição por Titulação"}
                    />
                    <p className="text-[10px] text-amber-700">
                      Formatos aceitos: <code className="bg-amber-100 px-1 rounded">jan/20</code>, <code className="bg-amber-100 px-1 rounded">01/2020</code>, <code className="bg-amber-100 px-1 rounded">2020-01</code>
                    </p>
                  </div>
                )}

                {!quinquenioUseManual && !result && (
                  <div className="flex flex-col items-center justify-center py-6 gap-2 text-center text-slate-400">
                    <Scale className="w-8 h-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">Execute o cálculo principal primeiro</p>
                    <p className="text-xs">As parcelas apuradas de atrasados serão analisadas aqui automaticamente.</p>
                  </div>
                )}

                {(result || quinquenioUseManual) && qSummary.quantidadeIntegral === 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-500">
                    <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                    Nenhuma competência com diferença positiva encontrada.
                    {!quinquenioUseManual && " Use o modo 'Entrada manual (TSV)' para inserir dados diretamente."}
                  </div>
                )}

                {qSummary.quantidadeIntegral > 0 && (
                  <>
                    {/* Cards síntese */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-slate-100 p-3">
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Total integral</p>
                        <p className="text-lg font-extrabold text-slate-800 mt-1">{fmtR(qSummary.totalIntegral)}</p>
                        <p className="text-[10px] text-slate-400">{qSummary.quantidadeIntegral} competências</p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-3">
                        <p className="text-[10px] text-emerald-700 font-medium uppercase tracking-wide">Total exigível</p>
                        <p className="text-lg font-extrabold text-emerald-800 mt-1">{fmtR(qSummary.totalExigivel)}</p>
                        <p className="text-[10px] text-emerald-600">{qSummary.quantidadeExigivel} competências</p>
                      </div>
                      <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200 p-3">
                        <p className="text-[10px] text-rose-700 font-medium uppercase tracking-wide">Total prescrito</p>
                        <p className="text-lg font-extrabold text-rose-800 mt-1">{fmtR(qSummary.totalPrescrito)}</p>
                        <p className="text-[10px] text-rose-600">{qSummary.quantidadePrescrita} competências</p>
                      </div>
                    </div>

                    {/* Memória técnica + faixas */}
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
                      <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Memória Técnica</p>
                      <p className="text-xs leading-5 text-slate-700">{qMemoriaTecnica}</p>
                      <div className="grid grid-cols-3 gap-2 pt-1 text-[10px] text-slate-500">
                        <div><span className="font-semibold">Corte técnico:</span> {qSummary.dataCorte ?? "não aplicado"}</div>
                        <div><span className="font-semibold">Faixa integral:</span> {qSummary.competenciaInicialIntegral ?? "—"} → {qSummary.competenciaFinalIntegral ?? "—"}</div>
                        <div><span className="font-semibold">Faixa exigível:</span> {qSummary.competenciaInicialExigivel ?? "—"} → {qSummary.competenciaFinalExigivel ?? "—"}</div>
                      </div>
                    </div>

                    {/* Resumo por rubrica */}
                    {qGrouped.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2">Resumo por Rubrica</p>
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="bg-[#0f2a4a] text-white text-left">
                                <th className="px-3 py-2 font-medium">Rubrica</th>
                                <th className="px-3 py-2 font-medium text-right">Integral</th>
                                <th className="px-3 py-2 font-medium text-right">Exigível</th>
                                <th className="px-3 py-2 font-medium text-right">Prescrito</th>
                              </tr>
                            </thead>
                            <tbody>
                              {qGrouped.map((item) => (
                                <tr key={item.rubrica} className="border-t border-slate-100 even:bg-slate-50">
                                  <td className="px-3 py-2 font-medium text-slate-700">{item.rubrica}</td>
                                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{fmtR(item.totalIntegral)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700">{fmtR(item.totalExigivel)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-rose-700">{fmtR(item.totalPrescrito)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Detalhamento por competência */}
                    <div>
                      <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2">Detalhamento por Competência</p>
                      <ScrollArea className="h-72 rounded-xl border border-slate-200">
                        <table className="min-w-full text-xs">
                          <thead className="sticky top-0 bg-slate-50 z-10">
                            <tr className="border-b border-slate-200 text-left">
                              <th className="px-3 py-2 font-medium text-slate-500">Competência</th>
                              <th className="px-3 py-2 font-medium text-slate-500">Rubrica</th>
                              <th className="px-3 py-2 font-medium text-slate-500 text-right">Valor considerado</th>
                              <th className="px-3 py-2 font-medium text-slate-500">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {qDetailedRows.map((row) => (
                              <tr key={row.id} className="border-b border-slate-100 even:bg-slate-50 hover:bg-slate-100 transition-colors">
                                <td className="px-3 py-1.5 font-mono text-slate-600">{row.parsed.label}</td>
                                <td className="px-3 py-1.5 text-slate-600">{row.rubrica}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-slate-700">{fmtR(row.valorConsiderado)}</td>
                                <td className="px-3 py-1.5">
                                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                    row.statusPrescricao === "EXIGIVEL"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-rose-100 text-rose-800"
                                  }`}>
                                    {row.statusPrescricao}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ScrollArea>
                    </div>

                    {/* Texto sugerido para relatório */}
                    <div className="rounded-xl bg-[#0f2a4a] p-4 space-y-2">
                      <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide">Texto sugerido para o relatório</p>
                      <p className="text-xs leading-5 text-slate-200">
                        O presente demonstrativo foi elaborado com base nas competências mensais informadas, permitindo-se, por parametrização, a apuração integral ou a aplicação de recorte técnico quinquenal. Quando ativado, o recorte considera como exigíveis as parcelas compreendidas nos 5 anos anteriores à data de ajuizamento indicada pelo usuário, preservando-se a matéria jurídica relativa à prescrição, sua eventual interrupção, suspensão ou afastamento para análise na petição e pelo Juízo competente.
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </section>

        </div>{/* end scrollable body */}
      </div>{/* end main content */}
    </div>
  );
}
