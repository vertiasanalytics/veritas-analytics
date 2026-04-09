import React, { useMemo, useRef, useState } from "react";
import { Upload, FileText, Play, Download, AlertCircle, CheckCircle2, Search, ArrowRight, SendHorizonal } from "lucide-react";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useDebitCredits } from "@/hooks/use-wallet";
import { isEducationalPlan } from "@/lib/plan-access";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

const API_BASE = "";

/* ============================================================
 * TIPOS
 * ============================================================ */

type AggregateMode = "sum" | "first";
type MonthlyMap = Record<string, number>;
type ExtractionByRubrica = Record<string, MonthlyMap>;
type ExtractionByYear = Record<string, ExtractionByRubrica>;

/* Representa um item de texto do PDF com coordenadas */
interface PdfItem {
  x: number;
  y: number;
  str: string;
  width: number;
}

/* Uma linha da tabela (mesmo Y) */
interface PdfRow {
  y: number;
  items: PdfItem[];
}

/* Coluna de mês detectada no cabeçalho */
interface MonthColumn {
  month: string;
  xCenter: number;
  xMin: number;
  xMax: number;
}

/* ============================================================
 * CONSTANTES
 * ============================================================ */

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"] as const;
type Month = typeof MONTHS[number];

const MONTH_INDEX: Record<string, string> = {
  JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06",
  JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12",
};

const MONTHS_SET = new Set<string>(MONTHS);

/* ============================================================
 * DATA — mesmo padrão do módulo Previdenciário
 * ============================================================ */

/**
 * Formata "YYYY-MM" ou "YYYY" + mês abreviado → "mmm/AAAA"
 * Idêntica à fmtMes() do módulo Previdenciário.
 */
function fmtMes(ym: string): string {
  if (!ym || ym.length < 7) return ym;
  const [y, m] = ym.split("-");
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${meses[parseInt(m, 10) - 1]}/${y}`;
}

/** Retorna a data de hoje no formato YYYY-MM-DD (para default do input[type=date]). */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ============================================================
 * UTILITÁRIOS GERAIS
 * ============================================================ */

function sanitizeFilename(value: string) {
  return value
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "").slice(0, 120);
}

function inferYearFromFilename(filename: string) {
  const cleaned = filename.replace(/\.pdf$/i, "");
  if (/^\d{4}$/.test(cleaned)) return cleaned;
  const match = cleaned.match(/\b(19|20)\d{2}\b/);
  return match?.[0] ?? cleaned;
}

function normalize(value: string): string {
  return value
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim().toUpperCase();
}

/** Tenta fazer parse de um número no formato brasileiro.
 *  Retorna null se a string não for um número válido. */
function tryParseBR(raw: string): number | null {
  const s = raw.replace(/\s/g, "");
  const neg = /^\(.*\)$/.test(s);
  const clean = s.replace(/[()]/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function emptyMonthlyMap(): MonthlyMap {
  const m: MonthlyMap = {};
  for (const k of MONTHS) m[k] = 0;
  return m;
}

/* ============================================================
 * EXTRAÇÃO PDF — mantém coordenadas X,Y por item
 * ============================================================ */

async function extractItemsFromPdf(file: File): Promise<PdfItem[][]> {
  const pdfjsLib = await import("pdfjs-dist");
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).href;
  }
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: PdfItem[][] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items: PdfItem[] = [];
    for (const raw of content.items as any[]) {
      const str = (raw.str ?? "").trim();
      if (!str) continue;
      items.push({
        x: raw.transform[4],
        y: raw.transform[5],
        str,
        width: raw.width ?? 0,
      });
    }
    pages.push(items);
  }
  return pages;
}

/* ============================================================
 * PARSER DE TABELA SIAPE — abordagem two-pass robusta
 *
 * Problema anterior: rubrica e valores estão em Y ligeiramente
 * diferentes no PDF (renderer coloca texto e números em Y
 * distintos na mesma linha visual). A versão anterior agrupava
 * tudo no mesmo Y ±2px e perdia associações.
 *
 * Nova abordagem:
 *   Pass 1 — Detectar colunas de mês pelo cabeçalho (X positions)
 *            e detectar X de corte da coluna TOTAL (excluir)
 *   Pass 2 — Encontrar Y de cada ocorrência de rubrica
 *   Pass 3 — Para cada valor numérico na área de dados,
 *            associar à rubrica cujo Y está mais próximo (±MAX_Y_DIST)
 *            e ao mês pela posição X
 * ============================================================ */

/** Agrupa itens por Y com tolerância para detecção de linhas de cabeçalho */
function groupIntoRows(items: PdfItem[], yTol = 3): PdfRow[] {
  const buckets = new Map<number, PdfItem[]>();
  for (const item of items) {
    const yKey = Math.round(item.y / yTol) * yTol;
    if (!buckets.has(yKey)) buckets.set(yKey, []);
    buckets.get(yKey)!.push(item);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([y, rowItems]) => ({ y, items: rowItems.sort((a, b) => a.x - b.x) }));
}

/** Detecta colunas de mês: retorna centro X de cada mês e limites */
function detectMonthColumns(rows: PdfRow[]): MonthColumn[] {
  let bestRow: PdfRow | null = null;
  let bestCount = 0;
  for (const row of rows) {
    const count = row.items.filter((i) => MONTHS_SET.has(normalize(i.str))).length;
    if (count > bestCount) { bestCount = count; bestRow = row; }
  }
  if (!bestRow || bestCount < 2) return [];

  const monthItems = bestRow.items
    .filter((i) => MONTHS_SET.has(normalize(i.str)))
    .sort((a, b) => a.x - b.x);

  const centers = monthItems.map((i) => ({
    month: normalize(i.str) as Month,
    // Centro = borda esquerda + metade da largura; fallback: usar x + 15
    xCenter: i.x + (i.width > 0 ? i.width / 2 : 15),
  }));

  const gaps: number[] = [];
  for (let i = 1; i < centers.length; i++) gaps.push(centers[i].xCenter - centers[i - 1].xCenter);
  const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 60;
  const half = avgGap / 2;

  return centers.map((c) => ({
    month: c.month,
    xCenter: c.xCenter,
    xMin: c.xCenter - half,
    xMax: c.xCenter + half,
  }));
}

/** Detecta X de início da coluna TOTAL para excluir valores além dela */
function detectTotalCutoffX(rows: PdfRow[], monthCols: MonthColumn[]): number {
  for (const row of rows) {
    // Só interessa a linha de cabeçalho (que tem meses)
    const hasMonths = row.items.some((i) => MONTHS_SET.has(normalize(i.str)));
    if (!hasMonths) continue;

    const lastMonthX = Math.max(...row.items
      .filter((i) => MONTHS_SET.has(normalize(i.str)))
      .map((i) => i.x + (i.width || 0)));

    // Encontrar primeiro item "TOTAL" à direita dos meses
    const totalItem = row.items
      .filter((i) => i.x >= lastMonthX && normalize(i.str).startsWith("TOTAL"))
      .sort((a, b) => a.x - b.x)[0];

    if (totalItem) return totalItem.x;
  }

  // Fallback: último mês + 1.5 * avgGap
  if (monthCols.length < 2) return Infinity;
  const avgGap = (monthCols[monthCols.length - 1].xCenter - monthCols[0].xCenter) / (monthCols.length - 1);
  return monthCols[monthCols.length - 1].xCenter + avgGap * 1.5;
}

/**
 * Retorna true se `s` termina com vírgula + exatamente 1 dígito.
 * Indica decimal incompleto: "2.865.499,0" precisa de mais um dígito.
 */
function isIncompleteDecimal(s: string): boolean {
  return /,\d$/.test(s.trim());
}

/**
 * Dado itens de UMA coluna, reconstrói números partidos em linhas
 * adjacentes. Ex.: "2.865.499,0" (Y=500) + "7" (Y=494) → "2.865.499,07"
 *
 * Retorna lista de { y, str } com números completos.
 */
function reconstructColumnNumbers(colItems: PdfItem[]): { y: number; str: string }[] {
  // Ordenar de cima para baixo (Y decrescente no sistema PDF)
  const sorted = [...colItems].sort((a, b) => b.y - a.y);
  const out: { y: number; str: string }[] = [];

  let i = 0;
  while (i < sorted.length) {
    const cur = sorted[i];
    let str = cur.str.trim();

    // Tentar fusão com próximo item se for complemento decimal
    while (i + 1 < sorted.length) {
      const next = sorted[i + 1];
      const yGap = Math.abs(cur.y - next.y);
      const nextStr = next.str.trim();
      // Fusão: str termina com decimal incompleto + próximo é só dígitos + Y próximo
      if (isIncompleteDecimal(str) && /^\d+$/.test(nextStr) && yGap <= 14) {
        str = str + nextStr;
        i++;
      } else {
        break;
      }
    }

    out.push({ y: cur.y, str });
    i++;
  }
  return out;
}

/**
 * Agrupa itens em linhas usando clustering sequencial.
 *
 * Itens são agrupados na mesma linha se o gap de Y entre um item
 * e o anterior for ≤ maxGap. Isso é diferente do grid-based groupIntoRows:
 * itens de uma linha podem ter Y variado (renderização do PDF), mas o gap
 * entre linhas de tabela distintas costuma ser > 12 px.
 *
 * maxGap=10 cobre:
 *   - variações de baseline entre texto e número (~1-3 px)
 *   - dígito de continuação decimal na linha seguinte (~5-8 px)
 *   - NÃO mescla linhas de tabela distintas (gap tipicamente ~15-25 px)
 */
function clusterIntoRows(items: PdfItem[], maxGap = 10): PdfRow[] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => b.y - a.y); // Y decrescente = topo da página primeiro
  const clusters: PdfItem[][] = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev.y - cur.y > maxGap) {
      clusters.push([]);
    }
    clusters[clusters.length - 1].push(cur);
  }

  return clusters.map((c) => ({
    y: c[0].y,
    items: c.sort((a, b) => a.x - b.x),
  }));
}

/**
 * Extrai rubricas de UMA página do PDF.
 *
 * Lógica correta:
 *   - Agrupar itens em linhas (cluster sequencial, gap ≤ 10px)
 *   - Para cada linha: verificar se o texto à esquerda contém a rubrica buscada
 *   - Se sim: extrair os valores das colunas de mês DESTA LINHA
 *   - Somar apenas linhas com a MESMA rubrica — nunca misturar rubricas diferentes
 *
 * O modo "sum" acumula todas as linhas da rubrica (ex: VENCIMENTO BASICO aparece 3x).
 * O modo "first" usa apenas a primeira linha encontrada.
 */
function extractFromPage(
  pageItems: PdfItem[],
  rubricas: string[],
  aggregate: AggregateMode,
  unmatchedLabels?: Set<string>,
): ExtractionByRubrica {
  const result: ExtractionByRubrica = {};
  for (const r of rubricas) result[r] = {};

  // Detectar colunas a partir do cabeçalho (grid grouping é suficiente para isso)
  const gridRows = groupIntoRows(pageItems, 3);
  const monthCols = detectMonthColumns(gridRows);
  if (!monthCols.length) return result;

  const firstMonthX = monthCols[0].xMin;
  const totalCutoffX = detectTotalCutoffX(gridRows, monthCols);

  // Agrupar dados em linhas com cluster sequencial (suporta variações de Y)
  const dataRows = clusterIntoRows(pageItems, 10);

  // Para o modo "first": rastrear quais rubricas já foram processadas
  const firstSeen = new Set<string>();

  for (const row of dataRows) {
    // Texto de rubrica = itens à esquerda da área de dados
    const labelText = row.items
      .filter((i) => i.x < firstMonthX - 2)
      .map((i) => i.str)
      .join(" ");
    const normLabel = normalize(labelText);
    if (!normLabel) continue;

    // Verificar se a linha corresponde a uma rubrica buscada
    const matched = rubricas.find((r) => normLabel.includes(normalize(r)));
    if (!matched) {
      // Coletar rótulos não reconhecidos que possuem valores numéricos nos meses
      if (unmatchedLabels) {
        const hasNumericData = monthCols.some((col) => {
          const colItems = row.items.filter(
            (i) => i.x >= col.xMin && i.x <= col.xMax && i.x < totalCutoffX,
          );
          const numbers = reconstructColumnNumbers(colItems);
          return numbers.some((n) => tryParseBR(n.str) !== null);
        });
        const cleanLabel = labelText.trim().replace(/\s+/g, " ");
        if (hasNumericData && cleanLabel.length >= 3) {
          unmatchedLabels.add(cleanLabel);
        }
      }
      continue;
    }

    // Modo "first": pular ocorrências seguintes da mesma rubrica
    if (aggregate === "first") {
      if (firstSeen.has(matched)) continue;
      firstSeen.add(matched);
    }

    // Extrair valores de cada coluna de mês NESTA LINHA
    for (const col of monthCols) {
      const colItems = row.items.filter(
        (i) => i.x >= col.xMin && i.x <= col.xMax && i.x < totalCutoffX,
      );

      // Reconstruir números partidos em sub-linhas (ex: "2.865.499,0" + "7")
      const numbers = reconstructColumnNumbers(colItems);

      for (const num of numbers) {
        const value = tryParseBR(num.str);
        if (value === null) continue;
        if (!result[matched][col.month]) result[matched][col.month] = 0;
        result[matched][col.month] += value;
      }
    }
  }

  return result;
}

/* ============================================================
 * ORQUESTRAÇÃO — processa múltiplos arquivos
 * ============================================================ */

async function processFiles(
  files: File[],
  rubricas: string[],
  aggregate: AggregateMode = "sum",
): Promise<ExtractionByYear> {
  const allResults: ExtractionByYear = {};

  for (const file of files) {
    const ano = inferYearFromFilename(file.name);
    const pages = await extractItemsFromPdf(file);

    const yearData: ExtractionByRubrica = {};
    for (const r of rubricas) yearData[r] = emptyMonthlyMap();

    for (const pageItems of pages) {
      const pageResult = extractFromPage(pageItems, rubricas, aggregate);
      for (const rubrica of rubricas) {
        for (const month of MONTHS) {
          const v = pageResult[rubrica]?.[month];
          if (v) yearData[rubrica][month] += v;
        }
      }
    }

    const hasData = Object.values(yearData).some((m) => Object.values(m).some((v) => v !== 0));
    if (hasData) allResults[ano] = yearData;
  }

  return allResults;
}

/* ============================================================
 * CSV — formato do Anexo: Data;Valor (separador ;, ano 2 dígitos)
 * ============================================================ */

/** Formata YYYY-MM para jan/20 (2 dígitos no ano, para exportação CSV) */
function fmtMesCsvShort(ym: string): string {
  if (!ym || ym.length < 7) return ym;
  const [y, m] = ym.split("-");
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${meses[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

/** Gera CSV de UMA rubrica com formato Data;Valor (ponto-e-vírgula, moeda BR) */
function buildCsvForRubrica(data: ExtractionByYear, rubrica: string): string {
  const lines: string[] = ["Data;Valor"];
  for (const year of Object.keys(data).sort()) {
    if (!data[year]?.[rubrica]) continue;
    for (const month of MONTHS) {
      const val = data[year][rubrica][month];
      if (!val) continue;
      const dateStr = fmtMesCsvShort(`${year}-${MONTH_INDEX[month]}`);
      const valStr = val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      lines.push(`${dateStr};${valStr}`);
    }
  }
  return lines.join("\n");
}

/* ============================================================
 * INTEGRAÇÃO SIAPE → PREVIDENCIÁRIO (localStorage)
 * ============================================================ */

const SIAPE_IMPORT_KEY = "veritas_siape_wizard_import";

export interface SiapeImportEntry {
  rubrica: string;
  rows: Array<{ competencia: string; valorOriginal: number }>;
}

/** Converte ExtractionByYear de uma rubrica em SalaryRows (competencia=YYYY-MM) */
function toSalaryRows(data: ExtractionByYear, rubrica: string): Array<{ competencia: string; valorOriginal: number }> {
  const out: Array<{ competencia: string; valorOriginal: number }> = [];
  for (const year of Object.keys(data).sort()) {
    if (!data[year]?.[rubrica]) continue;
    for (const month of MONTHS) {
      const val = data[year][rubrica][month];
      if (!val) continue;
      out.push({ competencia: `${year}-${MONTH_INDEX[month]}`, valorOriginal: val });
    }
  }
  return out;
}

/* ============================================================
 * COMPONENTE PRINCIPAL
 * ============================================================ */

export default function ContrachequeSimape() {
  const { user } = useAuth();
  const debitCredits = useDebitCredits();
  const [, navigate] = useLocation();

  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/plans`, { headers: getAuthHeaders() });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
  });

  const planSlug: string | null = (plansData?.currentSubscription as any)?.slug ?? null;
  const eduPlan = isEducationalPlan(planSlug) && user?.role !== "admin";

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [rubricaInput, setRubricaInput] = useState("");
  const [aggregate, setAggregate] = useState<AggregateMode>("sum");
  const [dataCalculo, setDataCalculo] = useState<string>(todayISO);
  const [status, setStatus] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });
  const [extractedData, setExtractedData] = useState<ExtractionByYear>({});
  const [unmatchedLabels, setUnmatchedLabels] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [showSendDialog, setShowSendDialog] = useState(false);

  const rubricasList = useMemo(
    () => rubricaInput.split(",").map((r) => r.trim()).filter(Boolean).slice(0, 5),
    [rubricaInput],
  );

  /* Linhas para a tabela de resultados — usa formato padrão do Previdenciário (mmm/AAAA) */
  const flatRows = useMemo(() => {
    const rows: Array<{ rubrica: string; mesAno: string; valor: number }> = [];
    for (const ano of Object.keys(extractedData).sort()) {
      const rubricas = extractedData[ano];
      for (const rubrica of Object.keys(rubricas).sort()) {
        for (const mes of MONTHS) {
          rows.push({
            rubrica,
            mesAno: fmtMes(`${ano}-${MONTH_INDEX[mes]}`),
            valor: rubricas[rubrica][mes] ?? 0,
          });
        }
      }
    }
    return rows;
  }, [extractedData]);

  const nonZeroCount = useMemo(() => flatRows.filter((r) => r.valor !== 0).length, [flatRows]);

  async function handleExtract() {
    if (!selectedFiles.length) {
      setStatus({ type: "error", message: "Selecione ao menos um arquivo PDF." });
      return;
    }
    if (!rubricasList.length) {
      setStatus({ type: "error", message: "Digite ao menos uma rubrica." });
      return;
    }

    const ok = await debitCredits(5, "Extrator Contracheque SIAPE");
    if (!ok) return;

    setStatus({ type: "loading", message: "Processando PDF(s)..." });
    setErrors([]);
    setExtractedData({});

    const localErrors: string[] = [];
    let allResults: ExtractionByYear = {};
    const unmatchedSet = new Set<string>();

    try {
      const fileList = [...selectedFiles];
      const perFileResults: ExtractionByYear[] = [];

      for (const file of fileList) {
        try {
          const ano = inferYearFromFilename(file.name);
          const pages = await extractItemsFromPdf(file);
          const yearData: ExtractionByRubrica = {};
          for (const r of rubricasList) yearData[r] = emptyMonthlyMap();

          for (const pageItems of pages) {
            const pageResult = extractFromPage(pageItems, rubricasList, aggregate, unmatchedSet);
            for (const rubrica of rubricasList) {
              for (const month of MONTHS) {
                const v = pageResult[rubrica]?.[month];
                if (v) yearData[rubrica][month] += v;
              }
            }
          }

          const hasData = Object.values(yearData).some((m) =>
            Object.values(m).some((v) => v !== 0),
          );
          if (hasData) allResults[ano] = yearData;
        } catch (err: any) {
          localErrors.push(`${file.name}: ${err?.message ?? "erro desconhecido"}`);
        }
      }
    } catch (err: any) {
      localErrors.push(err?.message ?? "erro desconhecido");
    }

    setExtractedData(allResults);
    setUnmatchedLabels([...unmatchedSet].slice(0, 30));
    setErrors(localErrors);

    if (!Object.keys(allResults).length) {
      setStatus({
        type: "error",
        message: localErrors.length
          ? `Nenhum resultado encontrado. Erros: ${localErrors.join(" | ")}`
          : "Nenhum resultado encontrado. Verifique se o nome da rubrica corresponde exatamente ao texto do PDF (sem acentos).",
      });
      return;
    }

    setStatus({
      type: "success",
      message: `Extração concluída: ${Object.keys(allResults).length} arquivo(s) com dados${
        localErrors.length ? `, ${localErrors.length} erro(s)` : ""
      }.`,
    });
  }

  function handleExportCsv() {
    if (!Object.keys(extractedData).length) return;
    // Um arquivo CSV por rubrica no formato Data;Valor
    for (const rubrica of rubricasList) {
      const csv = buildCsvForRubrica(extractedData, rubrica);
      const lines = csv.split("\n");
      if (lines.length <= 1) continue; // sem dados para essa rubrica
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitizeFilename(rubrica)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function handleSendToWizard() {
    const entries: SiapeImportEntry[] = rubricasList
      .map((rubrica) => ({
        rubrica,
        rows: toSalaryRows(extractedData, rubrica),
      }))
      .filter((e) => e.rows.length > 0);

    if (!entries.length) return;
    localStorage.setItem(SIAPE_IMPORT_KEY, JSON.stringify(entries));
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-slate-100 pt-16">
      <div className="mx-auto max-w-[1280px] px-4 py-8">

        {/* ── CABEÇALHO ─────────────────────────────────────── */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Extração de Contracheques SIAPE
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Busca simultânea de até 5 rubricas em múltiplos PDFs anuais.{" "}
            <span className="font-semibold text-amber-700">5 créditos</span> por extração.
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            O sistema detecta automaticamente as colunas de mês (JAN–DEZ) em cada página e ignora a coluna de totais.
          </p>
          {eduPlan && (
            <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
              <strong>Plano Educacional:</strong> relatórios com marca d'água educacional.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">

          {/* ── CONTROLES ───────────────────────────────────── */}
          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-600" />
              <h2 className="text-lg font-semibold text-slate-900">Controles</h2>
            </div>

            <div className="space-y-5">

              {/* Seleção de PDFs */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  1. Selecione os PDFs anuais
                </label>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setSelectedFiles(files);
                    setStatus({
                      type: "idle",
                      message: files.length ? `${files.length} arquivo(s) selecionado(s).` : "",
                    });
                  }}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Upload className="h-4 w-4" /> Procurar PDFs
                </button>
                <div className="mt-3 max-h-32 overflow-auto rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                  {selectedFiles.length ? (
                    selectedFiles.map((f) => (
                      <div key={f.name} className="truncate">{f.name}</div>
                    ))
                  ) : (
                    <span className="text-slate-400">Nenhum arquivo selecionado.</span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  O ano é inferido do nome do arquivo (ex.: <em>contracheque_2023.pdf</em>).
                </p>
              </div>

              {/* Rubricas */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  2. Nome da(s) rubrica(s)
                </label>
                <input
                  value={rubricaInput}
                  onChange={(e) => setRubricaInput(e.target.value)}
                  placeholder="Ex.: VENCIMENTO BASICO, AUXILIO ALIMENTACAO"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Separe por vírgula. Máx. 5 rubricas. Digite sem acentos para maior compatibilidade.
                </p>
                {rubricasList.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {rubricasList.map((r) => (
                      <span
                        key={r}
                        className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-medium text-white"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Data de referência — mesmo padrão do módulo Previdenciário */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  3. Data de referência do cálculo
                </label>
                <input
                  type="date"
                  value={dataCalculo}
                  onChange={(e) => setDataCalculo(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Data-base do cálculo — registrada no relatório e no CSV exportado.
                  {dataCalculo && (
                    <span className="ml-1 font-semibold text-slate-600">
                      ({new Date(dataCalculo + "T12:00:00").toLocaleDateString("pt-BR")})
                    </span>
                  )}
                </p>
              </div>

              {/* Estratégia de consolidação */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  4. Consolidação de ocorrências múltiplas
                </label>
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      checked={aggregate === "sum"}
                      onChange={() => setAggregate("sum")}
                    />
                    Somar todas as linhas da mesma rubrica (padrão)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      checked={aggregate === "first"}
                      onChange={() => setAggregate("first")}
                    />
                    Pegar apenas a primeira ocorrência
                  </label>
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Quando a mesma rubrica aparece em mais de uma linha para o mesmo mês, como no exemplo acima.
                </p>
              </div>

              {/* Botão */}
              <button
                type="button"
                onClick={handleExtract}
                disabled={status.type === "loading"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                {status.type === "loading" ? "Processando..." : "Extrair dados"}
              </button>

              {/* Status */}
              <div
                className={`rounded-2xl border p-3 text-sm ${
                  status.type === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : status.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : status.type === "loading"
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                <div className="flex items-start gap-2">
                  {status.type === "error" ? (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : status.type === "success" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <Search className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span>{status.message || "Aguardando processamento."}</span>
                </div>
              </div>
            </div>
          </section>

          {/* ── RESULTADOS ──────────────────────────────────── */}
          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Resultados da extração</h2>
                  <p className="text-sm text-slate-500">
                    Rubrica, competência e valor extraído.
                    {dataCalculo && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                        Data-base:{" "}
                        {new Date(dataCalculo + "T12:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!flatRows.length}
                  onClick={handleExportCsv}
                  className="shrink-0 inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" /> Exportar CSV
                </button>
              </div>

              {/* Card de integração com o Previdenciário */}
              {nonZeroCount > 0 && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                  {!showSendDialog ? (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-indigo-900">
                          Deseja enviar os valores extraídos para o Previdenciário?
                        </p>
                        <p className="text-xs text-indigo-700 mt-0.5">
                          Os valores serão adicionados como Salários de Contribuição na seção Previdenciária.
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowSendDialog(true)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                        >
                          <SendHorizonal className="h-4 w-4" /> Enviar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-indigo-900">Confirmar envio para Atualização Financeira</p>
                      <p className="text-xs text-indigo-700">Os dados serão carregados na aba <strong>Partes e Parcelas</strong> ao abrir um processo de Atualização Financeira.</p>
                      {(() => {
                        const withData = rubricasList.filter((r) => toSalaryRows(extractedData, r).length > 0);
                        const skipped = rubricasList.filter((r) => toSalaryRows(extractedData, r).length === 0);

                        const getSuggestions = (rub: string): string[] => {
                          if (!unmatchedLabels.length) return [];
                          const normRub = normalize(rub);
                          const rubWords = normRub.split(/\s+/).filter((w) => w.length > 2);
                          return unmatchedLabels
                            .map((label) => {
                              const normLabel = normalize(label);
                              const score = rubWords.filter((w) => normLabel.includes(w)).length;
                              return { label, score };
                            })
                            .filter(({ score }) => score > 0)
                            .sort((a, b) => b.score - a.score)
                            .slice(0, 3)
                            .map(({ label }) => label);
                        };

                        return (
                          <>
                            {withData.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">Serão enviadas ({withData.length})</p>
                                {withData.map((rub) => {
                                  const rows = toSalaryRows(extractedData, rub);
                                  return (
                                    <div key={rub} className="flex items-center justify-between rounded-xl bg-white border border-indigo-200 px-3 py-2">
                                      <span className="text-sm font-medium text-slate-800 truncate">{rub}</span>
                                      <span className="text-xs text-indigo-700 font-semibold shrink-0 ml-2">
                                        {rows.length} competência{rows.length !== 1 ? "s" : ""}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {skipped.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Sem dados extraídos — serão ignoradas ({skipped.length})</p>
                                {skipped.map((rub) => {
                                  const suggestions = getSuggestions(rub);
                                  return (
                                    <div key={rub} className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-500 truncate line-through">{rub}</span>
                                        <span className="text-xs text-amber-600 font-semibold shrink-0 ml-2">0 competências</span>
                                      </div>
                                      {suggestions.length > 0 && (
                                        <div className="space-y-1">
                                          <p className="text-xs text-amber-700 font-medium">Encontrado no PDF — você quis dizer?</p>
                                          {suggestions.map((s) => (
                                            <button
                                              key={s}
                                              type="button"
                                              onClick={() => {
                                                setRubricaInput((prev) => {
                                                  const parts = prev.split(",").map((p) => p.trim());
                                                  const idx = parts.findIndex((p) => normalize(p) === normalize(rub));
                                                  if (idx >= 0) parts[idx] = s;
                                                  return parts.join(", ");
                                                });
                                                setShowSendDialog(false);
                                              }}
                                              className="block w-full text-left text-xs bg-white border border-amber-300 rounded-lg px-2 py-1 text-slate-700 hover:bg-amber-100 hover:border-amber-400 transition-colors font-mono truncate"
                                            >
                                              {s}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {withData.length === 0 && skipped.length > 0 && (
                              <p className="text-xs text-red-700 font-medium bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                                Nenhuma rubrica possui dados extraídos. Use as sugestões acima para corrigir os nomes e extraia novamente.
                              </p>
                            )}
                          </>
                        );
                      })()}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSendToWizard}
                          disabled={rubricasList.every((r) => toSalaryRows(extractedData, r).length === 0)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ArrowRight className="h-4 w-4" /> Confirmar e ir para Processos
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSendDialog(false)}
                          className="rounded-xl border border-indigo-200 px-4 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {errors.length > 0 && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <div className="font-semibold">Arquivos com erro</div>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="max-h-[640px] overflow-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-slate-100">
                    <tr>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                        Rubrica
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-center font-semibold text-slate-700">
                        Mês/Ano
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold text-slate-700">
                        Valor (R$)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {!flatRows.length ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-12 text-center text-slate-400">
                          Nenhum resultado disponível. Faça a extração para ver os dados.
                        </td>
                      </tr>
                    ) : (
                      flatRows.map((row, index) => (
                        <tr
                          key={`${row.rubrica}-${row.mesAno}-${index}`}
                          className="odd:bg-white even:bg-slate-50"
                        >
                          <td className="border-b border-slate-100 px-4 py-2.5 font-medium">
                            {row.rubrica}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-2.5 text-center text-slate-600">
                            {row.mesAno}
                          </td>
                          <td
                            className={`border-b border-slate-100 px-4 py-2.5 text-right tabular-nums ${
                              row.valor === 0 ? "text-slate-300" : "text-slate-900"
                            }`}
                          >
                            {formatCurrency(row.valor)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {flatRows.length > 0 && (
              <div className="mt-3 text-right text-xs text-slate-400">
                {nonZeroCount} entradas com valor · {flatRows.length} linhas totais
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
