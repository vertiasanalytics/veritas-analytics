/**
 * correctionEngine.ts — Motor bifásico Veritas Analytics
 * Manual de Cálculos da Justiça Federal 2025 (CJF) + layout Projef Web.
 *
 * ─── SEQUÊNCIA DO MANUAL CJF 2025 ────────────────────────────────────────────
 *
 *   PASSO 1 ─ PRINCIPAL HISTÓRICO
 *     A  = valor original na moeda da competência (CR3, CRR, BRL…)
 *          Nunca convertido antecipadamente — preservado como lançado.
 *
 *   PASSO 2 ─ CORREÇÃO MONETÁRIA (Fase 1: parcelas até 11/2021)
 *     B_conv  = fator de conversão monetária histórica (ex.: CR3→BRL = 1/2.750.000)
 *               Para BRL: B_conv = 1.
 *               ⚠ Para moedas pré-Real: taxa IPCA-E é 0 antes de 07/1994 (por definição);
 *               o fator B_conv já embute a inflação acumulada até 07/1994 pelo Plano Real.
 *     B_corr  = ∏ (1 + IPCA-E_m) para m ∈ [período_parcela … 11/2021]
 *               Série IBGE completa a partir de 07/1994 (série 13522).
 *               Para PREV_I/PREV_II usa INPC (série IBGE 188).
 *     B       = B_conv × B_corr
 *     C       = A × B              (principal corrigido em BRL)
 *
 *   PASSO 3 ─ JUROS MORATÓRIOS (até 12/2021)
 *     D  = Σ taxa_juros_m para m ∈ [citação+1 … 12/2021]
 *          Critério: 0,5% a.m. (até 07/2009) → poupança (depois) — art. 1º-F Lei 9.494/97
 *     E  = C × D
 *
 *   PASSO 4 ─ SELIC UNIFICADA (a partir de 01/2022 — EC 113/2021)
 *     F  = Σ Selic_m para m ∈ [01/2022 … data-base]
 *     G  = (C + E) × F             (Fase 1)
 *          = C × F                 (Fase 2: parcelas a partir de 12/2021)
 *     H  = C + E + G               (total atualizado da parcela)
 *
 * ─── MEMÓRIA DE CÁLCULO AUDITÁVEL ───────────────────────────────────────────
 *   Cada parcela retorna:
 *   - currencyConversionSteps  : passo a passo das conversões monetárias históricas
 *   - correctionRecords        : índice mês a mês (OTN/BTN/INPC/UFIR/IPCA-E conforme período)
 *   - bCorrStartPeriod         : primeiro mês com taxa de correção efetiva
 *                                (CONDENAT_GERAL: = período da parcela; outros: ≥ 07/1994)
 *   - interestRecords          : taxa de juros mês a mês
 *   - selicRecords             : taxa Selic mês a mês
 */

import {
  getCorrectionRate,
  getCondenatRate,
  getInterestRate,
  getSelic,
  periodsInRange,
  addMonths,
} from "./historicalRates.js";
import {
  getTotalConversionFactor,
  convertToReal,
  type CurrencyConversionStep,
  type CurrencyConversionResult,
} from "./currencyConversionEngine.js";

export type { CurrencyConversionStep, CurrencyConversionResult };

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────

/** Último mês em que se aplica correção por índice (IPCA-E/INPC) — Fazenda Pública */
const CORR_CUTOFF = "2021-11";
/** Primeiro mês da Selic unificada (EC 113/2021) */
const SELIC_START = "2022-01";
/** Mês de corte bifásico (último mês com juros moratórios) */
const PHASE_CUTOFF = "2021-12";
/** Início do Real / primeiro mês com dado IPCA-E (Plano Real — MP 542/94) */
const BRL_START = "1994-07";

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export interface CorrectionRecord {
  period: string;
  indexCode: string;
  rate: number;
  /** Fator mensal = 1 + rate */
  factor: number;
  /** Produto acumulado até este período */
  accumulated: number;
}

export interface InterestRecord {
  period: string;
  ruleCode: string;
  rate: number;
}

export interface SelicRecord {
  period: string;
  rate: number;
}

export interface InstallmentAudit {
  correctionIndex: string;
  interestRuleCode: string;
  citationPeriod: string;
  settlementPeriod: string;
  phase: 1 | 2;
  /**
   * Primeiro mês com taxa de correção efetiva.
   * CONDENAT_GERAL: igual ao período da parcela, mesmo pré-1994 (OTN→BTN→INPC→UFIR→IPCA-E).
   * Outros índices (IPCA_E, INPC): sempre ≥ "1994-07" (início dos dados IBGE).
   * Período_parcela → bCorrStartPeriod → 11/2021: faixa de correção monetária.
   */
  bCorrStartPeriod: string;
  /** Passos da conversão monetária histórica (ex.: CR3 → CRR → BRL) */
  currencyConversionSteps: CurrencyConversionStep[];
  /** Fator IPCA-E/INPC mês a mês — somente meses a partir de bCorrStartPeriod */
  correctionRecords: CorrectionRecord[];
  /** Juros moratórios mês a mês (coluna D destrinchada) */
  interestRecords: InterestRecord[];
  /** Selic mês a mês (coluna F destrinchada) */
  selicRecords: SelicRecord[];
}

export interface InstallmentCalculationResult {
  period: string;

  /** A — Valor original na moeda da competência (NÃO convertido para BRL) */
  A: number;
  /** Moeda original da parcela (ex.: CR3, CRR, BRL) */
  originalCurrency: string;

  /**
   * B_conv — Fator de conversão monetária histórica para BRL.
   * Ex.: CR3 → BRL = 1 ÷ 1.000 ÷ 2.750 = 0,000000363636…
   * BRL → BRL = 1
   */
  B_conv: number;
  /**
   * B_corr — Produto acumulado dos fatores mensais IPCA-E/INPC
   * do período da parcela até 11/2021 (Fase 1), ou 1 (Fase 2).
   */
  B_corr: number;
  /** B = B_conv × B_corr — Coeficiente total de atualização */
  B: number;

  /** C = A × B — Principal atualizado em BRL */
  C: number;
  /** D — Taxa de juros moratórios acumulada (soma simples) até 12/2021 */
  D: number;
  /** E = C × D — Valor dos juros moratórios até 12/2021 */
  E: number;
  /** F — Taxa Selic acumulada (soma simples) de 01/2022 até data-base */
  F: number;
  /** G = (C + E) × F — Valor da Selic pós-12/2021 */
  G: number;
  /** H = C + E + G — Total atualizado da parcela */
  H: number;

  /** Memória de cálculo auditável */
  audit: InstallmentAudit;
}

// ─────────────────────────────────────────────────────────────
// FUNÇÃO PRINCIPAL — cálculo bifásico com memória completa
// ─────────────────────────────────────────────────────────────

/**
 * Calcula uma parcela conforme a metodologia bifásica do Projef Web / Manual CJF 2025.
 *
 * @param installmentPeriod  "YYYY-MM" — período de competência da parcela
 * @param principalAmount    Valor nominal na moeda original (A)
 * @param originalCurrency   Código da moeda (BRL, CR3, CRR, CZL, etc.)
 * @param correctionIndex    "IPCA_E" | "INPC" | "NONE" | "SELIC"
 * @param interestRuleCode   Código da regra de juros moratórios
 * @param citationPeriod     "YYYY-MM" — data da citação (marco inicial dos juros)
 * @param settlementPeriod   "YYYY-MM" — data-base de atualização
 */
export function computeInstallmentProjectef(
  installmentPeriod: string,
  principalAmount: number,
  originalCurrency: string,
  correctionIndex: string,
  interestRuleCode: string,
  citationPeriod: string,
  settlementPeriod: string,
): InstallmentCalculationResult {

  // ── A: preserva valor original na moeda histórica ─────────
  const A = principalAmount;
  const currency = originalCurrency || "BRL";

  // ── B_conv: fator de conversão monetária histórica ─────────
  // Para BRL: B_conv = 1. Para moedas extintas: produto dos divisores históricos.
  const conversionResult = convertToReal(1, currency);
  const B_conv = conversionResult.convertedAmount; // = getTotalConversionFactor(currency)
  const currencyConversionSteps: CurrencyConversionStep[] = conversionResult.steps;

  // ── Determinar fase ────────────────────────────────────────
  const phase: 1 | 2 = installmentPeriod <= PHASE_CUTOFF ? 1 : 2;

  if (phase === 1) {
    // ── PASSO 2: B_corr ─────────────────────────────────────────
    // CONDENAT_GERAL: correção começa no próprio período da parcela, mesmo pré-1994.
    //   getCondenatRate() cobre toda a sequência OTN→BTN→INPC→UFIR-CR3→UFIR-BRL→IPCA-E.
    //   B_conv cobre apenas a conversão nominal (÷1000 por reforma); não há dupla contagem.
    // Outros índices (IPCA_E, INPC, SELIC): dados disponíveis a partir de 07/1994.
    //   Para parcelas pré-Real, B_conv embute a conversão nominal; B_corr começa em 07/1994.
    const correctionRecords: CorrectionRecord[] = [];
    let B_corr = 1.0;

    const isCondenat = correctionIndex === "CONDENAT_GERAL";
    // CONDENAT_GERAL: permite iniciar antes de BRL_START (taxas pré-Real disponíveis)
    // Demais índices: clipa em BRL_START (sem dados de IPCA-E/INPC antes de 07/1994)
    const bCorrStartPeriod = (isCondenat || installmentPeriod >= BRL_START)
      ? installmentPeriod
      : BRL_START;

    if (correctionIndex !== "NONE" && bCorrStartPeriod <= CORR_CUTOFF) {
      const corrPeriods = periodsInRange(bCorrStartPeriod, CORR_CUTOFF);
      // fromUFIR: true se parcela iniciou em período coberto por UFIR ou pré-UFIR
      //           (necessário para aplicar taxa de transição UFIR→IPCA-E em jan/2001)
      const fromUFIR = isCondenat && bCorrStartPeriod <= "2000-12";
      // Índice efetivo para getCorrectionRate (CONDENAT_GERAL → IPCA_E no período pós-UFIR)
      const effectiveIndex = isCondenat ? "IPCA_E" : correctionIndex;
      let accumulated = 1.0;
      for (const p of corrPeriods) {
        let rate: number;
        let indexCode: string;
        if (isCondenat && p <= "2001-01") {
          const r = getCondenatRate(p, fromUFIR);
          rate = r.rate;
          indexCode = r.indexCode;
        } else {
          rate = getCorrectionRate(effectiveIndex, p);
          indexCode = isCondenat ? "IPCA-E" : correctionIndex;
        }
        const factor = 1 + rate;
        accumulated *= factor;
        B_corr = accumulated;
        correctionRecords.push({ period: p, indexCode, rate, factor, accumulated });
      }
    }

    const B = B_conv * B_corr;
    const C = A * B;

    // ── PASSO 3: juros moratórios até 12/2021 ──────────────────
    const interestRecords: InterestRecord[] = [];
    let D = 0;
    // Juros correm do mês seguinte à citação (art. 405 CC/2002).
    // Para parcelas posteriores à citação: conta do mês seguinte ao da parcela.
    const effectiveStart = installmentPeriod < citationPeriod ? citationPeriod : installmentPeriod;
    const interestStart = addMonths(effectiveStart, 1);
    const interestEnd = PHASE_CUTOFF;  // 12/2021 (EC 113/2021)

    if (interestStart <= interestEnd) {
      const interestPeriods = periodsInRange(interestStart, interestEnd);
      for (const p of interestPeriods) {
        const rate = getInterestRate(interestRuleCode, p);
        D += rate;
        interestRecords.push({ period: p, ruleCode: interestRuleCode, rate });
      }
    }

    const E = C * D;

    // ── PASSO 4: Selic de 01/2022 até data-base ────────────────
    const selicRecords: SelicRecord[] = [];
    let F = 0;
    if (SELIC_START <= settlementPeriod) {
      const selicPeriods = periodsInRange(SELIC_START, settlementPeriod);
      for (const p of selicPeriods) {
        const rate = getSelic(p);
        F += rate;
        selicRecords.push({ period: p, rate });
      }
    }

    const G = (C + E) * F;
    const H = C + E + G;

    return {
      period: installmentPeriod,
      A, originalCurrency: currency,
      B_conv, B_corr, B,
      C, D, E, F, G, H,
      audit: {
        correctionIndex, interestRuleCode, citationPeriod, settlementPeriod,
        phase: 1,
        bCorrStartPeriod,
        currencyConversionSteps,
        correctionRecords,
        interestRecords,
        selicRecords,
      },
    };
  }

  // ── FASE 2: parcela a partir de 12/2021 ────────────────────
  // B_corr = 1 (EC 113/2021: Selic unificada cobre correção + juros)
  // Selic começa no mês seguinte ao período da parcela.
  const B_corr = 1.0;
  const B = B_conv * B_corr;
  const C = A * B;

  const selicRecords: SelicRecord[] = [];
  const selicStart2 = addMonths(installmentPeriod, 1);
  let F = 0;
  if (selicStart2 <= settlementPeriod) {
    const selicPeriods = periodsInRange(selicStart2, settlementPeriod);
    for (const p of selicPeriods) {
      const rate = getSelic(p);
      F += rate;
      selicRecords.push({ period: p, rate });
    }
  }

  const G = C * F;
  const H = C + G;

  return {
    period: installmentPeriod,
    A, originalCurrency: currency,
    B_conv, B_corr, B,
    C, D: 0, E: 0, F, G, H,
    audit: {
      correctionIndex, interestRuleCode, citationPeriod, settlementPeriod,
      phase: 2,
      bCorrStartPeriod: installmentPeriod,
      currencyConversionSteps,
      correctionRecords: [],
      interestRecords: [],
      selicRecords,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// COMPATIBILIDADE — mantém assinatura legada para imports existentes
// ─────────────────────────────────────────────────────────────

export interface CorrectionResult {
  criteriaCode: string;
  criteriaName: string;
  originalCurrency: string;
  originalAmount: number;
  correctedAmountBRL: number;
  accumulatedFactor: number;
  monthlyRecords: CorrectionRecord[];
  currencyConversionHistory: CurrencyConversionResult | null;
}

export async function computeCorrection(
  installmentPeriod: string,
  principalAmount: number,
  originalCurrency: string,
  criteriaCode: string,
  basePeriod: string,
): Promise<CorrectionResult> {
  const isCondenat = criteriaCode === "CONDENAT_GERAL";
  const indexMap: Record<string, string> = {
    CONDENAT_GERAL: "CONDENAT_GERAL", PREV_I: "INPC", PREV_II: "INPC",
    IPCA_E_CRITERIO: "IPCA_E", NONE: "NONE",
    TJMG_CRITERIO: "TJMG", TJMG: "TJMG",
  };
  const indexCode = indexMap[criteriaCode] ?? "IPCA_E";
  const effectiveIndex = isCondenat ? "IPCA_E" : indexCode;

  const corrEnd = basePeriod <= CORR_CUTOFF ? basePeriod : CORR_CUTOFF;
  const records: CorrectionRecord[] = [];
  let B_corr = 1.0;
  const bCorrStart = (isCondenat || installmentPeriod >= BRL_START)
    ? installmentPeriod
    : BRL_START;
  const fromUFIR = isCondenat && bCorrStart <= "2000-12";

  if (indexCode !== "NONE" && bCorrStart <= corrEnd) {
    const periods = periodsInRange(bCorrStart, corrEnd);
    for (const p of periods) {
      let rate: number;
      let code: string;
      if (isCondenat && p <= "2001-01") {
        const r = getCondenatRate(p, fromUFIR);
        rate = r.rate;
        code = r.indexCode;
      } else {
        rate = getCorrectionRate(effectiveIndex, p);
        code = isCondenat ? "IPCA-E" : indexCode;
      }
      const factor = 1 + rate;
      B_corr *= factor;
      records.push({ period: p, indexCode: code, rate, factor, accumulated: B_corr });
    }
  }

  const convResult = convertToReal(1, originalCurrency || "BRL");
  const B_conv = convResult.convertedAmount;

  return {
    criteriaCode,
    criteriaName: criteriaCode,
    originalCurrency: originalCurrency || "BRL",
    originalAmount: principalAmount,
    correctedAmountBRL: principalAmount * B_conv * B_corr,
    accumulatedFactor: B_conv * B_corr,
    monthlyRecords: records,
    currencyConversionHistory: convResult.steps.length > 0 ? {
      originalCurrency: originalCurrency,
      finalCurrency: "BRL",
      originalAmount: principalAmount,
      convertedAmount: principalAmount * B_conv,
      steps: convResult.steps,
    } : null,
  };
}
