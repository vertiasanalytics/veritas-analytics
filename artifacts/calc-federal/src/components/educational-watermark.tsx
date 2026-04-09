import { GraduationCap } from "lucide-react";

/**
 * Faixa de marca d'água para o Plano Educacional.
 * Exibida no topo dos módulos de cálculo quando o usuário é assinante educacional.
 * Também inserida nos relatórios gerados como texto de aviso.
 */
export function EducationalWatermark({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg border border-blue-300 bg-blue-50 text-blue-800 ${className}`}
    >
      <GraduationCap className="w-4 h-4 flex-shrink-0 text-blue-600" />
      <span className="font-semibold">Plano Educacional</span>
      <span className="text-blue-600 text-xs">—</span>
      <span className="text-xs text-blue-700">
        Relatórios gerados neste plano contêm marca d'água educacional e não são válidos para uso processual.
      </span>
    </div>
  );
}

/**
 * Texto de rodapé a ser inserido em relatórios HTML gerados via window.open().
 * Inclua este HTML antes do fechamento do </body> ao detectar plano educacional.
 */
export const EDUCATIONAL_WATERMARK_HTML = `
  <div style="
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(59,130,246,0.08);
    border-top: 2px solid #93c5fd;
    padding: 8px 16px;
    font-family: sans-serif;
    font-size: 11px;
    color: #1e40af;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 9999;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  ">
    <span style="font-weight:700;letter-spacing:0.05em;">⬛ DOCUMENTO EDUCACIONAL</span>
    <span style="opacity:0.6;">|</span>
    <span>Este relatório foi gerado no Plano Educacional da Veritas Analytics e <strong>não é válido para uso processual</strong>.</span>
    <span style="opacity:0.6;">|</span>
    <span>Veritas Analytics · veritas.com.br</span>
  </div>
  <div style="height:44px"></div>
`;

/**
 * Bloco de marca d'água @media print para inserção em relatórios PDF/impressão.
 */
export const EDUCATIONAL_WATERMARK_CSS = `
  @media print {
    .educational-watermark-print {
      position: fixed !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      background: #eff6ff !important;
      border-top: 2px solid #93c5fd !important;
      padding: 6px 12px !important;
      font-size: 10px !important;
      color: #1e40af !important;
      font-family: sans-serif !important;
      text-align: center !important;
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }
  }
`;
