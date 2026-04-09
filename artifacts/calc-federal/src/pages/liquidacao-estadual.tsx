import React, { useMemo, useState, useEffect } from "react";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useDebitCredits } from "@/hooks/use-wallet";
import { useToast } from "@/hooks/use-toast";
import { useSearch } from "wouter";
import veritasLogoUrl from "@assets/veritas_analytics_1775154424712.png";
import { buildVeritasReport } from "@/components/reports/VeritasReportLayout";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type TipoLiquidacao = "calculo" | "arbitramento" | "artigos";
type NaturezaObrigacao = "indenizacao_civil" | "contrato" | "servidor_publico" | "obrigacao_periodica" | "outro";
type IndiceCorrecao = "IPCA-E" | "INPC" | "IGP-M" | "TJMG" | "SELIC" | "Manual";
type ModeloJuros = "1%_mes" | "SELIC" | "sem_juros";
type TermoInicialJuros = "evento" | "citacao" | "sentenca" | "manual";
type AbaAtiva = "processo" | "sentenca" | "parametros" | "parcelas" | "honorarios" | "auditoria" | "relatorio";

type ProcessoLiquidacao = {
  numeroProcesso: string;
  autor: string;
  reu: string;
  advogadoResponsavel: string;
  comarca: string;
  vara: string;
  tribunal: string;
  tipoLiquidacao: TipoLiquidacao;
  naturezaObrigacao: NaturezaObrigacao;
  dataEvento: string;
  dataCitacao: string;
  dataSentenca: string;
  dataBaseCalculo: string;
  observacoesGerais: string;
};

type CriteriosSentenca = {
  textoSentenca: string;
  objetoLiquidacao: string;
  criterioPrincipal: string;
  observacoesInterpretativas: string;
};

type ParametrosFinanceiros = {
  indiceCorrecao: IndiceCorrecao;
  percentualIndiceManual: number;
  termoInicialCorrecao: "vencimento" | "evento" | "citacao" | "sentenca" | "manual";
  dataManualCorrecao: string;
  jurosModelo: ModeloJuros;
  termoInicialJuros: TermoInicialJuros;
  dataManualJuros: string;
  percentualJurosMensalManual: number;
};

type ParcelaLiquidacao = {
  id: string;
  descricao: string;
  categoria: string;
  dataVencimento: string;
  quantidade: number;
  valorUnitario: number;
  observacao: string;
};

type HonorariosCustas = {
  incluirHonorariosSucumbenciais: boolean;
  baseHonorarios: "total_liquidado" | "principal_corrigido";
  percentualHonorarios: number;
  incluirCustas: boolean;
  valorCustas: number;
  incluirMulta: boolean;
  valorMulta: number;
  observacao: string;
};

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const gerarId = () => Math.random().toString(36).slice(2, 11);

function genChave(): string {
  const ADJETIVOS = ["FEDERAL","JUDICIAL","LEGAL","OFICIAL","FORMAL","CERTO","FIRME","CLARO","JUSTO","BREVE","FORTE","PURO","NOBRE","LEAL","REAL"];
  const SUBSTANTIVOS = ["CALCULO","PROCESSO","ACAO","VALOR","CREDITO","DEBITO","PARCELA","INDICE","FATOR","SALDO","CONTA","BALANCO","ORDEM","TITULO","LAUDO"];
  const adj  = ADJETIVOS[Math.floor(Math.random() * ADJETIVOS.length)];
  const noun = SUBSTANTIVOS[Math.floor(Math.random() * SUBSTANTIVOS.length)];
  const hex  = () => Math.floor(Math.random() * 65536).toString(16).toUpperCase().padStart(4, "0");
  return `${adj}-${noun}-${hex()}-${hex()}`;
}

function diffDias(a?: string, b?: string) {
  if (!a || !b) return 0;
  const ms = new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function mesesAproximados(a?: string, b?: string) {
  const d = diffDias(a, b);
  return d > 0 ? Number((d / 30).toFixed(2)) : 0;
}

function percentualIndiceEstimado(indice: IndiceCorrecao, manual: number) {
  switch (indice) {
    case "IPCA-E": return 8;
    case "INPC": return 7;
    case "IGP-M": return 6;
    case "TJMG": return 7.5;
    case "SELIC": return 12;
    case "Manual": return manual || 0;
    default: return 0;
  }
}

function percentualJurosMensal(modelo: ModeloJuros, manual: number) {
  switch (modelo) {
    case "1%_mes": return 1;
    case "SELIC": return 0.85;
    case "sem_juros": return 0;
    default: return manual || 0;
  }
}

function corrigirValor(base: number, pctual: number, meses: number) {
  if (!base) return 0;
  return base * (1 + (pctual / 100) * (meses / 12));
}

function calcularJurosSimples(base: number, taxaMensal: number, meses: number) {
  if (!base || !taxaMensal || !meses) return 0;
  return base * (taxaMensal / 100) * meses;
}

function parcelaVazia(): ParcelaLiquidacao {
  return { id: gerarId(), descricao: "", categoria: "principal", dataVencimento: "", quantidade: 1, valorUnitario: 0, observacao: "" };
}

const baseFundamentos = [
  "CPC, art. 509: a liquidação de sentença poderá ocorrer por cálculo do credor, por arbitramento ou pelo procedimento comum quando houver necessidade de alegar e provar fato novo.",
  "CPC, art. 510: na liquidação por arbitramento, o juiz intimará as partes para a apresentação de pareceres ou documentos elucidativos, podendo nomear perito, se necessário.",
  "CPC, art. 511: na liquidação pelo procedimento comum, observar-se-á, no que couber, o procedimento comum.",
  "CPC, art. 524: o cumprimento de sentença que exigir pagamento de quantia certa depende de demonstrativo discriminado e atualizado do crédito.",
  "CPC, art. 85: os honorários sucumbenciais podem incidir conforme os critérios fixados na decisão judicial.",
  "Código Civil, art. 389: o inadimplemento acarreta perdas e danos, juros, atualização monetária e honorários advocatícios, quando cabíveis.",
];

type ParcelaCalculada = ParcelaLiquidacao & {
  principal: number; mesesCorrecao: number; valorCorrigido: number;
  mesesJuros: number; juros: number; totalParcela: number;
};

function getLiquidacaoReportHtml(opts: {
  processo: ProcessoLiquidacao;
  sentenca: CriteriosSentenca;
  fundamentosSelecionados: string[];
  parametros: ParametrosFinanceiros;
  taxaIndice: number;
  taxaJuros: number;
  termoDataJuros: string;
  parcelasCalculadas: ParcelaCalculada[];
  totalPrincipal: number;
  totalCorrigido: number;
  totalJuros: number;
  subtotalLiquidado: number;
  honorarios: HonorariosCustas;
  valorHonorarios: number;
  valorCustas: number;
  valorMulta: number;
  totalGeral: number;
  scoreConsistencia: string;
  alertas: string[];
  userName: string;
  logoSrc: string;
}): string {
  const o = opts;
  const hoje = new Date().toLocaleDateString("pt-BR");
  const tdC = `style="border:1px solid #e2e8f0;padding:8px 10px;text-align:center;font-size:12px;"`;
  const tdL = `style="border:1px solid #e2e8f0;padding:8px 10px;text-align:left;font-size:12px;"`;
  const thS = `style="background:#17365d;color:#fff;padding:8px 10px;font-size:11px;font-weight:600;"`;

  const tipoLabel: Record<TipoLiquidacao, string> = {
    calculo: "Por Cálculo", arbitramento: "Por Arbitramento", artigos: "Pelo Procedimento Comum",
  };
  const naturezaLabel: Record<NaturezaObrigacao, string> = {
    indenizacao_civil: "Indenização Civil", contrato: "Contrato",
    servidor_publico: "Servidor Público", obrigacao_periodica: "Obrigação Periódica", outro: "Outro",
  };

  const rowsParcelas = o.parcelasCalculadas.map((p, i) => `
    <tr style="background:${i % 2 === 0 ? "#f8fafc" : "#fff"}">
      <td ${tdC}>${i + 1}</td>
      <td ${tdL}>${p.descricao || "—"}</td>
      <td ${tdC}>${p.categoria}</td>
      <td ${tdC}>${p.dataVencimento || "—"}</td>
      <td ${tdC}>${moeda(p.principal)}</td>
      <td ${tdC}>${String(p.mesesCorrecao)}</td>
      <td ${tdC}>${moeda(p.valorCorrigido)}</td>
      <td ${tdC}>${moeda(p.juros)}</td>
      <td ${tdC} style="font-weight:700;">${moeda(p.totalParcela)}</td>
    </tr>`).join("");

  const fundHtml = o.fundamentosSelecionados.map((f, i) =>
    `<li style="margin-bottom:6px;font-size:12px;color:#374151;">${i + 1}. ${f}</li>`).join("");

  const alertasHtml = o.alertas.map(a =>
    `<li style="margin-bottom:6px;padding:8px 12px;background:#fffbeb;border-left:3px solid #f59e0b;font-size:12px;color:#78350f;">${a}</li>`).join("");

  const scoreCor = o.scoreConsistencia === "robusto" ? "#059669" : o.scoreConsistencia === "razoável" ? "#d97706" : "#dc2626";

  const body = `
    <div class="vr-page-header">
      <div class="vr-brand-block">
        <div class="vr-logo-box"><img src="${o.logoSrc}" alt="Veritas Analytics" onerror="this.style.display='none'" /></div>
        <div>
          <div class="vr-brand-name">VERITAS ANALYTICS</div>
          <div class="vr-brand-sub">Plataforma de Cálculos Jurídicos e Periciais</div>
        </div>
      </div>
      <div class="vr-emit-info">
        <div><strong>Emitido em:</strong> ${hoje}</div>
        <div><strong>Responsável:</strong> ${o.userName || "—"}</div>
      </div>
    </div>

    <div class="vr-title-bar">
      <div class="vr-title-bar-title">Liquidação de Sentença — Justiça Estadual</div>
      <div class="vr-title-bar-chave" id="laudo-chave">aguardando…</div>
    </div>

    <div class="vr-meta">
      <div class="vr-meta-grid">
        <div><span class="vr-meta-label">Processo: </span><span class="vr-meta-value">${o.processo.numeroProcesso || "—"}</span></div>
        <div><span class="vr-meta-label">Advogado(a): </span><span class="vr-meta-value">${o.processo.advogadoResponsavel || "—"}</span></div>
        <div><span class="vr-meta-label">Autor(a): </span><span class="vr-meta-value">${o.processo.autor || "—"}</span></div>
        <div><span class="vr-meta-label">Réu(ré): </span><span class="vr-meta-value">${o.processo.reu || "—"}</span></div>
        <div><span class="vr-meta-label">Tribunal: </span><span class="vr-meta-value">${o.processo.tribunal || "—"}</span></div>
        <div><span class="vr-meta-label">Comarca/Vara: </span><span class="vr-meta-value">${o.processo.comarca || "—"} / ${o.processo.vara || "—"}</span></div>
        <div><span class="vr-meta-label">Data do evento: </span><span class="vr-meta-value">${o.processo.dataEvento || "—"}</span></div>
        <div><span class="vr-meta-label">Data da sentença: </span><span class="vr-meta-value">${o.processo.dataSentenca || "—"}</span></div>
        <div><span class="vr-meta-label">Tipo: </span><span class="vr-meta-value">${tipoLabel[o.processo.tipoLiquidacao]}</span></div>
        <div><span class="vr-meta-label">Natureza: </span><span class="vr-meta-value">${naturezaLabel[o.processo.naturezaObrigacao]}</span></div>
      </div>
    </div>

    <div class="vr-body">
      <div class="vr-section-title">Quadro-Resumo Financeiro</div>
      <div class="vr-kpi-row">
        <div class="vr-kpi"><div class="vr-kpi-label">Total principal</div><div class="vr-kpi-value">${moeda(o.totalPrincipal)}</div></div>
        <div class="vr-kpi"><div class="vr-kpi-label">Total corrigido</div><div class="vr-kpi-value">${moeda(o.totalCorrigido)}</div></div>
        <div class="vr-kpi"><div class="vr-kpi-label">Juros</div><div class="vr-kpi-value">${moeda(o.totalJuros)}</div></div>
        <div class="vr-kpi primary"><div class="vr-kpi-label">Total geral</div><div class="vr-kpi-value">${moeda(o.totalGeral)}</div></div>
        <div class="vr-kpi"><div class="vr-kpi-label">Honorários</div><div class="vr-kpi-value">${moeda(o.valorHonorarios)}</div></div>
        <div class="vr-kpi"><div class="vr-kpi-label">Custas</div><div class="vr-kpi-value">${moeda(o.valorCustas)}</div></div>
        <div class="vr-kpi"><div class="vr-kpi-label">Multa</div><div class="vr-kpi-value">${moeda(o.valorMulta)}</div></div>
        <div class="vr-kpi" style="border-left:4px solid ${scoreCor};"><div class="vr-kpi-label">Score consistência</div><div class="vr-kpi-value" style="color:${scoreCor};font-size:14px;">${o.scoreConsistencia}</div></div>
      </div>

      <div class="vr-section-title">1. Delimitação do Título Judicial</div>
      <table>
        <tbody>
          <tr><td style="padding:7px 8px;font-weight:600;width:35%;background:#f8fafc;">Objeto da liquidação</td><td style="padding:7px 8px;">${o.sentenca.objetoLiquidacao || "—"}</td></tr>
          <tr><td style="padding:7px 8px;font-weight:600;background:#f8fafc;">Critério principal</td><td style="padding:7px 8px;">${o.sentenca.criterioPrincipal || "—"}</td></tr>
        </tbody>
      </table>
      ${o.sentenca.textoSentenca ? `<div class="vr-info-box" style="white-space:pre-wrap;">${o.sentenca.textoSentenca}</div>` : ""}
      ${o.sentenca.observacoesInterpretativas ? `<div class="vr-notes"><strong>Observações interpretativas:</strong> ${o.sentenca.observacoesInterpretativas}</div>` : ""}

      <div class="vr-section-title">2. Fundamentação Jurídica</div>
      <ul style="padding-left:16px;margin:8px 0;">${fundHtml}</ul>

      <div class="vr-section-title">3. Parâmetros da Liquidação</div>
      <table>
        <tbody>
          <tr><td style="padding:7px 8px;font-weight:600;width:35%;background:#f8fafc;">Índice de correção</td><td style="padding:7px 8px;">${o.parametros.indiceCorrecao} (estimativa: ${pct(o.taxaIndice)})</td></tr>
          <tr><td style="padding:7px 8px;font-weight:600;background:#f8fafc;">Termo inicial da correção</td><td style="padding:7px 8px;">${o.parametros.termoInicialCorrecao}</td></tr>
          <tr><td style="padding:7px 8px;font-weight:600;background:#f8fafc;">Modelo de juros</td><td style="padding:7px 8px;">${o.parametros.jurosModelo} (${pct(o.taxaJuros)}/mês)</td></tr>
          <tr><td style="padding:7px 8px;font-weight:600;background:#f8fafc;">Termo inicial dos juros</td><td style="padding:7px 8px;">${o.parametros.termoInicialJuros}${o.termoDataJuros ? ` (${o.termoDataJuros})` : ""}</td></tr>
        </tbody>
      </table>

      <div class="vr-section-title">4. Memória de Cálculo</div>
      ${o.parcelasCalculadas.length === 0
        ? `<p style="font-size:12px;color:#64748b;">Nenhuma parcela lançada.</p>`
        : `<table>
          <thead><tr>
            <th class="center" style="width:40px;">#</th>
            <th>Descrição</th>
            <th class="center">Categoria</th>
            <th class="center">Vencimento</th>
            <th class="right">Principal</th>
            <th class="center">Meses</th>
            <th class="right">Corrigido</th>
            <th class="right">Juros</th>
            <th class="right">Total</th>
          </tr></thead>
          <tbody>${rowsParcelas}</tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="padding:7px 8px;font-weight:700;">Totais</td>
              <td class="right">${moeda(o.totalPrincipal)}</td>
              <td></td>
              <td class="right">${moeda(o.totalCorrigido)}</td>
              <td class="right">${moeda(o.totalJuros)}</td>
              <td class="right">${moeda(o.subtotalLiquidado)}</td>
            </tr>
          </tfoot>
        </table>`}

      <div class="vr-section-title">5. Honorários, Custas e Multa</div>
      <table>
        <tbody>
          <tr><td style="padding:7px 8px;font-weight:600;width:40%;background:#f8fafc;">Honorários sucumbenciais</td><td style="padding:7px 8px;">${o.honorarios.incluirHonorariosSucumbenciais ? `${pct(o.honorarios.percentualHonorarios)} sobre ${o.honorarios.baseHonorarios === "total_liquidado" ? "total liquidado" : "principal corrigido"} = ${moeda(o.valorHonorarios)}` : "Não incluídos"}</td></tr>
          <tr><td style="padding:7px 8px;font-weight:600;background:#f8fafc;">Custas</td><td style="padding:7px 8px;">${o.honorarios.incluirCustas ? moeda(o.valorCustas) : "Não incluídas"}</td></tr>
          <tr><td style="padding:7px 8px;font-weight:600;background:#f8fafc;">Multa</td><td style="padding:7px 8px;">${o.honorarios.incluirMulta ? moeda(o.valorMulta) : "Não incluída"}</td></tr>
          <tr style="background:#eff6ff;"><td style="padding:7px 8px;font-weight:700;">Total geral</td><td style="padding:7px 8px;font-weight:700;font-size:15px;">${moeda(o.totalGeral)}</td></tr>
        </tbody>
      </table>

      <div class="vr-section-title">6. Auditoria e Alertas</div>
      ${o.alertas.length === 0
        ? `<div class="vr-info-box">ℹ Nenhuma inconsistência crítica detectada.</div>`
        : `<ul style="list-style:none;padding:0;margin:0;">${alertasHtml}</ul>`}

      <div class="vr-section-title">7. Conclusão</div>
      <div class="vr-paragraph">
        O presente demonstrativo foi estruturado para subsidiar a fase de liquidação de sentença, com discriminação do crédito, parâmetros de atualização e memória individualizada dos itens. Recomenda-se confrontar cada critério com o título judicial, inclusive quanto ao índice de correção monetária, ao termo inicial dos juros, à eventual incidência de honorários e às especificidades do tribunal competente.
      </div>
      ${o.processo.observacoesGerais ? `<div class="vr-notes" style="margin-top:10px;"><strong>Observações gerais:</strong> ${o.processo.observacoesGerais}</div>` : ""}

      <div class="vr-signature">
        <div class="vr-signature-line"></div>
        <div class="vr-signature-name">${o.userName}</div>
        <div class="vr-signature-role">Responsável pelo cálculo</div>
        <div class="vr-footer-chave" id="laudo-chave-footer">Chave de recuperação: <strong id="laudo-chave-footer-val">aguardando…</strong> — Veritas Analytics · ${hoje}</div>
      </div>
      <div class="vr-footer">
        <span>Veritas Analytics — Plataforma de Cálculos Jurídicos e Periciais</span>
        <span>Emitido em ${hoje}</span>
      </div>
      <p class="vr-ressalva">Este documento é de natureza técnica e não substitui pareceres jurídicos. Os valores são estimativos e devem ser conferidos com índices e documentos oficiais antes de utilização processual.</p>
    </div>`;

  return buildVeritasReport({ title: "Liquidação de Sentença — Justiça Estadual", body });
}

const processoInicial: ProcessoLiquidacao = {
  numeroProcesso: "", autor: "", reu: "", advogadoResponsavel: "",
  comarca: "", vara: "", tribunal: "Justiça Estadual",
  tipoLiquidacao: "calculo", naturezaObrigacao: "indenizacao_civil",
  dataEvento: "", dataCitacao: "", dataSentenca: "",
  dataBaseCalculo: new Date().toISOString().slice(0, 10), observacoesGerais: "",
};

const sentencaInicial: CriteriosSentenca = {
  textoSentenca: "", objetoLiquidacao: "", criterioPrincipal: "", observacoesInterpretativas: "",
};

const parametrosInicial: ParametrosFinanceiros = {
  indiceCorrecao: "IPCA-E", percentualIndiceManual: 10, termoInicialCorrecao: "vencimento",
  dataManualCorrecao: "", jurosModelo: "1%_mes", termoInicialJuros: "citacao",
  dataManualJuros: "", percentualJurosMensalManual: 1,
};

const honorariosInicial: HonorariosCustas = {
  incluirHonorariosSucumbenciais: true, baseHonorarios: "total_liquidado",
  percentualHonorarios: 10, incluirCustas: false, valorCustas: 0,
  incluirMulta: false, valorMulta: 0, observacao: "",
};

export default function VeritasLiquidacaoEstadual() {
  const { user } = useAuth();
  const debitCredits = useDebitCredits();
  const { toast } = useToast();

  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>("processo");
  const [processo, setProcesso] = useState<ProcessoLiquidacao>(processoInicial);
  const [sentenca, setSentenca] = useState<CriteriosSentenca>(sentencaInicial);
  const [fundamentosSelecionados, setFundamentosSelecionados] = useState<string[]>([
    baseFundamentos[0], baseFundamentos[3], baseFundamentos[5],
  ]);
  const [parametros, setParametros] = useState<ParametrosFinanceiros>(parametrosInicial);
  const [parcelas, setParcelas] = useState<ParcelaLiquidacao[]>([
    { id: gerarId(), descricao: "Parcela principal da condenação", categoria: "principal",
      dataVencimento: new Date().toISOString().slice(0, 10), quantidade: 1, valorUnitario: 5000, observacao: "" },
  ]);
  const [honorarios, setHonorarios] = useState<HonorariosCustas>(honorariosInicial);

  const [chaveGerada, setChaveGerada] = useState<string | null>(null);
  const [inputChave, setInputChave] = useState("");
  const [loadingRecover, setLoadingRecover] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);

  const searchString = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const key = params.get("key");
    if (!key) return;
    setLoadingRecover(true);
    fetch(`${BASE}/api/civil/recover/${key.toUpperCase()}`, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const s = data.calcState as any;
        if (s?.processo)              setProcesso(s.processo);
        if (s?.sentenca)              setSentenca(s.sentenca);
        if (s?.fundamentosSelecionados) setFundamentosSelecionados(s.fundamentosSelecionados);
        if (s?.parametros)            setParametros(s.parametros);
        if (s?.parcelas)              setParcelas(s.parcelas);
        if (s?.honorarios)            setHonorarios(s.honorarios);
        setChaveGerada(data.publicKey);
        toast({ title: "Cálculo recuperado", description: `Chave: ${data.publicKey}` });
      })
      .catch(() => toast({ title: "Chave não encontrada", description: key, variant: "destructive" }))
      .finally(() => setLoadingRecover(false));
  }, [searchString]);

  const taxaIndice = useMemo(
    () => percentualIndiceEstimado(parametros.indiceCorrecao, parametros.percentualIndiceManual),
    [parametros.indiceCorrecao, parametros.percentualIndiceManual]
  );

  const taxaJuros = useMemo(
    () => percentualJurosMensal(parametros.jurosModelo, parametros.percentualJurosMensalManual),
    [parametros.jurosModelo, parametros.percentualJurosMensalManual]
  );

  const termoDataJuros = useMemo(() => {
    switch (parametros.termoInicialJuros) {
      case "evento": return processo.dataEvento;
      case "citacao": return processo.dataCitacao;
      case "sentenca": return processo.dataSentenca;
      case "manual": return parametros.dataManualJuros;
      default: return "";
    }
  }, [parametros.termoInicialJuros, parametros.dataManualJuros, processo.dataEvento, processo.dataCitacao, processo.dataSentenca]);

  const termoDataCorrecao = useMemo(() => {
    switch (parametros.termoInicialCorrecao) {
      case "evento": return processo.dataEvento;
      case "citacao": return processo.dataCitacao;
      case "sentenca": return processo.dataSentenca;
      case "manual": return parametros.dataManualCorrecao;
      default: return "";
    }
  }, [parametros.termoInicialCorrecao, parametros.dataManualCorrecao, processo.dataEvento, processo.dataCitacao, processo.dataSentenca]);

  const parcelasCalculadas = useMemo<ParcelaCalculada[]>(() => {
    return parcelas.map(p => {
      const principal = (Number(p.quantidade) || 0) * (Number(p.valorUnitario) || 0);
      const dataCorrecaoBase = parametros.termoInicialCorrecao === "vencimento" ? p.dataVencimento : termoDataCorrecao;
      const mesesCorrecao = mesesAproximados(dataCorrecaoBase, processo.dataBaseCalculo);
      const valorCorrigido = corrigirValor(principal, taxaIndice, mesesCorrecao);
      const baseJurosData = termoDataJuros || p.dataVencimento;
      const mesesJuros = mesesAproximados(baseJurosData, processo.dataBaseCalculo);
      const juros = calcularJurosSimples(valorCorrigido, taxaJuros, mesesJuros);
      return { ...p, principal, mesesCorrecao, valorCorrigido, mesesJuros, juros, totalParcela: valorCorrigido + juros };
    });
  }, [parcelas, parametros.termoInicialCorrecao, termoDataCorrecao, termoDataJuros, processo.dataBaseCalculo, taxaIndice, taxaJuros]);

  const totalPrincipal = useMemo(() => parcelasCalculadas.reduce((s, i) => s + i.principal, 0), [parcelasCalculadas]);
  const totalCorrigido = useMemo(() => parcelasCalculadas.reduce((s, i) => s + i.valorCorrigido, 0), [parcelasCalculadas]);
  const totalJuros = useMemo(() => parcelasCalculadas.reduce((s, i) => s + i.juros, 0), [parcelasCalculadas]);
  const subtotalLiquidado = useMemo(() => totalCorrigido + totalJuros, [totalCorrigido, totalJuros]);

  const baseHonorariosValor = useMemo(
    () => honorarios.baseHonorarios === "total_liquidado" ? subtotalLiquidado : totalCorrigido,
    [honorarios.baseHonorarios, subtotalLiquidado, totalCorrigido]
  );

  const valorHonorarios = useMemo(() => {
    if (!honorarios.incluirHonorariosSucumbenciais) return 0;
    return baseHonorariosValor * ((Number(honorarios.percentualHonorarios) || 0) / 100);
  }, [honorarios.incluirHonorariosSucumbenciais, honorarios.percentualHonorarios, baseHonorariosValor]);

  const valorCustas = honorarios.incluirCustas ? Number(honorarios.valorCustas) || 0 : 0;
  const valorMulta = honorarios.incluirMulta ? Number(honorarios.valorMulta) || 0 : 0;
  const totalGeral = useMemo(() => subtotalLiquidado + valorHonorarios + valorCustas + valorMulta,
    [subtotalLiquidado, valorHonorarios, valorCustas, valorMulta]);

  const scoreConsistencia = useMemo(() => {
    let pts = 0;
    if (processo.numeroProcesso.trim()) pts++;
    if (sentenca.textoSentenca.trim()) pts++;
    if (sentenca.objetoLiquidacao.trim()) pts++;
    if (parcelas.length > 0) pts++;
    if (processo.dataBaseCalculo) pts++;
    if (parametros.indiceCorrecao) pts++;
    if (fundamentosSelecionados.length >= 2) pts++;
    if (pts >= 7) return "robusto";
    if (pts >= 5) return "razoável";
    return "frágil";
  }, [processo, sentenca, parcelas.length, parametros.indiceCorrecao, fundamentosSelecionados.length]);

  const alertas = useMemo(() => {
    const lista: string[] = [];
    if (!sentenca.textoSentenca.trim()) lista.push("Insira o trecho da sentença ou acórdão para documentar os critérios da liquidação.");
    if (!sentenca.objetoLiquidacao.trim()) lista.push("Descreva o objeto da liquidação para delimitar o alcance da memória de cálculo.");
    if (parcelas.length === 0) lista.push("Inclua ao menos uma parcela ou item liquidando.");
    if (processo.tipoLiquidacao === "calculo" && sentenca.observacoesInterpretativas.toLowerCase().includes("perícia"))
      lista.push("O caso foi marcado como liquidação por cálculo, mas as observações sugerem necessidade de perícia. Avalie se a modalidade correta é arbitramento.");
    if (processo.naturezaObrigacao === "indenizacao_civil" && parametros.termoInicialJuros === "citacao" && processo.dataEvento)
      lista.push("Em certas condenações indenizatórias extracontratuais, os juros podem ser discutidos desde o evento danoso. Confira a decisão concreta.");
    if (!processo.dataBaseCalculo) lista.push("Defina a data-base do cálculo para permitir atualização do demonstrativo.");
    if (honorarios.incluirHonorariosSucumbenciais && !honorarios.percentualHonorarios)
      lista.push("Honorários sucumbenciais ativados sem percentual definido.");
    if (parametros.indiceCorrecao === "Manual" && !parametros.percentualIndiceManual)
      lista.push("Índice manual selecionado sem percentual informado.");
    if (parametros.termoInicialJuros === "manual" && !parametros.dataManualJuros)
      lista.push("Termo inicial manual dos juros selecionado sem data correspondente.");
    if (lista.length === 0) lista.push("Nenhuma inconsistência crítica detectada. Revise os critérios judiciais específicos do caso.");
    return lista;
  }, [sentenca, parcelas.length, processo, parametros, honorarios]);

  const textoRelatorio = useMemo(() => {
    const b: string[] = [];
    b.push("RELATÓRIO DE LIQUIDAÇÃO DE SENTENÇA");
    b.push("");
    b.push("1. IDENTIFICAÇÃO DO PROCESSO");
    b.push(`Processo: ${processo.numeroProcesso || "—"}`);
    b.push(`Tribunal: ${processo.tribunal || "—"}`);
    b.push(`Comarca/Vara: ${processo.comarca || "-"} / ${processo.vara || "-"}`);
    b.push(`Autor(a): ${processo.autor || "—"}`);
    b.push(`Réu(ré): ${processo.reu || "—"}`);
    b.push(`Advogado(a): ${processo.advogadoResponsavel || "—"}`);
    b.push(`Tipo de liquidação: ${processo.tipoLiquidacao}`);
    b.push(`Natureza: ${processo.naturezaObrigacao}`);
    b.push(`Data do evento: ${processo.dataEvento || "—"}`);
    b.push(`Data da citação: ${processo.dataCitacao || "—"}`);
    b.push(`Data da sentença: ${processo.dataSentenca || "—"}`);
    b.push(`Data-base: ${processo.dataBaseCalculo || "—"}`);
    b.push("");
    b.push("2. DELIMITAÇÃO DO TÍTULO JUDICIAL");
    b.push(`Objeto: ${sentenca.objetoLiquidacao || "—"}`);
    b.push(`Critério principal: ${sentenca.criterioPrincipal || "—"}`);
    b.push("Trecho da sentença:");
    b.push(sentenca.textoSentenca || "Não informado.");
    if (sentenca.observacoesInterpretativas.trim()) b.push(`Observações interpretativas: ${sentenca.observacoesInterpretativas.trim()}`);
    b.push("");
    b.push("3. FUNDAMENTAÇÃO");
    fundamentosSelecionados.forEach((f, i) => b.push(`${i + 1}. ${f}`));
    b.push("");
    b.push("4. PARÂMETROS");
    b.push(`Índice: ${parametros.indiceCorrecao} (${pct(taxaIndice)})`);
    b.push(`Termo inicial correção: ${parametros.termoInicialCorrecao}`);
    b.push(`Juros: ${parametros.jurosModelo} (${pct(taxaJuros)}/mês)`);
    b.push(`Termo inicial juros: ${parametros.termoInicialJuros}`);
    b.push("");
    b.push("5. MEMÓRIA DE CÁLCULO");
    parcelasCalculadas.forEach((p, i) => {
      b.push(`${i + 1}. ${p.descricao || "—"} | ${p.categoria} | ${p.dataVencimento || "—"} | Qtd: ${p.quantidade} | Unit: ${moeda(p.valorUnitario || 0)} | Principal: ${moeda(p.principal)} | Corrigido: ${moeda(p.valorCorrigido)} | Juros: ${moeda(p.juros)} | Total: ${moeda(p.totalParcela)}`);
      if (p.observacao?.trim()) b.push(`   Obs: ${p.observacao.trim()}`);
    });
    b.push(`Total principal: ${moeda(totalPrincipal)}`);
    b.push(`Total corrigido: ${moeda(totalCorrigido)}`);
    b.push(`Total de juros: ${moeda(totalJuros)}`);
    b.push(`Subtotal liquidado: ${moeda(subtotalLiquidado)}`);
    b.push("");
    b.push("6. HONORÁRIOS, CUSTAS E MULTA");
    b.push(`Honorários: ${honorarios.incluirHonorariosSucumbenciais ? `${pct(honorarios.percentualHonorarios)} = ${moeda(valorHonorarios)}` : "não incluídos"}`);
    b.push(`Custas: ${honorarios.incluirCustas ? moeda(valorCustas) : "não incluídas"}`);
    b.push(`Multa: ${honorarios.incluirMulta ? moeda(valorMulta) : "não incluída"}`);
    if (honorarios.observacao.trim()) b.push(`Obs: ${honorarios.observacao.trim()}`);
    b.push("");
    b.push("7. RESULTADO FINAL");
    b.push(`Total geral da liquidação: ${moeda(totalGeral)}`);
    b.push("");
    b.push("8. AUDITORIA");
    alertas.forEach((a, i) => b.push(`${i + 1}. ${a}`));
    b.push("");
    b.push("9. CONCLUSÃO");
    b.push("O presente demonstrativo foi estruturado para subsidiar a fase de liquidação de sentença, com discriminação do crédito, parâmetros de atualização e memória individualizada dos itens. Recomenda-se confrontar cada critério com o título judicial.");
    if (processo.observacoesGerais.trim()) b.push(`\nObservações: ${processo.observacoesGerais.trim()}`);
    return b.join("\n");
  }, [processo, sentenca, fundamentosSelecionados, parametros, taxaIndice, taxaJuros, parcelasCalculadas,
    totalPrincipal, totalCorrigido, totalJuros, subtotalLiquidado, honorarios,
    valorHonorarios, valorCustas, valorMulta, totalGeral, alertas]);

  function handleNovoCalculo() {
    setProcesso(processoInicial);
    setSentenca(sentencaInicial);
    setFundamentosSelecionados([baseFundamentos[0], baseFundamentos[3], baseFundamentos[5]]);
    setParametros(parametrosInicial);
    setParcelas([{ id: gerarId(), descricao: "Parcela principal da condenação", categoria: "principal",
      dataVencimento: new Date().toISOString().slice(0, 10), quantidade: 1, valorUnitario: 5000, observacao: "" }]);
    setHonorarios(honorariosInicial);
    setAbaAtiva("processo");
  }

  async function handleGeneratePdf() {
    setSavingPdf(true);
    const ok = await debitCredits(5, "Cível — Liquidação Estadual");
    if (!ok) { setSavingPdf(false); return; }

    const logoSrc = window.location.origin + veritasLogoUrl;
    const html = getLiquidacaoReportHtml({
      processo, sentenca, fundamentosSelecionados, parametros, taxaIndice, taxaJuros,
      termoDataJuros: termoDataJuros || "",
      parcelasCalculadas, totalPrincipal, totalCorrigido, totalJuros, subtotalLiquidado,
      honorarios, valorHonorarios, valorCustas, valorMulta, totalGeral,
      scoreConsistencia, alertas,
      userName: (user as any)?.nome || (user as any)?.email || "—",
      logoSrc,
    });

    const popup = window.open("", "_blank", "width=1100,height=900");
    if (!popup) {
      toast({ title: "Popup bloqueado", description: "Permita popups para este site e tente novamente.", variant: "destructive" });
      setSavingPdf(false);
      return;
    }
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    setSavingPdf(false);

    try {
      const calcState = { processo, sentenca, fundamentosSelecionados, parametros, parcelas, honorarios };
      const r = await fetch(`${BASE}/api/civil/save`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ calcState, modulo: "liquidacao-estadual" }),
      });
      if (r.ok) {
        const b = await r.json();
        const chave: string = b.publicKey;
        setChaveGerada(chave);
        try {
          const el = popup.document.getElementById("laudo-chave");
          if (el) el.textContent = `Chave: ${chave}`;
          const elF = popup.document.getElementById("laudo-chave-footer");
          if (elF) elF.innerHTML = `Chave de recuperação: <strong>${chave}</strong> — Veritas Analytics · ${new Date().toLocaleDateString("pt-BR")}`;
        } catch (_) { /* cross-origin seguro */ }
      }
    } catch { /* silencioso — chave é opcional */ }
  }

  async function handleRecoverCalculo() {
    const key = inputChave.trim().toUpperCase();
    if (!key) { toast({ title: "Digite a chave de recuperação.", variant: "destructive" }); return; }
    setLoadingRecover(true);
    try {
      const r = await fetch(`${BASE}/api/civil/recover/${key}`, { headers: getAuthHeaders() });
      if (!r.ok) {
        const b = await r.json();
        toast({ title: "Chave não encontrada", description: b.error ?? "Verifique a chave e tente novamente.", variant: "destructive" });
        return;
      }
      const b = await r.json();
      const s = b.calcState as any;
      if (s?.processo)              setProcesso(s.processo);
      if (s?.sentenca)              setSentenca(s.sentenca);
      if (s?.fundamentosSelecionados) setFundamentosSelecionados(s.fundamentosSelecionados);
      if (s?.parametros)            setParametros(s.parametros);
      if (s?.parcelas)              setParcelas(s.parcelas);
      if (s?.honorarios)            setHonorarios(s.honorarios);
      setChaveGerada(b.publicKey);
      setAbaAtiva("processo");
      toast({ title: "Cálculo recuperado!", description: `Chave: ${b.publicKey}` });
    } catch (e: any) {
      toast({ title: "Erro ao recuperar", description: e.message, variant: "destructive" });
    } finally {
      setLoadingRecover(false);
    }
  }

  const corBadge = (score: string) => {
    if (score === "robusto") return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (score === "razoável") return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-rose-100 text-rose-700 border-rose-200";
  };

  const abas: { key: AbaAtiva; label: string }[] = [
    { key: "processo", label: "Processo" },
    { key: "sentenca", label: "Sentença" },
    { key: "parametros", label: "Parâmetros" },
    { key: "parcelas", label: "Parcelas" },
    { key: "honorarios", label: "Honorários e custas" },
    { key: "auditoria", label: "Auditoria" },
    { key: "relatorio", label: "Relatório" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-6 text-white lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                Veritas Analytics — Estadual
              </p>
              <h1 className="mt-2 text-2xl font-bold lg:text-3xl">
                Liquidação de Sentença Estadual
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-200">
                Liquidação por cálculo, arbitramento ou procedimento comum com memória discriminada do crédito, atualização monetária, juros, honorários e relatório técnico-jurídico.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-3">
                <ResumoCard titulo="Principal" valor={moeda(totalPrincipal)} />
                <ResumoCard titulo="Subtotal liquidado" valor={moeda(subtotalLiquidado)} />
                <ResumoCard titulo="Total geral" valor={moeda(totalGeral)} destaque />
              </div>
              {loadingRecover && (
                <div className="flex items-center gap-2 rounded-md bg-blue-900/30 border border-blue-400/30 px-2.5 py-2 text-xs text-blue-200">
                  Recuperando cálculo…
                </div>
              )}
              {/* Recuperar cálculo por chave */}
              <div className="flex gap-2 items-center">
                <input
                  value={inputChave}
                  onChange={e => setInputChave(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleRecoverCalculo()}
                  placeholder="Chave de recuperação…"
                  className="flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400 min-w-0"
                />
                <button type="button" onClick={handleRecoverCalculo} disabled={loadingRecover}
                  className="rounded-xl bg-white/15 border border-white/30 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/25 transition shrink-0 disabled:opacity-50">
                  ↺
                </button>
              </div>
              {chaveGerada && (
                <div className="rounded-md bg-white/10 border border-white/20 px-2.5 py-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-white/60 font-medium">
                    🔑 Chave de Recuperação
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono font-bold text-white tracking-wider">{chaveGerada}</code>
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 text-[10px] text-white/60 hover:text-white border border-white/20 hover:bg-white/10 transition"
                      onClick={() => { navigator.clipboard.writeText(chaveGerada!); toast({ title: "Chave copiada!" }); }}
                    >📋</button>
                  </div>
                  <p className="text-[9px] text-white/40 leading-tight">Use esta chave para recuperar o cálculo a qualquer momento</p>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={handleNovoCalculo}
                  className="rounded-2xl border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition">
                  Novo Cálculo
                </button>
                <button type="button" onClick={handleGeneratePdf} disabled={savingPdf}
                  className="rounded-2xl bg-amber-500 px-5 py-2 text-sm font-bold text-white hover:bg-amber-600 transition shadow disabled:opacity-60">
                  {savingPdf ? "Salvando…" : "Gerar PDF — 5 créditos"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
            {abas.map(aba => (
              <button key={aba.key} type="button" onClick={() => setAbaAtiva(aba.key)}
                className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${abaAtiva === aba.key ? "bg-slate-900 text-white shadow" : "bg-white text-slate-700 hover:bg-slate-100"}`}>
                {aba.label}
              </button>
            ))}
          </div>

          <div className="p-4 lg:p-6">
            {abaAtiva === "processo" && (
              <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <CampoTexto label="Número do processo" value={processo.numeroProcesso} onChange={v => setProcesso({ ...processo, numeroProcesso: v })} />
                <CampoTexto label="Advogado(a) responsável" value={processo.advogadoResponsavel} onChange={v => setProcesso({ ...processo, advogadoResponsavel: v })} />
                <CampoTexto label="Autor(a)" value={processo.autor} onChange={v => setProcesso({ ...processo, autor: v })} />
                <CampoTexto label="Réu(ré)" value={processo.reu} onChange={v => setProcesso({ ...processo, reu: v })} />
                <CampoTexto label="Comarca" value={processo.comarca} onChange={v => setProcesso({ ...processo, comarca: v })} />
                <CampoTexto label="Vara" value={processo.vara} onChange={v => setProcesso({ ...processo, vara: v })} />
                <CampoTexto label="Tribunal" value={processo.tribunal} onChange={v => setProcesso({ ...processo, tribunal: v })} />
                <CampoSelect label="Tipo de liquidação" value={processo.tipoLiquidacao}
                  onChange={v => setProcesso({ ...processo, tipoLiquidacao: v as TipoLiquidacao })}
                  options={[
                    { label: "Por cálculo", value: "calculo" },
                    { label: "Por arbitramento", value: "arbitramento" },
                    { label: "Pelo procedimento comum", value: "artigos" },
                  ]} />
                <CampoSelect label="Natureza da obrigação" value={processo.naturezaObrigacao}
                  onChange={v => setProcesso({ ...processo, naturezaObrigacao: v as NaturezaObrigacao })}
                  options={[
                    { label: "Indenização civil", value: "indenizacao_civil" },
                    { label: "Contrato", value: "contrato" },
                    { label: "Servidor público", value: "servidor_publico" },
                    { label: "Obrigação periódica", value: "obrigacao_periodica" },
                    { label: "Outro", value: "outro" },
                  ]} />
                <CampoData label="Data do evento" value={processo.dataEvento} onChange={v => setProcesso({ ...processo, dataEvento: v })} />
                <CampoData label="Data da citação" value={processo.dataCitacao} onChange={v => setProcesso({ ...processo, dataCitacao: v })} />
                <CampoData label="Data da sentença" value={processo.dataSentenca} onChange={v => setProcesso({ ...processo, dataSentenca: v })} />
                <CampoData label="Data-base do cálculo" value={processo.dataBaseCalculo} onChange={v => setProcesso({ ...processo, dataBaseCalculo: v })} />
                <div className="lg:col-span-2">
                  <CampoAreaTexto label="Observações gerais" value={processo.observacoesGerais} onChange={v => setProcesso({ ...processo, observacoesGerais: v })} rows={4} />
                </div>
              </section>
            )}

            {abaAtiva === "sentenca" && (
              <section className="space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <CampoTexto label="Objeto da liquidação" value={sentenca.objetoLiquidacao} onChange={v => setSentenca({ ...sentenca, objetoLiquidacao: v })} />
                  <CampoTexto label="Critério principal definido na decisão" value={sentenca.criterioPrincipal} onChange={v => setSentenca({ ...sentenca, criterioPrincipal: v })} />
                </div>
                <CampoAreaTexto label="Trecho da sentença ou acórdão" value={sentenca.textoSentenca} onChange={v => setSentenca({ ...sentenca, textoSentenca: v })} rows={8} />
                <CampoAreaTexto label="Observações interpretativas" value={sentenca.observacoesInterpretativas} onChange={v => setSentenca({ ...sentenca, observacoesInterpretativas: v })} rows={5} />
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-lg font-semibold">Fundamentos aplicáveis</h2>
                  <p className="mt-1 text-sm text-slate-600">Selecione os dispositivos que devem constar no relatório.</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {baseFundamentos.map(texto => {
                    const marcado = fundamentosSelecionados.includes(texto);
                    return (
                      <label key={texto} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${marcado ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                        <input type="checkbox" className="mt-1 h-4 w-4" checked={marcado}
                          onChange={() => setFundamentosSelecionados(prev => prev.includes(texto) ? prev.filter(f => f !== texto) : [...prev, texto])} />
                        <span className="text-sm leading-6">{texto}</span>
                      </label>
                    );
                  })}
                </div>
              </section>
            )}

            {abaAtiva === "parametros" && (
              <section className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-lg font-semibold">Parâmetros financeiros</h2>
                  <p className="mt-1 text-sm text-slate-600">Versão demonstrativa com percentuais estimativos para simulação estratégica.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
                  <CampoSelect label="Índice de correção" value={parametros.indiceCorrecao}
                    onChange={v => setParametros({ ...parametros, indiceCorrecao: v as IndiceCorrecao })}
                    options={[
                      { label: "IPCA-E", value: "IPCA-E" },
                      { label: "INPC", value: "INPC" },
                      { label: "IGP-M", value: "IGP-M" },
                      { label: "TJMG (ICGJ)", value: "TJMG" },
                      { label: "SELIC", value: "SELIC" },
                      { label: "Manual", value: "Manual" },
                    ]} />
                  {parametros.indiceCorrecao === "Manual" && (
                    <CampoNumero label="Percentual manual de correção" value={parametros.percentualIndiceManual}
                      onChange={v => setParametros({ ...parametros, percentualIndiceManual: Number(v) })} />
                  )}
                  <CampoSelect label="Termo inicial da correção" value={parametros.termoInicialCorrecao}
                    onChange={v => setParametros({ ...parametros, termoInicialCorrecao: v as ParametrosFinanceiros["termoInicialCorrecao"] })}
                    options={[
                      { label: "Vencimento da parcela", value: "vencimento" },
                      { label: "Evento", value: "evento" },
                      { label: "Citação", value: "citacao" },
                      { label: "Sentença", value: "sentenca" },
                      { label: "Manual", value: "manual" },
                    ]} />
                  {parametros.termoInicialCorrecao === "manual" && (
                    <CampoData label="Data manual da correção" value={parametros.dataManualCorrecao}
                      onChange={v => setParametros({ ...parametros, dataManualCorrecao: v })} />
                  )}
                  <CampoSelect label="Modelo de juros" value={parametros.jurosModelo}
                    onChange={v => setParametros({ ...parametros, jurosModelo: v as ModeloJuros })}
                    options={[
                      { label: "1% ao mês", value: "1%_mes" },
                      { label: "SELIC (estimativa)", value: "SELIC" },
                      { label: "Sem juros", value: "sem_juros" },
                    ]} />
                  <CampoSelect label="Termo inicial dos juros" value={parametros.termoInicialJuros}
                    onChange={v => setParametros({ ...parametros, termoInicialJuros: v as TermoInicialJuros })}
                    options={[
                      { label: "Evento", value: "evento" },
                      { label: "Citação", value: "citacao" },
                      { label: "Sentença", value: "sentenca" },
                      { label: "Manual", value: "manual" },
                    ]} />
                  {parametros.termoInicialJuros === "manual" && (
                    <CampoData label="Data manual dos juros" value={parametros.dataManualJuros}
                      onChange={v => setParametros({ ...parametros, dataManualJuros: v })} />
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard titulo="Taxa estimada de correção" valor={pct(taxaIndice)} />
                  <MetricCard titulo="Taxa mensal de juros" valor={pct(taxaJuros)} />
                  <MetricCard titulo="Marco de juros" valor={termoDataJuros || "não definido"} />
                  <MetricCard titulo="Score de consistência" valor={scoreConsistencia} classe={corBadge(scoreConsistencia)} />
                </div>
              </section>
            )}

            {abaAtiva === "parcelas" && (
              <section className="space-y-4">
                <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Parcelas e itens liquidandos</h2>
                    <p className="mt-1 text-sm text-slate-600">Insira os valores base da condenação, diferenças ou itens periódicos.</p>
                  </div>
                  <button type="button" onClick={() => setParcelas(prev => [...prev, parcelaVazia()])}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                    + Adicionar parcela
                  </button>
                </div>
                <div className="space-y-4">
                  {parcelas.map((parcela, idx) => {
                    const calc = parcelasCalculadas.find(c => c.id === parcela.id);
                    return (
                      <div key={parcela.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-500">Parcela {idx + 1}</p>
                            <h3 className="text-base font-semibold">{parcela.descricao || "Parcela sem descrição"}</h3>
                          </div>
                          <button type="button" onClick={() => setParcelas(prev => prev.filter(p => p.id !== parcela.id))}
                            className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">
                            Remover
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
                          <CampoTexto label="Descrição" value={parcela.descricao}
                            onChange={v => setParcelas(prev => prev.map(p => p.id === parcela.id ? { ...p, descricao: v } : p))} />
                          <CampoTexto label="Categoria" value={parcela.categoria}
                            onChange={v => setParcelas(prev => prev.map(p => p.id === parcela.id ? { ...p, categoria: v } : p))} />
                          <CampoData label="Data de vencimento" value={parcela.dataVencimento}
                            onChange={v => setParcelas(prev => prev.map(p => p.id === parcela.id ? { ...p, dataVencimento: v } : p))} />
                          <CampoNumero label="Quantidade" value={parcela.quantidade}
                            onChange={v => setParcelas(prev => prev.map(p => p.id === parcela.id ? { ...p, quantidade: Number(v) } : p))} />
                          <CampoNumero label="Valor unitário" value={parcela.valorUnitario}
                            onChange={v => setParcelas(prev => prev.map(p => p.id === parcela.id ? { ...p, valorUnitario: Number(v) } : p))} />
                          <div className="xl:col-span-3">
                            <CampoAreaTexto label="Observação" value={parcela.observacao}
                              onChange={v => setParcelas(prev => prev.map(p => p.id === parcela.id ? { ...p, observacao: v } : p))} rows={3} />
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                          <MetricCard titulo="Principal" valor={moeda(calc?.principal || 0)} />
                          <MetricCard titulo="Meses de correção" valor={String(calc?.mesesCorrecao || 0)} />
                          <MetricCard titulo="Valor corrigido" valor={moeda(calc?.valorCorrigido || 0)} />
                          <MetricCard titulo="Juros" valor={moeda(calc?.juros || 0)} />
                          <MetricCard titulo="Total da parcela" valor={moeda(calc?.totalParcela || 0)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard titulo="Total principal" valor={moeda(totalPrincipal)} />
                  <MetricCard titulo="Total corrigido" valor={moeda(totalCorrigido)} />
                  <MetricCard titulo="Total de juros" valor={moeda(totalJuros)} />
                  <MetricCard titulo="Subtotal liquidado" valor={moeda(subtotalLiquidado)} />
                </div>
              </section>
            )}

            {abaAtiva === "honorarios" && (
              <section className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-lg font-semibold">Honorários, custas e multa</h2>
                  <p className="mt-1 text-sm text-slate-600">Ajuste conforme o título judicial e os critérios processuais do caso.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
                  <CampoCheckbox label="Incluir honorários sucumbenciais"
                    checked={honorarios.incluirHonorariosSucumbenciais}
                    onChange={v => setHonorarios({ ...honorarios, incluirHonorariosSucumbenciais: v })} />
                  {honorarios.incluirHonorariosSucumbenciais && (
                    <>
                      <CampoSelect label="Base de honorários" value={honorarios.baseHonorarios}
                        onChange={v => setHonorarios({ ...honorarios, baseHonorarios: v as HonorariosCustas["baseHonorarios"] })}
                        options={[
                          { label: "Total liquidado", value: "total_liquidado" },
                          { label: "Principal corrigido", value: "principal_corrigido" },
                        ]} />
                      <CampoNumero label="Percentual de honorários" value={honorarios.percentualHonorarios}
                        onChange={v => setHonorarios({ ...honorarios, percentualHonorarios: Number(v) })} />
                    </>
                  )}
                  <CampoCheckbox label="Incluir custas" checked={honorarios.incluirCustas}
                    onChange={v => setHonorarios({ ...honorarios, incluirCustas: v })} />
                  {honorarios.incluirCustas && (
                    <CampoNumero label="Valor das custas" value={honorarios.valorCustas}
                      onChange={v => setHonorarios({ ...honorarios, valorCustas: Number(v) })} />
                  )}
                  <CampoCheckbox label="Incluir multa" checked={honorarios.incluirMulta}
                    onChange={v => setHonorarios({ ...honorarios, incluirMulta: v })} />
                  {honorarios.incluirMulta && (
                    <CampoNumero label="Valor da multa" value={honorarios.valorMulta}
                      onChange={v => setHonorarios({ ...honorarios, valorMulta: Number(v) })} />
                  )}
                  <div className="lg:col-span-2 xl:col-span-4">
                    <CampoAreaTexto label="Observações" value={honorarios.observacao}
                      onChange={v => setHonorarios({ ...honorarios, observacao: v })} rows={4} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <MetricCard titulo="Base honorários" valor={moeda(baseHonorariosValor)} />
                  <MetricCard titulo="Honorários" valor={moeda(valorHonorarios)} />
                  <MetricCard titulo="Custas" valor={moeda(valorCustas)} />
                  <MetricCard titulo="Multa" valor={moeda(valorMulta)} />
                  <MetricCard titulo="Total geral" valor={moeda(totalGeral)} />
                </div>
              </section>
            )}

            {abaAtiva === "auditoria" && (
              <section className="space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <MetricCard titulo="Score de consistência" valor={scoreConsistencia} classe={corBadge(scoreConsistencia)} />
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-700">Leitura estratégica</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Esta auditoria interna ajuda a verificar se o demonstrativo está alinhado ao título judicial, à modalidade correta de liquidação e à discriminação do crédito exigida para a fase subsequente.
                    </p>
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-base font-semibold">Alertas automáticos</h3>
                  <ul className="mt-4 space-y-3">
                    {alertas.map(alerta => (
                      <li key={alerta} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{alerta}</li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {abaAtiva === "relatorio" && (
              <section className="space-y-4">
                <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Relatório técnico-jurídico</h2>
                    <p className="mt-1 text-sm text-slate-600">Memória textual consolidada da liquidação, pronta para adaptação à peça processual.</p>
                  </div>
                  <button type="button" onClick={handleGeneratePdf}
                    className="rounded-2xl bg-slate-900 px-5 py-2 text-sm font-bold text-white hover:bg-slate-800 transition">
                    Gerar PDF — 5 créditos
                  </button>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-slate-700">
                    {textoRelatorio}
                  </pre>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResumoCard({ titulo, valor, destaque = false }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${destaque ? "border-amber-300 bg-amber-50 text-slate-900" : "border-white/20 bg-white/10 text-white"}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${destaque ? "text-amber-700" : "text-slate-200"}`}>{titulo}</p>
      <p className="mt-1 text-lg font-bold">{valor}</p>
    </div>
  );
}

function MetricCard({ titulo, valor, classe = "bg-white text-slate-800 border-slate-200" }: { titulo: string; valor: string; classe?: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${classe}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{titulo}</p>
      <p className="mt-2 text-lg font-bold">{valor}</p>
    </div>
  );
}

function CampoTexto({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900" />
    </label>
  );
}

function CampoNumero({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input type="number" step="0.01" value={Number.isFinite(value) ? value : 0} onChange={e => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900" />
    </label>
  );
}

function CampoData({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900" />
    </label>
  );
}

function CampoSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { label: string; value: string }[] }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function CampoAreaTexto({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900" />
    </label>
  );
}

function CampoCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4" />
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </label>
  );
}
