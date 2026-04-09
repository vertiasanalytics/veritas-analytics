/**
 * VeritasSummaryCard — Linha de KPIs resumo do cálculo
 *
 * Renderiza uma grade horizontal de cards com label + valor.
 * Variantes: padrão (cinza), primary (azul-marinho), accent (verde).
 */

export interface SummaryCardItem {
  label: string;
  value: string;
  sub?: string;
  variant?: "default" | "primary" | "accent";
}

export function renderSummaryCards(cards: SummaryCardItem[]): string {
  const items = cards
    .map(c => {
      const cls = c.variant === "primary" ? " primary" : c.variant === "accent" ? " accent" : "";
      return `
        <div class="vr-kpi${cls}">
          <div class="vr-kpi-label">${c.label}</div>
          <div class="vr-kpi-value">${c.value}</div>
          ${c.sub ? `<div class="vr-kpi-sub">${c.sub}</div>` : ""}
        </div>`;
    })
    .join("");
  return `<div class="vr-kpi-row">${items}</div>`;
}
