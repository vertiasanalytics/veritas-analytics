/**
 * index.ts — Ponto de entrada do módulo Previdenciário — Liquidação de Sentença
 *
 * Padrão de importação nas páginas:
 *   import { runCalc, qApplyPrescription, getTetoInss, ... } from "@/modules/previdenciario";
 *   import type { BenefitConfig, CalcResult, ... }           from "@/modules/previdenciario";
 *   import { buildLaudoPrevidenciario }                      from "@/modules/previdenciario";
 *
 * Estrutura interna:
 *   types.ts        — Interfaces e tipos TypeScript
 *   engine.ts       — Motor de cálculo puro (runCalc, fmtMes, getTetoInss, ...)
 *   laudoBuilder.ts — Gerador de HTML do laudo de liquidação
 */

export * from "./types";
export * from "./engine";
export * from "./laudoBuilder";
