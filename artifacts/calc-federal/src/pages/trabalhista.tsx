import React, { useMemo, useState, useCallback, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useDebitCredits } from "@/hooks/use-wallet";
import { useTaxTables } from "@/hooks/use-tax-tables";
import { useSubscription } from "@/hooks/use-subscription";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { hasAccess, PLAN_LABEL, PLAN_MIN } from "@/lib/plan-access";
import { buildVeritasReport } from "@/components/reports/VeritasReportLayout";
import veritasLogoUrl from "@assets/veritas_analytics_1775154424712.png";
import InsalubridadePericulosidade from "@/pages/trabalhista-insalubridade";
import HorasExtras from "@/pages/trabalhista-horas-extras";
import {
  Calculator, FileText, Scale, Briefcase, Landmark,
  TrendingUp, Receipt, Plus, Trash2, Lock, Crown, ArrowLeft,
  ChevronRight, AlertCircle, Percent, Wand2, X, Key, RotateCcw,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ─────────────────────────────────────────────────────────────────────

type TerminationType = "sem_justa_causa" | "justa_causa" | "pedido_demissao";
type SalaryType = "mensalista" | "horista" | "comissionista" | "misto";

type MonthlyInput = {
  competencia: string;
  salarioBase: number;
  diasTrabalhados: number;
  diasUteis: number;
  diasDescanso: number;
  horasExtras50: number;
  horasExtras100: number;
  adicionalNoturnoHoras: number;
  adicionalNoturnoPct: number;
  insalubridadePct: number;
  periculosidade: boolean;
  comissoes: number;
  gratificacao: number;
  faltasDias: number;
};

type EventResult = {
  competencia: string;
  valorHora: number;
  saldoSalario: number;
  comissoes: number;
  gratificacao: number;
  horasExtras50Valor: number;
  horasExtras100Valor: number;
  dsrHorasExtras: number;
  adicionalNoturnoValor: number;
  insalubridadeValor: number;
  periculosidadeValor: number;
  descontoFaltas: number;
  remuneracaoMensal: number;
  fgtsMes: number;
  inssMes: number;
  irrfMes: number;
};

type Summary = {
  totalPrincipal: number;
  mediaVariaveis: number;
  avos13: number;
  avosFerias: number;
  avisoPrevio: number;
  decimoTerceiroProp: number;
  feriasProp: number;
  tercoFerias: number;
  multa477: number;
  multa467: number;
  reflexos: number;
  fgtsPrincipal: number;
  fgtsReflexos: number;
  fgtsTotal: number;
  baseMulta40: number;
  multa40: number;
  inssTotal: number;
  irrfTotal: number;
  bruto: number;
  descontos: number;
  liquido: number;
  correcaoTotal: number;
  jurosTotal: number;
  totalAtualizado: number;
};

// ─── IPCA-E mensal (% ao mês) — IBGE, série histórica Jan/2013–Mar/2025 ───────
const IPCA_E: Record<string, number> = {
  "2013-01":0.86,"2013-02":0.60,"2013-03":0.47,"2013-04":0.55,"2013-05":0.37,"2013-06":0.44,
  "2013-07":0.03,"2013-08":0.24,"2013-09":0.62,"2013-10":0.54,"2013-11":0.54,"2013-12":0.78,
  "2014-01":0.78,"2014-02":0.69,"2014-03":0.92,"2014-04":0.67,"2014-05":0.41,"2014-06":0.40,
  "2014-07":0.21,"2014-08":0.25,"2014-09":0.43,"2014-10":0.48,"2014-11":0.49,"2014-12":0.78,
  "2015-01":0.82,"2015-02":1.22,"2015-03":1.32,"2015-04":0.99,"2015-05":0.59,"2015-06":0.68,
  "2015-07":0.59,"2015-08":0.45,"2015-09":0.54,"2015-10":0.82,"2015-11":1.01,"2015-12":0.96,
  "2016-01":1.12,"2016-02":1.20,"2016-03":0.97,"2016-04":0.62,"2016-05":0.78,"2016-06":0.35,
  "2016-07":0.46,"2016-08":0.44,"2016-09":0.08,"2016-10":0.26,"2016-11":0.14,"2016-12":0.21,
  "2017-01":0.24,"2017-02":0.36,"2017-03":0.39,"2017-04":0.14,"2017-05":-0.04,"2017-06":-0.20,
  "2017-07":-0.26,"2017-08":0.19,"2017-09":0.17,"2017-10":0.23,"2017-11":0.28,"2017-12":0.54,
  "2018-01":0.32,"2018-02":0.07,"2018-03":0.18,"2018-04":0.22,"2018-05":0.55,"2018-06":1.32,
  "2018-07":0.16,"2018-08":-0.06,"2018-09":0.48,"2018-10":0.45,"2018-11":-0.21,"2018-12":0.29,
  "2019-01":0.36,"2019-02":0.43,"2019-03":0.75,"2019-04":0.57,"2019-05":0.35,"2019-06":0.01,
  "2019-07":0.19,"2019-08":0.11,"2019-09":0.19,"2019-10":0.24,"2019-11":0.17,"2019-12":1.22,
  "2020-01":0.71,"2020-02":0.28,"2020-03":0.07,"2020-04":-0.51,"2020-05":-0.38,"2020-06":0.02,
  "2020-07":0.36,"2020-08":0.30,"2020-09":0.94,"2020-10":0.86,"2020-11":0.89,"2020-12":1.35,
  "2021-01":0.78,"2021-02":0.97,"2021-03":0.93,"2021-04":1.19,"2021-05":0.44,"2021-06":1.02,
  "2021-07":0.96,"2021-08":1.07,"2021-09":1.17,"2021-10":1.20,"2021-11":0.95,"2021-12":0.86,
  "2022-01":0.54,"2022-02":1.06,"2022-03":1.62,"2022-04":1.06,"2022-05":0.69,"2022-06":1.38,
  "2022-07":0.13,"2022-08":-0.61,"2022-09":0.41,"2022-10":0.59,"2022-11":0.45,"2022-12":0.54,
  "2023-01":0.53,"2023-02":0.99,"2023-03":0.71,"2023-04":0.57,"2023-05":0.51,"2023-06":-0.08,
  "2023-07":0.28,"2023-08":0.12,"2023-09":0.26,"2023-10":0.24,"2023-11":0.33,"2023-12":0.56,
  "2024-01":0.42,"2024-02":0.83,"2024-03":0.43,"2024-04":0.44,"2024-05":0.46,"2024-06":0.39,
  "2024-07":0.30,"2024-08":0.44,"2024-09":0.44,"2024-10":0.56,"2024-11":0.39,"2024-12":0.34,
  "2025-01":0.16,"2025-02":1.31,"2025-03":0.43,"2025-04":0.22,"2025-05":0.30,
};

function nextMonthYM(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

function fatorIPCAE(fromYM: string, toYM: string): number {
  if (!fromYM || !toYM || fromYM >= toYM) return 1;
  let fator = 1, cur = fromYM;
  while (cur < toYM) {
    fator *= 1 + (IPCA_E[cur] ?? 0.35) / 100;
    cur = nextMonthYM(cur);
  }
  return fator;
}

function monthDiff(fromYM: string, toYM: string): number {
  if (!fromYM || !toYM || fromYM >= toYM) return 0;
  const [fy, fm] = fromYM.split("-").map(Number);
  const [ty, tm] = toYM.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const parseNum = (v: string | number) => {
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const currency = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(n) ? n : 0,
  );

const calcAvos13 = (admission: string, termination: string) => {
  if (!admission || !termination) return 0;
  const a = new Date(admission);
  const t = new Date(termination);
  let avos = 0;
  for (let m = 0; m < 12; m++) {
    const startMonth = new Date(t.getFullYear(), m, 1);
    const endMonth = new Date(t.getFullYear(), m + 1, 0);
    const workedStart = a > startMonth ? a : startMonth;
    const workedEnd = t < endMonth ? t : endMonth;
    const days = workedEnd >= workedStart ? workedEnd.getDate() - workedStart.getDate() + 1 : 0;
    if (days >= 15) avos++;
  }
  return Math.min(12, Math.max(0, avos));
};

const calcAvosFerias = (admission: string, termination: string) => {
  if (!admission || !termination) return 0;
  const a = new Date(admission);
  const t = new Date(termination);
  let months = (t.getFullYear() - a.getFullYear()) * 12 + (t.getMonth() - a.getMonth());
  if (t.getDate() >= a.getDate()) months += 1;
  return Math.max(0, months % 12);
};

/**
 * Lei 12.506/2011 — Aviso-prévio proporcional ao tempo de serviço
 * Base: 30 dias + 3 dias por ano completo acima de 1 ano, limitado a 90 dias.
 * Retorna o número de meses (pode ser fracionário, ex: 60 dias → 2,0 meses).
 */
const calcAvisoPrevioLei12506 = (admission: string, termination: string): { dias: number; meses: number } => {
  if (!admission || !termination) return { dias: 30, meses: 1 };
  const a = new Date(admission + "T12:00");
  const t = new Date(termination + "T12:00");
  const totalMeses = (t.getFullYear() - a.getFullYear()) * 12 + (t.getMonth() - a.getMonth());
  const anosCompletos = Math.floor(Math.max(0, totalMeses) / 12);
  const dias = Math.min(90, 30 + Math.max(0, anosCompletos - 1) * 3);
  return { dias, meses: round2(dias / 30) };
};


const blankCompetencia = (): MonthlyInput => ({
  competencia: "", salarioBase: 0, diasTrabalhados: 0, diasUteis: 0,
  diasDescanso: 0, horasExtras50: 0, horasExtras100: 0, adicionalNoturnoHoras: 0,
  adicionalNoturnoPct: 20, insalubridadePct: 0, periculosidade: false,
  comissoes: 0, gratificacao: 0, faltasDias: 0,
});

const defaultCompetencias: MonthlyInput[] = [blankCompetencia()];

/**
 * Calcula dias trabalhados, úteis e de descanso em um intervalo do mês.
 * - `mes` é 1-indexado (Janeiro = 1)
 * - Dias úteis: segunda a sexta-feira
 * - Dias de descanso: sábado e domingo
 */
function calcDiasNoMes(
  ano: number, mes: number, diaInicio: number, diaFim: number,
): { diasTrabalhados: number; diasUteis: number; diasDescanso: number } {
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const inicio = Math.max(1, diaInicio);
  const fim = Math.min(diasNoMes, diaFim);
  if (fim < inicio) return { diasTrabalhados: 0, diasUteis: 0, diasDescanso: 0 };
  let uteis = 0, descanso = 0;
  for (let d = inicio; d <= fim; d++) {
    const dow = new Date(ano, mes - 1, d).getDay(); // 0=Dom, 6=Sáb
    if (dow === 0 || dow === 6) descanso++; else uteis++;
  }
  return { diasTrabalhados: fim - inicio + 1, diasUteis: uteis, diasDescanso: descanso };
}

/**
 * Gera competências mensais entre a admissão e a rescisão.
 * - Primeiro e último mês são proporcionais às datas do contrato.
 * - Meses intermediários recebem o mês completo.
 * - Comissões, gratificação e faltas iniciam em zero para edição posterior.
 */
function gerarCompetenciasAuto(
  admissionDate: string,
  terminationDate: string,
  salarioRef: number,
): MonthlyInput[] {
  const adm = new Date(admissionDate + "T12:00:00");
  const ter = new Date(terminationDate + "T12:00:00");
  const result: MonthlyInput[] = [];
  let y = adm.getFullYear(), m = adm.getMonth() + 1;
  const termY = ter.getFullYear(), termM = ter.getMonth() + 1;
  while (y < termY || (y === termY && m <= termM)) {
    const diasNoMes = new Date(y, m, 0).getDate();
    let diaInicio = 1, diaFim = diasNoMes;
    if (y === adm.getFullYear() && m === adm.getMonth() + 1) diaInicio = adm.getDate();
    if (y === termY && m === termM) diaFim = ter.getDate();
    const { diasTrabalhados, diasUteis, diasDescanso } = calcDiasNoMes(y, m, diaInicio, diaFim);
    result.push({
      competencia: `${y}-${String(m).padStart(2, "0")}`,
      salarioBase: salarioRef,
      diasTrabalhados, diasUteis, diasDescanso,
      horasExtras50: 0, horasExtras100: 0,
      adicionalNoturnoHoras: 0, adicionalNoturnoPct: 20,
      insalubridadePct: 0, periculosidade: false,
      comissoes: 0, gratificacao: 0, faltasDias: 0,
    });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="h-9 text-sm" />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: any) => void; options: [string, string][];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative h-6 w-12 rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-6.5 left-[26px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function MetricBadge({ label, value, color = "blue" }: {
  label: string; value: string; color?: "blue" | "emerald" | "amber" | "red";
}) {
  const colors = {
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300",
    red: "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${colors[color]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest opacity-60">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value, negative, strong }: {
  label: string; value: number; negative?: boolean; strong?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between text-sm py-1 ${strong ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={negative ? "text-red-500" : strong ? "text-foreground" : ""}>
        {currency(value)}
      </span>
    </div>
  );
}

// ─── Upgrade Gate ──────────────────────────────────────────────────────────────

function UpgradeGate({ planRequired }: { planRequired: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
        <Lock className="w-8 h-8 text-amber-500" />
      </div>
      <div>
        <h2 className="text-2xl font-bold mb-2">Módulo Trabalhista</h2>
        <p className="text-muted-foreground max-w-md">
          Este módulo está disponível a partir do plano <strong>{planRequired}</strong>.
          Faça upgrade para acessar cálculos trabalhistas completos com lógica PJe-Calc.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
        </Link>
        <Link href="/planos">
          <Button className="gap-2 bg-blue-600 hover:bg-blue-500">
            <Crown className="w-4 h-4" /> Ver Planos
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── PDF Report ────────────────────────────────────────────────────────────────

function gerarLaudoHtml(params: {
  processo: string; vara: string; reclamante: string; reclamada: string;
  cargo: string; salaryType: string; admissionDate: string; terminationDate: string;
  terminationType: string; summary: Summary; eventResults: EventResult[];
  observacoesTecnicas: string; fgtsDepositadoComprovado: number;
  salarioMinimo: number; insalubrBase: "salario_minimo" | "salario_base";
  mesesAviso: number;
  indiceAtualizacao: string; regraJuros: string;
  dataAjuizamento: string; dataFinalCalculo: string;
  logoSrc: string;
}): string {
  const { processo, vara, reclamante, reclamada, cargo, salaryType, admissionDate,
    terminationDate, terminationType, summary, eventResults, observacoesTecnicas,
    fgtsDepositadoComprovado, salarioMinimo, insalubrBase, mesesAviso,
    indiceAtualizacao, regraJuros, dataAjuizamento, dataFinalCalculo,
    logoSrc } = params;

  const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const rescisaoLabel = { sem_justa_causa: "Sem justa causa", justa_causa: "Justa causa", pedido_demissao: "Pedido de demissão" }[terminationType as TerminationType] ?? terminationType;

  const body = `
  <div class="vr-page-header">
    <div class="vr-brand-block">
      <div class="vr-logo-box">
        <img src="${logoSrc}" alt="Veritas Analytics" onerror="this.style.display='none'" />
      </div>
      <div>
        <div class="vr-brand-name">Veritas Analytics</div>
        <div class="vr-brand-sub">Módulo Trabalhista — Cálculos Judiciais Federais</div>
      </div>
    </div>
    <div class="vr-emit-info">
      Emitido em <strong>${now}</strong><br>
      Uso restrito ao profissional habilitado
    </div>
  </div>

  <div class="vr-title-bar" id="laudo-chave">
    <div class="vr-title-bar-title">Laudo de Cálculo Trabalhista — ${processo || "Processo não informado"}</div>
    <div class="vr-title-bar-chave">Chave: aguardando…</div>
  </div>

  <div class="vr-meta">
    <div class="vr-meta-grid">
      <div><span class="vr-meta-label">Processo: </span><span class="vr-meta-value">${processo}</span></div>
      <div><span class="vr-meta-label">Vara: </span><span class="vr-meta-value">${vara}</span></div>
      <div><span class="vr-meta-label">Reclamante: </span><span class="vr-meta-value">${reclamante}</span></div>
      <div><span class="vr-meta-label">Reclamada: </span><span class="vr-meta-value">${reclamada}</span></div>
      <div><span class="vr-meta-label">Cargo: </span><span class="vr-meta-value">${cargo}</span></div>
      <div><span class="vr-meta-label">Tipo de Remuneração: </span><span class="vr-meta-value">${salaryType}</span></div>
      <div><span class="vr-meta-label">Admissão: </span><span class="vr-meta-value">${admissionDate ? new Date(admissionDate + "T12:00").toLocaleDateString("pt-BR") : "—"}</span></div>
      <div><span class="vr-meta-label">Demissão: </span><span class="vr-meta-value">${terminationDate ? new Date(terminationDate + "T12:00").toLocaleDateString("pt-BR") : "—"}</span></div>
      <div><span class="vr-meta-label">Tipo de Rescisão: </span><span class="vr-meta-value">${rescisaoLabel}</span></div>
    </div>
  </div>

  <div class="vr-body">

    <div class="vr-kpi-row">
      <div class="vr-kpi">
        <div class="vr-kpi-label">Principal</div>
        <div class="vr-kpi-value">${currency(summary.totalPrincipal)}</div>
      </div>
      <div class="vr-kpi">
        <div class="vr-kpi-label">Reflexos Rescisórios</div>
        <div class="vr-kpi-value">${currency(summary.reflexos)}</div>
      </div>
      <div class="vr-kpi">
        <div class="vr-kpi-label">FGTS Total</div>
        <div class="vr-kpi-value">${currency(summary.fgtsTotal)}</div>
      </div>
      <div class="vr-kpi">
        <div class="vr-kpi-label">Crédito Bruto</div>
        <div class="vr-kpi-value">${currency(summary.bruto)}</div>
      </div>
      <div class="vr-kpi primary">
        <div class="vr-kpi-label">Crédito Líquido</div>
        <div class="vr-kpi-value">${currency(summary.liquido)}</div>
      </div>
      <div class="vr-kpi accent">
        <div class="vr-kpi-label">Total Atualizado</div>
        <div class="vr-kpi-value">${currency(summary.totalAtualizado)}</div>
      </div>
    </div>

    <div class="vr-section-title">1. Parâmetros Aplicados — Manual TRT-3ª Região 2026/1</div>
    <div class="vr-meta-grid" style="margin-top:8px">
      <div><span class="vr-meta-label">Salário mínimo (insalubridade): </span><span class="vr-meta-value">R$ ${salarioMinimo.toFixed(2).replace(".", ",")} — ${insalubrBase === "salario_minimo" ? "Salário mínimo (CLT Art. 192 / Súmula 17 TST)" : "Salário contratual (CCT/ACT)"}</span></div>
      <div><span class="vr-meta-label">Aviso-prévio: </span><span class="vr-meta-value">${mesesAviso} ${mesesAviso === 1 ? "mês" : "meses"} — ${Math.round(mesesAviso * 30)} dias (Lei 12.506/2011)</span></div>
      <div><span class="vr-meta-label">Média de variáveis: </span><span class="vr-meta-value">Inclui insalubridade e periculosidade habituais (Manual TRT-3 2026/1)</span></div>
      <div><span class="vr-meta-label">Reflexos rescisórios: </span><span class="vr-meta-value">13º proporcional, férias proporcionais + 1/3 e aviso-prévio indenizado</span></div>
    </div>

    <div class="vr-section-title">2. Apuração por Competência</div>
    <table>
      <thead>
        <tr>
          <th>Comp.</th><th class="right">Saldo Sal.</th><th class="right">HE 50%</th>
          <th class="right">HE 100%</th><th class="right">DSR</th><th class="right">Ad. Not.</th>
          <th class="right">Insal.</th><th class="right">Peric.</th><th class="right">Faltas</th><th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${eventResults.map((r) => `
        <tr>
          <td>${r.competencia}</td>
          <td class="right">${currency(r.saldoSalario)}</td>
          <td class="right">${currency(r.horasExtras50Valor)}</td>
          <td class="right">${currency(r.horasExtras100Valor)}</td>
          <td class="right">${currency(r.dsrHorasExtras)}</td>
          <td class="right">${currency(r.adicionalNoturnoValor)}</td>
          <td class="right">${currency(r.insalubridadeValor)}</td>
          <td class="right">${currency(r.periculosidadeValor)}</td>
          <td class="right" style="color:#dc2626">-${currency(r.descontoFaltas)}</td>
          <td class="right" style="font-weight:700">${currency(r.remuneracaoMensal)}</td>
        </tr>`).join("")}
      </tbody>
    </table>

    <div class="vr-section-title">3. Encargos por Competência (FGTS / INSS / IRRF)</div>
    <table>
      <thead><tr><th>Competência</th><th class="right">FGTS (8%)</th><th class="right">INSS</th><th class="right">IRRF</th></tr></thead>
      <tbody>
        ${eventResults.map((r) => `
        <tr>
          <td>${r.competencia}</td>
          <td class="right">${currency(r.fgtsMes)}</td>
          <td class="right">${currency(r.inssMes)}</td>
          <td class="right">${currency(r.irrfMes)}</td>
        </tr>`).join("")}
      </tbody>
    </table>

    <div class="vr-section-title">4. Verbas Rescisórias</div>
    <table>
      <thead><tr><th>Verba</th><th class="right">Ávos</th><th class="right">Valor</th></tr></thead>
      <tbody>
        <tr><td>Aviso-prévio</td><td class="right">—</td><td class="right">${currency(summary.avisoPrevio)}</td></tr>
        <tr><td>13º Salário Proporcional</td><td class="right">${summary.avos13}/12</td><td class="right">${currency(summary.decimoTerceiroProp)}</td></tr>
        <tr><td>Férias Proporcionais</td><td class="right">${summary.avosFerias}/12</td><td class="right">${currency(summary.feriasProp)}</td></tr>
        <tr><td>1/3 Constitucional de Férias</td><td class="right">—</td><td class="right">${currency(summary.tercoFerias)}</td></tr>
        ${summary.multa477 > 0 ? `<tr><td>Multa art. 477 da CLT</td><td class="right">—</td><td class="right">${currency(summary.multa477)}</td></tr>` : ""}
        ${summary.multa467 > 0 ? `<tr><td>Multa art. 467 da CLT</td><td class="right">—</td><td class="right">${currency(summary.multa467)}</td></tr>` : ""}
        <tr style="background:#eff6ff"><td style="font-weight:700">FGTS sobre rescisão</td><td class="right">—</td><td class="right" style="font-weight:700">${currency(summary.fgtsReflexos)}</td></tr>
        ${summary.multa40 > 0 ? `
        <tr><td>Base da multa de 40% FGTS${fgtsDepositadoComprovado > 0 ? " (extrato/conta vinculada)" : " (apurado)"}</td><td class="right">—</td><td class="right">${currency(summary.baseMulta40)}</td></tr>
        <tr style="background:#eff6ff"><td style="font-weight:700">Multa de 40% sobre FGTS</td><td class="right">—</td><td class="right" style="font-weight:700">${currency(summary.multa40)}</td></tr>` : ""}
      </tbody>
    </table>

    <div class="vr-section-title">5. Consolidação do Crédito</div>
    <div class="vr-summary">
      <div class="vr-summary-row"><span>Principal (verbas mensais)</span><span>${currency(summary.totalPrincipal)}</span></div>
      <div class="vr-summary-row"><span>Reflexos rescisórios</span><span>${currency(summary.reflexos)}</span></div>
      <div class="vr-summary-row"><span>FGTS total</span><span>${currency(summary.fgtsTotal)}</span></div>
      ${summary.multa40 > 0 ? `<div class="vr-summary-row"><span>Multa 40% FGTS</span><span>${currency(summary.multa40)}</span></div>` : ""}
      <div class="vr-summary-row" style="font-weight:700;background:#eff6ff;padding:4px 8px;border-radius:4px"><span>Crédito bruto</span><span>${currency(summary.bruto)}</span></div>
      <div class="vr-summary-row" style="color:#dc2626"><span>Desconto INSS</span><span>- ${currency(summary.inssTotal)}</span></div>
      <div class="vr-summary-row" style="color:#dc2626"><span>Desconto IRRF</span><span>- ${currency(summary.irrfTotal)}</span></div>
    </div>
    <div class="vr-total-block"><span class="label">Crédito líquido</span><span class="value">${currency(summary.liquido)}</span></div>

    <div class="vr-section-title">6. Atualização Monetária e Juros por Competência</div>
    <div class="vr-info-box" style="margin-bottom:10px">
      <strong>Índice:</strong> ${indiceAtualizacao === "nenhum" ? "Sem correção monetária" : indiceAtualizacao} &nbsp;|&nbsp;
      <strong>Juros:</strong> ${regraJuros === "nenhum" ? "Sem juros" : regraJuros === "1%_mes" ? "1% a.m. (art. 39 ADCT)" : regraJuros} &nbsp;|&nbsp;
      <strong>Marco inicial juros:</strong> ${dataAjuizamento ? new Date(dataAjuizamento + "T12:00:00").toLocaleDateString("pt-BR") : "Não informado"} &nbsp;|&nbsp;
      <strong>Data final:</strong> ${dataFinalCalculo ? new Date(dataFinalCalculo + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
    </div>
    <table>
      <thead><tr>
        <th>Competência</th>
        <th class="right">Principal (R$)</th>
        <th class="right">Fator IPCA-E</th>
        <th class="right">Valor corrigido</th>
        <th class="right">Correção</th>
      </tr></thead>
      <tbody>
      ${eventResults.filter(r => r.remuneracaoMensal > 0).map(r => {
        const compYM = r.competencia;
        const dataFinalYM = dataFinalCalculo.slice(0, 7);
        const fator = indiceAtualizacao !== "nenhum" && dataFinalYM ? fatorIPCAE(compYM, dataFinalYM) : 1;
        const corrigido = Math.round(r.remuneracaoMensal * fator * 100) / 100;
        const correcao = Math.round((corrigido - r.remuneracaoMensal) * 100) / 100;
        return `<tr>
          <td>${compYM}</td>
          <td class="right">${currency(r.remuneracaoMensal)}</td>
          <td class="right">${fator.toFixed(6)}</td>
          <td class="right">${currency(corrigido)}</td>
          <td class="right">${currency(correcao)}</td>
        </tr>`;
      }).join("")}
      </tbody>
    </table>
    <div class="vr-summary" style="margin-top:12px">
      <div class="vr-summary-row" style="font-weight:700;background:#eff6ff;padding:4px 8px;border-radius:4px"><span>Correção monetária (${indiceAtualizacao})</span><span>+ ${currency(summary.correcaoTotal)}</span></div>
      <div class="vr-summary-row" style="font-weight:700;background:#eff6ff;padding:4px 8px;border-radius:4px"><span>Juros moratórios (${regraJuros === "1%_mes" ? "1% a.m." : regraJuros})</span><span>+ ${currency(summary.jurosTotal)}</span></div>
    </div>
    <div class="vr-total-block"><span class="label">TOTAL ATUALIZADO</span><span class="value">${currency(summary.totalAtualizado)}</span></div>

    <div class="vr-section-title">7. Observações Técnicas</div>
    <div class="vr-info-box">${observacoesTecnicas || "—"}</div>
    <p class="vr-paragraph">
      A correção monetária foi calculada pelo índice ${indiceAtualizacao} por competência, com base na tabela oficial do IBGE.
      Os juros moratórios aplicados correspondem a ${regraJuros === "1%_mes" ? "1% ao mês (art. 39 da Lei 8.177/91 c/c Súmula 200 TST)" : regraJuros},
      com termo inicial a partir de ${dataAjuizamento ? new Date(dataAjuizamento + "T12:00:00").toLocaleDateString("pt-BR") : "data de ajuizamento não informada"}.
      Data final de cálculo: ${dataFinalCalculo ? new Date(dataFinalCalculo + "T12:00:00").toLocaleDateString("pt-BR") : "—"}.
      Este documento observa as normativas do TST, do TRT competente e o Manual de Orientação de Procedimentos para os Cálculos na Justiça do Trabalho.
    </p>

  </div>

  <div class="vr-footer">
    <span><strong>Veritas Analytics</strong> — Plataforma de Cálculos Judiciais Federais</span>
    <span id="laudo-chave-footer" class="vr-footer-chave">Chave: aguardando…</span>
  </div>
  <div class="vr-ressalva">
    Este documento não substitui laudo pericial assinado por expert judicial. Uso restrito ao profissional habilitado. Gerado em ${now}.
  </div>`;

  return buildVeritasReport({ title: `Laudo Trabalhista — ${processo}`, body });
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Trabalhista() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: subData } = useSubscription();
  const debitCredits = useDebitCredits();
  const { calcInss, calcIrrf, inssTable, irrfTable, isLoading: taxLoading } = useTaxTables();

  const planSlug = subData?.planSlug ?? null;
  const isAdmin = user?.role === "admin";

  const [creditoDebitado, setCreditoDebitado] = useState(false);
  const [tab, setTab] = useState("contrato");
  const [chaveGerada, setChaveGerada] = useState<string | null>(null);
  const [inputChave, setInputChave] = useState("");
  const [loadingRecover, setLoadingRecover] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);

  const [processo, setProcesso] = useState("");
  const [vara, setVara] = useState("");
  const [reclamante, setReclamante] = useState("");
  const [reclamada, setReclamada] = useState("");
  const [cargo, setCargo] = useState("");
  const [salaryType, setSalaryType] = useState<SalaryType>("mensalista");
  const [admissionDate, setAdmissionDate] = useState("");
  const [terminationDate, setTerminationDate] = useState("");
  const [terminationType, setTerminationType] = useState<TerminationType>("sem_justa_causa");
  const [divisor, setDivisor] = useState(220);
  const [mesesAviso, setMesesAviso] = useState(1);
  const [aplicarMulta477, setAplicarMulta477] = useState(false);
  const [aplicarMulta467, setAplicarMulta467] = useState(false);
  const [indiceAtualizacao, setIndiceAtualizacao] = useState<"IPCA-E" | "SELIC" | "nenhum">("IPCA-E");
  const [regraJuros, setRegraJuros] = useState<"1%_mes" | "SELIC" | "nenhum">("1%_mes");
  const [dataAjuizamento, setDataAjuizamento] = useState("");
  const [dataFinalCalculo, setDataFinalCalculo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [observacoesTecnicas, setObservacoesTecnicas] = useState("");
  const [competencias, setCompetencias] = useState<MonthlyInput[]>(defaultCompetencias);
  const [fgtsDepositadoComprovado, setFgtsDepositadoComprovado] = useState<number>(0);
  // Salário mínimo vigente — base de cálculo da insalubridade (CLT Art. 192 / Súmula 17 TST)
  const [salarioMinimo, setSalarioMinimo] = useState<number>(1518.00);
  // Base da insalubridade: "salario_minimo" (regra geral) ou "salario_base" (por CCT/ACT)
  const [insalubrBase, setInsalubrBase] = useState<"salario_minimo" | "salario_base">("salario_minimo");

  const [showGerarModal, setShowGerarModal] = useState(false);
  const [salarioRefInput, setSalarioRefInput] = useState("");
  const [gerarErro, setGerarErro] = useState("");

  const searchString = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const tabParam = params.get("tab");
    if (tabParam) setTab(tabParam);
  }, [searchString]);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const key = params.get("key");
    if (!key) return;
    setLoadingRecover(true);
    fetch(`${BASE}/api/civil/recover/${key.toUpperCase()}`, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const s = data.calcState as any;
        if (s?.processo)            setProcesso(s.processo);
        if (s?.vara)                setVara(s.vara);
        if (s?.reclamante)          setReclamante(s.reclamante);
        if (s?.reclamada)           setReclamada(s.reclamada);
        if (s?.cargo)               setCargo(s.cargo);
        if (s?.salaryType)          setSalaryType(s.salaryType);
        if (s?.admissionDate)       setAdmissionDate(s.admissionDate);
        if (s?.terminationDate)     setTerminationDate(s.terminationDate);
        if (s?.terminationType)     setTerminationType(s.terminationType);
        if (s?.divisor !== undefined)    setDivisor(s.divisor);
        if (s?.mesesAviso !== undefined) setMesesAviso(s.mesesAviso);
        if (s?.indiceAtualizacao)   setIndiceAtualizacao(s.indiceAtualizacao);
        if (s?.regraJuros)          setRegraJuros(s.regraJuros);
        if (s?.dataAjuizamento)     setDataAjuizamento(s.dataAjuizamento);
        if (s?.dataFinalCalculo)    setDataFinalCalculo(s.dataFinalCalculo);
        if (s?.observacoesTecnicas !== undefined) setObservacoesTecnicas(s.observacoesTecnicas);
        if (s?.competencias?.length) setCompetencias(s.competencias);
        if (s?.fgtsDepositadoComprovado !== undefined) setFgtsDepositadoComprovado(s.fgtsDepositadoComprovado);
        if (s?.salarioMinimo !== undefined) setSalarioMinimo(s.salarioMinimo);
        if (s?.insalubrBase)        setInsalubrBase(s.insalubrBase);
        setChaveGerada(data.publicKey);
        toast({ title: "Cálculo recuperado", description: `Chave: ${data.publicKey}` });
      })
      .catch(() => toast({ title: "Chave não encontrada", description: key, variant: "destructive" }))
      .finally(() => setLoadingRecover(false));
  }, [searchString]);

  const salarioRescisorio = useMemo(() => {
    const ultima = [...competencias].sort((a, b) => a.competencia.localeCompare(b.competencia)).slice(-1)[0];
    return ultima?.salarioBase || 0;
  }, [competencias]);

  const eventResults = useMemo<EventResult[]>(() => {
    return competencias.map((c) => {
      const valorHora = round2(c.salarioBase / parseNum(divisor));
      const saldoSalario = round2((c.salarioBase / 30) * c.diasTrabalhados);
      const horasExtras50Valor = round2(c.horasExtras50 * valorHora * 1.5);
      const horasExtras100Valor = round2(c.horasExtras100 * valorHora * 2);
      const dsrHorasExtras = c.diasUteis > 0
        ? round2(((horasExtras50Valor + horasExtras100Valor) / c.diasUteis) * c.diasDescanso) : 0;
      const adicionalNoturnoValor = round2(c.adicionalNoturnoHoras * valorHora * (c.adicionalNoturnoPct / 100));
      // ── INSALUBRIDADE ─────────────────────────────────────────────────────────
      // CLT Art. 192 + Súmula 17 TST: base = salário mínimo (regra geral).
      // Por CCT/ACT pode ser o salário contratual — configurável em "Parâmetros".
      const baseInsalubridade = insalubrBase === "salario_minimo" ? salarioMinimo : c.salarioBase;
      const insalubridadeValor = round2(baseInsalubridade * (c.insalubridadePct / 100));
      // ── PERICULOSIDADE ────────────────────────────────────────────────────────
      // CLT Art. 193 / NR-16: 30% sobre o salário contratual (não sobre o mínimo).
      const periculosidadeValor = c.periculosidade ? round2(c.salarioBase * 0.3) : 0;
      const descontoFaltas = round2((c.salarioBase / 30) * c.faltasDias);
      const remuneracaoMensal = round2(
        saldoSalario + c.comissoes + c.gratificacao + horasExtras50Valor + horasExtras100Valor +
        dsrHorasExtras + adicionalNoturnoValor + insalubridadeValor + periculosidadeValor - descontoFaltas,
      );
      const fgtsMes = round2(Math.max(0, remuneracaoMensal) * 0.08);
      const inssMes = calcInss(Math.max(0, remuneracaoMensal));
      const irrfMes = calcIrrf(Math.max(0, remuneracaoMensal - inssMes));
      return {
        competencia: c.competencia, valorHora, saldoSalario, comissoes: c.comissoes,
        gratificacao: c.gratificacao, horasExtras50Valor, horasExtras100Valor, dsrHorasExtras,
        adicionalNoturnoValor, insalubridadeValor, periculosidadeValor, descontoFaltas,
        remuneracaoMensal, fgtsMes, inssMes, irrfMes,
      };
    });
  }, [competencias, divisor, calcInss, calcIrrf, salarioMinimo, insalubrBase]);

  const summary = useMemo<Summary>(() => {
    const totalPrincipal = round2(eventResults.reduce((acc, r) => acc + r.remuneracaoMensal, 0));
    // ── MÉDIA DE VARIÁVEIS ──────────────────────────────────────────────────────
    // Manual TRT-3 2026/1: integram a média todas as verbas de natureza salarial
    // habitual, inclusive insalubridade e periculosidade (quando habituais).
    // Base dos reflexos rescisórios: 13º, férias e aviso-prévio.
    const mediaVariaveis = eventResults.length ? round2(
      eventResults.reduce((acc, r) =>
        acc + r.comissoes + r.gratificacao + r.horasExtras50Valor + r.horasExtras100Valor +
        r.dsrHorasExtras + r.adicionalNoturnoValor + r.insalubridadeValor + r.periculosidadeValor, 0)
      / eventResults.length) : 0;
    const avos13 = calcAvos13(admissionDate, terminationDate);
    const avosFerias = calcAvosFerias(admissionDate, terminationDate);
    const avisoPrevio = round2((salarioRescisorio + mediaVariaveis) * mesesAviso);
    const decimoTerceiroProp = round2((salarioRescisorio + mediaVariaveis) * (avos13 / 12));
    const feriasProp = round2((salarioRescisorio + mediaVariaveis) * (avosFerias / 12));
    const tercoFerias = round2(feriasProp / 3);
    const multa477 = aplicarMulta477 ? round2(salarioRescisorio + mediaVariaveis) : 0;
    const multa467 = aplicarMulta467 ? round2((salarioRescisorio + mediaVariaveis) * 0.5) : 0;
    const reflexos = round2(avisoPrevio + decimoTerceiroProp + feriasProp + tercoFerias + multa477 + multa467);
    const fgtsPrincipal = round2(eventResults.reduce((acc, r) => acc + r.fgtsMes, 0));
    const fgtsReflexos = round2((avisoPrevio + decimoTerceiroProp) * 0.08);
    const fgtsTotal = round2(fgtsPrincipal + fgtsReflexos);
    // Saldo FGTS informado manualmente → sempre é a base dos 40%
    // (pode ser maior que o calculado quando há depósitos de período anterior ao cálculo)
    const baseMulta40 = fgtsDepositadoComprovado > 0 ? round2(fgtsDepositadoComprovado) : fgtsTotal;
    const multa40 = terminationType === "sem_justa_causa" ? round2(baseMulta40 * 0.4) : 0;
    const inssTotal = round2(eventResults.reduce((acc, r) => acc + r.inssMes, 0));
    const irrfTotal = round2(eventResults.reduce((acc, r) => acc + r.irrfMes, 0));
    const bruto = round2(totalPrincipal + reflexos + fgtsTotal + multa40);
    const descontos = round2(inssTotal + irrfTotal);
    const liquido = round2(bruto - descontos);

    // ── Atualização por competência — IPCA-E por parcela ──────────────────────
    const dataFinalYM = dataFinalCalculo.slice(0, 7);
    const dataAjuizYM = dataAjuizamento.slice(0, 7);

    let correcaoTotal = 0;
    let jurosTotal = 0;

    for (const r of eventResults) {
      const compYM = r.competencia; // "YYYY-MM"
      const base = Math.max(0, r.remuneracaoMensal);
      if (base <= 0) continue;

      const fator = indiceAtualizacao !== "nenhum" && dataFinalYM
        ? fatorIPCAE(compYM, dataFinalYM) : 1;
      const corrigido = round2(base * fator);
      correcaoTotal += round2(corrigido - base);

      if (regraJuros !== "nenhum" && dataAjuizYM && dataFinalYM && dataAjuizYM < dataFinalYM) {
        const mJ = monthDiff(dataAjuizYM, dataFinalYM);
        const taxa = regraJuros === "1%_mes" ? 0.01 : 0;
        jurosTotal += round2(corrigido * taxa * mJ);
      }
    }

    // Verbas rescisórias (aviso-prévio + 13º + férias + multas) — marco: terminationDate
    const rescisaoBase = round2(reflexos + multa40);
    if (rescisaoBase > 0 && dataFinalYM) {
      const termYM = terminationDate.slice(0, 7);
      const fatorResc = indiceAtualizacao !== "nenhum" ? fatorIPCAE(termYM, dataFinalYM) : 1;
      const corrigidoResc = round2(rescisaoBase * fatorResc);
      correcaoTotal += round2(corrigidoResc - rescisaoBase);
      if (regraJuros !== "nenhum" && dataAjuizYM && dataFinalYM && dataAjuizYM < dataFinalYM) {
        const mJ = monthDiff(dataAjuizYM, dataFinalYM);
        const taxa = regraJuros === "1%_mes" ? 0.01 : 0;
        jurosTotal += round2(corrigidoResc * taxa * mJ);
      }
    }

    correcaoTotal = round2(correcaoTotal);
    jurosTotal    = round2(jurosTotal);
    const totalAtualizado = round2(liquido + correcaoTotal + jurosTotal);

    return { totalPrincipal, mediaVariaveis, avos13, avosFerias, avisoPrevio, decimoTerceiroProp,
      feriasProp, tercoFerias, multa477, multa467, reflexos, fgtsPrincipal, fgtsReflexos, fgtsTotal,
      baseMulta40, multa40, inssTotal, irrfTotal, bruto, descontos, liquido,
      correcaoTotal, jurosTotal, totalAtualizado };
  }, [eventResults, admissionDate, terminationDate, salarioRescisorio, mesesAviso,
    aplicarMulta477, aplicarMulta467, terminationType, indiceAtualizacao, regraJuros,
    dataAjuizamento, dataFinalCalculo, competencias.length, fgtsDepositadoComprovado]);

  const memoryRows = useMemo(() => {
    const rows = eventResults.flatMap((r) => [
      { competencia: r.competencia, rubrica: "Saldo de salário", valor: r.saldoSalario },
      { competencia: r.competencia, rubrica: "Comissões", valor: r.comissoes },
      { competencia: r.competencia, rubrica: "Gratificação", valor: r.gratificacao },
      { competencia: r.competencia, rubrica: "Horas extras 50%", valor: r.horasExtras50Valor },
      { competencia: r.competencia, rubrica: "Horas extras 100%", valor: r.horasExtras100Valor },
      { competencia: r.competencia, rubrica: "DSR sobre HEs", valor: r.dsrHorasExtras },
      { competencia: r.competencia, rubrica: "Adicional noturno", valor: r.adicionalNoturnoValor },
      { competencia: r.competencia, rubrica: "Insalubridade", valor: r.insalubridadeValor },
      { competencia: r.competencia, rubrica: "Periculosidade", valor: r.periculosidadeValor },
      { competencia: r.competencia, rubrica: "Desconto de faltas", valor: -r.descontoFaltas },
      { competencia: r.competencia, rubrica: "FGTS", valor: r.fgtsMes },
      { competencia: r.competencia, rubrica: "INSS", valor: -r.inssMes },
      { competencia: r.competencia, rubrica: "IRRF", valor: -r.irrfMes },
    ]);
    rows.push(
      { competencia: "Rescisão", rubrica: "Aviso-prévio", valor: summary.avisoPrevio },
      { competencia: "Rescisão", rubrica: "13º proporcional", valor: summary.decimoTerceiroProp },
      { competencia: "Rescisão", rubrica: "Férias proporcionais", valor: summary.feriasProp },
      { competencia: "Rescisão", rubrica: "1/3 constitucional", valor: summary.tercoFerias },
      { competencia: "Rescisão", rubrica: "Multa art. 477", valor: summary.multa477 },
      { competencia: "Rescisão", rubrica: "Multa art. 467", valor: summary.multa467 },
      { competencia: "Rescisão", rubrica: "FGTS reflexos", valor: summary.fgtsReflexos },
      { competencia: "Rescisão", rubrica: "Base da multa 40% FGTS", valor: summary.baseMulta40 },
      { competencia: "Rescisão", rubrica: "Multa de 40% FGTS", valor: summary.multa40 },
      { competencia: "Consolidação", rubrica: "Valor bruto", valor: summary.bruto },
      { competencia: "Consolidação", rubrica: "Descontos (INSS+IRRF)", valor: -summary.descontos },
      { competencia: "Consolidação", rubrica: "Crédito líquido", valor: summary.liquido },
      { competencia: "Consolidação", rubrica: "Correção monetária (IPCA-E por competência)", valor: summary.correcaoTotal },
      { competencia: "Consolidação", rubrica: "Juros (1% a.m. desde ajuizamento)", valor: summary.jurosTotal },
      { competencia: "Consolidação", rubrica: "TOTAL ATUALIZADO", valor: summary.totalAtualizado },
    );
    return rows;
  }, [eventResults, summary]);

  const addCompetencia = () => setCompetencias((prev) => [...prev, {
    competencia: `2025-${String(prev.length + 1).padStart(2, "0")}`,
    salarioBase: salarioRescisorio || 3000, diasTrabalhados: 30, diasUteis: 22,
    diasDescanso: 8, horasExtras50: 0, horasExtras100: 0, adicionalNoturnoHoras: 0,
    adicionalNoturnoPct: 20, insalubridadePct: 0, periculosidade: false,
    comissoes: 0, gratificacao: 0, faltasDias: 0,
  }]);

  const mesesPrevistos = React.useMemo(() => {
    if (!admissionDate || !terminationDate) return 0;
    const adm = new Date(admissionDate + "T12:00:00");
    const ter = new Date(terminationDate + "T12:00:00");
    if (ter <= adm) return 0;
    return (ter.getFullYear() - adm.getFullYear()) * 12 + (ter.getMonth() - adm.getMonth()) + 1;
  }, [admissionDate, terminationDate]);

  const handleAbrirGerarModal = () => {
    setGerarErro("");
    const refSal = salarioRescisorio > 0
      ? salarioRescisorio
      : (competencias.find(c => c.salarioBase > 0)?.salarioBase ?? 0);
    setSalarioRefInput(refSal > 0 ? String(refSal) : "");
    setShowGerarModal(true);
  };

  const handleConfirmarGerar = () => {
    if (!admissionDate || !terminationDate) {
      setGerarErro("Preencha as datas de admissão e rescisão na aba Contrato.");
      return;
    }
    const adm = new Date(admissionDate + "T12:00:00");
    const ter = new Date(terminationDate + "T12:00:00");
    if (ter <= adm) {
      setGerarErro("A data de rescisão deve ser posterior à data de admissão.");
      return;
    }
    const sal = parseNum(salarioRefInput);
    if (sal <= 0) {
      setGerarErro("Informe um salário de referência válido (valor maior que zero).");
      return;
    }
    const novas = gerarCompetenciasAuto(admissionDate, terminationDate, sal);
    if (novas.length === 0) {
      setGerarErro("Nenhuma competência pôde ser gerada com as datas informadas.");
      return;
    }
    setCompetencias(novas);
    setShowGerarModal(false);
    setTab("salarios");
  };

  const removeCompetencia = (index: number) =>
    setCompetencias((prev) => prev.filter((_, i) => i !== index));

  const updateCompetencia = (index: number, field: keyof MonthlyInput, value: string | number | boolean) =>
    setCompetencias((prev) => prev.map((item, i) => {
      if (i !== index) return item;
      return { ...item, [field]: typeof value === "boolean" ? value : field === "competencia" ? value : parseNum(value as string) } as MonthlyInput;
    }));

  const handleCalcular = useCallback(async () => {
    if (!creditoDebitado) {
      const ok = await debitCredits(5, "Cálculo Trabalhista PJe-Calc");
      if (!ok) return;
      setCreditoDebitado(true);
    }
    setTab("resultado");
  }, [creditoDebitado, debitCredits]);

  const handleGeneratePdf = useCallback(async () => {
    const logoSrc = window.location.origin + veritasLogoUrl;
    const html = gerarLaudoHtml({
      processo, vara, reclamante, reclamada, cargo, salaryType,
      admissionDate, terminationDate, terminationType, summary, eventResults,
      observacoesTecnicas, fgtsDepositadoComprovado,
      salarioMinimo, insalubrBase, mesesAviso,
      indiceAtualizacao, regraJuros, dataAjuizamento, dataFinalCalculo,
      logoSrc,
    });
    const popup = window.open("", "_blank", "width=1100,height=900");
    if (!popup) {
      toast({ title: "Popup bloqueado", description: "Permita popups para este site e tente novamente.", variant: "destructive" });
      return;
    }
    popup.document.open();
    popup.document.write(html);
    popup.document.close();

    setSavingPdf(true);
    try {
      const calcState = {
        processo, vara, reclamante, reclamada, cargo, salaryType,
        admissionDate, terminationDate, terminationType, divisor, mesesAviso,
        aplicarMulta477, aplicarMulta467, indiceAtualizacao, regraJuros,
        dataAjuizamento, dataFinalCalculo, observacoesTecnicas,
        competencias, fgtsDepositadoComprovado, salarioMinimo, insalubrBase,
      };
      const r = await fetch(`${BASE}/api/civil/save`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ calcState, modulo: "trabalhista" }),
      });
      if (r.ok) {
        const b = await r.json();
        setChaveGerada(b.publicKey);
        try {
          const el = popup.document.getElementById("laudo-chave");
          if (el) el.innerHTML = `<div class="vr-title-bar-title">Laudo de Cálculo Trabalhista — ${processo || "Processo não informado"}</div><div class="vr-title-bar-chave">Chave: ${b.publicKey}</div>`;
          const elF = popup.document.getElementById("laudo-chave-footer");
          if (elF) elF.textContent = `Chave: ${b.publicKey}`;
        } catch { /* popup fechado pelo usuário */ }
      }
    } catch { /* salva em background; continua */ }
    setSavingPdf(false);
  }, [
    processo, vara, reclamante, reclamada, cargo, salaryType,
    admissionDate, terminationDate, terminationType, summary, eventResults,
    observacoesTecnicas, fgtsDepositadoComprovado, salarioMinimo, insalubrBase,
    mesesAviso, indiceAtualizacao, regraJuros, dataAjuizamento, dataFinalCalculo,
    competencias, divisor, aplicarMulta477, aplicarMulta467,
  ]);

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
      if (s?.processo)            setProcesso(s.processo);
      if (s?.vara)                setVara(s.vara);
      if (s?.reclamante)          setReclamante(s.reclamante);
      if (s?.reclamada)           setReclamada(s.reclamada);
      if (s?.cargo)               setCargo(s.cargo);
      if (s?.salaryType)          setSalaryType(s.salaryType);
      if (s?.admissionDate)       setAdmissionDate(s.admissionDate);
      if (s?.terminationDate)     setTerminationDate(s.terminationDate);
      if (s?.terminationType)     setTerminationType(s.terminationType);
      if (s?.divisor !== undefined)    setDivisor(s.divisor);
      if (s?.mesesAviso !== undefined) setMesesAviso(s.mesesAviso);
      if (s?.indiceAtualizacao)   setIndiceAtualizacao(s.indiceAtualizacao);
      if (s?.regraJuros)          setRegraJuros(s.regraJuros);
      if (s?.dataAjuizamento)     setDataAjuizamento(s.dataAjuizamento);
      if (s?.dataFinalCalculo)    setDataFinalCalculo(s.dataFinalCalculo);
      if (s?.observacoesTecnicas !== undefined) setObservacoesTecnicas(s.observacoesTecnicas);
      if (s?.competencias?.length)  setCompetencias(s.competencias);
      if (s?.fgtsDepositadoComprovado !== undefined) setFgtsDepositadoComprovado(s.fgtsDepositadoComprovado);
      if (s?.salarioMinimo !== undefined)  setSalarioMinimo(s.salarioMinimo);
      if (s?.insalubrBase)        setInsalubrBase(s.insalubrBase);
      if (s?.aplicarMulta477 !== undefined) setAplicarMulta477(s.aplicarMulta477);
      if (s?.aplicarMulta467 !== undefined) setAplicarMulta467(s.aplicarMulta467);
      setChaveGerada(b.publicKey);
      setInputChave("");
      setTab("contrato");
      toast({ title: "Cálculo recuperado!", description: `Chave: ${b.publicKey}` });
    } catch (e: any) {
      toast({ title: "Erro ao recuperar", description: e.message, variant: "destructive" });
    } finally {
      setLoadingRecover(false);
    }
  }, [inputChave, toast]);

  if (!hasAccess(planSlug, "mod:trabalhista", isAdmin)) {
    const req = PLAN_MIN["mod:trabalhista"] ?? "profissional";
    return <UpgradeGate planRequired={PLAN_LABEL[req] ?? req} />;
  }

  const TABS = [
    ["contrato", "Contrato"],
    ["salarios", "Salários"],
    ["jornada", "Jornada"],
    ["eventos", "Eventos"],
    ["reflexos", "Reflexos"],
    ["encargos", "Encargos"],
    ["atualizacao", "Atualização"],
    ["resultado", "Resultado"],
    ["insalubridade", "Insalubridade & Perc."],
    ["horas-extras", "Horas Extras"],
  ] as const;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/15 flex items-center justify-center flex-shrink-0">
            <Scale className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Cálculo Trabalhista</h1>
            <p className="text-sm text-muted-foreground">
              Apuração por competência — Metodologia PJe-Calc · CLT 2025
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {tab !== "insalubridade" && tab !== "horas-extras" && loadingRecover && (
            <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1.5 text-xs text-blue-700">
              Recuperando cálculo…
            </div>
          )}
          {/* Controles do PJe-Calc — ocultos nas abas Insalubridade e Horas Extras */}
          {tab !== "insalubridade" && tab !== "horas-extras" && (
            <>
              <div className="flex items-center gap-1.5">
                <Input
                  placeholder="Chave de recuperação"
                  value={inputChave}
                  onChange={e => setInputChave(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleRecoverCalculo()}
                  className="h-8 text-xs w-48"
                />
                <Button size="sm" variant="outline" className="h-8 px-2.5 gap-1" onClick={handleRecoverCalculo} disabled={loadingRecover}>
                  <RotateCcw size={13} />
                </Button>
              </div>
              {chaveGerada && (
                <div className="rounded-md bg-slate-50 border border-slate-200 px-2.5 py-1.5 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                    <Key size={10} /> Chave de Recuperação
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono font-bold text-[#17365d] tracking-wider">{chaveGerada}</code>
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-700 border border-slate-200 hover:bg-slate-100 transition"
                      onClick={() => { navigator.clipboard.writeText(chaveGerada!); toast({ title: "Chave copiada!" }); }}
                    >📋</button>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-tight">Use esta chave para recuperar o cálculo a qualquer momento</p>
                </div>
              )}
              {creditoDebitado && (
                <Badge variant="secondary" className="text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                  Cálculo ativo
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={() => {
                setCreditoDebitado(false);
                setChaveGerada(null);
                setInputChave("");
                setTab("contrato");
                setProcesso("");
                setVara("");
                setReclamante("");
                setReclamada("");
                setCargo("");
                setSalaryType("mensalista");
                setAdmissionDate("");
                setTerminationDate("");
                setTerminationType("sem_justa_causa");
                setDivisor(220);
                setMesesAviso(1);
                setAplicarMulta477(false);
                setAplicarMulta467(false);
                setIndiceAtualizacao("IPCA-E");
                setRegraJuros("1%_mes");
                setDataAjuizamento("");
                setDataFinalCalculo((() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })());
                setObservacoesTecnicas("");
                setCompetencias([blankCompetencia()]);
                setFgtsDepositadoComprovado(0);
                setSalarioMinimo(1518.00);
                setInsalubrBase("salario_minimo");
              }}>
                Novo cálculo
              </Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-500 gap-1.5" onClick={handleCalcular}>
                <Calculator className="w-4 h-4" />
                {creditoDebitado ? "Ver resultado" : "Calcular (5 créditos)"}
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleGeneratePdf} disabled={savingPdf}>
                <FileText className="w-4 h-4" /> {savingPdf ? "Salvando…" : "Gerar Laudo PDF"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* Left: tabs */}
        <div className="space-y-4">
          {/* Process info bar — oculta nas abas Insalubridade e Horas Extras */}
          {tab !== "insalubridade" && tab !== "horas-extras" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Reclamante", value: reclamante },
              { label: "Reclamada", value: reclamada },
              { label: "Cargo", value: cargo },
              { label: "Rescisão", value: { sem_justa_causa: "Sem justa causa", justa_causa: "Justa causa", pedido_demissao: "Pedido de demissão" }[terminationType] },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-border bg-muted/30 px-4 py-2.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
                <p className="text-sm font-semibold mt-0.5 truncate">{value}</p>
              </div>
            ))}
          </div>
          )}

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex flex-wrap h-auto gap-1 p-1 bg-muted rounded-xl">
              {TABS.map(([key, label]) => (
                <TabsTrigger key={key} value={key}
                  className="rounded-lg text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── CONTRATO ── */}
            <TabsContent value="contrato" className="mt-4 space-y-4">
              <SectionCard title="Dados do processo e contrato">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Número do processo" value={processo} onChange={setProcesso} />
                  <Field label="Vara" value={vara} onChange={setVara} />
                  <Field label="Reclamante" value={reclamante} onChange={setReclamante} />
                  <Field label="Reclamada" value={reclamada} onChange={setReclamada} />
                  <Field label="Cargo" value={cargo} onChange={setCargo} />
                  <SelectField label="Tipo de remuneração" value={salaryType} onChange={setSalaryType}
                    options={[["mensalista","Mensalista"],["horista","Horista"],["comissionista","Comissionista"],["misto","Misto"]]} />
                  <Field label="Data de admissão" type="date" value={admissionDate} onChange={setAdmissionDate} />
                  <Field label="Data de demissão" type="date" value={terminationDate} onChange={setTerminationDate} />
                  <SelectField label="Tipo de rescisão" value={terminationType} onChange={setTerminationType}
                    options={[["sem_justa_causa","Sem justa causa"],["justa_causa","Justa causa"],["pedido_demissao","Pedido de demissão"]]} />
                  <Field label="Divisor de horas" type="number" value={String(divisor)} onChange={(v) => setDivisor(parseNum(v))} />
                  {/* ── AVISO-PRÉVIO COM CALCULADORA LEI 12.506/2011 ── */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Meses de aviso-prévio</Label>
                    <div className="flex gap-2">
                      <Input type="number" step="0.1" value={String(mesesAviso)}
                        onChange={(e) => setMesesAviso(parseNum(e.target.value))} className="h-9 text-sm flex-1" />
                      <button type="button" title="Calcular automaticamente pela Lei 12.506/2011"
                        onClick={() => {
                          const r = calcAvisoPrevioLei12506(admissionDate, terminationDate);
                          setMesesAviso(r.meses);
                        }}
                        className="h-9 px-3 rounded-md border border-input bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold whitespace-nowrap transition-colors">
                        Lei 12.506
                      </button>
                    </div>
                    {admissionDate && terminationDate && (() => {
                      const r = calcAvisoPrevioLei12506(admissionDate, terminationDate);
                      return (
                        <p className="text-[10px] text-muted-foreground">
                          Lei 12.506/11: <strong>{r.dias} dias</strong> ({r.meses} meses) — 30 dias base + 3 dias/ano acima de 1 ano, máx. 90 dias.
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </SectionCard>

              {/* ── PARÂMETROS TRT-3 2026/1 ── */}
              <SectionCard title="Parâmetros — Manual TRT-3 2026/1">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Salário mínimo vigente (R$)
                    </Label>
                    <Input type="number" step="0.01" value={String(salarioMinimo)}
                      onChange={(e) => setSalarioMinimo(parseNum(e.target.value))} className="h-9 text-sm" />
                    <p className="text-[10px] text-muted-foreground">
                      CLT Art. 192 + Súmula 17 TST — base de cálculo da insalubridade (regra geral).
                    </p>
                  </div>
                  <SelectField
                    label="Base de cálculo da insalubridade"
                    value={insalubrBase}
                    onChange={(v) => setInsalubrBase(v as "salario_minimo" | "salario_base")}
                    options={[
                      ["salario_minimo", "Salário mínimo (regra geral — Súmula 17 TST)"],
                      ["salario_base", "Salário contratual (por CCT/ACT)"],
                    ]}
                  />
                </div>
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 leading-relaxed">
                  <strong>Atenção:</strong> Insalubridade calculada sobre o salário mínimo (R$ {currency(salarioMinimo)}) conforme regra geral do Tribunal. Altere a base apenas quando houver previsão em Norma Coletiva (CCT/ACT). A média de variáveis inclui insalubridade e periculosidade habituais, nos termos do Manual TRT-3 2026/1.
                </div>
              </SectionCard>
              <div className="grid gap-4 md:grid-cols-2">
                <SectionCard title="Multas rescisórias">
                  <div className="space-y-3">
                    <ToggleRow label="Multa art. 477 da CLT" checked={aplicarMulta477} onChange={setAplicarMulta477} />
                    <ToggleRow label="Multa art. 467 da CLT" checked={aplicarMulta467} onChange={setAplicarMulta467} />
                  </div>
                </SectionCard>
                <SectionCard title="Observações técnicas do laudo">
                  <textarea value={observacoesTecnicas} onChange={(e) => setObservacoesTecnicas(e.target.value)}
                    className="min-h-[120px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
                </SectionCard>
              </div>
            </TabsContent>

            {/* ── SALÁRIOS ── */}
            <TabsContent value="salarios" className="mt-4">
              <SectionCard title="Evolução salarial por competência">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {competencias.length > 0 && competencias[0].competencia !== "" && (
                      <span className="rounded-md bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1 font-medium">
                        {competencias.length} competência{competencias.length !== 1 ? "s" : ""} cadastrada{competencias.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleAbrirGerarModal}
                      className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50"
                      title="Gera automaticamente as competências com base nas datas do contrato">
                      <Wand2 className="w-4 h-4" /> Gerar automaticamente
                    </Button>
                    <Button size="sm" onClick={addCompetencia} className="gap-1.5">
                      <Plus className="w-4 h-4" /> Adicionar competência
                    </Button>
                  </div>
                </div>
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {["Competência","Salário","Dias trab.","Dias úteis","Descanso","Comissões","Gratif.","Faltas",""].map((h) => (
                          <TableHead key={h} className="whitespace-nowrap text-xs">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {competencias.map((c, idx) => (
                        <TableRow key={`${c.competencia}-${idx}`}>
                          <TableCell><Input value={c.competencia} onChange={(e) => updateCompetencia(idx, "competencia", e.target.value)} className="h-8 w-24 text-xs" /></TableCell>
                          <TableCell><Input type="number" value={c.salarioBase} onChange={(e) => updateCompetencia(idx, "salarioBase", e.target.value)} className="h-8 w-24 text-xs" /></TableCell>
                          <TableCell><Input type="number" value={c.diasTrabalhados} onChange={(e) => updateCompetencia(idx, "diasTrabalhados", e.target.value)} className="h-8 w-16 text-xs" /></TableCell>
                          <TableCell><Input type="number" value={c.diasUteis} onChange={(e) => updateCompetencia(idx, "diasUteis", e.target.value)} className="h-8 w-16 text-xs" /></TableCell>
                          <TableCell><Input type="number" value={c.diasDescanso} onChange={(e) => updateCompetencia(idx, "diasDescanso", e.target.value)} className="h-8 w-16 text-xs" /></TableCell>
                          <TableCell><Input type="number" value={c.comissoes} onChange={(e) => updateCompetencia(idx, "comissoes", e.target.value)} className="h-8 w-24 text-xs" /></TableCell>
                          <TableCell><Input type="number" value={c.gratificacao} onChange={(e) => updateCompetencia(idx, "gratificacao", e.target.value)} className="h-8 w-24 text-xs" /></TableCell>
                          <TableCell><Input type="number" value={c.faltasDias} onChange={(e) => updateCompetencia(idx, "faltasDias", e.target.value)} className="h-8 w-16 text-xs" /></TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeCompetencia(idx)} className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </SectionCard>
            </TabsContent>

            {/* ── JORNADA ── */}
            <TabsContent value="jornada" className="mt-4">
              <SectionCard title="Jornada, adicionais e variáveis por competência">
                <div className="space-y-4">
                  {competencias.map((c, idx) => (
                    <div key={`${c.competencia}-j`} className="rounded-xl border border-border bg-muted/20 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="secondary" className="font-mono">{c.competencia}</Badge>
                        <span className="text-xs text-muted-foreground">Valor-hora: {currency(c.salarioBase / divisor)}</span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <Field label="HE 50%" type="number" value={String(c.horasExtras50)} onChange={(v) => updateCompetencia(idx, "horasExtras50", v)} />
                        <Field label="HE 100%" type="number" value={String(c.horasExtras100)} onChange={(v) => updateCompetencia(idx, "horasExtras100", v)} />
                        <Field label="Horas noturnas" type="number" value={String(c.adicionalNoturnoHoras)} onChange={(v) => updateCompetencia(idx, "adicionalNoturnoHoras", v)} />
                        <Field label="% adicional noturno" type="number" value={String(c.adicionalNoturnoPct)} onChange={(v) => updateCompetencia(idx, "adicionalNoturnoPct", v)} />
                        <Field label="% insalubridade" type="number" value={String(c.insalubridadePct)} onChange={(v) => updateCompetencia(idx, "insalubridadePct", v)} />
                        <SelectField label="Periculosidade" value={c.periculosidade ? "sim" : "nao"} onChange={(v) => updateCompetencia(idx, "periculosidade", v === "sim")}
                          options={[["nao","Não"],["sim","Sim (30%)"]]} />
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </TabsContent>

            {/* ── EVENTOS ── */}
            <TabsContent value="eventos" className="mt-4">
              <SectionCard title="Eventos calculados por competência">
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {["Comp.","Saldo","Comissões","Gratif.","HE 50%","HE 100%","DSR HE","Ad. not.","Insal.","Peric.","Faltas","Total mês"].map((h) => (
                          <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eventResults.map((r) => (
                        <TableRow key={r.competencia}>
                          <TableCell className="font-mono text-xs">{r.competencia}</TableCell>
                          <TableCell className="text-xs">{currency(r.saldoSalario)}</TableCell>
                          <TableCell className="text-xs">{currency(r.comissoes)}</TableCell>
                          <TableCell className="text-xs">{currency(r.gratificacao)}</TableCell>
                          <TableCell className="text-xs">{currency(r.horasExtras50Valor)}</TableCell>
                          <TableCell className="text-xs">{currency(r.horasExtras100Valor)}</TableCell>
                          <TableCell className="text-xs">{currency(r.dsrHorasExtras)}</TableCell>
                          <TableCell className="text-xs">{currency(r.adicionalNoturnoValor)}</TableCell>
                          <TableCell className="text-xs">{currency(r.insalubridadeValor)}</TableCell>
                          <TableCell className="text-xs">{currency(r.periculosidadeValor)}</TableCell>
                          <TableCell className="text-xs text-red-500">-{currency(r.descontoFaltas)}</TableCell>
                          <TableCell className="text-xs font-semibold text-blue-600">{currency(r.remuneracaoMensal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </SectionCard>
            </TabsContent>

            {/* ── REFLEXOS ── */}
            <TabsContent value="reflexos" className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <MetricBadge label="Média de variáveis" value={currency(summary.mediaVariaveis)} color="blue" />
                <MetricBadge label="Aviso-prévio" value={currency(summary.avisoPrevio)} color="blue" />
                <MetricBadge label="13º proporcional" value={currency(summary.decimoTerceiroProp)} color="blue" />
                <MetricBadge label="Férias + 1/3" value={currency(summary.feriasProp + summary.tercoFerias)} color="blue" />
              </div>
              <SectionCard title="Resumo dos reflexos rescisórios">
                <div className="grid gap-3 md:grid-cols-3 mb-4">
                  {[
                    ["Ávos de 13º", String(summary.avos13)],
                    ["Ávos de férias", String(summary.avosFerias)],
                    ["Multa art. 477", currency(summary.multa477)],
                    ["Multa art. 467", currency(summary.multa467)],
                    ["Férias proporcionais", currency(summary.feriasProp)],
                    ["1/3 constitucional", currency(summary.tercoFerias)],
                  ].map(([t, v]) => (
                    <div key={t} className="rounded-lg border border-border bg-muted/20 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t}</p>
                      <p className="text-sm font-semibold mt-1">{v}</p>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="flex items-center justify-between pt-3">
                  <span className="text-sm font-medium text-muted-foreground">Total de reflexos</span>
                  <span className="text-xl font-bold text-blue-600">{currency(summary.reflexos)}</span>
                </div>
              </SectionCard>
            </TabsContent>

            {/* ── ENCARGOS ── */}
            <TabsContent value="encargos" className="mt-4 space-y-4">
              {/* Banner de vigência das tabelas fiscais */}
              <div className="flex flex-wrap gap-2 items-center text-xs p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800">
                <span className="font-semibold">Tabelas fiscais vigentes:</span>
                {taxLoading ? (
                  <span className="italic text-blue-500">carregando…</span>
                ) : (
                  <>
                    <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 bg-white">
                      INSS: {inssTable?.label ?? "2025 (fallback)"}
                    </Badge>
                    <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 bg-white">
                      IRRF: {irrfTable?.label ?? "2025 (fallback)"}
                    </Badge>
                  </>
                )}
                <span className="ml-auto text-blue-500 italic">Atualizáveis pelo administrador</span>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <MetricBadge label="FGTS principal" value={currency(summary.fgtsPrincipal)} color="emerald" />
                <MetricBadge label="FGTS reflexos" value={currency(summary.fgtsReflexos)} color="emerald" />
                <MetricBadge label="Base multa 40%" value={currency(summary.baseMulta40)} color="blue" />
                <MetricBadge label="Multa 40% FGTS" value={currency(summary.multa40)} color="amber" />
              </div>

              {/* Card de base manual da multa de 40% */}
              <SectionCard title="Base da Multa de 40% do FGTS">
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Informe o <strong>saldo total do FGTS</strong> conforme extrato do trabalhador (conta vinculada).
                    Quando preenchido, esse valor é sempre usado como base dos 40% (art. 18, §1º, Lei 8.036/90).
                    Deixe em branco para calcular automaticamente com o FGTS apurado no período ({currency(summary.fgtsTotal)}).
                  </p>
                  <div className="grid md:grid-cols-2 gap-4 items-start">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <Percent className="w-3.5 h-3.5 text-amber-500" />
                        Saldo FGTS (extrato / conta vinculada) (R$)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="0,00 — deixe em branco para usar o FGTS apurado"
                        value={fgtsDepositadoComprovado || ""}
                        onChange={(e) => setFgtsDepositadoComprovado(parseNum(e.target.value))}
                        className="h-9 text-sm"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Inclui depósitos de todo o contrato, inclusive períodos anteriores ao cálculo.
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">FGTS apurado (período)</span>
                        <span className="font-semibold">{currency(summary.fgtsTotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Base da multa de 40%</span>
                        <span className={`font-semibold ${fgtsDepositadoComprovado > 0 ? "text-blue-600" : "text-amber-600"}`}>
                          {currency(summary.baseMulta40)}
                          {fgtsDepositadoComprovado > 0 && <span className="text-[10px] ml-1">(extrato)</span>}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-sm font-semibold">Multa de 40%</span>
                        <span className="text-base font-bold text-amber-600">{currency(summary.multa40)}</span>
                      </div>
                      {fgtsDepositadoComprovado > 0 && (
                        <Badge variant="outline" className={`text-[10px] w-full justify-center ${fgtsDepositadoComprovado > summary.fgtsTotal ? "border-blue-400 text-blue-700 bg-blue-50" : "border-amber-400 text-amber-700 bg-amber-50"}`}>
                          {fgtsDepositadoComprovado > summary.fgtsTotal
                            ? `Saldo extrato superior ao apurado (+${currency(fgtsDepositadoComprovado - summary.fgtsTotal)})`
                            : `Saldo extrato inferior ao apurado (−${currency(summary.fgtsTotal - fgtsDepositadoComprovado)})`}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Encargos por competência">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Competência</TableHead>
                      <TableHead className="text-xs">FGTS (8%)</TableHead>
                      <TableHead className="text-xs">INSS (prog.)</TableHead>
                      <TableHead className="text-xs">IRRF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventResults.map((r) => (
                      <TableRow key={`${r.competencia}-enc`}>
                        <TableCell className="font-mono text-xs">{r.competencia}</TableCell>
                        <TableCell className="text-xs text-emerald-600">{currency(r.fgtsMes)}</TableCell>
                        <TableCell className="text-xs text-red-500">{currency(r.inssMes)}</TableCell>
                        <TableCell className="text-xs text-red-500">{currency(r.irrfMes)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SectionCard>
            </TabsContent>

            {/* ── ATUALIZAÇÃO ── */}
            <TabsContent value="atualizacao" className="mt-4">
              <SectionCard title="Atualização monetária e juros — por competência">
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-blue-700 dark:text-blue-300 flex gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <span>Cada competência é corrigida individualmente pelo índice selecionado. Os juros correm a partir do ajuizamento sobre o valor corrigido de cada parcela (TST, Súmula 439 e OJ-SDI1-304).</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 mb-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Índice de correção monetária</label>
                    <select
                      value={indiceAtualizacao}
                      onChange={e => setIndiceAtualizacao(e.target.value as "IPCA-E" | "SELIC" | "nenhum")}
                      className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="IPCA-E">IPCA-E (IBGE — padrão TRT)</option>
                      <option value="SELIC">SELIC (pós ADC 58/STF — ≥ 18/11/2021)</option>
                      <option value="nenhum">Sem correção monetária</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Regra de juros moratórios</label>
                    <select
                      value={regraJuros}
                      onChange={e => setRegraJuros(e.target.value as "1%_mes" | "SELIC" | "nenhum")}
                      className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="1%_mes">1% a.m. (art. 39 Lei 8.177/91 / Súm. 200 TST)</option>
                      <option value="SELIC">SELIC (conforme ADC 58 STF)</option>
                      <option value="nenhum">Sem juros</option>
                    </select>
                  </div>
                  <Field label="Data do ajuizamento (marco inicial dos juros)" type="date" value={dataAjuizamento} onChange={setDataAjuizamento} />
                  <Field label="Data final do cálculo" type="date" value={dataFinalCalculo} onChange={setDataFinalCalculo} />
                </div>

                {/* Prévia da memória de correção */}
                {indiceAtualizacao !== "nenhum" && dataFinalCalculo && eventResults.length > 0 && (
                  <div className="rounded-lg border overflow-hidden mt-2">
                    <div className="bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Prévia — Correção por competência (IPCA-E acumulado)
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-muted/80">
                          <tr>
                            <th className="text-left px-3 py-2">Competência</th>
                            <th className="text-right px-3 py-2">Principal</th>
                            <th className="text-right px-3 py-2">Fator</th>
                            <th className="text-right px-3 py-2">Corrigido</th>
                            <th className="text-right px-3 py-2">Correção</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eventResults.filter(r => r.remuneracaoMensal > 0).map(r => {
                            const dataFinalYM = dataFinalCalculo.slice(0, 7);
                            const fator = fatorIPCAE(r.competencia, dataFinalYM);
                            const corrigido = round2(r.remuneracaoMensal * fator);
                            return (
                              <tr key={r.competencia} className="border-t border-border/50">
                                <td className="px-3 py-1.5 font-mono">{r.competencia}</td>
                                <td className="px-3 py-1.5 text-right font-mono">{currency(r.remuneracaoMensal)}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-blue-600">{fator.toFixed(6)}</td>
                                <td className="px-3 py-1.5 text-right font-mono">{currency(corrigido)}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-emerald-600">+{currency(round2(corrigido - r.remuneracaoMensal))}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Resumo financeiro da atualização */}
                {dataFinalCalculo && (
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <MetricBadge label="Correção monetária" value={currency(summary.correcaoTotal)} color="blue" />
                    <MetricBadge label="Juros moratórios" value={currency(summary.jurosTotal)} color="amber" />
                    <MetricBadge label="Total atualizado" value={currency(summary.totalAtualizado)} color="emerald" />
                  </div>
                )}
              </SectionCard>
            </TabsContent>

            {/* ── RESULTADO ── */}
            <TabsContent value="resultado" className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <MetricBadge label="Principal" value={currency(summary.totalPrincipal)} color="blue" />
                <MetricBadge label="Reflexos" value={currency(summary.reflexos)} color="blue" />
                <MetricBadge label="FGTS + multa" value={currency(summary.fgtsTotal + summary.multa40)} color="emerald" />
                <MetricBadge label="Crédito líquido" value={currency(summary.liquido)} color="emerald" />
              </div>
              <div className="grid gap-3 md:grid-cols-3 mt-2">
                <MetricBadge label="Correção monetária" value={currency(summary.correcaoTotal)} color="blue" />
                <MetricBadge label="Juros moratórios" value={currency(summary.jurosTotal)} color="amber" />
                <MetricBadge label="Total atualizado" value={currency(summary.totalAtualizado)} color="emerald" />
              </div>
              <SectionCard title="Memória de cálculo consolidada">
                <ScrollArea className="w-full max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Competência</TableHead>
                        <TableHead className="text-xs">Rubrica</TableHead>
                        <TableHead className="text-xs text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {memoryRows.map((row, idx) => (
                        <TableRow key={`${row.competencia}-${row.rubrica}-${idx}`}>
                          <TableCell className="font-mono text-xs">{row.competencia}</TableCell>
                          <TableCell className="text-xs">{row.rubrica}</TableCell>
                          <TableCell className={`text-xs text-right font-medium ${row.valor < 0 ? "text-red-500" : ""}`}>
                            {row.valor < 0 ? `- ${currency(Math.abs(row.valor))}` : currency(row.valor)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </SectionCard>
            </TabsContent>

            {/* ── INSALUBRIDADE & PERICULOSIDADE ── */}
            <TabsContent value="insalubridade" className="mt-4">
              <InsalubridadePericulosidade
                processo={processo}
                vara={vara}
                reclamante={reclamante}
                reclamada={reclamada}
                cargo={cargo}
              />
            </TabsContent>

            {/* ── HORAS EXTRAS & REFLEXOS ── */}
            <TabsContent value="horas-extras" className="mt-4">
              <HorasExtras
                processo={processo}
                vara={vara}
                reclamante={reclamante}
                reclamada={reclamada}
                cargo={cargo}
              />
            </TabsContent>

          </Tabs>
        </div>

        {/* Right sidebar — financial summary */}
        <div className="space-y-4">
          <Card className="sticky top-20 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-500" />
                Resumo Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <SummaryRow label="Principal" value={summary.totalPrincipal} />
              <SummaryRow label="Reflexos rescisórios" value={summary.reflexos} />
              <SummaryRow label="FGTS total" value={summary.fgtsTotal} />
              {summary.multa40 > 0 && <SummaryRow label="Base multa 40%" value={summary.baseMulta40} />}
              {summary.multa40 > 0 && <SummaryRow label="Multa 40% FGTS" value={summary.multa40} />}
              <SummaryRow label="INSS" value={summary.inssTotal} negative />
              <SummaryRow label="IRRF" value={summary.irrfTotal} negative />
              <Separator className="my-3" />
              <SummaryRow label="Valor bruto" value={summary.bruto} strong />
              <SummaryRow label="Valor líquido" value={summary.liquido} strong />
              <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest">Valor atualizado</p>
                <p className="text-2xl font-black text-blue-600 mt-1">{currency(summary.totalAtualizado)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Estimativa simplificada</p>
              </div>
            </CardContent>
          </Card>

          {/* Process info card */}
          <Card className="shadow-sm">
            <CardContent className="pt-4 space-y-2">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Processo</div>
              <p className="text-xs font-mono font-semibold break-all">{processo}</p>
              <Separator />
              <div className="text-xs space-y-1 text-muted-foreground">
                <p><span className="font-medium text-foreground">Admissão:</span> {admissionDate ? new Date(admissionDate + "T12:00").toLocaleDateString("pt-BR") : "—"}</p>
                <p><span className="font-medium text-foreground">Demissão:</span> {terminationDate ? new Date(terminationDate + "T12:00").toLocaleDateString("pt-BR") : "—"}</p>
                <p><span className="font-medium text-foreground">Competências:</span> {competencias.length}</p>
                <p><span className="font-medium text-foreground">Ávos 13º:</span> {summary.avos13}/12</p>
                <p><span className="font-medium text-foreground">Ávos férias:</span> {summary.avosFerias}/12</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── MODAL: Gerar Competências Automaticamente ── */}
      {showGerarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowGerarModal(false)}
          />
          {/* Dialog */}
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-background border border-border shadow-2xl p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center flex-shrink-0">
                  <Wand2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold leading-tight">Gerar competências automaticamente</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Preenche a aba Salários com base nas datas do contrato</p>
                </div>
              </div>
              <button
                onClick={() => setShowGerarModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors mt-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contract summary */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Admissão</span>
                <span className="font-medium font-mono">
                  {admissionDate
                    ? new Date(admissionDate + "T12:00").toLocaleDateString("pt-BR")
                    : <span className="text-red-500">Não informada</span>}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rescisão</span>
                <span className="font-medium font-mono">
                  {terminationDate
                    ? new Date(terminationDate + "T12:00").toLocaleDateString("pt-BR")
                    : <span className="text-red-500">Não informada</span>}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 mt-1">
                <span className="text-muted-foreground">Competências a gerar</span>
                <span className={`font-bold ${mesesPrevistos > 0 ? "text-blue-600" : "text-red-500"}`}>
                  {mesesPrevistos > 0 ? `${mesesPrevistos} mês${mesesPrevistos !== 1 ? "es" : ""}` : "—"}
                </span>
              </div>
            </div>

            {/* Salary input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Salário de referência (R$)
                <span className="ml-1 text-muted-foreground font-normal">— aplicado a todos os meses gerados</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={salarioRefInput}
                onChange={(e) => { setSalarioRefInput(e.target.value); setGerarErro(""); }}
                placeholder="Ex: 3.500,00"
                className="h-10 text-sm"
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground">
                Você poderá editar individualmente cada competência após a geração.
                Comissões, gratificação e faltas são inicializadas em zero.
              </p>
            </div>

            {/* Methodological notes */}
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-800 space-y-1 leading-relaxed">
              <p><strong>Primeiro e último mês:</strong> calculados proporcionalmente às datas do contrato.</p>
              <p><strong>Meses intermediários:</strong> mês completo (dias corridos reais do calendário).</p>
              <p><strong>Dias úteis:</strong> segunda a sexta-feira · <strong>Descanso:</strong> sábados e domingos.</p>
            </div>

            {/* Overwrite warning */}
            {competencias.some(c => c.competencia !== "") && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Existem <strong>{competencias.filter(c => c.competencia !== "").length} competência(s)</strong> já cadastradas.
                  Ao confirmar, elas serão <strong>substituídas</strong> pelas novas competências geradas.
                </span>
              </div>
            )}

            {/* Error */}
            {gerarErro && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{gerarErro}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowGerarModal(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 gap-1.5 bg-blue-600 hover:bg-blue-500"
                onClick={handleConfirmarGerar}
                disabled={mesesPrevistos === 0}
              >
                <Wand2 className="w-4 h-4" />
                {competencias.some(c => c.competencia !== "") ? "Substituir e gerar" : "Gerar competências"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
