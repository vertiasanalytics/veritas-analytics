import React, { useMemo, useState, useEffect } from "react";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useDebitCredits } from "@/hooks/use-wallet";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useSearch } from "wouter";
import veritasLogoUrl from "@assets/veritas_analytics_1775154424712.png";
import { buildVeritasReport } from "@/components/reports/VeritasReportLayout";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type NaturezaResponsabilidade = "contratual" | "extracontratual";
type TipoCalculo = "danos_emergentes" | "lucros_cessantes" | "ambos";
type IndiceCorrecao = "IPCA-E" | "INPC" | "IGP-M" | "TJMG" | "SELIC" | "Manual";
type ModeloJuros = "1%_mes" | "SELIC" | "sem_juros";
type Comprovacao = "robusta" | "parcial" | "ausente";

type Processo = {
  numeroProcesso: string;
  autor: string;
  reu: string;
  advogadoResponsavel: string;
  comarca: string;
  vara: string;
  naturezaResponsabilidade: NaturezaResponsabilidade;
  tipoCalculo: TipoCalculo;
  dataEvento: string;
  dataCitacao: string;
  dataBaseCalculo: string;
  observacoesGerais: string;
};

type ItemDanoEmergente = {
  id: string;
  descricao: string;
  categoria: string;
  dataDespesa: string;
  valorHistorico: number;
  comprovacao: Comprovacao;
  documento: string;
  observacao: string;
};

type PerfilLucro = "assalariado" | "autonomo" | "empresa" | "atividade_rural" | "prestador_servico";
type MetodoLucro = "renda_fixa" | "media_historica" | "lucro_liquido_historico" | "produtividade_perdida";

type LucroCessante = {
  perfil: PerfilLucro;
  metodo: MetodoLucro;
  dataInicio: string;
  dataFim: string;
  valorBaseMensal: number;
  mediaHistorica: number;
  lucroLiquidoMedio: number;
  produtividadeMensal: number;
  margemLiquidaPercentual: number;
  custosEvitados: number;
  observacaoTecnica: string;
};

type ParametrosFinanceiros = {
  indiceCorrecao: IndiceCorrecao;
  percentualIndiceManual: number;
  jurosModelo: ModeloJuros;
  termoInicialJuros: "evento" | "citacao" | "manual";
  dataManualJuros: string;
  percentualJurosMensalManual: number;
};

type AbaAtiva = "dados" | "fundamento" | "emergentes" | "lucros" | "financeiro" | "auditoria" | "relatorio";

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

function mesesEntre(a?: string, b?: string) {
  if (!a || !b) return 0;
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  if (!y1 || !m1 || !y2 || !m2) return 0;
  let meses = (y2 - y1) * 12 + (m2 - m1);
  if (d2 >= d1) meses += 1;
  return Math.max(0, meses);
}

function diffDias(a?: string, b?: string) {
  if (!a || !b) return 0;
  const ms = new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function mesesDecimais(a?: string, b?: string) {
  const d = diffDias(a, b);
  return d > 0 ? d / 30 : 0;
}

function calcularIndice(valor: number, pctual: number) {
  return valor * (1 + pctual / 100);
}

function calcularJurosSimples(base: number, taxaMensal: number, meses: number) {
  return base * (taxaMensal / 100) * meses;
}

function mesesJuros(proc: Processo, fin: ParametrosFinanceiros) {
  const dataInicial =
    fin.termoInicialJuros === "evento"
      ? proc.dataEvento
      : fin.termoInicialJuros === "citacao"
      ? proc.dataCitacao
      : fin.dataManualJuros;
  return { meses: mesesEntre(dataInicial, proc.dataBaseCalculo), dataInicial };
}

const baseTextoFundamento = [
  "Art. 186 do Código Civil: caracteriza o ato ilícito quando houver ação ou omissão voluntária, negligência ou imprudência que viole direito e cause dano a outrem.",
  "Art. 927 do Código Civil: estabelece o dever de indenizar aquele que causar dano a outrem.",
  "Art. 402 do Código Civil: as perdas e danos abrangem, além do que a vítima efetivamente perdeu, o que razoavelmente deixou de lucrar.",
  "Art. 389 do Código Civil: o inadimplemento gera perdas e danos, juros e atualização monetária.",
  "Art. 944 do Código Civil: a indenização mede-se pela extensão do dano.",
  "Súmula 54 do STJ: em responsabilidade extracontratual, os juros moratórios fluem desde o evento danoso.",
];

const emergenteVazio = (): ItemDanoEmergente => ({
  id: gerarId(), descricao: "", categoria: "geral", dataDespesa: "", valorHistorico: 0,
  comprovacao: "robusta", documento: "", observacao: "",
});

function getDanosMateriaisReportHtml(opts: {
  processo: Processo;
  fundamentosSelecionados: string[];
  itensEmergentes: ItemDanoEmergente[];
  subtotalEmergentesHist: number;
  subtotalEmergentesAtual: number;
  mesesLucro: number;
  baseMensalLucros: number;
  subtotalLucrosHist: number;
  subtotalLucrosAtual: number;
  baseAtualizadaTotal: number;
  totalJuros: number;
  totalFinal: number;
  taxaIndice: number;
  taxaJuros: number;
  infoJuros: { meses: number; dataInicial: string };
  financeiro: ParametrosFinanceiros;
  alertas: string[];
  userName: string;
  logoSrc: string;
}): string {
  const o = opts;
  const hoje = new Date().toLocaleDateString("pt-BR");
  const tipoLabel: Record<TipoCalculo, string> = {
    danos_emergentes: "Danos Emergentes",
    lucros_cessantes: "Lucros Cessantes",
    ambos: "Danos Emergentes + Lucros Cessantes",
  };
  const termoJurosLabel =
    o.financeiro.termoInicialJuros === "evento"
      ? `Evento danoso (${o.processo.dataEvento || "—"})`
      : o.financeiro.termoInicialJuros === "citacao"
      ? `Citação (${o.processo.dataCitacao || "—"})`
      : `Manual (${o.financeiro.dataManualJuros || "—"})`;

  const tdC = `style="border:1px solid #e2e8f0;padding:8px 10px;text-align:center;font-size:12px;"`;
  const tdL = `style="border:1px solid #e2e8f0;padding:8px 10px;text-align:left;font-size:12px;"`;
  const thS = `style="background:#17365d;color:#fff;padding:8px 10px;text-align:left;font-size:11px;font-weight:600;"`;

  const rowsEmergentes = o.itensEmergentes.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? "#f8fafc" : "#fff"}">
      <td ${tdC}>${i + 1}</td>
      <td ${tdL}>${item.descricao || "—"}</td>
      <td ${tdC}>${item.categoria}</td>
      <td ${tdC}>${item.dataDespesa || "—"}</td>
      <td ${tdC}>${moeda(item.valorHistorico || 0)}</td>
      <td ${tdC}>${moeda(calcularIndice(item.valorHistorico || 0, o.taxaIndice))}</td>
      <td ${tdC}>${item.comprovacao}</td>
    </tr>`).join("");

  const alertasHtml = o.alertas.map(a => `
    <li style="margin-bottom:6px;padding:8px 12px;background:#fffbeb;border-left:3px solid #f59e0b;font-size:12px;color:#78350f;">${a}</li>`).join("");

  const fundHtml = o.fundamentosSelecionados.map((f, i) => `
    <li style="margin-bottom:6px;font-size:12px;color:#374151;">${i + 1}. ${f}</li>`).join("");

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
      <div class="vr-title-bar-title">Relatório de Cálculo de Danos Materiais${o.processo.tipoCalculo !== "danos_emergentes" ? " (Danos Emergentes + Lucros Cessantes)" : ""}</div>
      <div class="vr-title-bar-chave" id="laudo-chave">aguardando…</div>
    </div>

    <div class="vr-meta">
      <div class="vr-meta-grid">
        <div><span class="vr-meta-label">Processo: </span><span class="vr-meta-value">${o.processo.numeroProcesso || "—"}</span></div>
        <div><span class="vr-meta-label">Advogado(a): </span><span class="vr-meta-value">${o.processo.advogadoResponsavel || "—"}</span></div>
        <div><span class="vr-meta-label">Autor(a): </span><span class="vr-meta-value">${o.processo.autor || "—"}</span></div>
        <div><span class="vr-meta-label">Réu(ré): </span><span class="vr-meta-value">${o.processo.reu || "—"}</span></div>
        <div><span class="vr-meta-label">Comarca/Vara: </span><span class="vr-meta-value">${o.processo.comarca || "—"} / ${o.processo.vara || "—"}</span></div>
        <div><span class="vr-meta-label">Tipo de cálculo: </span><span class="vr-meta-value">${tipoLabel[o.processo.tipoCalculo]}</span></div>
        <div><span class="vr-meta-label">Data do evento: </span><span class="vr-meta-value">${o.processo.dataEvento || "—"}</span></div>
        <div><span class="vr-meta-label">Data da citação: </span><span class="vr-meta-value">${o.processo.dataCitacao || "—"}</span></div>
        <div><span class="vr-meta-label">Data-base: </span><span class="vr-meta-value">${o.processo.dataBaseCalculo || "—"}</span></div>
        <div><span class="vr-meta-label">Natureza: </span><span class="vr-meta-value">${o.processo.naturezaResponsabilidade === "extracontratual" ? "Extracontratual" : "Contratual"}</span></div>
      </div>
    </div>

    <div class="vr-body">
      <div class="vr-section-title">Quadro-Resumo Financeiro</div>
      <div class="vr-kpi-row">
        <div class="vr-kpi"><div class="vr-kpi-label">Emergentes atualizados</div><div class="vr-kpi-value">${moeda(o.subtotalEmergentesAtual)}</div></div>
        <div class="vr-kpi"><div class="vr-kpi-label">Lucros cessantes atualizados</div><div class="vr-kpi-value">${moeda(o.subtotalLucrosAtual)}</div></div>
        <div class="vr-kpi primary"><div class="vr-kpi-label">Total final estimado</div><div class="vr-kpi-value">${moeda(o.totalFinal)}</div></div>
        <div class="vr-kpi"><div class="vr-kpi-label">Base atualizada (${o.financeiro.indiceCorrecao})</div><div class="vr-kpi-value">${moeda(o.baseAtualizadaTotal)}</div></div>
        <div class="vr-kpi"><div class="vr-kpi-label">Juros (${o.financeiro.jurosModelo})</div><div class="vr-kpi-value">${moeda(o.totalJuros)}</div></div>
        <div class="vr-kpi"><div class="vr-kpi-label">Meses de juros</div><div class="vr-kpi-value">${o.infoJuros.meses}</div></div>
      </div>

      <div class="vr-section-title">1. Fundamentos Jurídicos</div>
      <ul style="padding-left:16px;margin:8px 0;">${fundHtml}</ul>

      <div class="vr-section-title">2. Danos Emergentes</div>
      ${o.itensEmergentes.length === 0
        ? `<p style="font-size:12px;color:#64748b;">Não foram lançados itens de danos emergentes.</p>`
        : `<table>
          <thead><tr>
            <th class="center" style="width:40px;">#</th>
            <th>Descrição</th>
            <th class="center">Categoria</th>
            <th class="center">Data</th>
            <th class="right">Valor histórico</th>
            <th class="right">Valor atualizado</th>
            <th class="center">Comprovação</th>
          </tr></thead>
          <tbody>${rowsEmergentes}</tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="padding:7px 8px;font-weight:700;">Subtotal</td>
              <td class="right">${moeda(o.subtotalEmergentesHist)}</td>
              <td class="right">${moeda(o.subtotalEmergentesAtual)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>`}

      <div class="vr-section-title">3. Lucros Cessantes</div>
      ${o.processo.tipoCalculo === "danos_emergentes"
        ? `<p style="font-size:12px;color:#64748b;">Não aplicável conforme configuração do cálculo.</p>`
        : `<table>
          <tbody>
            <tr><td style="padding:7px 8px;font-weight:600;width:40%;background:#f8fafc;">Meses considerados</td><td style="padding:7px 8px;">${o.mesesLucro}</td></tr>
            <tr><td style="padding:7px 8px;font-weight:600;background:#f8fafc;">Base mensal adotada</td><td style="padding:7px 8px;">${moeda(o.baseMensalLucros)}</td></tr>
            <tr><td style="padding:7px 8px;font-weight:600;background:#f8fafc;">Subtotal histórico</td><td style="padding:7px 8px;">${moeda(o.subtotalLucrosHist)}</td></tr>
            <tr><td style="padding:7px 8px;font-weight:600;background:#f8fafc;">Subtotal atualizado (${o.financeiro.indiceCorrecao})</td><td style="padding:7px 8px;">${moeda(o.subtotalLucrosAtual)}</td></tr>
          </tbody>
        </table>`}

      <div class="vr-section-title">4. Atualização Monetária e Juros</div>
      <table>
        <tbody>
          <tr><td style="padding:7px 8px;font-weight:600;width:40%;background:#f8fafc;">Índice de correção</td><td style="padding:7px 8px;">${o.financeiro.indiceCorrecao} (estimativa: ${pct(o.taxaIndice)})</td></tr>
          <tr><td style="padding:7px 8px;font-weight:600;background:#f8fafc;">Modelo de juros</td><td style="padding:7px 8px;">${o.financeiro.jurosModelo} (${pct(o.taxaJuros)}/mês)</td></tr>
          <tr><td style="padding:7px 8px;font-weight:600;background:#f8fafc;">Termo inicial dos juros</td><td style="padding:7px 8px;">${termoJurosLabel}</td></tr>
          <tr><td style="padding:7px 8px;font-weight:600;background:#f8fafc;">Meses de incidência</td><td style="padding:7px 8px;">${o.infoJuros.meses}</td></tr>
          <tr><td style="padding:7px 8px;font-weight:600;background:#f8fafc;">Juros estimados</td><td style="padding:7px 8px;">${moeda(o.totalJuros)}</td></tr>
        </tbody>
      </table>

      <div class="vr-section-title">5. Auditoria e Alertas</div>
      ${o.alertas.length === 0
        ? `<div class="vr-info-box">ℹ Nenhuma inconsistência crítica detectada.</div>`
        : `<ul style="list-style:none;padding:0;margin:0;">${alertasHtml}</ul>`}

      <div class="vr-section-title">6. Conclusão</div>
      <div class="vr-paragraph">
        O presente demonstrativo foi elaborado para fins técnicos e estratégicos com base nas informações lançadas no módulo e nos fundamentos jurídicos selecionados. Os valores apresentados são estimativos e dependem da comprovação documental integral, dos índices oficiais de correção e da aplicação do entendimento jurisprudencial vigente. Recomenda-se a conferência antes da utilização processual definitiva.
      </div>
      ${o.processo.observacoesGerais ? `<div class="vr-notes" style="margin-top:10px;"><strong>Observações do caso:</strong> ${o.processo.observacoesGerais}</div>` : ""}

      <div class="vr-signature">
        <div class="vr-signature-line"></div>
        <div class="vr-signature-name">${o.userName}</div>
        <div class="vr-signature-role">Responsável pelo cálculo</div>
        <div class="vr-footer-chave" id="laudo-chave-footer">Chave de recuperação: <strong>aguardando…</strong> — Veritas Analytics · ${hoje}</div>
      </div>
      <div class="vr-footer">
        <span>Veritas Analytics — Plataforma de Cálculos Jurídicos e Periciais</span>
        <span>Emitido em ${hoje}</span>
      </div>
      <p class="vr-ressalva">Este documento é de natureza técnica e não substitui o parecer jurídico. Os valores são estimativos e devem ser conferidos com índices oficiais antes de utilização processual.</p>
    </div>`;

  return buildVeritasReport({ title: "Relatório de Cálculo de Danos Materiais", body });
}

export default function VeritasDanosEmergentes() {
  const { user } = useAuth();
  const debitCredits = useDebitCredits();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>("dados");

  const processoInicial: Processo = {
    numeroProcesso: "", autor: "", reu: "", advogadoResponsavel: "",
    comarca: "", vara: "", naturezaResponsabilidade: "extracontratual",
    tipoCalculo: "ambos", dataEvento: "", dataCitacao: "",
    dataBaseCalculo: new Date().toISOString().slice(0, 10), observacoesGerais: "",
  };

  const [processo, setProcesso] = useState<Processo>(processoInicial);

  const [fundamentosSelecionados, setFundamentosSelecionados] = useState<string[]>([...baseTextoFundamento]);

  const [itensEmergentes, setItensEmergentes] = useState<ItemDanoEmergente[]>([
    { id: gerarId(), descricao: "Despesas médicas iniciais", categoria: "medico",
      dataDespesa: new Date().toISOString().slice(0, 10), valorHistorico: 2500,
      comprovacao: "robusta", documento: "Recibos e notas fiscais", observacao: "" },
  ]);

  const [lucros, setLucros] = useState<LucroCessante>({
    perfil: "assalariado", metodo: "renda_fixa", dataInicio: "", dataFim: "",
    valorBaseMensal: 0, mediaHistorica: 0, lucroLiquidoMedio: 0,
    produtividadeMensal: 0, margemLiquidaPercentual: 20, custosEvitados: 0, observacaoTecnica: "",
  });

  const [financeiro, setFinanceiro] = useState<ParametrosFinanceiros>({
    indiceCorrecao: "IPCA-E", percentualIndiceManual: 10, jurosModelo: "1%_mes",
    termoInicialJuros: "evento", dataManualJuros: "", percentualJurosMensalManual: 1,
  });

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
        if (s?.processo)                setProcesso(s.processo);
        if (s?.fundamentosSelecionados) setFundamentosSelecionados(s.fundamentosSelecionados);
        if (s?.itensEmergentes)         setItensEmergentes(s.itensEmergentes);
        if (s?.lucros)                  setLucros(s.lucros);
        if (s?.financeiro)              setFinanceiro(s.financeiro);
        setChaveGerada(data.publicKey);
        toast({ title: "Cálculo recuperado", description: `Chave: ${data.publicKey}` });
      })
      .catch(() => toast({ title: "Chave não encontrada", description: key, variant: "destructive" }))
      .finally(() => setLoadingRecover(false));
  }, [searchString]);

  const taxaIndiceEstimativa = useMemo(() => {
    switch (financeiro.indiceCorrecao) {
      case "IPCA-E": return 8;
      case "INPC": return 7;
      case "TJMG": return 8;
      case "IGP-M": return 6;
      case "SELIC": return 12;
      case "Manual": return financeiro.percentualIndiceManual;
      default: return 0;
    }
  }, [financeiro]);

  const taxaJurosMensal = useMemo(() => {
    switch (financeiro.jurosModelo) {
      case "1%_mes": return 1;
      case "SELIC": return 0.85;
      case "sem_juros": return 0;
      default: return financeiro.percentualJurosMensalManual;
    }
  }, [financeiro]);

  const subtotalEmergentesHist = useMemo(
    () => itensEmergentes.reduce((s, i) => s + (Number(i.valorHistorico) || 0), 0),
    [itensEmergentes]
  );

  const subtotalEmergentesAtual = useMemo(
    () => itensEmergentes.reduce((s, i) => s + calcularIndice(Number(i.valorHistorico) || 0, taxaIndiceEstimativa), 0),
    [itensEmergentes, taxaIndiceEstimativa]
  );

  const mesesLucro = useMemo(
    () => mesesEntre(lucros.dataInicio, lucros.dataFim) || Math.ceil(mesesDecimais(lucros.dataInicio, lucros.dataFim)),
    [lucros.dataInicio, lucros.dataFim]
  );

  const baseMensalLucros = useMemo(() => {
    switch (lucros.metodo) {
      case "renda_fixa": return Number(lucros.valorBaseMensal) || 0;
      case "media_historica": return Number(lucros.mediaHistorica) || 0;
      case "lucro_liquido_historico": return Number(lucros.lucroLiquidoMedio) || 0;
      case "produtividade_perdida":
        return ((Number(lucros.produtividadeMensal) || 0) * (Number(lucros.margemLiquidaPercentual) || 0)) / 100;
      default: return 0;
    }
  }, [lucros]);

  const subtotalLucrosHist = useMemo(
    () => Math.max(0, baseMensalLucros * mesesLucro - (Number(lucros.custosEvitados) || 0)),
    [baseMensalLucros, mesesLucro, lucros.custosEvitados]
  );

  const subtotalLucrosAtual = useMemo(
    () => calcularIndice(subtotalLucrosHist, taxaIndiceEstimativa),
    [subtotalLucrosHist, taxaIndiceEstimativa]
  );

  const baseAtualizadaTotal = useMemo(() => {
    if (processo.tipoCalculo === "danos_emergentes") return subtotalEmergentesAtual;
    if (processo.tipoCalculo === "lucros_cessantes") return subtotalLucrosAtual;
    return subtotalEmergentesAtual + subtotalLucrosAtual;
  }, [processo.tipoCalculo, subtotalEmergentesAtual, subtotalLucrosAtual]);

  const infoJuros = useMemo(() => mesesJuros(processo, financeiro), [processo, financeiro]);

  const totalJuros = useMemo(() => {
    if (financeiro.jurosModelo === "sem_juros") return 0;
    return calcularJurosSimples(baseAtualizadaTotal, taxaJurosMensal, infoJuros.meses);
  }, [financeiro.jurosModelo, baseAtualizadaTotal, taxaJurosMensal, infoJuros.meses]);

  const totalFinal = useMemo(() => baseAtualizadaTotal + totalJuros, [baseAtualizadaTotal, totalJuros]);

  const scoreProvaEmergentes = useMemo(() => {
    if (itensEmergentes.length === 0) return "frágil";
    const robustos = itensEmergentes.filter(i => i.comprovacao === "robusta").length;
    const ausentes = itensEmergentes.filter(i => i.comprovacao === "ausente").length;
    if (robustos === itensEmergentes.length) return "robusto";
    if (ausentes > 0) return "frágil";
    return "razoável";
  }, [itensEmergentes]);

  const scoreProvaLucros = useMemo(() => {
    if (!lucros.dataInicio || !lucros.dataFim) return "frágil";
    if (lucros.metodo === "lucro_liquido_historico" && lucros.lucroLiquidoMedio > 0 && lucros.observacaoTecnica.trim()) return "robusto";
    if (lucros.metodo === "renda_fixa" && lucros.valorBaseMensal > 0 && lucros.observacaoTecnica.trim()) return "razoável";
    if (lucros.metodo === "media_historica" && lucros.mediaHistorica > 0 && lucros.observacaoTecnica.trim()) return "razoável";
    return "frágil";
  }, [lucros]);

  const alertasAuditoria = useMemo(() => {
    const alertas: string[] = [];
    if (!processo.dataEvento) alertas.push("Informe a data do evento danoso para fortalecer a coerência temporal do cálculo.");
    if (processo.naturezaResponsabilidade === "extracontratual" && financeiro.termoInicialJuros !== "evento")
      alertas.push("Responsabilidade extracontratual detectada. Os juros podem ser exigíveis desde o evento danoso (Súmula 54/STJ).");
    if (scoreProvaEmergentes === "frágil")
      alertas.push("Há itens de danos emergentes sem comprovação robusta. Reforce os documentos comprobatórios.");
    if (lucros.metodo === "produtividade_perdida" && !lucros.observacaoTecnica.trim())
      alertas.push("A metodologia por produtividade perdida requer justificativa técnica para reduzir o risco de impugnação.");
    if (lucros.metodo !== "renda_fixa" && lucros.custosEvitados <= 0)
      alertas.push("Avalie a dedução de custos evitados nos lucros cessantes para aproximar a base ao lucro líquido.");
    if (mesesLucro > 24)
      alertas.push("O período de lucros cessantes supera 24 meses. Recomenda-se reforço probatório.");
    if (scoreProvaLucros === "frágil")
      alertas.push("Lucros cessantes com lastro probatório ou metodológico insuficiente. Complemente a documentação.");
    if (!processo.dataBaseCalculo) alertas.push("Defina a data-base do cálculo para atualização monetária e juros.");
    if (alertas.length === 0) alertas.push("Nenhuma inconsistência crítica detectada. Revise os parâmetros financeiros e a base documental.");
    return alertas;
  }, [processo, financeiro, scoreProvaEmergentes, scoreProvaLucros, lucros, mesesLucro]);

  const textoRelatorio = useMemo(() => {
    const termoJuros =
      financeiro.termoInicialJuros === "evento"
        ? `data do evento danoso (${processo.dataEvento || "não informada"})`
        : financeiro.termoInicialJuros === "citacao"
        ? `data da citação (${processo.dataCitacao || "não informada"})`
        : `data manual (${financeiro.dataManualJuros || "não informada"})`;

    const b: string[] = [];
    b.push(`RELATÓRIO DE CÁLCULO – DANOS MATERIAIS`);
    b.push(``);
    b.push(`1. IDENTIFICAÇÃO DO CASO`);
    b.push(`Processo: ${processo.numeroProcesso || "—"}`);
    b.push(`Autor(a): ${processo.autor || "—"}`);
    b.push(`Réu(ré): ${processo.reu || "—"}`);
    b.push(`Advogado(a): ${processo.advogadoResponsavel || "—"}`);
    b.push(`Comarca/Vara: ${processo.comarca || "-"} / ${processo.vara || "-"}`);
    b.push(`Natureza: ${processo.naturezaResponsabilidade}`);
    b.push(`Tipo de cálculo: ${processo.tipoCalculo}`);
    b.push(`Data do evento: ${processo.dataEvento || "—"}`);
    b.push(`Data da citação: ${processo.dataCitacao || "—"}`);
    b.push(`Data-base: ${processo.dataBaseCalculo || "—"}`);
    b.push(``);
    b.push(`2. FUNDAMENTOS LEGAIS`);
    fundamentosSelecionados.forEach((f, i) => b.push(`${i + 1}. ${f}`));
    b.push(``);
    b.push(`3. DANOS EMERGENTES`);
    if (itensEmergentes.length === 0) {
      b.push(`Não foram lançados itens.`);
    } else {
      itensEmergentes.forEach((item, i) =>
        b.push(`${i + 1}. ${item.descricao || "—"} | ${item.categoria} | ${item.dataDespesa || "—"} | ${moeda(item.valorHistorico || 0)} | ${item.comprovacao}`)
      );
      b.push(`Subtotal histórico: ${moeda(subtotalEmergentesHist)}`);
      b.push(`Subtotal atualizado (${financeiro.indiceCorrecao}): ${moeda(subtotalEmergentesAtual)}`);
    }
    b.push(``);
    b.push(`4. LUCROS CESSANTES`);
    if (processo.tipoCalculo === "danos_emergentes") {
      b.push(`Não aplicável.`);
    } else {
      b.push(`Perfil: ${lucros.perfil} | Método: ${lucros.metodo}`);
      b.push(`Período: ${lucros.dataInicio || "—"} a ${lucros.dataFim || "—"} (${mesesLucro} meses)`);
      b.push(`Base mensal: ${moeda(baseMensalLucros)} | Custos evitados: ${moeda(lucros.custosEvitados || 0)}`);
      b.push(`Subtotal histórico: ${moeda(subtotalLucrosHist)}`);
      b.push(`Subtotal atualizado: ${moeda(subtotalLucrosAtual)}`);
      if (lucros.observacaoTecnica.trim()) b.push(`Observação técnica: ${lucros.observacaoTecnica.trim()}`);
    }
    b.push(``);
    b.push(`5. ATUALIZAÇÃO E JUROS`);
    b.push(`Índice: ${financeiro.indiceCorrecao} (${pct(taxaIndiceEstimativa)})`);
    b.push(`Juros: ${financeiro.jurosModelo} (${pct(taxaJurosMensal)}/mês)`);
    b.push(`Termo inicial: ${termoJuros} | Meses: ${infoJuros.meses}`);
    b.push(`Juros estimados: ${moeda(totalJuros)}`);
    b.push(``);
    b.push(`6. QUADRO-RESUMO`);
    b.push(`Base atualizada total: ${moeda(baseAtualizadaTotal)}`);
    b.push(`Juros: ${moeda(totalJuros)}`);
    b.push(`TOTAL FINAL ESTIMADO: ${moeda(totalFinal)}`);
    b.push(``);
    b.push(`7. AUDITORIA`);
    alertasAuditoria.forEach((a, i) => b.push(`${i + 1}. ${a}`));
    b.push(``);
    b.push(`8. CONCLUSÃO`);
    b.push(`O presente demonstrativo foi elaborado para fins técnicos e estratégicos. Os valores são estimativos e devem ser conferidos com índices e documentos oficiais antes da utilização processual definitiva.`);
    if (processo.observacoesGerais.trim()) b.push(`\nObservações: ${processo.observacoesGerais.trim()}`);
    return b.join("\n");
  }, [processo, fundamentosSelecionados, itensEmergentes, subtotalEmergentesHist, subtotalEmergentesAtual,
    financeiro, lucros, mesesLucro, baseMensalLucros, subtotalLucrosHist, subtotalLucrosAtual,
    taxaIndiceEstimativa, taxaJurosMensal, infoJuros.meses, baseAtualizadaTotal, totalJuros, totalFinal, alertasAuditoria]);

  function adicionarItemEmergente() {
    setItensEmergentes(prev => [...prev, emergenteVazio()]);
  }

  function removerItemEmergente(id: string) {
    setItensEmergentes(prev => prev.filter(i => i.id !== id));
  }

  function atualizarItemEmergente(id: string, campo: keyof ItemDanoEmergente, valor: string | number) {
    setItensEmergentes(prev => prev.map(i => (i.id === id ? { ...i, [campo]: valor } : i)));
  }

  function alternarFundamento(texto: string) {
    setFundamentosSelecionados(prev =>
      prev.includes(texto) ? prev.filter(f => f !== texto) : [...prev, texto]
    );
  }

  function handleNovoCalculo() {
    setProcesso(processoInicial);
    setFundamentosSelecionados([...baseTextoFundamento]);
    setItensEmergentes([emergenteVazio()]);
    setLucros({ perfil: "assalariado", metodo: "renda_fixa", dataInicio: "", dataFim: "",
      valorBaseMensal: 0, mediaHistorica: 0, lucroLiquidoMedio: 0,
      produtividadeMensal: 0, margemLiquidaPercentual: 20, custosEvitados: 0, observacaoTecnica: "" });
    setFinanceiro({ indiceCorrecao: "IPCA-E", percentualIndiceManual: 10, jurosModelo: "1%_mes",
      termoInicialJuros: "evento", dataManualJuros: "", percentualJurosMensalManual: 1 });
    setAbaAtiva("dados");
  }

  async function handleGeneratePdf() {
    setSavingPdf(true);
    const ok = await debitCredits(5, "Cível — Danos Materiais");
    if (!ok) { setSavingPdf(false); return; }

    const logoSrc = window.location.origin + veritasLogoUrl;
    const html = getDanosMateriaisReportHtml({
      processo, fundamentosSelecionados, itensEmergentes,
      subtotalEmergentesHist, subtotalEmergentesAtual,
      mesesLucro, baseMensalLucros, subtotalLucrosHist, subtotalLucrosAtual,
      baseAtualizadaTotal, totalJuros, totalFinal,
      taxaIndice: taxaIndiceEstimativa, taxaJuros: taxaJurosMensal,
      infoJuros, financeiro, alertas: alertasAuditoria,
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
      const calcState = { processo, fundamentosSelecionados, itensEmergentes, lucros, financeiro };
      const r = await fetch(`${BASE}/api/civil/save`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ calcState, modulo: "danos-materiais" }),
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
      if (s?.processo)             setProcesso(s.processo);
      if (s?.fundamentosSelecionados) setFundamentosSelecionados(s.fundamentosSelecionados);
      if (s?.itensEmergentes)      setItensEmergentes(s.itensEmergentes);
      if (s?.lucros)               setLucros(s.lucros);
      if (s?.financeiro)           setFinanceiro(s.financeiro);
      setChaveGerada(b.publicKey);
      setAbaAtiva("dados");
      toast({ title: "Cálculo recuperado!", description: `Chave: ${b.publicKey}` });
    } catch (e: any) {
      toast({ title: "Erro ao recuperar", description: e.message, variant: "destructive" });
    } finally {
      setLoadingRecover(false);
    }
  }

  const badgeCor = (score: string) => {
    if (score === "robusto") return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (score === "razoável") return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-rose-100 text-rose-700 border-rose-200";
  };

  const abas: { key: AbaAtiva; label: string }[] = [
    { key: "dados", label: "Dados do caso" },
    { key: "fundamento", label: "Fundamento legal" },
    { key: "emergentes", label: "Danos emergentes" },
    { key: "lucros", label: "Lucros cessantes" },
    { key: "financeiro", label: "Atualização e juros" },
    { key: "auditoria", label: "Auditoria" },
    { key: "relatorio", label: "Relatório" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 p-6 text-white lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                Veritas Analytics — Cível
              </p>
              <h1 className="mt-2 text-2xl font-bold lg:text-3xl">
                Cálculo de Danos Materiais
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-200">
                Apuração de danos emergentes e lucros cessantes com parâmetros financeiros, auditoria jurídica interna e relatório técnico.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-3">
                <ResumoCard titulo="Emergentes atualizados" valor={moeda(subtotalEmergentesAtual)} />
                <ResumoCard titulo="Lucros atualizados" valor={moeda(subtotalLucrosAtual)} />
                <ResumoCard titulo="Total estimado" valor={moeda(totalFinal)} destaque />
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
                <button
                  type="button"
                  onClick={handleRecoverCalculo}
                  disabled={loadingRecover}
                  className="rounded-xl bg-white/15 border border-white/30 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/25 transition shrink-0 disabled:opacity-50"
                >
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
                <button
                  type="button"
                  onClick={handleNovoCalculo}
                  className="rounded-2xl border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
                >
                  Novo Cálculo
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePdf}
                  disabled={savingPdf}
                  className="rounded-2xl bg-amber-500 px-5 py-2 text-sm font-bold text-white hover:bg-amber-600 transition shadow disabled:opacity-60"
                >
                  {savingPdf ? "Salvando…" : "Gerar PDF — 5 créditos"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
            {abas.map(aba => (
              <button
                key={aba.key}
                type="button"
                onClick={() => setAbaAtiva(aba.key)}
                className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                  abaAtiva === aba.key ? "bg-slate-900 text-white shadow" : "bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {aba.label}
              </button>
            ))}
          </div>

          <div className="p-4 lg:p-6">
            {abaAtiva === "dados" && (
              <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <CampoTexto label="Número do processo" value={processo.numeroProcesso} onChange={v => setProcesso({ ...processo, numeroProcesso: v })} />
                <CampoTexto label="Advogado(a) responsável" value={processo.advogadoResponsavel} onChange={v => setProcesso({ ...processo, advogadoResponsavel: v })} />
                <CampoTexto label="Autor(a)" value={processo.autor} onChange={v => setProcesso({ ...processo, autor: v })} />
                <CampoTexto label="Réu(ré)" value={processo.reu} onChange={v => setProcesso({ ...processo, reu: v })} />
                <CampoTexto label="Comarca" value={processo.comarca} onChange={v => setProcesso({ ...processo, comarca: v })} />
                <CampoTexto label="Vara" value={processo.vara} onChange={v => setProcesso({ ...processo, vara: v })} />
                <CampoSelect
                  label="Natureza da responsabilidade"
                  value={processo.naturezaResponsabilidade}
                  onChange={v => setProcesso({ ...processo, naturezaResponsabilidade: v as NaturezaResponsabilidade })}
                  options={[
                    { label: "Contratual", value: "contratual" },
                    { label: "Extracontratual", value: "extracontratual" },
                  ]}
                />
                <CampoSelect
                  label="Tipo de cálculo"
                  value={processo.tipoCalculo}
                  onChange={v => setProcesso({ ...processo, tipoCalculo: v as TipoCalculo })}
                  options={[
                    { label: "Danos emergentes", value: "danos_emergentes" },
                    { label: "Lucros cessantes", value: "lucros_cessantes" },
                    { label: "Ambos", value: "ambos" },
                  ]}
                />
                <CampoData label="Data do evento danoso" value={processo.dataEvento} onChange={v => setProcesso({ ...processo, dataEvento: v })} />
                <CampoData label="Data da citação" value={processo.dataCitacao} onChange={v => setProcesso({ ...processo, dataCitacao: v })} />
                <CampoData label="Data-base do cálculo" value={processo.dataBaseCalculo} onChange={v => setProcesso({ ...processo, dataBaseCalculo: v })} />
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-700">Sugestão automática</p>
                  <p className="mt-2 text-sm text-slate-600">
                    {processo.naturezaResponsabilidade === "extracontratual"
                      ? "Responsabilidade extracontratual: o módulo sugere, em tese, termo inicial dos juros desde o evento danoso."
                      : "Responsabilidade contratual: avalie a incidência de juros a partir da citação ou do inadimplemento."}
                  </p>
                </div>
                <div className="lg:col-span-2">
                  <CampoAreaTexto label="Observações gerais" value={processo.observacoesGerais} onChange={v => setProcesso({ ...processo, observacoesGerais: v })} rows={4} />
                </div>
              </section>
            )}

            {abaAtiva === "fundamento" && (
              <section className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-lg font-semibold">Seleção de fundamentos jurídicos</h2>
                  <p className="mt-1 text-sm text-slate-600">Marque os fundamentos que devem constar no relatório técnico.</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {baseTextoFundamento.map(texto => {
                    const marcado = fundamentosSelecionados.includes(texto);
                    return (
                      <label key={texto} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${marcado ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                        <input type="checkbox" className="mt-1 h-4 w-4" checked={marcado} onChange={() => alternarFundamento(texto)} />
                        <span className="text-sm leading-6">{texto}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-700">Prévia selecionada</p>
                  <ul className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
                    {fundamentosSelecionados.map(f => <li key={f}>{f}</li>)}
                  </ul>
                </div>
              </section>
            )}

            {abaAtiva === "emergentes" && (
              <section className="space-y-4">
                <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Danos emergentes</h2>
                    <p className="mt-1 text-sm text-slate-600">Lance as perdas efetivas com data, valor histórico e grau de comprovação.</p>
                  </div>
                  <button type="button" onClick={adicionarItemEmergente} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                    + Adicionar item
                  </button>
                </div>
                <div className="space-y-4">
                  {itensEmergentes.map((item, idx) => (
                    <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-500">Item {idx + 1}</p>
                          <h3 className="text-base font-semibold">{item.descricao || "Dano emergente sem descrição"}</h3>
                        </div>
                        <button type="button" onClick={() => removerItemEmergente(item.id)} className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">
                          Remover
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
                        <CampoTexto label="Descrição" value={item.descricao} onChange={v => atualizarItemEmergente(item.id, "descricao", v)} />
                        <CampoTexto label="Categoria" value={item.categoria} onChange={v => atualizarItemEmergente(item.id, "categoria", v)} />
                        <CampoData label="Data da despesa" value={item.dataDespesa} onChange={v => atualizarItemEmergente(item.id, "dataDespesa", v)} />
                        <CampoNumero label="Valor histórico" value={item.valorHistorico} onChange={v => atualizarItemEmergente(item.id, "valorHistorico", Number(v))} />
                        <CampoSelect
                          label="Comprovação"
                          value={item.comprovacao}
                          onChange={v => atualizarItemEmergente(item.id, "comprovacao", v)}
                          options={[
                            { label: "Robusta", value: "robusta" },
                            { label: "Parcial", value: "parcial" },
                            { label: "Ausente", value: "ausente" },
                          ]}
                        />
                        <CampoTexto label="Documento" value={item.documento} onChange={v => atualizarItemEmergente(item.id, "documento", v)} />
                        <div className="xl:col-span-2">
                          <CampoAreaTexto label="Observação" value={item.observacao} onChange={v => atualizarItemEmergente(item.id, "observacao", v)} rows={3} />
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <MetricCard titulo="Valor histórico" valor={moeda(item.valorHistorico || 0)} />
                        <MetricCard titulo={`Valor atualizado (${financeiro.indiceCorrecao})`} valor={moeda(calcularIndice(item.valorHistorico || 0, taxaIndiceEstimativa))} />
                        <MetricCard titulo="Comprovação" valor={item.comprovacao} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <MetricCard titulo="Subtotal histórico" valor={moeda(subtotalEmergentesHist)} />
                  <MetricCard titulo={`Subtotal atualizado (${financeiro.indiceCorrecao})`} valor={moeda(subtotalEmergentesAtual)} />
                  <MetricCard titulo="Score probatório" valor={scoreProvaEmergentes} classe={badgeCor(scoreProvaEmergentes)} />
                </div>
              </section>
            )}

            {abaAtiva === "lucros" && (
              <section className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-lg font-semibold">Lucros cessantes</h2>
                  <p className="mt-1 text-sm text-slate-600">Selecione o perfil econômico e a metodologia de apuração.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
                  <CampoSelect
                    label="Perfil econômico"
                    value={lucros.perfil}
                    onChange={v => setLucros({ ...lucros, perfil: v as PerfilLucro })}
                    options={[
                      { label: "Assalariado", value: "assalariado" },
                      { label: "Autônomo", value: "autonomo" },
                      { label: "Empresa", value: "empresa" },
                      { label: "Atividade rural", value: "atividade_rural" },
                      { label: "Prestador de serviço", value: "prestador_servico" },
                    ]}
                  />
                  <CampoSelect
                    label="Metodologia"
                    value={lucros.metodo}
                    onChange={v => setLucros({ ...lucros, metodo: v as MetodoLucro })}
                    options={[
                      { label: "Renda fixa", value: "renda_fixa" },
                      { label: "Média histórica", value: "media_historica" },
                      { label: "Lucro líquido histórico", value: "lucro_liquido_historico" },
                      { label: "Produtividade perdida", value: "produtividade_perdida" },
                    ]}
                  />
                  <CampoData label="Data inicial" value={lucros.dataInicio} onChange={v => setLucros({ ...lucros, dataInicio: v })} />
                  <CampoData label="Data final" value={lucros.dataFim} onChange={v => setLucros({ ...lucros, dataFim: v })} />
                  {lucros.metodo === "renda_fixa" && (
                    <CampoNumero label="Renda líquida mensal" value={lucros.valorBaseMensal} onChange={v => setLucros({ ...lucros, valorBaseMensal: Number(v) })} />
                  )}
                  {lucros.metodo === "media_historica" && (
                    <CampoNumero label="Média histórica mensal" value={lucros.mediaHistorica} onChange={v => setLucros({ ...lucros, mediaHistorica: Number(v) })} />
                  )}
                  {lucros.metodo === "lucro_liquido_historico" && (
                    <CampoNumero label="Lucro líquido médio mensal" value={lucros.lucroLiquidoMedio} onChange={v => setLucros({ ...lucros, lucroLiquidoMedio: Number(v) })} />
                  )}
                  {lucros.metodo === "produtividade_perdida" && (
                    <>
                      <CampoNumero label="Produtividade mensal (receita ou produção)" value={lucros.produtividadeMensal} onChange={v => setLucros({ ...lucros, produtividadeMensal: Number(v) })} />
                      <CampoNumero label="Margem líquida %" value={lucros.margemLiquidaPercentual} onChange={v => setLucros({ ...lucros, margemLiquidaPercentual: Number(v) })} />
                    </>
                  )}
                  <CampoNumero label="Custos evitados" value={lucros.custosEvitados} onChange={v => setLucros({ ...lucros, custosEvitados: Number(v) })} />
                  <div className="lg:col-span-2 xl:col-span-4">
                    <CampoAreaTexto label="Observação técnica" value={lucros.observacaoTecnica} onChange={v => setLucros({ ...lucros, observacaoTecnica: v })} rows={5} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <MetricCard titulo="Meses considerados" valor={String(mesesLucro)} />
                  <MetricCard titulo="Base mensal adotada" valor={moeda(baseMensalLucros)} />
                  <MetricCard titulo="Subtotal histórico" valor={moeda(subtotalLucrosHist)} />
                  <MetricCard titulo={`Subtotal atualizado (${financeiro.indiceCorrecao})`} valor={moeda(subtotalLucrosAtual)} />
                  <MetricCard titulo="Score probatório" valor={scoreProvaLucros} classe={badgeCor(scoreProvaLucros)} />
                </div>
              </section>
            )}

            {abaAtiva === "financeiro" && (
              <section className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-lg font-semibold">Atualização monetária e juros</h2>
                  <p className="mt-1 text-sm text-slate-600">Nesta versão, o módulo opera com percentuais estimativos para simulação estratégica.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
                  <CampoSelect
                    label="Índice de correção"
                    value={financeiro.indiceCorrecao}
                    onChange={v => setFinanceiro({ ...financeiro, indiceCorrecao: v as IndiceCorrecao })}
                    options={[
                      { label: "IPCA-E", value: "IPCA-E" },
                      { label: "INPC", value: "INPC" },
                      { label: "IGP-M", value: "IGP-M" },
                      { label: "TJMG (ICGJ)", value: "TJMG" },
                      { label: "SELIC", value: "SELIC" },
                      { label: "Manual", value: "Manual" },
                    ]}
                  />
                  {financeiro.indiceCorrecao === "Manual" && (
                    <CampoNumero label="Percentual manual de correção" value={financeiro.percentualIndiceManual} onChange={v => setFinanceiro({ ...financeiro, percentualIndiceManual: Number(v) })} />
                  )}
                  <CampoSelect
                    label="Modelo de juros"
                    value={financeiro.jurosModelo}
                    onChange={v => setFinanceiro({ ...financeiro, jurosModelo: v as ModeloJuros })}
                    options={[
                      { label: "1% ao mês", value: "1%_mes" },
                      { label: "SELIC (estimativa mensal)", value: "SELIC" },
                      { label: "Sem juros", value: "sem_juros" },
                    ]}
                  />
                  <CampoSelect
                    label="Termo inicial dos juros"
                    value={financeiro.termoInicialJuros}
                    onChange={v => setFinanceiro({ ...financeiro, termoInicialJuros: v as "evento" | "citacao" | "manual" })}
                    options={[
                      { label: "Evento danoso", value: "evento" },
                      { label: "Citação", value: "citacao" },
                      { label: "Manual", value: "manual" },
                    ]}
                  />
                  {financeiro.termoInicialJuros === "manual" && (
                    <CampoData label="Data manual dos juros" value={financeiro.dataManualJuros} onChange={v => setFinanceiro({ ...financeiro, dataManualJuros: v })} />
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard titulo="Taxa de correção estimada" valor={pct(taxaIndiceEstimativa)} />
                  <MetricCard titulo="Taxa mensal de juros" valor={pct(taxaJurosMensal)} />
                  <MetricCard titulo="Meses de juros" valor={String(infoJuros.meses)} />
                  <MetricCard titulo="Juros estimados" valor={moeda(totalJuros)} />
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <h3 className="text-base font-semibold">Quadro de composição</h3>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard titulo="Emergentes atualizados" valor={moeda(subtotalEmergentesAtual)} />
                    <MetricCard titulo="Lucros atualizados" valor={moeda(subtotalLucrosAtual)} />
                    <MetricCard titulo="Base atualizada total" valor={moeda(baseAtualizadaTotal)} />
                    <MetricCard titulo="Total final estimado" valor={moeda(totalFinal)} />
                  </div>
                </div>
              </section>
            )}

            {abaAtiva === "auditoria" && (
              <section className="space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <h2 className="text-lg font-semibold">Score probatório</h2>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <MetricCard titulo="Danos emergentes" valor={scoreProvaEmergentes} classe={badgeCor(scoreProvaEmergentes)} />
                      <MetricCard titulo="Lucros cessantes" valor={scoreProvaLucros} classe={badgeCor(scoreProvaLucros)} />
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <h2 className="text-lg font-semibold">Observação estratégica</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      A auditoria reduz fragilidades antes da utilização do cálculo em petição, contestação, acordo, parecer ou laudo pericial.
                    </p>
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-base font-semibold">Alertas automáticos</h3>
                  <ul className="mt-4 space-y-3">
                    {alertasAuditoria.map(alerta => (
                      <li key={alerta} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        {alerta}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {abaAtiva === "relatorio" && (
              <section className="space-y-4">
                <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Relatório técnico automatizado</h2>
                    <p className="mt-1 text-sm text-slate-600">Memória textual consolidada pronta para ajustes finais ou exportação.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGeneratePdf}
                    className="rounded-2xl bg-slate-900 px-5 py-2 text-sm font-bold text-white hover:bg-slate-800 transition"
                  >
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
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-slate-900" />
    </label>
  );
}

function CampoNumero({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input type="number" step="0.01" value={Number.isFinite(value) ? value : 0} onChange={e => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-slate-900" />
    </label>
  );
}

function CampoData({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-slate-900" />
    </label>
  );
}

function CampoSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { label: string; value: string }[] }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-slate-900">
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
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-slate-900" />
    </label>
  );
}
