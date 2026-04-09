/**
 * currencyConversionEngine.ts
 * Motor de conversão monetária histórica do Brasil (Réis → Real)
 * PONTO DE HOMOLOGAÇÃO: Verificar fatores com legislação oficial vigente
 */

export interface CurrencyTransitionDef {
  fromCurrency: string;
  toCurrency: string;
  effectiveDate: string; // "YYYY-MM-DD"
  conversionFactor: number;
  factorType: "divisor" | "multiplicador";
  legalNote?: string;
}

export interface CurrencyConversionStep {
  fromCurrency: string;
  toCurrency: string;
  transitionDate: string;
  appliedFactor: number;
  factorType: "divisor" | "multiplicador";
  amountBefore: number;
  amountAfter: number;
  legalNote?: string;
}

export interface CurrencyConversionResult {
  originalCurrency: string;
  finalCurrency: string;
  originalAmount: number;
  convertedAmount: number;
  steps: CurrencyConversionStep[];
}

// ============================================================
// Linha do tempo monetária oficial do Brasil
// Fonte: legislação federal — PONTO DE HOMOLOGAÇÃO
// ============================================================

export const BRAZIL_CURRENCY_TIMELINE: CurrencyTransitionDef[] = [
  {
    fromCurrency: "BRR",    // Réis (Mil-Réis)
    toCurrency: "CRZ",      // Cruzeiro (1942)
    effectiveDate: "1942-11-01",
    conversionFactor: 1000,
    factorType: "divisor",
    legalNote: "Decreto-Lei nº 4.791/1942 — 1 Cruzeiro = 1.000 Réis",
  },
  {
    fromCurrency: "CRZ",    // Cruzeiro (1942)
    toCurrency: "NCR",      // Cruzeiro Novo (1967)
    effectiveDate: "1967-01-13",
    conversionFactor: 1000,
    factorType: "divisor",
    legalNote: "Decreto-Lei nº 1/1967 — 1 Cruzeiro Novo = 1.000 Cruzeiros",
  },
  {
    fromCurrency: "NCR",    // Cruzeiro Novo
    toCurrency: "CR2",      // Cruzeiro (1970, renomeação)
    effectiveDate: "1970-05-15",
    conversionFactor: 1,
    factorType: "multiplicador",
    legalNote: "Lei nº 5.577/1969 — Cruzeiro Novo renomeado para Cruzeiro (paridade 1:1)",
  },
  {
    fromCurrency: "CR2",    // Cruzeiro (1970)
    toCurrency: "CZL",      // Cruzado (1986)
    effectiveDate: "1986-02-28",
    conversionFactor: 1000,
    factorType: "divisor",
    legalNote: "Decreto-Lei nº 2.283/1986 (Plano Cruzado) — 1 Cruzado = 1.000 Cruzeiros",
  },
  {
    fromCurrency: "CZL",    // Cruzado
    toCurrency: "NCZ",      // Cruzado Novo (1989)
    effectiveDate: "1989-01-16",
    conversionFactor: 1000,
    factorType: "divisor",
    legalNote: "Decreto-Lei nº 1/1989 (Plano Verão) — 1 Cruzado Novo = 1.000 Cruzados",
  },
  {
    fromCurrency: "NCZ",    // Cruzado Novo
    toCurrency: "CR3",      // Cruzeiro (1990, renomeação)
    effectiveDate: "1990-03-16",
    conversionFactor: 1,
    factorType: "multiplicador",
    legalNote: "Lei nº 8.024/1990 (Plano Collor) — Cruzado Novo renomeado para Cruzeiro (paridade 1:1)",
  },
  {
    fromCurrency: "CR3",    // Cruzeiro (1990)
    toCurrency: "CRR",      // Cruzeiro Real (1993)
    effectiveDate: "1993-08-01",
    conversionFactor: 1000,
    factorType: "divisor",
    legalNote: "Medida Provisória nº 336/1993 — 1 Cruzeiro Real = 1.000 Cruzeiros",
  },
  {
    fromCurrency: "CRR",    // Cruzeiro Real
    toCurrency: "BRL",      // Real (1994)
    effectiveDate: "1994-07-01",
    conversionFactor: 2750,
    factorType: "divisor",
    legalNote: "Medida Provisória nº 542/1994 (Plano Real) — 1 Real = 2.750 Cruzeiros Reais (via URV)",
  },
];

// Mapa de nomes de moedas para exibição no relatório
export const CURRENCY_NAMES: Record<string, string> = {
  BRR: "Réis (Mil-Réis)",
  CRZ: "Cruzeiro (1942)",
  NCR: "Cruzeiro Novo (1967)",
  CR2: "Cruzeiro (1970)",
  CZL: "Cruzado (1986)",
  NCZ: "Cruzado Novo (1989)",
  CR3: "Cruzeiro (1990)",
  CRR: "Cruzeiro Real (1993)",
  BRL: "Real",
};

/**
 * Identifica a moeda vigente para uma data específica (formato "YYYY-MM")
 */
export function getCurrencyAtPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const dateValue = year * 100 + month;

  // Percorre a linha do tempo de trás para frente
  for (let i = BRAZIL_CURRENCY_TIMELINE.length - 1; i >= 0; i--) {
    const t = BRAZIL_CURRENCY_TIMELINE[i];
    const [tYear, tMonth] = t.effectiveDate.split("-").map(Number);
    const tValue = tYear * 100 + tMonth;
    if (dateValue >= tValue) {
      return t.toCurrency;
    }
  }

  return "BRR"; // Anterior a 1942 — Réis
}

/**
 * Converte um valor de uma moeda para Real (BRL)
 * Aplica todas as transições necessárias entre a data de origem e 1994-07-01
 */
export function convertToReal(
  amount: number,
  fromCurrency: string
): CurrencyConversionResult {
  if (fromCurrency === "BRL") {
    return {
      originalCurrency: "BRL",
      finalCurrency: "BRL",
      originalAmount: amount,
      convertedAmount: amount,
      steps: [],
    };
  }

  const steps: CurrencyConversionStep[] = [];
  let currentAmount = amount;
  let currentCurrency = fromCurrency;

  // Percorre as transições a partir da moeda de origem até BRL
  const startIdx = BRAZIL_CURRENCY_TIMELINE.findIndex(
    (t) => t.fromCurrency === currentCurrency
  );

  if (startIdx === -1) {
    // Moeda não reconhecida na linha do tempo — retorna sem conversão
    return {
      originalCurrency: fromCurrency,
      finalCurrency: fromCurrency,
      originalAmount: amount,
      convertedAmount: amount,
      steps: [],
    };
  }

  for (let i = startIdx; i < BRAZIL_CURRENCY_TIMELINE.length; i++) {
    const transition = BRAZIL_CURRENCY_TIMELINE[i];
    if (transition.fromCurrency !== currentCurrency) continue;

    const amountBefore = currentAmount;
    let amountAfter: number;

    if (transition.factorType === "divisor") {
      amountAfter = currentAmount / transition.conversionFactor;
    } else {
      amountAfter = currentAmount * transition.conversionFactor;
    }

    steps.push({
      fromCurrency: transition.fromCurrency,
      toCurrency: transition.toCurrency,
      transitionDate: transition.effectiveDate,
      appliedFactor: transition.conversionFactor,
      factorType: transition.factorType,
      amountBefore,
      amountAfter,
      legalNote: transition.legalNote,
    });

    currentAmount = amountAfter;
    currentCurrency = transition.toCurrency;

    if (currentCurrency === "BRL") break;
  }

  return {
    originalCurrency: fromCurrency,
    finalCurrency: currentCurrency,
    originalAmount: amount,
    convertedAmount: currentAmount,
    steps,
  };
}

/**
 * Verifica se uma parcela com data "YYYY-MM" precisa de conversão monetária
 */
export function needsCurrencyConversion(period: string): boolean {
  return getCurrencyAtPeriod(period) !== "BRL";
}

/**
 * Retorna o fator de conversão total acumulado de uma moeda para BRL
 * (produto de todos os fatores intermediários)
 */
export function getTotalConversionFactor(fromCurrency: string): number {
  if (fromCurrency === "BRL") return 1;
  const result = convertToReal(1, fromCurrency);
  return result.convertedAmount;
}
