/**
 * VeritasFooter — Rodapé oficial dos relatórios Veritas
 *
 * Inclui assinatura, chave de recuperação e ressalva técnica.
 */

export interface VeritasFooterOptions {
  userName: string;
  role?: string;
  credencial?: string;
  chave: string;
  emitidoEm: string;
  ressalva?: string;
}

const DEFAULT_RESSALVA =
  "Este documento é de natureza técnica e não substitui pareceres jurídicos. " +
  "Os valores são estimativos e devem ser conferidos com documentos e índices oficiais " +
  "antes de utilização processual.";

export function renderVeritasFooter(opts: VeritasFooterOptions): string {
  const { userName, role, credencial, chave, emitidoEm, ressalva = DEFAULT_RESSALVA } = opts;
  return `
  <div class="vr-signature">
    <div class="vr-signature-line"></div>
    <div class="vr-signature-name">${userName || "—"}</div>
    ${role ? `<div class="vr-signature-role">${role}</div>` : ""}
    ${credencial ? `<div class="vr-signature-role">${credencial}</div>` : ""}
    <div class="vr-footer-chave">Chave de recuperação: <strong>${chave}</strong> — Veritas Analytics · ${emitidoEm}</div>
  </div>

  <div class="vr-footer">
    <span>Veritas Analytics — Plataforma de Cálculos Jurídicos e Periciais</span>
    <span>Emitido em ${emitidoEm}</span>
  </div>

  <p class="vr-ressalva">${ressalva}</p>`;
}
