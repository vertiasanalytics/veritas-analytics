/**
 * types.ts — Contratos de tipos do módulo Previdenciário — Liquidação de Sentença
 *
 * Módulo: Liquidação de Sentença Previdenciária (LOAS, Aposentadorias, Auxílios)
 * Metodologia: CJF 2025 — Manual de Cálculos da Justiça Federal
 *              TRT-3 2026/1 (adaptações trabalhistas)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Configuração principal do benefício
// ─────────────────────────────────────────────────────────────────────────────

export interface BenefitConfig {
  nome: string;
  nb: string;
  especie: string;
  dib: string;
  dip: string;
  der: string;
  dataSentenca: string;
  dataCalculo: string;
  tcAnos: number;
  tcMeses: number;
  tcDias: number;
  usarMedia80: boolean;
  coeficienteRmi: number;
  aplicarTeto: boolean;
  tetoRmi: number;
  usarRmiManual: boolean;
  rmiManual: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Linhas de entrada do cálculo
// ─────────────────────────────────────────────────────────────────────────────

export interface SalaryRow {
  competencia: string;
  valorOriginal: number;
}

export interface RateRow {
  competencia: string;
  taxa: number;
}

export interface PaymentRow {
  competencia: string;
  valorPago: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuração de juros moratórios
// ─────────────────────────────────────────────────────────────────────────────

export interface JurosConfig {
  tipo: "simples" | "composto" | "nenhum";
  taxaMensal: number;
  termoInicial: "competencia" | "citacao";
  dataCitacao: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prescrição quinquenal
// ─────────────────────────────────────────────────────────────────────────────

export interface PrescricaoConfig {
  aplicar: boolean;
  marcoInterruptivo: string;
  anos: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultados do cálculo por linha
// ─────────────────────────────────────────────────────────────────────────────

export interface SalaryResult {
  competencia: string;
  valorOriginal: number;
  moeda: string;
  fatorMoeda: number;
  valorEmReal: number;
  fatorCorrecao: number;
  valorCorrigido: number;
  considerado: boolean;
  indice: string;
}

/** Linha de evolução do RMA (Renda Mensal Atualizada) */
export interface RmaRow {
  competencia: string;
  valorRma: number;
  taxaReajuste: number;
  /** Ex.: "RMI inicial" | "Reajuste anual 2024 (INPC 12m)" */
  origemReajuste: string;
}

/** Linha de parcela em atraso com correção e juros */
export interface AtrasadoRow {
  competencia: string;
  valorDevido: number;
  valorPago: number;
  diferenca: number;
  fatorCorrecao: number;
  valorCorrigido: number;
  juros: number;
  totalAtualizado: number;
  observacao: string;
  /** Ex.: "RMI inicial" | "Após reajuste jan/2024" */
  origemValorBase: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultado principal do engine
// ─────────────────────────────────────────────────────────────────────────────

export interface CalcResult {
  sb: number;
  rmi: number;
  rmaAtual: number;
  totalBruto: number;
  totalCorrigido: number;
  totalJuros: number;
  totalAtualizado: number;
  salariosCorrigidos: SalaryResult[];
  rmaEvolution: RmaRow[];
  atrasados: AtrasadoRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Prescrição quinquenal — tipos internos do engine
// ─────────────────────────────────────────────────────────────────────────────

export type QCalculationMode = "integral" | "quinquenio";

export interface QMonthlyDifference {
  id: string;
  competencia: string;
  rubrica: string;
  valorOriginal: number;
  valorCorrigido?: number;
  juros?: number;
  total?: number;
}

export interface QParsedCompetencia {
  year: number;
  month: number;
  key: string;
  label: string;
  date: Date;
}

export interface QFilteredRow extends QMonthlyDifference {
  parsed: QParsedCompetencia;
  valorConsiderado: number;
  statusPrescricao: "EXIGIVEL" | "PRESCRITO";
}

export interface QSummary {
  totalIntegral: number;
  totalExigivel: number;
  totalPrescrito: number;
  quantidadeIntegral: number;
  quantidadeExigivel: number;
  quantidadePrescrita: number;
  competenciaInicialIntegral?: string;
  competenciaFinalIntegral?: string;
  competenciaInicialExigivel?: string;
  competenciaFinalExigivel?: string;
  dataCorte: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Períodos CNIS
// ─────────────────────────────────────────────────────────────────────────────

export interface CnisPeriodo {
  inicio: string;
  fim: string;
  anos: number;
  meses: number;
  dias: number;
  raw: string;
}
