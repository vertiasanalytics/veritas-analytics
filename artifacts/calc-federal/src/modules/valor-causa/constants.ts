/**
 * constants.ts — Constantes do módulo Valor da Causa Previdenciária
 *
 * Separadas do engine.ts para facilitar reutilização em testes, formulários
 * e laudos sem importar a lógica de cálculo.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Mapeamento visual de grupos de itens (UI + laudo)
// ─────────────────────────────────────────────────────────────────────────────

import type { GrupoItem } from "./types";

export const GRUPO_LABEL: Record<GrupoItem, string> = {
  beneficio_recebido: "Benefício Recebido",
  outro_credito:      "Outro Crédito",
  outro_desconto:     "Outro Desconto",
};

/** Versão abreviada para tabelas compactas */
export const GRUPO_LABEL_CURTO: Record<GrupoItem, string> = {
  beneficio_recebido: "Ben. Recebido",
  outro_credito:      "Outro Crédito",
  outro_desconto:     "Outro Desconto",
};

export const GRUPO_COLOR: Record<GrupoItem, string> = {
  beneficio_recebido: "text-red-600",
  outro_credito:      "text-green-600",
  outro_desconto:     "text-orange-600",
};

// ─────────────────────────────────────────────────────────────────────────────
// Critérios de correção monetária disponíveis
// ─────────────────────────────────────────────────────────────────────────────

export const CRITERIO_CORRECAO_OPTIONS = [
  { value: "INPC",   label: "INPC" },
  { value: "IPCA-E", label: "IPCA-E" },
  { value: "SELIC",  label: "SELIC" },
] as const;

export type CriterioCorrecao = typeof CRITERIO_CORRECAO_OPTIONS[number]["value"];

// ─────────────────────────────────────────────────────────────────────────────
// Natureza do segurado
// ─────────────────────────────────────────────────────────────────────────────

export const NATUREZA_OPTIONS = [
  { value: "urbano", label: "Urbano" },
  { value: "rural",  label: "Rural" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Situação do benefício
// ─────────────────────────────────────────────────────────────────────────────

export const SITUACAO_OPTIONS = [
  { value: "concessao",  label: "Concessão" },
  { value: "concedido",  label: "Concedido (já recebendo)" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Origem da base de cálculo
// ─────────────────────────────────────────────────────────────────────────────

export const ORIGEM_BASE_OPTIONS = [
  { value: "rmi",          label: "RMI informada diretamente" },
  { value: "contribuicoes", label: "Calculada pelo SB-80 (contribuições)" },
  { value: "subsidiario",  label: "Subsidiário (salário mínimo / teto)" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Dados de exemplo para importação CSV de competências
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Conjunto de competências de exemplo para pré-carregar o painel 13º Salário.
 * Segurado fictício: Aposentadoria por Idade (Rural) — MARIA DE LOURDES FRANCISCO RODRIGUES
 * Formato: competencia(MM/AAAA);valorOriginal;abatimentos;fatorCorrecao
 */
export const DC_EXEMPLO = `11/2023;759.00;0;1.2049533
12/2023;1518.00;0;1.19396879
01/2024;1527.86;0;1.18343621
02/2024;1527.86;0;1.17206716
03/2024;1527.86;0;1.16276504
04/2024;1527.86;0;1.15319353
05/2024;1527.86;0;1.14302065
06/2024;1527.86;0;1.13361167
07/2024;1527.86;0;1.12472633
08/2024;1527.86;0;1.11458362
09/2024;1527.86;0;1.10497038
10/2024;1527.86;0;1.09576595
11/2024;1527.86;0;1.08566923
12/2024;1527.86;0;1.07715967
01/2025;1600.74;0;1.06723439
02/2025;1600.74;0;1.0565631
03/2025;1600.74;0;1.04620566
04/2025;1600.74;0;1.03625759
05/2025;1600.74;0;1.02538847
06/2025;1600.74;0;1.0138308`;

// ─────────────────────────────────────────────────────────────────────────────
// Limites operacionais
// ─────────────────────────────────────────────────────────────────────────────

/** Prazo prescricional padrão em anos (art. 103 Lei 8.213/91) */
export const PRAZO_PRESCRICIONAL_ANOS = 5;

/** Número máximo de competências manuais permitidas no formulário */
export const MAX_COMPETENCIAS_MANUAL = 600;
