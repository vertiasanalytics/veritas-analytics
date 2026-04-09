/**
 * VeritasSectionTitle — Título de seção dos relatórios Veritas
 *
 * Linha centralizada com cor primária e border-bottom, opcionalmente numerada.
 */

export function renderSectionTitle(titulo: string, numero?: string | number): string {
  const prefix = numero != null ? `${numero}. ` : "";
  return `<div class="vr-section-title">${prefix}${titulo}</div>`;
}
