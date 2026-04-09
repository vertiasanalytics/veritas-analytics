/**
 * utils.ts — Utilitários do módulo Valor da Causa Previdenciária
 *
 * ⚠ FUNÇÕES PURAS — sem React, DOM ou chamadas à API.
 *
 * Contém helpers de mapeamento, parsing e formatação específicos do módulo,
 * que não fazem parte do motor de cálculo principal (engine.ts) mas que
 * são usados tanto pela página quanto pelo laudo.
 */

import {
  toYM, r2, parseIso, addMonthsD, monthsBetweenInclusive,
  nextYM, prevYM, monthStart, monthLabel,
} from "@/lib/engines/dateUtils";

// Re-exporta helpers de data para que a página possa importar tudo daqui
export { toYM, r2, parseIso, nextYM, prevYM, addMonthsD, monthStart, monthLabel, monthsBetweenInclusive };

// ─────────────────────────────────────────────────────────────────────────────
// Mapeamento de critério de correção → chave de índice da API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converte o nome amigável do critério de correção monetária para a chave
 * usada na API de índices.
 *
 * @example criterioToKey("IPCA-E") // → "IPCA_E"
 * @example criterioToKey("SELIC")  // → "SELIC"
 */
export function criterioToKey(criterio: string): string {
  if (criterio === "INPC")   return "INPC";
  if (criterio === "IPCA-E") return "IPCA_E";
  return "SELIC";
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser de importação CSV de competências (Deduções/Competências manuais)
// ─────────────────────────────────────────────────────────────────────────────

export interface DcCompetencia {
  competencia:   string;
  valorOriginal: number;
  abatimentos:   number;
  fatorCorrecao: number;
}

export interface DcLinhaResultado {
  tipo:          "mensal" | "decimo";
  competencia:   string;
  valorOriginal: number;
  abatimentos:   number;
  fatorCorrecao: number;
  valorCorrigido: number;
  detalhes?:     string;
}

export interface DcDecimoItem {
  ano:                number;
  valorOriginal:      number;
  abatimentos:        number;
  fatorCorrecao:      number;
  valorCorrigido:     number;
  mesesConsiderados:  number;
  beneficioBase:      number;
  referenciaCorrecao: string;
}

/**
 * Faz o parse de uma linha CSV no formato:
 *   MM/AAAA;valorOriginal;abatimentos;fatorCorrecao
 *
 * Retorna null se a linha for inválida ou comentário.
 */
export function parseDcLinha(linha: string): DcCompetencia | null {
  const raw = linha.trim();
  if (!raw || raw.startsWith("#") || raw.startsWith("//")) return null;
  const parts = raw.split(";");
  if (parts.length < 2) return null;
  const [comp, val, abt, fat] = parts;
  const competencia = comp?.trim() ?? "";
  if (!/^\d{2}\/\d{4}$/.test(competencia)) return null;
  return {
    competencia,
    valorOriginal: r2(parseFloat(val ?? "0") || 0),
    abatimentos:   r2(parseFloat(abt ?? "0") || 0),
    fatorCorrecao: parseFloat(fat ?? "1") || 1,
  };
}

/**
 * Faz o parse completo de um bloco CSV de competências.
 * Ignora linhas inválidas silenciosamente.
 */
export function parseDcBloco(csv: string): DcCompetencia[] {
  return csv
    .split("\n")
    .map(parseDcLinha)
    .filter((x): x is DcCompetencia => x !== null);
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatação de competência (MM/YYYY → "mês/ano" legível)
// ─────────────────────────────────────────────────────────────────────────────

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/**
 * Formata uma competência MM/AAAA em formato legível: "jan/2024"
 * Suporta também YearMonth "YYYY-MM" como entrada alternativa.
 */
export function fmtCompetencia(comp: string): string {
  const bySlash = /^(\d{2})\/(\d{4})$/.exec(comp);
  if (bySlash) {
    const m = parseInt(bySlash[1], 10);
    return `${MESES[m - 1] ?? bySlash[1]}/${bySlash[2]}`;
  }
  const byDash = /^(\d{4})-(\d{2})$/.exec(comp);
  if (byDash) {
    const m = parseInt(byDash[2], 10);
    return `${MESES[m - 1] ?? byDash[2]}/${byDash[1]}`;
  }
  return comp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitário de geração de ID local (sem dependência de crypto)
// ─────────────────────────────────────────────────────────────────────────────

let _seq = 0;
/** Gera um ID único para uso em listas React (key prop). Não usar como PK. */
export function uid(): string {
  return `vc-${Date.now()}-${++_seq}`;
}
