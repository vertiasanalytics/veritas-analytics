/**
 * calculation-module.ts — Contrato base para todos os módulos periciais
 *
 * Todo módulo pericial (previdenciário, trabalhista, bancário, etc.) deve:
 *   1. Definir seus próprios InputParams e OutputResult estendendo os tipos base
 *   2. Exportar um objeto que implementa CalculationModule<I, O>
 *   3. Manter a lógica de cálculo em engine.ts separada da UI em pages/
 *
 * Hierarquia de responsabilidades:
 *   pages/         → orquestração visual + estado local (React)
 *   modules/xxx/   → lógica pura de cálculo (sem dependência de React/DOM)
 *   lib/engines/   → utilitários compartilhados entre módulos
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos monetários e de data
// ─────────────────────────────────────────────────────────────────────────────

/** Período no formato "YYYY-MM" */
export type YearMonth = string;

/** Valor monetário em BRL com 2 casas decimais */
export type BRL = number;

/** Fator de correção acumulado (ex.: 1.0342 = 3,42% de correção) */
export type CorrectionFactor = number;

// ─────────────────────────────────────────────────────────────────────────────
// Registro de taxa mensal (usado por todos os módulos)
// ─────────────────────────────────────────────────────────────────────────────
export interface MonthlyRateEntry {
  competencia: YearMonth;
  taxa: number;
}

export type RateMap = Map<YearMonth, number>;

// ─────────────────────────────────────────────────────────────────────────────
// Parcela calculada — unidade de resultado de qualquer módulo que gere
// listagem mensal de valores (previdenciário, trabalhista, bancário…)
// ─────────────────────────────────────────────────────────────────────────────
export interface CalculatedInstallment {
  competencia: YearMonth;
  valorBase: BRL;
  fatorCorrecao: CorrectionFactor;
  valorCorrigido: BRL;
  observacao?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sumário de totais (qualquer módulo que agrupe parcelas)
// ─────────────────────────────────────────────────────────────────────────────
export interface CalculationSummary {
  totalBase: BRL;
  totalCorrigido: BRL;
  quantidadeParcelas: number;
  periodoInicio?: YearMonth;
  periodoFim?: YearMonth;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contexto de identificação do cálculo (cabeçalho do laudo)
// ─────────────────────────────────────────────────────────────────────────────
export interface CalcIdentification {
  processoNumero?: string;
  autorNome?: string;
  autorCpf?: string;
  dataCalculo: string;
  dataAjuizamento?: string;
  responsavelTecnico?: string;
  orgaoJulgador?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contrato de módulo pericial
// Todo módulo deve exportar um objeto que implemente esta interface.
// ─────────────────────────────────────────────────────────────────────────────
export interface CalculationModule<
  TInput extends Record<string, unknown>,
  TOutput extends Record<string, unknown>,
> {
  /** Identificador único do módulo (ex.: "valor-causa", "previdenciario") */
  readonly moduleId: string;

  /** Nome de exibição ao usuário */
  readonly displayName: string;

  /** Versão da metodologia implementada */
  readonly methodologyVersion: string;

  /**
   * Executa o cálculo principal.
   * Deve ser uma função pura — sem side effects, sem chamadas à API.
   * Todos os dados externos (taxas, índices) devem ser passados em TInput.
   */
  calculate(input: TInput): TOutput;

  /**
   * Valida os dados de entrada antes do cálculo.
   * Retorna array de mensagens de erro (vazio = válido).
   */
  validate(input: TInput): string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitário: Result type para operações que podem falhar
// ─────────────────────────────────────────────────────────────────────────────
export type CalcResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] };

export function calcOk<T>(data: T): CalcResult<T> {
  return { ok: true, data };
}

export function calcErr<T>(errors: string[]): CalcResult<T> {
  return { ok: false, errors };
}
