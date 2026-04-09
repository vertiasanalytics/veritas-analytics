/**
 * types.ts — Contratos de tipos do módulo Valor da Causa Previdenciária
 *
 * Módulo: Cálculo do Valor da Causa (art. 292 CPC + Lei 8.213/91)
 * Metodologia: CJF 2025 — Manual de Cálculos da Justiça Federal
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enumerações e tipos base
// ─────────────────────────────────────────────────────────────────────────────

export type NaturezaSegurado = "urbano" | "rural";
export type SituacaoBeneficio = "concedido" | "concessao";
export type OrigemBase = "rmi" | "contribuicoes" | "subsidiario";
export type GrupoItem = "beneficio_recebido" | "outro_credito" | "outro_desconto";

// ─────────────────────────────────────────────────────────────────────────────
// Contribuições previdenciárias (para regra dos 80%)
// ─────────────────────────────────────────────────────────────────────────────

export interface Contribuicao {
  id: string;
  competencia: string;
  valor: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Evolução mensal do benefício
// ─────────────────────────────────────────────────────────────────────────────

export interface EvolucaoMes {
  ym: string;
  valorBase: number;
  origemValorBase: string;
  reajustePct: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parcelas vencidas (resultado mês a mês do cálculo do valor da causa)
// ─────────────────────────────────────────────────────────────────────────────

export interface ParcelaVencida {
  competencia: string;
  valorBase: number;
  origemValorBase: string;
  reajustePrevPct: string;
  fatorCorrecao: number;
  valorCorrigido: number;
  /** true quando esta linha representa o 13º salário do ano */
  is13o?: boolean;
  /** Descrição detalhada do 13º (meses considerados, fração) */
  detalhes13o?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Item de abatimento ou crédito (seção IV do cálculo)
// ─────────────────────────────────────────────────────────────────────────────

export interface ItemCalculo {
  id: string;
  tipo: GrupoItem;
  descricao: string;
  /** Para tipo = "beneficio_recebido" */
  rmi?: number;
  dataInicio?: string;
  dataFim?: string;
  /** Para tipo = "outro_credito" | "outro_desconto" */
  valor?: number;
  juros?: number;
  selic?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultado do módulo 13º integrado nas parcelas vencidas
// ─────────────────────────────────────────────────────────────────────────────

export interface DecimoMainItem {
  ano: number;
  refYM: string;
  beneficioBase: number;
  mesesConsiderados: number;
  valorBase: number;
  fatorCorrecao: number;
  valorCorrigido: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultado do cálculo dos 80% melhores salários (art. 29, Lei 8.213/91)
// ─────────────────────────────────────────────────────────────────────────────

export interface SB80Result {
  validas: Contribuicao[];
  ordenadas: Contribuicao[];
  melhores80: Contribuicao[];
  excluidas20: Contribuicao[];
  nManter: number;
  nExcluir: number;
  sbEstimado: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultado da resolução da base de cálculo (motor central)
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolveResult {
  evolucao: EvolucaoMes[];
  badgeBase: string;
  metodologiaBase: string;
  temAlertaSubsidiario: boolean;
  rmiEstimada?: number;
  sbEstimado?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contexto de entrada do motor resolveBaseEvolution
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolveCtx {
  natureza: NaturezaSegurado;
  situacao: SituacaoBeneficio;
  origemBase: OrigemBase;
  rmi: number;
  dib: Date;
  ajuiz: Date;
  contribuicoes: Contribuicao[];
  coeficiente: number;
  /** INPC — reajuste anual (art. 41-A Lei 8.213/91) */
  inpcMap: Map<string, number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultado final do cálculo do valor da causa
// ─────────────────────────────────────────────────────────────────────────────

export interface ResultadoCalculo {
  mesesVencidos: number;
  parcelasVencidas: ParcelaVencida[];
  totalVencidasBase: number;
  totalVencidasCorrigidas: number;
  totalVincendas: number;
  rmaFinal: number;
  outrosCreditos: number;
  beneficiosRecebidos: number;
  outrosDescontos: number;
  totalAbatimentos: number;
  valorCausaBruto: number;
  valorCausaFinal: number;
  /** Rótulo da base de cálculo adotada */
  badgeBase: string;
  /** Texto de metodologia para o laudo */
  metodologiaBase: string;
  temAlertaSubsidiario: boolean;
  rmiEstimada?: number;
  sbEstimado?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// FormState — estado do formulário da página (usado pela UI, não pelo engine)
// ─────────────────────────────────────────────────────────────────────────────

export interface FormState {
  processoNumero: string;
  autorNome: string;
  autorCpf: string;
  dataAjuizamento: string;
  percentualAcordo: number;
  parcelasVincendas: number;
  origemRmi: "manual" | "liquidacao_json";
  especie: string;
  dib: string;
  dip: string;
  der: string;
  dataSentenca: string;
  dataBaseCalculo: string;
  rmi: number;
  rma: number;
  liquidacaoJson: string;
  criterioCorrecao: string;
  usarSelicPosEC113: boolean;
  itens: ItemCalculo[];
  naturezaSegurado: NaturezaSegurado;
  situacaoBeneficio: SituacaoBeneficio;
  origemBase: OrigemBase;
  contribuicoes: Contribuicao[];
  coeficiente: number;
  incluir13o: boolean;
}

export const FORM_STATE_INITIAL: FormState = {
  processoNumero: "", autorNome: "", autorCpf: "",
  dataAjuizamento: "", percentualAcordo: 100, parcelasVincendas: 12,
  origemRmi: "manual",
  especie: "", dib: "", dip: "", der: "", dataSentenca: "", dataBaseCalculo: "",
  rmi: 0, rma: 0, liquidacaoJson: "",
  criterioCorrecao: "SELIC", usarSelicPosEC113: true,
  itens: [],
  naturezaSegurado: "urbano",
  situacaoBeneficio: "concedido",
  origemBase: "rmi",
  contribuicoes: [],
  coeficiente: 1.0,
  incluir13o: true,
};
