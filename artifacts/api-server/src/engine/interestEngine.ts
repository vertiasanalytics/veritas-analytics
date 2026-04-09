/**
 * interestEngine.ts
 * Motor de cálculo de juros moratórios
 * PONTO DE HOMOLOGAÇÃO: Regras históricas requerem validação jurídica
 */

import { db } from "@workspace/db";
import { interestRulesTable, officialIndexesCacheTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export interface InterestInput {
  principalBRL: number;       // Valor principal já convertido para BRL e corrigido
  startPeriod: string;        // "YYYY-MM" — início dos juros
  endPeriod: string;          // "YYYY-MM" — data-base
  interestRuleCode: string;
}

export interface InterestMonthRecord {
  period: string;
  rate: number;
  interestAmount: number;
  accumulatedInterest: number;
}

export interface InterestResult {
  totalInterest: number;
  monthlyRecords: InterestMonthRecord[];
  ruleCode: string;
  ruleName: string;
  ruleType: string;
}

// Gera lista de períodos "YYYY-MM" entre start e end (inclusivo)
function getPeriodsInRange(startPeriod: string, endPeriod: string): string[] {
  const periods: string[] = [];
  const [sy, sm] = startPeriod.split("-").map(Number);
  const [ey, em] = endPeriod.split("-").map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    periods.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return periods;
}

// Busca taxa SELIC mensal do cache
async function getSelicRate(period: string): Promise<number> {
  const cached = await db.select()
    .from(officialIndexesCacheTable)
    .where(eq(officialIndexesCacheTable.indexType, "SELIC"))
    .limit(500);
  const row = cached.find((r) => r.period === period);
  if (row) return parseFloat(row.rate);
  return 0.005; // fallback 0.5% a.m.
}

// Taxa mensal da poupança (simplificado: 0,5% a.m. ou 70% SELIC)
async function getSavingsRate(period: string): Promise<number> {
  const selic = await getSelicRate(period);
  const selicAnnual = selic * 12;
  if (selicAnnual <= 0.085) {
    // SELIC <= 8,5% a.a.: poupança = 70% SELIC
    return selic * 0.7;
  }
  return 0.005; // poupança fixa 0,5% a.m.
}

export async function computeInterest(input: InterestInput): Promise<InterestResult> {
  const { principalBRL, startPeriod, endPeriod, interestRuleCode } = input;

  const rule = await db.select().from(interestRulesTable)
    .where(eq(interestRulesTable.code, interestRuleCode))
    .limit(1);

  if (!rule.length) {
    return {
      totalInterest: 0,
      monthlyRecords: [],
      ruleCode: interestRuleCode,
      ruleName: "Regra não encontrada",
      ruleType: "none",
    };
  }

  const r = rule[0];

  if (r.interestType === "none") {
    return {
      totalInterest: 0,
      monthlyRecords: [],
      ruleCode: r.code,
      ruleName: r.name,
      ruleType: "none",
    };
  }

  const periods = getPeriodsInRange(startPeriod, endPeriod);
  const records: InterestMonthRecord[] = [];
  let accumulated = 0;

  for (const period of periods) {
    let monthlyRate = 0;

    switch (r.interestType) {
      case "simple":
      case "compound":
        monthlyRate = r.monthlyRate ? parseFloat(r.monthlyRate) / 100 : 0;
        break;
      case "selic":
        monthlyRate = await getSelicRate(period);
        break;
      case "savings":
        monthlyRate = await getSavingsRate(period);
        break;
      case "legal":
        // Taxa legal: 1% a.m. (art. 406 CC/2002 c/c art. 161 §1 CTN)
        // PONTO DE HOMOLOGAÇÃO: verificar se aplica SELIC ou 1% conforme período
        monthlyRate = 0.01;
        break;
      case "mixed_historical": {
        // 6% a.a. até CC/2002, 12% a.a. depois
        const [py] = period.split("-").map(Number);
        monthlyRate = py < 2003 ? 0.005 : 0.01;
        break;
      }
      default:
        monthlyRate = 0;
    }

    let interestAmount: number;
    if (r.interestType === "compound") {
      interestAmount = principalBRL * monthlyRate;
    } else {
      // juros simples: aplicados sobre o principal original
      interestAmount = principalBRL * monthlyRate;
    }

    accumulated += interestAmount;
    records.push({
      period,
      rate: monthlyRate,
      interestAmount,
      accumulatedInterest: accumulated,
    });
  }

  return {
    totalInterest: accumulated,
    monthlyRecords: records,
    ruleCode: r.code,
    ruleName: r.name,
    ruleType: r.interestType,
  };
}
