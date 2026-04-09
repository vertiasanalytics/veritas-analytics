/**
 * VeritasMetaGrid — Bloco de meta-dados do processo/identificação
 *
 * Grid 2 colunas com pares label + valor para identificação rápida.
 */

export interface MetaField {
  label: string;
  value: string | undefined | null;
}

export function renderMetaGrid(fields: MetaField[]): string {
  const items = fields
    .map(f => `
      <div>
        <span class="vr-meta-label">${f.label}: </span>
        <span class="vr-meta-value">${f.value || "—"}</span>
      </div>`)
    .join("");
  return `<div class="vr-meta"><div class="vr-meta-grid">${items}</div></div>`;
}
