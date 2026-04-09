import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, ChevronLeft, Plus, Trash2, ClipboardPaste, Users, Calculator, FileText, Download, Copy, CheckCircle2, AlertCircle, Loader2, Upload, FileSpreadsheet, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useDebitCredits } from "@/hooks/use-wallet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  useGetCase,
  useUpdateProcessData,
  useUpdateMonetaryConfig,
  useUpdateInterestConfig,
  useCriteria,
  useInterestRules,
  useAddParty,
  useDeleteParty,
  useAddInstallment,
  usePasteInstallments,
  useDeleteInstallment,
  useUpdateFees,
  useUpdateFinalMetadata,
  useComputeCase,
  useGenerateReport,
} from "@/hooks/use-cases-api";
import { getAuthHeaders } from "@/context/auth-context";

// ─────────────────────────────────────────────────────────────
// Prescrição Quinquenal — Tipos e funções puras
// ─────────────────────────────────────────────────────────────
type WQMode = "integral" | "quinquenio";
interface WQRow { id: string; competencia: string; rubrica: string; valorOriginal: number; total?: number; }
interface WQParsed { year: number; month: number; label: string; date: Date; }
interface WQFiltered extends WQRow { parsed: WQParsed; valorConsiderado: number; status: "EXIGIVEL" | "PRESCRITO"; }
interface WQSummary {
  totalIntegral: number; totalExigivel: number; totalPrescrito: number;
  qtIntegral: number; qtExigivel: number; qtPrescrito: number;
  faixaInicialIntegral?: string; faixaFinalIntegral?: string;
  faixaInicialExigivel?: string; faixaFinalExigivel?: string;
  dataCorte: string | null;
}

const WQ_MLABELS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const WQ_MMAP: Record<string,number> = { jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12 };

function wqLabel(y: number, m: number) { return `${WQ_MLABELS[m-1]}/${y}`; }

function wqParse(s: string): WQParsed | null {
  const raw = s.trim().toLowerCase();
  const iso = raw.match(/^(\d{4})-(\d{2})$/);
  if (iso) { const y=+iso[1],m=+iso[2]; if(m<1||m>12)return null; return {year:y,month:m,label:wqLabel(y,m),date:new Date(y,m-1,1)}; }
  const sl = raw.match(/^(\d{1,2})\/(\d{2}|\d{4})$/);
  if (sl) { const m=+sl[1]; let y=+sl[2]; if(y<100)y+=y>=70?1900:2000; if(m<1||m>12)return null; return {year:y,month:m,label:wqLabel(y,m),date:new Date(y,m-1,1)}; }
  const nm = raw.match(/^([a-zç]{3})\/(\d{2}|\d{4})$/i);
  if (nm) { const m=WQ_MMAP[nm[1]]; let y=+nm[2]; if(y<100)y+=y>=70?1900:2000; if(!m)return null; return {year:y,month:m,label:wqLabel(y,m),date:new Date(y,m-1,1)}; }
  return null;
}

function wqApply(rows: WQRow[], mode: WQMode, ajuizamento: string): { rows: WQFiltered[]; summary: WQSummary } {
  const parsed = rows.map((r,i)=>{ const p=wqParse(r.competencia); return p?{...r,id:String(i+1),parsed:p,valorConsiderado:r.total??r.valorOriginal,status:"EXIGIVEL" as const}:null; }).filter(Boolean) as WQFiltered[];
  parsed.sort((a,b)=>a.parsed.date.getTime()-b.parsed.date.getTime());
  let cutDate: Date|null = null;
  if (mode==="quinquenio" && ajuizamento) {
    const d = new Date(`${ajuizamento}T00:00:00`);
    if (!isNaN(d.getTime())) cutDate = new Date(d.getFullYear()-5, d.getMonth(), 1);
  }
  const result: WQFiltered[] = parsed.map(r=>({ ...r, status: (!cutDate||r.parsed.date.getTime()>=cutDate.getTime())?"EXIGIVEL":"PRESCRITO" }));
  const exig = result.filter(r=>r.status==="EXIGIVEL");
  const presc = result.filter(r=>r.status==="PRESCRITO");
  return {
    rows: result,
    summary: {
      totalIntegral: result.reduce((a,r)=>a+r.valorConsiderado,0),
      totalExigivel: exig.reduce((a,r)=>a+r.valorConsiderado,0),
      totalPrescrito: presc.reduce((a,r)=>a+r.valorConsiderado,0),
      qtIntegral: result.length, qtExigivel: exig.length, qtPrescrito: presc.length,
      faixaInicialIntegral: result[0]?.parsed.label, faixaFinalIntegral: result[result.length-1]?.parsed.label,
      faixaInicialExigivel: exig[0]?.parsed.label, faixaFinalExigivel: exig[exig.length-1]?.parsed.label,
      dataCorte: cutDate ? wqLabel(cutDate.getFullYear(), cutDate.getMonth()+1) : null,
    },
  };
}

function wqParseTsv(text: string): WQRow[] {
  const lines = text.split("\n").map(l=>l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const hasHeader = /data|competencia|competência/i.test(lines[0]);
  return (hasHeader?lines.slice(1):lines).map((line,i)=>{
    const p = line.split(/\t|;/).map(s=>s.trim());
    const v = parseFloat(p[1]?.replace(/R\$/g,"").replace(/\s/g,"").replace(/\./g,"").replace(/,/g,".")||"0");
    return { id:String(i+1), competencia:p[0]||"", rubrica:p[2]||"Diferença", valorOriginal:v, total:v };
  });
}

function wqGroupByRubrica(rows: WQFiltered[]) {
  const m = new Map<string,{integral:number;exigivel:number;prescrito:number}>();
  for (const r of rows) {
    const c = m.get(r.rubrica)||{integral:0,exigivel:0,prescrito:0};
    c.integral += r.valorConsiderado;
    if (r.status==="EXIGIVEL") c.exigivel+=r.valorConsiderado; else c.prescrito+=r.valorConsiderado;
    m.set(r.rubrica,c);
  }
  return Array.from(m.entries()).map(([rubrica,t])=>({rubrica,...t}));
}

const STEPS = [
  { id: 1, title: "Dados do Processo",     subtitle: "Identificação básica"    },
  { id: 2, title: "Correção Monetária",     subtitle: "Índices de atualização"  },
  { id: 3, title: "Juros Moratórios",       subtitle: "Regras de juros"         },
  { id: 4, title: "Partes e Parcelas",      subtitle: "Credores e valores"      },
  { id: 5, title: "Honorários",             subtitle: "Advocatícios"            },
  { id: 6, title: "Sucumbências",           subtitle: "Outras custas"           },
  { id: 7, title: "Prescrição Quinquenal",  subtitle: "Parâmetros de corte"     },
  { id: 8, title: "Dados Finais",           subtitle: "Geração do resultado"    },
];

interface WizardProps {
  params: { id: string };
}

export default function Wizard({ params }: WizardProps) {
  const caseId = parseInt(params.id);
  const [currentStep, setCurrentStep] = useState(1);
  const { data: caseFull, isLoading, isError } = useGetCase(caseId);

  // ── Prescrição Quinquenal state — elevado ao Wizard para sobreviver a trocas de passo
  const [prescMode, setPrescMode] = useState<WQMode>("quinquenio");
  const [prescAjuizamento, setPrescAjuizamento] = useState(
    () => caseFull?.interestConfig?.startDate?.substring(0, 10) || ""
  );
  const [prescUseManual, setPrescUseManual] = useState(false);
  const [prescManualTsv, setPrescManualTsv] = useState("Data\tValor\tRubrica\n");

  const prescAutoRows = useMemo<WQRow[]>(() => {
    const parties = caseFull?.parties;
    if (!parties?.length) return [];
    let idx = 1;
    const rows: WQRow[] = [];
    for (const party of parties) {
      for (const inst of (party.installments || [])) {
        const v = parseFloat(inst.principalAmount || "0");
        rows.push({ id: String(idx++), competencia: inst.period?.substring(0, 7) || "", rubrica: party.name || "Parte", valorOriginal: v, total: v });
      }
    }
    return rows;
  }, [caseFull?.parties]);

  const prescInputRows = prescUseManual ? wqParseTsv(prescManualTsv) : prescAutoRows;

  const { rows: prescDetailedRows, summary: prescSummary } = useMemo(
    () => wqApply(prescInputRows, prescMode, prescAjuizamento),
    [prescInputRows, prescMode, prescAjuizamento]
  );

  const prescGrouped = useMemo(() => wqGroupByRubrica(prescDetailedRows), [prescDetailedRows]);

  const prescMemoria = useMemo(() => {
    if (prescMode === "integral") return "Cálculo integral selecionado. Nenhum recorte prescricional foi aplicado.";
    if (!prescSummary.dataCorte) return "Modo quinquenal selecionado, porém a data de ajuizamento não foi informada de forma válida.";
    return `Recorte técnico quinquenal aplicado a partir de ${prescSummary.dataCorte}, contado retroativamente em 5 anos da data de ajuizamento (${prescAjuizamento}). O sistema não decide controvérsias jurídicas sobre interrupção, suspensão ou afastamento da prescrição.`;
  }, [prescMode, prescSummary.dataCorte, prescAjuizamento]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span>Carregando autos processuais...</span>
      </div>
    );
  }

  if (isError || !caseFull) {
    return (
      <div className="flex flex-col items-center justify-center mt-20 gap-4 text-center">
        <AlertCircle className="w-12 h-12 text-destructive/50" />
        <h2 className="text-xl font-semibold">Processo não encontrado</h2>
        <p className="text-muted-foreground">O caso solicitado não existe ou foi removido.</p>
        <Button variant="outline" onClick={() => window.history.back()}>Voltar</Button>
      </div>
    );
  }

  const handleNext = () => setCurrentStep((p) => Math.min(8, p + 1));
  const handlePrev = () => setCurrentStep((p) => Math.max(1, p - 1));

  const stepComponents: Record<number, React.ReactNode> = {
    1: <Step1Process caseId={caseId} data={caseFull} onNext={handleNext} />,
    2: <Step2Monetary caseId={caseId} data={caseFull} onNext={handleNext} />,
    3: <Step3Interest caseId={caseId} data={caseFull} onNext={handleNext} />,
    4: <Step4Parties caseId={caseId} data={caseFull} onNext={handleNext} />,
    5: <Step5Fees caseId={caseId} data={caseFull} onNext={handleNext} />,
    6: <Step6Succumbencies caseId={caseId} data={caseFull} onNext={handleNext} />,
    7: <Step7Quinquenio
         mode={prescMode} setMode={setPrescMode}
         ajuizamento={prescAjuizamento} setAjuizamento={setPrescAjuizamento}
         useManual={prescUseManual} setUseManual={setPrescUseManual}
         manualTsv={prescManualTsv} setManualTsv={setPrescManualTsv}
         autoRows={prescAutoRows}
         detailedRows={prescDetailedRows}
         summary={prescSummary}
         grouped={prescGrouped}
         memoria={prescMemoria}
         onNext={handleNext}
       />,
    8: <Step8Final
         caseId={caseId}
         data={caseFull}
         prescSummary={prescSummary}
         prescDetailedRows={prescDetailedRows}
         prescMemoria={prescMemoria}
         prescMode={prescMode}
         prescAjuizamento={prescAjuizamento}
       />,
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 pb-8">
      {/* Stepper Sidebar */}
      <aside className="w-full lg:w-60 shrink-0">
        <div className="sticky top-4 space-y-1 bg-card border border-border/50 rounded-2xl shadow-sm p-4">
          <div className="mb-5 px-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Chave Pública</p>
            <p className="font-mono text-sm bg-primary/5 border border-primary/20 text-primary p-2 rounded-lg text-center font-semibold tracking-wide">
              {caseFull.case.publicKey}
            </p>
            <Badge
              className={cn(
                "mt-2 w-full justify-center text-xs",
                caseFull.case.status === "computed"
                  ? "bg-green-100 text-green-700 border-green-200"
                  : caseFull.case.status === "in_progress"
                  ? "bg-blue-100 text-blue-700 border-blue-200"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {caseFull.case.status === "computed"
                ? "Calculado"
                : caseFull.case.status === "in_progress"
                ? "Em andamento"
                : "Rascunho"}
            </Badge>
          </div>

          {STEPS.map((s) => {
            const isActive = currentStep === s.id;
            const isCompleted = currentStep > s.id;
            return (
              <button
                key={s.id}
                onClick={() => setCurrentStep(s.id)}
                className={cn(
                  "w-full text-left flex items-center p-3 rounded-xl transition-all duration-200 group",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md"
                    : isCompleted
                    ? "hover:bg-muted/60 text-foreground"
                    : "opacity-60 hover:opacity-90 hover:bg-muted/40"
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center mr-3 shrink-0 text-xs font-bold",
                    isActive
                      ? "bg-white/20 text-white"
                      : isCompleted
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : s.id}
                </div>
                <div className="min-w-0">
                  <p className={cn("font-semibold text-sm truncate", isActive ? "text-primary-foreground" : "text-foreground")}>
                    {s.title}
                  </p>
                  <p className={cn("text-xs truncate", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {s.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main Form Area */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18 }}
          >
            <Card className="shadow-sm border-border/60">
              <CardHeader className="bg-muted/30 border-b">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    {currentStep}
                  </span>
                  <div>
                    <CardTitle className="text-xl">{STEPS[currentStep - 1].title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">{STEPS[currentStep - 1].subtitle}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 md:p-8">
                {stepComponents[currentStep]}
              </CardContent>
            </Card>

            {/* Navigation Footer */}
            <div className="flex justify-between items-center mt-4 pt-4">
              <Button variant="outline" onClick={handlePrev} disabled={currentStep === 1} size="sm">
                <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              {currentStep < 8 && (
                <Button
                  size="sm"
                  onClick={() => {
                    const btn = document.getElementById(`submit-step-${currentStep}`);
                    if (btn) btn.click();
                    else handleNext();
                  }}
                >
                  {currentStep === 7 ? "Avançar para Cálculo" : "Avançar"} <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ABA 1 — DADOS DO PROCESSO
// ─────────────────────────────────────────────────────────────
function Step1Process({ caseId, data, onNext }: any) {
  const mut = useUpdateProcessData(caseId);
  const { toast } = useToast();
  const [form, setForm] = useState({
    processNumber: data.processData?.processNumber || "",
    claimant: data.processData?.claimant || "",
    defendant: data.processData?.defendant || "",
    agreementPercentage: data.processData?.agreementPercentage || "",
    generalNotes: data.processData?.generalNotes || "",
    isPaymentRequest: data.processData?.isPaymentRequest || false,
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mut.mutate(
      { ...form, agreementPercentage: form.agreementPercentage ? parseFloat(form.agreementPercentage) : null },
      {
        onSuccess: () => {
          toast({ title: "Dados salvos", description: "Informações do processo atualizadas." });
          onNext();
        },
        onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
      }
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-xl border">
        <input
          type="checkbox"
          id="paymentReq"
          checked={form.isPaymentRequest}
          onChange={(e) => setForm({ ...form, isPaymentRequest: e.target.checked })}
          className="w-4 h-4 accent-primary"
        />
        <label htmlFor="paymentReq" className="text-sm font-medium cursor-pointer">
          Gerar demonstrativo para requisição de pagamento (RPV/Precatório)
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="processNumber">Número do Processo</Label>
          <Input
            id="processNumber"
            value={form.processNumber}
            onChange={(e) => setForm({ ...form, processNumber: e.target.value })}
            placeholder="0000000-00.0000.0.00.0000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="agreementPct">Percentual do Acordo (%)</Label>
          <Input
            id="agreementPct"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.agreementPercentage}
            onChange={(e) => setForm({ ...form, agreementPercentage: e.target.value })}
            placeholder="Ex: 100 (para 100% da condenação)"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="claimant">Autor / Exequente</Label>
          <Input
            id="claimant"
            value={form.claimant}
            onChange={(e) => setForm({ ...form, claimant: e.target.value })}
            placeholder="Nome completo do autor"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="defendant">Réu / Executado</Label>
          <Input
            id="defendant"
            value={form.defendant}
            onChange={(e) => setForm({ ...form, defendant: e.target.value })}
            placeholder="Ex: União Federal, INSS"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações Gerais</Label>
        <textarea
          id="notes"
          className="w-full min-h-[100px] rounded-xl border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={form.generalNotes}
          onChange={(e) => setForm({ ...form, generalNotes: e.target.value })}
          placeholder="Anotações internas, observações sobre o processo..."
        />
      </div>

      <button type="submit" id="submit-step-1" className="hidden" />
      <Button type="submit" disabled={mut.isPending} className="w-full md:w-auto">
        {mut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Salvar e Avançar
      </Button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// ABA 2 — CORREÇÃO MONETÁRIA
// ─────────────────────────────────────────────────────────────
function Step2Monetary({ caseId, data, onNext }: any) {
  const mut = useUpdateMonetaryConfig(caseId);
  const { data: criteria } = useCriteria();
  const { toast } = useToast();
  const [form, setForm] = useState({
    criteriaId: data.monetaryConfig?.criteriaId?.toString() || "",
    baseDate: data.monetaryConfig?.baseDate || "",
    applySelic: data.monetaryConfig?.applySelic ?? true,
    applySelicFromCitation: data.monetaryConfig?.applySelicFromCitation ?? false,
    allowDeflation: data.monetaryConfig?.allowDeflation ?? false,
  });

  const selectedCriteria = criteria?.find((c: any) => c.id?.toString() === form.criteriaId);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.criteriaId) {
      toast({ title: "Atenção", description: "Selecione um critério de correção.", variant: "destructive" });
      return;
    }
    mut.mutate(
      { ...form, criteriaId: parseInt(form.criteriaId) },
      {
        onSuccess: () => {
          toast({ title: "Configuração salva", description: "Critério de correção monetária atualizado." });
          onNext();
        },
        onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
      }
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-3">
        <Label className="text-base font-semibold">Critério de Correção Monetária</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {criteria?.map((c: any) => (
            <label
              key={c.id}
              className={cn(
                "cursor-pointer rounded-xl border-2 p-4 transition-all",
                form.criteriaId === c.id?.toString()
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/40"
              )}
            >
              <div className="flex items-center gap-3 mb-1">
                <input
                  type="radio"
                  name="criteria"
                  value={c.id}
                  checked={form.criteriaId === c.id?.toString()}
                  onChange={(e) => setForm({ ...form, criteriaId: e.target.value })}
                  className="w-4 h-4 accent-primary"
                />
                <span className="font-semibold text-sm text-primary">{c.name}</span>
              </div>
              {c.description && (
                <p className="text-xs text-muted-foreground pl-7 leading-relaxed">{c.description}</p>
              )}
            </label>
          ))}
        </div>
      </div>

      {selectedCriteria && selectedCriteria.rules?.length > 0 && (
        <div className="p-4 bg-muted/40 rounded-xl border border-border/60">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Regras do Critério Selecionado
          </p>
          <div className="space-y-2">
            {selectedCriteria.rules.map((r: any, i: number) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <Badge variant="secondary" className="shrink-0 mt-0.5">{r.startDate ? r.startDate.slice(0, 7) : "—"}</Badge>
                <span className="text-foreground font-medium">{r.indexType}</span>
                {r.legalBase && <span className="text-muted-foreground">· {r.legalBase}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="baseDate">Data-Base de Atualização</Label>
          <Input
            id="baseDate"
            type="month"
            required
            value={form.baseDate}
            onChange={(e) => setForm({ ...form, baseDate: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Mês/ano até o qual os valores serão corrigidos.</p>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">Opções Adicionais</Label>
        {[
          { key: "applySelic", label: "Aplicar SELIC a partir de dezembro/2021 (STF RE 870.947)" },
          { key: "applySelicFromCitation", label: "Aplicar SELIC a partir da citação" },
          { key: "allowDeflation", label: "Permitir deflação do valor nominal da parcela" },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
            <input
              type="checkbox"
              id={key}
              checked={(form as any)[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
              className="w-4 h-4 accent-primary"
            />
            <label htmlFor={key} className="text-sm cursor-pointer">{label}</label>
          </div>
        ))}
      </div>

      <button type="submit" id="submit-step-2" className="hidden" />
      <Button type="submit" disabled={mut.isPending} className="w-full md:w-auto">
        {mut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Salvar e Avançar
      </Button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// ABA 3 — JUROS MORATÓRIOS
// ─────────────────────────────────────────────────────────────
function Step3Interest({ caseId, data, onNext }: any) {
  const mut = useUpdateInterestConfig(caseId);
  const { data: rules } = useInterestRules();
  const { toast } = useToast();
  const [form, setForm] = useState({
    interestRuleId: data.interestConfig?.interestRuleId?.toString() || "",
    startDate: data.interestConfig?.startDate || "",
    startEvent: data.interestConfig?.startEvent || "citation",
  });

  const selectedRule = rules?.find((r: any) => r.id?.toString() === form.interestRuleId);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mut.mutate(
      { ...form, interestRuleId: form.interestRuleId ? parseInt(form.interestRuleId) : null },
      {
        onSuccess: () => {
          toast({ title: "Configuração salva", description: "Regra de juros atualizada." });
          onNext();
        },
        onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
      }
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-3">
        <Label htmlFor="interestRule" className="text-base font-semibold">
          Taxa: <span className="text-muted-foreground text-sm font-normal">(selecione a regra de juros moratórios)</span>
        </Label>
        <Select
          value={form.interestRuleId}
          onValueChange={(v) => setForm({ ...form, interestRuleId: v })}
        >
          <SelectTrigger id="interestRule" className="w-full h-11 text-sm">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {rules?.map((r: any) => (
              <SelectItem key={r.id} value={r.id?.toString()}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedRule?.description && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-1">
            <p className="text-sm text-foreground leading-relaxed">{selectedRule.description}</p>
            {selectedRule.legalBasis && (
              <p className="text-xs text-primary/70 font-mono mt-1">{selectedRule.legalBasis}</p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="startDate">Data de Início dos Juros</Label>
          <Input
            id="startDate"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startEvent">Evento Gerador</Label>
          <Select value={form.startEvent} onValueChange={(v) => setForm({ ...form, startEvent: v })}>
            <SelectTrigger id="startEvent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="citation">Citação</SelectItem>
              <SelectItem value="maturity">Vencimento da parcela</SelectItem>
              <SelectItem value="filing">Ajuizamento da ação</SelectItem>
              <SelectItem value="specific_date">Data específica</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <button type="submit" id="submit-step-3" className="hidden" />
      <Button type="submit" disabled={mut.isPending} className="w-full md:w-auto">
        {mut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Salvar e Avançar
      </Button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// ABA 4 — PARTES E PARCELAS
// ─────────────────────────────────────────────────────────────
const SIAPE_WIZARD_KEY = "veritas_siape_wizard_import";

function Step4Parties({ caseId, data, onNext }: any) {
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [isAddingParty, setIsAddingParty] = useState(false);
  const [partyForm, setPartyForm] = useState({ name: "", cpfCnpj: "" });
  const [instTab, setInstTab] = useState<"manual" | "paste" | "csv">("manual");
  const [instForm, setInstForm] = useState({ period: "", principalAmount: "" });
  const [pasteText, setPasteText] = useState("");
  // CSV import state
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows] = useState<{ period: string; amount: number; rawDate: string; rawValue: string; error?: string }[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvImporting, setCsvImporting] = useState(false);

  // SIAPE import state
  const [siapeImport, setSiapeImport] = useState<Array<{ rubrica: string; rows: Array<{ competencia: string; valorOriginal: number }> }> | null>(null);
  const [siapeImporting, setSiapeImporting] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIAPE_WIZARD_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setSiapeImport(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  const { toast } = useToast();
  const [partyToDelete, setPartyToDelete] = useState<any>(null);
  const [instToDelete, setInstToDelete] = useState<{ partyId: number; installmentId: number; period: string; amount: string } | null>(null);

  const handleImportSiape = useCallback(async () => {
    if (!siapeImport?.length) return;
    setSiapeImporting(true);
    const authHeaders = getAuthHeaders();
    let totalRows = 0;
    try {
      for (const entry of siapeImport) {
        // 1. Criar parte (credor) com o nome da rubrica
        const partyRes = await fetch(`/api/cases/${caseId}/parties`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ name: entry.rubrica, cpfCnpj: "" }),
        });
        if (!partyRes.ok) throw new Error(`Erro ao criar parte "${entry.rubrica}"`);
        const { party } = await partyRes.json();

        // 2. Colar parcelas via paste (YYYY-MM\tValor) — usa ponto decimal para não conflitar com o split por vírgula do parser
        const instPasteText = entry.rows
          .map((r) => `${r.competencia}\t${r.valorOriginal.toFixed(2)}`)
          .join("\n");
        const instRes = await fetch(`/api/cases/${caseId}/parties/${party.id}/installments/paste`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ text: instPasteText }),
        });
        if (!instRes.ok) throw new Error(`Erro ao importar parcelas de "${entry.rubrica}"`);
        totalRows += entry.rows.length;
      }
      localStorage.removeItem(SIAPE_WIZARD_KEY);
      setSiapeImport(null);
      toast({
        title: "SIAPE importado com sucesso",
        description: `${siapeImport.length} rubrica(s), ${totalRows} parcela(s) adicionadas.`,
      });
      window.location.reload();
    } catch (err: any) {
      toast({ title: "Erro na importação SIAPE", description: err.message, variant: "destructive" });
    } finally {
      setSiapeImporting(false);
    }
  }, [siapeImport, caseId, toast]);
  const addPartyMut = useAddParty(caseId);
  const deletePartyMut = useDeleteParty(caseId);
  const addInstMut = useAddInstallment(caseId, selectedParty?.id);
  const pasteInstMut = usePasteInstallments(caseId, selectedParty?.id);
  const deleteInstMut = useDeleteInstallment(caseId);

  const confirmDeleteParty = async () => {
    if (!partyToDelete) return;
    try {
      await deletePartyMut.mutateAsync(partyToDelete.id);
      toast({ title: "Parte excluída", description: `"${partyToDelete.name}" e todas as suas parcelas foram removidas.` });
      if (selectedParty?.id === partyToDelete.id) setSelectedParty(null);
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    } finally {
      setPartyToDelete(null);
    }
  };

  const handleDeleteInstallment = async (partyId: number, installmentId: number) => {
    try {
      await deleteInstMut.mutateAsync({ partyId, installmentId });
      toast({ title: "Parcela removida" });
      setInstToDelete(null);
    } catch (err: any) {
      toast({ title: "Erro ao remover parcela", description: err.message, variant: "destructive" });
    }
  };

  const currentParty = data.parties?.find((p: any) => p.id === selectedParty?.id);

  const submitParty = async () => {
    if (!partyForm.name.trim()) return;
    try {
      await addPartyMut.mutateAsync(partyForm);
      setIsAddingParty(false);
      setPartyForm({ name: "", cpfCnpj: "" });
      toast({ title: "Parte cadastrada", description: `${partyForm.name} adicionado(a) ao processo.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const submitInst = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty?.id) return;
    try {
      await addInstMut.mutateAsync({
        period: instForm.period,
        principalAmount: parseFloat(instForm.principalAmount),
      });
      setInstForm({ period: "", principalAmount: "" });
      toast({ title: "Parcela adicionada" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const submitPaste = async () => {
    if (!pasteText.trim() || !selectedParty?.id) return;
    try {
      const res = await pasteInstMut.mutateAsync(pasteText);
      setPasteText("");
      toast({ title: "Parcelas importadas", description: `${res.count || "Várias"} parcela(s) processada(s).` });
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    }
  };

  // ── CSV helpers
  const parseBRNumber = (str: string): number => {
    // Remove R$, spaces, non-breaking spaces; preserve leading minus sign for negatives
    const cleaned = str.replace(/R\$\s*/g, "").replace(/\s/g, "").trim();
    const isNeg = cleaned.startsWith("-");
    const abs = isNeg ? cleaned.slice(1) : cleaned;
    let value: number;
    // If has comma as decimal separator (Brazilian format): 1.500,00
    if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(abs)) {
      value = parseFloat(abs.replace(/\./g, "").replace(",", "."));
    } else if (abs.includes(",")) {
      // General comma-decimal: 1500,50
      value = parseFloat(abs.replace(/\./g, "").replace(",", "."));
    } else {
      // Plain number: 1500.50
      value = parseFloat(abs);
    }
    return isNeg ? -value : value;
  };

  // Mapeamento de meses abreviados em português e inglês
  const PT_MONTHS: Record<string, string> = {
    jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
    jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
    // inglês (fallback)
    feb: "02", apr: "04", may: "05", aug: "08", sep: "09", oct: "10", dec: "12",
  };

  const parseMonthYear = (str: string): string | null => {
    const s = str.trim().toLowerCase();
    // MM/AAAA ou MM-AAAA (ex: 01/2005, 1-2005)
    const m1 = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
    if (m1) return `${m1[2]}-${m1[1].padStart(2, "0")}`;
    // AAAA-MM (ex: 2005-01)
    const m2 = s.match(/^(\d{4})-(\d{2})$/);
    if (m2) return str.trim();
    // MM-AAAA com ano 2 dígitos (ex: 01/93, 1-93)
    const m3 = s.match(/^(\d{1,2})[\/\-](\d{2})$/);
    if (m3) {
      const ano = parseInt(m3[2]);
      const anoFull = ano >= 50 ? `19${m3[2]}` : `20${m3[2]}`;
      return `${anoFull}-${m3[1].padStart(2, "0")}`;
    }
    // Mês abreviado em português: jan/93, jan/1993, jan-93, jan-1993 (ex: "jan/93", "ago/2005")
    const m4 = s.match(/^([a-z]{3})[\/\-](\d{2,4})$/);
    if (m4 && PT_MONTHS[m4[1]]) {
      const ano = m4[2].length === 2
        ? (parseInt(m4[2]) >= 50 ? `19${m4[2]}` : `20${m4[2]}`)
        : m4[2];
      return `${ano}-${PT_MONTHS[m4[1]]}`;
    }
    // Mês abreviado sem separador + ano: "jan93", "jan2005"
    const m5 = s.match(/^([a-z]{3})(\d{2,4})$/);
    if (m5 && PT_MONTHS[m5[1]]) {
      const ano = m5[2].length === 2
        ? (parseInt(m5[2]) >= 50 ? `19${m5[2]}` : `20${m5[2]}`)
        : m5[2];
      return `${ano}-${PT_MONTHS[m5[1]]}`;
    }
    return null;
  };

  const handleCsvFile = (file: File) => {
    setCsvFileName(file.name);
    setCsvRows([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      let lines = text.split(/\r?\n/).filter((l) => l.trim());

      // Detectar e pular linha de cabeçalho (Data;Valor, Data,Valor, etc.)
      if (lines.length > 0) {
        const firstLower = lines[0].toLowerCase().replace(/["']/g, "");
        if (firstLower.includes("data") || firstLower.includes("valor") || firstLower.includes("competencia") || firstLower.includes("competência")) {
          lines = lines.slice(1);
        }
      }

      const parsed = lines.map((line, idx) => {
        // Detectar separador: ponto-e-vírgula ou vírgula
        const sep = line.includes(";") ? ";" : ",";
        const cols = line.split(sep).map((c) => c.replace(/^["']|["']$/g, "").trim());
        if (cols.length < 2) return { period: "", amount: 0, rawDate: line, rawValue: "", error: `Linha ${idx + 1}: formato inválido (precisa de 2 colunas)` };
        const rawDate = cols[0];
        const rawValue = cols[1];
        const period = parseMonthYear(rawDate);
        if (!period) return { period: "", amount: 0, rawDate, rawValue, error: `Linha ${idx + 1}: data inválida — use jan/93, 01/1993 ou MM/AAAA` };
        const amount = parseBRNumber(rawValue);
        if (isNaN(amount) || amount === 0) return { period, amount: 0, rawDate, rawValue, error: `Linha ${idx + 1}: valor inválido — use 1.500,00 ou -1.500,00` };
        return { period, amount, rawDate, rawValue };
      });
      setCsvRows(parsed);
    };
    reader.readAsText(file, "latin1"); // latin1 suporta acentos em arquivos legados do Windows
  };

  const submitCsv = async () => {
    const valid = csvRows.filter((r) => !r.error);
    if (!valid.length || !selectedParty?.id) return;
    setCsvImporting(true);
    try {
      // Convert to paste format: YYYY-MM\tvalue (one per line)
      const pastePayload = valid.map((r) => `${r.period}\t${r.amount.toFixed(2)}`).join("\n");
      const res = await pasteInstMut.mutateAsync(pastePayload);
      toast({ title: "CSV importado", description: `${res.count ?? valid.length} parcela(s) importada(s) com sucesso.` });
      setCsvRows([]);
      setCsvFileName("");
    } catch (err: any) {
      toast({ title: "Erro na importação CSV", description: err.message, variant: "destructive" });
    } finally {
      setCsvImporting(false);
    }
  };

  // ── Visualização de partes
  if (!currentParty) {
    return (
      <div className="space-y-5">
        {/* ── Banner de importação SIAPE ─────────────────────────── */}
        {siapeImport && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40">
            <FileSpreadsheet className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-blue-800 dark:text-blue-300 text-sm">
                Dados do Contracheque SIAPE disponíveis
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                {siapeImport.length} rubrica(s) prontas para importação automática como partes e parcelas.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" disabled={siapeImporting} onClick={handleImportSiape} className="bg-blue-600 hover:bg-blue-700 text-white">
                {siapeImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                {siapeImporting ? "Importando..." : "Importar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { localStorage.removeItem(SIAPE_WIZARD_KEY); setSiapeImport(null); }}>
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Cadastre as partes (autores/credores) e suas parcelas devidas.
          </p>
          <Button size="sm" onClick={() => setIsAddingParty(true)}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar Parte
          </Button>
        </div>

        {!data.parties?.length ? (
          <div className="flex flex-col items-center justify-center py-14 border-2 border-dashed border-border rounded-2xl text-muted-foreground">
            <Users className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">Nenhuma parte cadastrada.</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={() => setIsAddingParty(true)}>
              <Plus className="w-4 h-4 mr-1" /> Cadastrar primeiro credor
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.parties.map((p: any) => (
              <Card
                key={p.id}
                className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                onClick={() => setSelectedParty(p)}
              >
                <CardContent className="p-5 flex justify-between items-start">
                  <div className="space-y-1">
                    <h4 className="font-semibold text-base text-primary">{p.name}</h4>
                    <p className="text-xs text-muted-foreground">{p.cpfCnpj || "Sem CPF/CNPJ"}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">{p.installmentCount ?? 0} parcelas</Badge>
                      {p.totalPrincipal > 0 && (
                        <Badge className="bg-green-100 text-green-700 border-green-200">
                          {formatCurrency(p.totalPrincipal)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 shrink-0"
                    disabled={deletePartyMut.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPartyToDelete(p);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <button id="submit-step-4" className="hidden" onClick={onNext} />
        {data.parties?.length > 0 && (
          <Button onClick={onNext} className="w-full md:w-auto">
            Avançar para Honorários <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}

        {/* Dialog de nova parte */}
        <Dialog open={isAddingParty} onOpenChange={setIsAddingParty}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cadastrar Nova Parte</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input
                  value={partyForm.name}
                  onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })}
                  placeholder="Nome do autor/credor"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>CPF / CNPJ</Label>
                <Input
                  value={partyForm.cpfCnpj}
                  onChange={(e) => setPartyForm({ ...partyForm, cpfCnpj: e.target.value })}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsAddingParty(false)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={submitParty}
                  disabled={!partyForm.name.trim() || addPartyMut.isPending}
                >
                  {addPartyMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar Parte
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Visualização de parcelas de uma parte
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b">
        <Button variant="outline" size="sm" onClick={() => setSelectedParty(null)}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Partes
        </Button>
        <div>
          <h3 className="font-semibold text-lg text-primary">{currentParty.name}</h3>
          <p className="text-xs text-muted-foreground">{currentParty.cpfCnpj || "Sem CPF/CNPJ"} · {currentParty.installments?.length ?? 0} parcelas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Formulário de inserção */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setInstTab("manual")}
              className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all", instTab === "manual" ? "bg-white shadow text-foreground" : "text-muted-foreground")}
            >
              Manual
            </button>
            <button
              onClick={() => setInstTab("paste")}
              className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all", instTab === "paste" ? "bg-white shadow text-foreground" : "text-muted-foreground")}
            >
              Colar Planilha
            </button>
            <button
              onClick={() => setInstTab("csv")}
              className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all", instTab === "csv" ? "bg-white shadow text-foreground" : "text-muted-foreground")}
            >
              Importar CSV
            </button>
          </div>

          {instTab === "manual" && (
            <form onSubmit={submitInst} className="bg-muted/30 rounded-xl border p-4 space-y-4">
              <p className="text-sm font-semibold text-primary">Inserção Individual</p>
              <div className="space-y-2">
                <Label>Competência (Mês/Ano)</Label>
                <Input
                  type="month"
                  required
                  value={instForm.period}
                  onChange={(e) => setInstForm({ ...instForm, period: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Principal (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={instForm.principalAmount}
                  onChange={(e) => setInstForm({ ...instForm, principalAmount: e.target.value })}
                  placeholder="0,00 (aceita negativos)"
                />
              </div>
              <Button type="submit" className="w-full" disabled={addInstMut.isPending}>
                {addInstMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                Adicionar Parcela
              </Button>
            </form>
          )}

          {instTab === "paste" && (
            <div className="bg-muted/30 rounded-xl border p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-primary mb-1">Colar do Excel</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Cole duas colunas separadas por Tab:<br />
                  <code className="bg-muted px-1 rounded">2023-01{"\t"}1500,50</code> ou{" "}
                  <code className="bg-muted px-1 rounded">01/2023{"\t"}1500.50</code>
                </p>
              </div>
              <textarea
                className="w-full h-40 p-3 text-xs font-mono border border-input rounded-xl resize-none bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={"2023-01\t1500.50\n2023-02\t1500.50"}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <Button
                className="w-full"
                onClick={submitPaste}
                disabled={!pasteText.trim() || pasteInstMut.isPending}
              >
                {pasteInstMut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ClipboardPaste className="w-4 h-4 mr-2" />
                )}
                Processar Colagem
              </Button>
            </div>
          )}

          {instTab === "csv" && (
            <div className="bg-muted/30 rounded-xl border p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-primary mb-1 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" /> Importar CSV
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Arquivo com colunas <strong>Data</strong> e <strong>Valor</strong> (cabeçalho opcional).<br />
                  Formatos de data aceitos:{" "}
                  <span className="font-mono bg-muted px-1 rounded">jan/93</span>{" "}
                  <span className="font-mono bg-muted px-1 rounded">01/1993</span>{" "}
                  <span className="font-mono bg-muted px-1 rounded">MM/AAAA</span><br />
                  Separador: <code>;</code> ou <code>,</code> — Valor: <span className="font-mono bg-muted px-1 rounded">1.500,00</span>
                </p>
              </div>

              {/* Drop zone / file input */}
              <div
                className={cn(
                  "relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-6 px-3 cursor-pointer transition-colors",
                  csvFileName ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/50"
                )}
                onClick={() => csvInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleCsvFile(file);
                }}
              >
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCsvFile(file);
                    e.target.value = "";
                  }}
                />
                {csvFileName ? (
                  <>
                    <FileSpreadsheet className="w-8 h-8 text-primary" />
                    <p className="text-sm font-medium text-primary truncate max-w-full">{csvFileName}</p>
                    <p className="text-xs text-muted-foreground">{csvRows.length} linha(s) lida(s)</p>
                    <button
                      className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setCsvFileName(""); setCsvRows([]); }}
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className="w-7 h-7 text-muted-foreground/50" />
                    <p className="text-xs text-muted-foreground text-center">
                      Clique ou arraste o arquivo CSV aqui
                    </p>
                  </>
                )}
              </div>

              {/* Preview table */}
              {csvRows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Pré-visualização — {csvRows.filter(r => !r.error).length} válidas / {csvRows.filter(r => !!r.error).length} com erro
                  </p>
                  <div className="border rounded-lg overflow-hidden max-h-44 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/60 sticky top-0">
                        <tr>
                          <th className="px-3 py-1.5 text-left font-medium">Data (CSV)</th>
                          <th className="px-3 py-1.5 text-left font-medium">Competência</th>
                          <th className="px-3 py-1.5 text-right font-medium">Valor</th>
                          <th className="px-3 py-1.5 text-center font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {csvRows.map((row, i) => (
                          <tr key={i} className={cn("transition-colors", row.error ? "bg-destructive/5" : "hover:bg-muted/30")}>
                            <td className="px-3 py-1.5 font-mono text-muted-foreground">{row.rawDate}</td>
                            <td className="px-3 py-1.5 font-mono">{row.period || "—"}</td>
                            <td className="px-3 py-1.5 text-right font-mono">
                              {row.error ? "—" : formatCurrency(row.amount)}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              {row.error ? (
                                <span className="text-destructive text-xs" title={row.error}>✗ Erro</span>
                              ) : (
                                <span className="text-green-600 text-xs">✓ OK</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {csvRows.some(r => !!r.error) && (
                    <p className="text-xs text-destructive">
                      Linhas com erro serão ignoradas na importação.
                    </p>
                  )}
                </div>
              )}

              <Button
                className="w-full"
                onClick={submitCsv}
                disabled={!csvRows.some(r => !r.error) || csvImporting}
              >
                {csvImporting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {csvRows.filter(r => !r.error).length > 0
                  ? `Importar ${csvRows.filter(r => !r.error).length} parcela(s)`
                  : "Importar CSV"}
              </Button>
            </div>
          )}
        </div>

        {/* Tabela de parcelas */}
        <div className="lg:col-span-3">
          <div className="border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-y-auto max-h-[420px]">
              <table className="w-full text-sm text-left">
                <thead className="bg-primary text-primary-foreground sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 font-medium">Competência</th>
                    <th className="px-4 py-3 font-medium">Moeda</th>
                    <th className="px-4 py-3 font-medium text-right">Principal</th>
                    <th className="px-4 py-3 font-medium text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {!currentParty.installments?.length ? (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-muted-foreground text-xs">
                        Nenhuma parcela cadastrada.
                      </td>
                    </tr>
                  ) : (
                    currentParty.installments.map((inst: any) => (
                      <tr key={inst.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium font-mono text-sm">
                          {inst.period?.slice(0, 7) || inst.period}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            className={cn(
                              "text-xs",
                              inst.originalCurrency === "BRL" || !inst.originalCurrency
                                ? "bg-green-100 text-green-700 border-green-200"
                                : "bg-amber-100 text-amber-700 border-amber-200"
                            )}
                          >
                            {inst.originalCurrency || "BRL"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatCurrency(parseFloat(inst.principalAmount))}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                            disabled={deleteInstMut.isPending}
                            onClick={() => setInstToDelete({
                              partyId: currentParty.id,
                              installmentId: inst.id,
                              period: inst.period,
                              amount: formatCurrency(parseFloat(inst.principalAmount)),
                            })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {currentParty.installments?.length > 0 && (
              <div className="px-4 py-2 bg-muted/30 border-t text-xs text-muted-foreground flex justify-between">
                <span>{currentParty.installments.length} parcela(s)</span>
                <span className="font-semibold">
                  Total nominal:{" "}
                  {formatCurrency(
                    currentParty.installments.reduce(
                      (sum: number, i: any) => sum + parseFloat(i.principalAmount || 0),
                      0
                    )
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <button id="submit-step-4" className="hidden" onClick={onNext} />

      {/* Diálogo de confirmação de exclusão de parte */}
      <Dialog open={!!partyToDelete} onOpenChange={(open) => !open && setPartyToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Excluir Parte
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>"{partyToDelete?.name}"</strong>?<br />
              Esta ação removerá a parte e <strong>todas as suas {partyToDelete?.installmentCount ?? 0} parcela(s)</strong> permanentemente. Esta operação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPartyToDelete(null)} disabled={deletePartyMut.isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDeleteParty} disabled={deletePartyMut.isPending}>
              {deletePartyMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Excluir Permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmação de exclusão de parcela */}
      <Dialog open={!!instToDelete} onOpenChange={(open) => !open && setInstToDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Excluir Parcela
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a parcela de{" "}
              <strong>{instToDelete?.period}</strong> no valor de{" "}
              <strong>{instToDelete?.amount}</strong>?{" "}
              Esta operação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setInstToDelete(null)} disabled={deleteInstMut.isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteInstMut.isPending}
              onClick={() => instToDelete && handleDeleteInstallment(instToDelete.partyId, instToDelete.installmentId)}
            >
              {deleteInstMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Excluir Parcela
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ABA 5 — HONORÁRIOS ADVOCATÍCIOS
// ─────────────────────────────────────────────────────────────
function Step5Fees({ caseId, data, onNext }: any) {
  const mut = useUpdateFees(caseId);
  const { toast } = useToast();
  const existing = data.fees?.[0] || {};
  const [form, setForm] = useState({
    feeType: existing.feeType || "succumbential",
    calcMode: existing.calcMode || "none",
    percentage: existing.percentage?.toString() || "",
    fixedValue: existing.fixedValue?.toString() || "",
    isScaled: existing.isScaled || false,
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mut.mutate(
      {
        ...form,
        percentage: form.percentage ? parseFloat(form.percentage) : null,
        fixedValue: form.fixedValue ? parseFloat(form.fixedValue) : null,
      },
      {
        onSuccess: () => {
          toast({ title: "Honorários salvos" });
          onNext();
        },
        onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
      }
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-xl">
      <div className="p-4 bg-muted/40 rounded-xl border">
        <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider font-semibold">Nota Legal</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Honorários advocatícios sucumbenciais conforme art. 85 do CPC. Para Fazenda Pública, verificar
          escalonamento do §3º do art. 85 do CPC.
        </p>
      </div>

      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
        <input
          type="checkbox"
          id="isScaled"
          checked={form.isScaled}
          onChange={(e) => setForm({ ...form, isScaled: e.target.checked })}
          className="w-4 h-4 accent-primary"
        />
        <label htmlFor="isScaled" className="text-sm cursor-pointer">
          Escalonar honorários (Fazenda Pública — art. 85, §3º CPC)
        </label>
      </div>

      <div className="space-y-2">
        <Label>Modo de Cálculo dos Honorários</Label>
        <Select value={form.calcMode} onValueChange={(v) => setForm({ ...form, calcMode: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem honorários sucumbenciais</SelectItem>
            <SelectItem value="condemnation_value">Percentual sobre o valor da condenação</SelectItem>
            <SelectItem value="cause_value">Percentual sobre o valor da causa atualizado</SelectItem>
            <SelectItem value="fixed_value">Valor fixo definido</SelectItem>
            <SelectItem value="condemnation_no_discount">Valor da condenação sem descontos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(form.calcMode === "condemnation_value" ||
        form.calcMode === "cause_value" ||
        form.calcMode === "condemnation_no_discount") && (
        <div className="space-y-2">
          <Label>Percentual dos Honorários (%)</Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={form.percentage}
            onChange={(e) => setForm({ ...form, percentage: e.target.value })}
            placeholder="Ex: 10 para 10%"
          />
        </div>
      )}

      {form.calcMode === "fixed_value" && (
        <div className="space-y-2">
          <Label>Valor Fixo dos Honorários (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.fixedValue}
            onChange={(e) => setForm({ ...form, fixedValue: e.target.value })}
            placeholder="0,00"
          />
        </div>
      )}

      <button type="submit" id="submit-step-5" className="hidden" />
      <Button type="submit" disabled={mut.isPending} className="w-full md:w-auto">
        {mut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Salvar e Avançar
      </Button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// ABA 6 — OUTRAS SUCUMBÊNCIAS
// ─────────────────────────────────────────────────────────────
function Step6Succumbencies({ caseId, data, onNext }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({
    type: "court_costs",
    description: "",
    amount: "",
    referenceDate: "",
    applyFine10: false,
    applyFees10: false,
  });

  return (
    <div className="space-y-5">
      <div className="p-4 bg-muted/40 rounded-xl border">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Custas processuais, emolumentos, despesas periciais e outras sucumbências que integram o débito total.
          Este módulo está em desenvolvimento — valores podem ser inseridos manualmente.
        </p>
      </div>

      {!data.succumbencies?.length ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-2xl text-muted-foreground">
          <FileText className="w-10 h-10 mb-3 opacity-20" />
          <p className="text-sm">Nenhuma sucumbência cadastrada.</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={() => setIsAdding(true)}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar Sucumbência
          </Button>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-medium">{data.succumbencies.length} sucumbência(s) cadastrada(s)</p>
            <Button size="sm" onClick={() => setIsAdding(true)}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2 text-left font-medium">Descrição</th>
                  <th className="px-4 py-2 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.succumbencies.map((s: any) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-2"><Badge variant="secondary">{s.type}</Badge></td>
                    <td className="px-4 py-2 text-muted-foreground">{s.description}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatCurrency(s.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button id="submit-step-6" className="hidden" onClick={onNext} />
      <Button onClick={onNext} variant="outline" className="w-full md:w-auto">
        Avançar para Dados Finais <ChevronRight className="w-4 h-4 ml-1" />
      </Button>

      {/* Dialog de nova sucumbência */}
      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Sucumbência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="court_costs">Custas Processuais</SelectItem>
                  <SelectItem value="emoluments">Emolumentos</SelectItem>
                  <SelectItem value="expert_fees">Honorários Periciais</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descreva a despesa"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data de Referência</Label>
                <Input type="date" value={form.referenceDate} onChange={(e) => setForm({ ...form, referenceDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="space-y-2">
              {[
                { key: "applyFine10", label: "Acréscimo de multa de 10% (art. 523 CPC)" },
                { key: "applyFees10", label: "Acréscimo de honorários de 10% (art. 523 CPC)" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={key}
                    checked={(form as any)[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  <label htmlFor={key} className="text-sm cursor-pointer">{label}</label>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsAdding(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={() => setIsAdding(false)}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ABA 8 — DADOS FINAIS + AÇÕES
// ─────────────────────────────────────────────────────────────
const CREDITOS_CALCULO_JUDICIAL = 3;

// ─── helper: gera bloco HTML da prescrição para injeção no relatório ──────────
function buildPrescHtml(
  summary: WQSummary,
  grouped: ReturnType<typeof wqGroupByRubrica>,
  memoria: string,
  mode: WQMode
): string {
  const fmtR = (v: number) =>
    `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const rowsHtml = grouped
    .map(
      (g) => `<tr>
        <td style="padding:0.4em 0.75em;border-bottom:1px solid #e5e7eb;">${g.rubrica}</td>
        <td style="padding:0.4em 0.75em;text-align:right;border-bottom:1px solid #e5e7eb;color:#64748b;">${fmtR(g.integral)}</td>
        <td style="padding:0.4em 0.75em;text-align:right;border-bottom:1px solid #e5e7eb;color:#065f46;font-weight:bold;">${fmtR(g.exigivel)}</td>
        <td style="padding:0.4em 0.75em;text-align:right;border-bottom:1px solid #e5e7eb;color:#9f1239;font-weight:bold;">${fmtR(g.prescrito)}</td>
      </tr>`
    )
    .join("");

  return `
<div style="font-family:Arial,sans-serif;margin:2em 0;padding:1.5em;border:1px solid #e5e7eb;border-radius:8px;page-break-inside:avoid;">
  <h2 style="font-size:1em;font-weight:bold;color:#1e3a5f;margin:0 0 0.75em 0;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #1e3a5f;padding-bottom:0.5em;">
    Análise de Prescrição Quinquenal
  </h2>
  <p style="font-size:0.85em;color:#4b5563;margin:0 0 1em 0;line-height:1.6;">${memoria}</p>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1em;margin-bottom:1.25em;">
    <div style="background:#f1f5f9;border-radius:6px;padding:0.85em;text-align:center;">
      <p style="font-size:0.65em;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin:0 0 0.2em 0;">Integral</p>
      <p style="font-size:1.1em;font-weight:bold;margin:0;">${fmtR(summary.totalIntegral)}</p>
      <p style="font-size:0.65em;color:#64748b;margin:0.2em 0 0 0;">${summary.qtIntegral} competências</p>
    </div>
    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:0.85em;text-align:center;">
      <p style="font-size:0.65em;text-transform:uppercase;letter-spacing:0.05em;color:#065f46;margin:0 0 0.2em 0;">Exigível</p>
      <p style="font-size:1.1em;font-weight:bold;color:#065f46;margin:0;">${fmtR(summary.totalExigivel)}</p>
      <p style="font-size:0.65em;color:#065f46;margin:0.2em 0 0 0;">${summary.qtExigivel} competências</p>
    </div>
    <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:6px;padding:0.85em;text-align:center;">
      <p style="font-size:0.65em;text-transform:uppercase;letter-spacing:0.05em;color:#9f1239;margin:0 0 0.2em 0;">Prescrito</p>
      <p style="font-size:1.1em;font-weight:bold;color:#9f1239;margin:0;">${fmtR(summary.totalPrescrito)}</p>
      <p style="font-size:0.65em;color:#9f1239;margin:0.2em 0 0 0;">${summary.qtPrescrito} competências</p>
    </div>
  </div>
  ${
    grouped.length > 0
      ? `<table style="width:100%;border-collapse:collapse;font-size:0.82em;margin-bottom:1em;">
          <thead>
            <tr style="background:#1e3a5f;color:white;text-align:left;">
              <th style="padding:0.5em 0.75em;">Rubrica</th>
              <th style="padding:0.5em 0.75em;text-align:right;">Integral</th>
              <th style="padding:0.5em 0.75em;text-align:right;">Exigível</th>
              <th style="padding:0.5em 0.75em;text-align:right;">Prescrito</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>`
      : ""
  }
  <div style="background:#f8fafc;border-left:4px solid #1e3a5f;padding:1em;font-size:0.8em;color:#374151;line-height:1.6;">
    O presente demonstrativo foi elaborado com base nas competências mensais informadas, permitindo-se, por parametrização, a apuração integral ou a aplicação de recorte técnico quinquenal.
    Quando ativado, o recorte considera como exigíveis as parcelas compreendidas nos 5 anos anteriores à data de ajuizamento indicada pelo usuário, preservando-se a matéria jurídica relativa
    à prescrição, sua eventual interrupção, suspensão ou afastamento para análise na petição e pelo Juízo competente.
  </div>
</div>`;
}

// ─────────────────────────────────────────────────────────────
// ABA 8 — DADOS FINAIS (anteriormente aba 7)
// ─────────────────────────────────────────────────────────────
function Step8Final({ caseId, data, prescSummary, prescDetailedRows, prescMemoria, prescMode, prescAjuizamento }: any) {
  const mutFinal = useUpdateFinalMetadata(caseId);
  const computeMut = useComputeCase(caseId);
  const reportMut = useGenerateReport(caseId);
  const { toast } = useToast();
  const debitCredits = useDebitCredits();
  const [copied, setCopied] = useState(false);
  const [creditoDebitado, setCreditoDebitado] = useState(false);

  const prescGroupedForReport = useMemo(
    () => wqGroupByRubrica(prescDetailedRows || []),
    [prescDetailedRows]
  );

  const [form, setForm] = useState({
    preparedBy: data.finalMeta?.preparedBy || "",
    institution: data.finalMeta?.institution || "",
    city: data.finalMeta?.city || "",
    state: data.finalMeta?.state || "",
    finalNotes: data.finalMeta?.finalNotes || "",
  });

  const BR_STATES = [
    "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
    "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
  ];

  const handleCompute = async () => {
    try {
      if (!creditoDebitado) {
        const ok = await debitCredits(CREDITOS_CALCULO_JUDICIAL, "Cálculo Judicial");
        if (!ok) return;
        setCreditoDebitado(true);
      }
      await mutFinal.mutateAsync(form);
      await computeMut.mutateAsync();
      toast({ title: "Cálculo realizado com sucesso!", description: "Os valores foram apurados." });
    } catch (err: any) {
      toast({ title: "Erro no cálculo", description: err.message, variant: "destructive" });
    }
  };

  const handleReport = async () => {
    try {
      const res = await reportMut.mutateAsync();
      if (res.html) {
        // Injeta o bloco de prescrição quinquenal antes da assinatura/rodapé
        const prescBlock = buildPrescHtml(prescSummary, prescGroupedForReport, prescMemoria, prescMode);
        // Tenta inserir antes de elemento de assinatura ou, em último caso, antes de </body>
        let html: string = res.html;
        const signatureMarkers = [
          'id="signature"',
          'class="signature"',
          'id="assinatura"',
          'class="assinatura"',
          "<!-- ASSINATURA -->",
          "<!-- SIGNATURE -->",
        ];
        let injected = false;
        for (const marker of signatureMarkers) {
          if (html.includes(marker)) {
            html = html.replace(marker, `__PRESC_BLOCK__${marker}`);
            html = html.replace("__PRESC_BLOCK__", prescBlock);
            injected = true;
            break;
          }
        }
        if (!injected) {
          html = html.replace("</body>", `${prescBlock}</body>`);
        }
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        window.open(URL.createObjectURL(blob), "_blank");
      }
    } catch (err: any) {
      toast({ title: "Erro ao gerar relatório", description: err.message, variant: "destructive" });
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(data.case.publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const result = computeMut.data;

  return (
    <div className="space-y-6">
      {/* Formulário de dados finais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 bg-muted/30 rounded-2xl border border-border/60">
        <div className="space-y-2">
          <Label htmlFor="preparedBy">Responsável pelo Cálculo</Label>
          <Input
            id="preparedBy"
            value={form.preparedBy}
            onChange={(e) => setForm({ ...form, preparedBy: e.target.value })}
            placeholder="Nome do Contador/Advogado"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="institution">Instituição / Órgão</Label>
          <Input
            id="institution"
            value={form.institution}
            onChange={(e) => setForm({ ...form, institution: e.target.value })}
            placeholder="Escritório ou repartição"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Cidade</Label>
          <Input
            id="city"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="Ex: Brasília"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">UF</Label>
          <Select value={form.state} onValueChange={(v) => setForm({ ...form, state: v })}>
            <SelectTrigger id="state">
              <SelectValue placeholder="Selecione o estado" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {BR_STATES.map((uf) => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="finalNotes">Observações Finais</Label>
          <textarea
            id="finalNotes"
            className="w-full min-h-[80px] rounded-xl border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={form.finalNotes}
            onChange={(e) => setForm({ ...form, finalNotes: e.target.value })}
            placeholder="Notas finais a constar no relatório..."
          />
        </div>
      </div>

      {/* Chave pública */}
      <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Chave de Recuperação</p>
          <p className="font-mono text-lg font-bold text-primary tracking-wider">{data.case.publicKey}</p>
        </div>
        <Button variant="outline" size="sm" onClick={copyKey}>
          {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copiada!" : "Copiar"}
        </Button>
      </div>

      {/* Botões de ação */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={handleCompute}
          disabled={computeMut.isPending || mutFinal.isPending}
          className="flex-1 md:flex-none"
          size="lg"
        >
          {computeMut.isPending || mutFinal.isPending ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <Calculator className="w-5 h-5 mr-2" />
          )}
          {creditoDebitado
            ? "Recalcular"
            : `Calcular · ${CREDITOS_CALCULO_JUDICIAL} créditos`}
        </Button>
        <Button
          variant="outline"
          onClick={handleReport}
          disabled={reportMut.isPending || !computeMut.isSuccess && data.case.status !== "computed"}
          className="flex-1 md:flex-none"
          size="lg"
        >
          {reportMut.isPending ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <Download className="w-5 h-5 mr-2" />
          )}
          Gerar Relatório HTML
        </Button>
      </div>

      {/* Painel de resultado */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-primary text-primary-foreground rounded-2xl p-6 shadow-xl"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-primary-foreground/60 mb-1">Resultado da Apuração</p>
                <p className="text-4xl font-display font-black text-amber-300">
                  {formatCurrency(result.grandTotalGross || 0)}
                </p>
              </div>
              <Badge className="bg-white/10 text-white border-white/20">
                {result.partyResults?.length || 0} parte(s)
              </Badge>
            </div>

            {result.partyResults?.length > 0 && (
              <div className="space-y-2 mt-4 pt-4 border-t border-primary-foreground/20">
                {result.partyResults.map((pr: any) => (
                  <div key={pr.partyId} className="flex justify-between text-sm">
                    <span className="text-primary-foreground/80">{pr.name}</span>
                    <span className="font-mono font-semibold">{formatCurrency(pr.totalUpdated || 0)}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-primary-foreground/50 mt-4 border-t border-primary-foreground/10 pt-3">
              ⚠ Valores sujeitos à homologação judicial. Ponto de homologação pendente de revisão.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ABA 7 — PRESCRIÇÃO QUINQUENAL (props-driven, estado no pai)
// ─────────────────────────────────────────────────────────────
interface Step7QuinquenioProps {
  mode: WQMode; setMode: (m: WQMode) => void;
  ajuizamento: string; setAjuizamento: (d: string) => void;
  useManual: boolean; setUseManual: (v: boolean) => void;
  manualTsv: string; setManualTsv: (t: string) => void;
  autoRows: WQRow[];
  detailedRows: WQFiltered[];
  summary: WQSummary;
  grouped: ReturnType<typeof wqGroupByRubrica>;
  memoria: string;
  onNext: () => void;
}

function Step7Quinquenio({
  mode, setMode,
  ajuizamento, setAjuizamento,
  useManual, setUseManual,
  manualTsv, setManualTsv,
  autoRows,
  detailedRows,
  summary,
  grouped,
  memoria,
  onNext,
}: Step7QuinquenioProps) {
  const fmtR = (v: number) => formatCurrency(v || 0);
  const inputRows = useManual ? wqParseTsv(manualTsv) : autoRows;

  return (
    <div className="space-y-6">
      {/* Parâmetros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-2xl border border-border/50">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Modo de cálculo</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as WQMode)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="quinquenio">Aplicar quinquênio</SelectItem>
              <SelectItem value="integral">Cálculo integral</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Data do ajuizamento</Label>
          <input
            type="date"
            value={ajuizamento}
            onChange={(e) => setAjuizamento(e.target.value)}
            className="w-full h-9 rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Fonte dos dados</Label>
          <div className="flex items-center justify-between h-9 px-3 rounded-lg border border-input bg-background">
            <span className="text-sm text-muted-foreground">
              {useManual ? "Entrada manual (TSV)" : `Parcelas do caso (${autoRows.length})`}
            </span>
            <Switch checked={useManual} onCheckedChange={setUseManual} />
          </div>
        </div>
      </div>

      {/* Entrada manual TSV */}
      {useManual && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2">
          <Label className="text-sm text-amber-800 font-medium">Colar dados em formato TSV (Data ⇥ Valor ⇥ Rubrica)</Label>
          <textarea
            value={manualTsv}
            onChange={(e) => setManualTsv(e.target.value)}
            rows={8}
            className="w-full font-mono text-xs border border-amber-300 rounded-lg px-3 py-2 bg-white resize-y focus:outline-none focus:ring-1 focus:ring-amber-400"
            placeholder={"Data\tValor\tRubrica\njan/20\tR$ 1.000,00\tVencimento"}
          />
          <p className="text-xs text-amber-700">
            Formatos aceitos: <code className="bg-amber-100 px-1 rounded">jan/20</code>,{" "}
            <code className="bg-amber-100 px-1 rounded">01/2020</code>,{" "}
            <code className="bg-amber-100 px-1 rounded">2020-01</code>
          </p>
        </div>
      )}

      {/* Estado sem dados */}
      {inputRows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">Nenhuma parcela encontrada</p>
          <p className="text-xs text-muted-foreground">Adicione parcelas no passo 4 ou ative a entrada manual.</p>
        </div>
      )}

      {/* Síntese e análise */}
      {summary.qtIntegral > 0 && (
        <>
          {/* Cards de síntese */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-4 text-center">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1">Integral</p>
              <p className="text-xl font-extrabold">{fmtR(summary.totalIntegral)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{summary.qtIntegral} competências</p>
            </div>
            <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-4 text-center">
              <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wide mb-1">Exigível</p>
              <p className="text-xl font-extrabold text-emerald-800">{fmtR(summary.totalExigivel)}</p>
              <p className="text-xs text-emerald-600 mt-0.5">{summary.qtExigivel} competências</p>
            </div>
            <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200 p-4 text-center">
              <p className="text-xs text-rose-700 font-semibold uppercase tracking-wide mb-1">Prescrito</p>
              <p className="text-xl font-extrabold text-rose-800">{fmtR(summary.totalPrescrito)}</p>
              <p className="text-xs text-rose-600 mt-0.5">{summary.qtPrescrito} competências</p>
            </div>
          </div>

          {/* Memória técnica */}
          <div className="rounded-xl bg-muted/40 border p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Memória Técnica</p>
            <p className="text-sm leading-6">{memoria}</p>
            <div className="grid grid-cols-3 gap-2 pt-1 text-xs text-muted-foreground">
              <div><span className="font-semibold">Corte técnico:</span> {summary.dataCorte ?? "não aplicado"}</div>
              <div><span className="font-semibold">Faixa integral:</span> {summary.faixaInicialIntegral ?? "—"} → {summary.faixaFinalIntegral ?? "—"}</div>
              <div><span className="font-semibold">Faixa exigível:</span> {summary.faixaInicialExigivel ?? "—"} → {summary.faixaFinalExigivel ?? "—"}</div>
            </div>
          </div>

          {/* Resumo por rubrica */}
          {grouped.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Resumo por Rubrica</p>
              <div className="overflow-x-auto rounded-xl border border-border/50">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-primary text-primary-foreground text-left">
                      <th className="px-4 py-2.5 font-medium">Rubrica</th>
                      <th className="px-4 py-2.5 font-medium text-right">Integral</th>
                      <th className="px-4 py-2.5 font-medium text-right">Exigível</th>
                      <th className="px-4 py-2.5 font-medium text-right">Prescrito</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {grouped.map((g) => (
                      <tr key={g.rubrica} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-medium">{g.rubrica}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{fmtR(g.integral)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-700">{fmtR(g.exigivel)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-rose-700">{fmtR(g.prescrito)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detalhamento por competência */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Detalhamento por Competência</p>
            <ScrollArea className="h-72 rounded-xl border border-border/50">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-background z-10 border-b">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Competência</th>
                    <th className="px-4 py-2.5 font-medium">Rubrica</th>
                    <th className="px-4 py-2.5 font-medium text-right">Valor</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {detailedRows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2 font-mono text-sm">{r.parsed.label}</td>
                      <td className="px-4 py-2 text-sm text-muted-foreground">{r.rubrica}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">{fmtR(r.valorConsiderado)}</td>
                      <td className="px-4 py-2">
                        <span className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold",
                          r.status === "EXIGIVEL" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        )}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>

          {/* Texto sugerido + botão avançar */}
          <div className="rounded-xl bg-primary text-primary-foreground p-5 space-y-3">
            <p className="text-xs font-semibold text-primary-foreground/60 uppercase tracking-wide">
              Este texto será incluído no relatório final
            </p>
            <p className="text-sm leading-6 text-primary-foreground/90">
              O presente demonstrativo foi elaborado com base nas competências mensais informadas, permitindo-se, por parametrização, a apuração integral ou a aplicação de recorte técnico quinquenal.
              Quando ativado, o recorte considera como exigíveis as parcelas compreendidas nos 5 anos anteriores à data de ajuizamento indicada pelo usuário, preservando-se a matéria jurídica relativa
              à prescrição, sua eventual interrupção, suspensão ou afastamento para análise na petição e pelo Juízo competente.
            </p>
            <Button
              onClick={onNext}
              className="bg-white text-primary hover:bg-white/90 font-semibold"
            >
              Avançar para Cálculo <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
