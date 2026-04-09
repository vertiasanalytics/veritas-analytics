/**
 * Motor de cálculo de atualização monetária.
 * PONTO DE HOMOLOGAÇÃO: Este módulo implementa as regras do Manual de Cálculos da Justiça Federal.
 * Todas as regras aqui devem ser revisadas e homologadas por especialista jurídico antes do uso em produção.
 */

import crypto from "crypto";
import { getIndexes } from "./indexService.js";

export interface CalculationParams {
  originalValue: number;
  startDate: string;
  endDate: string;
  correctionIndex: string;
  interestRule: string;
}

export interface MonthlyEntry {
  period: string;
  rate: number;
  accumulatedFactor: number;
  source: string;
}

export interface CalculationResult {
  originalValue: number;
  correctedValue: number;
  interestValue: number;
  finalValue: number;
  accumulatedFactor: number;
  totalMonths: number;
  startDate: string;
  endDate: string;
  correctionIndex: string;
  interestRule: string;
  indexTable: MonthlyEntry[];
  computedAt: string;
  integrityHash: string;
  dataSource: string;
}

/**
 * Calcula o fator de atualização acumulado para um período.
 * Método: produto dos fatores mensais (1 + taxa_mensal).
 * PONTO DE HOMOLOGAÇÃO: Verificar se a competência de início/fim deve incluir ou excluir o mês da citação/pagamento.
 */
export function calculateAccumulatedFactor(entries: MonthlyEntry[]): number {
  return entries.reduce((factor, entry) => factor * (1 + entry.rate), 1);
}

/**
 * Calcula juros sobre o valor corrigido.
 * PONTO DE HOMOLOGAÇÃO: Regras de juros devem ser homologadas juridicamente.
 * Diferentes processos podem ter regras diferentes conforme o fundamento legal.
 */
function calculateInterest(
  correctedValue: number,
  totalMonths: number,
  interestRule: string,
  selicFactor: number = 1
): number {
  switch (interestRule) {
    case "none":
      return 0;

    case "simple_1_percent":
      // 1% a.m. simples sobre o valor original (comum em processos anteriores à EC 113/2021)
      // PONTO DE HOMOLOGAÇÃO: Verificar base de cálculo (original ou corrigido)
      return correctedValue * 0.01 * totalMonths;

    case "compound_selic":
      // SELIC composta - conforme EC 113/2021 para débitos da Fazenda Pública
      // PONTO DE HOMOLOGAÇÃO: Verificar marco temporal de aplicação da EC 113/2021
      return correctedValue * (selicFactor - 1);

    case "compound_12_percent_year":
      // 12% ao ano compostos (0,9489% a.m.)
      // PONTO DE HOMOLOGAÇÃO: Verificar aplicabilidade conforme fundamento legal do processo
      const monthlyRate = Math.pow(1.12, 1 / 12) - 1;
      return correctedValue * (Math.pow(1 + monthlyRate, totalMonths) - 1);

    case "manual":
      // Manual: sem cálculo automático, usuário define
      return 0;

    default:
      return 0;
  }
}

/**
 * Executa o cálculo completo de atualização monetária.
 */
export async function computeMonetaryUpdate(
  params: CalculationParams
): Promise<CalculationResult> {
  const { originalValue, startDate, endDate, correctionIndex, interestRule } = params;

  // Buscar índices para o período
  const rawIndexes = await getIndexes(correctionIndex, startDate, endDate);

  if (rawIndexes.length === 0) {
    throw new Error(
      `Nenhum índice encontrado para ${correctionIndex} no período ${startDate} a ${endDate}`
    );
  }

  // Calcular fatores acumulados
  let accumulatedFactor = 1;
  const indexTable: MonthlyEntry[] = rawIndexes.map((entry) => {
    accumulatedFactor *= 1 + entry.rate;
    return {
      period: entry.period,
      rate: entry.rate,
      accumulatedFactor,
      source: entry.source,
    };
  });

  const totalAccumulatedFactor = accumulatedFactor;
  const correctedValue = originalValue * totalAccumulatedFactor;
  const totalMonths = indexTable.length;

  // Calcular juros (SELIC factor se aplicável)
  let selicFactor = 1;
  if (interestRule === "compound_selic") {
    try {
      const selicIndexes = await getIndexes("SELIC", startDate, endDate);
      selicFactor = selicIndexes.reduce((f, e) => f * (1 + e.rate), 1);
    } catch {
      console.warn("[CALC] Falha ao buscar SELIC para juros, usando fator 1");
    }
  }

  const interestValue = calculateInterest(correctedValue, totalMonths, interestRule, selicFactor);
  const finalValue = correctedValue + interestValue;

  const computedAt = new Date().toISOString();
  const dataSource = rawIndexes[0]?.source ?? "Desconhecido";

  // Hash de integridade para auditoria
  const integrityData = {
    originalValue,
    startDate,
    endDate,
    correctionIndex,
    interestRule,
    accumulatedFactor: totalAccumulatedFactor,
    correctedValue,
    interestValue,
    finalValue,
    totalMonths,
    computedAt,
  };
  const integrityHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(integrityData))
    .digest("hex");

  return {
    originalValue,
    correctedValue,
    interestValue,
    finalValue,
    accumulatedFactor: totalAccumulatedFactor,
    totalMonths,
    startDate,
    endDate,
    correctionIndex,
    interestRule,
    indexTable,
    computedAt,
    integrityHash,
    dataSource,
  };
}
