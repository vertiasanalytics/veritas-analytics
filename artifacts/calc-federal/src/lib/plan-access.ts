/**
 * Controle de acesso por plano — Veritas Analytics
 * Define quais módulos/funcionalidades estão disponíveis em cada plano.
 *
 * Hierarquia crescente: educacional < essencial < profissional < avancado < premium
 *
 * Plano Educacional:
 *   - 20 créditos/mês sem acúmulo
 *   - Marca d'água educacional nos relatórios gerados
 *   - Acesso a TODOS os módulos do sistema
 *   - Controladoria Jurídica: limite de 10 registros/mês
 */

export const PLAN_ORDER = ["educacional", "essencial", "profissional", "avancado", "premium"] as const;
export type PlanSlug = typeof PLAN_ORDER[number];

/** Mínimo de plano exigido por funcionalidade. */
export const PLAN_MIN: Record<string, PlanSlug> = {
  // ── Todos os módulos acessíveis a partir do Plano Educacional ─────────────
  "mod:previdenciario":     "educacional",
  "mod:valor-causa":        "educacional",
  "mod:juros-amortizacao":  "educacional",
  "mod:dcf":                "educacional",
  "mod:analise-balanco":    "educacional",
  "mod:contracheque-siape": "educacional",
  "mod:controladoria":      "educacional",
  "mod:trabalhista":        "educacional",
  "mod:honorarios-periciais":      "educacional",
  "mod:honorarios-juridicos":      "educacional",
  "mod:lancamento-controladora":   "educacional",
  "mod:familia":                   "educacional",
  "mod:danos-emergentes":          "educacional",
  "mod:liquidacao-estadual":       "educacional",

  // ── Sub-módulos da Controladoria Jurídica — todos acessíveis ao Educacional
  "ctrl:dashboard":    "educacional",
  "ctrl:receitas":     "educacional",
  "ctrl:despesas":     "educacional",
  "ctrl:receber":      "educacional",
  "ctrl:pagar":        "educacional",
  "ctrl:caixa":        "educacional",
  "ctrl:clientes":     "educacional",
  "ctrl:processos":    "educacional",
  "ctrl:config":       "educacional",
  "ctrl:custas":       "educacional",
  "ctrl:repasses":     "educacional",
  "ctrl:tributos":     "educacional",
  "ctrl:conciliacao":  "educacional",
  "ctrl:relatorios":   "educacional",
  "ctrl:inteligencia": "educacional",
  "ctrl:backup":       "educacional",
};

/**
 * Retorna `true` se o usuário com `userPlanSlug` tem acesso à `featureKey`.
 * Admins sempre retornam `true`.
 * Usuários sem plano ativo recebem acesso Educacional (menor tier).
 */
export function hasAccess(
  userPlanSlug: string | null | undefined,
  featureKey: string,
  isAdmin = false,
): boolean {
  if (isAdmin) return true;
  const required = PLAN_MIN[featureKey];
  if (!required) return true;
  const slug = userPlanSlug ?? "educacional";
  const userIdx = PLAN_ORDER.indexOf(slug as PlanSlug);
  const reqIdx = PLAN_ORDER.indexOf(required);
  if (userIdx < 0) return false; // slug desconhecido
  return userIdx >= reqIdx;
}

/** Retorna `true` se o plano tem marca d'água educacional. */
export function isEducationalPlan(planSlug: string | null | undefined): boolean {
  return planSlug === "educacional";
}

/** Rótulo legível do plano. */
export const PLAN_LABEL: Record<PlanSlug, string> = {
  educacional:  "Educacional",
  essencial:    "Essencial",
  profissional: "Profissional",
  avancado:     "Avançado",
  premium:      "Premium",
};

/** Preço mensal do plano para exibir no gate de upgrade. */
export const PLAN_PRICE: Record<PlanSlug, number> = {
  educacional:  0,
  essencial:    149,
  profissional: 297,
  avancado:     497,
  premium:      897,
};

/** Créditos mensais por plano (para referência na UI). */
export const PLAN_CREDITS: Record<PlanSlug, number> = {
  educacional:  20,
  essencial:    40,
  profissional: 100,
  avancado:     250,
  premium:      0, // ilimitado / sob demanda
};

/**
 * Limite de registros mensais na Controladoria Jurídica por plano.
 * null = sem limite.
 */
export const CTRL_RECORDS_LIMIT: Record<PlanSlug, number | null> = {
  educacional:  10,
  essencial:    null,
  profissional: null,
  avancado:     null,
  premium:      null,
};

/** Badge / cor de cada plano para exibição na UI. */
export const PLAN_BADGE_COLOR: Record<PlanSlug, string> = {
  educacional:  "bg-blue-100 text-blue-800 border-blue-300",
  essencial:    "bg-slate-100 text-slate-700 border-slate-300",
  profissional: "bg-indigo-100 text-indigo-800 border-indigo-300",
  avancado:     "bg-violet-100 text-violet-800 border-violet-300",
  premium:      "bg-amber-100 text-amber-800 border-amber-300",
};
