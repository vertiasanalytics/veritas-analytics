/**
 * laudoBuilder.ts — Gerador de laudo HTML do módulo Valor da Causa Previdenciária
 *
 * ⚠ FUNÇÃO PURA — sem React, DOM ou efeitos colaterais.
 *   Recebe os dados do cálculo e retorna uma string HTML completa e auto-suficiente,
 *   pronta para ser escrita em uma janela de impressão.
 *
 * Uso na página:
 *   const html = buildLaudoValorCausa({ form, result, user, corrMap, chave, agora, logoUrl });
 *   const w = window.open("", "_blank", "width=1100,height=900,scrollbars=yes");
 *   w.document.write(html);
 *   w.document.close();
 */

import { fmtR, toBrDate } from "@/lib/engines/dateUtils";
import { criterioToKey, parseIso }  from "./utils";
import { calcItem }                  from "./engine";
import type { FormState, ResultadoCalculo, GrupoItem } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de entrada
// ─────────────────────────────────────────────────────────────────────────────

export interface LaudoValorCausaParams {
  form:             FormState;
  result:           ResultadoCalculo;
  user:             { nome?: string; email?: string } | null;
  /** Mapa de fatores de correção acumulados: YM → fator */
  corrMap:          Map<string, number>;
  chaveRecuperacao: string | null;
  /** Timestamp formatado (pt-BR) */
  agora:            string;
  logoUrl:          string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS compartilhado (idêntico ao original da página)
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', sans-serif; font-size: 10pt; color: #1e293b; background: #fff; }
.hdr { background: #0f2a4a; color: #fff; padding: 14px 28px 12px; display: flex; align-items: center; gap: 16px; }
.hdr-logo-img { height: 56px; width: auto; object-fit: contain; flex-shrink: 0; display: block; }
.hdr-brand { font-family: 'Cinzel', serif; font-size: 18pt; font-weight: 700; letter-spacing: .05em; color: #fff; }
.hdr-sub { font-size: 8pt; color: #93c5fd; letter-spacing: .12em; text-transform: uppercase; margin-top: 2px; }
.hdr-meta { margin-left: auto; text-align: right; font-size: 8pt; color: #bfdbfe; line-height: 1.6; }
.laudo-title-bar { background: #1e3a5f; color: #fff; padding: 10px 28px; display: flex; align-items: center; justify-content: space-between; }
.laudo-title { font-family: 'Cinzel', serif; font-size: 12pt; font-weight: 600; letter-spacing: .06em; }
.laudo-num { font-size: 8pt; color: #93c5fd; }
.badge-base { display: inline-block; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 4px; padding: 2px 8px; font-size: 7.5pt; font-weight: 600; margin-bottom: 10px; }
.page { padding: 20px 28px 28px; }
.section { margin-bottom: 20px; }
.section-title { font-family: 'Cinzel', serif; font-size: 10pt; font-weight: 600; color: #0f2a4a; border-bottom: 2px solid #0f2a4a; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: .08em; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
.grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 20px; }
.field { display: flex; flex-direction: column; padding-bottom: 4px; }
.field label { font-size: 7.5pt; color: #64748b; text-transform: uppercase; letter-spacing: .06em; }
.field span { font-size: 9.5pt; font-weight: 500; color: #0f172a; margin-top: 1px; }
.kpi-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 12px; }
.kpi { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; }
.kpi.primary { background: #0f2a4a; border-color: #0f2a4a; color: #fff; }
.kpi.green { background: #16a34a; border-color: #16a34a; color: #fff; }
.kpi.red { background: #dc2626; border-color: #dc2626; color: #fff; }
.kpi label { display: block; font-size: 7pt; text-transform: uppercase; letter-spacing: .06em; opacity: .75; }
.kpi .val { font-size: 12pt; font-weight: 700; margin-top: 2px; }
.alerta-subsidiario { background: #fefce8; border: 1px solid #facc15; border-radius: 6px; padding: 6px 10px; font-size: 8pt; color: #713f12; margin-bottom: 10px; }
table { width: 100%; border-collapse: collapse; font-size: 8pt; }
th { background: #1e3a5f; color: #fff; padding: 5px 6px; text-align: left; font-weight: 600; white-space: nowrap; font-size: 7.5pt; }
td { padding: 4px 6px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
tr:nth-child(even) td { background: #f8fafc; }
.r { text-align: right; font-variant-numeric: tabular-nums; }
.bold { font-weight: 600; }
.ok { color: #15803d; } .deb { color: #dc2626; }
.ftr { border-top: 1px solid #e2e8f0; padding: 10px 28px; font-size: 7.5pt; color: #94a3b8; display: flex; justify-content: space-between; margin-top: 8px; }
.ftr strong { color: #475569; }
.btn-print { display: block; margin: 10px auto 0; padding: 8px 24px; background: #0f2a4a; color: #fff; border: none; border-radius: 6px; font-family: 'Inter', sans-serif; font-size: 10pt; font-weight: 600; cursor: pointer; }
.btn-print:hover { background: #1e3a5f; }
@media print {
  .btn-print { display: none !important; }
  body { font-size: 9pt; }
  .hdr, .laudo-title-bar, th, .kpi.primary, .kpi.green, .kpi.red { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { margin: 10mm 12mm; size: A4 portrait; }
}`;

// ─────────────────────────────────────────────────────────────────────────────
// Builder principal
// ─────────────────────────────────────────────────────────────────────────────

export function buildLaudoValorCausa(p: LaudoValorCausaParams): string {
  const { form, result, user, corrMap, chaveRecuperacao, agora, logoUrl } = p;
  const ck = criterioToKey(form.criterioCorrecao);

  // ── Labels ──────────────────────────────────────────────────────────────────
  const naturezaLabel = form.naturezaSegurado === "rural" ? "Rural" : "Urbano";
  const situacaoLabel = form.naturezaSegurado === "rural" ? "—" :
    form.situacaoBeneficio === "concedido" ? "Benefício concedido" : "Ação de concessão / revisão";
  const origemLabel = form.naturezaSegurado === "rural" ? "Salário mínimo histórico" :
    form.origemBase === "rmi" ? "RMI informada" :
    form.origemBase === "contribuicoes" ? "Contribuições do segurado" : "Salário mínimo subsidiário";

  // ── Seção de itens (abatimentos / créditos) ──────────────────────────────
  const GRUPO_LABEL: Record<GrupoItem, string> = {
    beneficio_recebido: "Benefício Recebido",
    outro_credito:      "Outro Crédito",
    outro_desconto:     "Outro Desconto",
  };
  const ajuizDate = parseIso(form.dataAjuizamento);
  const itensHtml = form.itens.length
    ? form.itens.map((item) => {
        const val  = calcItem(item, ajuizDate, corrMap);
        const sinal = item.tipo === "outro_credito" ? "+" : "−";
        return `<tr>
          <td>${GRUPO_LABEL[item.tipo]}</td>
          <td>${item.descricao || "—"}</td>
          <td class="r">${item.tipo === "beneficio_recebido"
            ? `${fmtR(item.rmi ?? 0)} × ${item.dataInicio ? toBrDate(item.dataInicio) : "?"} a ${item.dataFim ? toBrDate(item.dataFim) : "?"}`
            : fmtR((item.valor ?? 0) + (item.juros ?? 0) + (item.selic ?? 0))}</td>
          <td class="r ${item.tipo === "outro_credito" ? "ok" : "deb"} bold">${sinal} ${fmtR(val)}</td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:10px">Nenhum abatimento ou crédito adicional cadastrado</td></tr>`;

  // ── Parcelas vencidas ────────────────────────────────────────────────────
  const parcelasHtml = result.parcelasVencidas.map((p) => {
    if (p.is13o) {
      return `<tr style="background:#fffbeb;border-top:1px solid #fde68a">
        <td class="r bold" style="color:#b45309">${p.competencia}</td>
        <td class="r bold" style="color:#b45309">${fmtR(p.valorBase)}</td>
        <td style="font-size:7.5pt;color:#d97706;max-width:130px">${p.detalhes13o ?? p.origemValorBase}</td>
        <td class="r bold" style="color:#b45309;font-size:7.5pt">${p.reajustePrevPct}</td>
        <td class="r" style="color:#64748b">${p.fatorCorrecao.toFixed(6)}</td>
        <td class="r bold" style="color:#b45309">${fmtR(p.valorCorrigido)}</td>
      </tr>`;
    }
    const isReaj = p.reajustePrevPct !== "—";
    return `<tr>
      <td class="r">${p.competencia}</td>
      <td class="r">${fmtR(p.valorBase)}</td>
      <td style="font-size:7.5pt;color:#64748b;max-width:130px">${p.origemValorBase}</td>
      <td class="r" style="color:${isReaj ? "#7c3aed" : "#94a3b8"};font-size:7.5pt">${p.reajustePrevPct}</td>
      <td class="r">${p.fatorCorrecao.toFixed(6)}</td>
      <td class="r bold">${fmtR(p.valorCorrigido)}</td>
    </tr>`;
  }).join("");

  // ── Bloco de RMI estimada ────────────────────────────────────────────────
  const rmiInfoHtml = result.rmiEstimada
    ? `<div class="field"><label>SB Estimado (média contrib.)</label><span>${fmtR(result.sbEstimado ?? 0)}</span></div>
       <div class="field"><label>RMI Estimada (coef. ${(form.coeficiente * 100).toFixed(0)}%)</label><span>${fmtR(result.rmiEstimada)}</span></div>`
    : form.naturezaSegurado === "urbano" && form.rmi > 0
    ? `<div class="field"><label>RMI utilizada</label><span>${fmtR(form.rmi)}</span></div>` : "";

  // ── Alerta subsidiário ───────────────────────────────────────────────────
  const alertaHtml = result.temAlertaSubsidiario
    ? `<div class="alerta-subsidiario">⚠ Base urbana sem histórico contributivo. Aplicado salário mínimo como critério subsidiário (art. 203, CF/88 c/c art. 39, I, Lei 8.213/91).</div>`
    : "";

  // ── Fundamento legal da correção (unifásico vs bifásico) ─────────────────
  const isBifasica = form.usarSelicPosEC113 && ck !== "SELIC";
  const correcaoFundHtml = isBifasica ? `
    <tr>
      <td style="border:1px solid #e2e8f0;padding:5px 8px;font-weight:600;color:#0f172a">Fase 1</td>
      <td style="border:1px solid #e2e8f0;padding:5px 8px;color:#475569">Competências até 11/2021</td>
      <td style="border:1px solid #e2e8f0;padding:5px 8px;font-weight:600;color:#1e40af">${form.criterioCorrecao}</td>
      <td style="border:1px solid #e2e8f0;padding:5px 8px;color:#475569">Art. 1º-F da Lei 9.494/97 (red. Lei 11.960/2009) · Tema 905 STJ/STF · Manual CJF 2025</td>
      <td style="border:1px solid #e2e8f0;padding:5px 8px;color:#64748b">IBGE — Sistema SIDRA</td>
    </tr>
    <tr>
      <td style="border:1px solid #e2e8f0;padding:5px 8px;font-weight:600;color:#0f172a">Fase 2</td>
      <td style="border:1px solid #e2e8f0;padding:5px 8px;color:#475569">A partir de 12/2021</td>
      <td style="border:1px solid #e2e8f0;padding:5px 8px;font-weight:600;color:#6d28d9">SELIC</td>
      <td style="border:1px solid #e2e8f0;padding:5px 8px;color:#475569">EC 113/2021, art. 3º · Art. 3º da Lei 14.905/2024 · Manual CJF 2025</td>
      <td style="border:1px solid #e2e8f0;padding:5px 8px;color:#64748b">BCB — SGS série 4390</td>
    </tr>` : `
    <tr>
      <td style="border:1px solid #e2e8f0;padding:5px 8px;font-weight:600;color:#0f172a">Unifásico</td>
      <td style="border:1px solid #e2e8f0;padding:5px 8px;color:#475569">Período integral (DIB → ajuizamento)</td>
      <td style="border:1px solid #e2e8f0;padding:5px 8px;font-weight:600;color:#1e40af">${form.criterioCorrecao}</td>
      <td style="border:1px solid #e2e8f0;padding:5px 8px;color:#475569">${
        ck === "SELIC" ? "EC 113/2021 · Art. 3º da Lei 14.905/2024"
        : ck === "INPC" ? "Art. 41-A, Lei 8.213/91 · Manual CJF 2025"
        : "Art. 1º-F da Lei 9.494/97 · Tema 905 STJ/STF"}</td>
      <td style="border:1px solid #e2e8f0;padding:5px 8px;color:#64748b">${
        ck === "SELIC" ? "BCB — SGS série 4390" : "IBGE — Sistema SIDRA"}</td>
    </tr>`;

  const decimos13Qtd = result.parcelasVencidas.filter((px) => px.is13o).length;

  // ── Observações ──────────────────────────────────────────────────────────
  const fluxoCriterio = isBifasica
    ? `${form.criterioCorrecao} até 11/2021 + SELIC a partir de 12/2021 — EC 113/2021`
    : form.criterioCorrecao;

  // ── Montagem final ────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Laudo de Cálculo do Valor da Causa — ${form.autorNome || "Parte Autora"}</title>
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
  <div class="laudo-title">Laudo de Cálculo do Valor da Causa — Módulo Previdenciário</div>
  <div class="laudo-num" id="laudo-chave">Chave: ${chaveRecuperacao ?? "carregando…"}</div>
</div>

<div class="page">

  <div class="badge-base">${result.badgeBase}</div>
  ${alertaHtml}

  <div class="kpi-row">
    <div class="kpi"><label>Benefícios Devidos (corrigidos)</label><div class="val">${fmtR(result.totalVencidasCorrigidas)}</div></div>
    <div class="kpi"><label>Parcelas Vincendas</label><div class="val">${fmtR(result.totalVincendas)}</div></div>
    <div class="kpi red"><label>Total Abatimentos</label><div class="val">${fmtR(result.totalAbatimentos)}</div></div>
    <div class="kpi green"><label>Valor da Causa Final</label><div class="val">${fmtR(result.valorCausaFinal)}</div></div>
  </div>

  <div class="section">
    <div class="section-title">I — Dados do Processo</div>
    <div class="grid2" style="margin-bottom:8px">
      <div class="field"><label>Número do Processo</label><span>${form.processoNumero || "—"}</span></div>
      <div class="field"><label>Data de Ajuizamento</label><span>${toBrDate(form.dataAjuizamento)}</span></div>
      <div class="field"><label>Autor / Exequente</label><span>${form.autorNome || "—"}</span></div>
      <div class="field"><label>CPF</label><span>${form.autorCpf || "—"}</span></div>
    </div>
    <div class="grid3">
      <div class="field"><label>Espécie do Benefício</label><span>${form.especie || "—"}</span></div>
      <div class="field"><label>Percentual de Acordo</label><span>${form.percentualAcordo}%</span></div>
      <div class="field"><label>Parcelas Vincendas</label><span>${form.parcelasVincendas} meses</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">II — Natureza Previdenciária e Base de Cálculo</div>
    <div class="grid3">
      <div class="field"><label>Natureza do Segurado</label><span>${naturezaLabel}</span></div>
      <div class="field"><label>Situação do Benefício</label><span>${situacaoLabel}</span></div>
      <div class="field"><label>Origem da Base</label><span>${origemLabel}</span></div>
    </div>
    <p style="font-size:8.5pt;color:#475569;margin-top:8px;line-height:1.55">${result.metodologiaBase}</p>
  </div>

  <div class="section">
    <div class="section-title">III — Dados do Benefício</div>
    <div class="grid3">
      <div class="field"><label>DIB</label><span>${toBrDate(form.dib)}</span></div>
      <div class="field"><label>DIP</label><span>${toBrDate(form.dip)}</span></div>
      <div class="field"><label>DER</label><span>${toBrDate(form.der)}</span></div>
      <div class="field"><label>Data da Sentença</label><span>${toBrDate(form.dataSentenca)}</span></div>
      <div class="field"><label>Data-base da Liquidação</label><span>${toBrDate(form.dataBaseCalculo)}</span></div>
      <div class="field"><label>RMA</label><span>${form.rma ? fmtR(form.rma) : "—"}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">IV — Parâmetros do Cálculo</div>
    <div class="grid3">
      ${rmiInfoHtml}
      <div class="field"><label>Critério de Correção</label><span>${form.criterioCorrecao}</span></div>
      <div class="field"><label>SELIC pós EC 113/2021</label><span>${form.usarSelicPosEC113 ? "Sim" : "Não"}</span></div>
      <div class="field"><label>Meses Vencidos</label><span>${result.mesesVencidos}</span></div>
      <div class="field"><label>Total Vencidas (base)</label><span>${fmtR(result.totalVencidasBase)}</span></div>
      <div class="field"><label>Total Vencidas (corrigidas)</label><span>${fmtR(result.totalVencidasCorrigidas)}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">V — Abatimentos e Créditos Adicionais</div>
    <table>
      <thead><tr><th>Grupo</th><th>Descrição</th><th class="r">Base / Valor</th><th class="r">Valor Apurado</th></tr></thead>
      <tbody>${itensHtml}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">VI — Apuração Sintética</div>
    <table>
      <tbody>
        <tr><td class="bold">Benefícios devidos (corrigidos)</td><td class="r">${fmtR(result.totalVencidasCorrigidas)}</td><td class="bold">Vincendas (${form.parcelasVincendas}× RMA ${fmtR(result.rmaFinal)})</td><td class="r">${fmtR(result.totalVincendas)}</td></tr>
        <tr><td class="bold ok">Outros créditos (+)</td><td class="r ok">${fmtR(result.outrosCreditos)}</td><td class="bold deb">Benefícios recebidos (−)</td><td class="r deb">${fmtR(result.beneficiosRecebidos)}</td></tr>
        <tr><td class="bold deb">Outros descontos (−)</td><td class="r deb">${fmtR(result.outrosDescontos)}</td><td class="bold">Valor bruto</td><td class="r bold">${fmtR(result.valorCausaBruto)}</td></tr>
        <tr style="background:#f0fdf4"><td class="bold" colspan="2" style="color:#166534">Valor da Causa Final (${form.percentualAcordo}%)</td><td class="r bold" colspan="2" style="font-size:13pt;color:#166534">${fmtR(result.valorCausaFinal)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">VII — Demonstrativo das Parcelas Vencidas (${result.mesesVencidos} competências${decimos13Qtd > 0 ? ` + ${decimos13Qtd} 13º salário` : ""})</div>
    <table>
      <thead><tr>
        <th class="r">Competência</th>
        <th class="r">Valor Base</th>
        <th>Origem do Valor Base</th>
        <th class="r">Reaj. Prev.</th>
        <th class="r">Fator Correção</th>
        <th class="r">Valor Corrigido</th>
      </tr></thead>
      <tbody>${parcelasHtml}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">VIII — Fundamento Legal da Atualização Monetária</div>
    <table style="width:100%;border-collapse:collapse;font-size:8pt;margin-bottom:8px">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="border:1px solid #cbd5e1;padding:5px 8px;text-align:left;font-weight:600;color:#1e293b">Fase</th>
          <th style="border:1px solid #cbd5e1;padding:5px 8px;text-align:left;font-weight:600;color:#1e293b">Período</th>
          <th style="border:1px solid #cbd5e1;padding:5px 8px;text-align:left;font-weight:600;color:#1e293b">Indicador</th>
          <th style="border:1px solid #cbd5e1;padding:5px 8px;text-align:left;font-weight:600;color:#1e293b">Fundamento Legal</th>
          <th style="border:1px solid #cbd5e1;padding:5px 8px;text-align:left;font-weight:600;color:#1e293b">Fonte</th>
        </tr>
      </thead>
      <tbody>
        ${correcaoFundHtml}
        <tr style="background:#f8fafc">
          <td style="border:1px solid #e2e8f0;padding:5px 8px;font-weight:600;color:#0f172a">Reajuste Anual</td>
          <td style="border:1px solid #e2e8f0;padding:5px 8px;color:#475569">Mês-aniversário da DIB (anual)</td>
          <td style="border:1px solid #e2e8f0;padding:5px 8px;font-weight:600;color:#047857">INPC</td>
          <td style="border:1px solid #e2e8f0;padding:5px 8px;color:#475569">Art. 41-A, Lei 8.213/91 · Acumulado 12 meses anteriores ao mês-aniversário da DIB</td>
          <td style="border:1px solid #e2e8f0;padding:5px 8px;color:#64748b">IBGE — Sistema SIDRA</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">IX — Observações Técnicas</div>
    <p style="font-size:8.5pt;line-height:1.65;color:#475569">
      Relatório gerado pela Plataforma Veritas Analytics em conformidade com o Manual de Orientação de Procedimentos para os Cálculos na Justiça Federal (CJF, 2025).
      <br><br>
      <strong>Metodologia da base de cálculo:</strong> ${result.metodologiaBase}
      <br><br>
      Fluxo aplicado por parcela: <em>valor base histórico da competência → reajuste previdenciário anual pelo INPC no mês-aniversário da DIB (art. 41-A Lei 8.213/91) → fator de correção monetária cumulativo (${fluxoCriterio}) calculado desde a competência até a data de ajuizamento</em>.
      ${result.temAlertaSubsidiario ? "<br><br><strong>⚠ Atenção:</strong> Base urbana sem histórico contributivo. Aplicado salário mínimo como critério subsidiário por ausência de prova mínima de contribuição (art. 203, CF/88 c/c art. 39, I, Lei 8.213/91)." : ""}
      <br><br>
      Emitido em ${agora}. Não dispensa análise profissional.
    </p>
  </div>

  <button class="btn-print" onclick="window.print()">⊕ Imprimir / Salvar em PDF</button>
</div>

<div class="ftr">
  <div><strong>Veritas Analytics</strong> — Plataforma de Cálculos Judiciais Federais · CJF 2025</div>
  <div>Documento gerado em ${agora}</div>
</div>

</body></html>`;
}
