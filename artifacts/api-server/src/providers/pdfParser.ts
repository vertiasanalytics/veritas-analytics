/**
 * pdfParser.ts — Parser da "Tabela de Índices Mensais" do TRF1
 *
 * Extrai registros estruturados do arquivo texto gerado a partir do PDF oficial
 * AesCveisemGeral (TRF1), contendo os coeficientes em Real para os índices:
 *   ORTN (out/1964–fev/1986), OTN (mar/1986–jan/1989), BTN (fev/1989–fev/1991),
 *   INPC (mar/1991–dez/1991), UFIR (jan/1992–dez/2000), IPCA-E (jan/2001–out/2019)
 *
 * Cada registro contém o coeficiente em Real (fator acumulado de atualização
 * monetária para aquele período), conforme publicado pelo TRF1.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const MONTH_MAP: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04",
  mai: "05", jun: "06", jul: "07", ago: "08",
  set: "09", out: "10", nov: "11", dez: "12",
};

const KNOWN_INDEX_TYPES = new Set(["ORTN", "OTN", "BTN", "INPC", "UFIR", "IPCA-E"]);

export interface PdfIndexRecord {
  periodo:     string;   // YYYY-MM
  indiceTipo:  string;   // ORTN | OTN | BTN | INPC | UFIR | IPCA_E
  coefEmReal:  number;   // Coef. em REAL (fator acumulado de atualização)
  rawLine:     string;
}

export interface PdfParseResult {
  records:  PdfIndexRecord[];
  skipped:  string[];
  warnings: string[];
  byType:   Record<string, number>;
}

function normalizePeriod(raw: string): string | null {
  const m = raw.trim().match(/^([a-z]{3})\/(\d{2,4})$/i);
  if (!m) return null;
  const mon = MONTH_MAP[m[1].toLowerCase()];
  if (!mon) return null;
  let year = parseInt(m[2], 10);
  if (m[2].length === 2) {
    year = year <= 30 ? 2000 + year : 1900 + year;
  }
  return `${year}-${mon}`;
}

function normalizeIndexType(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (upper === "IPCA-E") return "IPCA_E";
  return upper;
}

function isNumericToken(s: string): boolean {
  return /^\d[\d.,]*$/.test(s);
}

export function parsePdfText(text: string): PdfParseResult {
  const lines   = text.split("\n");
  const records: PdfIndexRecord[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  const SKIP_PREFIXES = [
    "bela de", "data ", " data", "base ", "obs", "a) ", "b) ", "c) ",
  ];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const lc = trimmed.toLowerCase();
    if (SKIP_PREFIXES.some((p) => lc.startsWith(p))) continue;
    if (trimmed.startsWith("Coef")) continue;

    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (tokens.length < 3) {
      if (trimmed.length > 3) skipped.push(trimmed);
      continue;
    }

    const rawPeriod = tokens[0];
    const rawType   = tokens[1];

    if (!KNOWN_INDEX_TYPES.has(rawType.toUpperCase()) && rawType.toUpperCase() !== "IPCA-E") {
      if (trimmed.length > 3) skipped.push(trimmed);
      continue;
    }

    const periodo = normalizePeriod(rawPeriod);
    if (!periodo) {
      skipped.push(`Período inválido: ${rawPeriod}`);
      continue;
    }

    const indiceTipo = normalizeIndexType(rawType);

    const coefToken = tokens.slice(2).find(isNumericToken);
    if (!coefToken) {
      if (tokens.slice(2).some((t) => t.includes("DIV"))) {
        skipped.push(`${periodo} ${indiceTipo}: #DIV/0! ignorado`);
      } else {
        warnings.push(`Sem coeficiente legível em: ${trimmed}`);
      }
      continue;
    }

    const coefStr  = coefToken.replace(/\./g, "").replace(",", ".");
    const coefEmReal = parseFloat(coefStr);

    if (!isFinite(coefEmReal) || coefEmReal < 0) {
      warnings.push(`Coeficiente inválido em ${periodo} ${indiceTipo}: ${coefToken}`);
      continue;
    }

    const key = `${periodo}|${indiceTipo}`;
    if (seen.has(key)) {
      warnings.push(`Duplicata ignorada: ${periodo} ${indiceTipo}`);
      continue;
    }
    seen.add(key);

    records.push({ periodo, indiceTipo, coefEmReal, rawLine: trimmed });
  }

  const byType: Record<string, number> = {};
  for (const r of records) {
    byType[r.indiceTipo] = (byType[r.indiceTipo] ?? 0) + 1;
  }

  return { records, skipped, warnings, byType };
}

export function loadPdfAsset(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    return readFileSync(
      join(dirname(__filename), "../assets/tabela_indices_trf1.txt"),
      "utf8"
    );
  } catch {
    return readFileSync(
      join(process.cwd(), "artifacts/api-server/src/assets/tabela_indices_trf1.txt"),
      "utf8"
    );
  }
}
