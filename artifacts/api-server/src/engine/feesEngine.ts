/**
 * feesEngine.ts
 * Motor de cálculo de honorários advocatícios
 * PONTO DE HOMOLOGAÇÃO: Regras de escalonamento requerem validação jurídica
 */

export interface ScalingRange {
  upTo: number;        // limite superior da faixa (em BRL)
  percentage: number;  // percentual sobre esta faixa
}

export interface FeesInput {
  calcMode: string;       // none | condemnation_value | cause_value | fixed_value | condemnation_no_discount | condemnation_with_discount_limit
  percentage?: number;
  fixedValue?: number;
  discountLimit?: number;
  scaledForPublicEntity: boolean;
  scalingRanges?: ScalingRange[];
  // Valores de base
  totalCondemnationGross: number;    // Total bruto (antes de descontos)
  totalCondemnationNet: number;      // Total líquido (após descontos)
  causeValue?: number;
}

export interface FeesResult {
  computedAmount: number;
  baseUsed: number;
  percentageApplied: number | null;
  calcMode: string;
  description: string;
  scalingBreakdown?: { range: string; amount: number; pct: number }[];
}

// Honorários escalonados padrão para Fazenda Pública (art. 85 §3º CPC)
// PONTO DE HOMOLOGAÇÃO: Verificar valores atualizados conforme CPC vigente
export const DEFAULT_SCALING_RANGES: ScalingRange[] = [
  { upTo: 200000,       percentage: 10 },   // até 200 salários-mínimos: 10%
  { upTo: 2000000,      percentage: 8 },    // até 2.000 SM: 8%
  { upTo: 20000000,     percentage: 5 },    // até 20.000 SM: 5%
  { upTo: 100000000,    percentage: 3 },    // até 100.000 SM: 3%
  { upTo: Infinity,     percentage: 1 },    // acima: 1%
];

function applyScaledFees(
  base: number,
  ranges: ScalingRange[]
): { amount: number; breakdown: { range: string; amount: number; pct: number }[] } {
  let remaining = base;
  let prevLimit = 0;
  let totalFees = 0;
  const breakdown: { range: string; amount: number; pct: number }[] = [];

  for (const range of ranges) {
    if (remaining <= 0) break;
    const limit = Math.min(range.upTo, base);
    const rangeBase = Math.min(remaining, limit - prevLimit);
    if (rangeBase <= 0) { prevLimit = limit; continue; }

    const feesPart = rangeBase * (range.percentage / 100);
    totalFees += feesPart;

    breakdown.push({
      range: `R$ ${prevLimit.toFixed(2)} a R$ ${limit === Infinity ? "∞" : limit.toFixed(2)}`,
      amount: feesPart,
      pct: range.percentage,
    });

    remaining -= rangeBase;
    prevLimit = limit;
  }

  return { amount: totalFees, breakdown };
}

export function computeFees(input: FeesInput): FeesResult {
  const {
    calcMode,
    percentage,
    fixedValue,
    discountLimit,
    scaledForPublicEntity,
    scalingRanges,
    totalCondemnationGross,
    totalCondemnationNet,
    causeValue = 0,
  } = input;

  if (calcMode === "none") {
    return {
      computedAmount: 0,
      baseUsed: 0,
      percentageApplied: 0,
      calcMode,
      description: "Sem honorários advocatícios",
    };
  }

  if (calcMode === "fixed_value") {
    return {
      computedAmount: fixedValue ?? 0,
      baseUsed: fixedValue ?? 0,
      percentageApplied: null,
      calcMode,
      description: "Honorários de valor fixo",
    };
  }

  // Determina a base de cálculo
  let base: number;
  let baseDescription: string;

  switch (calcMode) {
    case "condemnation_value":
      base = totalCondemnationNet;
      baseDescription = "Valor da condenação (com descontos)";
      break;
    case "condemnation_no_discount":
      base = totalCondemnationGross;
      baseDescription = "Valor da condenação (sem descontos)";
      break;
    case "condemnation_with_discount_limit":
      base = Math.max(totalCondemnationNet, (discountLimit ?? totalCondemnationNet));
      baseDescription = "Valor da condenação com limite de desconto";
      break;
    case "cause_value":
      base = causeValue;
      baseDescription = "Valor da causa / proveito econômico";
      break;
    default:
      base = totalCondemnationNet;
      baseDescription = "Valor da condenação";
  }

  // Escalonamento (Fazenda Pública ou customizado)
  if (scaledForPublicEntity || (scalingRanges && scalingRanges.length > 0)) {
    const ranges = scalingRanges?.length ? scalingRanges : DEFAULT_SCALING_RANGES;
    const { amount, breakdown } = applyScaledFees(base, ranges);
    return {
      computedAmount: amount,
      baseUsed: base,
      percentageApplied: null,
      calcMode,
      description: `Honorários escalonados sobre ${baseDescription}`,
      scalingBreakdown: breakdown,
    };
  }

  // Percentual fixo
  const pct = percentage ?? 0;
  const amount = base * (pct / 100);

  return {
    computedAmount: amount,
    baseUsed: base,
    percentageApplied: pct,
    calcMode,
    description: `${pct}% sobre ${baseDescription}`,
  };
}
