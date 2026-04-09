/**
 * reportBuilder.ts — Motor centralizado de geração de laudos HTML
 *
 * Todos os módulos periciais (valor da causa, previdenciário, trabalhista,
 * bancário, etc.) devem usar este builder para gerar laudos com identidade
 * visual, estrutura de seções e CSS consistentes.
 *
 * Uso básico:
 *   const html = buildLaudo({
 *     titulo: "Cálculo do Valor da Causa",
 *     identificacao: { processoNumero: "...", ... },
 *     secoes: [
 *       { numero: "I", titulo: "Dados do Processo", conteudo: buildFieldGrid([...]) },
 *       { numero: "II", titulo: "Parcelas Vencidas", conteudo: buildTable(...) },
 *     ],
 *   });
 *   openPrintWindow(html);
 */

import { fmtR, toBrDate } from "../engines/dateUtils";
import type { CalcIdentification } from "@/lib/types/calculation-module";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos do builder
// ─────────────────────────────────────────────────────────────────────────────

export interface LaudoField {
  label: string;
  value: string | number | null | undefined;
  /** Se true, exibe o campo em destaque (bold + fundo colorido) */
  destaque?: boolean;
  /** Span em colunas (1 a 4). Padrão: 1 */
  span?: 1 | 2 | 3 | 4;
}

export interface LaudoTableColumn {
  header: string;
  /** Alinhamento da coluna. Padrão: left */
  align?: "left" | "center" | "right";
  /** Largura relativa (ex.: "15%"). Opcional. */
  width?: string;
}

export interface LaudoSection {
  numero?: string;
  titulo: string;
  conteudo: string;
  /** Se true, insere quebra de página antes desta seção */
  pageBreak?: boolean;
}

export interface LaudoOptions {
  titulo: string;
  subtitulo?: string;
  identificacao?: Partial<CalcIdentification>;
  secoes: LaudoSection[];
  /** Exibir marca d'água educacional */
  educacional?: boolean;
  /** Nome do módulo de origem (ex.: "Previdenciário — Liquidação de Sentença") */
  modulo?: string;
  /** Versão da metodologia (ex.: "CJF 2025 / TRT-3 2026/1") */
  metodologia?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS compartilhado do laudo
// ─────────────────────────────────────────────────────────────────────────────
function getLaudoCss(): string {
  return `
    @page { size: A4; margin: 18mm 15mm 18mm 15mm; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.45;
      color: #1a1a2e;
      background: #fff;
    }
    /* ── Cabeçalho ──────────────────────────────── */
    .report-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 2px solid #17365d;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .report-header .brand { display: flex; align-items: center; gap: 8px; }
    .report-header .brand-name {
      font-size: 13pt;
      font-weight: 700;
      color: #17365d;
      letter-spacing: -0.3px;
    }
    .report-header .brand-sub {
      font-size: 7pt;
      color: #4a6fa5;
      letter-spacing: 1.2px;
      text-transform: uppercase;
    }
    .report-header .doc-meta { text-align: right; font-size: 7.5pt; color: #555; }
    .report-header .doc-meta strong { color: #17365d; font-size: 8pt; }
    /* ── Título do documento ────────────────────── */
    .doc-title {
      text-align: center;
      font-size: 11pt;
      font-weight: 700;
      color: #17365d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 8px 0 2px;
    }
    .doc-subtitle {
      text-align: center;
      font-size: 8pt;
      color: #4a6fa5;
      margin-bottom: 10px;
    }
    .metodologia-badge {
      display: inline-block;
      font-size: 7pt;
      color: #fff;
      background: #17365d;
      border-radius: 3px;
      padding: 1px 6px;
      margin-left: 4px;
      letter-spacing: 0.5px;
    }
    /* ── Seções ─────────────────────────────────── */
    .section {
      margin-bottom: 10px;
    }
    .section-break-before {
      page-break-before: always;
    }
    .section-title {
      font-size: 8.5pt;
      font-weight: 700;
      color: #fff;
      background: #17365d;
      padding: 3px 8px;
      border-radius: 3px 3px 0 0;
      margin-bottom: 0;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .section-body {
      border: 1px solid #c8d4e3;
      border-top: none;
      padding: 7px 8px;
      border-radius: 0 0 3px 3px;
    }
    /* ── Grade de campos ────────────────────────── */
    .field-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4px 8px;
    }
    .field-item { display: flex; flex-direction: column; }
    .field-item.span-2 { grid-column: span 2; }
    .field-item.span-3 { grid-column: span 3; }
    .field-item.span-4 { grid-column: span 4; }
    .field-label {
      font-size: 6.5pt;
      color: #7a8fa6;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 1px;
    }
    .field-value {
      font-size: 8.5pt;
      color: #1a1a2e;
      font-weight: 500;
      border-bottom: 1px dotted #c8d4e3;
      padding-bottom: 1px;
    }
    .field-item.destaque .field-value {
      font-weight: 700;
      color: #17365d;
      border-bottom-color: #17365d;
    }
    /* ── Tabelas ────────────────────────────────── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5pt;
    }
    thead tr { background: #17365d; color: #fff; }
    thead th {
      padding: 3px 5px;
      font-weight: 600;
      white-space: nowrap;
      letter-spacing: 0.2px;
    }
    tbody tr:nth-child(even) { background: #f4f7fb; }
    tbody tr:hover { background: #e8f0fa; }
    tbody td {
      padding: 2.5px 5px;
      border-bottom: 1px solid #dde5f0;
      color: #2a2a4a;
    }
    tfoot tr { background: #e8f0fa; font-weight: 700; }
    tfoot td { padding: 3px 5px; border-top: 2px solid #17365d; }
    .text-right { text-align: right !important; }
    .text-center { text-align: center !important; }
    .text-amber { background: #fffbeb !important; color: #92400e !important; }
    .text-red { color: #dc2626 !important; }
    .text-green { color: #16a34a !important; }
    .text-bold { font-weight: 700 !important; }
    /* ── Alerta / nota ───────────────────────────── */
    .alert-box {
      background: #fffbeb;
      border: 1px solid #f59e0b;
      border-radius: 3px;
      padding: 5px 8px;
      font-size: 8pt;
      color: #78350f;
      margin: 6px 0;
    }
    .info-box {
      background: #eff6ff;
      border: 1px solid #93c5fd;
      border-radius: 3px;
      padding: 5px 8px;
      font-size: 8pt;
      color: #1e40af;
      margin: 6px 0;
    }
    /* ── Totalizador ─────────────────────────────── */
    .total-block {
      background: #17365d;
      color: #fff;
      border-radius: 4px;
      padding: 6px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 6px 0;
    }
    .total-block .label { font-size: 8pt; font-weight: 600; letter-spacing: 0.3px; }
    .total-block .value { font-size: 12pt; font-weight: 700; }
    /* ── Rodapé ──────────────────────────────────── */
    .report-footer {
      border-top: 1px solid #c8d4e3;
      padding-top: 6px;
      margin-top: 12px;
      display: flex;
      justify-content: space-between;
      font-size: 6.5pt;
      color: #7a8fa6;
    }
    /* ── Marca d'água educacional ────────────────── */
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      font-size: 72pt;
      font-weight: 900;
      color: rgba(15, 42, 74, 0.06);
      pointer-events: none;
      white-space: nowrap;
      z-index: -1;
      letter-spacing: 4px;
    }
    @media print {
      .no-print { display: none !important; }
      a { text-decoration: none; color: inherit; }
    }
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Blocos construtores de HTML
// ─────────────────────────────────────────────────────────────────────────────

/** Gera cabeçalho padrão Veritas Analytics */
export function buildHeader(opts: {
  modulo?: string;
  metodologia?: string;
  dataEmissao?: string;
}): string {
  const data = opts.dataEmissao ?? new Date().toLocaleDateString("pt-BR");
  return `
    <div class="report-header">
      <div class="brand">
        <div>
          <div class="brand-name">VERITAS ANALYTICS</div>
          <div class="brand-sub">Cálculos Judiciais Federais</div>
          ${opts.modulo ? `<div class="brand-sub" style="color:#4a6fa5;margin-top:1px;">${opts.modulo}</div>` : ""}
        </div>
      </div>
      <div class="doc-meta">
        <div><strong>Emitido em:</strong> ${data}</div>
        ${opts.metodologia ? `<div><strong>Metodologia:</strong> <span class="metodologia-badge">${opts.metodologia}</span></div>` : ""}
        <div style="font-size:6.5pt;color:#888;margin-top:2px;">
          Documento gerado automaticamente. Valores sujeitos à conferência judicial.
        </div>
      </div>
    </div>
  `;
}

/** Gera rodapé padrão */
export function buildFooter(opts?: { nota?: string }): string {
  return `
    <div class="report-footer">
      <span>Veritas Analytics — Cálculos Judiciais Federais</span>
      ${opts?.nota ? `<span>${opts.nota}</span>` : ""}
      <span>Página: <span class="page-num"></span></span>
    </div>
  `;
}

/** Gera bloco de título de seção numerada */
export function buildSectionTitle(numero: string | undefined, titulo: string): string {
  const prefix = numero ? `${numero}. ` : "";
  return `<div class="section-title">${prefix}${titulo}</div>`;
}

/**
 * Gera grade de campos de formulário.
 * Cada campo aceita span de 1 a 4 colunas.
 */
export function buildFieldGrid(fields: LaudoField[]): string {
  const items = fields
    .map((f) => {
      const spanClass = f.span && f.span > 1 ? ` span-${f.span}` : "";
      const destaqueClass = f.destaque ? " destaque" : "";
      const val = f.value == null || f.value === "" ? "—" : String(f.value);
      return `
        <div class="field-item${spanClass}${destaqueClass}">
          <span class="field-label">${f.label}</span>
          <span class="field-value">${val}</span>
        </div>
      `;
    })
    .join("");
  return `<div class="field-grid">${items}</div>`;
}

/**
 * Gera tabela HTML.
 * @param columns — definição de colunas (header + align + width)
 * @param rows    — array de arrays de strings (cada célula já formatada)
 * @param footer  — linha de totais opcional
 */
export function buildTable(
  columns: LaudoTableColumn[],
  rows: string[][],
  footer?: string[],
): string {
  const colgroup = columns
    .map((c) => (c.width ? `<col style="width:${c.width}">` : "<col>"))
    .join("");

  const thead = `
    <thead>
      <tr>
        ${columns.map((c) => `<th class="text-${c.align ?? "left"}">${c.header}</th>`).join("")}
      </tr>
    </thead>
  `;

  const tbody = `
    <tbody>
      ${rows
        .map(
          (row) =>
            `<tr>${row
              .map((cell, i) => `<td class="text-${columns[i]?.align ?? "left"}">${cell}</td>`)
              .join("")}</tr>`,
        )
        .join("")}
    </tbody>
  `;

  const tfoot = footer
    ? `<tfoot><tr>${footer.map((cell, i) => `<td class="text-${columns[i]?.align ?? "left"}">${cell}</td>`).join("")}</tr></tfoot>`
    : "";

  return `<table><colgroup>${colgroup}</colgroup>${thead}${tbody}${tfoot}</table>`;
}

/** Gera bloco de total destacado */
export function buildTotalBlock(label: string, value: number): string {
  return `
    <div class="total-block">
      <span class="label">${label}</span>
      <span class="value">${fmtR(value)}</span>
    </div>
  `;
}

/** Gera caixa de alerta amarelo */
export function buildAlertBox(mensagem: string): string {
  return `<div class="alert-box">⚠ ${mensagem}</div>`;
}

/** Gera caixa de informação azul */
export function buildInfoBox(mensagem: string): string {
  return `<div class="info-box">ℹ ${mensagem}</div>`;
}

/** Gera seção completa (título + corpo) */
export function buildSection(s: LaudoSection): string {
  const pageBreak = s.pageBreak ? ' section-break-before' : '';
  return `
    <div class="section${pageBreak}">
      ${buildSectionTitle(s.numero, s.titulo)}
      <div class="section-body">
        ${s.conteudo}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder principal — monta o documento HTML completo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gera o HTML completo do laudo pronto para impressão.
 * Abrir com openPrintWindow(html) para imprimir / salvar como PDF.
 */
export function buildLaudo(opts: LaudoOptions): string {
  const { titulo, subtitulo, identificacao, secoes, educacional, modulo, metodologia } = opts;

  const headerHtml = buildHeader({
    modulo,
    metodologia,
    dataEmissao: identificacao?.dataCalculo
      ? toBrDate(identificacao.dataCalculo)
      : new Date().toLocaleDateString("pt-BR"),
  });

  const titleHtml = `
    <div class="doc-title">${titulo}</div>
    ${subtitulo ? `<div class="doc-subtitle">${subtitulo}</div>` : ""}
  `;

  const secoesHtml = secoes.map(buildSection).join("\n");
  const footerHtml = buildFooter();
  const watermark = educacional
    ? `<div class="watermark">EDUCACIONAL</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
  <style>${getLaudoCss()}</style>
</head>
<body>
  ${watermark}
  ${headerHtml}
  ${titleHtml}
  ${secoesHtml}
  ${footerHtml}
  <script>
    // Numeração de páginas via CSS counter não funciona em todos os browsers,
    // este fallback usa window.print() com delay para garantir renderização.
    window.onload = function () {
      setTimeout(function () { window.print(); }, 300);
    };
  </script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitário de impressão
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Abre uma nova janela com o HTML do laudo e dispara a impressão.
 * Substituir no futuro por geração de PDF server-side via Puppeteer.
 */
export function openPrintWindow(html: string): void {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
