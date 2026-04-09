/**
 * dateUtils.ts — Utilitários de data e moeda compartilhados entre módulos
 *
 * Todas as funções são puras (sem side effects).
 * Importar daqui garante consistência entre módulos: previdenciário,
 * valor da causa, trabalhista, bancário, etc.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Operações sobre datas e competências (YYYY-MM)
// ─────────────────────────────────────────────────────────────────────────────

/** Retorna o primeiro dia do mês de uma Date */
export function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Adiciona n meses a uma Date, retornando o 1º do mês resultante */
export function addMonthsD(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Converte Date → "YYYY-MM" */
export function toYM(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "YYYY-MM" → Date (dia 1 do mês) */
export function parseYM(ym: string): Date {
  const clean = ym.substring(0, 7);
  const [y, m] = clean.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

/** Avança um mês em formato "YYYY-MM" */
export function nextYM(ym: string): string {
  const [y, mo] = ym.split("-").map(Number);
  return toYM(new Date(y, mo - 1 + 1, 1));
}

/** Recua n meses em formato "YYYY-MM" */
export function prevYM(ym: string, n = 1): string {
  const [y, mo] = ym.split("-").map(Number);
  return toYM(new Date(y, mo - 1 - n, 1));
}

/** Rótulo abreviado de mês/ano: "jan/2024" */
export function monthLabel(d: Date): string {
  const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${MESES[d.getMonth()]}/${d.getFullYear()}`;
}

/** Rótulo abreviado a partir de YYYY-MM */
export function ymLabel(ym: string): string {
  return monthLabel(parseYM(ym));
}

/** Quantidade de meses entre duas datas, inclusive (contando ambos os extremos) */
export function monthsBetweenInclusive(a: Date, b: Date): number {
  const s = monthStart(a), e = monthStart(b);
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
}

/** Lista todos os "YYYY-MM" de startYM a endYM, inclusive */
export function monthRange(startYM: string, endYM: string): string[] {
  const out: string[] = [];
  let cur = parseYM(startYM);
  const end = parseYM(endYM);
  while (toYM(cur) <= toYM(end)) {
    out.push(toYM(cur));
    cur = addMonthsD(cur, 1);
  }
  return out;
}

/** Converte string ISO "YYYY-MM-DD" → Date */
export function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Converte "YYYY-MM-DD" → "DD/MM/YYYY" */
export function toBrDate(iso?: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatadores monetários
// ─────────────────────────────────────────────────────────────────────────────

/** Formata número como moeda BRL: "R$ 1.234,56" */
export function fmtR(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Formata percentual com 4 casas decimais: "3,4200%" */
export function fmtPct(v: number): string {
  return (v * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }) + "%";
}

/** Formata percentual resumido com 2 casas decimais: "3,42%" */
export function fmtPct2(v: number): string {
  return (v * 100).toFixed(2).replace(".", ",") + "%";
}

// ─────────────────────────────────────────────────────────────────────────────
// Aritmética financeira
// ─────────────────────────────────────────────────────────────────────────────

/** Arredonda para 2 casas decimais (centavos) */
export function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Gera ID aleatório curto para uso em listas React */
export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapas de taxas mensais
// ─────────────────────────────────────────────────────────────────────────────

export interface RateEntry {
  competencia: string;
  taxa: number;
}

/** Constrói Map<"YYYY-MM", taxa> a partir de um array de entradas */
export function buildRateMap(rates: RateEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rates) m.set(r.competencia.substring(0, 7), r.taxa);
  return m;
}

/**
 * Fator de correção acumulado entre dois períodos.
 *
 * Convenção CJF: a taxa do mês M corrige o valor do fim do mês M para o
 * fim do mês M+1. Portanto, a série vai de nextYM(fromKey) até endKey.
 */
export function fatorAcumulado(
  rateMap: Map<string, number>,
  fromKey: string,
  endKey: string,
): number {
  let fator = 1;
  let cur = nextYM(fromKey);
  while (cur <= endKey) {
    fator *= 1 + (rateMap.get(cur) ?? 0);
    cur = nextYM(cur);
  }
  return fator;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabela histórica de moedas brasileiras → Real
// Referência: Plano Real (MP 542/1994), Collor (1990), Verão (1989), Cruzado (1986)
// ─────────────────────────────────────────────────────────────────────────────
const MOEDA_BRASIL = [
  { de: "1900-01", ate: "1986-02", moeda: "Cr$ (Cruzeiro)",       divisor: 2_750_000_000_000 },
  { de: "1986-03", ate: "1989-01", moeda: "Cz$ (Cruzado)",        divisor: 2_750_000_000     },
  { de: "1989-02", ate: "1990-02", moeda: "NCz$ (Cruzado Novo)",  divisor: 2_750_000         },
  { de: "1990-03", ate: "1993-07", moeda: "Cr$ (Cruzeiro)",       divisor: 2_750_000         },
  { de: "1993-08", ate: "1994-06", moeda: "CR$ (Cruzeiro Real)",  divisor: 2_750             },
  { de: "1994-07", ate: "9999-12", moeda: "R$ (Real)",            divisor: 1                 },
] as const;

export function getMoedaInfo(competencia: string): { moeda: string; divisor: number } {
  const ym = competencia.substring(0, 7);
  for (const m of MOEDA_BRASIL) {
    if (ym >= m.de && ym <= m.ate) return { moeda: m.moeda, divisor: m.divisor };
  }
  return { moeda: "R$ (Real)", divisor: 1 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabela histórica do salário mínimo (vigência mensal)
// Centralizada aqui para ser reutilizada por valor-causa e previdenciário
// ─────────────────────────────────────────────────────────────────────────────
export const SM_HISTORICO: { from: string; value: number }[] = [
  { from: "2000-01", value: 151.00 },
  { from: "2001-04", value: 180.00 },
  { from: "2002-01", value: 200.00 },
  { from: "2003-04", value: 240.00 },
  { from: "2004-05", value: 260.00 },
  { from: "2005-05", value: 300.00 },
  { from: "2006-04", value: 350.00 },
  { from: "2007-04", value: 380.00 },
  { from: "2008-03", value: 415.00 },
  { from: "2009-02", value: 465.00 },
  { from: "2010-01", value: 510.00 },
  { from: "2011-01", value: 545.00 },
  { from: "2012-01", value: 622.00 },
  { from: "2013-01", value: 678.00 },
  { from: "2014-01", value: 724.00 },
  { from: "2015-01", value: 788.00 },
  { from: "2016-01", value: 880.00 },
  { from: "2017-01", value: 937.00 },
  { from: "2018-01", value: 954.00 },
  { from: "2019-01", value: 998.00 },
  { from: "2020-01", value: 1045.00 },
  { from: "2021-01", value: 1100.00 },
  { from: "2022-01", value: 1212.00 },
  { from: "2023-01", value: 1302.00 },
  { from: "2023-05", value: 1320.00 },
  { from: "2024-01", value: 1412.00 },
  { from: "2025-01", value: 1518.00 },
  { from: "2026-01", value: 1622.00 },
];

/** Retorna o salário mínimo vigente para uma competência "YYYY-MM" */
export function getSalarioMinimo(ym: string): number {
  let value = SM_HISTORICO[0].value;
  for (const entry of SM_HISTORICO) {
    if (entry.from <= ym) value = entry.value;
    else break;
  }
  return value;
}
