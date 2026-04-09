import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  CheckCircle2,
  FileBarChart2,
  FileSearch,
  Gavel,
  HardHat,
  Scale,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  TrendingUp,
} from "lucide-react";
import CorrecaoTrabalhistaUI from "@/components/correcao-trabalhista-ui";

// ─── Types ────────────────────────────────────────────────────────────────────

type AbaAtiva =
  | "visao-geral"
  | "identificacao"
  | "normativo"
  | "periodos"
  | "reflexos"
  | "consolidacao"
  | "atualizacao";

type GrauInsalubridade = "nenhum" | "minimo" | "medio" | "maximo";
type TipoRiscoPericulosidade =
  | ""
  | "inflamaveis"
  | "explosivos"
  | "energia_eletrica"
  | "seguranca_patrimonial"
  | "motocicleta"
  | "outros";

type TipoExposicao = "habitual" | "intermitente" | "eventual";

type Competencia = {
  id: string;
  inicio: string;
  fim: string;
  salarioBase: number;
  salarioMinimo: number;
  tipoExposicao: TipoExposicao;
  agenteNocivo: string;
  nrAnexo: string;
  grauInsalubridade: GrauInsalubridade;
  haPericulosidade: boolean;
  tipoPericulosidade: TipoRiscoPericulosidade;
  epiFornecido: boolean;
  epiEficaz: boolean;
  documentosTecnicos: boolean;
  laudoFavoravel: boolean;
  observacoes: string;
};

type ReflexosConfig = {
  horasExtras: boolean;
  adicionalNoturno: boolean;
  avisoPrevio: boolean;
  decimoTerceiro: boolean;
  feriasTerco: boolean;
  fgts: boolean;
  multaFgts40: boolean;
};

type ResultadoCompetencia = {
  id: string;
  periodo: string;
  insalubridade: number;
  periculosidade: number;
  principal: number;
  tipoPrincipal: "insalubridade" | "periculosidade" | "nenhum";
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ABAS: { id: AbaAtiva; label: string }[] = [
  { id: "visao-geral", label: "Visão Geral" },
  { id: "identificacao", label: "Identificação" },
  { id: "normativo", label: "Normativo" },
  { id: "periodos", label: "Períodos" },
  { id: "reflexos", label: "Reflexos" },
  { id: "consolidacao", label: "Consolidação" },
  { id: "atualizacao", label: "Atualização" },
];

const normasBase = [
  { sigla: "CF/88", texto: "Art. 7º, XXIII" },
  { sigla: "CLT", texto: "Arts. 189 a 195" },
  { sigla: "NR-15", texto: "Atividades e operações insalubres" },
  { sigla: "NR-16", texto: "Atividades e operações perigosas" },
  { sigla: "NR-6", texto: "Equipamento de proteção individual" },
  { sigla: "NR-7", texto: "PCMSO" },
  { sigla: "NR-9/PGR", texto: "Gerenciamento de riscos" },
  { sigla: "TST", texto: "Súmulas e jurisprudência correlata" },
];

const anexosInsalubridade = [
  "Anexo 1 - Ruído contínuo ou intermitente",
  "Anexo 2 - Ruído de impacto",
  "Anexo 3 - Calor",
  "Anexo 11 - Agentes químicos",
  "Anexo 13 - Agentes químicos",
  "Anexo 14 - Agentes biológicos",
];

const riscosPericulosidade = [
  { value: "inflamaveis", label: "Inflamáveis" },
  { value: "explosivos", label: "Explosivos" },
  { value: "energia_eletrica", label: "Energia elétrica" },
  { value: "seguranca_patrimonial", label: "Segurança patrimonial/pessoal" },
  { value: "motocicleta", label: "Motocicleta" },
  { value: "outros", label: "Outros" },
] as const;

const reflexosDefault: ReflexosConfig = {
  horasExtras: true,
  adicionalNoturno: true,
  avisoPrevio: true,
  decimoTerceiro: true,
  feriasTerco: true,
  fgts: true,
  multaFgts40: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200";
const textareaCls =
  "min-h-[120px] w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200";
const readOnlyBoxCls =
  "rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-900";

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}

function toMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function percentInsalubridade(grau: GrauInsalubridade) {
  return grau === "minimo" ? 0.1 : grau === "medio" ? 0.2 : grau === "maximo" ? 0.4 : 0;
}

function calcInsalubridade(c: Competencia) {
  const pct = percentInsalubridade(c.grauInsalubridade);
  if (!c.laudoFavoravel || c.epiEficaz || c.tipoExposicao === "eventual" || pct <= 0) return 0;
  return c.salarioMinimo * pct;
}

function calcPericulosidade(c: Competencia) {
  if (!c.laudoFavoravel || !c.haPericulosidade || c.tipoExposicao === "eventual") return 0;
  return c.salarioBase * 0.3;
}

function calcReflexos(principal: number, cfg: ReflexosConfig) {
  const he = cfg.horasExtras ? principal : 0;
  const an = cfg.adicionalNoturno ? principal : 0;
  const ap = cfg.avisoPrevio ? principal : 0;
  const dt = cfg.decimoTerceiro ? principal : 0;
  const ft = cfg.feriasTerco ? principal * (4 / 3) : 0;
  const fg = cfg.fgts ? principal * 0.08 : 0;
  const mf = cfg.multaFgts40 ? fg * 0.4 : 0;
  return { horasExtras: he, adicionalNoturno: an, avisoPrevio: ap, decimoTerceiro: dt, feriasTerco: ft, fgts: fg, multaFgts40: mf, total: he + an + ap + dt + ft + fg + mf };
}

function getPeriodoLabel(c: Competencia) {
  if (c.inicio && c.fim) return `${c.inicio} a ${c.fim}`;
  return c.inicio || c.fim || "Período não informado";
}

function getAlertas(c: Competencia) {
  const list: string[] = [];
  if (!c.laudoFavoravel) list.push("Sem laudo favorável: cálculo automático fica zerado.");
  if (c.epiEficaz && c.grauInsalubridade !== "nenhum") list.push("EPI eficaz afasta a insalubridade.");
  if (c.tipoExposicao === "eventual") list.push("Exposição eventual não é computada automaticamente.");
  if (c.haPericulosidade && !c.tipoPericulosidade) list.push("Tipo de risco de periculosidade não selecionado.");
  if (c.haPericulosidade && c.grauInsalubridade !== "nenhum") list.push("Concomitância: o sistema aplica o adicional mais vantajoso.");
  if (list.length === 0) list.push("Período consistente na validação operacional.");
  return list;
}

function labelGrau(g: GrauInsalubridade) {
  return g === "minimo" ? "mín." : g === "medio" ? "méd." : g === "maximo" ? "máx." : "nenhum";
}

function createCompetencia(): Competencia {
  return {
    id: newId(),
    inicio: "", fim: "", salarioBase: 0, salarioMinimo: 1518,
    tipoExposicao: "habitual", agenteNocivo: "", nrAnexo: "",
    grauInsalubridade: "nenhum", haPericulosidade: false,
    tipoPericulosidade: "", epiFornecido: false, epiEficaz: false,
    documentosTecnicos: false, laudoFavoravel: false, observacoes: "",
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InField({ label, children, colSpan }: { label: string; children: React.ReactNode; colSpan?: string }) {
  return (
    <label className={`block ${colSpan ?? ""}`}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function InPanel({ title, subtitle, icon, action, children }: { title: string; subtitle: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-xl shadow-slate-200/50 backdrop-blur md:p-6">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">{icon}</div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function InPanelMini({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

function InSidePanel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-lg shadow-slate-200/40 backdrop-blur">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">{icon}</div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function InExecutiveCard({ title, value, subtitle, icon, highlight = false }: { title: string; value: string; subtitle: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-[26px] border p-5 shadow-sm transition ${highlight ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white" : "border-slate-200 bg-white"}`}>
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${highlight ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-white"}`}>{icon}</div>
      <div className="mt-4 text-sm font-medium text-slate-600">{title}</div>
      <div className="mt-1 text-xl font-bold text-slate-950 whitespace-nowrap">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
    </div>
  );
}

function InHeroMetric({ icon, title, value, subtitle }: { icon: React.ReactNode; title: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-amber-300">{icon}</div>
      <div className="mt-3 text-sm text-slate-300">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
    </div>
  );
}

function InMetricDark({ title, value, subtitle, highlight = false }: { title: string; value: string; subtitle: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${highlight ? "bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950" : "bg-white/5 text-white"}`}>
      <div className={highlight ? "text-sm font-semibold text-slate-900" : "text-sm text-slate-300"}>{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className={highlight ? "mt-1 text-xs text-slate-800/80" : "mt-1 text-xs text-slate-400"}>{subtitle}</div>
    </div>
  );
}

function InToggleCard({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex cursor-pointer items-center justify-between rounded-[22px] border p-4 transition ${checked ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:bg-white"}`}>
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <button type="button" onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        className={`relative h-7 w-12 rounded-full transition ${checked ? "bg-emerald-500" : "bg-slate-300"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} />
      </button>
    </label>
  );
}

function InNormChip({ sigla, texto }: { sigla: string; texto: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-bold uppercase tracking-[0.20em] text-slate-500">{sigla}</div>
      <div className="mt-2 text-sm font-medium text-slate-800">{texto}</div>
    </div>
  );
}

function InInfoBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "dark" }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs ${tone === "dark" ? "border border-white/10 bg-white/10 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>
      {children}
    </span>
  );
}

function InInfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2">
      <span className="text-slate-500 text-sm">{label}</span>
      <span className="text-right font-medium text-slate-800 text-sm">{value}</span>
    </div>
  );
}

function InRow({ label, value }: { label: string; value: number }) {
  return (
    <tr className="border-t border-slate-200">
      <td className="px-5 py-4 text-slate-700">{label}</td>
      <td className="px-5 py-4 font-medium text-slate-900">{toMoney(value)}</td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InsalubridadePericulosidade({ processo: processoProp = "", vara: varaProp = "", reclamante: reclamanteProp = "", reclamada: reclamadaProp = "", cargo: cargoProp = "" }: {
  processo?: string;
  vara?: string;
  reclamante?: string;
  reclamada?: string;
  cargo?: string;
}) {
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>("visao-geral");

  const [empresa, setEmpresa] = useState(reclamadaProp || "EMPRESA EXEMPLO LTDA.");
  const [reclamante, setReclamante] = useState(reclamanteProp || "NOME DO TRABALHADOR");
  const [cargo, setCargo] = useState(cargoProp || "Função/Cargo");
  const [processo, setProcesso] = useState(processoProp || "0000000-00.2026.5.00.0000");
  const [vara, setVara] = useState(varaProp || "Vara do Trabalho");
  const [perito, setPerito] = useState("Dr. Vasconcelos Reis Wakim");
  const [assistente, setAssistente] = useState("");
  const [dataBase, setDataBase] = useState(new Date().toISOString().slice(0, 10));
  const [normaColetiva, setNormaColetiva] = useState("");
  const [observacoesGerais, setObservacoesGerais] = useState(
    "Apuração estruturada para apoio pericial, liquidação e construção de laudo técnico no padrão Veritas."
  );
  const [metodologia, setMetodologia] = useState(
    "Aplicação operacional da CF/88, CLT arts. 189 a 195, NR-15, NR-16 e documentação técnica disponível, com escolha automática do adicional economicamente mais vantajoso por período."
  );

  const [competencias, setCompetencias] = useState<Competencia[]>([
    {
      ...createCompetencia(),
      inicio: "2025-01-01",
      fim: "2025-12-31",
      salarioBase: 3200,
      salarioMinimo: 1518,
      tipoExposicao: "habitual",
      agenteNocivo: "Agentes biológicos",
      nrAnexo: "Anexo 14 - Agentes biológicos",
      grauInsalubridade: "maximo",
      haPericulosidade: true,
      tipoPericulosidade: "energia_eletrica",
      epiFornecido: true,
      epiEficaz: false,
      documentosTecnicos: true,
      laudoFavoravel: true,
      observacoes: "Atuação em ambiente com agentes biológicos e proximidade de fonte energizada.",
    },
  ]);

  const [periodoSelecionadoId, setPeriodoSelecionadoId] = useState<string>(competencias[0].id);
  const [reflexos, setReflexos] = useState<ReflexosConfig>(reflexosDefault);

  const resultados = useMemo<ResultadoCompetencia[]>(() => {
    return competencias.map((c) => {
      const ins = calcInsalubridade(c);
      const per = calcPericulosidade(c);
      if (per > ins && per > 0) return { id: c.id, periodo: getPeriodoLabel(c), insalubridade: ins, periculosidade: per, principal: per, tipoPrincipal: "periculosidade" };
      if (ins > 0) return { id: c.id, periodo: getPeriodoLabel(c), insalubridade: ins, periculosidade: per, principal: ins, tipoPrincipal: "insalubridade" };
      return { id: c.id, periodo: getPeriodoLabel(c), insalubridade: ins, periculosidade: per, principal: 0, tipoPrincipal: "nenhum" };
    });
  }, [competencias]);

  const periodoSel = competencias.find((c) => c.id === periodoSelecionadoId) ?? competencias[0];
  const resultadoSel = resultados.find((r) => r.id === periodoSelecionadoId) ?? resultados[0];

  const totalInsalubridade = resultados.reduce((s, r) => s + r.insalubridade, 0);
  const totalPericulosidade = resultados.reduce((s, r) => s + r.periculosidade, 0);
  const principalTotal = resultados.reduce((s, r) => s + r.principal, 0);
  const reflexosCalc = calcReflexos(principalTotal, reflexos);
  const totalGeral = principalTotal + reflexosCalc.total;

  const verbasInsalubridade = useMemo(
    () =>
      resultados
        .filter((r) => r.principal > 0)
        .map((r) => {
          const c = competencias.find((x) => x.id === r.id);
          const compYM = c?.inicio?.slice(0, 7) ?? "2020-01";
          return {
            id: r.id,
            descricao: `Adicional Ins./Peric. — ${r.periodo}`,
            valorNominal: r.principal,
            competencia: compYM,
            dataVencimento: c?.fim ?? `${compYM}-28`,
          };
        }),
    [resultados, competencias],
  );

  const periodosComLaudo = competencias.filter((c) => c.laudoFavoravel).length;
  const periodosComDocs = competencias.filter((c) => c.documentosTecnicos).length;

  function upd<K extends keyof Competencia>(id: string, field: K, value: Competencia[K]) {
    setCompetencias((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }

  function addPeriodo() {
    const novo = createCompetencia();
    setCompetencias((prev) => [...prev, novo]);
    setPeriodoSelecionadoId(novo.id);
    setAbaAtiva("periodos");
  }

  function removePeriodo(id: string) {
    setCompetencias((prev) => {
      if (prev.length === 1) return prev;
      const next = prev.filter((c) => c.id !== id);
      if (periodoSelecionadoId === id && next[0]) setPeriodoSelecionadoId(next[0].id);
      return next;
    });
  }

  return (
    <div className="bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.10),_transparent_24%),linear-gradient(180deg,#071120_0%,#0b1730_18%,#edf2f7_18%,#eef2f7_100%)] text-slate-900 rounded-2xl overflow-hidden">
      <div className="mx-auto max-w-[1600px] px-4 pb-10 pt-5 md:px-8">

        {/* Header ─────────────────────────────────────────────────────────── */}
        <header className="overflow-hidden rounded-[30px] border border-white/10 bg-slate-950 text-white shadow-2xl shadow-slate-950/30">
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.16),_transparent_28%),radial-gradient(circle_at_left,_rgba(59,130,246,0.16),_transparent_30%)]" />
            <div className="relative z-10 grid gap-6 p-6 md:grid-cols-[1.4fr_0.9fr] md:p-8">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-300">
                  <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-amber-200">Veritas Analytics</span>
                  <span>Módulo Trabalhista</span>
                  <span>•</span>
                  <span>Insalubridade &amp; Periculosidade</span>
                </div>
                <div className="mt-5 flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/25">
                    <Scale className="h-7 w-7" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold md:text-3xl">Adicional de Insalubridade e Periculosidade</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                      Apuração técnico-jurídica por períodos, enquadramento normativo, gestão de agentes nocivos e consolidação com reflexos trabalhistas.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <InHeroMetric icon={<FileSearch className="h-5 w-5" />} title="Períodos cadastrados" value={String(competencias.length)} subtitle="Estruturação por blocos técnicos" />
                <InHeroMetric icon={<ShieldCheck className="h-5 w-5" />} title="Períodos com laudo" value={String(periodosComLaudo)} subtitle="Base para cálculo automático" />
                <InHeroMetric icon={<HardHat className="h-5 w-5" />} title="Documentos técnicos" value={String(periodosComDocs)} subtitle="PGR, PCMSO, LTCAT" />
                <InHeroMetric icon={<Sparkles className="h-5 w-5" />} title="Total geral estimado" value={toMoney(totalGeral)} subtitle="Principal + reflexos" />
              </div>
            </div>
          </div>
        </header>

        {/* Nav tabs ───────────────────────────────────────────────────────── */}
        <nav className="mt-5 rounded-[26px] border border-white/60 bg-white/80 p-2 shadow-lg backdrop-blur">
          <div className="flex flex-wrap gap-2">
            {ABAS.map((aba) => (
              <button key={aba.id} onClick={() => setAbaAtiva(aba.id)}
                className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${abaAtiva === aba.id ? "bg-slate-900 text-white shadow-lg shadow-slate-900/15" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
                {aba.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Main + Sidebar ──────────────────────────────────────────────────── */}
        <main className={`mt-6 grid gap-6 ${(abaAtiva === "periodos" || abaAtiva === "consolidacao" || abaAtiva === "atualizacao") ? "grid-cols-1" : "xl:grid-cols-[1.5fr_0.55fr]"}`}>
          <section className="space-y-6">

            {/* Visão geral — executive cards */}
            {(abaAtiva === "visao-geral" || abaAtiva === "consolidacao") && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <InExecutiveCard title="Insalubridade total" value={toMoney(totalInsalubridade)} subtitle="Soma de todos os períodos" icon={<TriangleAlert className="h-5 w-5" />} />
                <InExecutiveCard title="Periculosidade total" value={toMoney(totalPericulosidade)} subtitle="Soma de todos os períodos" icon={<ShieldCheck className="h-5 w-5" />} />
                <InExecutiveCard title="Principal escolhido" value={toMoney(principalTotal)} subtitle="Mais vantajoso por período" icon={<Gavel className="h-5 w-5" />} highlight />
                <InExecutiveCard title="Reflexos" value={toMoney(reflexosCalc.total)} subtitle="Estimativa agregada" icon={<FileBarChart2 className="h-5 w-5" />} />
              </div>
            )}

            {/* Identificação */}
            {(abaAtiva === "visao-geral" || abaAtiva === "identificacao") && (
              <InPanel title="Identificação do caso" subtitle="Dados centrais da apuração judicial, pericial e operacional." icon={<Briefcase className="h-5 w-5" />}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <InField label="Empresa/Reclamada"><input className={inputCls} value={empresa} onChange={(e) => setEmpresa(e.target.value)} /></InField>
                  <InField label="Reclamante"><input className={inputCls} value={reclamante} onChange={(e) => setReclamante(e.target.value)} /></InField>
                  <InField label="Cargo/Função"><input className={inputCls} value={cargo} onChange={(e) => setCargo(e.target.value)} /></InField>
                  <InField label="Número do processo"><input className={inputCls} value={processo} onChange={(e) => setProcesso(e.target.value)} /></InField>
                  <InField label="Vara / Tribunal"><input className={inputCls} value={vara} onChange={(e) => setVara(e.target.value)} /></InField>
                  <InField label="Data-base da apuração"><input type="date" className={inputCls} value={dataBase} onChange={(e) => setDataBase(e.target.value)} /></InField>
                  <InField label="Perito responsável"><input className={inputCls} value={perito} onChange={(e) => setPerito(e.target.value)} /></InField>
                  <InField label="Assistente técnico"><input className={inputCls} value={assistente} onChange={(e) => setAssistente(e.target.value)} /></InField>
                  <InField label="Norma coletiva / ACT / CCT"><input className={inputCls} value={normaColetiva} onChange={(e) => setNormaColetiva(e.target.value)} /></InField>
                  <InField label="Observações gerais" colSpan="xl:col-span-3"><textarea className={textareaCls} value={observacoesGerais} onChange={(e) => setObservacoesGerais(e.target.value)} /></InField>
                  <InField label="Metodologia aplicada" colSpan="xl:col-span-3"><textarea className={textareaCls} value={metodologia} onChange={(e) => setMetodologia(e.target.value)} /></InField>
                </div>
              </InPanel>
            )}

            {/* Normativo */}
            {(abaAtiva === "visao-geral" || abaAtiva === "normativo") && (
              <InPanel title="Enquadramento normativo" subtitle="Base legal e técnica incorporada à lógica do módulo." icon={<Building2 className="h-5 w-5" />}>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {normasBase.map((item) => <InNormChip key={item.sigla + item.texto} sigla={item.sigla} texto={item.texto} />)}
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <InInfoBlock title="Regras operacionais aplicadas" items={[
                    "Vedação de cumulação automática entre insalubridade e periculosidade.",
                    "Escolha do adicional economicamente mais vantajoso por período.",
                    "Necessidade de laudo favorável para cálculo-base automático.",
                    "EPI eficaz afasta a insalubridade na lógica operacional.",
                    "Exposição eventual não gera cálculo automático nesta versão.",
                  ]} />
                  <InInfoBlock title="Base jurisprudencial" items={[
                    "TST Súmula 191 — Periculosidade: percentual sobre salário-base.",
                    "TST Súmula 228 — Insalubridade: base de cálculo no salário mínimo.",
                    "OJ SDI-1 nº 173 — Concomitância: opção pelo mais benéfico.",
                    "STF RE 565714 — Impossibilidade de cumulação.",
                    "NR-15/NR-16: requisitos de caracterização técnica.",
                  ]} />
                </div>
              </InPanel>
            )}

            {/* Períodos */}
            {(abaAtiva === "visao-geral" || abaAtiva === "periodos") && (
              <InPanel title="Períodos de apuração" subtitle="Estruture quantos períodos forem necessários para refletir alterações fáticas, normativas e periciais." icon={<FileSearch className="h-5 w-5" />}
                action={
                  <button onClick={addPeriodo} className="rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/25 transition hover:brightness-95">
                    + Adicionar período
                  </button>
                }>
                {/* ── Seletor horizontal de períodos ─────────────────────── */}
                <div className="flex flex-wrap gap-3">
                  {competencias.map((c, index) => {
                    const r = resultados.find((item) => item.id === c.id);
                    const ativo = c.id === periodoSelecionadoId;
                    return (
                      <button key={c.id} onClick={() => setPeriodoSelecionadoId(c.id)}
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition min-w-[200px] ${ativo ? "border-slate-900 bg-slate-900 text-white shadow-xl shadow-slate-900/20" : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"}`}>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] uppercase tracking-[0.18em] opacity-60">Período {index + 1}</div>
                          <div className="mt-0.5 font-semibold text-sm truncate">{getPeriodoLabel(c)}</div>
                          <div className="mt-1 text-xs font-medium opacity-80">{r ? toMoney(r.principal) : "R$ 0,00"}</div>
                        </div>
                        {c.laudoFavoravel
                          ? <CheckCircle2 className={`h-5 w-5 flex-shrink-0 ${ativo ? "text-emerald-400" : "text-emerald-500"}`} />
                          : <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${ativo ? "text-amber-400" : "text-amber-500"}`} />}
                      </button>
                    );
                  })}
                </div>

                {/* ── Editor do período selecionado ────────────────────────── */}
                {periodoSel && resultadoSel && (
                  <div className="space-y-5">
                    {/* Painel de métricas escuro */}
                    <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.22em] text-slate-300">Painel técnico do período</div>
                          <h3 className="mt-2 text-2xl font-semibold">{getPeriodoLabel(periodoSel)}</h3>
                          <p className="mt-1.5 text-sm text-slate-400">Preencha os dados econômicos, o enquadramento técnico e a prova pericial.</p>
                        </div>
                        <button onClick={() => removePeriodo(periodoSel.id)}
                          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">
                          Remover período
                        </button>
                      </div>
                      <div className="mt-5 grid gap-4 sm:grid-cols-3">
                        <InMetricDark title="Insalubridade" value={toMoney(resultadoSel.insalubridade)} subtitle="Apuração do período" />
                        <InMetricDark title="Periculosidade" value={toMoney(resultadoSel.periculosidade)} subtitle="Apuração do período" />
                        <InMetricDark title="Principal aplicado" value={toMoney(resultadoSel.principal)} subtitle={`Escolha automática: ${resultadoSel.tipoPrincipal}`} highlight />
                      </div>
                    </div>

                    {/* ── Dados econômicos + Prova técnica em grid 5 colunas ── */}
                    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="mb-4 text-xs font-bold uppercase tracking-[0.20em] text-slate-500">Dados econômicos e prova técnica</div>
                      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                        <InField label="Início">
                          <input type="date" className={inputCls} value={periodoSel.inicio} onChange={(e) => upd(periodoSel.id, "inicio", e.target.value)} />
                        </InField>
                        <InField label="Fim">
                          <input type="date" className={inputCls} value={periodoSel.fim} onChange={(e) => upd(periodoSel.id, "fim", e.target.value)} />
                        </InField>
                        <InField label="Salário-base">
                          <input type="number" className={inputCls} min={0} step="0.01" value={periodoSel.salarioBase} onChange={(e) => upd(periodoSel.id, "salarioBase", Number(e.target.value))} />
                        </InField>
                        <InField label="Salário mínimo">
                          <input type="number" className={inputCls} min={0} step="0.01" value={periodoSel.salarioMinimo} onChange={(e) => upd(periodoSel.id, "salarioMinimo", Number(e.target.value))} />
                        </InField>
                        <InField label="Tipo de exposição">
                          <select className={inputCls} value={periodoSel.tipoExposicao} onChange={(e) => upd(periodoSel.id, "tipoExposicao", e.target.value as TipoExposicao)}>
                            <option value="habitual">Habitual</option>
                            <option value="intermitente">Intermitente</option>
                            <option value="eventual">Eventual</option>
                          </select>
                        </InField>
                        <InField label="Laudo favorável">
                          <select className={inputCls} value={periodoSel.laudoFavoravel ? "sim" : "nao"} onChange={(e) => upd(periodoSel.id, "laudoFavoravel", e.target.value === "sim")}>
                            <option value="nao">Não</option>
                            <option value="sim">Sim</option>
                          </select>
                        </InField>
                        <InField label="Documentos técnicos">
                          <select className={inputCls} value={periodoSel.documentosTecnicos ? "sim" : "nao"} onChange={(e) => upd(periodoSel.id, "documentosTecnicos", e.target.value === "sim")}>
                            <option value="nao">Não</option>
                            <option value="sim">Sim</option>
                          </select>
                        </InField>
                        <InField label="EPI fornecido">
                          <select className={inputCls} value={periodoSel.epiFornecido ? "sim" : "nao"} onChange={(e) => upd(periodoSel.id, "epiFornecido", e.target.value === "sim")}>
                            <option value="nao">Não</option>
                            <option value="sim">Sim</option>
                          </select>
                        </InField>
                        <InField label="EPI eficaz">
                          <select className={inputCls} value={periodoSel.epiEficaz ? "sim" : "nao"} onChange={(e) => upd(periodoSel.id, "epiEficaz", e.target.value === "sim")}>
                            <option value="nao">Não</option>
                            <option value="sim">Sim</option>
                          </select>
                        </InField>
                      </div>
                    </div>

                    {/* ── Insalubridade e Periculosidade lado a lado ──────── */}
                    <div className="grid gap-5 lg:grid-cols-2">
                      <InPanelMini title="Insalubridade">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <InField label="Agente nocivo" colSpan="sm:col-span-2">
                            <input className={inputCls} value={periodoSel.agenteNocivo} onChange={(e) => upd(periodoSel.id, "agenteNocivo", e.target.value)} placeholder="Ruído, calor, agente biológico..." />
                          </InField>
                          <InField label="NR / Anexo" colSpan="sm:col-span-2">
                            <input list={`anexos-${periodoSel.id}`} className={inputCls} value={periodoSel.nrAnexo} onChange={(e) => upd(periodoSel.id, "nrAnexo", e.target.value)} />
                            <datalist id={`anexos-${periodoSel.id}`}>{anexosInsalubridade.map((a) => <option key={a} value={a} />)}</datalist>
                          </InField>
                          <InField label="Grau de insalubridade">
                            <select className={inputCls} value={periodoSel.grauInsalubridade} onChange={(e) => upd(periodoSel.id, "grauInsalubridade", e.target.value as GrauInsalubridade)}>
                              <option value="nenhum">Nenhum</option>
                              <option value="minimo">Mínimo (10%)</option>
                              <option value="medio">Médio (20%)</option>
                              <option value="maximo">Máximo (40%)</option>
                            </select>
                          </InField>
                          <InField label="Valor apurado"><div className={readOnlyBoxCls}>{toMoney(resultadoSel.insalubridade)}</div></InField>
                        </div>
                      </InPanelMini>

                      <InPanelMini title="Periculosidade">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <InField label="Há periculosidade?">
                            <select className={inputCls} value={periodoSel.haPericulosidade ? "sim" : "nao"} onChange={(e) => upd(periodoSel.id, "haPericulosidade", e.target.value === "sim")}>
                              <option value="nao">Não</option>
                              <option value="sim">Sim</option>
                            </select>
                          </InField>
                          <InField label="Tipo de risco">
                            <select className={inputCls} value={periodoSel.tipoPericulosidade} onChange={(e) => upd(periodoSel.id, "tipoPericulosidade", e.target.value as TipoRiscoPericulosidade)}>
                              <option value="">Selecione</option>
                              {riscosPericulosidade.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          </InField>
                          <InField label="Valor apurado" colSpan="sm:col-span-2">
                            <div className={readOnlyBoxCls}>{toMoney(resultadoSel.periculosidade)}</div>
                          </InField>
                          <div className="sm:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                            <strong>Vedação de cumulação (CF/88 art. 7º, XXIII):</strong> o sistema aplica automaticamente o adicional mais vantajoso ao trabalhador por período.
                          </div>
                        </div>
                      </InPanelMini>
                    </div>

                    {/* Observações */}
                    <InPanelMini title="Observações do período">
                      <textarea className={textareaCls} value={periodoSel.observacoes} onChange={(e) => upd(periodoSel.id, "observacoes", e.target.value)} placeholder="Descreva ambiente, fontes de prova, divergências, norma coletiva e observações periciais." />
                    </InPanelMini>
                  </div>
                )}
              </InPanel>
            )}

            {/* Reflexos */}
            {(abaAtiva === "visao-geral" || abaAtiva === "reflexos") && (
              <InPanel title="Reflexos trabalhistas" subtitle="Selecione as rubricas reflexas a projetar na estimativa do módulo." icon={<FileBarChart2 className="h-5 w-5" />}>
                <div className="grid gap-5 lg:grid-cols-[0.8fr_1fr]">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InToggleCard label="Horas extras" checked={reflexos.horasExtras} onChange={(v) => setReflexos((p) => ({ ...p, horasExtras: v }))} />
                    <InToggleCard label="Adicional noturno" checked={reflexos.adicionalNoturno} onChange={(v) => setReflexos((p) => ({ ...p, adicionalNoturno: v }))} />
                    <InToggleCard label="Aviso prévio" checked={reflexos.avisoPrevio} onChange={(v) => setReflexos((p) => ({ ...p, avisoPrevio: v }))} />
                    <InToggleCard label="13º salário" checked={reflexos.decimoTerceiro} onChange={(v) => setReflexos((p) => ({ ...p, decimoTerceiro: v }))} />
                    <InToggleCard label="Férias + 1/3" checked={reflexos.feriasTerco} onChange={(v) => setReflexos((p) => ({ ...p, feriasTerco: v }))} />
                    <InToggleCard label="FGTS" checked={reflexos.fgts} onChange={(v) => setReflexos((p) => ({ ...p, fgts: v }))} />
                    <InToggleCard label="Multa de 40% do FGTS" checked={reflexos.multaFgts40} onChange={(v) => setReflexos((p) => ({ ...p, multaFgts40: v }))} />
                  </div>
                  <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-100 text-left text-slate-700">
                        <tr>
                          <th className="px-5 py-4 font-semibold">Rubrica</th>
                          <th className="px-5 py-4 font-semibold">Valor estimado</th>
                        </tr>
                      </thead>
                      <tbody>
                        <InRow label="Horas extras" value={reflexosCalc.horasExtras} />
                        <InRow label="Adicional noturno" value={reflexosCalc.adicionalNoturno} />
                        <InRow label="Aviso prévio" value={reflexosCalc.avisoPrevio} />
                        <InRow label="13º salário" value={reflexosCalc.decimoTerceiro} />
                        <InRow label="Férias + 1/3" value={reflexosCalc.feriasTerco} />
                        <InRow label="FGTS" value={reflexosCalc.fgts} />
                        <InRow label="Multa 40% FGTS" value={reflexosCalc.multaFgts40} />
                        <tr className="border-t border-slate-200 bg-slate-950 text-white">
                          <td className="px-5 py-4 font-semibold">Total dos reflexos</td>
                          <td className="px-5 py-4 font-semibold">{toMoney(reflexosCalc.total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </InPanel>
            )}

            {/* Consolidação */}
            {(abaAtiva === "visao-geral" || abaAtiva === "consolidacao") && (
              <InPanel title="Consolidação geral" subtitle="Síntese executiva do principal, reflexos e total global da apuração." icon={<Gavel className="h-5 w-5" />}>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  <InExecutiveCard title="Subtotal insalubridade" value={toMoney(totalInsalubridade)} subtitle="Todos os períodos" icon={<TriangleAlert className="h-5 w-5" />} />
                  <InExecutiveCard title="Subtotal periculosidade" value={toMoney(totalPericulosidade)} subtitle="Todos os períodos" icon={<ShieldCheck className="h-5 w-5" />} />
                  <InExecutiveCard title="Principal aplicado" value={toMoney(principalTotal)} subtitle="Mais vantajoso por período" icon={<Scale className="h-5 w-5" />} highlight />
                  <InExecutiveCard title="Reflexos" value={toMoney(reflexosCalc.total)} subtitle="Rubricas selecionadas" icon={<FileBarChart2 className="h-5 w-5" />} />
                  <InExecutiveCard title="Total geral" value={toMoney(totalGeral)} subtitle="Principal + reflexos" icon={<Sparkles className="h-5 w-5" />} highlight />
                </div>
                <div className="mt-6 overflow-x-auto rounded-[26px] border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100 text-left text-slate-700">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Período</th>
                        <th className="px-6 py-4 font-semibold whitespace-nowrap">Insalubridade</th>
                        <th className="px-6 py-4 font-semibold whitespace-nowrap">Periculosidade</th>
                        <th className="px-6 py-4 font-semibold whitespace-nowrap">Escolha automática</th>
                        <th className="px-6 py-4 font-semibold whitespace-nowrap">Valor aplicado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultados.map((item) => (
                        <tr key={item.id} className="border-t border-slate-200 hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-slate-700">{item.periodo}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{toMoney(item.insalubridade)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{toMoney(item.periculosidade)}</td>
                          <td className="px-6 py-4 capitalize">{item.tipoPrincipal}</td>
                          <td className="px-6 py-4 font-bold text-slate-900 whitespace-nowrap">{toMoney(item.principal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </InPanel>
            )}

            {/* ── Atualização monetária ───────────────────────────────────── */}
            {abaAtiva === "atualizacao" && (
              <InPanel
                icon={<TrendingUp className="h-5 w-5" />}
                title="Atualização Monetária — EC 113/2021"
                subtitle="IPCA-E (vencimento → ajuizamento) · SELIC (ajuizamento → liquidação)"
              >
                <CorrecaoTrabalhistaUI verbas={verbasInsalubridade} labelVerbas="competência" />
              </InPanel>
            )}

          </section>

          {/* Sidebar */}
          <aside className="space-y-6">
            <InSidePanel title="Inteligência normativa" icon={<Sparkles className="h-5 w-5" />}>
              <div className="space-y-3">
                {normasBase.map((item) => (
                  <div key={item.sigla + item.texto} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{item.sigla}</div>
                    <div className="mt-1 text-sm font-medium text-slate-800">{item.texto}</div>
                  </div>
                ))}
              </div>
            </InSidePanel>

            <InSidePanel title="Alertas do período selecionado" icon={<AlertTriangle className="h-5 w-5" />}>
              <div className="space-y-3">
                {periodoSel && getAlertas(periodoSel).map((item, index) => (
                  <div key={index} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{item}</div>
                ))}
              </div>
            </InSidePanel>

            <InSidePanel title="Rodapé técnico" icon={<FileBarChart2 className="h-5 w-5" />}>
              <div className="space-y-3">
                <InInfoLine label="Processo" value={processo || "Não informado"} />
                <InInfoLine label="Data-base" value={dataBase || "Não informada"} />
                <InInfoLine label="Perito" value={perito || "Não informado"} />
                <InInfoLine label="Versão" value="Veritas Trabalhista · Insalubridade v1" />
                <div className="rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  Módulo de apuração de adicionais. Pode ser conectado futuramente ao motor mensal do Veritas, ao laudo institucional e à camada de persistência.
                </div>
              </div>
            </InSidePanel>
          </aside>
        </main>
      </div>
    </div>
  );
}
