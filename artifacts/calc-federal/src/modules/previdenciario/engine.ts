/**
 * engine.ts — Motor de cálculo do módulo Previdenciário — Liquidação de Sentença
 *
 * Módulo: Liquidação de Sentença Previdenciária (LOAS, Aposentadorias, Auxílios)
 * Metodologia: CJF 2025 — Manual de Cálculos da Justiça Federal
 *              TRT-3 2026/1 (adaptações trabalhistas)
 *
 * ⚠ FUNÇÕES PURAS — zero dependências de React, DOM ou chamadas à API.
 *   Todos os dados externos (taxas, índices) devem ser passados como argumentos.
 *
 * Migração incremental: estas funções foram extraídas de pages/previdenciario.tsx.
 * A página importa daqui e continua funcionando como camada de orquestração visual.
 */

import {
  toYM, addMonthsD, parseYM, fatorAcumulado, getMoedaInfo, r2,
} from "@/lib/engines/dateUtils";

import type {
  BenefitConfig, SalaryRow, RateRow, PaymentRow,
  JurosConfig, PrescricaoConfig,
  SalaryResult, RmaRow, AtrasadoRow, CalcResult,
  QCalculationMode, QMonthlyDifference, QParsedCompetencia,
  QFilteredRow, QSummary, CnisPeriodo,
} from "./types";

// Re-exportamos helpers que a página também usa diretamente
export { toYM, addMonthsD, parseYM, r2, getMoedaInfo };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

function buildRateMap(rates: RateRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rates) m.set(r.competencia.substring(0, 7), r.taxa);
  return m;
}

function monthsBetween(startYM: string, endYM: string): string[] {
  const out: string[] = [];
  let cur = parseYM(startYM);
  const end = parseYM(endYM);
  while (toYM(cur) <= toYM(end)) { out.push(toYM(cur)); cur = addMonthsD(cur, 1); }
  return out;
}

export function fmtMes(ym: string): string {
  if (!ym || ym.length < 7) return ym;
  const [y, m] = ym.split("-");
  const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${meses[parseInt(m) - 1]}/${y}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cálculo do período de contribuição (método civil)
// ─────────────────────────────────────────────────────────────────────────────

export function calcularPeriodoContribuicao(
  inicio: string,
  fim: string,
): { anos: number; meses: number; dias: number } {
  if (!inicio || !fim) return { anos: 0, meses: 0, dias: 0 };
  const d1 = new Date(inicio + "T00:00:00");
  const d2 = new Date(fim    + "T00:00:00");
  if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) return { anos: 0, meses: 0, dias: 0 };

  let anos  = d2.getFullYear() - d1.getFullYear();
  let meses = d2.getMonth()    - d1.getMonth();
  let dias  = d2.getDate()     - d1.getDate();

  if (dias < 0)  { meses -= 1; dias  += new Date(d2.getFullYear(), d2.getMonth(), 0).getDate(); }
  if (meses < 0) { anos  -= 1; meses += 12; }

  return { anos: Math.max(0, anos), meses: Math.max(0, meses), dias: Math.max(0, dias) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser de data no formato BR → ISO
// ─────────────────────────────────────────────────────────────────────────────

export function parseDateBR(s: string): string {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser de períodos CNIS (texto livre)
// ─────────────────────────────────────────────────────────────────────────────

export function parsePeriodosCNIS(text: string): CnisPeriodo[] {
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
    const { anos, meses, dias } = calcularPeriodoContribuicao(inicio, fim);
    periodos.push({ inicio, fim, anos, meses, dias, raw: trimmed });
  }
  return periodos;
}

// ─────────────────────────────────────────────────────────────────────────────
// Soma de períodos de TC com tratamento de sobreposições
// ─────────────────────────────────────────────────────────────────────────────

export function somarPeriodosTC(
  periodos: CnisPeriodo[],
): { anos: number; meses: number; dias: number; sobreposicoes: number } {
  if (periodos.length === 0) return { anos: 0, meses: 0, dias: 0, sobreposicoes: 0 };
  const DAY = 86_400_000;
  const intervals = periodos
    .map((p) => ({ s: new Date(p.inicio + "T00:00:00").getTime(), e: new Date(p.fim + "T00:00:00").getTime() }))
    .sort((a, b) => a.s - b.s);

  const merged: Array<{ s: number; e: number }> = [];
  let cur = intervals[0];
  let sobreposicoes = 0;
  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i].s <= cur.e + DAY) { sobreposicoes++; cur = { s: cur.s, e: Math.max(cur.e, intervals[i].e) }; }
    else { merged.push(cur); cur = intervals[i]; }
  }
  merged.push(cur);

  let totalAnos = 0, totalMeses = 0, totalDias = 0;
  for (const { s, e } of merged) {
    const ini = new Date(s).toISOString().slice(0, 10);
    const fim = new Date(e).toISOString().slice(0, 10);
    const { anos, meses, dias } = calcularPeriodoContribuicao(ini, fim);
    totalAnos += anos; totalMeses += meses; totalDias += dias;
  }
  totalMeses += Math.floor(totalDias / 30);  totalDias  = totalDias  % 30;
  totalAnos  += Math.floor(totalMeses / 12); totalMeses = totalMeses % 12;
  return { anos: totalAnos, meses: totalMeses, dias: totalDias, sobreposicoes };
}

// ─────────────────────────────────────────────────────────────────────────────
// Motor principal: runCalc
//
// Corresponde à função de mesmo nome em pages/previdenciario.tsx.
// Executa correção dos salários, evolução RMA e apuração de atrasados.
// ─────────────────────────────────────────────────────────────────────────────

export function runCalc(
  cfg: BenefitConfig,
  salarios: SalaryRow[],
  corrRates: RateRow[],
  reajRates: RateRow[],
  pagamentos: PaymentRow[],
  juros: JurosConfig,
  prescricao: PrescricaoConfig,
  nomeIndice: string,
): CalcResult {
  const calcYM  = cfg.dataCalculo.substring(0, 7);
  const corrMap = buildRateMap(corrRates);
  const pagMap  = new Map(pagamentos.map((p) => [p.competencia.substring(0, 7), p.valorPago]));

  // ── 1. Correção dos salários de contribuição ──────────────────────────────
  const salariosCorrigidos: SalaryResult[] = salarios.map((s) => {
    const ym   = s.competencia.substring(0, 7);
    const info = getMoedaInfo(ym);
    const valorEmReal    = s.valorOriginal / info.divisor;
    const fatorCorrecao  = fatorAcumulado(corrMap, ym, calcYM);
    const valorCorrigido = r2(valorEmReal * fatorCorrecao);
    return {
      competencia: ym,
      valorOriginal: s.valorOriginal,
      moeda: info.moeda,
      fatorMoeda: 1 / info.divisor,
      valorEmReal: r2(valorEmReal),
      fatorCorrecao: r2(fatorCorrecao * 10_000) / 10_000,
      valorCorrigido,
      considerado: true,
      indice: nomeIndice,
    };
  });

  // ── 2. Salário de benefício (SB) ──────────────────────────────────────────
  const considerados = salariosCorrigidos.filter((s) => s.considerado);
  const sb = considerados.length > 0
    ? r2(considerados.reduce((a, s) => a + s.valorCorrigido, 0) / considerados.length)
    : 0;

  // ── 3. RMI ────────────────────────────────────────────────────────────────
  const rmi = cfg.usarRmiManual
    ? cfg.rmiManual
    : r2(sb * cfg.coeficienteRmi);

  // ── 4. Evolução RMA (RMI + reajuste anual INPC) ───────────────────────────
  const dibYM     = cfg.dib.substring(0, 7);
  const dibMes    = parseInt(dibYM.slice(5, 7));
  const rmaEvolution: RmaRow[] = [];

  const allMonths  = monthsBetween(dibYM, calcYM);
  let rmaAtual     = rmi;
  let prevRmaMonth = dibYM;

  for (const ym of allMonths) {
    const mes = parseInt(ym.slice(5, 7));
    const ano = parseInt(ym.slice(0, 4));
    const dibAno = parseInt(dibYM.slice(0, 4));
    let taxaReajuste  = 0;
    let origemReajuste = rmaEvolution.length === 0 ? "RMI inicial" : "Sem reajuste";

    if (mes === dibMes && ano > dibAno && corrMap.size > 0) {
      const fromAcum   = prevRmaMonth;
      const endAcum    = ym;
      taxaReajuste     = fatorAcumulado(corrMap, fromAcum, endAcum) - 1;
      rmaAtual         = r2(rmaAtual * (1 + taxaReajuste));
      origemReajuste   = `Reajuste anual ${ano} (INPC 12m)`;
      prevRmaMonth     = ym;
    }

    rmaEvolution.push({ competencia: ym, valorRma: rmaAtual, taxaReajuste, origemReajuste });
  }

  // ── 5. Apuração de atrasados ──────────────────────────────────────────────
  const rmaMap  = new Map(rmaEvolution.map((r) => [r.competencia, r]));
  const citacaoYM = juros.dataCitacao ? juros.dataCitacao.substring(0, 7) : calcYM;

  const atrasados: AtrasadoRow[] = allMonths.map((ym) => {
    const rmaRow   = rmaMap.get(ym);
    const valorDevido = rmaRow?.valorRma ?? 0;
    const valorPago   = pagMap.get(ym) ?? 0;
    const diferenca   = r2(Math.max(valorDevido - valorPago, 0));

    const fatorCorr = diferenca > 0 ? fatorAcumulado(corrMap, ym, calcYM) : 1;
    const valorCorrigido = r2(diferenca * fatorCorr);

    let jurosMontante = 0;
    if (juros.tipo !== "nenhum" && diferenca > 0) {
      const inicioJuros = juros.termoInicial === "citacao" ? citacaoYM : ym;
      const mesesJuros  = monthsBetween(inicioJuros, calcYM).length - 1;
      jurosMontante = juros.tipo === "simples"
        ? r2(valorCorrigido * juros.taxaMensal * mesesJuros)
        : r2(valorCorrigido * (Math.pow(1 + juros.taxaMensal, mesesJuros) - 1));
    }

    return {
      competencia: ym,
      valorDevido,
      valorPago,
      diferenca,
      fatorCorrecao: r2(fatorCorr * 10_000) / 10_000,
      valorCorrigido,
      juros: jurosMontante,
      totalAtualizado: r2(valorCorrigido + jurosMontante),
      observacao: valorPago > 0 ? `Pago: R$ ${valorPago.toFixed(2)}` : "",
      origemValorBase: rmaRow?.origemReajuste ?? "RMI inicial",
    };
  });

  // Prescrição
  const atrasadosFiltrados = prescricao.aplicar && prescricao.marcoInterruptivo
    ? (() => {
        const corteDate = new Date(prescricao.marcoInterruptivo + "T00:00:00");
        corteDate.setFullYear(corteDate.getFullYear() - prescricao.anos);
        const corteYM   = toYM(corteDate);
        return atrasados.filter((a) => a.competencia >= corteYM);
      })()
    : atrasados;

  const totalBruto      = r2(atrasadosFiltrados.reduce((a, r) => a + r.diferenca, 0));
  const totalCorrigido  = r2(atrasadosFiltrados.reduce((a, r) => a + r.valorCorrigido, 0));
  const totalJuros      = r2(atrasadosFiltrados.reduce((a, r) => a + r.juros, 0));
  const totalAtualizado = r2(atrasadosFiltrados.reduce((a, r) => a + r.totalAtualizado, 0));

  return {
    sb, rmi, rmaAtual,
    totalBruto, totalCorrigido, totalJuros, totalAtualizado,
    salariosCorrigidos,
    rmaEvolution,
    atrasados: atrasadosFiltrados,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prescrição Quinquenal — Funções puras
// ─────────────────────────────────────────────────────────────────────────────

const Q_MONTHS: Record<string, number> = {
  jan:1, fev:2, mar:3, abr:4, mai:5, jun:6, jul:7, ago:8, set:9, out:10, nov:11, dez:12,
};
const Q_MONTH_LABELS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function qToMonthLabel(year: number, month: number): string {
  return `${Q_MONTH_LABELS[month - 1]}/${year}`;
}

export function qParseCompetencia(input: string): QParsedCompetencia | null {
  const raw = input.trim().toLowerCase();
  const iso = raw.match(/^(\d{4})-(\d{2})$/);
  if (iso) {
    const year = Number(iso[1]), month = Number(iso[2]);
    if (month < 1 || month > 12) return null;
    return { year, month, key: raw, label: qToMonthLabel(year, month), date: new Date(year, month - 1, 1) };
  }
  const slashNum = raw.match(/^(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slashNum) {
    const month = Number(slashNum[1]);
    let year = Number(slashNum[2]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    if (month < 1 || month > 12) return null;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    return { year, month, key, label: qToMonthLabel(year, month), date: new Date(year, month - 1, 1) };
  }
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

export function qGetQuinquenioStart(ajuizamento: string): Date | null {
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

export function qApplyPrescription(
  rows: QMonthlyDifference[],
  mode: QCalculationMode,
  ajuizamento: string,
): { detailedRows: QFilteredRow[]; summary: QSummary } {
  const parsed = rows.map((row) => {
    const p = qParseCompetencia(row.competencia);
    if (!p) return null;
    return { row, parsed: p, valorConsiderado: qGetConsideredValue(row) };
  }).filter(Boolean) as Array<{ row: QMonthlyDifference; parsed: QParsedCompetencia; valorConsiderado: number }>;

  const sorted    = [...parsed].sort((a, b) => a.parsed.date.getTime() - b.parsed.date.getTime());
  const startDate = mode === "quinquenio" ? qGetQuinquenioStart(ajuizamento) : null;

  const detailedRows: QFilteredRow[] = sorted.map(({ row, parsed: p, valorConsiderado }) => ({
    ...row, parsed: p, valorConsiderado,
    statusPrescricao: (!startDate || p.date.getTime() >= startDate.getTime()) ? "EXIGIVEL" : "PRESCRITO",
  }));

  const exigiveis  = detailedRows.filter((r) => r.statusPrescricao === "EXIGIVEL");
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

export function qGroupByRubrica(
  rows: QFilteredRow[],
): Array<{ rubrica: string; totalExigivel: number; totalPrescrito: number; totalIntegral: number }> {
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

export function qParseBrazilianCurrency(value: string): number {
  const n = Number(value.replace(/R\$/g,"").replace(/\s/g,"").replace(/\./g,"").replace(/,/g,"."));
  return Number.isFinite(n) ? n : 0;
}

export function qParseTsv(text: string): QMonthlyDifference[] {
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
// Tabela histórica do teto previdenciário (INSS)
// Fonte: portarias MPS/MF vigentes
// ─────────────────────────────────────────────────────────────────────────────

const TETOS_INSS: Array<{ inicio: string; valor: number; legislacao: string }> = [
  { inicio: "1994-03", valor:   582.06, legislacao: "Portaria 920/1994"                             },
  { inicio: "1995-05", valor:   832.66, legislacao: "Portaria 2.006/1995"                           },
  { inicio: "1996-05", valor:   957.56, legislacao: "Portaria 3.231/1996"                           },
  { inicio: "1997-06", valor:  1031.87, legislacao: "Ordem de Serviço 573/1997"                     },
  { inicio: "1998-06", valor:  1081.50, legislacao: "Portaria 4.478/1998"                           },
  { inicio: "1998-12", valor:  1200.00, legislacao: "EC 20/1998"                                    },
  { inicio: "1999-06", valor:  1255.32, legislacao: "Portaria 5.160/1999"                           },
  { inicio: "2000-06", valor:  1328.25, legislacao: "Portaria 6.211/2000"                           },
  { inicio: "2001-06", valor:  1430.00, legislacao: "Portaria 1.007/2001"                           },
  { inicio: "2002-06", valor:  1561.56, legislacao: "Portaria 535/2002"                             },
  { inicio: "2003-06", valor:  1869.34, legislacao: "Portaria 727/2003"                             },
  { inicio: "2004-01", valor:  2400.00, legislacao: "EC 41/2003"                                    },
  { inicio: "2004-05", valor:  2506.72, legislacao: "Portaria 479/2004"                             },
  { inicio: "2005-05", valor:  2668.15, legislacao: "Portaria 822/2005"                             },
  { inicio: "2006-04", valor:  2801.56, legislacao: "Portaria 119/2006"                             },
  { inicio: "2007-04", valor:  2894.28, legislacao: "Portaria 142/2007"                             },
  { inicio: "2008-03", valor:  3038.99, legislacao: "Portaria Interministerial 77/2008"             },
  { inicio: "2009-02", valor:  3218.90, legislacao: "Portaria Interministerial 48/2009"             },
  { inicio: "2010-01", valor:  3467.40, legislacao: "Portaria 333/2010"                             },
  { inicio: "2011-01", valor:  3691.74, legislacao: "Portaria Interministerial 407/2011"            },
  { inicio: "2012-01", valor:  3916.20, legislacao: "Portaria Interministerial 2/2012"              },
  { inicio: "2013-01", valor:  4159.00, legislacao: "Portaria Interministerial 15/2013"             },
  { inicio: "2014-01", valor:  4390.24, legislacao: "Portaria Interministerial 19/2014"             },
  { inicio: "2015-01", valor:  4663.75, legislacao: "Portaria Interministerial 13/2015"             },
  { inicio: "2016-01", valor:  5189.82, legislacao: "Portaria 1/2016"                              },
  { inicio: "2017-01", valor:  5531.31, legislacao: "Portaria 8/2017"                              },
  { inicio: "2018-01", valor:  5645.80, legislacao: "Portaria 15/2018"                             },
  { inicio: "2019-01", valor:  5839.45, legislacao: "Portaria 6/2019"                              },
  { inicio: "2020-01", valor:  6101.06, legislacao: "Portaria 01/4/2020"                           },
  { inicio: "2021-01", valor:  6433.57, legislacao: "Portaria SEPRT/ME 477/2021"                   },
  { inicio: "2022-01", valor:  7087.22, legislacao: "Portaria Interministerial MPS/MF 12/2022"     },
  { inicio: "2023-01", valor:  7507.49, legislacao: "Portaria Interministerial MPS/MF 26/2023"     },
  { inicio: "2024-01", valor:  7786.02, legislacao: "Portaria Interministerial MPS/MF 12/2024"     },
  { inicio: "2025-01", valor:  8157.41, legislacao: "Portaria Interministerial MPS/MF 6/2025"      },
  { inicio: "2026-01", valor:  8475.55, legislacao: "Portaria Interministerial MPS/MF 13/2026"     },
];

/**
 * Retorna o teto previdenciário vigente em uma data de referência.
 * @param dataRef  String no formato "YYYY-MM-DD" ou "YYYY-MM" ou ISO.
 */
export function getTetoInss(dataRef: string): { valor: number; vigencia: string; legislacao: string } | null {
  if (!dataRef || dataRef.length < 7) return null;
  const ym = dataRef.substring(0, 7);
  let best: (typeof TETOS_INSS)[0] | null = null;
  for (const t of TETOS_INSS) {
    if (t.inicio <= ym) best = t;
    else break;
  }
  if (!best) return null;
  return { valor: best.valor, vigencia: best.inicio, legislacao: best.legislacao };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validação de entrada
// ─────────────────────────────────────────────────────────────────────────────

export function validatePrevidenciarioInput(cfg: BenefitConfig): string[] {
  const errors: string[] = [];
  if (!cfg.nome) errors.push("Nome do segurado é obrigatório.");
  if (!cfg.dib)  errors.push("DIB (Data de Início do Benefício) é obrigatória.");
  if (!cfg.dataCalculo) errors.push("Data-base do cálculo é obrigatória.");
  if (cfg.dib && cfg.dataCalculo && cfg.dib > cfg.dataCalculo) {
    errors.push("DIB não pode ser posterior à data-base do cálculo.");
  }
  return errors;
}
