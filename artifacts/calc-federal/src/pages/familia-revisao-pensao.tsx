import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useDebitCredits } from "@/hooks/use-wallet";
import { useToast } from "@/hooks/use-toast";
import { useSearch } from "wouter";
import veritasLogoUrl from "@assets/veritas_analytics_1775154424712.png";
import { buildVeritasReport } from "@/components/reports/VeritasReportLayout";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type IndiceCorrecaoRetro = "IPCA-E" | "INPC" | "SELIC" | "Manual";

type StepKey =
  | "caso"
  | "partes"
  | "titulo"
  | "necessidades"
  | "possibilidade"
  | "fatos"
  | "simulador"
  | "relatorio";

type DemandType =
  | "revisional_majoracao"
  | "revisional_minoracao"
  | "manutencao"
  | "exoneracao"
  | "calculo_extrajudicial";

type TituloTipo =
  | "valor_fixo"
  | "percentual_salario"
  | "percentual_rendimentos_liquidos"
  | "salario_minimo"
  | "hibrido";

type Category =
  | "moradia"
  | "alimentacao"
  | "saude"
  | "medicamentos"
  | "educacao"
  | "material_escolar"
  | "transporte"
  | "vestuario"
  | "lazer_minimo"
  | "terapias"
  | "cuidadores"
  | "internet_tecnologia"
  | "extraordinaria";

type Frequency = "mensal" | "bimestral" | "trimestral" | "semestral" | "anual" | "eventual";

type Confidence = "alta" | "media" | "baixa";
type Relevancia = "alta" | "media" | "baixa";

type CaseData = {
  processo: string;
  tribunal: string;
  comarca: string;
  vara: string;
  fase: string;
  tipoDemanda: DemandType;
  dataFixacaoAnterior: string;
  tituloFundamento: string;
  observacoes: string;
};

type Person = {
  id: string;
  nome: string;
  cpf: string;
  nascimento: string;
  papel: string;
  profissao: string;
  escolaridade: string;
  saude: string;
  guarda: string;
  convivencia: string;
  observacoes: string;
};

type TituloData = {
  tipoObrigacao: TituloTipo;
  valorAtual: number;
  percentualAtual: number;
  baseIncidencia: string;
  incide13: boolean;
  incideFerias: boolean;
  incideRescisorias: boolean;
  incidePlrBonus: boolean;
  incluiPlanoSaude: boolean;
  incluiMaterialEscolar: boolean;
  incluiMedicasExtra: boolean;
  incluiMensalidadeEscolar: boolean;
  incluiTransporte: boolean;
  formaPagamento: string;
  dataInicioObrigacao: string;
  historicoInadimplencia: string;
  obrigacaoHibridaDescricao: string;
};

type NeedItem = {
  id: string;
  categoria: Category;
  descricao: string;
  recorrencia: Frequency;
  valorMensal: number;
  valorEventual: number;
  compartilhada: boolean;
  fracaoCompartilhamento: number;
  comprovado: boolean;
  observacao: string;
};

type IncomeItem = {
  id: string;
  parte: "alimentante" | "outro_genitor";
  tipo: string;
  valor: number;
  recorrencia: Frequency;
  comprovacao: string;
  confiabilidade: Confidence;
};

type ExpenseItem = {
  id: string;
  tipo: string;
  valor: number;
  recorrencia: Frequency;
  essencial: boolean;
};

type EventItem = {
  id: string;
  tipo: string;
  data: string;
  descricao: string;
  impacto: number;
  alegadoPor: string;
  prova: string;
  relevancia: Relevancia;
};

type Scenario = {
  nome: "Conservador" | "Intermediário" | "Ampliado";
  fatorNecessidade: number;
  fatorCapacidade: number;
};

const steps: Array<{ key: StepKey; label: string; descricao: string }> = [
  { key: "caso", label: "1. Caso", descricao: "Dados processuais e enquadramento." },
  { key: "partes", label: "2. Partes", descricao: "Alimentante, alimentado e responsáveis." },
  { key: "titulo", label: "3. Título", descricao: "Reconstrução da obrigação vigente." },
  { key: "necessidades", label: "4. Necessidades", descricao: "Despesas ordinárias e extraordinárias." },
  { key: "possibilidade", label: "5. Possibilidade", descricao: "Renda, despesas e capacidade contributiva." },
  { key: "fatos", label: "6. Fatos", descricao: "Eventos supervenientes e prova." },
  { key: "simulador", label: "7. Simulador", descricao: "Cenários revisionais defensáveis." },
  { key: "relatorio", label: "8. Relatório", descricao: "Síntese técnico-jurídica e memória." },
];

const categoryOptions: Array<{ value: Category; label: string }> = [
  { value: "moradia", label: "Moradia" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "saude", label: "Saúde" },
  { value: "medicamentos", label: "Medicamentos" },
  { value: "educacao", label: "Educação" },
  { value: "material_escolar", label: "Material escolar" },
  { value: "transporte", label: "Transporte" },
  { value: "vestuario", label: "Vestuário" },
  { value: "lazer_minimo", label: "Lazer mínimo" },
  { value: "terapias", label: "Terapias" },
  { value: "cuidadores", label: "Cuidadores" },
  { value: "internet_tecnologia", label: "Internet/Tecnologia" },
  { value: "extraordinaria", label: "Extraordinária" },
];

const frequencyOptions: Array<{ value: Frequency; label: string; fatorMensal: number }> = [
  { value: "mensal", label: "Mensal", fatorMensal: 1 },
  { value: "bimestral", label: "Bimestral", fatorMensal: 0.5 },
  { value: "trimestral", label: "Trimestral", fatorMensal: 1 / 3 },
  { value: "semestral", label: "Semestral", fatorMensal: 1 / 6 },
  { value: "anual", label: "Anual", fatorMensal: 1 / 12 },
  { value: "eventual", label: "Eventual", fatorMensal: 0 },
];

const scenarios: Scenario[] = [
  { nome: "Conservador", fatorNecessidade: 0.9, fatorCapacidade: 0.85 },
  { nome: "Intermediário", fatorNecessidade: 1, fatorCapacidade: 1 },
  { nome: "Ampliado", fatorNecessidade: 1.1, fatorCapacidade: 1.1 },
];

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const pct = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const numberInputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";
const labelClass = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";
const cardClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const sectionTitleClass = "text-lg font-semibold text-slate-900";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function toNumber(value: string | number): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthlyFactor(freq: Frequency): number {
  return frequencyOptions.find((f) => f.value === freq)?.fatorMensal ?? 1;
}

function averageMonthlyFromFrequency(value: number, freq: Frequency): number {
  if (!value) return 0;
  if (freq === "eventual") return 0;
  return value * monthlyFactor(freq);
}

function confidenceWeight(conf: Confidence): number {
  if (conf === "alta") return 1;
  if (conf === "media") return 0.85;
  return 0.7;
}

function relevanciaWeight(rel: Relevancia): number {
  if (rel === "alta") return 1;
  if (rel === "media") return 0.66;
  return 0.33;
}

function makePerson(id: string, papel: string, nome: string): Person {
  return {
    id,
    nome,
    cpf: "",
    nascimento: "",
    papel,
    profissao: "",
    escolaridade: "",
    saude: "",
    guarda: "",
    convivencia: "",
    observacoes: "",
  };
}

function metricTone(value: number, yellow = 0.5, green = 0.75) {
  if (value >= green) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (value >= yellow) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-rose-700 bg-rose-50 border-rose-200";
}

function genChave(): string {
  const ADJETIVOS = ["FEDERAL","JUDICIAL","LEGAL","OFICIAL","FORMAL","CERTO","FIRME","CLARO","JUSTO","BREVE","FORTE","PURO","NOBRE","LEAL","REAL"];
  const SUBSTANTIVOS = ["CALCULO","PROCESSO","ACAO","VALOR","CREDITO","DEBITO","PARCELA","INDICE","FATOR","SALDO","CONTA","BALANCO","ORDEM","TITULO","LAUDO"];
  const adj  = ADJETIVOS[Math.floor(Math.random() * ADJETIVOS.length)];
  const noun = SUBSTANTIVOS[Math.floor(Math.random() * SUBSTANTIVOS.length)];
  const hex  = () => Math.floor(Math.random() * 65536).toString(16).toUpperCase().padStart(4, "0");
  return `${adj}-${noun}-${hex()}-${hex()}`;
}

function sanitizeText(v: string) {
  return (v || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getFamiliaReportHtml(params: {
  caseData: CaseData;
  alimentado: string;
  alimentante: string;
  outroGenitor: string;
  titulo: TituloData;
  calculations: {
    currentValue: number;
    ordinaryMonthly: number;
    extraMonthly: number;
    needTotalMonthly: number;
    needProofRatio: number;
    alimentanteGrossUseful: number;
    otherParentUseful: number;
    essentialExpenses: number;
    capacityAdjusted: number;
    alimentanteShare: number;
    otherParentShare: number;
    suggestedBase: number;
    differenceVsCurrent: number;
    projectedAnnualDifference: number;
    robustness: number;
    eventsStrength: number;
    requestCoherence: number;
    possibilityProofRatio: number;
    scenarioResults: Array<{ nome: string; value: number; percentage: number; annual: number }>;
  };
  retroRows: Array<{ competencia: string; devido: number; pago: number; diferenca: number; correcao: number; juros: number; atualizado: number }>;
  userName: string;
}) {
  const { caseData, alimentado, alimentante, outroGenitor, titulo, calculations, retroRows, userName } = params;
  const today = new Date();
  const emitidoEm = today.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
  const logoSrc = window.location.origin + veritasLogoUrl;
  const interm = calculations.scenarioResults.find((s) => s.nome === "Intermediário");
  const robustezClass = calculations.robustness >= 0.75 ? "Alta" : calculations.robustness >= 0.5 ? "Média" : "Baixa";

  const scenarioRows = calculations.scenarioResults.map((s) => `
    <tr>
      <td>${sanitizeText(s.nome)}</td>
      <td style="text-align:right;">${brl.format(s.value)}</td>
      <td style="text-align:right;">${pct.format(s.percentage)}</td>
      <td style="text-align:right;">${brl.format(s.annual)}</td>
      <td style="text-align:center;">
        <span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;
          background:${s.percentage <= 0.3 ? "#d1fae5" : s.percentage <= 0.4 ? "#fef3c7" : "#fee2e2"};
          color:${s.percentage <= 0.3 ? "#065f46" : s.percentage <= 0.4 ? "#92400e" : "#991b1b"}">
          ${s.percentage <= 0.3 ? "Muito defensável" : s.percentage <= 0.4 ? "Atenção" : "Risco elevado"}
        </span>
      </td>
    </tr>`).join("");

  const retroTotDif = retroRows.reduce((a, r) => a + r.diferenca, 0);
  const retroTotCor = retroRows.reduce((a, r) => a + r.correcao, 0);
  const retroTotJur = retroRows.reduce((a, r) => a + r.juros, 0);
  const retroTotAtu = retroRows.reduce((a, r) => a + r.atualizado, 0);

  const retroTableRows = retroRows.map((r) => `
    <tr>
      <td>${r.competencia}</td>
      <td style="text-align:right;">${brl.format(r.devido)}</td>
      <td style="text-align:right;">${brl.format(r.pago)}</td>
      <td style="text-align:right;">${brl.format(r.diferenca)}</td>
      <td style="text-align:right;">${brl.format(r.correcao)}</td>
      <td style="text-align:right;">${brl.format(r.juros)}</td>
      <td style="text-align:right;font-weight:700;">${brl.format(r.atualizado)}</td>
    </tr>`).join("");

  const robustezBorderCor = calculations.robustness >= 0.75 ? "#6ee7b7" : calculations.robustness >= 0.5 ? "#fcd34d" : "#fca5a5";
  const robustezBgCor = calculations.robustness >= 0.75 ? "#f0fdf4" : calculations.robustness >= 0.5 ? "#fffbeb" : "#fff1f2";

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
        <div><strong>Emitido em:</strong> ${emitidoEm}</div>
        <div><strong>Responsável:</strong> ${sanitizeText(userName || "—")}</div>
      </div>
    </div>

    <div class="vr-title-bar">
      <div class="vr-title-bar-title">Relatório Técnico-Jurídico — Revisão de Pensão Alimentícia</div>
      <div class="vr-title-bar-chave" id="laudo-chave">aguardando…</div>
    </div>

    <div class="vr-meta">
      <div class="vr-meta-grid">
        <div><span class="vr-meta-label">Processo: </span><span class="vr-meta-value">${sanitizeText(caseData.processo || "Não informado")}</span></div>
        <div><span class="vr-meta-label">Tribunal: </span><span class="vr-meta-value">${sanitizeText(caseData.tribunal)}</span></div>
        <div><span class="vr-meta-label">Comarca: </span><span class="vr-meta-value">${sanitizeText(caseData.comarca)}</span></div>
        <div><span class="vr-meta-label">Vara / Fase: </span><span class="vr-meta-value">${sanitizeText(caseData.vara)} — ${sanitizeText(caseData.fase)}</span></div>
        <div><span class="vr-meta-label">Tipo de demanda: </span><span class="vr-meta-value">${sanitizeText(describeDemand(caseData.tipoDemanda))}</span></div>
        <div><span class="vr-meta-label">Fundamento: </span><span class="vr-meta-value">${sanitizeText(caseData.tituloFundamento)}</span></div>
      </div>
    </div>

    <div class="vr-body">
      <div class="vr-section-title">1. PARTES</div>
      <div class="vr-meta-grid" style="margin:10px 0;font-size:13px;">
        <div><span class="vr-meta-label">Alimentado(a): </span><span class="vr-meta-value">${sanitizeText(alimentado)}</span></div>
        <div><span class="vr-meta-label">Alimentante: </span><span class="vr-meta-value">${sanitizeText(alimentante)}</span></div>
        <div><span class="vr-meta-label">Outro genitor: </span><span class="vr-meta-value">${sanitizeText(outroGenitor)}</span></div>
        <div><span class="vr-meta-label">Tipo da obrigação: </span><span class="vr-meta-value">${sanitizeText(describeTitulo(titulo.tipoObrigacao))}</span></div>
      </div>

      <div class="vr-section-title">2. INDICADORES PRINCIPAIS</div>
      <div class="vr-kpi-row">
        <div class="vr-kpi"><div class="vr-kpi-label">Encargo atual estimado</div><div class="vr-kpi-value">${brl.format(calculations.currentValue)}</div><div class="vr-kpi-sub">Regra vigente</div></div>
        <div class="vr-kpi"><div class="vr-kpi-label">Necessidade mensal total</div><div class="vr-kpi-value">${brl.format(calculations.needTotalMonthly)}</div><div class="vr-kpi-sub">Ordinária + extraordinária</div></div>
        <div class="vr-kpi"><div class="vr-kpi-label">Renda útil do alimentante</div><div class="vr-kpi-value">${brl.format(calculations.alimentanteGrossUseful)}</div><div class="vr-kpi-sub">Com peso de confiabilidade</div></div>
        <div class="vr-kpi"><div class="vr-kpi-label">Capacidade contributiva</div><div class="vr-kpi-value">${brl.format(calculations.capacityAdjusted)}</div><div class="vr-kpi-sub">Renda − despesas essenciais</div></div>
        <div class="vr-kpi primary"><div class="vr-kpi-label">Sugestão intermediária</div><div class="vr-kpi-value">${brl.format(interm?.value ?? 0)}</div><div class="vr-kpi-sub">Cenário revisional base</div></div>
        <div class="vr-kpi"><div class="vr-kpi-label">Diferença mensal</div><div class="vr-kpi-value">${brl.format(calculations.differenceVsCurrent)}</div><div class="vr-kpi-sub">Sugerido − atual</div></div>
      </div>

      <div class="vr-section-title">3. CENÁRIOS REVISIONAIS</div>
      <table>
        <thead>
          <tr>
            <th>Cenário</th>
            <th class="right">Valor sugerido</th>
            <th class="right">% Renda útil</th>
            <th class="right">Impacto anual</th>
            <th class="center">Situação</th>
          </tr>
        </thead>
        <tbody>${scenarioRows}</tbody>
      </table>

      <div class="vr-section-title">4. DIFERENÇAS RETROATIVAS SIMULADAS</div>
      <table>
        <thead>
          <tr>
            <th>Competência</th>
            <th class="right">Devido</th>
            <th class="right">Pago</th>
            <th class="right">Diferença</th>
            <th class="right">Correção</th>
            <th class="right">Juros</th>
            <th class="right">Atualizado</th>
          </tr>
        </thead>
        <tbody>${retroTableRows}</tbody>
        <tfoot>
          <tr>
            <td>TOTAL</td><td></td><td></td>
            <td class="right">${brl.format(retroTotDif)}</td>
            <td class="right">${brl.format(retroTotCor)}</td>
            <td class="right">${brl.format(retroTotJur)}</td>
            <td class="right">${brl.format(retroTotAtu)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="vr-section-title">5. CONCLUSÃO TÉCNICA</div>
      <div style="margin-top:12px;border-radius:8px;padding:12px 16px;border:2px solid ${robustezBorderCor};background:${robustezBgCor};">
        <strong>Robustez jurídica: ${robustezClass} (${pct.format(calculations.robustness)})</strong>
      </div>
      <div class="vr-paragraph">
        À luz dos dados cadastrados, a hipótese revisional apresenta robustez <strong>${robustezClass}</strong>. A proposta intermediária recomenda a fixação de alimentos em <strong>${brl.format(interm?.value ?? 0)}</strong> mensais, em observância à proporcionalidade entre necessidade do alimentado e possibilidade econômica do alimentante, com rateio parental implícito de <strong>${pct.format(calculations.alimentanteShare)}</strong> para o alimentante e <strong>${pct.format(calculations.otherParentShare)}</strong> para o outro genitor. O diferencial mensal em relação ao encargo atual é de <strong>${brl.format(calculations.differenceVsCurrent)}</strong>, representando impacto anual projetado de <strong>${brl.format(calculations.projectedAnnualDifference)}</strong>.
      </div>

      <div class="vr-ressalva">
        <strong>RESSALVA:</strong> Este demonstrativo possui natureza técnico-estimativa e orientativa, devendo ser confrontado com a prova documental, o título alimentar vigente e a valoração judicial do caso concreto. Não constitui laudo pericial nem pauta vinculante. Chave de recuperação: <strong id="ressalva-chave">aguardando…</strong>.
      </div>

      <div class="vr-signature">
        <div class="vr-signature-line"></div>
        <div class="vr-signature-name">${sanitizeText(userName || "—")}</div>
        <div class="vr-signature-role">Veritas Analytics — Plataforma de Cálculos Jurídicos e Periciais</div>
        <div class="vr-footer-chave" id="laudo-chave-footer">Chave de recuperação: <strong>aguardando…</strong> — Veritas Analytics · ${emitidoEm}</div>
      </div>
      <div class="vr-footer">
        <span>Veritas Analytics — Plataforma de Cálculos Jurídicos e Periciais</span>
        <span>Emitido em ${emitidoEm}</span>
      </div>
    </div>`;

  return buildVeritasReport({ title: "Relatório Técnico-Jurídico — Revisão de Pensão Alimentícia", body });
}

export default function VeritasFamiliaRevisaoPensao() {
  const { user } = useAuth();
  const debitCredits = useDebitCredits();
  const { toast } = useToast();
  const [activeStep, setActiveStep] = useState<StepKey>("caso");
  const [chaveGerada, setChaveGerada] = useState<string | null>(null);
  const [inputChave, setInputChave] = useState("");
  const [loadingRecover, setLoadingRecover] = useState(false);

  const [indiceCorrecaoRetro, setIndiceCorrecaoRetro] = useState<IndiceCorrecaoRetro>("IPCA-E");
  const [percentualManualCorrecao, setPercentualManualCorrecao] = useState<number>(1.5);

  const [caseData, setCaseData] = useState<CaseData>({
    processo: "",
    tribunal: "",
    comarca: "",
    vara: "Vara de Família",
    fase: "Conhecimento",
    tipoDemanda: "revisional_majoracao",
    dataFixacaoAnterior: "",
    tituloFundamento: "Acordo homologado judicialmente",
    observacoes: "",
  });

  const [people, setPeople] = useState<Person[]>([
    makePerson(uid("p"), "Alimentado(a)", "Menor A."),
    makePerson(uid("p"), "Alimentante", "Genitor(a) obrigado(a)"),
    makePerson(uid("p"), "Outro genitor", "Responsável convivente"),
    makePerson(uid("p"), "Representante legal", "Representante"),
  ]);

  const [titulo, setTitulo] = useState<TituloData>({
    tipoObrigacao: "valor_fixo",
    valorAtual: 900,
    percentualAtual: 20,
    baseIncidencia: "Rendimentos líquidos",
    incide13: true,
    incideFerias: true,
    incideRescisorias: false,
    incidePlrBonus: false,
    incluiPlanoSaude: false,
    incluiMaterialEscolar: true,
    incluiMedicasExtra: true,
    incluiMensalidadeEscolar: false,
    incluiTransporte: false,
    formaPagamento: "Depósito/Pix",
    dataInicioObrigacao: "",
    historicoInadimplencia: "",
    obrigacaoHibridaDescricao: "",
  });

  const [needs, setNeeds] = useState<NeedItem[]>([
    {
      id: uid("need"),
      categoria: "alimentacao",
      descricao: "Alimentação mensal do alimentado",
      recorrencia: "mensal",
      valorMensal: 450,
      valorEventual: 0,
      compartilhada: false,
      fracaoCompartilhamento: 1,
      comprovado: true,
      observacao: "",
    },
    {
      id: uid("need"),
      categoria: "educacao",
      descricao: "Mensalidade/apoio escolar",
      recorrencia: "mensal",
      valorMensal: 600,
      valorEventual: 0,
      compartilhada: false,
      fracaoCompartilhamento: 1,
      comprovado: true,
      observacao: "",
    },
    {
      id: uid("need"),
      categoria: "saude",
      descricao: "Consulta e terapias",
      recorrencia: "mensal",
      valorMensal: 350,
      valorEventual: 0,
      compartilhada: false,
      fracaoCompartilhamento: 1,
      comprovado: false,
      observacao: "",
    },
    {
      id: uid("need"),
      categoria: "extraordinaria",
      descricao: "Material escolar anual",
      recorrencia: "anual",
      valorMensal: 0,
      valorEventual: 1200,
      compartilhada: false,
      fracaoCompartilhamento: 1,
      comprovado: true,
      observacao: "",
    },
  ]);

  const [incomes, setIncomes] = useState<IncomeItem[]>([
    {
      id: uid("inc"),
      parte: "alimentante",
      tipo: "Salário líquido",
      valor: 5200,
      recorrencia: "mensal",
      comprovacao: "Contracheque",
      confiabilidade: "alta",
    },
    {
      id: uid("inc"),
      parte: "outro_genitor",
      tipo: "Renda estimada do outro genitor",
      valor: 2400,
      recorrencia: "mensal",
      comprovacao: "Declaração/estimativa",
      confiabilidade: "media",
    },
  ]);

  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { id: uid("exp"), tipo: "Moradia própria do alimentante", valor: 1200, recorrencia: "mensal", essencial: true },
    { id: uid("exp"), tipo: "Transporte ao trabalho", valor: 350, recorrencia: "mensal", essencial: true },
    { id: uid("exp"), tipo: "Plano de saúde do alimentante", valor: 220, recorrencia: "mensal", essencial: true },
    { id: uid("exp"), tipo: "Outra obrigação alimentar", valor: 500, recorrencia: "mensal", essencial: true },
  ]);

  const [events, setEvents] = useState<EventItem[]>([
    {
      id: uid("evt"),
      tipo: "Aumento das despesas escolares",
      data: "",
      descricao: "Reajuste escolar e intensificação de apoio pedagógico.",
      impacto: 450,
      alegadoPor: "Representante legal",
      prova: "Boletos/declaração escolar",
      relevancia: "alta",
    },
    {
      id: uid("evt"),
      tipo: "Aumento de renda do alimentante",
      data: "",
      descricao: "Promoção funcional com ampliação remuneratória.",
      impacto: 800,
      alegadoPor: "Alimentado",
      prova: "Contracheques recentes",
      relevancia: "media",
    },
  ]);

  const alimentante = people.find((p) => p.papel === "Alimentante");
  const alimentado = people.find((p) => p.papel === "Alimentado(a)");
  const outroGenitor = people.find((p) => p.papel === "Outro genitor");

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
        if (s?.caseData)               setCaseData(s.caseData);
        if (s?.titulo)                  setTitulo(s.titulo);
        if (s?.people?.length)          setPeople(s.people);
        if (s?.needs !== undefined)     setNeeds(s.needs);
        if (s?.incomes !== undefined)   setIncomes(s.incomes);
        if (s?.expenses !== undefined)  setExpenses(s.expenses);
        if (s?.events !== undefined)    setEvents(s.events);
        if (s?.indiceCorrecaoRetro)     setIndiceCorrecaoRetro(s.indiceCorrecaoRetro);
        if (s?.percentualManualCorrecao !== undefined) setPercentualManualCorrecao(s.percentualManualCorrecao);
        setChaveGerada(data.publicKey);
        toast({ title: "Cálculo recuperado", description: `Chave: ${data.publicKey}` });
      })
      .catch(() => toast({ title: "Chave não encontrada", description: key, variant: "destructive" }))
      .finally(() => setLoadingRecover(false));
  }, [searchString]);

  const calculations = useMemo(() => {
    const ordinaryMonthly = needs
      .filter((item) => item.categoria !== "extraordinaria")
      .reduce((acc, item) => {
        const base = item.valorMensal || averageMonthlyFromFrequency(item.valorEventual, item.recorrencia);
        const aplicado = item.compartilhada ? base * item.fracaoCompartilhamento : base;
        return acc + aplicado;
      }, 0);

    const extraMonthly = needs
      .filter((item) => item.categoria === "extraordinaria")
      .reduce((acc, item) => {
        const base = item.valorMensal > 0 ? item.valorMensal : averageMonthlyFromFrequency(item.valorEventual, item.recorrencia);
        const aplicado = item.compartilhada ? base * item.fracaoCompartilhamento : base;
        return acc + aplicado;
      }, 0);

    const needTotalMonthly = ordinaryMonthly + extraMonthly;

    const needProofRatio =
      needs.length === 0 ? 0 : needs.filter((item) => item.comprovado).length / Math.max(needs.length, 1);

    const alimentanteGrossUseful = incomes
      .filter((item) => item.parte === "alimentante")
      .reduce((acc, item) => acc + averageMonthlyFromFrequency(item.valor, item.recorrencia) * confidenceWeight(item.confiabilidade), 0);

    const otherParentUseful = incomes
      .filter((item) => item.parte === "outro_genitor")
      .reduce((acc, item) => acc + averageMonthlyFromFrequency(item.valor, item.recorrencia) * confidenceWeight(item.confiabilidade), 0);

    const essentialExpenses = expenses
      .filter((item) => item.essencial)
      .reduce((acc, item) => acc + averageMonthlyFromFrequency(item.valor, item.recorrencia), 0);

    const capacityAdjusted = Math.max(alimentanteGrossUseful - essentialExpenses, 0);

    const totalParentalBase = Math.max(alimentanteGrossUseful + otherParentUseful, 0);
    const alimentanteShare = totalParentalBase > 0 ? alimentanteGrossUseful / totalParentalBase : 1;
    const otherParentShare = totalParentalBase > 0 ? otherParentUseful / totalParentalBase : 0;

    const suggestedBase = Math.min(needTotalMonthly * alimentanteShare, capacityAdjusted);
    const supportRateOnIncome = alimentanteGrossUseful > 0 ? suggestedBase / alimentanteGrossUseful : 0;

    const eventsStrength =
      events.length === 0
        ? 0
        : events.reduce((acc, item) => acc + relevanciaWeight(item.relevancia), 0) / Math.max(events.length, 1);

    const possibilityProofRatio =
      incomes.length === 0
        ? 0
        : incomes.reduce((acc, item) => acc + confidenceWeight(item.confiabilidade), 0) / Math.max(incomes.length, 1);

    const requestCoherence =
      suggestedBase <= capacityAdjusted && supportRateOnIncome <= 0.45 ? 1 : suggestedBase <= capacityAdjusted * 1.1 ? 0.65 : 0.35;

    const robustness =
      needProofRatio * 0.3 + possibilityProofRatio * 0.3 + eventsStrength * 0.25 + requestCoherence * 0.15;

    const scenarioResults = scenarios.map((scenario) => {
      const needScenario = needTotalMonthly * scenario.fatorNecessidade;
      const capacityScenario = capacityAdjusted * scenario.fatorCapacidade;
      const value = Math.min(needScenario * alimentanteShare, capacityScenario);
      const percentage = alimentanteGrossUseful > 0 ? value / alimentanteGrossUseful : 0;
      return {
        ...scenario,
        value,
        percentage,
        annual: value * 12,
      };
    });

    const currentValue =
      titulo.tipoObrigacao === "valor_fixo" || titulo.tipoObrigacao === "hibrido"
        ? titulo.valorAtual
        : alimentanteGrossUseful * (titulo.percentualAtual / 100);

    const differenceVsCurrent = suggestedBase - currentValue;
    const projectedAnnualDifference = differenceVsCurrent * 12;

    return {
      ordinaryMonthly,
      extraMonthly,
      needTotalMonthly,
      needProofRatio,
      alimentanteGrossUseful,
      otherParentUseful,
      essentialExpenses,
      capacityAdjusted,
      alimentanteShare,
      otherParentShare,
      suggestedBase,
      supportRateOnIncome,
      eventsStrength,
      possibilityProofRatio,
      requestCoherence,
      robustness,
      scenarioResults,
      currentValue,
      differenceVsCurrent,
      projectedAnnualDifference,
    };
  }, [needs, incomes, expenses, events, titulo]);

  const taxaMensalCorrecao = useMemo(() => {
    switch (indiceCorrecaoRetro) {
      case "IPCA-E": return 0.0064;
      case "INPC": return 0.0057;
      case "SELIC": return 0.0095;
      case "Manual": return percentualManualCorrecao / 100;
      default: return 0.0064;
    }
  }, [indiceCorrecaoRetro, percentualManualCorrecao]);

  const retroRows = useMemo(() => {
    const simulated = calculations.scenarioResults.find((s) => s.nome === "Intermediário")?.value ?? 0;
    return Array.from({ length: 12 }).map((_, index) => {
      const month = index + 1;
      const devido = simulated;
      const pago = calculations.currentValue;
      const diferenca = devido - pago;
      const correcao = diferenca * taxaMensalCorrecao * Math.max(12 - index, 1);
      const juros = diferenca > 0 ? diferenca * 0.01 * Math.max(12 - index, 1) : 0;
      const atualizado = diferenca + correcao + juros;
      return {
        competencia: `2025/${String(month).padStart(2, "0")}`,
        devido,
        pago,
        diferenca,
        correcao,
        juros,
        atualizado,
      };
    });
  }, [calculations.currentValue, calculations.scenarioResults, taxaMensalCorrecao]);

  const reportText = useMemo(() => {
    const interm = calculations.scenarioResults.find((s) => s.nome === "Intermediário");
    const robustezClass =
      calculations.robustness >= 0.75
        ? "alta"
        : calculations.robustness >= 0.5
        ? "média"
        : "baixa";

    return [
      `RELATÓRIO TÉCNICO-JURÍDICO — VERITAS FAMÍLIA`,
      ``,
      `1. IDENTIFICAÇÃO DO CASO`,
      `Processo: ${caseData.processo || "não informado"}`,
      `Tribunal/Comarca: ${caseData.tribunal} — ${caseData.comarca}`,
      `Vara/Fase: ${caseData.vara} — ${caseData.fase}`,
      `Tipo de demanda: ${describeDemand(caseData.tipoDemanda)}`,
      ``,
      `2. PARTES RELEVANTES`,
      `Alimentado(a): ${alimentado?.nome || "não informado"}`,
      `Alimentante: ${alimentante?.nome || "não informado"}`,
      `Outro genitor: ${outroGenitor?.nome || "não informado"}`,
      ``,
      `3. OBRIGAÇÃO ALIMENTAR VIGENTE`,
      `Tipo: ${describeTitulo(titulo.tipoObrigacao)}`,
      `Valor/critério atual estimado: ${brl.format(calculations.currentValue)} ao mês`,
      `Base de incidência: ${titulo.baseIncidencia}`,
      `Forma de pagamento: ${titulo.formaPagamento}`,
      ``,
      `4. NECESSIDADES APURADAS`,
      `Despesas ordinárias mensais: ${brl.format(calculations.ordinaryMonthly)}`,
      `Despesas extraordinárias mensalizadas: ${brl.format(calculations.extraMonthly)}`,
      `Necessidade mensal total: ${brl.format(calculations.needTotalMonthly)}`,
      ``,
      `5. POSSIBILIDADE ECONÔMICA`,
      `Renda útil estimada do alimentante: ${brl.format(calculations.alimentanteGrossUseful)}`,
      `Renda útil estimada do outro genitor: ${brl.format(calculations.otherParentUseful)}`,
      `Despesas essenciais do alimentante: ${brl.format(calculations.essentialExpenses)}`,
      `Capacidade contributiva ajustada: ${brl.format(calculations.capacityAdjusted)}`,
      `Participação proporcional do alimentante: ${pct.format(calculations.alimentanteShare)}`,
      ``,
      `6. FATOS SUPERVENIENTES`,
      `Foram registrados ${events.length} fato(s) superveniente(s), com densidade média de relevância ${pct.format(calculations.eventsStrength)}.`,
      ``,
      `7. CENÁRIO INTERMEDIÁRIO SUGERIDO`,
      `Valor sugerido: ${brl.format(interm?.value ?? 0)}/mês`,
      `Percentual implícito sobre a renda útil: ${pct.format(interm?.percentage ?? 0)}`,
      `Diferença em relação ao encargo atual: ${brl.format(calculations.differenceVsCurrent)}/mês`,
      `Impacto anual projetado: ${brl.format(calculations.projectedAnnualDifference)}`,
      ``,
      `8. CONCLUSÃO TÉCNICA`,
      `À luz dos dados cadastrados, a hipótese revisional apresenta robustez ${robustezClass}. A proposta intermediária recomenda a fixação de alimentos em ${brl.format(interm?.value ?? 0)} mensais, em observância à proporcionalidade entre necessidade do alimentado e possibilidade econômica do alimentante, com rateio parental implícito de ${pct.format(calculations.alimentanteShare)} para o alimentante e ${pct.format(calculations.otherParentShare)} para o outro genitor.`,
      ``,
      `9. RESSALVA`,
      `Este demonstrativo possui natureza técnico-estimativa e orientativa, devendo ser confrontado com a prova documental, o título alimentar vigente e a valoração judicial do caso concreto.`,
    ].join("\n");
  }, [alimentado?.nome, alimentante?.nome, outroGenitor?.nome, calculations, caseData, events.length, titulo]);

  function updatePerson(id: string, patch: Partial<Person>) {
    setPeople((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function handleGeneratePdf() {
    const ok = await debitCredits(5, "Família — Revisão de Pensão Alimentícia");
    if (!ok) return;

    const html = getFamiliaReportHtml({
      caseData,
      alimentado: alimentado?.nome || "Não informado",
      alimentante: alimentante?.nome || "Não informado",
      outroGenitor: outroGenitor?.nome || "Não informado",
      titulo,
      calculations,
      retroRows,
      userName: (user as any)?.nome || (user as any)?.email || "—",
    });

    const popup = window.open("", "_blank", "width=1100,height=900");
    if (!popup) {
      toast({ title: "Popup bloqueado", description: "Permita popups para este site e tente novamente.", variant: "destructive" });
      return;
    }
    popup.document.open();
    popup.document.write(html);
    popup.document.close();

    try {
      const calcState = { caseData, titulo, people, needs, incomes, expenses, events, indiceCorrecaoRetro, percentualManualCorrecao };
      const r = await fetch(`${BASE}/api/civil/save`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ calcState, modulo: "familia-pensao" }),
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
          const elR = popup.document.getElementById("ressalva-chave");
          if (elR) elR.textContent = chave;
        } catch (_) { /* cross-origin seguro */ }
      }
    } catch { /* silencioso — chave é opcional */ }
  }

  const handleRecoverCalculo = useCallback(async () => {
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
      if (s?.caseData)               setCaseData(s.caseData);
      if (s?.titulo)                  setTitulo(s.titulo);
      if (s?.people?.length)          setPeople(s.people);
      if (s?.needs?.length !== undefined) setNeeds(s.needs);
      if (s?.incomes?.length !== undefined) setIncomes(s.incomes);
      if (s?.expenses?.length !== undefined) setExpenses(s.expenses);
      if (s?.events?.length !== undefined)  setEvents(s.events);
      if (s?.indiceCorrecaoRetro)     setIndiceCorrecaoRetro(s.indiceCorrecaoRetro);
      if (s?.percentualManualCorrecao !== undefined) setPercentualManualCorrecao(s.percentualManualCorrecao);
      setChaveGerada(b.publicKey);
      setInputChave("");
      setActiveStep("caso");
      toast({ title: "Cálculo recuperado!", description: `Chave: ${b.publicKey}` });
    } catch (e: any) {
      toast({ title: "Erro ao recuperar", description: e.message, variant: "destructive" });
    } finally {
      setLoadingRecover(false);
    }
  }, [inputChave, toast]);

  function handleNovoCalculo() {
    setCaseData({ processo: "", tribunal: "", comarca: "", vara: "Vara de Família", fase: "Conhecimento", tipoDemanda: "revisional_majoracao", dataFixacaoAnterior: "", tituloFundamento: "", observacoes: "" });
    setPeople([
      makePerson(uid("p"), "Alimentado(a)", ""),
      makePerson(uid("p"), "Alimentante", ""),
      makePerson(uid("p"), "Outro genitor", ""),
      makePerson(uid("p"), "Representante legal", ""),
    ]);
    setTitulo({ tipoObrigacao: "valor_fixo", valorAtual: 0, percentualAtual: 20, baseIncidencia: "", incide13: false, incideFerias: false, incideRescisorias: false, incidePlrBonus: false, incluiPlanoSaude: false, incluiMaterialEscolar: false, incluiMedicasExtra: false, incluiMensalidadeEscolar: false, incluiTransporte: false, formaPagamento: "", dataInicioObrigacao: "", historicoInadimplencia: "", obrigacaoHibridaDescricao: "" });
    setNeeds([]);
    setIncomes([]);
    setExpenses([]);
    setEvents([]);
    setActiveStep("caso");
  }

  function renderCase() {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Número do processo">
          <input
            className={numberInputClass}
            value={caseData.processo}
            onChange={(e) => setCaseData((s) => ({ ...s, processo: e.target.value }))}
            placeholder="0000000-00.0000.8.13.0000"
          />
        </Field>
        <Field label="Tribunal">
          <input className={numberInputClass} value={caseData.tribunal} onChange={(e) => setCaseData((s) => ({ ...s, tribunal: e.target.value }))} />
        </Field>
        <Field label="Comarca">
          <input className={numberInputClass} value={caseData.comarca} onChange={(e) => setCaseData((s) => ({ ...s, comarca: e.target.value }))} />
        </Field>
        <Field label="Vara">
          <input className={numberInputClass} value={caseData.vara} onChange={(e) => setCaseData((s) => ({ ...s, vara: e.target.value }))} />
        </Field>
        <Field label="Fase processual">
          <input className={numberInputClass} value={caseData.fase} onChange={(e) => setCaseData((s) => ({ ...s, fase: e.target.value }))} />
        </Field>
        <Field label="Tipo de demanda">
          <select className={numberInputClass} value={caseData.tipoDemanda} onChange={(e) => setCaseData((s) => ({ ...s, tipoDemanda: e.target.value as DemandType }))}>
            <option value="revisional_majoracao">Revisional para majoração</option>
            <option value="revisional_minoracao">Revisional para minoração</option>
            <option value="manutencao">Manutenção</option>
            <option value="exoneracao">Exoneração</option>
            <option value="calculo_extrajudicial">Cálculo extrajudicial preparatório</option>
          </select>
        </Field>
        <Field label="Data da fixação anterior">
          <input type="date" className={numberInputClass} value={caseData.dataFixacaoAnterior} onChange={(e) => setCaseData((s) => ({ ...s, dataFixacaoAnterior: e.target.value }))} />
        </Field>
        <Field label="Fundamento do título">
          <input className={numberInputClass} value={caseData.tituloFundamento} onChange={(e) => setCaseData((s) => ({ ...s, tituloFundamento: e.target.value }))} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Observações gerais">
            <textarea
              className={`${numberInputClass} min-h-[120px]`}
              value={caseData.observacoes}
              onChange={(e) => setCaseData((s) => ({ ...s, observacoes: e.target.value }))}
              placeholder="Síntese fática, contexto da revisão, observações estratégicas."
            />
          </Field>
        </div>
      </div>
    );
  }

  function renderPeople() {
    return (
      <div className="space-y-4">
        {people.map((person) => (
          <div key={person.id} className={`${cardClass} p-4`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{person.papel}</h3>
                <p className="text-sm text-slate-500">Dados de identificação e contexto individual.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Nome">
                <input className={numberInputClass} value={person.nome} onChange={(e) => updatePerson(person.id, { nome: e.target.value })} />
              </Field>
              <Field label="CPF">
                <input className={numberInputClass} value={person.cpf} onChange={(e) => updatePerson(person.id, { cpf: e.target.value })} />
              </Field>
              <Field label="Nascimento">
                <input type="date" className={numberInputClass} value={person.nascimento} onChange={(e) => updatePerson(person.id, { nascimento: e.target.value })} />
              </Field>
              <Field label="Profissão">
                <input className={numberInputClass} value={person.profissao} onChange={(e) => updatePerson(person.id, { profissao: e.target.value })} />
              </Field>
              <Field label="Escolaridade">
                <input className={numberInputClass} value={person.escolaridade} onChange={(e) => updatePerson(person.id, { escolaridade: e.target.value })} />
              </Field>
              <Field label="Condição de saúde">
                <input className={numberInputClass} value={person.saude} onChange={(e) => updatePerson(person.id, { saude: e.target.value })} />
              </Field>
              <Field label="Guarda">
                <input className={numberInputClass} value={person.guarda} onChange={(e) => updatePerson(person.id, { guarda: e.target.value })} />
              </Field>
              <Field label="Convivência">
                <input className={numberInputClass} value={person.convivencia} onChange={(e) => updatePerson(person.id, { convivencia: e.target.value })} />
              </Field>
              <div className="md:col-span-2 xl:col-span-3">
                <Field label="Observações">
                  <textarea className={`${numberInputClass} min-h-[88px]`} value={person.observacoes} onChange={(e) => updatePerson(person.id, { observacoes: e.target.value })} />
                </Field>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderTitulo() {
    return (
      <div className="space-y-4">
        <div className={`${cardClass} p-4`}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Tipo da obrigação">
              <select className={numberInputClass} value={titulo.tipoObrigacao} onChange={(e) => setTitulo((s) => ({ ...s, tipoObrigacao: e.target.value as TituloTipo }))}>
                <option value="valor_fixo">Valor fixo</option>
                <option value="percentual_salario">Percentual sobre salário</option>
                <option value="percentual_rendimentos_liquidos">Percentual sobre rendimentos líquidos</option>
                <option value="salario_minimo">Salário mínimo</option>
                <option value="hibrido">Híbrido</option>
              </select>
            </Field>
            <Field label="Valor atual (R$)">
              <input className={numberInputClass} type="number" value={titulo.valorAtual} onChange={(e) => setTitulo((s) => ({ ...s, valorAtual: toNumber(e.target.value) }))} />
            </Field>
            <Field label="Percentual atual (%)">
              <input className={numberInputClass} type="number" value={titulo.percentualAtual} onChange={(e) => setTitulo((s) => ({ ...s, percentualAtual: toNumber(e.target.value) }))} />
            </Field>
            <Field label="Base de incidência">
              <input className={numberInputClass} value={titulo.baseIncidencia} onChange={(e) => setTitulo((s) => ({ ...s, baseIncidencia: e.target.value }))} />
            </Field>
            <Field label="Forma de pagamento">
              <input className={numberInputClass} value={titulo.formaPagamento} onChange={(e) => setTitulo((s) => ({ ...s, formaPagamento: e.target.value }))} />
            </Field>
            <Field label="Data de início da obrigação">
              <input type="date" className={numberInputClass} value={titulo.dataInicioObrigacao} onChange={(e) => setTitulo((s) => ({ ...s, dataInicioObrigacao: e.target.value }))} />
            </Field>
            <Field label="Obrigação híbrida — descrição">
              <input className={numberInputClass} value={titulo.obrigacaoHibridaDescricao} onChange={(e) => setTitulo((s) => ({ ...s, obrigacaoHibridaDescricao: e.target.value }))} placeholder="Ex.: valor fixo + 50% das despesas médicas extraordinárias." />
            </Field>
            <div className="md:col-span-2 xl:col-span-2">
              <Field label="Histórico de inadimplência">
                <textarea className={`${numberInputClass} min-h-[88px]`} value={titulo.historicoInadimplencia} onChange={(e) => setTitulo((s) => ({ ...s, historicoInadimplencia: e.target.value }))} />
              </Field>
            </div>
          </div>
        </div>
        <div className={`${cardClass} p-4`}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Incidências e obrigações acessórias</h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {([
              ["Incide sobre 13º", "incide13"],
              ["Incide sobre férias", "incideFerias"],
              ["Incide sobre verbas rescisórias", "incideRescisorias"],
              ["Incide sobre PLR/bônus", "incidePlrBonus"],
              ["Inclui plano de saúde", "incluiPlanoSaude"],
              ["Inclui material escolar", "incluiMaterialEscolar"],
              ["Inclui despesas médicas extraordinárias", "incluiMedicasExtra"],
              ["Inclui mensalidade escolar", "incluiMensalidadeEscolar"],
              ["Inclui transporte", "incluiTransporte"],
            ] as [string, string][]).map(([label, key]) => (
              <label key={key} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={Boolean((titulo as Record<string, boolean | string | number>)[key])}
                  onChange={(e) => setTitulo((s) => ({ ...s, [key]: e.target.checked } as TituloData))}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderNeeds() {
    return (
      <div className="space-y-4">
        <div className={`${cardClass} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Quadro de necessidades do alimentado</h3>
              <p className="text-sm text-slate-500">Despesas ordinárias, extraordinárias e compartilhadas.</p>
            </div>
            <button
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              onClick={() =>
                setNeeds((curr) => [
                  ...curr,
                  { id: uid("need"), categoria: "alimentacao", descricao: "", recorrencia: "mensal", valorMensal: 0, valorEventual: 0, compartilhada: false, fracaoCompartilhamento: 1, comprovado: false, observacao: "" },
                ])
              }
            >
              + Adicionar despesa
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Categoria</th>
                  <th className="px-3 py-3 text-left font-semibold">Descrição</th>
                  <th className="px-3 py-3 text-left font-semibold">Recorrência</th>
                  <th className="px-3 py-3 text-left font-semibold">Valor mensal</th>
                  <th className="px-3 py-3 text-left font-semibold">Valor eventual</th>
                  <th className="px-3 py-3 text-left font-semibold">Compartilhada?</th>
                  <th className="px-3 py-3 text-left font-semibold">Fração</th>
                  <th className="px-3 py-3 text-left font-semibold">Comprovada?</th>
                  <th className="px-3 py-3 text-left font-semibold">Observação</th>
                  <th className="px-3 py-3 text-left font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {needs.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200">
                    <td className="px-3 py-3">
                      <select className={numberInputClass} value={item.categoria} onChange={(e) => setNeeds((curr) => curr.map((row) => (row.id === item.id ? { ...row, categoria: e.target.value as Category } : row)))}>
                        {categoryOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                      </select>
                    </td>
                    <td className="px-3 py-3"><input className={numberInputClass} value={item.descricao} onChange={(e) => setNeeds((curr) => curr.map((row) => (row.id === item.id ? { ...row, descricao: e.target.value } : row)))} /></td>
                    <td className="px-3 py-3">
                      <select className={numberInputClass} value={item.recorrencia} onChange={(e) => setNeeds((curr) => curr.map((row) => (row.id === item.id ? { ...row, recorrencia: e.target.value as Frequency } : row)))}>
                        {frequencyOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                      </select>
                    </td>
                    <td className="px-3 py-3"><input className={numberInputClass} type="number" value={item.valorMensal} onChange={(e) => setNeeds((curr) => curr.map((row) => (row.id === item.id ? { ...row, valorMensal: toNumber(e.target.value) } : row)))} /></td>
                    <td className="px-3 py-3"><input className={numberInputClass} type="number" value={item.valorEventual} onChange={(e) => setNeeds((curr) => curr.map((row) => (row.id === item.id ? { ...row, valorEventual: toNumber(e.target.value) } : row)))} /></td>
                    <td className="px-3 py-3"><input type="checkbox" className="h-4 w-4" checked={item.compartilhada} onChange={(e) => setNeeds((curr) => curr.map((row) => (row.id === item.id ? { ...row, compartilhada: e.target.checked } : row)))} /></td>
                    <td className="px-3 py-3"><input className={numberInputClass} type="number" min={0} max={1} step={0.05} value={item.fracaoCompartilhamento} onChange={(e) => setNeeds((curr) => curr.map((row) => (row.id === item.id ? { ...row, fracaoCompartilhamento: Math.min(1, Math.max(0, toNumber(e.target.value))) } : row)))} /></td>
                    <td className="px-3 py-3"><input type="checkbox" className="h-4 w-4" checked={item.comprovado} onChange={(e) => setNeeds((curr) => curr.map((row) => (row.id === item.id ? { ...row, comprovado: e.target.checked } : row)))} /></td>
                    <td className="px-3 py-3"><input className={numberInputClass} value={item.observacao} onChange={(e) => setNeeds((curr) => curr.map((row) => (row.id === item.id ? { ...row, observacao: e.target.value } : row)))} /></td>
                    <td className="px-3 py-3">
                      <button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50" onClick={() => setNeeds((curr) => curr.filter((row) => row.id !== item.id))}>Remover</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <SummaryGrid items={[
          { label: "Despesas ordinárias", value: brl.format(calculations.ordinaryMonthly) },
          { label: "Extraordinárias mensalizadas", value: brl.format(calculations.extraMonthly) },
          { label: "Necessidade mensal total", value: brl.format(calculations.needTotalMonthly) },
          { label: "Índice de prova das despesas", value: pct.format(calculations.needProofRatio) },
        ]} />
      </div>
    );
  }

  function renderPossibility() {
    return (
      <div className="space-y-4">
        <div className={`${cardClass} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Rendas consideradas</h3>
              <p className="text-sm text-slate-500">Renda comprovada, declarada ou estimada, com peso de confiabilidade.</p>
            </div>
            <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800" onClick={() => setIncomes((curr) => [...curr, { id: uid("inc"), parte: "alimentante", tipo: "", valor: 0, recorrencia: "mensal", comprovacao: "", confiabilidade: "media" }])}>
              + Adicionar renda
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Parte</th>
                  <th className="px-3 py-3 text-left font-semibold">Tipo</th>
                  <th className="px-3 py-3 text-left font-semibold">Valor</th>
                  <th className="px-3 py-3 text-left font-semibold">Recorrência</th>
                  <th className="px-3 py-3 text-left font-semibold">Comprovação</th>
                  <th className="px-3 py-3 text-left font-semibold">Confiabilidade</th>
                  <th className="px-3 py-3 text-left font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {incomes.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200">
                    <td className="px-3 py-3">
                      <select className={numberInputClass} value={item.parte} onChange={(e) => setIncomes((curr) => curr.map((row) => (row.id === item.id ? { ...row, parte: e.target.value as "alimentante" | "outro_genitor" } : row)))}>
                        <option value="alimentante">Alimentante</option>
                        <option value="outro_genitor">Outro genitor</option>
                      </select>
                    </td>
                    <td className="px-3 py-3"><input className={numberInputClass} value={item.tipo} onChange={(e) => setIncomes((curr) => curr.map((row) => (row.id === item.id ? { ...row, tipo: e.target.value } : row)))} /></td>
                    <td className="px-3 py-3"><input className={numberInputClass} type="number" value={item.valor} onChange={(e) => setIncomes((curr) => curr.map((row) => (row.id === item.id ? { ...row, valor: toNumber(e.target.value) } : row)))} /></td>
                    <td className="px-3 py-3">
                      <select className={numberInputClass} value={item.recorrencia} onChange={(e) => setIncomes((curr) => curr.map((row) => (row.id === item.id ? { ...row, recorrencia: e.target.value as Frequency } : row)))}>
                        {frequencyOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                      </select>
                    </td>
                    <td className="px-3 py-3"><input className={numberInputClass} value={item.comprovacao} onChange={(e) => setIncomes((curr) => curr.map((row) => (row.id === item.id ? { ...row, comprovacao: e.target.value } : row)))} /></td>
                    <td className="px-3 py-3">
                      <select className={numberInputClass} value={item.confiabilidade} onChange={(e) => setIncomes((curr) => curr.map((row) => (row.id === item.id ? { ...row, confiabilidade: e.target.value as Confidence } : row)))}>
                        <option value="alta">Alta</option>
                        <option value="media">Média</option>
                        <option value="baixa">Baixa</option>
                      </select>
                    </td>
                    <td className="px-3 py-3"><button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50" onClick={() => setIncomes((curr) => curr.filter((row) => row.id !== item.id))}>Remover</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${cardClass} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Despesas essenciais do alimentante</h3>
              <p className="text-sm text-slate-500">Apenas despesas razoáveis e juridicamente relevantes para ajuste da capacidade.</p>
            </div>
            <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800" onClick={() => setExpenses((curr) => [...curr, { id: uid("exp"), tipo: "", valor: 0, recorrencia: "mensal", essencial: true }])}>
              + Adicionar despesa
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Tipo</th>
                  <th className="px-3 py-3 text-left font-semibold">Valor</th>
                  <th className="px-3 py-3 text-left font-semibold">Recorrência</th>
                  <th className="px-3 py-3 text-left font-semibold">Essencial?</th>
                  <th className="px-3 py-3 text-left font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200">
                    <td className="px-3 py-3"><input className={numberInputClass} value={item.tipo} onChange={(e) => setExpenses((curr) => curr.map((row) => (row.id === item.id ? { ...row, tipo: e.target.value } : row)))} /></td>
                    <td className="px-3 py-3"><input className={numberInputClass} type="number" value={item.valor} onChange={(e) => setExpenses((curr) => curr.map((row) => (row.id === item.id ? { ...row, valor: toNumber(e.target.value) } : row)))} /></td>
                    <td className="px-3 py-3">
                      <select className={numberInputClass} value={item.recorrencia} onChange={(e) => setExpenses((curr) => curr.map((row) => (row.id === item.id ? { ...row, recorrencia: e.target.value as Frequency } : row)))}>
                        {frequencyOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                      </select>
                    </td>
                    <td className="px-3 py-3"><input type="checkbox" className="h-4 w-4" checked={item.essencial} onChange={(e) => setExpenses((curr) => curr.map((row) => (row.id === item.id ? { ...row, essencial: e.target.checked } : row)))} /></td>
                    <td className="px-3 py-3"><button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50" onClick={() => setExpenses((curr) => curr.filter((row) => row.id !== item.id))}>Remover</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <SummaryGrid items={[
          { label: "Renda útil do alimentante", value: brl.format(calculations.alimentanteGrossUseful) },
          { label: "Renda útil do outro genitor", value: brl.format(calculations.otherParentUseful) },
          { label: "Despesas essenciais", value: brl.format(calculations.essentialExpenses) },
          { label: "Capacidade contributiva ajustada", value: brl.format(calculations.capacityAdjusted) },
        ]} />
      </div>
    );
  }

  function renderEvents() {
    return (
      <div className="space-y-4">
        <div className={`${cardClass} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Fatos supervenientes</h3>
              <p className="text-sm text-slate-500">Eventos novos que justificam majoração, minoração, manutenção ou exoneração.</p>
            </div>
            <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800" onClick={() => setEvents((curr) => [...curr, { id: uid("evt"), tipo: "", data: "", descricao: "", impacto: 0, alegadoPor: "", prova: "", relevancia: "media" }])}>
              + Adicionar fato
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Tipo</th>
                  <th className="px-3 py-3 text-left font-semibold">Data</th>
                  <th className="px-3 py-3 text-left font-semibold">Descrição</th>
                  <th className="px-3 py-3 text-left font-semibold">Impacto mensal estimado</th>
                  <th className="px-3 py-3 text-left font-semibold">Alegado por</th>
                  <th className="px-3 py-3 text-left font-semibold">Prova</th>
                  <th className="px-3 py-3 text-left font-semibold">Relevância</th>
                  <th className="px-3 py-3 text-left font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {events.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200">
                    <td className="px-3 py-3"><input className={numberInputClass} value={item.tipo} onChange={(e) => setEvents((curr) => curr.map((row) => (row.id === item.id ? { ...row, tipo: e.target.value } : row)))} /></td>
                    <td className="px-3 py-3"><input type="date" className={numberInputClass} value={item.data} onChange={(e) => setEvents((curr) => curr.map((row) => (row.id === item.id ? { ...row, data: e.target.value } : row)))} /></td>
                    <td className="px-3 py-3"><input className={numberInputClass} value={item.descricao} onChange={(e) => setEvents((curr) => curr.map((row) => (row.id === item.id ? { ...row, descricao: e.target.value } : row)))} /></td>
                    <td className="px-3 py-3"><input type="number" className={numberInputClass} value={item.impacto} onChange={(e) => setEvents((curr) => curr.map((row) => (row.id === item.id ? { ...row, impacto: toNumber(e.target.value) } : row)))} /></td>
                    <td className="px-3 py-3"><input className={numberInputClass} value={item.alegadoPor} onChange={(e) => setEvents((curr) => curr.map((row) => (row.id === item.id ? { ...row, alegadoPor: e.target.value } : row)))} /></td>
                    <td className="px-3 py-3"><input className={numberInputClass} value={item.prova} onChange={(e) => setEvents((curr) => curr.map((row) => (row.id === item.id ? { ...row, prova: e.target.value } : row)))} /></td>
                    <td className="px-3 py-3">
                      <select className={numberInputClass} value={item.relevancia} onChange={(e) => setEvents((curr) => curr.map((row) => (row.id === item.id ? { ...row, relevancia: e.target.value as Relevancia } : row)))}>
                        <option value="alta">Alta</option>
                        <option value="media">Média</option>
                        <option value="baixa">Baixa</option>
                      </select>
                    </td>
                    <td className="px-3 py-3"><button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50" onClick={() => setEvents((curr) => curr.filter((row) => row.id !== item.id))}>Remover</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <SummaryGrid items={[
          { label: "Quantidade de fatos", value: String(events.length) },
          { label: "Densidade média de relevância", value: pct.format(calculations.eventsStrength) },
          { label: "Coerência do pedido", value: pct.format(calculations.requestCoherence) },
          { label: "Robustez jurídica preliminar", value: pct.format(calculations.robustness) },
        ]} />
      </div>
    );
  }

  function renderSimulator() {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className={`${cardClass} p-4`}>
            <div className="mb-4">
              <h3 className={sectionTitleClass}>Cenários revisionais</h3>
              <p className="text-sm text-slate-500">O sistema compara necessidade mensal, capacidade contributiva e proporção entre os genitores.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold">Cenário</th>
                    <th className="px-3 py-3 text-left font-semibold">Valor sugerido</th>
                    <th className="px-3 py-3 text-left font-semibold">% da renda útil</th>
                    <th className="px-3 py-3 text-left font-semibold">Impacto anual</th>
                    <th className="px-3 py-3 text-left font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {calculations.scenarioResults.map((scenario) => (
                    <tr key={scenario.nome} className="border-t border-slate-200">
                      <td className="px-3 py-3 font-medium text-slate-900">{scenario.nome}</td>
                      <td className="px-3 py-3">{brl.format(scenario.value)}</td>
                      <td className="px-3 py-3">{pct.format(scenario.percentage)}</td>
                      <td className="px-3 py-3">{brl.format(scenario.annual)}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          scenario.percentage <= 0.3
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : scenario.percentage <= 0.4
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}>
                          {scenario.percentage <= 0.3 ? "Muito defensável" : scenario.percentage <= 0.4 ? "Atenção" : "Risco elevado"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${cardClass} p-4`}>
            <h3 className={sectionTitleClass}>Quadro-resumo</h3>
            <div className="mt-4 space-y-3">
              <MetricCard title="Encargo atual estimado" value={brl.format(calculations.currentValue)} />
              <MetricCard title="Sugestão intermediária" value={brl.format(calculations.suggestedBase)} />
              <MetricCard title="Diferença mensal" value={brl.format(calculations.differenceVsCurrent)} />
              <MetricCard title="Participação do alimentante" value={pct.format(calculations.alimentanteShare)} />
              <MetricCard title="Participação do outro genitor" value={pct.format(calculations.otherParentShare)} />
              <div className={`rounded-2xl border p-4 ${metricTone(calculations.robustness)}`}>
                <div className="text-xs font-semibold uppercase tracking-wide">Robustez jurídica</div>
                <div className="mt-1 text-2xl font-bold">{pct.format(calculations.robustness)}</div>
                <p className="mt-1 text-sm">
                  {calculations.robustness >= 0.75
                    ? "Conjunto probatório e coerência do pedido estão fortes."
                    : calculations.robustness >= 0.5
                    ? "Caso viável, mas merece reforço documental."
                    : "Estrutura revisional ainda frágil; ampliar prova e contextualização."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className={`${cardClass} overflow-hidden`}>
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-base font-semibold text-slate-900">Diferenças retroativas simuladas</h3>
            <p className="text-sm text-slate-500">Comparativo ilustrativo entre encargo atual e cenário intermediário.</p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Índice de correção</label>
                <select
                  className={numberInputClass}
                  value={indiceCorrecaoRetro}
                  onChange={(e) => setIndiceCorrecaoRetro(e.target.value as IndiceCorrecaoRetro)}
                >
                  <option value="IPCA-E">IPCA-E</option>
                  <option value="INPC">INPC</option>
                  <option value="SELIC">SELIC</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>
              {indiceCorrecaoRetro === "Manual" && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Taxa mensal (%)</label>
                  <input
                    type="number"
                    className={numberInputClass}
                    value={percentualManualCorrecao}
                    min={0}
                    step={0.01}
                    onChange={(e) => setPercentualManualCorrecao(Number(e.target.value))}
                  />
                </div>
              )}
              <span className="text-xs text-slate-400 self-end pb-2">
                Taxa mensal estimada: {(taxaMensalCorrecao * 100).toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Competência</th>
                  <th className="px-3 py-3 text-left font-semibold">Devido</th>
                  <th className="px-3 py-3 text-left font-semibold">Pago</th>
                  <th className="px-3 py-3 text-left font-semibold">Diferença</th>
                  <th className="px-3 py-3 text-left font-semibold">Correção</th>
                  <th className="px-3 py-3 text-left font-semibold">Juros</th>
                  <th className="px-3 py-3 text-left font-semibold">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {retroRows.map((row) => (
                  <tr key={row.competencia} className="border-t border-slate-200">
                    <td className="px-3 py-3">{row.competencia}</td>
                    <td className="px-3 py-3">{brl.format(row.devido)}</td>
                    <td className="px-3 py-3">{brl.format(row.pago)}</td>
                    <td className="px-3 py-3">{brl.format(row.diferenca)}</td>
                    <td className="px-3 py-3">{brl.format(row.correcao)}</td>
                    <td className="px-3 py-3">{brl.format(row.juros)}</td>
                    <td className="px-3 py-3 font-medium text-slate-900">{brl.format(row.atualizado)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td className="px-3 py-3 font-semibold text-slate-900">Total</td>
                  <td></td><td></td>
                  <td className="px-3 py-3 font-semibold text-slate-900">{brl.format(retroRows.reduce((acc, row) => acc + row.diferenca, 0))}</td>
                  <td className="px-3 py-3 font-semibold text-slate-900">{brl.format(retroRows.reduce((acc, row) => acc + row.correcao, 0))}</td>
                  <td className="px-3 py-3 font-semibold text-slate-900">{brl.format(retroRows.reduce((acc, row) => acc + row.juros, 0))}</td>
                  <td className="px-3 py-3 font-semibold text-slate-900">{brl.format(retroRows.reduce((acc, row) => acc + row.atualizado, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderReport() {
    return (
      <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <div className={`${cardClass} p-4`}>
          <h3 className={sectionTitleClass}>Checklist de consistência</h3>
          <div className="mt-4 space-y-3">
            <ConsistencyItem title="Prova das necessidades" value={calculations.needProofRatio} />
            <ConsistencyItem title="Prova da possibilidade" value={calculations.possibilityProofRatio} />
            <ConsistencyItem title="Fato superveniente" value={calculations.eventsStrength} />
            <ConsistencyItem title="Coerência do pedido" value={calculations.requestCoherence} />
            <ConsistencyItem title="Robustez geral" value={calculations.robustness} />
          </div>
        </div>
        <div className={`${cardClass} p-4`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className={sectionTitleClass}>Prévia do relatório técnico-jurídico</h3>
              <p className="text-sm text-slate-500">Texto automático para laudo, parecer, cálculo preparatório ou apoio à petição.</p>
            </div>
            <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => navigator.clipboard?.writeText(reportText)}>
              Copiar texto
            </button>
          </div>
          <textarea className="min-h-[600px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm text-slate-800 outline-none" value={reportText} readOnly />
        </div>
      </div>
    );
  }

  const stepContent: Record<StepKey, React.ReactNode> = {
    caso: renderCase(),
    partes: renderPeople(),
    titulo: renderTitulo(),
    necessidades: renderNeeds(),
    possibilidade: renderPossibility(),
    fatos: renderEvents(),
    simulador: renderSimulator(),
    relatorio: renderReport(),
  };

  const currentStepIndex = steps.findIndex((s) => s.key === activeStep);

  return (
    <div className="min-h-screen bg-slate-100 p-4 text-slate-800 md:p-6">
      <div className="mx-auto grid max-w-[1800px] gap-6 xl:grid-cols-[320px_1fr]">
        <aside className={`${cardClass} h-fit p-4`}>
          <div className="border-b border-slate-200 pb-4">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Veritas Família</div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Revisão de Pensão Alimentícia</h1>
            <p className="mt-2 text-sm text-slate-500">
              Motor de análise jurídico-financeira orientado por necessidade, possibilidade, proporcionalidade e fato superveniente.
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {steps.map((step, index) => {
              const selected = step.key === activeStep;
              return (
                <button
                  key={step.key}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    selected
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  onClick={() => setActiveStep(step.key)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${selected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"}`}>
                      {index + 1}
                    </span>
                    <div>
                      <div className="font-semibold">{step.label}</div>
                      <div className={`text-xs ${selected ? "text-slate-200" : "text-slate-500"}`}>{step.descricao}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3">
            <div className={`${cardClass} p-4`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumo rápido</div>
              <div className="mt-3 space-y-2 text-sm">
                <QuickInfo label="Encargo atual" value={brl.format(calculations.currentValue)} />
                <QuickInfo label="Necessidade total" value={brl.format(calculations.needTotalMonthly)} />
                <QuickInfo label="Capacidade ajustada" value={brl.format(calculations.capacityAdjusted)} />
                <QuickInfo label="Sugestão intermediária" value={brl.format(calculations.suggestedBase)} />
              </div>
            </div>
            <div className={`${cardClass} p-4`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Diagnóstico</div>
              <p className="mt-3 text-sm text-slate-600">
                {calculations.robustness >= 0.75
                  ? "Caso com boa aderência revisional. Vale aprofundar prova documental e fechar relatório."
                  : calculations.robustness >= 0.5
                  ? "Caso promissor, mas precisa reforçar renda, despesas e fatos supervenientes."
                  : "Caso ainda incompleto. Priorize documentos, histórico do título e fatos novos relevantes."}
              </p>
            </div>
          </div>
        </aside>

        <main className="space-y-6">
          <section className={`${cardClass} p-4`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Painel do caso</div>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">{caseData.processo || "Novo caso de revisão de alimentos"}</h2>
                <p className="mt-1 text-sm text-slate-500">{describeDemand(caseData.tipoDemanda)} · {caseData.comarca} · {caseData.vara}</p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {loadingRecover && (
                  <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-2.5 py-2 text-xs text-blue-700">
                    Recuperando cálculo…
                  </div>
                )}
                {/* Recuperar cálculo por chave */}
                <div className="flex items-center gap-1">
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs w-44 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="Chave de recuperação"
                    value={inputChave}
                    onChange={e => setInputChave(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleRecoverCalculo()}
                  />
                  <button
                    type="button"
                    onClick={handleRecoverCalculo}
                    disabled={loadingRecover}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    title="Recuperar cálculo"
                  >↺</button>
                </div>
                {chaveGerada && (
                  <div className="rounded-md bg-slate-50 border border-slate-200 px-2.5 py-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                      🔑 Chave de Recuperação
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono font-bold text-[#0f2a4a] tracking-wider">{chaveGerada}</code>
                      <button
                        type="button"
                        className="rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-700 border border-slate-200 hover:bg-slate-100 transition"
                        onClick={() => { navigator.clipboard.writeText(chaveGerada!); toast({ title: "Chave copiada!" }); }}
                      >📋</button>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-tight">Use esta chave para recuperar o cálculo a qualquer momento</p>
                  </div>
                )}
                <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={handleNovoCalculo}>
                  Novo cálculo
                </button>
                <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => setActiveStep(steps[Math.max(currentStepIndex - 1, 0)].key)}>
                  Etapa anterior
                </button>
                <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800" onClick={() => setActiveStep(steps[Math.min(currentStepIndex + 1, steps.length - 1)].key)}>
                  Próxima etapa
                </button>
                <button className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800" onClick={handleGeneratePdf}>
                  Gerar PDF
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <KpiCard title="Encargo atual" value={brl.format(calculations.currentValue)} subtitle="Regra vigente estimada" />
              <KpiCard title="Necessidade total" value={brl.format(calculations.needTotalMonthly)} subtitle="Mensal apurada" />
              <KpiCard title="Renda útil" value={brl.format(calculations.alimentanteGrossUseful)} subtitle="Alimentante" />
              <KpiCard title="Capacidade ajustada" value={brl.format(calculations.capacityAdjusted)} subtitle="Após despesas essenciais" />
              <KpiCard title="Sugestão" value={brl.format(calculations.suggestedBase)} subtitle="Cenário intermediário" />
              <KpiCard title="Robustez" value={pct.format(calculations.robustness)} subtitle="Pré-análise jurídica" />
            </div>
          </section>

          <section className={`${cardClass} p-4`}>
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Etapa ativa</div>
              <h2 className="mt-1 text-xl font-bold text-slate-900">{steps[currentStepIndex]?.label}</h2>
              <p className="mt-1 text-sm text-slate-500">{steps[currentStepIndex]?.descricao}</p>
            </div>
            {stepContent[activeStep]}
          </section>
        </main>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function SummaryGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className={`${cardClass} p-4`}>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</div>
          <div className="mt-2 text-xl font-bold text-slate-900">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function KpiCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
    </div>
  );
}

function QuickInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function ConsistencyItem({ title, value }: { title: string; value: number }) {
  const tone =
    value >= 0.75
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : value >= 0.5
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-rose-200 bg-rose-50 text-rose-700";
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="text-xs font-semibold uppercase tracking-wide">{title}</div>
      <div className="mt-1 text-2xl font-bold">{pct.format(value)}</div>
    </div>
  );
}

function describeDemand(value: DemandType) {
  switch (value) {
    case "revisional_majoracao": return "Ação revisional para majoração de alimentos";
    case "revisional_minoracao": return "Ação revisional para minoração de alimentos";
    case "manutencao": return "Análise para manutenção do encargo";
    case "exoneracao": return "Estudo preliminar de exoneração";
    case "calculo_extrajudicial": return "Cálculo extrajudicial preparatório";
    default: return value;
  }
}

function describeTitulo(value: TituloTipo) {
  switch (value) {
    case "valor_fixo": return "Valor fixo";
    case "percentual_salario": return "Percentual sobre salário";
    case "percentual_rendimentos_liquidos": return "Percentual sobre rendimentos líquidos";
    case "salario_minimo": return "Salário mínimo";
    case "hibrido": return "Obrigação híbrida";
    default: return value;
  }
}
