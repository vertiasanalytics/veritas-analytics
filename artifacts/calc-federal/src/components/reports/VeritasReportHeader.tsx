/**
 * VeritasReportHeader — Cabeçalho oficial dos relatórios Veritas
 *
 * Gera o bloco de topo: logo + marca + barra de título azul com chave.
 */

export interface VeritasHeaderOptions {
  logoSrc: string;
  titulo: string;
  subtitulo?: string;
  chave: string;
  emitidoEm: string;
  responsavel?: string;
  responsavelLabel?: string;
  credencial?: string;
}

export function renderVeritasHeader(opts: VeritasHeaderOptions): string {
  const { logoSrc, titulo, subtitulo, chave, emitidoEm, responsavel, responsavelLabel = "Responsável", credencial } = opts;
  return `
  <div class="vr-page-header">
    <div class="vr-brand-block">
      <div class="vr-logo-box">
        <img src="${logoSrc}" alt="Veritas Analytics" onerror="this.style.display='none'" />
      </div>
      <div>
        <div class="vr-brand-name">VERITAS ANALYTICS</div>
        <div class="vr-brand-sub">Plataforma de Cálculos Jurídicos e Periciais</div>
      </div>
    </div>
    <div class="vr-emit-info">
      <div><strong>Emitido em:</strong> ${emitidoEm}</div>
      ${responsavel ? `<div><strong>${responsavelLabel}:</strong> ${responsavel}</div>` : ""}
      ${credencial ? `<div>${credencial}</div>` : ""}
    </div>
  </div>

  <div class="vr-title-bar">
    <div class="vr-title-bar-title">${titulo}${subtitulo ? ` <span style="font-weight:400;font-size:13px;opacity:.8">— ${subtitulo}</span>` : ""}</div>
    <div class="vr-title-bar-chave">Chave: ${chave}</div>
  </div>`;
}
