import React, { useMemo, useState } from "react";
import { FileText, Scale, Calculator, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useDebitCredits } from "@/hooks/use-wallet";
import { buildVeritasReport, openVeritasReport } from "@/components/reports/VeritasReportLayout";
import veritasLogoUrl from "@assets/veritas_analytics_1775154424712.png";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Sistema = "PRICE" | "SAC" | "HAMBURGUES";

type LinhaTabela = {
  periodo: number;
  prestacao: number;
  juros: number;
  amortizacao: number;
  saldo: number;
};

type ResultadoSistema = {
  sistema: Sistema;
  linhas: LinhaTabela[];
  totalPago: number;
  totalJuros: number;
  totalAmortizacao: number;
  prestacaoInicial: number;
  prestacaoFinal: number;
  prestacaoMedia: number;
  taxaEfetivaMensal: number;
  taxaEfetivaAnual: number;
};

type InputState = {
  processo: string;
  parteAutora: string;
  documento: string;
  contratoNumero: string;
  contratoTipo: string;
  dataContrato: string;
  finalidadePericia: string;
  juizoReferencia: string;
  baseLegal: string;
  principal: number;
  taxaMensal: number;
  taxaContinua: boolean;
  periodos: number;
  sistemaFoco: Sistema;
  taxaMercadoMensal: number;
  taxaLegalMensal: number;
  rendaMensal: number;
  multaMoraPct: number;
  jurosMoraPct: number;
  considerarAnaliseRevisional: boolean;
  considerarComparacaoSistemas: boolean;
  observacoes: string;
};

type IndicadoresPericiais = {
  pesoJurosPct: number;
  comprometimentoRendaPct: number;
  sobrecustoMercado: number;
  sobrecustoLegal: number;
  spreadEntreSistemas: number;
  risco: "BAIXO" | "MODERADO" | "ALTO";
  flags: string[];
};

type ConclusaoIA = {
  resumoExecutivo: string;
  achados: string[];
  fundamentosJuridicos: string[];
  conclusaoFinal: string;
};

// ─── Formatadores ─────────────────────────────────────────────────────────────
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number, d = 2) => `${n.toFixed(d)}%`;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function monthlyToAnnual(ratePct: number) {
  return ((1 + ratePct / 100) ** 12 - 1) * 100;
}

function continuousToEffective(ratePct: number) {
  return (Math.exp(ratePct / 100) - 1) * 100;
}

function pmt(pv: number, ratePct: number, n: number) {
  const i = ratePct / 100;
  if (i === 0) return pv / n;
  return pv * ((i * (1 + i) ** n) / ((1 + i) ** n - 1));
}

// ─── Motores de cálculo ───────────────────────────────────────────────────────
function buildPrice(principal: number, ratePct: number, periodos: number): LinhaTabela[] {
  const prest = pmt(principal, ratePct, periodos);
  const linhas: LinhaTabela[] = [];
  let saldo = principal;
  for (let k = 1; k <= periodos; k++) {
    const juros = saldo * (ratePct / 100);
    const amortizacao = prest - juros;
    saldo = Math.max(0, saldo - amortizacao);
    linhas.push({ periodo: k, prestacao: round2(prest), juros: round2(juros), amortizacao: round2(amortizacao), saldo: round2(saldo) });
  }
  if (linhas.length) linhas[linhas.length - 1].saldo = 0;
  return linhas;
}

function buildSac(principal: number, ratePct: number, periodos: number): LinhaTabela[] {
  const amortizacaoConst = principal / periodos;
  const linhas: LinhaTabela[] = [];
  let saldo = principal;
  for (let k = 1; k <= periodos; k++) {
    const juros = saldo * (ratePct / 100);
    const prestacao = amortizacaoConst + juros;
    saldo = Math.max(0, saldo - amortizacaoConst);
    linhas.push({ periodo: k, prestacao: round2(prestacao), juros: round2(juros), amortizacao: round2(amortizacaoConst), saldo: round2(saldo) });
  }
  if (linhas.length) linhas[linhas.length - 1].saldo = 0;
  return linhas;
}

function calcularSistema(sistema: Sistema, principal: number, taxaPct: number, periodos: number): ResultadoSistema {
  const linhas = sistema === "SAC" ? buildSac(principal, taxaPct, periodos) : buildPrice(principal, taxaPct, periodos);
  const totalPago = round2(linhas.reduce((s, l) => s + l.prestacao, 0));
  const totalJuros = round2(linhas.reduce((s, l) => s + l.juros, 0));
  const totalAmortizacao = round2(linhas.reduce((s, l) => s + l.amortizacao, 0));
  return {
    sistema,
    linhas,
    totalPago,
    totalJuros,
    totalAmortizacao,
    prestacaoInicial: linhas[0]?.prestacao ?? 0,
    prestacaoFinal: linhas[linhas.length - 1]?.prestacao ?? 0,
    prestacaoMedia: round2(totalPago / Math.max(1, linhas.length)),
    taxaEfetivaMensal: taxaPct,
    taxaEfetivaAnual: monthlyToAnnual(taxaPct),
  };
}

function buildIndicadores(
  input: InputState,
  foco: ResultadoSistema,
  mercado: ResultadoSistema,
  legal: ResultadoSistema,
  todos: ResultadoSistema[],
): IndicadoresPericiais {
  const pesoJurosPct = foco.totalPago > 0 ? (foco.totalJuros / foco.totalPago) * 100 : 0;
  const comprometimentoRendaPct = input.rendaMensal > 0 ? (foco.prestacaoInicial / input.rendaMensal) * 100 : 0;
  const sobrecustoMercado = Math.max(0, round2(foco.totalPago - mercado.totalPago));
  const sobrecustoLegal = Math.max(0, round2(foco.totalPago - legal.totalPago));
  const totais = todos.map((t) => t.totalPago);
  const spreadEntreSistemas = round2(Math.max(...totais) - Math.min(...totais));

  const flags: string[] = [];
  if (input.taxaMercadoMensal > 0 && foco.taxaEfetivaMensal > input.taxaMercadoMensal * 1.5)
    flags.push("Taxa contratada materialmente superior à taxa de mercado informada.");
  if (pesoJurosPct >= 40)
    flags.push("Participação dos juros elevada no custo total do contrato.");
  if (comprometimentoRendaPct >= 30)
    flags.push("Prestação inicial compromete parcela relevante da renda mensal informada.");
  if (spreadEntreSistemas > input.principal * 0.1)
    flags.push("Diferença financeira relevante entre os sistemas de amortização comparados.");
  if (foco.sistema !== "SAC" && foco.totalJuros > input.principal * 0.7)
    flags.push("Concentração financeira compatível com investigação de capitalização relevante.");

  const risco: "BAIXO" | "MODERADO" | "ALTO" = flags.length >= 4 ? "ALTO" : flags.length >= 2 ? "MODERADO" : "BAIXO";
  return { pesoJurosPct, comprometimentoRendaPct, sobrecustoMercado, sobrecustoLegal, spreadEntreSistemas, risco, flags };
}

function buildConclusao(
  input: InputState,
  foco: ResultadoSistema,
  mercado: ResultadoSistema,
  legal: ResultadoSistema,
  indicadores: IndicadoresPericiais,
): ConclusaoIA {
  const achados: string[] = [];
  const fundamentosJuridicos: string[] = [];

  achados.push(
    `O contrato nº ${input.contratoNumero} foi examinado com principal de ${BRL.format(input.principal)}, prazo de ${input.periodos} períodos e taxa efetiva mensal de ${pct(foco.taxaEfetivaMensal, 4)}.`,
  );
  achados.push(
    `No sistema ${foco.sistema}, o desembolso total apurado corresponde a ${BRL.format(foco.totalPago)}, sendo ${BRL.format(foco.totalJuros)} relativos a juros remuneratórios.`,
  );
  if (input.considerarAnaliseRevisional) {
    achados.push(
      `No recálculo revisional, o total pago cai para ${BRL.format(mercado.totalPago)} pela taxa de mercado e para ${BRL.format(legal.totalPago)} pela taxa legal.`,
    );
  }
  if (indicadores.sobrecustoMercado > 0) {
    achados.push(`A diferença estimada frente ao cenário de mercado alcança ${BRL.format(indicadores.sobrecustoMercado)}.`);
  }
  if (indicadores.flags.some((f) => f.includes("capitalização"))) {
    achados.push("A distribuição dos encargos nas prestações iniciais recomenda análise técnica da pactuação expressa da capitalização.");
  }

  fundamentosJuridicos.push("Observância do equilíbrio contratual, da boa-fé objetiva e da vedação ao enriquecimento sem causa.");
  fundamentosJuridicos.push("Compatibilização entre encargos exigidos, cláusulas contratuais, prova documental e parâmetros financeiros de mercado.");
  if (input.considerarAnaliseRevisional) {
    fundamentosJuridicos.push("Admissibilidade técnica do recálculo revisional para confronto entre taxa contratada, taxa de mercado e taxa legal, conforme objeto da demanda.");
  }
  if (indicadores.flags.some((f) => f.includes("capitalização"))) {
    fundamentosJuridicos.push("A capitalização de juros exige suporte contratual claro e deve ser individualizada na prova pericial.");
  }

  const resumoExecutivo = [
    `Síntese pericial: contrato analisado pelo sistema ${foco.sistema}, total pago de ${BRL.format(foco.totalPago)}, peso dos juros de ${pct(indicadores.pesoJurosPct)} e classificação de risco ${indicadores.risco}.`,
    input.considerarAnaliseRevisional
      ? `O recálculo indica sobrecusto potencial de ${BRL.format(indicadores.sobrecustoMercado)} em comparação ao cenário de mercado informado.`
      : "Não foi solicitada análise revisional comparativa.",
  ].join(" ");

  const conclusaoFinal = [
    `À vista dos cálculos efetuados, dos parâmetros jurídicos informados e dos testes comparativos realizados, conclui-se que o contrato apresenta nível de risco pericial ${indicadores.risco.toLowerCase()}.`,
    indicadores.sobrecustoMercado > 0
      ? `Há indicativo técnico de onerosidade relevante, pois a taxa contratada produz custo superior ao cenário de mercado em ${BRL.format(indicadores.sobrecustoMercado)}.`
      : "Não se identificou, com os parâmetros fornecidos, diferença revisional material suficiente para afirmar abusividade apenas pela comparação com a taxa de mercado.",
    indicadores.comprometimentoRendaPct >= 30
      ? `A prestação inicial compromete ${pct(indicadores.comprometimentoRendaPct)} da renda mensal informada, reforçando a necessidade de apreciação qualitativa do impacto econômico do contrato.`
      : "O comprometimento inicial da renda não ultrapassa o patamar crítico definido para esta análise.",
    "A conclusão não substitui o exame judicial das cláusulas, mas oferece base técnico-contábil para apreciação de eventual revisão, repetição de indébito ou controle de encargos.",
  ].join(" ");

  return { resumoExecutivo, achados, fundamentosJuridicos, conclusaoFinal };
}

// ─── Chave de recuperação ─────────────────────────────────────────────────────
function genChave(): string {
  const ADJETIVOS = ["FEDERAL","JUDICIAL","LEGAL","OFICIAL","FORMAL","CERTO","FIRME","CLARO","JUSTO","BREVE","FORTE","PURO","NOBRE","LEAL","REAL"];
  const SUBSTANTIVOS = ["CALCULO","PROCESSO","ACAO","VALOR","CREDITO","DEBITO","PARCELA","INDICE","FATOR","SALDO","CONTA","BALANCO","ORDEM","TITULO","LAUDO"];
  const adj  = ADJETIVOS[Math.floor(Math.random() * ADJETIVOS.length)];
  const noun = SUBSTANTIVOS[Math.floor(Math.random() * SUBSTANTIVOS.length)];
  const hex  = () => Math.floor(Math.random() * 65536).toString(16).toUpperCase().padStart(4, "0");
  return `${adj}-${noun}-${hex()}-${hex()}`;
}

// ─── Relatório HTML — Design System Veritas ───────────────────────────────────
function buildJurosRelatorio(params: {
  input: InputState;
  foco: ResultadoSistema;
  resultados: { price: ResultadoSistema; sac: ResultadoSistema; hamburgues: ResultadoSistema };
  taxaEfetiva: number;
  revisionalMercado: ResultadoSistema;
  revisionalLegal: ResultadoSistema;
  indicadores: IndicadoresPericiais;
  conclusao: ReturnType<typeof buildConclusao>;
  userName: string;
  chave: string;
  logoSrc: string;
}): string {
  const { input, foco, resultados, taxaEfetiva, revisionalMercado, revisionalLegal,
    indicadores, conclusao, userName, chave, logoSrc } = params;
  const hoje = new Date().toLocaleDateString("pt-BR");

  const thS = `style="background:#17365d;color:#fff;padding:8px 10px;text-align:left;font-size:11px;font-weight:600;"`;
  const thR = `style="background:#17365d;color:#fff;padding:8px 10px;text-align:right;font-size:11px;font-weight:600;"`;
  const tdL = `style="border:1px solid #e2e8f0;padding:7px 10px;text-align:left;font-size:12px;"`;
  const tdR = `style="border:1px solid #e2e8f0;padding:7px 10px;text-align:right;font-size:12px;"`;
  const tdLabel = `style="border:1px solid #e2e8f0;padding:7px 10px;font-weight:600;width:42%;background:#f8fafc;font-size:12px;"`;
  const tdVal   = `style="border:1px solid #e2e8f0;padding:7px 10px;font-size:12px;"`;

  const rowEven = (i: number) => i % 2 === 0 ? "#f8fafc" : "#fff";

  // Tabela I — Dados da perícia
  const rowsPericia = [
    ["Número do processo", input.processo],
    ["Parte autora / contratante", input.parteAutora],
    ["Documento (CPF/CNPJ)", input.documento],
    ["Contrato", `${input.contratoTipo} — nº ${input.contratoNumero}`],
    ["Data do contrato", input.dataContrato ? new Date(input.dataContrato + "T12:00").toLocaleDateString("pt-BR") : "—"],
    ["Juízo de referência", input.juizoReferencia],
  ].map(([l, v], i) => `<tr style="background:${rowEven(i)}"><td ${tdLabel}>${l}</td><td ${tdVal}>${v || "—"}</td></tr>`).join("");

  // Tabela II — Dados do financiamento
  const rowsFinanc = [
    ["Valor principal", BRL.format(input.principal)],
    ["Taxa mensal informada", `${pct(input.taxaMensal, 4)} a.m. ${input.taxaContinua ? "(contínua → efetiva)" : "(efetiva)"}`],
    ["Taxa efetiva mensal considerada", pct(taxaEfetiva, 4)],
    ["Taxa efetiva anual", pct(monthlyToAnnual(taxaEfetiva))],
    ["Número de períodos", `${input.periodos}`],
    ["Sistema de amortização foco", foco.sistema],
    ["Multa de mora", `${pct(input.multaMoraPct)}`],
    ["Juros de mora", `${pct(input.jurosMoraPct)}`],
  ].map(([l, v], i) => `<tr style="background:${rowEven(i)}"><td ${tdLabel}>${l}</td><td ${tdVal}>${v}</td></tr>`).join("");

  // Tabela III — Comparativo de sistemas
  const rowsSistemas = [resultados.price, resultados.sac, resultados.hamburgues].map((r, i) => `
    <tr style="background:${r.sistema === foco.sistema ? "#eff6ff" : rowEven(i)}">
      <td ${tdL}>${r.sistema}${r.sistema === foco.sistema ? " ✓" : ""}</td>
      <td ${tdR}>${BRL.format(r.totalJuros)}</td>
      <td ${tdR}><strong>${BRL.format(r.totalPago)}</strong></td>
      <td ${tdR}>${BRL.format(r.prestacaoInicial)}</td>
      <td ${tdR}>${BRL.format(r.prestacaoFinal)}</td>
      <td ${tdR}>${BRL.format(r.prestacaoMedia)}</td>
    </tr>`).join("");

  // Tabela IV — Síntese revisional
  const rowsRevisional = [
    ["Sistema analisado", foco.sistema],
    ["Total pago (contrato analisado)", BRL.format(foco.totalPago)],
    ["Total de juros", BRL.format(foco.totalJuros)],
    ["Peso dos juros no custo total", pct(indicadores.pesoJurosPct)],
    ["Comprometimento da renda mensal", pct(indicadores.comprometimentoRendaPct)],
    ["Recálculo com taxa de mercado", BRL.format(revisionalMercado.totalPago)],
    ["Diferença apurada vs mercado", BRL.format(indicadores.sobrecustoMercado)],
    ["Recálculo com taxa legal/revisional", BRL.format(revisionalLegal.totalPago)],
    ["Diferença apurada vs taxa legal", BRL.format(indicadores.sobrecustoLegal)],
    ["Classificação de risco pericial", indicadores.risco],
  ].map(([l, v], i) => `<tr style="background:${rowEven(i)}"><td ${tdLabel}>${l}</td><td ${tdVal}>${v}</td></tr>`).join("");

  // Tabela V — Memória de cálculo
  const rowsMemoria = foco.linhas.map((l, i) => `
    <tr style="background:${rowEven(i)}">
      <td ${tdR}>${l.periodo}</td>
      <td ${tdR}>${BRL.format(l.prestacao)}</td>
      <td ${tdR}>${BRL.format(l.juros)}</td>
      <td ${tdR}>${BRL.format(l.amortizacao)}</td>
      <td ${tdR}>${BRL.format(l.saldo)}</td>
    </tr>`).join("");

  // Achados
  const achadosHtml = indicadores.flags.length === 0
    ? `<div style="padding:10px 14px;background:#f0fdf4;border-left:3px solid #22c55e;border-radius:4px;font-size:12px;color:#15803d;">
        Nenhum achado relevante identificado com os parâmetros informados.
       </div>`
    : indicadores.flags.map(f => `
        <li style="margin-bottom:6px;padding:8px 12px;background:#fffbeb;border-left:3px solid #f59e0b;font-size:12px;color:#78350f;border-radius:4px;">${f}</li>
      `).join("");

  // Parâmetros jurídicos + achados técnicos
  const fundamentosHtml = conclusao.fundamentosJuridicos.map((f, i) =>
    `<li style="margin-bottom:5px;font-size:12px;color:#374151;">${i + 1}. ${f}</li>`).join("");
  const achadosTecHtml = conclusao.achados.map((a, i) =>
    `<li style="margin-bottom:5px;font-size:12px;color:#374151;">${i + 1}. ${a}</li>`).join("");

  const body = `
    <div class="vr-page-header">
      <div class="vr-brand-block">
        <div class="vr-logo-box"><img src="${logoSrc}" alt="Veritas Analytics" onerror="this.style.display='none'" /></div>
        <div>
          <div class="vr-brand-name">VERITAS ANALYTICS</div>
          <div class="vr-brand-sub">Plataforma de Cálculos Jurídicos e Periciais</div>
        </div>
      </div>
      <div class="vr-emit-info">
        <div><strong>Emitido em:</strong> ${hoje}</div>
        <div><strong>Responsável:</strong> ${userName || "—"}</div>
      </div>
    </div>

    <div class="vr-title-bar">
      <div class="vr-title-bar-title">Laudo Pericial — Revisão de Contrato de Crédito (Juros e Amortização)</div>
      <div class="vr-title-bar-chave">Chave: ${chave}</div>
    </div>

    <div class="vr-meta">
      <div class="vr-meta-grid">
        <div><span class="vr-meta-label">Processo: </span><span class="vr-meta-value">${input.processo || "—"}</span></div>
        <div><span class="vr-meta-label">Parte autora: </span><span class="vr-meta-value">${input.parteAutora || "—"}</span></div>
        <div><span class="vr-meta-label">Contrato nº: </span><span class="vr-meta-value">${input.contratoNumero || "—"}</span></div>
        <div><span class="vr-meta-label">Tipo de contrato: </span><span class="vr-meta-value">${input.contratoTipo || "—"}</span></div>
        <div><span class="vr-meta-label">Sistema foco: </span><span class="vr-meta-value">${foco.sistema}</span></div>
        <div><span class="vr-meta-label">Juízo: </span><span class="vr-meta-value">${input.juizoReferencia || "—"}</span></div>
        <div><span class="vr-meta-label">Principal: </span><span class="vr-meta-value">${BRL.format(input.principal)}</span></div>
        <div><span class="vr-meta-label">Risco pericial: </span><span class="vr-meta-value">${indicadores.risco}</span></div>
      </div>
    </div>

    <div class="vr-body">

      <div class="vr-section-title">Quadro-Resumo Financeiro</div>
      <div class="vr-kpi-row">
        <div class="vr-kpi"><div class="vr-kpi-label">Total pago</div><div class="vr-kpi-value">${BRL.format(foco.totalPago)}</div><div class="vr-kpi-sub">Sistema ${foco.sistema}</div></div>
        <div class="vr-kpi"><div class="vr-kpi-label">Total de juros</div><div class="vr-kpi-value">${BRL.format(foco.totalJuros)}</div><div class="vr-kpi-sub">Peso: ${pct(indicadores.pesoJurosPct)}</div></div>
        <div class="vr-kpi primary"><div class="vr-kpi-label">Taxa efetiva mensal</div><div class="vr-kpi-value">${pct(taxaEfetiva, 4)}</div><div class="vr-kpi-sub">Anual: ${pct(monthlyToAnnual(taxaEfetiva))}</div></div>
        <div class="vr-kpi"><div class="vr-kpi-label">Comp. renda</div><div class="vr-kpi-value">${pct(indicadores.comprometimentoRendaPct)}</div><div class="vr-kpi-sub">Prestação inicial</div></div>
        <div class="vr-kpi"><div class="vr-kpi-label">Sobrecusto vs mercado</div><div class="vr-kpi-value">${BRL.format(indicadores.sobrecustoMercado)}</div><div class="vr-kpi-sub">Diferença revisional</div></div>
        <div class="vr-kpi"><div class="vr-kpi-label">Risco pericial</div><div class="vr-kpi-value" style="font-size:16px;">${indicadores.risco}</div><div class="vr-kpi-sub">${indicadores.flags.length} flag(s) detectada(s)</div></div>
      </div>

      <div class="vr-section-title">I — Dados da Perícia</div>
      <table><tbody>${rowsPericia}</tbody></table>

      <div class="vr-section-title">II — Dados do Financiamento</div>
      <table><tbody>${rowsFinanc}</tbody></table>

      <div class="vr-section-title">III — Comparação dos Sistemas de Amortização</div>
      <table>
        <thead><tr>
          <th ${thS}>Sistema</th>
          <th ${thR}>Total de Juros</th>
          <th ${thR}>Total Pago</th>
          <th ${thR}>Prest. Inicial</th>
          <th ${thR}>Prest. Final</th>
          <th ${thR}>Prest. Média</th>
        </tr></thead>
        <tbody>${rowsSistemas}</tbody>
      </table>

      <div class="vr-section-title">IV — Síntese Pericial e Recálculo Revisional</div>
      <table><tbody>${rowsRevisional}</tbody></table>

      <div class="vr-section-title">V — Memória de Cálculo — Sistema ${foco.sistema}</div>
      <table>
        <thead><tr>
          <th ${thR}>Período</th>
          <th ${thR}>Prestação</th>
          <th ${thR}>Juros</th>
          <th ${thR}>Amortização</th>
          <th ${thR}>Saldo Devedor</th>
        </tr></thead>
        <tbody>${rowsMemoria}</tbody>
        <tfoot>
          <tr style="background:#eff6ff;font-weight:700;">
            <td ${tdR}><strong>Total</strong></td>
            <td ${tdR}>${BRL.format(foco.totalPago)}</td>
            <td ${tdR}>${BRL.format(foco.totalJuros)}</td>
            <td ${tdR}>${BRL.format(foco.totalAmortizacao)}</td>
            <td ${tdR}>—</td>
          </tr>
        </tfoot>
      </table>

      <div class="vr-section-title">VI — Motor de Conclusão Pericial</div>
      <div class="vr-paragraph"><strong>Resumo executivo:</strong> ${conclusao.resumoExecutivo}</div>
      <div style="margin-top:14px;">
        <p style="font-size:12px;font-weight:700;color:#17365d;margin-bottom:6px;">Achados técnicos:</p>
        <ul style="padding-left:16px;margin:0;">${achadosTecHtml}</ul>
      </div>
      <div style="margin-top:14px;">
        <p style="font-size:12px;font-weight:700;color:#17365d;margin-bottom:6px;">Parâmetros jurídicos considerados:</p>
        <ul style="padding-left:16px;margin:0;">${fundamentosHtml}</ul>
      </div>
      <div class="vr-paragraph" style="margin-top:14px;"><strong>Conclusão:</strong> ${conclusao.conclusaoFinal}</div>

      <div class="vr-section-title">VII — Auditoria de Achados e Alertas</div>
      ${indicadores.flags.length === 0
        ? `<div class="vr-info-box">ℹ Nenhuma inconsistência crítica detectada.</div>`
        : `<ul style="list-style:none;padding:0;margin:0;">${achadosHtml}</ul>`}

      <div class="vr-section-title">VIII — Finalidade e Observações Técnicas</div>
      <div class="vr-paragraph">${input.finalidadePericia || "—"}</div>
      ${input.baseLegal ? `<div class="vr-paragraph" style="margin-top:8px;"><strong>Base legal:</strong> ${input.baseLegal}</div>` : ""}
      ${input.observacoes ? `<div class="vr-notes" style="margin-top:10px;"><strong>Observações adicionais:</strong> ${input.observacoes}</div>` : ""}
      <div class="vr-notes" style="margin-top:10px;">
        Documento gerado automaticamente pelo Veritas Analytics. Este relatório não dispensa análise profissional e deve ser confrontado com a documentação contratual, planilhas, extratos e demais elementos probatórios dos autos.
      </div>

      <div class="vr-signature">
        <div class="vr-signature-line"></div>
        <div class="vr-signature-name">${userName}</div>
        <div class="vr-signature-role">Responsável pelo cálculo</div>
        <div class="vr-footer-chave">Chave de recuperação: <strong>${chave}</strong> — Veritas Analytics · ${hoje}</div>
      </div>
      <div class="vr-footer">
        <span>Veritas Analytics — Plataforma de Cálculos Jurídicos e Periciais</span>
        <span>Emitido em ${hoje}</span>
      </div>
      <p class="vr-ressalva">Este documento é de natureza técnica e não substitui o parecer jurídico. Os valores são estimativos e devem ser conferidos com documentação contratual antes de utilização processual.</p>
    </div>`;

  return buildVeritasReport({ title: "Laudo Pericial — Revisão de Contrato de Crédito", body });
}

// ─── Valores padrão ───────────────────────────────────────────────────────────
const defaultInput: InputState = {
  processo: "0000000-00.2026.4.00.0000",
  parteAutora: "Parte Autora / Contratante",
  documento: "000.000.000-00",
  contratoNumero: "CTR-2026-0001",
  contratoTipo: "Financiamento bancário",
  dataContrato: "2026-01-10",
  finalidadePericia: "Apurar o custo total do financiamento, comparar sistemas de amortização e avaliar eventual onerosidade excessiva, análise revisional e impacto econômico do contrato.",
  juizoReferencia: "Justiça Estadual / Federal",
  baseLegal: "Código Civil, Código de Defesa do Consumidor, pactuação contratual, boa-fé objetiva, equilíbrio contratual e jurisprudência aplicável.",
  principal: 15000,
  taxaMensal: 6,
  taxaContinua: true,
  periodos: 24,
  sistemaFoco: "PRICE",
  taxaMercadoMensal: 3.2,
  taxaLegalMensal: 1,
  rendaMensal: 4000,
  multaMoraPct: 2,
  jurosMoraPct: 1,
  considerarAnaliseRevisional: true,
  considerarComparacaoSistemas: true,
  observacoes: "Modelo padrão Veritas com síntese pericial, comparativo de sistemas, análise revisional e conclusão automatizada.",
};

// ─── Sub-componentes ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function fieldCls() {
  return "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700 bg-white";
}

function KpiBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function JurosAmortizacao() {
  const { user } = useAuth();
  const { toast } = useToast();
  const debitCredits = useDebitCredits();
  const [input, setInput] = useState<InputState>(defaultInput);
  const [pdfLoading, setPdfLoading] = useState(false);

  const update = <K extends keyof InputState>(key: K, value: InputState[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const taxaEfetiva = useMemo(
    () => (input.taxaContinua ? continuousToEffective(input.taxaMensal) : input.taxaMensal),
    [input.taxaMensal, input.taxaContinua],
  );

  const resultados = useMemo(() => ({
    price: calcularSistema("PRICE", input.principal, taxaEfetiva, input.periodos),
    sac: calcularSistema("SAC", input.principal, taxaEfetiva, input.periodos),
    hamburgues: calcularSistema("HAMBURGUES", input.principal, taxaEfetiva, input.periodos),
  }), [input.principal, taxaEfetiva, input.periodos]);

  const foco = useMemo(() => {
    if (input.sistemaFoco === "SAC") return resultados.sac;
    if (input.sistemaFoco === "HAMBURGUES") return resultados.hamburgues;
    return resultados.price;
  }, [input.sistemaFoco, resultados]);

  const revisionalMercado = useMemo(
    () => calcularSistema(input.sistemaFoco, input.principal, input.taxaMercadoMensal, input.periodos),
    [input.sistemaFoco, input.principal, input.taxaMercadoMensal, input.periodos],
  );

  const revisionalLegal = useMemo(
    () => calcularSistema(input.sistemaFoco, input.principal, input.taxaLegalMensal, input.periodos),
    [input.sistemaFoco, input.principal, input.taxaLegalMensal, input.periodos],
  );

  const indicadores = useMemo(
    () => buildIndicadores(input, foco, revisionalMercado, revisionalLegal, [resultados.price, resultados.sac, resultados.hamburgues]),
    [input, foco, revisionalMercado, revisionalLegal, resultados],
  );

  const conclusao = useMemo(
    () => buildConclusao(input, foco, revisionalMercado, revisionalLegal, indicadores),
    [input, foco, revisionalMercado, revisionalLegal, indicadores],
  );

  const riscoCor = indicadores.risco === "ALTO" ? "text-red-600" : indicadores.risco === "MODERADO" ? "text-amber-600" : "text-emerald-600";

  // ── Geração do relatório no padrão Design System Veritas ──────────────────
  async function handleGerarPDF() {
    setPdfLoading(true);
    const ok = await debitCredits(5, "Laudo Pericial — Revisão de Contrato de Crédito");
    if (!ok) { setPdfLoading(false); return; }
    try {
      const chave = genChave();
      const logoSrc = window.location.origin + veritasLogoUrl;
      const html = buildJurosRelatorio({
        input, foco, resultados, taxaEfetiva,
        revisionalMercado, revisionalLegal,
        indicadores, conclusao,
        userName: (user as any)?.nome || (user as any)?.email || "—",
        chave, logoSrc,
      });
      openVeritasReport(html);
      toast({ title: "Relatório gerado", description: `Chave: ${chave}` });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao gerar relatório", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* ── Cabeçalho ── */}
        <div className="rounded-[28px] bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs">
                <Scale className="h-4 w-4" />
                Template automático de laudo PDF padrão Veritas
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">Juros e Amortização com Motor Pericial</h1>
              <p className="mt-2 max-w-4xl text-sm text-slate-200">
                Estrutura com seções I a VII, recálculo revisional, parâmetros jurídicos e conclusão pericial
                automatizada para exportação em PDF.
              </p>
            </div>
            <button
              onClick={handleGerarPDF}
              disabled={pdfLoading}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:scale-[1.01] disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {pdfLoading ? "Gerando…" : "Gerar PDF (5 créditos)"}
            </button>
          </div>
        </div>

        {/* ── Formulários ── */}
        <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
          <Section title="Dados processuais e jurídicos">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Número do processo</label>
                <input className={fieldCls()} value={input.processo} onChange={(e) => update("processo", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Parte autora / contratante</label>
                <input className={fieldCls()} value={input.parteAutora} onChange={(e) => update("parteAutora", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">CPF / CNPJ</label>
                <input className={fieldCls()} value={input.documento} onChange={(e) => update("documento", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Número do contrato</label>
                <input className={fieldCls()} value={input.contratoNumero} onChange={(e) => update("contratoNumero", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Tipo de contrato</label>
                <input className={fieldCls()} value={input.contratoTipo} onChange={(e) => update("contratoTipo", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Data do contrato</label>
                <input className={fieldCls()} type="date" value={input.dataContrato} onChange={(e) => update("dataContrato", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Juízo de referência</label>
                <input className={fieldCls()} value={input.juizoReferencia} onChange={(e) => update("juizoReferencia", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Base legal</label>
                <input className={fieldCls()} value={input.baseLegal} onChange={(e) => update("baseLegal", e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-medium text-slate-600">Finalidade pericial</label>
                <textarea className={`${fieldCls()} min-h-[80px]`} value={input.finalidadePericia} onChange={(e) => update("finalidadePericia", e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-medium text-slate-600">Observações técnicas</label>
                <textarea className={`${fieldCls()} min-h-[70px]`} value={input.observacoes} onChange={(e) => update("observacoes", e.target.value)} />
              </div>
            </div>
          </Section>

          <Section title="Parâmetros financeiros">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Valor principal (R$)</label>
                <input className={fieldCls()} type="number" value={input.principal} onChange={(e) => update("principal", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Taxa mensal informada (%)</label>
                <input className={fieldCls()} type="number" step="0.0001" value={input.taxaMensal} onChange={(e) => update("taxaMensal", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Número de períodos</label>
                <input className={fieldCls()} type="number" value={input.periodos} onChange={(e) => update("periodos", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Sistema foco</label>
                <select className={fieldCls()} value={input.sistemaFoco} onChange={(e) => update("sistemaFoco", e.target.value as Sistema)}>
                  <option value="PRICE">Price (Francês)</option>
                  <option value="SAC">SAC (Constante)</option>
                  <option value="HAMBURGUES">Hamburguês</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Taxa de mercado mensal (%)</label>
                <input className={fieldCls()} type="number" step="0.0001" value={input.taxaMercadoMensal} onChange={(e) => update("taxaMercadoMensal", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Taxa legal/revisional mensal (%)</label>
                <input className={fieldCls()} type="number" step="0.0001" value={input.taxaLegalMensal} onChange={(e) => update("taxaLegalMensal", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Renda mensal do contratante (R$)</label>
                <input className={fieldCls()} type="number" value={input.rendaMensal} onChange={(e) => update("rendaMensal", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Tipo de taxa</label>
                <select className={fieldCls()} value={input.taxaContinua ? "SIM" : "NAO"} onChange={(e) => update("taxaContinua", e.target.value === "SIM")}>
                  <option value="SIM">Taxa contínua (converte para efetiva)</option>
                  <option value="NAO">Taxa efetiva (usa diretamente)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Multa de mora (%)</label>
                <input className={fieldCls()} type="number" step="0.01" value={input.multaMoraPct} onChange={(e) => update("multaMoraPct", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Juros de mora (%)</label>
                <input className={fieldCls()} type="number" step="0.01" value={input.jurosMoraPct} onChange={(e) => update("jurosMoraPct", Number(e.target.value))} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-medium text-slate-600">Opções da análise</label>
                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={input.considerarAnaliseRevisional} onChange={(e) => update("considerarAnaliseRevisional", e.target.checked)} className="rounded" />
                    Incluir análise revisional no PDF
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={input.considerarComparacaoSistemas} onChange={(e) => update("considerarComparacaoSistemas", e.target.checked)} className="rounded" />
                    Incluir comparação de sistemas
                  </label>
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* ── KPIs ao vivo ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiBox label="Total pago" value={BRL.format(foco.totalPago)} sub={`Sistema ${foco.sistema}`} />
          <KpiBox label="Total de juros" value={BRL.format(foco.totalJuros)} sub={pct(indicadores.pesoJurosPct) + " do total"} />
          <KpiBox label="Taxa efetiva mensal" value={pct(taxaEfetiva, 4)} sub={`Anual: ${pct(monthlyToAnnual(taxaEfetiva))}`} />
          <KpiBox label="Risco pericial" value={indicadores.risco} sub={`${indicadores.flags.length} flag${indicadores.flags.length !== 1 ? "s" : ""} detectada${indicadores.flags.length !== 1 ? "s" : ""}`} />
        </div>

        {/* ── Achados + Síntese ── */}
        <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
          <Section title="Achados periciais automáticos">
            <div className="space-y-2">
              {indicadores.flags.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                  <span className="text-sm text-emerald-800">Nenhum achado relevante com os parâmetros informados.</span>
                </div>
              ) : indicadores.flags.map((f, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-amber-900">{f}</span>
                </div>
              ))}
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 border p-3">
                  <div className="text-xs text-slate-500">Peso dos juros</div>
                  <div className="font-semibold text-slate-900">{pct(indicadores.pesoJurosPct)}</div>
                </div>
                <div className="rounded-xl bg-slate-50 border p-3">
                  <div className="text-xs text-slate-500">Comprometimento da renda</div>
                  <div className="font-semibold text-slate-900">{pct(indicadores.comprometimentoRendaPct)}</div>
                </div>
                <div className="rounded-xl bg-slate-50 border p-3">
                  <div className="text-xs text-slate-500">Sobrecusto vs mercado</div>
                  <div className="font-semibold text-slate-900">{BRL.format(indicadores.sobrecustoMercado)}</div>
                </div>
                <div className="rounded-xl bg-slate-50 border p-3">
                  <div className="text-xs text-slate-500">Spread entre sistemas</div>
                  <div className="font-semibold text-slate-900">{BRL.format(indicadores.spreadEntreSistemas)}</div>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Motor de conclusão pericial">
            <div className="space-y-4 text-sm text-slate-700">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Resumo executivo</p>
                <p className="leading-relaxed">{conclusao.resumoExecutivo}</p>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Achados técnicos</p>
                <ul className="list-disc space-y-1 pl-5">
                  {conclusao.achados.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Parâmetros jurídicos</p>
                <ul className="list-disc space-y-1 pl-5">
                  {conclusao.fundamentosJuridicos.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Conclusão final</p>
                <p className="leading-relaxed">{conclusao.conclusaoFinal}</p>
              </div>
            </div>
          </Section>
        </div>

        {/* ── Comparativo entre sistemas ── */}
        <Section title="Comparativo entre sistemas de amortização">
          <div className="overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-2 text-left">Sistema</th>
                  <th className="px-4 py-2 text-right">Total de Juros</th>
                  <th className="px-4 py-2 text-right">Total Pago</th>
                  <th className="px-4 py-2 text-right">Prest. Inicial</th>
                  <th className="px-4 py-2 text-right">Prest. Final</th>
                  <th className="px-4 py-2 text-right">Prest. Média</th>
                </tr>
              </thead>
              <tbody>
                {[resultados.price, resultados.sac, resultados.hamburgues].map((r) => (
                  <tr key={r.sistema} className={`border-t ${r.sistema === foco.sistema ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                    <td className="px-4 py-2 font-medium">{r.sistema === foco.sistema ? `${r.sistema} ✓` : r.sistema}</td>
                    <td className="px-4 py-2 text-right">{BRL.format(r.totalJuros)}</td>
                    <td className="px-4 py-2 text-right font-semibold">{BRL.format(r.totalPago)}</td>
                    <td className="px-4 py-2 text-right">{BRL.format(r.prestacaoInicial)}</td>
                    <td className="px-4 py-2 text-right">{BRL.format(r.prestacaoFinal)}</td>
                    <td className="px-4 py-2 text-right">{BRL.format(r.prestacaoMedia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {input.considerarAnaliseRevisional && (
            <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-2 text-left">Cenário revisional</th>
                    <th className="px-4 py-2 text-right">Taxa</th>
                    <th className="px-4 py-2 text-right">Total Pago</th>
                    <th className="px-4 py-2 text-right">Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t hover:bg-slate-50">
                    <td className="px-4 py-2">Contrato analisado</td>
                    <td className="px-4 py-2 text-right">{pct(taxaEfetiva, 4)}</td>
                    <td className="px-4 py-2 text-right font-semibold">{BRL.format(foco.totalPago)}</td>
                    <td className="px-4 py-2 text-right">—</td>
                  </tr>
                  <tr className="border-t bg-blue-50">
                    <td className="px-4 py-2">Taxa de mercado</td>
                    <td className="px-4 py-2 text-right">{pct(input.taxaMercadoMensal, 4)}</td>
                    <td className="px-4 py-2 text-right">{BRL.format(revisionalMercado.totalPago)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-blue-700">{BRL.format(indicadores.sobrecustoMercado)}</td>
                  </tr>
                  <tr className="border-t bg-emerald-50">
                    <td className="px-4 py-2">Taxa legal</td>
                    <td className="px-4 py-2 text-right">{pct(input.taxaLegalMensal, 4)}</td>
                    <td className="px-4 py-2 text-right">{BRL.format(revisionalLegal.totalPago)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-emerald-700">{BRL.format(indicadores.sobrecustoLegal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* ── Memória de cálculo ── */}
        <Section title="Memória de cálculo do sistema foco">
          <div className="max-h-[520px] overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">Período</th>
                  <th className="px-3 py-2 text-right">Prestação</th>
                  <th className="px-3 py-2 text-right">Juros</th>
                  <th className="px-3 py-2 text-right">Amortização</th>
                  <th className="px-3 py-2 text-right">Saldo Devedor</th>
                </tr>
              </thead>
              <tbody>
                {foco.linhas.map((l) => (
                  <tr key={l.periodo} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-600">{l.periodo}</td>
                    <td className="px-3 py-2 text-right">{BRL.format(l.prestacao)}</td>
                    <td className="px-3 py-2 text-right">{BRL.format(l.juros)}</td>
                    <td className="px-3 py-2 text-right">{BRL.format(l.amortizacao)}</td>
                    <td className="px-3 py-2 text-right font-medium">{BRL.format(l.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── Botão final ── */}
        <div className="flex justify-end pb-8">
          <button
            onClick={handleGerarPDF}
            disabled={pdfLoading}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
          >
            <FileText className="h-4 w-4" />
            {pdfLoading ? "Gerando PDF…" : "Baixar laudo completo (PDF) — 5 créditos"}
          </button>
        </div>
      </div>
    </div>
  );
}
