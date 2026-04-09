/**
 * Gerador de relatórios técnicos em HTML/PDF.
 * Layout jurídico-profissional conforme padrões da Justiça Federal.
 * PONTO DE HOMOLOGAÇÃO: O layout e conteúdo do relatório devem ser homologados.
 */

import type { CalculationResult } from "./calculator.js";
import type { Calculation } from "@workspace/db";

export function generateHTMLReport(
  calculation: Calculation,
  result: CalculationResult,
  publicKey: string
): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  const fmtPct = (n: number) => (n * 100).toFixed(6) + "%";
  const fmtFactor = (n: number) => n.toFixed(8);
  const fmtDate = (d: string) => {
    const [y, m] = d.split("-");
    return `${m}/${y}`;
  };

  const indexNames: Record<string, string> = {
    IPCA: "IPCA - Índice Nacional de Preços ao Consumidor Amplo",
    IPCA_E: "IPCA-E - IPCA Especial",
    INPC: "INPC - Índice Nacional de Preços ao Consumidor",
    SELIC: "SELIC - Taxa de Juros da Economia",
    TR: "TR - Taxa Referencial",
    MANUAL: "Manual",
  };

  const interestNames: Record<string, string> = {
    none: "Sem juros moratórios",
    simple_1_percent: "1% ao mês - Juros simples",
    compound_selic: "SELIC - Juros compostos (EC 113/2021)",
    compound_12_percent_year: "12% ao ano - Juros compostos",
    manual: "Manual",
  };

  const rows = result.indexTable.map((entry) => `
    <tr>
      <td class="period">${fmtDate(entry.period)}</td>
      <td class="rate">${fmtPct(entry.rate)}</td>
      <td class="factor">${fmtFactor(entry.accumulatedFactor)}</td>
      <td class="source">${entry.source}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Relatório de Atualização Monetária - ${calculation.title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', serif; font-size: 11pt; color: #1a1a1a; background: #fff; }
  .page { max-width: 210mm; margin: 0 auto; padding: 20mm 25mm; }
  
  .header { text-align: center; border-bottom: 3px solid #0d3b6e; padding-bottom: 16px; margin-bottom: 24px; }
  .header .logo-area { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 8px; }
  .header .shield { font-size: 2.5em; }
  .header h1 { font-size: 14pt; font-weight: bold; color: #0d3b6e; text-transform: uppercase; letter-spacing: 1px; }
  .header h2 { font-size: 11pt; font-weight: normal; color: #444; margin-top: 4px; }
  .header .subtitle { font-size: 9pt; color: #666; margin-top: 8px; font-style: italic; }
  
  .watermark-bar { background: #0d3b6e; color: #fff; text-align: center; padding: 6px; font-size: 9pt; font-weight: bold; letter-spacing: 2px; margin-bottom: 24px; }
  
  .section { margin-bottom: 20px; }
  .section-title { font-size: 11pt; font-weight: bold; color: #0d3b6e; text-transform: uppercase; border-bottom: 1px solid #0d3b6e; padding-bottom: 4px; margin-bottom: 12px; letter-spacing: 0.5px; }
  
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .info-row { display: flex; gap: 8px; margin-bottom: 4px; }
  .info-label { font-weight: bold; color: #444; min-width: 140px; }
  .info-value { color: #1a1a1a; }
  
  .result-box { background: #f0f4f8; border: 1px solid #0d3b6e; border-radius: 6px; padding: 16px; margin-bottom: 20px; }
  .result-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #dde3ea; }
  .result-row:last-child { border-bottom: none; font-weight: bold; font-size: 12pt; color: #0d3b6e; }
  .result-label { color: #555; }
  .result-value { font-weight: 600; }
  
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 8px; }
  thead { background: #0d3b6e; color: #fff; }
  th { padding: 8px 6px; text-align: left; font-weight: 600; font-size: 9pt; }
  td { padding: 5px 6px; border-bottom: 1px solid #e0e6ee; }
  tr:nth-child(even) { background: #f7f9fc; }
  .period { font-weight: 600; }
  .rate, .factor { font-family: 'Courier New', monospace; text-align: right; }
  .source { font-size: 8pt; color: #666; }
  
  .footer { margin-top: 32px; border-top: 2px solid #0d3b6e; padding-top: 16px; }
  .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 9pt; color: #555; }
  .hash-box { background: #f5f5f5; border: 1px solid #ccc; border-radius: 4px; padding: 8px; font-family: 'Courier New', monospace; font-size: 8pt; word-break: break-all; margin-top: 12px; }
  .key-box { background: #fffbf0; border: 2px solid #c8a400; border-radius: 6px; padding: 10px; text-align: center; margin-top: 12px; }
  .key-box .key-label { font-size: 9pt; color: #666; }
  .key-box .key-value { font-size: 13pt; font-weight: bold; color: #0d3b6e; letter-spacing: 2px; margin-top: 4px; }
  
  .disclaimer { font-size: 8pt; color: #888; text-align: center; font-style: italic; margin-top: 16px; }
  
  @media print {
    body { font-size: 10pt; }
    .page { padding: 15mm 20mm; }
  }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="logo-area">
      <span class="shield">⚖️</span>
      <div>
        <h1>Relatório de Atualização Monetária</h1>
        <h2>Veritas Analytics — Cálculo Judicial Federal</h2>
      </div>
    </div>
    <div class="subtitle">Veritas Analytics — Sistema de Cálculos Federais</div>
  </div>

  <div class="watermark-bar">DOCUMENTO TÉCNICO — USO RESTRITO PROCESSUAL</div>

  <div class="section">
    <div class="section-title">I. Identificação do Cálculo</div>
    <div class="info-grid">
      <div>
        <div class="info-row"><span class="info-label">Título:</span><span class="info-value">${calculation.title}</span></div>
        <div class="info-row"><span class="info-label">Processo nº:</span><span class="info-value">${calculation.processNumber || "Não informado"}</span></div>
        <div class="info-row"><span class="info-label">Parte/Autor:</span><span class="info-value">${calculation.claimantName || "Não informado"}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Data do processamento:</span><span class="info-value">${new Date(result.computedAt).toLocaleString("pt-BR")}</span></div>
        <div class="info-row"><span class="info-label">Status:</span><span class="info-value">Calculado</span></div>
        ${calculation.notes ? `<div class="info-row"><span class="info-label">Observações:</span><span class="info-value">${calculation.notes}</span></div>` : ""}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">II. Parâmetros do Cálculo</div>
    <div class="info-grid">
      <div>
        <div class="info-row"><span class="info-label">Índice de correção:</span><span class="info-value">${indexNames[result.correctionIndex] || result.correctionIndex}</span></div>
        <div class="info-row"><span class="info-label">Regra de juros:</span><span class="info-value">${interestNames[result.interestRule] || result.interestRule}</span></div>
        <div class="info-row"><span class="info-label">Fonte dos dados:</span><span class="info-value">${result.dataSource}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Data inicial:</span><span class="info-value">${fmtDate(result.startDate.substring(0, 7))}</span></div>
        <div class="info-row"><span class="info-label">Data final:</span><span class="info-value">${fmtDate(result.endDate.substring(0, 7))}</span></div>
        <div class="info-row"><span class="info-label">Total de competências:</span><span class="info-value">${result.totalMonths} meses</span></div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">III. Resultado do Cálculo</div>
    <div class="result-box">
      <div class="result-row"><span class="result-label">Valor original:</span><span class="result-value">${fmt(result.originalValue)}</span></div>
      <div class="result-row"><span class="result-label">Fator de atualização acumulado:</span><span class="result-value">${fmtFactor(result.accumulatedFactor)}</span></div>
      <div class="result-row"><span class="result-label">Valor corrigido (principal atualizado):</span><span class="result-value">${fmt(result.correctedValue)}</span></div>
      <div class="result-row"><span class="result-label">Juros moratórios:</span><span class="result-value">${fmt(result.interestValue)}</span></div>
      <div class="result-row"><span class="result-label">VALOR FINAL ATUALIZADO:</span><span class="result-value">${fmt(result.finalValue)}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">IV. Memória de Cálculo — Evolução Mensal dos Índices</div>
    <table>
      <thead>
        <tr>
          <th>Competência</th>
          <th style="text-align:right">Taxa Mensal</th>
          <th style="text-align:right">Fator Acumulado</th>
          <th>Fonte Oficial</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <div class="footer-grid">
      <div>
        <strong>Chave de Recuperação</strong>
        <div class="key-box">
          <div class="key-label">Utilize esta chave para recuperar e recalcular:</div>
          <div class="key-value">${publicKey}</div>
        </div>
      </div>
      <div>
        <strong>Integridade do Documento</strong>
        <div style="font-size:9pt;color:#555;margin-top:8px;">Hash SHA-256 do cálculo:</div>
        <div class="hash-box">${result.integrityHash}</div>
      </div>
    </div>
    <div class="disclaimer">
      Este relatório foi gerado automaticamente pelo sistema Veritas Analytics.<br>
      Os valores apresentados estão sujeitos à homologação judicial. Dados de índices obtidos de fontes oficiais (IBGE/BCB).<br>
      PONTO DE HOMOLOGAÇÃO: Verificar aderência ao Manual de Cálculos da Justiça Federal antes do uso processual.
    </div>
  </div>

</div>
</body>
</html>`;
}
