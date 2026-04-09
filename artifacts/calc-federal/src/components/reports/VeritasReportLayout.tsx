/**
 * VeritasReportLayout — Layout mestre dos relatórios Veritas
 *
 * Monta o documento HTML completo (head + CSS + body).
 * Todos os módulos devem chamar buildVeritasReport() como ponto de entrada.
 *
 * Uso:
 *   const html = buildVeritasReport({
 *     title: "Relatório de Danos Materiais",
 *     body:  renderVeritasHeader(...) + renderSummaryCards(...) + ...
 *   });
 *   const popup = window.open("", "_blank", "width=1100,height=900");
 *   popup.document.write(html);
 */

import { REPORT_GLOBAL_CSS } from "@/theme/reportTheme";

export interface VeritasReportLayoutOptions {
  title: string;
  body: string;
  printDelay?: number;
}

export function buildVeritasReport(opts: VeritasReportLayoutOptions): string {
  const { title, body, printDelay = 400 } = opts;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Veritas Analytics</title>
  <style>${REPORT_GLOBAL_CSS}</style>
</head>
<body>
  <div class="vr-page">
    ${body}
  </div>
  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, ${printDelay});
    };
  </script>
</body>
</html>`;
}

/**
 * Utilitário padrão para abrir a janela de impressão.
 * Todos os módulos devem usar esta função ao invés de chamar window.open diretamente.
 */
export function openVeritasReport(html: string): void {
  const popup = window.open("", "_blank", "width=1100,height=900");
  if (!popup) {
    alert("Popup bloqueado. Permita popups para este site e tente novamente.");
    return;
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}
