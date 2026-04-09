/**
 * reportTheme.ts — Design System Oficial dos Relatórios Veritas Analytics
 *
 * Fonte única da verdade para cores, tipografia e espaçamento.
 * TODOS os relatórios devem importar daqui — nunca repetir valores inline.
 */

export const COLORS = {
  primary:   "#17365d",
  secondary: "#1e4976",
  accent:    "#059669",
  warning:   "#d97706",
  danger:    "#dc2626",
  info:      "#1d4ed8",

  bgPage:       "#f8fafc",
  bgSection:    "#f1f5f9",
  bgTableEven:  "#f8fafc",
  bgTableHover: "#eff6ff",
  bgTotal:      "#eff6ff",
  bgWarn:       "#fffbeb",
  bgInfo:       "#eff6ff",

  textPrimary:   "#0f172a",
  textSecondary: "#334155",
  textMuted:     "#64748b",
  textPlaceholder: "#94a3b8",

  border:        "#e2e8f0",
  borderPrimary: "#17365d",

  white: "#ffffff",
} as const;

export const TYPOGRAPHY = {
  fontFamily:     '"Segoe UI", Arial, sans-serif',
  baseFontSize:   "13px",
  smallFontSize:  "11.5px",
  xSmallFontSize: "10px",
  lineHeight:     "1.75",
} as const;

export const SPACING = {
  pageH:    "28px 40px",
  sectionV: "22px",
  rowPad:   "7px 8px",
  thPad:    "9px 8px",
} as const;

export const REPORT_GLOBAL_CSS = `
  @page { size: A4 landscape; margin: 12mm 14mm; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: ${TYPOGRAPHY.fontFamily};
    font-size: ${TYPOGRAPHY.baseFontSize};
    line-height: ${TYPOGRAPHY.lineHeight};
    color: ${COLORS.textPrimary};
    background: ${COLORS.white};
  }

  /* ── Página ──────────────────────────────────────────── */
  .vr-page { max-width: 1260px; margin: 0 auto; background: ${COLORS.white}; }

  /* ── Cabeçalho da página ─────────────────────────────── */
  .vr-page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 40px;
    border-bottom: 3px solid ${COLORS.primary};
  }
  .vr-brand-block { display: flex; align-items: center; gap: 14px; }
  .vr-logo-box img { width: 60px; height: 60px; object-fit: contain; }
  .vr-brand-name {
    font-size: 22px;
    font-weight: 900;
    color: ${COLORS.primary};
    letter-spacing: 1px;
    line-height: 1.1;
  }
  .vr-brand-sub {
    font-size: 9.5px;
    color: ${COLORS.textMuted};
    letter-spacing: 2.5px;
    font-weight: 700;
    margin-top: 3px;
    text-transform: uppercase;
  }
  .vr-emit-info {
    text-align: right;
    font-size: 12.5px;
    color: ${COLORS.textSecondary};
    line-height: 1.75;
  }
  .vr-emit-info strong { color: ${COLORS.textPrimary}; }

  /* ── Barra de título ─────────────────────────────────── */
  .vr-title-bar {
    background: ${COLORS.primary};
    color: ${COLORS.white};
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 13px 40px;
  }
  .vr-title-bar-title { font-size: 17px; font-weight: 700; letter-spacing: 0.2px; }
  .vr-title-bar-chave {
    font-size: 11.5px;
    font-weight: 700;
    background: rgba(255,255,255,0.15);
    padding: 4px 11px;
    border-radius: 6px;
    white-space: nowrap;
  }

  /* ── Meta-dados rápidos (grid 2 col) ─────────────────── */
  .vr-meta {
    padding: 14px 40px;
    font-size: 13px;
    line-height: 1.75;
    background: ${COLORS.bgSection};
    border-bottom: 1px solid ${COLORS.border};
  }
  .vr-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 24px;
  }
  .vr-meta-label { color: ${COLORS.textMuted}; }
  .vr-meta-value { font-weight: 600; color: ${COLORS.textPrimary}; }

  /* ── Corpo do documento ──────────────────────────────── */
  .vr-body { padding: 24px 40px; }

  /* ── KPI summary grid ────────────────────────────────── */
  .vr-kpi-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px;
    margin: 14px 0;
  }
  .vr-kpi {
    border: 1px solid ${COLORS.border};
    border-radius: 8px;
    padding: 10px 14px;
    background: ${COLORS.bgSection};
  }
  .vr-kpi-label {
    font-size: 9.5px;
    font-weight: 700;
    color: ${COLORS.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  .vr-kpi-value {
    font-size: 18px;
    font-weight: 900;
    color: ${COLORS.primary};
    margin-top: 3px;
  }
  .vr-kpi-sub { font-size: 10.5px; color: ${COLORS.textMuted}; margin-top: 2px; }
  .vr-kpi.accent {
    background: ${COLORS.accent};
    border-color: ${COLORS.accent};
  }
  .vr-kpi.accent .vr-kpi-label { color: rgba(255,255,255,0.75); }
  .vr-kpi.accent .vr-kpi-value { color: ${COLORS.white}; }
  .vr-kpi.primary {
    background: ${COLORS.primary};
    border-color: ${COLORS.primary};
  }
  .vr-kpi.primary .vr-kpi-label { color: #93c5fd; }
  .vr-kpi.primary .vr-kpi-value { color: ${COLORS.white}; }

  /* ── Títulos de seção ────────────────────────────────── */
  .vr-section-title {
    margin-top: ${SPACING.sectionV};
    text-align: center;
    font-size: 15px;
    color: ${COLORS.primary};
    font-weight: 700;
    padding: 5px 0;
    border-bottom: 2px solid ${COLORS.primary};
  }

  /* ── Parágrafo justificado ───────────────────────────── */
  .vr-paragraph {
    margin-top: 16px;
    font-size: 13.5px;
    line-height: 1.8;
    text-align: justify;
    color: ${COLORS.textSecondary};
  }

  /* ── Tabelas ─────────────────────────────────────────── */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 12px;
    font-size: 12.5px;
  }
  thead th {
    background: ${COLORS.primary};
    color: ${COLORS.white};
    padding: ${SPACING.thPad};
    font-weight: 600;
    white-space: nowrap;
    text-align: left;
  }
  thead th.center { text-align: center; }
  thead th.right  { text-align: right; }
  tbody tr:nth-child(even) { background: ${COLORS.bgTableEven}; }
  tbody td {
    padding: ${SPACING.rowPad};
    border-bottom: 1px solid ${COLORS.border};
    color: ${COLORS.textSecondary};
  }
  tbody td.center { text-align: center; }
  tbody td.right  { text-align: right; }
  tfoot td {
    padding: ${SPACING.rowPad};
    border-top: 2px solid ${COLORS.primary};
    border-bottom: 2px solid ${COLORS.primary};
    font-weight: 700;
    background: ${COLORS.bgTotal};
  }
  tfoot td.right { text-align: right; }

  /* ── Resumo/totalizador ─────────────────────────────── */
  .vr-summary {
    margin-top: 14px;
    border-top: 2px solid ${COLORS.textPrimary};
    border-bottom: 2px solid ${COLORS.textPrimary};
    padding: 10px 0;
    font-size: 13.5px;
    font-weight: 700;
  }
  .vr-summary-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin: 5px 0;
  }
  .vr-total-block {
    background: ${COLORS.primary};
    color: ${COLORS.white};
    border-radius: 6px;
    padding: 8px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 10px 0;
  }
  .vr-total-block .label { font-size: 12px; font-weight: 600; letter-spacing: 0.3px; }
  .vr-total-block .value { font-size: 20px; font-weight: 900; }

  /* ── Caixas de alerta/info ─────────────────────────── */
  .vr-warning-box {
    margin: 10px 0;
    padding: 10px 14px;
    background: ${COLORS.bgWarn};
    border: 1px solid #f59e0b;
    border-left: 4px solid ${COLORS.warning};
    border-radius: 6px;
    font-size: 12.5px;
    color: #78350f;
    line-height: 1.7;
  }
  .vr-info-box {
    margin: 10px 0;
    padding: 10px 14px;
    background: ${COLORS.bgInfo};
    border: 1px solid #93c5fd;
    border-left: 4px solid ${COLORS.info};
    border-radius: 6px;
    font-size: 12.5px;
    color: #1e40af;
    line-height: 1.7;
  }
  .vr-danger-box {
    margin: 10px 0;
    padding: 10px 14px;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-left: 4px solid ${COLORS.danger};
    border-radius: 6px;
    font-size: 12.5px;
    color: #991b1b;
    line-height: 1.7;
  }

  /* ── Notas e observações ─────────────────────────────── */
  .vr-notes {
    margin-top: 14px;
    font-size: 12.5px;
    color: ${COLORS.textSecondary};
    line-height: 1.8;
  }

  /* ── Assinatura ──────────────────────────────────────── */
  .vr-signature { margin-top: 48px; text-align: center; }
  .vr-signature-line {
    width: 300px;
    border-top: 2px solid ${COLORS.textPrimary};
    margin: 0 auto 10px auto;
  }
  .vr-signature-name { font-size: 14px; font-weight: 700; color: ${COLORS.textPrimary}; }
  .vr-signature-role { font-size: 12.5px; color: ${COLORS.textSecondary}; }

  /* ── Rodapé ──────────────────────────────────────────── */
  .vr-footer {
    margin-top: 32px;
    border-top: 1px solid ${COLORS.border};
    padding-top: 12px;
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: ${COLORS.textPlaceholder};
    line-height: 1.6;
  }
  .vr-footer-chave {
    font-size: 10.5px;
    color: ${COLORS.textPlaceholder};
    text-align: center;
    margin-top: 10px;
  }
  .vr-ressalva {
    margin-top: 14px;
    font-size: 11px;
    color: ${COLORS.textMuted};
    border-top: 1px solid ${COLORS.border};
    padding-top: 10px;
    line-height: 1.7;
  }

  /* ── Impressão ───────────────────────────────────────── */
  @media print {
    body { background: ${COLORS.white}; margin: 0; }
    .vr-page { padding: 0; }
    .no-print { display: none !important; }
    a { text-decoration: none; color: inherit; }
    thead { display: table-header-group; }
    tr, td, th { page-break-inside: avoid; }
  }
`;
