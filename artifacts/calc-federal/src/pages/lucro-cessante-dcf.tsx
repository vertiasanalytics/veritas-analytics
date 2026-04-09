import React, { useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AlertTriangle, Download, FileText, Scale, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useDebitCredits } from "@/hooks/use-wallet";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type SensitivityRow = {
  label: string;
  discountRate: number;
  growthRate: number;
  terminalGrowthRate: number;
  npvFlows: number;
  terminalValue: number;
  terminalPV: number;
  totalValue: number;
  validGordon: boolean;
};

type ProjectionRow = {
  t: number;
  year: number;
  fcf: number;
  discountFactor: number;
  pv: number;
};

type InputState = {
  claimant: string;
  processNumber: string;
  baseYear: number;
  firstProjectionYear: number;
  yearsProjected: number;
  initialFCF: number;
  annualGrowthRate: number;
  discountRate: number;
  terminalGrowthRate: number;
  expertPurpose: string;
  technicalResponsible: string;
  legalBasis: string;
  notes: string;
  useTerminalValue: boolean;
  historicalAverageFCF: number;
  linearProjectionReference: number;
};

type CoreResult = {
  projections: ProjectionRow[];
  npvFlows: number;
  terminalValue: number;
  terminalPV: number;
  totalValue: number;
  validGordon: boolean;
  issueFlags: string[];
  riskLevel: "BAIXO" | "MODERADO" | "ALTO";
};

type ExpertConclusion = {
  executiveSummary: string;
  findings: string[];
  legalParameters: string[];
  finalConclusion: string;
};

// ─── Formatadores ─────────────────────────────────────────────────────────────
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number, d = 2) => `${n.toFixed(d)}%`;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ─── Motores de cálculo ───────────────────────────────────────────────────────
function buildDCFProjection(
  initialFCF: number,
  growthRate: number,
  discountRate: number,
  yearsProjected: number,
  firstYear: number,
): ProjectionRow[] {
  const rows: ProjectionRow[] = [];
  for (let t = 1; t <= yearsProjected; t++) {
    const year = firstYear + t - 1;
    const fcf = initialFCF * Math.pow(1 + growthRate / 100, t - 1);
    const discountFactor = 1 / Math.pow(1 + discountRate / 100, t);
    const pv = fcf * discountFactor;
    rows.push({ t, year, fcf: round2(fcf), discountFactor: round2(discountFactor), pv: round2(pv) });
  }
  return rows;
}

function computeCoreResult(input: InputState): CoreResult {
  const projections = buildDCFProjection(
    input.initialFCF, input.annualGrowthRate, input.discountRate,
    input.yearsProjected, input.firstProjectionYear,
  );
  const npvFlows = round2(projections.reduce((acc, row) => acc + row.pv, 0));
  const issueFlags: string[] = [];
  let terminalValue = 0;
  let terminalPV = 0;
  let validGordon = true;

  const lastFCF = projections[projections.length - 1]?.fcf ?? 0;
  const nextFCF = lastFCF * (1 + input.terminalGrowthRate / 100);
  const denominator = input.discountRate - input.terminalGrowthRate;

  if (input.useTerminalValue) {
    if (denominator <= 0) {
      validGordon = false;
      issueFlags.push("A fórmula de Gordon torna-se economicamente inconsistente porque a taxa de desconto é menor ou igual ao crescimento terminal.");
    } else {
      terminalValue = round2(nextFCF / (denominator / 100));
      const factorN = 1 / Math.pow(1 + input.discountRate / 100, input.yearsProjected);
      terminalPV = round2(terminalValue * factorN);
    }
  }

  if (input.discountRate < input.annualGrowthRate)
    issueFlags.push("A taxa de desconto está inferior à taxa de crescimento do fluxo, o que aumenta substancialmente a sensibilidade do resultado.");
  if (input.discountRate <= 0)
    issueFlags.push("A taxa de desconto informada é nula ou negativa, premissa incompatível com o custo de oportunidade normal.");
  if (input.initialFCF <= 0)
    issueFlags.push("O fluxo de caixa inicial é não positivo, exigindo validação documental reforçada.");

  const totalValue = round2(npvFlows + terminalPV);
  const riskScore = issueFlags.length
    + (Math.abs(input.discountRate - input.terminalGrowthRate) <= 1 ? 1 : 0)
    + (input.discountRate <= 2 ? 1 : 0);
  const riskLevel: "BAIXO" | "MODERADO" | "ALTO" = riskScore >= 4 ? "ALTO" : riskScore >= 2 ? "MODERADO" : "BAIXO";

  return { projections, npvFlows, terminalValue, terminalPV, totalValue, validGordon, issueFlags, riskLevel };
}

function buildSensitivityTable(input: InputState): SensitivityRow[] {
  const scenarios = [
    { label: "Conservador",   discountRate: Math.max(input.discountRate + 4, 5), growthRate: Math.max(input.annualGrowthRate - 1, 0), terminalGrowthRate: Math.max(input.terminalGrowthRate - 1, 0) },
    { label: "Moderado",      discountRate: Math.max(input.discountRate + 2, 3), growthRate: input.annualGrowthRate, terminalGrowthRate: Math.min(input.terminalGrowthRate, input.discountRate + 1) },
    { label: "Base do laudo", discountRate: input.discountRate, growthRate: input.annualGrowthRate, terminalGrowthRate: input.terminalGrowthRate },
    { label: "Otimista",      discountRate: Math.max(input.discountRate - 1, 0.5), growthRate: input.annualGrowthRate + 1, terminalGrowthRate: input.terminalGrowthRate + 0.5 },
  ];

  return scenarios.map((scenario) => {
    const projections = buildDCFProjection(input.initialFCF, scenario.growthRate, scenario.discountRate, input.yearsProjected, input.firstProjectionYear);
    const npvFlows = round2(projections.reduce((acc, row) => acc + row.pv, 0));
    const lastFCF = projections[projections.length - 1]?.fcf ?? 0;
    const nextFCF = lastFCF * (1 + scenario.terminalGrowthRate / 100);
    const denominator = scenario.discountRate - scenario.terminalGrowthRate;
    let validGordon = true, terminalValue = 0, terminalPV = 0;

    if (input.useTerminalValue) {
      if (denominator <= 0) {
        validGordon = false;
      } else {
        terminalValue = round2(nextFCF / (denominator / 100));
        const factorN = 1 / Math.pow(1 + scenario.discountRate / 100, input.yearsProjected);
        terminalPV = round2(terminalValue * factorN);
      }
    }
    return { label: scenario.label, discountRate: scenario.discountRate, growthRate: scenario.growthRate, terminalGrowthRate: scenario.terminalGrowthRate, npvFlows, terminalValue, terminalPV, totalValue: round2(npvFlows + terminalPV), validGordon };
  });
}

function buildAlternativeMethodValue(input: InputState): number {
  const averageMethod = input.historicalAverageFCF * input.yearsProjected;
  const linearMethod = input.linearProjectionReference * input.yearsProjected;
  return round2((averageMethod + linearMethod) / 2);
}

function buildExpertConclusion(input: InputState, core: CoreResult, sensitivity: SensitivityRow[], alternativeValue: number): ExpertConclusion {
  const findings: string[] = [];
  const legalParameters: string[] = [];

  findings.push(`O valor presente dos fluxos explicitamente projetados alcança ${BRL.format(core.npvFlows)} para ${input.yearsProjected} período(s), partindo de FCF inicial de ${BRL.format(input.initialFCF)}.`);

  if (input.useTerminalValue) {
    if (core.validGordon)
      findings.push(`O valor terminal bruto foi estimado em ${BRL.format(core.terminalValue)}, com valor presente de ${BRL.format(core.terminalPV)}.`);
    else
      findings.push("O valor terminal foi desconsiderado porque o modelo de Gordon ficou matematicamente inconsistente diante da relação entre taxa de desconto e crescimento terminal.");
  } else {
    findings.push("O valor terminal foi deliberadamente desconsiderado por premissa pericial do caso concreto.");
  }

  findings.push(`A análise de sensibilidade demonstra variação relevante entre cenários, com resultados entre ${BRL.format(Math.min(...sensitivity.map(s => s.totalValue)))} e ${BRL.format(Math.max(...sensitivity.map(s => s.totalValue)))}.`);
  findings.push(`O método alternativo de validação resultou em ${BRL.format(alternativeValue)}, servindo como parâmetro auxiliar de consistência externa.`);
  if (core.issueFlags.length > 0)
    findings.push(`Foram identificados ${core.issueFlags.length} ponto(s) críticos de premissa, elevando o risco pericial para ${core.riskLevel.toLowerCase()}.`);

  legalParameters.push("A apuração do lucro cessante deve observar razoabilidade econômica, aderência documental e coerência entre premissas de crescimento, risco e horizonte de projeção.");
  legalParameters.push("A prova pericial não substitui a valoração judicial, mas oferece base técnico-contábil para aferição de dano emergente, lucro cessante e extensão econômica do prejuízo.");
  legalParameters.push("Premissas extraordinariamente favoráveis ao credor ou ao devedor devem ser testadas em cenários alternativos para reduzir viés e aumentar robustez probatória.");
  if (!core.validGordon && input.useTerminalValue)
    legalParameters.push("Na ausência de consistência econômica do modelo de perpetuidade, a exclusão do valor terminal é tecnicamente justificável para evitar superavaliação artificial do quantum.");

  const executiveSummary = [
    `Síntese pericial: lucro cessante total apurado em ${BRL.format(core.totalValue)}, risco ${core.riskLevel}, taxa de desconto de ${pct(input.discountRate)} e crescimento do FCF de ${pct(input.annualGrowthRate)}.`,
    core.validGordon || !input.useTerminalValue
      ? "O modelo permaneceu operacional nas premissas centrais do laudo."
      : "O modelo de Gordon foi rejeitado nas premissas centrais, com desconsideração do valor terminal.",
  ].join(" ");

  const finalConclusion = [
    `Conclui-se que o valor do lucro cessante, nas premissas centrais adotadas, corresponde a ${BRL.format(core.totalValue)}.`,
    core.validGordon || !input.useTerminalValue
      ? `O resultado considera valor terminal presente de ${BRL.format(core.terminalPV)}, dentro da estrutura do fluxo de caixa descontado.`
      : "O resultado não incorporou valor terminal, em razão de inconsistência econômica no uso da perpetuidade com crescimento.",
    "A robustez do resultado depende especialmente da validação documental do FCF inicial, da taxa de desconto e do crescimento projetado, razão pela qual a leitura pericial deve ser conjugada com a análise de sensibilidade e com o método alternativo de validação.",
    "Sob ótica judicial, o resultado deve ser interpretado como estimativa técnica condicionada, e não como verdade absoluta, preservando-se o contraditório sobre as premissas adotadas.",
  ].join(" ");

  return { executiveSummary, findings, legalParameters, finalConclusion };
}

// ─── Defaults ─────────────────────────────────────────────────────────────────
const defaultInput: InputState = {
  claimant: "Parte autora / requerente",
  processNumber: "0000000-00.2026.4.00.0000",
  baseYear: 2020,
  firstProjectionYear: 2021,
  yearsProjected: 5,
  initialFCF: 3650,
  annualGrowthRate: 2,
  discountRate: 8,
  terminalGrowthRate: 3,
  expertPurpose: "Apuração de lucro cessante para fins de liquidação judicial, com validação por DCF, sensibilidade e método alternativo.",
  technicalResponsible: "Administrador",
  legalBasis: "Código Civil, prova pericial contábil, causalidade econômica do dano, razoabilidade das premissas e contraditório técnico.",
  notes: "Módulo DCF evoluído para uso pericial judicial, com análise crítica das premissas e blindagem contra impugnações.",
  useTerminalValue: true,
  historicalAverageFCF: 3400,
  linearProjectionReference: 3550,
};

// ─── Sub-componentes ───────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function inputCls() {
  return "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-700";
}

function KpiBox({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">{icon}{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function LucroCessanteDCF() {
  const { user } = useAuth();
  const { toast } = useToast();
  const debitCredits = useDebitCredits();
  const [input, setInput] = useState<InputState>(defaultInput);
  const [pdfLoading, setPdfLoading] = useState(false);

  const update = <K extends keyof InputState>(key: K, value: InputState[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const core = useMemo(() => computeCoreResult(input), [input]);
  const sensitivity = useMemo(() => buildSensitivityTable(input), [input]);
  const alternativeValue = useMemo(() => buildAlternativeMethodValue(input), [input]);
  const conclusion = useMemo(
    () => buildExpertConclusion(input, core, sensitivity, alternativeValue),
    [input, core, sensitivity, alternativeValue],
  );

  // ── PDF com jsPDF ──────────────────────────────────────────────────────────
  async function handleGerarPDF() {
    setPdfLoading(true);
    try {
      await debitCredits(5);
    } catch {
      toast({ title: "Saldo insuficiente", description: "Você não tem créditos suficientes para gerar o PDF.", variant: "destructive" });
      setPdfLoading(false);
      return;
    }

    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const blue = [21, 52, 98] as [number, number, number];
      const textClr = [34, 41, 57] as [number, number, number];
      const light = [243, 246, 251] as [number, number, number];

      const drawHeader = (subtitle: string) => {
        doc.setFillColor(...blue);
        doc.rect(0, 0, 210, 24, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(17);
        doc.text("VERITAS ANALYTICS", 14, 9);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("Plataforma de Cálculos Judiciais Federais", 14, 15);
        doc.text(subtitle, 14, 21);
        doc.text(`Emitido em: ${new Date().toLocaleString("pt-BR")}`, 142, 10);
        doc.text(`Usuário: ${user?.email ?? input.technicalResponsible}`, 142, 16);
        doc.setTextColor(...textClr);
      };

      const sectionTitle = (y: number, title: string) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...blue);
        doc.text(title, 14, y);
        doc.setDrawColor(...blue);
        doc.setLineWidth(0.5);
        doc.line(14, y + 2, 196, y + 2);
        doc.setTextColor(...textClr);
      };

      const writeParagraph = (y: number, value: string): number => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...textClr);
        const lines = doc.splitTextToSize(value, 182);
        if (y + lines.length * 5 > 275) { doc.addPage(); drawHeader("Laudo Pericial — Continuação"); y = 31; }
        doc.text(lines, 14, y);
        return y + lines.length * 5;
      };

      drawHeader("Laudo Pericial — Apuração de Lucro Cessante (DCF Judicial)");
      let y = 31;

      // I — Dados gerais
      sectionTitle(y, "I — DADOS GERAIS DO CÁLCULO");
      y += 6;
      autoTable(doc, {
        startY: y, theme: "grid",
        head: [["Campo", "Informação"]],
        body: [
          ["Cliente / Requerente", input.claimant],
          ["Número do processo", input.processNumber],
          ["Ano-base da projeção", `${input.baseYear}`],
          ["Finalidade", input.expertPurpose],
          ["Responsável técnico", input.technicalResponsible],
          ["Base legal / parâmetros jurídicos", input.legalBasis],
        ],
        styles: { fontSize: 9, cellPadding: 2.1, textColor: textClr as unknown as number[] },
        headStyles: { fillColor: blue as unknown as number[], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: light as unknown as number[] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 5;

      // II — Parâmetros do modelo
      sectionTitle(y, "II — PARÂMETROS DO MODELO");
      y += 6;
      autoTable(doc, {
        startY: y, theme: "grid",
        head: [["Parâmetro", "Valor"]],
        body: [
          ["Fluxo de Caixa Inicial — FCF1", BRL.format(input.initialFCF)],
          ["Crescimento do FCF — g a.a.", pct(input.annualGrowthRate)],
          ["Taxa de desconto — r a.a.", pct(input.discountRate)],
          ["Crescimento terminal — gt a.a.", pct(input.terminalGrowthRate)],
          ["Ano inicial da projeção", `${input.firstProjectionYear}`],
          ["Ano final da projeção", `${input.firstProjectionYear + input.yearsProjected - 1}`],
          ["Valor terminal habilitado", input.useTerminalValue ? "Sim" : "Não"],
          ["FCF histórico médio auxiliar", BRL.format(input.historicalAverageFCF)],
          ["Referência linear auxiliar", BRL.format(input.linearProjectionReference)],
        ],
        styles: { fontSize: 9, cellPadding: 2.1, textColor: textClr as unknown as number[] },
        headStyles: { fillColor: blue as unknown as number[], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: light as unknown as number[] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 5;

      // III — Demonstrativo da projeção
      sectionTitle(y, "III — DEMONSTRATIVO DA PROJEÇÃO");
      y += 6;
      autoTable(doc, {
        startY: y, theme: "grid",
        head: [["t", "Ano", "FCFt (R$)", "Fator de Desconto", "VPt (R$)"]],
        body: core.projections.map((row) => [`${row.t}`, `${row.year}`, BRL.format(row.fcf), row.discountFactor.toFixed(6), BRL.format(row.pv)]),
        styles: { fontSize: 8.5, cellPadding: 1.8, textColor: textClr as unknown as number[] },
        headStyles: { fillColor: blue as unknown as number[], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: light as unknown as number[] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 5;

      // IV — Valor terminal e apuração sintética
      sectionTitle(y, "IV — VALOR TERMINAL E APURAÇÃO SINTÉTICA");
      y += 6;
      autoTable(doc, {
        startY: y, theme: "grid",
        head: [["Item", "Valor"]],
        body: [
          ["Σ Valor Presente dos Fluxos", BRL.format(core.npvFlows)],
          ["Valor Terminal Bruto", BRL.format(core.terminalValue)],
          ["Valor Presente do Terminal", BRL.format(core.terminalPV)],
          ["Lucro Cessante Total", BRL.format(core.totalValue)],
          ["Método alternativo de validação", BRL.format(alternativeValue)],
          ["Validade do Gordon", core.validGordon ? "Válido" : "Inválido / desconsiderado"],
          ["Classificação de risco pericial", core.riskLevel],
        ],
        styles: { fontSize: 9, cellPadding: 2.1, textColor: textClr as unknown as number[] },
        headStyles: { fillColor: blue as unknown as number[], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: light as unknown as number[] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 5;

      if (y > 225) { doc.addPage(); drawHeader("Laudo Pericial — Continuação"); y = 31; }

      // V — Sensibilidade e método alternativo
      sectionTitle(y, "V — ANÁLISE DE SENSIBILIDADE E MÉTODO ALTERNATIVO");
      y += 6;
      autoTable(doc, {
        startY: y, theme: "grid",
        head: [["Cenário", "r", "g", "gt", "Σ VP", "VP Terminal", "Valor Total", "Gordon"]],
        body: sensitivity.map((row) => [
          row.label, pct(row.discountRate), pct(row.growthRate), pct(row.terminalGrowthRate),
          BRL.format(row.npvFlows), BRL.format(row.terminalPV), BRL.format(row.totalValue),
          row.validGordon ? "Válido" : "Inválido",
        ]),
        styles: { fontSize: 8.2, cellPadding: 1.7, textColor: textClr as unknown as number[] },
        headStyles: { fillColor: blue as unknown as number[], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: light as unknown as number[] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
      y = writeParagraph(y, `Método alternativo de validação: ${BRL.format(alternativeValue)}, calculado pela média entre o método histórico auxiliar e a referência linear projetiva informada.`) + 4;

      // VI — Análise crítica e motor pericial
      sectionTitle(y, "VI — ANÁLISE CRÍTICA DAS PREMISSAS E MOTOR PERICIAL");
      y += 6;
      y = writeParagraph(y, `Resumo executivo: ${conclusion.executiveSummary}`) + 2;
      y = writeParagraph(y, "Achados técnicos:") + 1;
      conclusion.findings.forEach((item) => { y = writeParagraph(y, `• ${item}`) + 1; });
      if (core.issueFlags.length > 0) {
        y = writeParagraph(y, "Alertas de premissa:") + 1;
        core.issueFlags.forEach((flag) => { y = writeParagraph(y, `• ${flag}`) + 1; });
      }

      if (y > 235) { doc.addPage(); drawHeader("Laudo Pericial — Continuação"); y = 31; }

      // VII — Conclusão
      sectionTitle(y, "VII — CONCLUSÃO PERICIAL E PARÂMETROS JURÍDICOS");
      y += 6;
      y = writeParagraph(y, "Parâmetros jurídicos considerados:") + 1;
      conclusion.legalParameters.forEach((item) => { y = writeParagraph(y, `• ${item}`) + 1; });
      y += 1;
      y = writeParagraph(y, `Conclusão final: ${conclusion.finalConclusion}`) + 2;
      writeParagraph(y, `Observações técnicas: ${input.notes} O presente laudo tem caráter auxiliar e não dispensa a análise profissional do perito responsável, nem substitui decisão judicial.`);

      doc.setDrawColor(...blue);
      doc.line(14, 282, 196, 282);
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text("Veritas Analytics — Plataforma de Cálculos Judiciais Federais", 14, 288);
      doc.text(`Documento gerado em ${new Date().toLocaleString("pt-BR")}`, 135, 288);

      doc.save("Veritas_DCF_Lucro_Cessante.pdf");
      toast({ title: "PDF gerado com sucesso!", description: "5 créditos debitados. Download iniciado." });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao gerar PDF", description: "Tente novamente.", variant: "destructive" });
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
                Módulo DCF • Nível perito judicial
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">Lucro Cessante com Blindagem Pericial</h1>
              <p className="mt-2 max-w-4xl text-sm text-slate-200">
                Análise de sensibilidade (4 cenários), método alternativo de validação, detecção de inconsistências
                do Gordon, classificação de risco e laudo PDF padrão Veritas com 7 seções estruturadas.
              </p>
            </div>
            <button
              onClick={handleGerarPDF}
              disabled={pdfLoading}
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:scale-[1.01] disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {pdfLoading ? "Gerando…" : "Gerar PDF (5 créditos)"}
            </button>
          </div>
        </div>

        {/* ── Formulários ── */}
        <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
          <Section title="Dados gerais e jurídicos">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Parte / requerente">
                <input className={inputCls()} value={input.claimant} onChange={(e) => update("claimant", e.target.value)} />
              </Field>
              <Field label="Número do processo">
                <input className={inputCls()} value={input.processNumber} onChange={(e) => update("processNumber", e.target.value)} />
              </Field>
              <Field label="Ano-base">
                <input className={inputCls()} type="number" value={input.baseYear} onChange={(e) => update("baseYear", Number(e.target.value))} />
              </Field>
              <Field label="Ano inicial da projeção">
                <input className={inputCls()} type="number" value={input.firstProjectionYear} onChange={(e) => update("firstProjectionYear", Number(e.target.value))} />
              </Field>
              <Field label="Responsável técnico">
                <input className={inputCls()} value={input.technicalResponsible} onChange={(e) => update("technicalResponsible", e.target.value)} />
              </Field>
              <Field label="Períodos projetados">
                <input className={inputCls()} type="number" min="1" max="30" value={input.yearsProjected} onChange={(e) => update("yearsProjected", Number(e.target.value))} />
              </Field>
              <Field label="Finalidade pericial">
                <textarea className={`${inputCls()} min-h-[80px]`} value={input.expertPurpose} onChange={(e) => update("expertPurpose", e.target.value)} />
              </Field>
              <Field label="Base legal / parâmetros jurídicos">
                <textarea className={`${inputCls()} min-h-[80px]`} value={input.legalBasis} onChange={(e) => update("legalBasis", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="Parâmetros econômicos">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="FCF inicial (R$)">
                <input className={inputCls()} type="number" value={input.initialFCF} onChange={(e) => update("initialFCF", Number(e.target.value))} />
              </Field>
              <Field label="Crescimento do FCF — g (% a.a.)">
                <input className={inputCls()} type="number" step="0.01" value={input.annualGrowthRate} onChange={(e) => update("annualGrowthRate", Number(e.target.value))} />
              </Field>
              <Field label="Taxa de desconto — r (% a.a.)">
                <input className={inputCls()} type="number" step="0.01" value={input.discountRate} onChange={(e) => update("discountRate", Number(e.target.value))} />
              </Field>
              <Field label="Crescimento terminal — gt (% a.a.)">
                <input className={inputCls()} type="number" step="0.01" value={input.terminalGrowthRate} onChange={(e) => update("terminalGrowthRate", Number(e.target.value))} />
              </Field>
              <Field label="FCF histórico médio auxiliar (R$)">
                <input className={inputCls()} type="number" value={input.historicalAverageFCF} onChange={(e) => update("historicalAverageFCF", Number(e.target.value))} />
              </Field>
              <Field label="Referência linear auxiliar (R$)">
                <input className={inputCls()} type="number" value={input.linearProjectionReference} onChange={(e) => update("linearProjectionReference", Number(e.target.value))} />
              </Field>
              <Field label="Usar valor terminal (Gordon)">
                <select className={inputCls()} value={input.useTerminalValue ? "SIM" : "NAO"} onChange={(e) => update("useTerminalValue", e.target.value === "SIM")}>
                  <option value="SIM">Sim — inclui perpetuidade</option>
                  <option value="NAO">Não — apenas fluxos explícitos</option>
                </select>
              </Field>
              <Field label="Observações técnicas">
                <textarea className={`${inputCls()} min-h-[80px]`} value={input.notes} onChange={(e) => update("notes", e.target.value)} />
              </Field>
            </div>
          </Section>
        </div>

        {/* ── KPIs ao vivo ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiBox label="Σ VP dos fluxos" value={BRL.format(core.npvFlows)} sub={`${input.yearsProjected} período(s) projetados`} />
          <KpiBox label="VP do terminal" value={BRL.format(core.terminalPV)} sub={core.validGordon ? "Gordon válido" : "Gordon inválido / excluído"} />
          <KpiBox label="Lucro cessante total" value={BRL.format(core.totalValue)} sub={`Método alternativo: ${BRL.format(alternativeValue)}`} />
          <KpiBox
            label="Risco pericial"
            value={core.riskLevel}
            sub={`${core.issueFlags.length} flag${core.issueFlags.length !== 1 ? "s" : ""} detectada${core.issueFlags.length !== 1 ? "s" : ""}`}
            icon={core.riskLevel !== "BAIXO"
              ? <AlertTriangle className="h-4 w-4 text-amber-400" />
              : <ShieldCheck className="h-4 w-4 text-emerald-400" />}
          />
        </div>

        {/* ── Alertas + Conclusão ── */}
        <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
          <Section title="Alertas críticos do modelo">
            <div className="space-y-3 text-sm text-slate-700">
              {core.issueFlags.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <ShieldCheck className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                  <span className="text-emerald-800">Nenhum alerta crítico identificado nas premissas atuais.</span>
                </div>
              ) : core.issueFlags.map((flag, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <span className="text-amber-900">{flag}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Conclusão pericial automatizada">
            <div className="space-y-4 text-sm text-slate-700">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Resumo executivo</p>
                <p className="leading-relaxed">{conclusion.executiveSummary}</p>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Achados técnicos</p>
                <ul className="list-disc space-y-1.5 pl-5">
                  {conclusion.findings.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Conclusão final</p>
                <p className="leading-relaxed">{conclusion.finalConclusion}</p>
              </div>
            </div>
          </Section>
        </div>

        {/* ── Análise de sensibilidade ── */}
        <Section title="Análise de sensibilidade — 4 cenários">
          <div className="overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">Cenário</th>
                  <th className="px-3 py-2 text-right">r</th>
                  <th className="px-3 py-2 text-right">g</th>
                  <th className="px-3 py-2 text-right">gt</th>
                  <th className="px-3 py-2 text-right">Σ VP</th>
                  <th className="px-3 py-2 text-right">VP Terminal</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor Total</th>
                  <th className="px-3 py-2 text-center">Gordon</th>
                </tr>
              </thead>
              <tbody>
                {sensitivity.map((row) => (
                  <tr key={row.label} className={`border-t border-slate-200 ${row.label === "Base do laudo" ? "bg-blue-50 font-medium" : "hover:bg-slate-50"}`}>
                    <td className="px-3 py-2">{row.label}</td>
                    <td className="px-3 py-2 text-right">{pct(row.discountRate)}</td>
                    <td className="px-3 py-2 text-right">{pct(row.growthRate)}</td>
                    <td className="px-3 py-2 text-right">{pct(row.terminalGrowthRate)}</td>
                    <td className="px-3 py-2 text-right">{BRL.format(row.npvFlows)}</td>
                    <td className="px-3 py-2 text-right">{BRL.format(row.terminalPV)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{BRL.format(row.totalValue)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={row.validGordon ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>
                        {row.validGordon ? "Válido" : "Inválido"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <strong>Método alternativo de validação:</strong> {BRL.format(alternativeValue)} — média entre método histórico ({BRL.format(input.historicalAverageFCF * input.yearsProjected)}) e referência linear ({BRL.format(input.linearProjectionReference * input.yearsProjected)}).
          </div>
        </Section>

        {/* ── Demonstrativo da projeção ── */}
        <Section title="Demonstrativo da projeção — fluxos explícitos">
          <div className="max-h-[400px] overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">t</th>
                  <th className="px-3 py-2 text-left">Ano</th>
                  <th className="px-3 py-2 text-right">FCFt (R$)</th>
                  <th className="px-3 py-2 text-right">Fator de Desconto</th>
                  <th className="px-3 py-2 text-right">VPt (R$)</th>
                </tr>
              </thead>
              <tbody>
                {core.projections.map((row) => (
                  <tr key={row.t} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500">{row.t}</td>
                    <td className="px-3 py-2 font-medium">{row.year}</td>
                    <td className="px-3 py-2 text-right">{BRL.format(row.fcf)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{row.discountFactor.toFixed(6)}</td>
                    <td className="px-3 py-2 text-right font-medium">{BRL.format(row.pv)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td className="px-3 py-2" colSpan={4}>Σ Valor Presente dos Fluxos</td>
                  <td className="px-3 py-2 text-right">{BRL.format(core.npvFlows)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── Parâmetros jurídicos ── */}
        <Section title="Parâmetros jurídicos considerados">
          <ul className="space-y-3 text-sm text-slate-700">
            {conclusion.legalParameters.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                {item}
              </li>
            ))}
          </ul>
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
