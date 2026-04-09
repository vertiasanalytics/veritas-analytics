/**
 * caseReportEngine.ts
 * Gerador de relatório judicial conforme layout Projef Web.
 *
 * Layout idêntico ao Projef Web (identificador 367ab064):
 *   — Cabeçalho: Processo, Autor, Réu, Identificador
 *   — Critérios e parâmetros do cálculo
 *   — Seção I: PARTES (tabela resumo)
 *   — Seção II: TOTALIZAÇÃO
 *   — DEMONSTRATIVO DE PARCELAS por parte:
 *       Colunas: #, Data, A (moeda original), B (B_conv×B_corr), C=A×B, D, E=C×D, F, G=(C+E)×F, H=C+E+G
 *   — MEMÓRIA DE CÁLCULO auditável por parcela (expandível)
 */

import { REPORT_LOGO_B64 } from "./logoData";

const LOGO_B64: string | null = REPORT_LOGO_B64;

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export interface CurrencyConversionStep {
  fromCurrency: string;
  toCurrency: string;
  transitionDate: string;
  appliedFactor: number;
  amountBefore: number;
  amountAfter: number;
  legalNote?: string;
}

export interface CorrectionRecord {
  period: string;
  indexCode: string;
  rate: number;
  factor: number;
  accumulated: number;
}

export interface InterestRecord {
  period: string;
  ruleCode: string;
  rate: number;
}

export interface SelicRecord {
  period: string;
  rate: number;
}

export interface ParcelaProjef {
  seq: number;
  period: string;
  /** A — valor original na moeda da competência (não convertido) */
  A: number;
  /** Moeda histórica da parcela (ex.: CR3, CRR, BRL) */
  originalCurrency: string;
  /** B_conv — fator de conversão monetária histórica (1 para BRL) */
  B_conv: number;
  /** B_corr — produto IPCA-E/INPC acumulado */
  B_corr: number;
  /** B = B_conv × B_corr — coeficiente total */
  B: number;
  C: number;
  D: number;
  E: number;
  F: number;
  G: number;
  H: number;
  /** Fase bifásica: 1 = até 11/2021, 2 = a partir de 12/2021 */
  phase: 1 | 2;
  /**
   * Início efetivo da correção monetária em BRL.
   * Para moedas pré-Real: "1994-07". Para BRL: período da parcela.
   */
  bCorrStartPeriod?: string;
  /** Passos de conversão monetária histórica */
  currencyConversionSteps: CurrencyConversionStep[];
  /** Registros mensais de correção monetária */
  correctionRecords: CorrectionRecord[];
  /** Registros mensais de juros moratórios */
  interestRecords: InterestRecord[];
  /** Registros mensais de Selic */
  selicRecords: SelicRecord[];
  obs?: string;
}

export interface ParteProjef {
  nome: string;
  cpfCnpj?: string;
  parcelas: ParcelaProjef[];
  totalA: number;
  totalC: number;
  totalE: number;
  totalG: number;
  totalH: number;
}

export interface CaseReportInput {
  publicKey: string;
  userName?: string;
  processData: {
    processNumber?: string;
    claimant?: string;
    defendant?: string;
    judgeName?: string;
    courtSection?: string;
    actionType?: string;
    city?: string;
    stateUf?: string;
    generalNotes?: string;
  };
  monetaryConfig: {
    criteriaCode?: string;
    criteriaName?: string;
    baseDate?: string;
  };
  interestConfig: {
    ruleName?: string;
    startDate?: string;
  };
  partes: ParteProjef[];
  fees: Array<{ feesType: string; computedAmount: number; description?: string }>;
  succumbencies: Array<{ type: string; description?: string; amount: number; computedAmount?: number }>;
  finalMetadata: {
    preparedBy?: string;
    institution?: string;
    city?: string;
    stateUf?: string;
    finalNotes?: string;
  };
  totalGross: number;
  totalNet: number;
  generatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// FORMATADORES
// ─────────────────────────────────────────────────────────────

function fBRL(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fPct(v: number, decimals = 6): string {
  return (v * 100).toFixed(decimals).replace(".", ",") + "%";
}

function fFator(v: number, digits = 6): string {
  return v.toFixed(digits).replace(".", ",");
}

function fPeriod(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  return `${m}/${y.slice(2)}`;
}

function fBasePeriod(yyyyMM?: string): string {
  if (!yyyyMM) return "—";
  const [y, m] = yyyyMM.split("-");
  const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${months[parseInt(m) - 1]}/${y}`;
}

/** Símbolo e nome curto de cada moeda histórica brasileira */
const CURRENCY_LABELS: Record<string, { symbol: string; name: string }> = {
  BRR:  { symbol: "Rs",    name: "Réis"           },
  CRZ:  { symbol: "Cr$",   name: "Cruzeiro (1942)" },
  NCR:  { symbol: "NCr$",  name: "Cruzeiro Novo"   },
  CR2:  { symbol: "Cr$",   name: "Cruzeiro (1970)" },
  CZL:  { symbol: "Cz$",   name: "Cruzado"         },
  NCZ:  { symbol: "NCz$",  name: "Cruzado Novo"    },
  CR3:  { symbol: "Cr$",   name: "Cruzeiro (1990)" },
  CRR:  { symbol: "CR$",   name: "Cruzeiro Real"   },
  BRL:  { symbol: "R$",    name: "Real"            },
};

function currencySymbol(code: string): string {
  return CURRENCY_LABELS[code]?.symbol ?? code;
}

function fValorNaMoeda(v: number, currency: string): string {
  const sym = currencySymbol(currency);
  const formatted = v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym} ${formatted}`;
}

// ─────────────────────────────────────────────────────────────
// DESCRIÇÃO DO CRITÉRIO DE JUROS
// ─────────────────────────────────────────────────────────────

function descrJuros(ruleCode: string, citDate?: string): string {
  const cit = citDate ? ` Data de início: ${fBasePeriod(citDate)}.` : "";
  switch (ruleCode) {
    case "JUROS_POUPANCA_CONDENAT":
      return `6% a.a. (0,5% a.m.) até 07/2009; Juros da Poupança de 08/2009 a 11/2021; Selic a partir de 12/2021.${cit}`;
    case "JUROS_POUPANCA_PREV":
      return `1% a.m. até 06/2009; 0,5% a.m. de 07/2009 a 04/2012; Juros da Poupança de 05/2012 a 11/2021; Selic a partir de 12/2021.${cit}`;
    case "JUROS_1PCT":
      return `1% a.m. (juros legais).${cit}`;
    case "JUROS_0.5PCT":
      return `0,5% a.m.${cit}`;
    case "JUROS_SELIC":
      return `Taxa Selic mensal.${cit}`;
    case "NONE":
      return "Sem juros moratórios.";
    default:
      return ruleCode + (cit ? ` ${cit}` : "");
  }
}

// ─────────────────────────────────────────────────────────────
// CONVERSÃO MONETÁRIA HISTÓRICA (por parcela — apenas quando B_conv ≠ 1)
// Exibe a tabela de transições de moeda de forma compacta e visível,
// sem seções expansíveis. As memórias mês a mês foram removidas do relatório.
// ─────────────────────────────────────────────────────────────

function gerarConversaoMoeda(p: ParcelaProjef): string {
  const hasCurrConv = p.currencyConversionSteps?.length > 0;
  if (!hasCurrConv) return "";

  const convRows = p.currencyConversionSteps.map((s) => `
    <tr>
      <td>${s.fromCurrency} → ${s.toCurrency}</td>
      <td>${s.transitionDate}</td>
      <td class="num">${s.appliedFactor}</td>
      <td class="num">${fValorNaMoeda(s.amountBefore, s.fromCurrency)}</td>
      <td class="num">${fValorNaMoeda(s.amountAfter, s.toCurrency)}</td>
      <td class="obs">${s.legalNote ?? "—"}</td>
    </tr>`).join("");

  const bCorrNote = p.bCorrStartPeriod && p.bCorrStartPeriod !== p.period
    ? `<span class="mem-hint"> — correção monetária (IPCA-E) inicia em ${fPeriod(p.bCorrStartPeriod)}, pois B<sub>conv</sub> já embute a inflação pré-Real</span>`
    : "";

  return `
<div class="conv-moeda-bloco">
  <div class="conv-moeda-titulo">
    Conversão Monetária Histórica — Parcela ${p.seq} (${fPeriod(p.period)}, ${fValorNaMoeda(p.A, p.originalCurrency)})
    &nbsp;|&nbsp; B<sub>conv</sub> = ${fFator(p.B_conv, 10)}${bCorrNote}
  </div>
  <table class="mem-table">
    <thead><tr>
      <th>Transição</th><th>Data</th><th>Fator</th>
      <th>Valor Antes</th><th>Valor Depois</th><th>Base Legal</th>
    </tr></thead>
    <tbody>${convRows}</tbody>
  </table>
</div>`;
}

// ─────────────────────────────────────────────────────────────
// DEMONSTRATIVO DE PARCELAS (tabela Projef + memória)
// ─────────────────────────────────────────────────────────────

function gerarDemonstrativoParcelas(parte: ParteProjef): string {
  const rows = parte.parcelas.map((p) => {
    const neg = p.H < 0;
    const cls = neg ? " style=\"color:#c00\"" : "";
    const isHistorical = p.originalCurrency !== "BRL";

    // Coluna A: mostra moeda histórica se diferente de BRL
    const colA = isHistorical
      ? `<td${cls} title="${CURRENCY_LABELS[p.originalCurrency]?.name ?? p.originalCurrency}">
           <span class="currency-hist">${currencySymbol(p.originalCurrency)}</span> ${fBRL(p.A)}
         </td>`
      : `<td${cls}>${fBRL(p.A)}</td>`;

    // Coluna B: mostra decomposição se B_conv ≠ 1
    const bCell = isHistorical
      ? `<td class="b-decomp" title="B_conv=${fFator(p.B_conv, 10)} × B_corr=${fFator(p.B_corr, 8)}">
           <span class="b-total">${fFator(p.B)}</span>
           <br><small class="b-hint">${fFator(p.B_conv, 8)} × ${fFator(p.B_corr, 6)}</small>
         </td>`
      : `<td>${fFator(p.B)}</td>`;

    return `<tr${p.seq % 2 === 0 ? " class=\"par\"" : ""}>
      <td>${p.seq}</td>
      <td>${fPeriod(p.period)}</td>
      ${colA}
      ${bCell}
      <td${cls}>${fBRL(p.C)}</td>
      <td>${fPct(p.D)}</td>
      <td${cls}>${fBRL(p.E)}</td>
      <td>${fPct(p.F)}</td>
      <td${cls}>${fBRL(p.G)}</td>
      <td${cls} class="total"><strong>${fBRL(p.H)}</strong></td>
      ${p.obs ? `<td class="obs">${p.obs}</td>` : "<td></td>"}
    </tr>`;
  }).join("\n");

  const conversoes = parte.parcelas.map((p) => gerarConversaoMoeda(p)).filter(Boolean).join("\n");

  return `
<div class="partido-bloco">
  <div class="partido-titulo">Cálculo para: ${parte.nome}</div>
  <div class="table-wrap">
  <table class="parc-table">
    <thead>
      <tr>
        <th>#</th>
        <th>Data</th>
        <th>Principal<br>(A)</th>
        <th>Coef. Corr.<br>Monetária<br>(B = B<sub>conv</sub>×B<sub>corr</sub>)</th>
        <th>Principal<br>Corrigido<br>(C = A × B)</th>
        <th>Juros %<br>até 12/21<br>(D)</th>
        <th>Juros<br>Principal R$<br>(E = C × D)</th>
        <th>Selic %<br>a partir de 12/21<br>(F)</th>
        <th>Selic R$<br>(G = (C+E) × F)</th>
        <th>Total (R$)<br>(H = C+E+G)</th>
        <th>Obs.</th>
      </tr>
    </thead>
    <tbody>
      ${rows || "<tr><td colspan='11'>Nenhuma parcela calculada.</td></tr>"}
    </tbody>
    <tfoot>
      <tr class="totais">
        <td colspan="2"><strong>Totais</strong></td>
        <td><strong>${fBRL(parte.totalA)}</strong></td>
        <td></td>
        <td><strong>${fBRL(parte.totalC)}</strong></td>
        <td></td>
        <td><strong>${fBRL(parte.totalE)}</strong></td>
        <td></td>
        <td><strong>${fBRL(parte.totalG)}</strong></td>
        <td class="total"><strong>${fBRL(parte.totalH)}</strong></td>
        <td></td>
      </tr>
      <tr class="totais-label">
        <td colspan="11">Total para: ${parte.nome} &nbsp;&nbsp; <strong>${fBRL(parte.totalH)}</strong></td>
      </tr>
    </tfoot>
  </table>
  </div>

  ${conversoes ? `<div class="memorias-wrapper">${conversoes}</div>` : ""}
</div>`;
}

// ─────────────────────────────────────────────────────────────
// GERADOR PRINCIPAL
// ─────────────────────────────────────────────────────────────

export function generateCaseReportHTML(input: CaseReportInput): string {
  const {
    publicKey, userName, processData, monetaryConfig, interestConfig,
    partes, fees, succumbencies, finalMetadata,
    totalGross, totalNet, generatedAt,
  } = input;

  const dateStr = generatedAt.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const emitiidoEm = generatedAt.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const resumoRows = partes.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${p.nome}${p.cpfCnpj ? ` <small>(${p.cpfCnpj})</small>` : ""}</td>
      <td class="num">${fBRL(p.totalC)}</td>
      <td class="num">${fBRL(p.totalE)}</td>
      <td class="num">${fBRL(p.totalG)}</td>
      <td class="num total"><strong>${fBRL(p.totalH)}</strong></td>
    </tr>`).join("");

  const demonstrativos = partes.map(gerarDemonstrativoParcelas).join("\n");

  const feesRows = fees.filter((f) => f.computedAmount !== 0).map((f) => `
    <tr>
      <td>${f.feesType === "succumbential" ? "Honorários Sucumbenciais" : "Honorários Contratuais"}</td>
      <td>${f.description ?? "—"}</td>
      <td class="num total">${fBRL(f.computedAmount)}</td>
    </tr>`).join("");

  const sucRows = succumbencies.map((s) => `
    <tr>
      <td>${s.type}</td>
      <td>${s.description ?? "—"}</td>
      <td class="num">${fBRL(s.amount)}</td>
      <td class="num total">${fBRL(s.computedAmount ?? s.amount)}</td>
    </tr>`).join("");

  const ruleDesc = descrJuros(interestConfig?.ruleName ?? "NONE", interestConfig?.startDate);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Cálculo Judicial — ${processData.processNumber ?? publicKey}</title>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; font-size: 9pt; color: #111; background: #fff; }
.page { max-width: 297mm; margin: 0 auto; padding: 15mm 12mm; }

/* ── CABEÇALHO VERITAS ANALYTICS ── */
.hdr { background: #0f2a4a; color: #fff; padding: 14px 28px; display: flex; align-items: center; gap: 18px; }
.hdr-logo-img { height: 56px; width: auto; object-fit: contain; flex-shrink: 0; display: block; }
.hdr-logo { flex: 1; display: flex; flex-direction: column; }
.hdr-brand { font-family: 'Cinzel', Georgia, serif; font-size: 18pt; font-weight: 700; letter-spacing: .05em; color: #fff; }
.hdr-sub { font-size: 8pt; color: #93c5fd; letter-spacing: .12em; text-transform: uppercase; margin-top: 2px; }
.hdr-meta { text-align: right; font-size: 8pt; color: #bfdbfe; line-height: 1.7; white-space: nowrap; }
.hdr-meta strong { color: #fff; }

/* ── TÍTULO DO LAUDO ── */
.laudo-title-bar { background: #1e3a5f; color: #fff; padding: 10px 28px; display: flex; align-items: center; justify-content: space-between; }
.laudo-title { font-family: 'Cinzel', Georgia, serif; font-size: 11pt; font-weight: 600; letter-spacing: .04em; line-height: 1.3; }
.laudo-subtitle { font-size: 8pt; color: #93c5fd; margin-top: 3px; letter-spacing: .03em; }
.id-badge { background: #0f2a4a; color: #f0c040; font-family: monospace; font-size: 9pt; padding: 5px 12px; border-radius: 4px; font-weight: bold; white-space: nowrap; border: 1px solid #f0c04040; }

/* ── DADOS DO PROCESSO ── */
.process-info { border: 1px solid #c5d5e8; border-top: none; padding: 8px 28px 10px; background: #f4f7fb; }
.header-info { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 24px; font-size: 9pt; }
.header-info .lbl { font-weight: 700; color: #1e3a5f; }
.header-info .val { color: #111; }

/* SEÇÕES */
.secao { margin: 12px 0; }
.secao-titulo { font-size: 10pt; font-weight: bold; color: #1a3a6e; border-bottom: 2px solid #1a3a6e; padding-bottom: 2px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
.criterios-box { background: #f8f9fb; border: 1px solid #ccd; padding: 8px 12px; font-size: 9pt; margin-bottom: 10px; }
.criterios-box p { margin-bottom: 3px; }

/* TABELAS */
table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin: 4px 0; }
th { background: #1a3a6e; color: #fff; padding: 5px 6px; text-align: center; font-size: 8pt; font-weight: 600; vertical-align: bottom; line-height: 1.3; }
td { padding: 4px 6px; border-bottom: 1px solid #e5e5e5; vertical-align: middle; }
tr.par td { background: #f5f8ff; }
td.num { text-align: right; white-space: nowrap; }
td.total { font-weight: bold; color: #1a3a6e; }
td.obs { font-size: 7.5pt; color: #666; }

/* DEMONSTRATIVO */
.partido-bloco { margin: 14px 0; }
.partido-titulo { background: #1a3a6e; color: #f0c040; font-weight: bold; font-size: 10pt; padding: 5px 10px; letter-spacing: 0.5px; }
.table-wrap { overflow-x: auto; }
.parc-table th { font-size: 7.5pt; padding: 4px 4px; }
.parc-table td { padding: 3px 4px; font-size: 8pt; }
.parc-table td:nth-child(1) { text-align: center; color: #666; }
.parc-table td:nth-child(2) { text-align: center; white-space: nowrap; }
.parc-table td:nth-child(3),
.parc-table td:nth-child(5),
.parc-table td:nth-child(7),
.parc-table td:nth-child(9),
.parc-table td:nth-child(10) { text-align: right; }
.parc-table td:nth-child(4),
.parc-table td:nth-child(6),
.parc-table td:nth-child(8) { text-align: right; font-family: monospace; font-size: 8pt; }
tr.totais td { background: #dde8f5; font-size: 8.5pt; border-top: 2px solid #1a3a6e; text-align: right; }
tr.totais td:nth-child(1), tr.totais td:nth-child(2) { text-align: left; }
tr.totais-label td { background: #1a3a6e; color: #f0c040; font-size: 9pt; padding: 4px 6px; }

/* MOEDA HISTÓRICA */
.currency-hist { font-size: 7.5pt; color: #7a5c00; font-weight: bold; }
.b-decomp { text-align: right !important; font-family: monospace; font-size: 8pt; line-height: 1.2; }
.b-total { font-weight: bold; }
.b-hint { color: #777; font-size: 7pt; display: block; white-space: nowrap; }

/* CONVERSÃO MONETÁRIA HISTÓRICA (moedas pré-Real) */
.memorias-wrapper { margin: 6px 0 12px; }
.conv-moeda-bloco { border: 1px solid #c5cfe8; border-radius: 3px; margin: 6px 0; padding: 6px 10px; background: #f4f7fd; }
.conv-moeda-titulo { font-size: 8.5pt; font-weight: bold; color: #1a3a6e; margin-bottom: 5px; border-bottom: 1px solid #c5cfe8; padding-bottom: 3px; }
.mem-hint { font-weight: normal; color: #6a7d99; font-size: 7.5pt; font-style: italic; }
.mem-table { font-size: 7.5pt; }
.mem-table th { background: #2a5298; font-size: 7.5pt; padding: 3px 5px; }
.mem-table td { padding: 2px 5px; }
.mem-table tr.par td { background: #f0f4fb; }

/* RESUMO PARTES */
.resumo-table th:nth-child(1), .resumo-table td:nth-child(1) { text-align: center; }
.resumo-table td:nth-child(3),
.resumo-table td:nth-child(4),
.resumo-table td:nth-child(5),
.resumo-table td:nth-child(6) { text-align: right; }

/* TOTAL GERAL */
.total-geral-box { background: #1a3a6e; color: #fff; padding: 12px 18px; margin: 14px 0; display: flex; justify-content: space-between; align-items: center; }
.total-geral-label { font-size: 10pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #f0c040; }
.total-geral-value { font-size: 18pt; font-weight: 900; color: #fff; }

/* ASSINATURA */
.assinatura { margin-top: 28px; border-top: 1px solid #1a3a6e; padding-top: 8px; font-size: 9pt; }
.disclaimer { font-size: 7.5pt; color: #888; margin-top: 10px; line-height: 1.6; border-top: 1px solid #eee; padding-top: 6px; }

@media print {
  .page { padding: 8mm 8mm; }
  .table-wrap { overflow: visible; }
  .conv-moeda-bloco { page-break-inside: avoid; }
  .hdr, .laudo-title-bar, .id-badge, th, .total-geral-box, .partido-titulo, .totais-label td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head>
<body>

<!-- CABEÇALHO VERITAS ANALYTICS -->
<div class="hdr">
  ${LOGO_B64 ? `<img src="${LOGO_B64}" alt="Veritas Analytics" class="hdr-logo-img" onerror="this.style.display='none'">` : ""}
  <div class="hdr-logo">
    <div class="hdr-brand">VERITAS ANALYTICS</div>
    <div class="hdr-sub">Plataforma de Cálculos Judiciais Federais</div>
  </div>
  <div class="hdr-meta">
    <div><strong>Emitido em:</strong> ${emitiidoEm}</div>
    <div>Usuário: ${userName ?? "—"}</div>
    <div>CJF — Manual 2025</div>
  </div>
</div>

<!-- TÍTULO DO LAUDO -->
<div class="laudo-title-bar">
  <div>
    <div class="laudo-title">Cálculo de Atualização Financeira</div>
    <div class="laudo-subtitle">Programa para Cálculos Judiciais — Manual de Cálculos da Justiça Federal 2025 (CJF)</div>
  </div>
  <div class="id-badge">${publicKey}</div>
</div>

<!-- DADOS DO PROCESSO -->
<div class="process-info">
  <div class="header-info">
    <div><span class="lbl">Processo Nº: </span><span class="val">${processData.processNumber ?? "—"}</span></div>
    <div><span class="lbl">Atualizado até: </span><span class="val">${fBasePeriod(monetaryConfig.baseDate)}</span></div>
    <div><span class="lbl">Autor: </span><span class="val">${processData.claimant ?? "—"}</span></div>
    <div><span class="lbl">Critério de Correção: </span><span class="val">${monetaryConfig.criteriaName ?? "—"}</span></div>
    <div><span class="lbl">Réu: </span><span class="val">${processData.defendant ?? "—"}</span></div>
    <div><span class="lbl">Gerado em: </span><span class="val">${dateStr}</span></div>
  </div>
</div>

<div class="page">

<!-- CRITÉRIOS E PARÂMETROS -->
<div class="secao">
  <div class="secao-titulo">Critérios e Parâmetros do Cálculo</div>
  <div class="criterios-box">
    <p><strong>Critério de atualização monetária:</strong> ${monetaryConfig.criteriaName ?? "—"}</p>
    <p><strong>Início da correção:</strong> mês seguinte à competência de cada parcela</p>
    <p><strong>Juros moratórios:</strong> ${ruleDesc}</p>
    <p><strong>Atualização pela Selic:</strong> a partir de dezembro/2021 (EC 113/2021 e STF — Tema 1.244)</p>
    <p><strong>Data-base (atualizado até):</strong> ${fBasePeriod(monetaryConfig.baseDate)}</p>
    <p><strong>Coeficiente B:</strong> B = B<sub>conv</sub> × B<sub>corr</sub>, onde B<sub>conv</sub> = fator de conversão monetária histórica e B<sub>corr</sub> = produto dos índices de correção monetária mensais. Para parcelas em BRL, B<sub>conv</sub> = 1.</p>
    ${processData.generalNotes ? `<p><strong>Obs.:</strong> ${processData.generalNotes}</p>` : ""}
  </div>
</div>

<!-- SEÇÃO I — PARTES -->
<div class="secao">
  <div class="secao-titulo">Seção I — Partes</div>
  <table class="resumo-table">
    <thead>
      <tr>
        <th>#</th>
        <th>Nome</th>
        <th>Principal Corrigido (C)</th>
        <th>Juros Moratórios até 12/21 (E)</th>
        <th>Selic a partir de 12/21 (G)</th>
        <th>Total (H)</th>
      </tr>
    </thead>
    <tbody>
      ${resumoRows || "<tr><td colspan='6'>Nenhuma parte cadastrada.</td></tr>"}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2"><strong>Total Geral</strong></td>
        <td class="num"><strong>${fBRL(partes.reduce((s, p) => s + p.totalC, 0))}</strong></td>
        <td class="num"><strong>${fBRL(partes.reduce((s, p) => s + p.totalE, 0))}</strong></td>
        <td class="num"><strong>${fBRL(partes.reduce((s, p) => s + p.totalG, 0))}</strong></td>
        <td class="num total"><strong>${fBRL(totalGross)}</strong></td>
      </tr>
    </tfoot>
  </table>
</div>

<!-- SEÇÃO II — TOTALIZAÇÃO -->
<div class="secao">
  <div class="secao-titulo">Seção II — Totalização</div>
  <div class="total-geral-box">
    <div class="total-geral-label">Total Bruto do Cálculo</div>
    <div class="total-geral-value">${fBRL(totalGross)}</div>
  </div>
  ${totalNet !== totalGross ? `
  <div class="total-geral-box" style="background:#2a5298">
    <div class="total-geral-label">Total Líquido (após descontos)</div>
    <div class="total-geral-value">${fBRL(totalNet)}</div>
  </div>` : ""}
</div>

${fees.some((f) => f.computedAmount !== 0) ? `
<!-- HONORÁRIOS -->
<div class="secao">
  <div class="secao-titulo">Honorários Advocatícios</div>
  <table>
    <thead><tr><th>Tipo</th><th>Descrição</th><th>Valor</th></tr></thead>
    <tbody>${feesRows}</tbody>
  </table>
</div>` : ""}

${succumbencies.length > 0 ? `
<!-- OUTRAS SUCUMBÊNCIAS -->
<div class="secao">
  <div class="secao-titulo">Outras Sucumbências</div>
  <table>
    <thead><tr><th>Tipo</th><th>Descrição</th><th>Valor Original</th><th>Valor Atualizado</th></tr></thead>
    <tbody>${sucRows}</tbody>
  </table>
</div>` : ""}

<!-- DEMONSTRATIVOS DE PARCELAS -->
<div class="secao">
  <div class="secao-titulo">Demonstrativo de Parcelas por Parte</div>
  <p style="font-size:8pt;color:#555;margin-bottom:8px;">
    Coluna A: valor original na moeda da competência.
    Coluna B = B<sub>conv</sub> × B<sub>corr</sub> (para moedas históricas, a decomposição B<sub>conv</sub> × B<sub>corr</sub> aparece abaixo do fator total; as transições de moeda são detalhadas abaixo de cada tabela).
  </p>
  ${demonstrativos || "<p>Nenhuma parcela calculada.</p>"}
</div>

<!-- ASSINATURA / DADOS FINAIS -->
${finalMetadata.preparedBy || finalMetadata.institution ? `
<div class="assinatura">
  <p>${finalMetadata.city ?? processData.city ?? ""}${finalMetadata.stateUf ? `, ${finalMetadata.stateUf}` : ""}, ${dateStr}</p>
  <br>
  <p><strong>${finalMetadata.preparedBy ?? ""}</strong></p>
  ${finalMetadata.institution ? `<p>${finalMetadata.institution}</p>` : ""}
</div>` : ""}

<div class="disclaimer">
  Relatório gerado automaticamente pelo sistema Veritas Analytics.<br>
  Índices: IPCA-E/INPC conforme IBGE; Selic conforme BCB; Poupança conforme legislação vigente.<br>
  Fórmula: B = B<sub>conv</sub> × B<sub>corr</sub>; C = A × B; E = C × D; G = (C + E) × F; H = C + E + G (Manual de Cálculos da Justiça Federal 2025 — CJF).<br>
  B<sub>conv</sub> = fator de conversão monetária histórica para BRL (1 para parcelas já em Real).<br>
  B<sub>corr</sub> = produto acumulado IPCA-E/INPC mês a mês até 11/2021.<br>
  Este documento não substitui perito judicial. Os valores devem ser homologados pelo Juízo competente.<br>
  ${finalMetadata.finalNotes ?? ""}
</div>

</div>
</body>
</html>`;
}
