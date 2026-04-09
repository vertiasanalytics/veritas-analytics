/**
 * index.ts — Ponto de entrada do módulo Valor da Causa Previdenciária
 *
 * Padrão de importação nas páginas:
 *   import { buildBenefitEvolution, calcSB80, ... }  from "@/modules/valor-causa";
 *   import type { FormState, ResultadoCalculo, ... } from "@/modules/valor-causa";
 *   import { validateValorCausaInput }               from "@/modules/valor-causa";
 *   import { criterioToKey, parseDcBloco }           from "@/modules/valor-causa";
 *   import { GRUPO_LABEL, DC_EXEMPLO }               from "@/modules/valor-causa";
 *
 * Estrutura interna do módulo:
 *   types.ts       — Interfaces e tipos TypeScript
 *   constants.ts   — Constantes de domínio (labels, opções, exemplos)
 *   utils.ts       — Helpers de mapeamento, parsing e formatação
 *   validators.ts  — Validação de entrada (sem lógica de cálculo)
 *   engine.ts      — Motor de cálculo puro (funções de negócio)
 */

export * from "./types";
export * from "./constants";
export * from "./utils";
export * from "./validators";
export * from "./engine";
export * from "./laudoBuilder";

// Nota: DcCompetencia, DcLinhaResultado, DcDecimoItem são exportados via utils.ts
// runCalculo, dcParseLine, dcCalcDecimos, dcMontarLinhas, dcToCsv são exportados via engine.ts
