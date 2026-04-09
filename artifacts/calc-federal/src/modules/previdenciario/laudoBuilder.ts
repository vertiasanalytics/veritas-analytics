/**
 * laudoBuilder.ts — Gerador de laudo HTML do módulo Previdenciário — Liquidação de Sentença
 *
 * ⚠ FUNÇÃO PURA — sem React, DOM ou efeitos colaterais.
 *   Recebe os dados do cálculo e retorna uma string HTML completa e auto-suficiente,
 *   pronta para ser escrita em uma janela de impressão.
 *
 * Uso na página:
 *   const html = buildLaudoPrevidenciario({ cfg, result, user, juros, prescricao, ... });
 *   const w = window.open("", "_blank", "width=1050,height=800,scrollbars=yes");
 *   w.document.write(html);
 *   w.document.close();
 */

import { fmtMes, getTetoInss } from "./engine";
import type {
  BenefitConfig, CalcResult, JurosConfig, PrescricaoConfig,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Tipo de entrada
// ─────────────────────────────────────────────────────────────────────────────

export interface LaudoPrevidenciarioParams {
  cfg:       BenefitConfig;
  result:    CalcResult;
  user:      { nome?: string; email?: string } | null;
  juros:     JurosConfig;
  prescricao: PrescricaoConfig;
  /** Rótulo da regra constitucional aplicável: "Pré-EC 103/2019" | "Pós-EC 103/2019" */
  regra:     string;
  /** Nome do índice de correção selecionado (ex.: "IPCA-E") */
  nomeIndice: string;
  /** Tempo de contribuição formatado (ex.: "32 anos, 4 meses, 5 dias") */
  tcStr:     string;
  /** Timestamp formatado (pt-BR) */
  agora:     string;
  logoUrl:   string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatação de valor monetário (BRL) usada apenas neste laudo
// ─────────────────────────────────────────────────────────────────────────────

function fmtV(v: number): string {
  return "R$ " + Math.abs(v).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS compartilhado (idêntico ao original da página)
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; font-size: 10pt; color: #1e293b; background: #fff; }
  .hdr { background: #0f2a4a; color: #fff; padding: 14px 28px 12px; display: flex; align-items: center; gap: 16px; }
  .hdr-logo-img { height: 56px; width: auto; object-fit: contain; flex-shrink: 0; display: block; }
  .hdr-logo { display: flex; flex-direction: column; }
  .hdr-brand { font-family: 'Cinzel', serif; font-size: 18pt; font-weight: 700; letter-spacing: .05em; color: #fff; }
  .hdr-sub { font-size: 8pt; color: #93c5fd; letter-spacing: .12em; text-transform: uppercase; margin-top: 2px; }
  .hdr-meta { margin-left: auto; text-align: right; font-size: 8pt; color: #bfdbfe; line-height: 1.6; }
  .laudo-title-bar { background: #1e3a5f; color: #fff; padding: 10px 28px; display: flex; align-items: center; justify-content: space-between; }
  .laudo-title { font-family: 'Cinzel', serif; font-size: 12pt; font-weight: 600; letter-spacing: .06em; }
  .laudo-num { font-size: 8pt; color: #93c5fd; }
  .page { padding: 20px 28px 28px; }
  .section { margin-bottom: 20px; }
  .section-title { font-family: 'Cinzel', serif; font-size: 10pt; font-weight: 600; color: #0f2a4a; border-bottom: 2px solid #0f2a4a; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: .08em; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 20px; }
  .field { display: flex; flex-direction: column; }
  .field label { font-size: 7.5pt; color: #64748b; text-transform: uppercase; letter-spacing: .06em; }
  .field span  { font-size: 9.5pt; font-weight: 500; color: #0f172a; margin-top: 1px; }
  .kpi-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 6px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; }
  .kpi.primary { background: #0f2a4a; border-color: #0f2a4a; color: #fff; }
  .kpi.green   { background: #16a34a; border-color: #16a34a; color: #fff; }
  .kpi label { display: block; font-size: 7pt; text-transform: uppercase; letter-spacing: .06em; opacity: .75; }
  .kpi .val { font-size: 12pt; font-weight: 700; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 8pt; }
  th { background: #1e3a5f; color: #fff; padding: 5px 6px; text-align: left; font-weight: 600; white-space: nowrap; font-size: 7.5pt; }
  td { padding: 4px 6px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  tr:nth-child(even) td { background: #f8fafc; }
  tr.quitado td { color: #94a3b8; }
  .r { text-align: right; font-variant-numeric: tabular-nums; }
  .c { text-align: center; }
  .bold { font-weight: 600; }
  .muted { color: #94a3b8; }
  .ok { color: #15803d; }
  .deb { color: #dc2626; }
  .ftr { border-top: 1px solid #e2e8f0; padding: 10px 28px; font-size: 7.5pt; color: #94a3b8; display: flex; justify-content: space-between; margin-top: 8px; }
  .ftr strong { color: #475569; }
  .btn-print { display: block; margin: 10px auto 0; padding: 8px 24px; background: #0f2a4a; color: #fff; border: none; border-radius: 6px; font-family: 'Inter', sans-serif; font-size: 10pt; font-weight: 600; cursor: pointer; letter-spacing: .03em; }
  .btn-print:hover { background: #1e3a5f; }
  @media print {
    .btn-print { display: none !important; }
    body { font-size: 9pt; }
    .hdr, .laudo-title-bar, th, .kpi.primary, .kpi.green { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { margin: 10mm 12mm; size: A4 landscape; }
  }`;

// ─────────────────────────────────────────────────────────────────────────────
// Builder principal
// ─────────────────────────────────────────────────────────────────────────────

export function buildLaudoPrevidenciario(p: LaudoPrevidenciarioParams): string {
  const { cfg, result, user, juros, prescricao, regra, nomeIndice, tcStr, agora, logoUrl } = p;

  // ── Data de referência para teto ────────────────────────────────────────
  const dataRefTeto = cfg.dib || cfg.der || cfg.dataCalculo;

  // ── Formatação de datas BR ───────────────────────────────────────────────
  const brDate = (s: string) =>
    s ? new Date(s + "T12:00:00").toLocaleDateString("pt-BR") : "—";

  // ── Linhas da tabela de salários corrigidos ──────────────────────────────
  const hasMoedaConversao = result.salariosCorrigidos.some((s) => s.fatorMoeda > 1);
  const rowsSal = result.salariosCorrigidos.map((s) => `
    <tr>
      <td>${fmtMes(s.competencia)}</td>
      <td class="r">${s.fatorMoeda > 1
        ? s.valorOriginal.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
        : fmtV(s.valorOriginal)}</td>
      ${hasMoedaConversao
        ? `<td class="c" style="font-size:9px;color:${s.fatorMoeda > 1 ? "#b45309" : "#64748b"}">${s.moeda.split(" ")[0]}</td><td class="r">${fmtV(s.valorEmReal)}</td>`
        : ""}
      <td class="r">${s.indice}</td>
      <td class="r">${s.fatorCorrecao.toLocaleString("pt-BR", { minimumFractionDigits: 6, maximumFractionDigits: 6 })}</td>
      <td class="r ${s.considerado ? "bold" : "muted"}">${fmtV(s.valorCorrigido)}</td>
      <td class="c">${s.considerado ? "✓" : "—"}</td>
    </tr>`).join("");

  // ── Linhas da tabela de atrasados ────────────────────────────────────────
  const rowsAtr = result.atrasados.map((r) => `
    <tr class="${r.diferenca <= 0 ? "quitado" : ""}">
      <td title="${r.origemValorBase}">${fmtMes(r.competencia)}${
        r.origemValorBase && r.origemValorBase !== "RMI inicial"
          ? ' <sup style="color:#7c3aed;font-size:7pt">▲</sup>'
          : ""}</td>
      <td class="r" title="${r.origemValorBase}">${fmtV(r.valorDevido)}</td>
      <td class="r">${fmtV(r.valorPago)}</td>
      <td class="r ${r.diferenca > 0 ? "deb" : "ok"}">${fmtV(r.diferenca)}</td>
      <td class="r" style="font-family:monospace;font-size:8pt;color:#64748b">${r.diferenca > 0 ? r.fatorCorrecao.toFixed(6) : "—"}</td>
      <td class="r">${r.diferenca > 0 ? fmtV(r.valorCorrigido) : "—"}</td>
      <td class="r">${fmtV(r.juros)}</td>
      <td class="r bold">${fmtV(r.totalAtualizado)}</td>
      <td class="c">${r.observacao}</td>
    </tr>`).join("");

  // ── Teto previdenciário ──────────────────────────────────────────────────
  const tetoLabel = (() => {
    if (!cfg.aplicarTeto) return "Não aplicado";
    const ti = getTetoInss(dataRefTeto);
    const leg = ti ? ` — ${ti.legislacao} (vigência: ${fmtMes(ti.vigencia)})` : "";
    return fmtV(cfg.tetoRmi) + leg;
  })();

  // ── Juros moratórios ─────────────────────────────────────────────────────
  const jurosLabel = juros.tipo === "nenhum"
    ? "Não aplicados"
    : `${juros.tipo === "simples" ? "Simples" : "Compostos"} — ${(juros.taxaMensal * 100).toFixed(2)}% a.m.`;
  const jurosTermoLabel = juros.tipo === "nenhum"
    ? "—"
    : juros.termoInicial === "competencia"
    ? "Da competência"
    : `Da citação (${juros.dataCitacao ? brDate(juros.dataCitacao) : "—"})`;
  const prescricaoLabel = prescricao.aplicar
    ? `Aplicada — Marco: ${prescricao.marcoInterruptivo ? brDate(prescricao.marcoInterruptivo) : "—"} (${prescricao.anos} anos)`
    : "Não aplicada";
  const rmiCriterioLabel = cfg.usarRmiManual ? "RMI manual"
    : cfg.usarMedia80 ? "Média dos 80% maiores SB"
    : "Média de todos os SB";

  // ── Montagem final ────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Laudo de Liquidação Previdenciária — ${cfg.nome || "Segurado"}</title>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>

<div class="hdr">
  <img src="${logoUrl}" alt="Veritas Analytics" class="hdr-logo-img" onerror="this.style.display='none'">
  <div class="hdr-logo">
    <div class="hdr-brand">VERITAS ANALYTICS</div>
    <div class="hdr-sub">Plataforma de Cálculos Judiciais Federais</div>
  </div>
  <div class="hdr-meta">
    <div><strong style="color:#fff">Emitido em:</strong> ${agora}</div>
    <div>Usuário: ${user?.nome ?? user?.email ?? "—"}</div>
    <div>CJF — Manual 2025</div>
  </div>
</div>

<div class="laudo-title-bar">
  <div class="laudo-title">Laudo de Liquidação de Sentença — Benefício Previdenciário</div>
  <div class="laudo-num" id="laudo-chave">Chave: carregando…</div>
</div>

<div class="page">

  <div class="section">
    <div class="section-title">I — Dados do Segurado e do Benefício</div>
    <div class="grid2" style="margin-bottom:8px">
      <div class="field"><label>Segurado</label><span>${cfg.nome || "—"}</span></div>
      <div class="field"><label>Espécie</label><span>${cfg.especie}</span></div>
      <div class="field"><label>Nº do Benefício (NB)</label><span>${cfg.nb || "—"}</span></div>
      <div class="field"><label>Regra Aplicável</label><span>${regra}</span></div>
    </div>
    <div class="grid3">
      <div class="field"><label>Data de Início do Benefício (DIB)</label><span>${brDate(cfg.dib)}</span></div>
      <div class="field"><label>Data de Início do Pagamento (DIP)</label><span>${brDate(cfg.dip)}</span></div>
      <div class="field"><label>Data de Entrada do Requerimento (DER)</label><span>${brDate(cfg.der)}</span></div>
      <div class="field"><label>Data da Sentença</label><span>${brDate(cfg.dataSentenca)}</span></div>
      <div class="field"><label>Data-base do Cálculo</label><span>${brDate(cfg.dataCalculo)}</span></div>
      <div class="field"><label>Tempo de Contribuição</label><span>${tcStr}</span></div>
      <div class="field"><label>Coeficiente da RMI</label><span>${(cfg.coeficienteRmi * 100).toFixed(0)}%</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">II — Parâmetros de Atualização</div>
    <div class="grid3">
      <div class="field"><label>Índice de Correção</label><span>${nomeIndice}</span></div>
      <div class="field"><label>Juros Moratórios</label><span>${jurosLabel}</span></div>
      <div class="field"><label>Termo Inicial dos Juros</label><span>${jurosTermoLabel}</span></div>
      <div class="field"><label>Prescrição Quinquenal</label><span>${prescricaoLabel}</span></div>
      <div class="field"><label>Critério da RMI</label><span>${rmiCriterioLabel}</span></div>
      <div class="field"><label>Teto Previdenciário</label><span>${tetoLabel}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">III — Apuração do Benefício</div>
    <div class="kpi-row">
      <div class="kpi"><label>Salário de Benefício (SB)</label><div class="val">${fmtV(result.sb)}</div></div>
      <div class="kpi"><label>RMI (Renda Mensal Inicial)</label><div class="val">${fmtV(result.rmi)}</div></div>
      <div class="kpi"><label>RMA (Renda Mensal Atual)</label><div class="val">${fmtV(result.rmaAtual)}</div></div>
      <div class="kpi"><label>Total Bruto de Atrasados</label><div class="val">${fmtV(result.totalBruto)}</div></div>
    </div>
    <div class="kpi-row">
      <div class="kpi"><label>Total Corrigido (sem juros)</label><div class="val">${fmtV(result.totalCorrigido)}</div></div>
      <div class="kpi"><label>Total de Juros</label><div class="val">${fmtV(result.totalJuros)}</div></div>
      <div class="kpi primary"><label>Total Atualizado (Principal)</label><div class="val">${fmtV(result.totalAtualizado)}</div></div>
      <div class="kpi green"><label>Valor Total da Execução</label><div class="val">${fmtV(result.totalAtualizado)}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">IV — Salários de Contribuição Corrigidos</div>
    <table>
      <thead><tr>
        <th>Competência</th>
        <th class="r">Sal. Original</th>
        ${hasMoedaConversao ? '<th class="c">Moeda</th><th class="r">Em Real (R$)</th>' : ""}
        <th class="r">Índice</th>
        <th class="r">Fator Correção</th>
        <th class="r">Sal. Corrigido</th>
        <th class="c">Considerado</th>
      </tr></thead>
      <tbody>${rowsSal}</tbody>
    </table>
    ${hasMoedaConversao ? '<p style="font-size:9px;color:#78716c;margin-top:4px">(*) Salários em moeda histórica convertidos para Real conforme tabela de equivalência monetária (MP 542/1994 e legislação específica de cada Plano Econômico).</p>' : ""}
  </div>

  <div class="section">
    <div class="section-title">V — Demonstrativo de Atrasados por Competência</div>
    <table>
      <thead><tr>
        <th>Competência</th>
        <th class="r">Valor Devido</th>
        <th class="r">Valor Pago</th>
        <th class="r">Diferença</th>
        <th class="r">Fator Correção</th>
        <th class="r">Corrigido</th>
        <th class="r">Juros</th>
        <th class="r">Total Atualizado</th>
        <th class="c">Situação</th>
      </tr></thead>
      <tbody>${rowsAtr}</tbody>
      <tfoot>
        <tr style="background:#f0f4ff">
          <td colspan="3" class="bold">TOTAIS</td>
          <td class="r bold">${fmtV(result.totalBruto)}</td>
          <td class="r">—</td>
          <td class="r bold">${fmtV(result.totalCorrigido)}</td>
          <td class="r bold">${fmtV(result.totalJuros)}</td>
          <td class="r bold" style="color:#0f2a4a">${fmtV(result.totalAtualizado)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  </div>

</div>

<div class="ftr">
  <div><strong>Veritas Analytics</strong> — Plataforma de Cálculos Judiciais Federais · CJF 2025</div>
  <div>Documento gerado automaticamente em ${agora} · Não dispensa análise profissional</div>
</div>

<div style="padding:12px 28px 20px; text-align:center">
  <button class="btn-print" onclick="window.print()">⊕ Imprimir / Salvar PDF</button>
</div>

</body>
</html>`;
}
