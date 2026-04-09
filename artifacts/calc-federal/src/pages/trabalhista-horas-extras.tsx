import React, { useMemo, useState } from "react";
import {
  AlertTriangle, BarChart3, Briefcase, Building2, CalendarDays, CheckCircle2,
  Clock3, Coins, FileBarChart2, FileText, Gavel, Landmark,
  MoonStar, Percent, Scale, ShieldCheck, Sparkles, TimerReset,
  TriangleAlert, Wallet, Calculator, TrendingUp,
} from "lucide-react";
import CorrecaoTrabalhistaUI from "@/components/correcao-trabalhista-ui";

// ─── Types ────────────────────────────────────────────────────────────────────

type AbaHE =
  | "visao-geral"
  | "identificacao"
  | "parametros"
  | "apuracao"
  | "reflexos"
  | "consolidacao"
  | "atualizacao";

interface ReflexosHE {
  dsr: boolean;
  ferias: boolean;
  decimoTerceiro: boolean;
  fgts: boolean;
  multaFgts40: boolean;
}

const reflexosDefault: ReflexosHE = {
  dsr: true,
  ferias: true,
  decimoTerceiro: true,
  fgts: true,
  multaFgts40: false,
};

// ─── Utils ────────────────────────────────────────────────────────────────────

function round2(v: number) { return Math.round(v * 100) / 100; }

function toMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pct(v: number) { return `${v.toFixed(2).replace(".", ",")}%`; }

// ─── Sub-components ──────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white";

const readOnlyBoxCls =
  "w-full rounded-2xl border border-slate-200 bg-slate-100 px-3.5 py-3 text-sm font-bold text-slate-900";

const textareaCls =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white min-h-[96px] resize-none";

function HEField({ label, children, colSpan = "" }: { label: string; children: React.ReactNode; colSpan?: string }) {
  return (
    <label className={`block ${colSpan}`}>
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function HEPanel({ title, subtitle, icon, action, children }: {
  title: string; subtitle?: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-lg shadow-slate-200/40 backdrop-blur">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon && <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">{icon}</div>}
          <div>
            <h3 className="font-semibold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function HEPanelMini({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 text-xs font-bold uppercase tracking-[0.20em] text-slate-500">{title}</div>
      {children}
    </div>
  );
}

function HESidePanel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white">{icon}</div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function HEMetricDark({ title, value, subtitle, highlight = false }: { title: string; value: string; subtitle?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[20px] p-4 ${highlight ? "bg-amber-500/20 border border-amber-400/40" : "border border-white/10 bg-white/5"}`}>
      <div className="text-xs uppercase tracking-[0.20em] text-slate-300">{title}</div>
      <div className={`mt-2 text-2xl font-bold ${highlight ? "text-amber-300" : "text-white"}`}>{value}</div>
      {subtitle && <div className="mt-1 text-xs text-slate-400 capitalize">{subtitle}</div>}
    </div>
  );
}

function HEExecutiveCard({ title, value, subtitle, icon, highlight = false }: {
  title: string; value: string; subtitle: string; icon: React.ReactNode; highlight?: boolean;
}) {
  return (
    <div className={`rounded-[26px] border p-5 shadow-sm ${highlight ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white" : "border-slate-200 bg-white"}`}>
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${highlight ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-white"}`}>{icon}</div>
      <div className="mt-4 text-sm font-medium text-slate-600">{title}</div>
      <div className="mt-1 text-xl font-bold text-slate-950 whitespace-nowrap">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
    </div>
  );
}

function HEToggleCard({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 rounded-2xl border p-4 text-left text-sm font-medium transition ${checked ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-white"}`}>
      <span className={`h-4 w-4 flex-shrink-0 rounded-full border-2 transition ${checked ? "border-amber-500 bg-amber-500" : "border-slate-300"}`} />
      {label}
    </button>
  );
}

function ResultGradient({ title, value, grad }: { title: string; value: number; grad: string }) {
  return (
    <div className={`rounded-[22px] bg-gradient-to-br ${grad} p-5 text-white shadow-lg`}>
      <div className="text-sm font-medium text-white/85">{title}</div>
      <div className="mt-3 text-2xl font-bold whitespace-nowrap">{toMoney(value)}</div>
      <div className="mt-2 text-xs uppercase tracking-[0.18em] text-white/70">Verba principal</div>
    </div>
  );
}

// ─── Normativa sidebar data ───────────────────────────────────────────────────

const normasHE = [
  { sigla: "CF/88", texto: "Art. 7º, XIII — jornada de 8h diárias / 44h semanais" },
  { sigla: "CLT", texto: "Art. 58 e 59 — hora extra e regime de prorrogação" },
  { sigla: "CLT", texto: "Art. 73 — adicional noturno mínimo 20%" },
  { sigla: "Súm. 340 TST", texto: "Horas extras com salário variável: aplicação proporcional" },
  { sigla: "OJ SDI-1 nº 97", texto: "DSR: repercussão de adicional noturno e horas extras" },
  { sigla: "Súm. 347 TST", texto: "FGTS: incidência sobre horas extras e DSR" },
  { sigla: "NR-17", texto: "Ergonomia: jornada e pausas em atividades de risco" },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function HorasExtras({
  processo: processoProp = "",
  vara: varaProp = "",
  reclamante: reclamanteProp = "",
  reclamada: reclamadaProp = "",
  cargo: cargoProp = "",
}: {
  processo?: string;
  vara?: string;
  reclamante?: string;
  reclamada?: string;
  cargo?: string;
}) {
  const [abaAtiva, setAbaAtiva] = useState<AbaHE>("visao-geral");

  // Identificação
  const [empresa, setEmpresa] = useState(reclamadaProp || "EMPRESA EXEMPLO LTDA.");
  const [reclamante, setReclamante] = useState(reclamanteProp || "NOME DO TRABALHADOR");
  const [cargo, setCargo] = useState(cargoProp || "Função/Cargo");
  const [processo, setProcesso] = useState(processoProp || "0000000-00.2026.5.00.0000");
  const [vara, setVara] = useState(varaProp || "Vara do Trabalho");
  const [perito, setPerito] = useState("Dr. Vasconcelos Reis Wakim");
  const [dataBase, setDataBase] = useState(new Date().toISOString().slice(0, 10));
  const [dataAdmissao, setDataAdmissao] = useState("2020-01-01");
  const [dataDemissao, setDataDemissao] = useState("2026-01-01");
  const [observacoes, setObservacoes] = useState("Apuração de horas extras no padrão pericial Veritas Analytics.");

  // Parâmetros
  const [salarioBase, setSalarioBase] = useState(4850);
  const [divisor, setDivisor] = useState(220);
  const [adicionalNoturno, setAdicionalNoturno] = useState(20);
  const [dsrPercentual, setDsrPercentual] = useState(16.67);

  // Apuração de horas
  const [horas50, setHoras50] = useState(28);
  const [horas100, setHoras100] = useState(9);
  const [horasNoturnas, setHorasNoturnas] = useState(6);

  // Reflexos toggles
  const [reflexos, setReflexos] = useState<ReflexosHE>(reflexosDefault);

  // ── Cálculos ──────────────────────────────────────────────────────────────

  const valorHora = useMemo(() => round2(salarioBase / divisor), [salarioBase, divisor]);

  const extra50 = useMemo(() => round2(valorHora * horas50 * 1.5), [valorHora, horas50]);
  const extra100 = useMemo(() => round2(valorHora * horas100 * 2), [valorHora, horas100]);
  const extraNoturna = useMemo(() => {
    const fator = 1.5 * (1 + adicionalNoturno / 100);
    return round2(valorHora * horasNoturnas * fator);
  }, [valorHora, horasNoturnas, adicionalNoturno]);

  const subtotalExtras = useMemo(() => round2(extra50 + extra100 + extraNoturna), [extra50, extra100, extraNoturna]);

  const dsr = useMemo(() => reflexos.dsr ? round2(subtotalExtras * (dsrPercentual / 100)) : 0, [subtotalExtras, dsrPercentual, reflexos.dsr]);
  const ferias = useMemo(() => reflexos.ferias ? round2((subtotalExtras + dsr) / 12 * (4 / 3)) : 0, [subtotalExtras, dsr, reflexos.ferias]);
  const decimoTerceiro = useMemo(() => reflexos.decimoTerceiro ? round2((subtotalExtras + dsr) / 12) : 0, [subtotalExtras, dsr, reflexos.decimoTerceiro]);
  const fgts = useMemo(() => reflexos.fgts ? round2((subtotalExtras + dsr + ferias + decimoTerceiro) * 0.08) : 0, [subtotalExtras, dsr, ferias, decimoTerceiro, reflexos.fgts]);
  const multaFgts = useMemo(() => reflexos.multaFgts40 ? round2(fgts * 0.4) : 0, [fgts, reflexos.multaFgts40]);

  const totalReflexos = useMemo(() => round2(dsr + ferias + decimoTerceiro + fgts + multaFgts), [dsr, ferias, decimoTerceiro, fgts, multaFgts]);
  const totalGeral = useMemo(() => round2(subtotalExtras + totalReflexos), [subtotalExtras, totalReflexos]);

  const ABAS: { id: AbaHE; label: string }[] = [
    { id: "visao-geral", label: "Visão Geral" },
    { id: "identificacao", label: "Identificação" },
    { id: "parametros", label: "Parâmetros" },
    { id: "apuracao", label: "Apuração" },
    { id: "reflexos", label: "Reflexos" },
    { id: "consolidacao", label: "Consolidação" },
    { id: "atualizacao", label: "Atualização" },
  ];

  const fullWidth = abaAtiva === "apuracao" || abaAtiva === "consolidacao" || abaAtiva === "atualizacao";

  const verbasHE = useMemo(() => {
    const comp = dataAdmissao.slice(0, 7);
    const venc = dataDemissao;
    return [
      { id: "he50", descricao: "Horas extras 50%", valorNominal: extra50, competencia: comp, dataVencimento: venc },
      { id: "he100", descricao: "Horas extras 100%", valorNominal: extra100, competencia: comp, dataVencimento: venc },
      { id: "noturna", descricao: "Adicional noturno", valorNominal: extraNoturna, competencia: comp, dataVencimento: venc },
      { id: "dsr", descricao: "DSR sobre HE", valorNominal: dsr, competencia: comp, dataVencimento: venc },
      { id: "ferias", descricao: "Férias + 1/3", valorNominal: ferias, competencia: comp, dataVencimento: venc },
      { id: "dt", descricao: "13º salário", valorNominal: decimoTerceiro, competencia: comp, dataVencimento: venc },
      { id: "fgts", descricao: "FGTS (8%)", valorNominal: fgts, competencia: comp, dataVencimento: venc },
      { id: "multa", descricao: "Multa 40% FGTS", valorNominal: multaFgts, competencia: comp, dataVencimento: venc },
    ].filter((v) => v.valorNominal > 0);
  }, [extra50, extra100, extraNoturna, dsr, ferias, decimoTerceiro, fgts, multaFgts, dataAdmissao, dataDemissao]);

  return (
    <div className="bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.10),_transparent_24%),linear-gradient(180deg,#071120_0%,#0b1730_18%,#edf2f7_18%,#eef2f7_100%)] text-slate-900 rounded-2xl overflow-hidden">
      <div className="mx-auto max-w-[1600px] px-4 pb-10 pt-5 md:px-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="overflow-hidden rounded-[30px] border border-white/10 bg-slate-950 text-white shadow-2xl shadow-slate-950/30">
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.16),_transparent_28%),radial-gradient(circle_at_left,_rgba(59,130,246,0.16),_transparent_30%)]" />
            <div className="relative z-10 grid gap-6 p-6 md:grid-cols-[1.4fr_0.9fr] md:p-8">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-300">
                  <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-amber-200">Veritas Analytics</span>
                  <span>Módulo Trabalhista</span>
                  <span>•</span>
                  <span>Horas Extras &amp; Reflexos</span>
                </div>
                <div className="mt-5 flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/25">
                    <Clock3 className="h-7 w-7" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold md:text-3xl">Jornada, Horas Extras &amp; Reflexos</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                      Apuração técnico-jurídica por faixas (50%, 100% e noturna), DSR, reflexos rescisórios e encargos, com conformidade ao PJe-Calc e parâmetros jurídicos configuráveis.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-between gap-6">
                <div className="grid grid-cols-2 gap-3">
                  <HEMetricDark title="Horas extras" value={toMoney(subtotalExtras)} subtitle="Subtotal faixas" />
                  <HEMetricDark title="Total geral" value={toMoney(totalGeral)} subtitle="Com reflexos" highlight />
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    <div>
                      <div className="text-slate-400">50%</div>
                      <div className="mt-1 font-bold text-white">{horas50}h</div>
                      <div className="text-[10px] text-slate-500">{toMoney(extra50)}</div>
                    </div>
                    <div className="border-x border-white/10">
                      <div className="text-slate-400">100%</div>
                      <div className="mt-1 font-bold text-white">{horas100}h</div>
                      <div className="text-[10px] text-slate-500">{toMoney(extra100)}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Noturna</div>
                      <div className="mt-1 font-bold text-white">{horasNoturnas}h</div>
                      <div className="text-[10px] text-slate-500">{toMoney(extraNoturna)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ── Tabs nav ────────────────────────────────────────────────────── */}
        <nav className="mt-4 overflow-x-auto">
          <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
            {ABAS.map((aba) => (
              <button key={aba.id} onClick={() => setAbaAtiva(aba.id)}
                className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${abaAtiva === aba.id ? "bg-slate-950 text-white shadow" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}>
                {aba.label}
              </button>
            ))}
          </div>
        </nav>

        {/* ── Main + Sidebar ──────────────────────────────────────────────── */}
        <main className={`mt-6 grid gap-6 ${fullWidth ? "grid-cols-1" : "xl:grid-cols-[1.5fr_0.55fr]"}`}>
          <section className="space-y-6">

            {/* ── Visão geral — KPI cards ─────────────────────────────── */}
            {(abaAtiva === "visao-geral" || abaAtiva === "consolidacao") && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <HEExecutiveCard title="Valor hora-base" value={toMoney(valorHora)} subtitle={`Divisor ${divisor}`} icon={<Clock3 className="h-5 w-5" />} />
                <HEExecutiveCard title="Subtotal horas extras" value={toMoney(subtotalExtras)} subtitle="50%, 100% e noturna" icon={<Coins className="h-5 w-5" />} />
                <HEExecutiveCard title="Reflexos calculados" value={toMoney(totalReflexos)} subtitle="DSR, férias, 13º, FGTS" icon={<Wallet className="h-5 w-5" />} highlight />
                <HEExecutiveCard title="Total geral" value={toMoney(totalGeral)} subtitle="Principal + reflexos" icon={<Sparkles className="h-5 w-5" />} highlight />
              </div>
            )}

            {/* ── Identificação ─────────────────────────────────────── */}
            {(abaAtiva === "visao-geral" || abaAtiva === "identificacao") && (
              <HEPanel title="Identificação do caso" subtitle="Dados centrais da apuração judicial, pericial e operacional." icon={<Briefcase className="h-5 w-5" />}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <HEField label="Empresa / Reclamada"><input className={inputCls} value={empresa} onChange={e => setEmpresa(e.target.value)} /></HEField>
                  <HEField label="Reclamante"><input className={inputCls} value={reclamante} onChange={e => setReclamante(e.target.value)} /></HEField>
                  <HEField label="Cargo / Função"><input className={inputCls} value={cargo} onChange={e => setCargo(e.target.value)} /></HEField>
                  <HEField label="Processo"><input className={inputCls} value={processo} onChange={e => setProcesso(e.target.value)} /></HEField>
                  <HEField label="Vara"><input className={inputCls} value={vara} onChange={e => setVara(e.target.value)} /></HEField>
                  <HEField label="Perito responsável"><input className={inputCls} value={perito} onChange={e => setPerito(e.target.value)} /></HEField>
                  <HEField label="Admissão"><input type="date" className={inputCls} value={dataAdmissao} onChange={e => setDataAdmissao(e.target.value)} /></HEField>
                  <HEField label="Demissão / Rescisão"><input type="date" className={inputCls} value={dataDemissao} onChange={e => setDataDemissao(e.target.value)} /></HEField>
                  <HEField label="Data-base"><input type="date" className={inputCls} value={dataBase} onChange={e => setDataBase(e.target.value)} /></HEField>
                  <HEField label="Observações gerais" colSpan="md:col-span-2 xl:col-span-3">
                    <textarea className={textareaCls} value={observacoes} onChange={e => setObservacoes(e.target.value)} />
                  </HEField>
                </div>
              </HEPanel>
            )}

            {/* ── Parâmetros jurídicos ──────────────────────────────── */}
            {(abaAtiva === "visao-geral" || abaAtiva === "parametros") && (
              <HEPanel title="Parâmetros jurídicos" subtitle="Base salarial, divisor legal, adicional noturno e DSR." icon={<Scale className="h-5 w-5" />}>
                <div className="grid gap-5 lg:grid-cols-2">
                  <HEPanelMini title="Base contratual">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <HEField label="Salário-base (R$)">
                        <input type="number" className={inputCls} min={0} step="0.01" value={salarioBase} onChange={e => setSalarioBase(Number(e.target.value))} />
                      </HEField>
                      <HEField label="Divisor legal">
                        <select className={inputCls} value={divisor} onChange={e => setDivisor(Number(e.target.value))}>
                          <option value={220}>220 — mensalista</option>
                          <option value={200}>200 — mensalista (acordo)</option>
                          <option value={180}>180 — 30h/semana</option>
                          <option value={150}>150 — 25h/semana</option>
                          <option value={176}>176 — horista típico</option>
                        </select>
                      </HEField>
                      <HEField label="Valor hora-base" colSpan="sm:col-span-2">
                        <div className={readOnlyBoxCls}>{toMoney(valorHora)}</div>
                      </HEField>
                    </div>
                  </HEPanelMini>

                  <HEPanelMini title="Adicionais e DSR">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <HEField label="Adicional noturno (%)">
                        <input type="number" className={inputCls} min={0} max={100} step="1" value={adicionalNoturno} onChange={e => setAdicionalNoturno(Number(e.target.value))} />
                      </HEField>
                      <HEField label="DSR sobre extras (%)">
                        <input type="number" className={inputCls} min={0} max={50} step="0.01" value={dsrPercentual} onChange={e => setDsrPercentual(Number(e.target.value))} />
                      </HEField>
                      <div className="sm:col-span-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
                        <strong>DSR padrão:</strong> Súmula 172 TST — 16,67% para jornada de 6 dias/semana. Ajuste conforme a jornada da categoria.
                      </div>
                    </div>
                  </HEPanelMini>
                </div>
              </HEPanel>
            )}

            {/* ── Apuração de horas extras ──────────────────────────── */}
            {(abaAtiva === "visao-geral" || abaAtiva === "apuracao") && (
              <HEPanel title="Apuração de horas extras" subtitle="Informe as horas extras por faixa; o cálculo é automático com base no salário-hora parametrizado." icon={<Calculator className="h-5 w-5" />}>

                {/* Painel escuro de totais */}
                <div className="rounded-[26px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl mb-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-300 mb-4">Resumo de apuração</div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <HEMetricDark title="Horas Extras 50%" value={toMoney(extra50)} subtitle={`${horas50}h × ${toMoney(valorHora)} × 1,5`} />
                    <HEMetricDark title="Horas Extras 100%" value={toMoney(extra100)} subtitle={`${horas100}h × ${toMoney(valorHora)} × 2,0`} />
                    <HEMetricDark title="Horas Extras Noturnas" value={toMoney(extraNoturna)} subtitle={`${horasNoturnas}h × fator noturno`} highlight />
                  </div>
                </div>

                {/* Campos por faixa */}
                <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 text-xs font-bold uppercase tracking-[0.20em] text-slate-500">Horas por faixa</div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <HEField label="Horas extras 50%">
                      <input type="number" className={inputCls} min={0} step="0.5" value={horas50} onChange={e => setHoras50(Number(e.target.value))} />
                    </HEField>
                    <HEField label="Valor 50%">
                      <div className={readOnlyBoxCls}>{toMoney(extra50)}</div>
                    </HEField>
                    <HEField label="Horas extras 100%">
                      <input type="number" className={inputCls} min={0} step="0.5" value={horas100} onChange={e => setHoras100(Number(e.target.value))} />
                    </HEField>
                    <HEField label="Valor 100%">
                      <div className={readOnlyBoxCls}>{toMoney(extra100)}</div>
                    </HEField>
                    <HEField label="Horas noturnas">
                      <input type="number" className={inputCls} min={0} step="0.5" value={horasNoturnas} onChange={e => setHorasNoturnas(Number(e.target.value))} />
                    </HEField>
                    <HEField label="Valor noturna">
                      <div className={readOnlyBoxCls}>{toMoney(extraNoturna)}</div>
                    </HEField>
                    <HEField label="Subtotal extras" colSpan="sm:col-span-2">
                      <div className={`${readOnlyBoxCls} border-amber-300 bg-amber-50 text-amber-900`}>{toMoney(subtotalExtras)}</div>
                    </HEField>
                  </div>
                </div>

                {/* Cards coloridos */}
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <ResultGradient title="Horas Extras 50%" value={extra50} grad="from-blue-600 to-cyan-500 shadow-blue-200/70" />
                  <ResultGradient title="Horas Extras 100%" value={extra100} grad="from-indigo-600 to-blue-500 shadow-indigo-200/70" />
                  <ResultGradient title="Horas Extras Noturnas" value={extraNoturna} grad="from-violet-600 to-fuchsia-500 shadow-violet-200/70" />
                </div>
              </HEPanel>
            )}

            {/* ── Reflexos ──────────────────────────────────────────── */}
            {(abaAtiva === "visao-geral" || abaAtiva === "reflexos") && (
              <HEPanel title="Reflexos trabalhistas" subtitle="Selecione as rubricas reflexas a projetar sobre as horas extras apuradas." icon={<Landmark className="h-5 w-5" />}>
                <div className="grid gap-5 lg:grid-cols-[0.8fr_1fr]">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <HEToggleCard label="DSR sobre HE" checked={reflexos.dsr} onChange={v => setReflexos(p => ({ ...p, dsr: v }))} />
                    <HEToggleCard label="Férias + 1/3" checked={reflexos.ferias} onChange={v => setReflexos(p => ({ ...p, ferias: v }))} />
                    <HEToggleCard label="13º salário" checked={reflexos.decimoTerceiro} onChange={v => setReflexos(p => ({ ...p, decimoTerceiro: v }))} />
                    <HEToggleCard label="FGTS (8%)" checked={reflexos.fgts} onChange={v => setReflexos(p => ({ ...p, fgts: v }))} />
                    <HEToggleCard label="Multa 40% FGTS" checked={reflexos.multaFgts40} onChange={v => setReflexos(p => ({ ...p, multaFgts40: v }))} />
                  </div>
                  <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-100 text-left text-slate-700">
                        <tr>
                          <th className="px-5 py-4 font-semibold">Rubrica</th>
                          <th className="px-5 py-4 font-semibold">Base</th>
                          <th className="px-5 py-4 font-semibold whitespace-nowrap">Valor estimado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: "DSR sobre Horas Extras", base: `${pct(dsrPercentual)} do subtotal`, value: dsr },
                          { label: "Férias + 1/3", base: "(subtotal+DSR)/12 × 4/3", value: ferias },
                          { label: "13º Salário", base: "(subtotal+DSR)/12", value: decimoTerceiro },
                          { label: "FGTS", base: "8% sobre verbas", value: fgts },
                          { label: "Multa 40% FGTS", base: "40% do FGTS", value: multaFgts },
                        ].map(item => (
                          <tr key={item.label} className="border-t border-slate-200">
                            <td className="px-5 py-4 text-slate-700">{item.label}</td>
                            <td className="px-5 py-4 text-slate-500 text-xs">{item.base}</td>
                            <td className="px-5 py-4 font-semibold whitespace-nowrap text-slate-900">{toMoney(item.value)}</td>
                          </tr>
                        ))}
                        <tr className="border-t border-slate-200 bg-slate-950 text-white">
                          <td className="px-5 py-4 font-semibold" colSpan={2}>Total dos reflexos</td>
                          <td className="px-5 py-4 font-bold whitespace-nowrap">{toMoney(totalReflexos)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </HEPanel>
            )}

            {/* ── Consolidação ──────────────────────────────────────── */}
            {(abaAtiva === "visao-geral" || abaAtiva === "consolidacao") && (
              <HEPanel title="Consolidação geral" subtitle="Síntese executiva do principal, reflexos e total global da apuração." icon={<Gavel className="h-5 w-5" />}>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <HEExecutiveCard title="Extras 50%" value={toMoney(extra50)} subtitle={`${horas50} horas`} icon={<Clock3 className="h-5 w-5" />} />
                  <HEExecutiveCard title="Extras 100%" value={toMoney(extra100)} subtitle={`${horas100} horas`} icon={<TimerReset className="h-5 w-5" />} />
                  <HEExecutiveCard title="Extras noturnas" value={toMoney(extraNoturna)} subtitle={`${horasNoturnas} horas`} icon={<MoonStar className="h-5 w-5" />} />
                  <HEExecutiveCard title="Subtotal extras" value={toMoney(subtotalExtras)} subtitle="Faixas consolidadas" icon={<Coins className="h-5 w-5" />} highlight />
                  <HEExecutiveCard title="DSR" value={toMoney(dsr)} subtitle={pct(dsrPercentual)} icon={<CalendarDays className="h-5 w-5" />} />
                  <HEExecutiveCard title="Férias + 1/3" value={toMoney(ferias)} subtitle="Média anual" icon={<Landmark className="h-5 w-5" />} />
                  <HEExecutiveCard title="13º Salário" value={toMoney(decimoTerceiro)} subtitle="Média anual" icon={<Wallet className="h-5 w-5" />} />
                  <HEExecutiveCard title="FGTS + Multa" value={toMoney(fgts + multaFgts)} subtitle="Encargos" icon={<ShieldCheck className="h-5 w-5" />} />
                </div>

                {/* Total banner */}
                <div className="mt-5 rounded-[22px] bg-gradient-to-r from-slate-950 to-slate-800 p-6 text-white flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-300">Total geral estimado</div>
                    <div className="mt-2 text-4xl font-bold">{toMoney(totalGeral)}</div>
                    <div className="mt-1 text-sm text-slate-400">Principal + reflexos selecionados</div>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-center">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Reflexos</div>
                    <div className="mt-1 text-2xl font-semibold text-amber-300">{toMoney(totalReflexos)}</div>
                  </div>
                </div>

                {/* Memória de cálculo */}
                <div className="mt-5 overflow-x-auto rounded-[26px] border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100 text-left text-slate-700">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Rubrica</th>
                        <th className="px-6 py-4 font-semibold whitespace-nowrap">Memória</th>
                        <th className="px-6 py-4 font-semibold whitespace-nowrap">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Valor hora-base", mem: `R$ ${salarioBase.toLocaleString("pt-BR")} ÷ ${divisor}`, value: valorHora },
                        { label: `Extras 50% (${horas50}h)`, mem: `${horas50}h × ${toMoney(valorHora)} × 1,50`, value: extra50 },
                        { label: `Extras 100% (${horas100}h)`, mem: `${horas100}h × ${toMoney(valorHora)} × 2,00`, value: extra100 },
                        { label: `Extras noturnas (${horasNoturnas}h)`, mem: `${horasNoturnas}h × ${toMoney(valorHora)} × 1,50 × (1+${pct(adicionalNoturno)})`, value: extraNoturna },
                        { label: "Subtotal extras", mem: "Soma das faixas", value: subtotalExtras },
                        { label: `DSR (${pct(dsrPercentual)})`, mem: `${toMoney(subtotalExtras)} × ${pct(dsrPercentual)}`, value: dsr },
                        { label: "Férias + 1/3", mem: "(subtotal+DSR)/12 × 4/3", value: ferias },
                        { label: "13º salário", mem: "(subtotal+DSR)/12", value: decimoTerceiro },
                        { label: "FGTS (8%)", mem: "8% sobre verbas", value: fgts },
                        { label: "Multa 40% FGTS", mem: "40% do FGTS", value: multaFgts },
                      ].map(item => (
                        <tr key={item.label} className="border-t border-slate-200 hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900">{item.label}</td>
                          <td className="px-6 py-4 text-slate-500 text-xs">{item.mem}</td>
                          <td className="px-6 py-4 font-bold whitespace-nowrap text-slate-900">{toMoney(item.value)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-300 bg-slate-950 text-white">
                        <td className="px-6 py-4 font-bold" colSpan={2}>Total geral</td>
                        <td className="px-6 py-4 font-bold whitespace-nowrap text-amber-300">{toMoney(totalGeral)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </HEPanel>
            )}

            {/* ── Atualização monetária ───────────────────────────────── */}
            {abaAtiva === "atualizacao" && (
              <HEPanel
                icon={<TrendingUp className="h-5 w-5" />}
                title="Atualização Monetária — EC 113/2021"
                subtitle="IPCA-E (vencimento → ajuizamento) · SELIC (ajuizamento → liquidação)"
              >
                <CorrecaoTrabalhistaUI verbas={verbasHE} labelVerbas="verba" />
              </HEPanel>
            )}

          </section>

          {/* ── Sidebar ──────────────────────────────────────────────── */}
          {!fullWidth && (
            <aside className="space-y-6">
              <HESidePanel title="Base normativa" icon={<Sparkles className="h-5 w-5" />}>
                <div className="space-y-3">
                  {normasHE.map(n => (
                    <div key={n.sigla + n.texto} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{n.sigla}</div>
                      <div className="mt-1 text-sm font-medium text-slate-800">{n.texto}</div>
                    </div>
                  ))}
                </div>
              </HESidePanel>

              <HESidePanel title="Checklist jurídico" icon={<CheckCircle2 className="h-5 w-5" />}>
                <div className="space-y-2">
                  {[
                    "CLT arts. 58 e 59 parametrizados",
                    "Faixas 50%, 100% e noturna separadas",
                    "Adicional noturno configurável",
                    "DSR ajustado à jornada da categoria",
                    "Reflexos e encargos em camadas independentes",
                    "Memória de cálculo disponível na consolidação",
                  ].map(item => (
                    <div key={item} className="flex items-start gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-xs text-emerald-900">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </HESidePanel>

              <HESidePanel title="Informações do rodapé" icon={<FileBarChart2 className="h-5 w-5" />}>
                <div className="space-y-2 text-xs">
                  {[
                    ["Processo", processo || "Não informado"],
                    ["Perito", perito || "Não informado"],
                    ["Data-base", dataBase || "Não informada"],
                    ["Versão", "Veritas Trabalhista · HE v1"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                      <span className="text-slate-500">{label}</span>
                      <span className="text-right font-medium text-slate-800">{value}</span>
                    </div>
                  ))}
                </div>
              </HESidePanel>
            </aside>
          )}
        </main>
      </div>
    </div>
  );
}
