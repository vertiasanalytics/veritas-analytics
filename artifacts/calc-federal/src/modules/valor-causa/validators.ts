/**
 * validators.ts — Validação de entrada do módulo Valor da Causa Previdenciária
 *
 * ⚠ FUNÇÕES PURAS — sem React, DOM ou chamadas à API.
 * Todas as validações retornam string[] de erros (vazio = válido).
 *
 * Separado de engine.ts para que formulários possam importar validação
 * sem arrastar o motor de cálculo completo.
 */

import { parseIso } from "./utils";
import type { FormState, Contribuicao } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Validação dos campos principais da DIB / ajuizamento
// ─────────────────────────────────────────────────────────────────────────────

export function validateDatasBase(params: {
  dib: string;
  dataAjuizamento: string;
}): string[] {
  const errors: string[] = [];
  if (!params.dib)
    errors.push("DIB (Data de Início do Benefício) é obrigatória.");
  if (!params.dataAjuizamento)
    errors.push("Data de ajuizamento é obrigatória.");
  if (params.dib && params.dataAjuizamento) {
    const d = parseIso(params.dib);
    const a = parseIso(params.dataAjuizamento);
    if (d && a && d > a)
      errors.push("DIB não pode ser posterior à data de ajuizamento.");
  }
  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validação da RMI
// ─────────────────────────────────────────────────────────────────────────────

export function validateRmi(rmi: number): string[] {
  const errors: string[] = [];
  if (rmi < 0) errors.push("RMI não pode ser negativa.");
  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validação das contribuições para cálculo SB-80
// ─────────────────────────────────────────────────────────────────────────────

export function validateContribuicoes(contribuicoes: Contribuicao[]): string[] {
  const errors: string[] = [];
  if (contribuicoes.length === 0) return errors; // Contribuições são opcionais
  const invalidas = contribuicoes.filter(
    (c) => !c.competencia || c.salario < 0
  );
  if (invalidas.length > 0)
    errors.push(
      `${invalidas.length} contribuição(ões) com dados inválidos (salário negativo ou competência em branco).`
    );
  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validação completa do FormState antes de calcular
// (mantém compatibilidade com a assinatura antiga usada em engine.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function validateValorCausaInput(params: {
  dib: string;
  dataAjuizamento: string;
  rmi: number;
  naturezaSegurado: string;
}): string[] {
  return [
    ...validateDatasBase(params),
    ...validateRmi(params.rmi),
  ];
}

/** Validação mais abrangente do estado completo do formulário */
export function validateFormState(form: FormState): string[] {
  return validateValorCausaInput({
    dib:              form.dib,
    dataAjuizamento:  form.dataAjuizamento,
    rmi:              form.rmi,
    naturezaSegurado: form.naturezaSegurado,
  });
}
