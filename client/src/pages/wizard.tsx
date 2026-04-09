import React, { useState, useEffect } from "react";
import { useLocation, params } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { Button, Input, Select, Label, Card, CardContent, Dialog, Badge } from "@/components/ui";
import { Check, ChevronRight, Calculator, FileText, Download, Users, Plus, Trash2, Edit3, ClipboardPaste } from "lucide-react";
import { 
  useGetCase, useUpdateProcessData, useUpdateMonetaryConfig, useUpdateInterestConfig,
  useCriteria, useInterestRules, useAddParty, useDeleteParty, useAddInstallment,
  usePasteInstallments, useDeleteInstallment, useUpdateFees, useUpdateFinalMetadata,
  useComputeCase, useGenerateReport 
} from "@/hooks/use-api";
import { formatBRL, formatDate } from "@/lib/utils";

const STEPS = [
  { id: 1, title: "Processo", subtitle: "Dados básicos" },
  { id: 2, title: "Correção", subtitle: "Índices monetários" },
  { id: 3, title: "Juros", subtitle: "Regras moratórias" },
  { id: 4, title: "Parcelas", subtitle: "Partes e valores" },
  { id: 5, title: "Honorários", subtitle: "Advocatícios" },
  { id: 6, title: "Sucumbência", subtitle: "Outras custas" },
  { id: 7, title: "Resultado", subtitle: "Cálculo final" },
];

export default function Wizard({ params }: { params: { id: string } }) {
  const caseId = parseInt(params.id);
  const [currentStep, setCurrentStep] = useState(1);
  const { data: caseFull, isLoading } = useGetCase(caseId);

  if (isLoading) return <Layout><div className="flex h-64 items-center justify-center text-primary">Carregando autos...</div></Layout>;
  if (!caseFull) return <Layout><div className="text-destructive text-center mt-20">Caso não encontrado.</div></Layout>;

  const handleNext = () => setCurrentStep(p => Math.min(7, p + 1));
  const handlePrev = () => setCurrentStep(p => Math.max(1, p - 1));

  const StepComponent = [
    null,
    <Step1Process caseId={caseId} data={caseFull} onNext={handleNext} />,
    <Step2Monetary caseId={caseId} data={caseFull} onNext={handleNext} />,
    <Step3Interest caseId={caseId} data={caseFull} onNext={handleNext} />,
    <Step4Parties caseId={caseId} data={caseFull} onNext={handleNext} />,
    <Step5Fees caseId={caseId} data={caseFull} onNext={handleNext} />,
    <Step6Succumbencies caseId={caseId} data={caseFull} onNext={handleNext} />,
    <Step7Final caseId={caseId} data={caseFull} />
  ][currentStep];

  return (
    <Layout>
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Stepper Sidebar */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="sticky top-8 space-y-2 bg-card p-4 rounded-2xl shadow-lg border border-border/50">
            <div className="mb-6 px-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Chave Pública</h3>
              <p className="font-mono text-sm bg-muted p-2 rounded text-center border font-medium text-primary">{caseFull.case.publicKey}</p>
            </div>
            {STEPS.map((s) => {
              const active = currentStep === s.id;
              const completed = currentStep > s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setCurrentStep(s.id)}
                  className={`w-full text-left flex items-center p-3 rounded-xl transition-all ${
                    active ? "bg-primary text-white shadow-md" : 
                    completed ? "hover:bg-muted" : "opacity-50 hover:opacity-100"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 shrink-0 text-sm font-bold ${
                    active ? "bg-accent text-primary" : 
                    completed ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {completed ? <Check className="w-4 h-4" /> : s.id}
                  </div>
                  <div>
                    <div className={`font-semibold text-sm ${active ? "text-white" : "text-foreground"}`}>{s.title}</div>
                    <div className={`text-xs ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{s.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Content Area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="bg-card rounded-3xl shadow-xl border border-border/50 overflow-hidden"
            >
              <div className="p-6 md:p-10">
                <h2 className="text-3xl font-display font-bold text-primary mb-8 border-b pb-4">
                  {STEPS[currentStep - 1].title}
                </h2>
                {StepComponent}
              </div>
              
              <div className="bg-muted/30 p-6 border-t flex justify-between items-center">
                <Button variant="outline" onClick={handlePrev} disabled={currentStep === 1}>
                  Voltar
                </Button>
                {currentStep < 7 && (
                  <Button onClick={() => document.getElementById(`submit-step-${currentStep}`)?.click()}>
                    Avançar <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}

// ============================================================
// STEPS IMPLEMENTATION
// ============================================================

function Step1Process({ caseId, data, onNext }: any) {
  const mut = useUpdateProcessData(caseId);
  const [form, setForm] = useState({
    processNumber: data.processData?.processNumber || "",
    claimant: data.processData?.claimant || "",
    defendant: data.processData?.defendant || "",
    generalNotes: data.processData?.generalNotes || "",
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mut.mutate(form, { onSuccess: onNext });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Número do Processo</Label>
          <Input value={form.processNumber} onChange={e => setForm({...form, processNumber: e.target.value})} placeholder="0000000-00.0000.0.00.0000" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Autor (Exequente)</Label>
          <Input value={form.claimant} onChange={e => setForm({...form, claimant: e.target.value})} placeholder="Nome do autor" />
        </div>
        <div className="space-y-2">
          <Label>Réu (Executado)</Label>
          <Input value={form.defendant} onChange={e => setForm({...form, defendant: e.target.value})} placeholder="Ex: União Federal, INSS" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Observações Gerais</Label>
        <textarea 
          className="w-full min-h-32 rounded-xl border border-border bg-background p-4 text-sm"
          value={form.generalNotes} onChange={e => setForm({...form, generalNotes: e.target.value})} placeholder="Anotações internas..."
        />
      </div>
      <button type="submit" id="submit-step-1" className="hidden" />
    </form>
  );
}

function Step2Monetary({ caseId, data, onNext }: any) {
  const mut = useUpdateMonetaryConfig(caseId);
  const { data: criteria } = useCriteria();
  const [form, setForm] = useState({
    criteriaId: data.monetaryConfig?.criteriaId || "",
    baseDate: data.monetaryConfig?.baseDate || "",
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mut.mutate({ ...form, criteriaId: parseInt(form.criteriaId) }, { onSuccess: onNext });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="space-y-3">
        <Label className="text-lg">Critério de Correção Monetária</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {criteria?.map((c: any) => (
            <label key={c.id} className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${form.criteriaId == c.id ? 'border-primary bg-primary/5 ring-4 ring-primary/10' : 'border-border hover:border-primary/50'}`}>
              <div className="flex items-center gap-3 mb-2">
                <input type="radio" name="criteria" value={c.id} checked={form.criteriaId == c.id} onChange={(e) => setForm({...form, criteriaId: e.target.value})} className="w-5 h-5 text-primary" />
                <span className="font-bold text-primary">{c.name}</span>
              </div>
              <p className="text-sm text-muted-foreground pl-8">{c.description}</p>
            </label>
          ))}
        </div>
      </div>
      <div className="w-full md:w-1/3 space-y-2">
        <Label>Data-Base de Atualização</Label>
        <Input type="month" required value={form.baseDate} onChange={e => setForm({...form, baseDate: e.target.value})} />
        <p className="text-xs text-muted-foreground">Mês até o qual os valores serão corrigidos.</p>
      </div>
      <button type="submit" id="submit-step-2" className="hidden" />
    </form>
  );
}

function Step3Interest({ caseId, data, onNext }: any) {
  const mut = useUpdateInterestConfig(caseId);
  const { data: rules } = useInterestRules();
  const [form, setForm] = useState({
    interestRuleId: data.interestConfig?.interestRuleId || "",
    startDate: data.interestConfig?.startDate || "",
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mut.mutate({ ...form, interestRuleId: parseInt(form.interestRuleId) }, { onSuccess: onNext });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="space-y-3">
        <Label className="text-lg">Regra de Juros Moratórios</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules?.map((r: any) => (
            <label key={r.id} className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${form.interestRuleId == r.id ? 'border-primary bg-primary/5 ring-4 ring-primary/10' : 'border-border hover:border-primary/50'}`}>
              <div className="flex items-center gap-3 mb-2">
                <input type="radio" name="rule" value={r.id} checked={form.interestRuleId == r.id} onChange={(e) => setForm({...form, interestRuleId: e.target.value})} className="w-5 h-5 text-primary" />
                <span className="font-bold text-primary">{r.name}</span>
              </div>
              <p className="text-sm text-muted-foreground pl-8">{r.description}</p>
            </label>
          ))}
        </div>
      </div>
      <div className="w-full md:w-1/3 space-y-2">
        <Label>Data de Início dos Juros (Citação)</Label>
        <Input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
      </div>
      <button type="submit" id="submit-step-3" className="hidden" />
    </form>
  );
}

function Step4Parties({ caseId, data, onNext }: any) {
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [isAddingParty, setIsAddingParty] = useState(false);
  
  const addPartyMut = useAddParty(caseId);
  const deletePartyMut = useDeleteParty(caseId);
  const addInstMut = useAddInstallment(caseId, selectedParty?.id);
  const pasteInstMut = usePasteInstallments(caseId, selectedParty?.id);
  const deleteInstMut = useDeleteInstallment(); // To be implemented in hooks if needed, skipping for brevity

  const [partyForm, setPartyForm] = useState({ name: "", cpfCnpj: "" });
  const [instForm, setInstForm] = useState({ period: "", principalAmount: "" });
  const [pasteText, setPasteText] = useState("");
  const [activeTab, setActiveTab] = useState("manual");

  const submitParty = async () => {
    await addPartyMut.mutateAsync(partyForm);
    setIsAddingParty(false);
    setPartyForm({ name: "", cpfCnpj: "" });
  };

  const submitInst = async (e: React.FormEvent) => {
    e.preventDefault();
    await addInstMut.mutateAsync({ ...instForm, principalAmount: parseFloat(instForm.principalAmount) });
    setInstForm({ period: "", principalAmount: "" });
  };

  const submitPaste = async () => {
    await pasteInstMut.mutateAsync(pasteText);
    setPasteText("");
  };

  // Find updated selected party from data
  const currentParty = data.parties.find((p: any) => p.id === selectedParty?.id);

  if (!currentParty) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">Cadastre as partes (autores/credores) deste cálculo.</p>
          <Button onClick={() => setIsAddingParty(true)}><Plus className="w-4 h-4 mr-2"/> Adicionar Parte</Button>
        </div>

        {data.parties.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-2xl text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Nenhuma parte cadastrada.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.parties.map((p: any) => (
              <Card key={p.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => setSelectedParty(p)}>
                <CardContent className="p-5 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-lg text-primary">{p.name}</h4>
                    <p className="text-sm text-muted-foreground">{p.cpfCnpj || "Sem CPF/CNPJ"}</p>
                    <Badge className="mt-2">{p.installmentCount} parcelas</Badge>
                  </div>
                  <Button variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); deletePartyMut.mutate(p.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isAddingParty} onClose={() => setIsAddingParty(false)}>
          <h3 className="text-xl font-bold mb-4">Nova Parte</h3>
          <div className="space-y-4">
            <div>
              <Label>Nome Completo</Label>
              <Input value={partyForm.name} onChange={e => setPartyForm({...partyForm, name: e.target.value})} />
            </div>
            <div>
              <Label>CPF / CNPJ</Label>
              <Input value={partyForm.cpfCnpj} onChange={e => setPartyForm({...partyForm, cpfCnpj: e.target.value})} />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setIsAddingParty(false)}>Cancelar</Button>
              <Button onClick={submitParty} disabled={!partyForm.name} isLoading={addPartyMut.isPending}>Salvar Parte</Button>
            </div>
          </div>
        </Dialog>
        <button id="submit-step-4" className="hidden" onClick={onNext} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6 pb-6 border-b">
        <Button variant="outline" size="sm" onClick={() => setSelectedParty(null)}>Voltar para Partes</Button>
        <div>
          <h3 className="text-xl font-bold text-primary">{currentParty.name}</h3>
          <p className="text-sm text-muted-foreground">Gerenciando parcelas devidas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <div className="flex border rounded-lg p-1 bg-muted/50">
            <button onClick={() => setActiveTab("manual")} className={`flex-1 py-2 text-sm font-medium rounded-md ${activeTab === "manual" ? "bg-white shadow" : "text-muted-foreground"}`}>Manual</button>
            <button onClick={() => setActiveTab("paste")} className={`flex-1 py-2 text-sm font-medium rounded-md ${activeTab === "paste" ? "bg-white shadow" : "text-muted-foreground"}`}>Colar Planilha</button>
          </div>

          {activeTab === "manual" ? (
            <form onSubmit={submitInst} className="bg-muted/20 p-5 rounded-2xl border space-y-4">
              <h4 className="font-semibold text-primary">Inserção Individual</h4>
              <div><Label>Competência (Mês/Ano)</Label><Input type="month" required value={instForm.period} onChange={e => setInstForm({...instForm, period: e.target.value})} /></div>
              <div><Label>Valor Original (Nominal)</Label><Input type="number" step="0.01" required value={instForm.principalAmount} onChange={e => setInstForm({...instForm, principalAmount: e.target.value})} /></div>
              <Button type="submit" className="w-full" isLoading={addInstMut.isPending}>Adicionar Parcela</Button>
            </form>
          ) : (
            <div className="bg-muted/20 p-5 rounded-2xl border space-y-4">
              <h4 className="font-semibold text-primary">Colar em Lote</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">Cole do Excel duas colunas: Mês/Ano e Valor. <br/>Ex: <code>2023-01  1500.50</code></p>
              <textarea className="w-full h-48 p-3 text-sm font-mono border rounded-xl" placeholder="2023-01&#9;1500.50&#10;2023-02&#9;1500.50" value={pasteText} onChange={e => setPasteText(e.target.value)} />
              <Button className="w-full" onClick={submitPaste} disabled={!pasteText} isLoading={pasteInstMut.isPending}><ClipboardPaste className="w-4 h-4 mr-2"/> Processar Lote</Button>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-y-auto max-h-[500px]">
              <table className="w-full text-sm text-left">
                <thead className="bg-primary text-primary-foreground sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Competência</th>
                    <th className="px-4 py-3 font-semibold">Moeda Original</th>
                    <th className="px-4 py-3 font-semibold text-right">Valor Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {currentParty.installments?.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">Nenhuma parcela.</td></tr>
                  ) : (
                    currentParty.installments?.map((inst: any) => (
                      <tr key={inst.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{inst.period}</td>
                        <td className="px-4 py-3"><Badge className="bg-secondary text-secondary-foreground">{inst.originalCurrency}</Badge></td>
                        <td className="px-4 py-3 text-right font-mono">{formatBRL(inst.principalAmount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <button id="submit-step-4" className="hidden" onClick={onNext} />
    </div>
  );
}

function Step5Fees({ caseId, data, onNext }: any) {
  const mut = useUpdateFees(caseId);
  const existing = data.fees?.[0] || {};
  const [form, setForm] = useState({
    calcMode: existing.calcMode || "none",
    percentage: existing.percentage || "",
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mut.mutate({ ...form, percentage: form.percentage ? parseFloat(form.percentage) : undefined }, { onSuccess: onNext });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-xl">
      <div className="space-y-2">
        <Label>Base de Cálculo dos Honorários</Label>
        <Select value={form.calcMode} onChange={e => setForm({...form, calcMode: e.target.value})}>
          <option value="none">Sem honorários sucumbenciais</option>
          <option value="condemnation_value">Valor da condenação</option>
          <option value="cause_value">Valor da causa atualizado</option>
        </Select>
      </div>
      
      {form.calcMode !== "none" && (
        <div className="space-y-2">
          <Label>Percentual (%)</Label>
          <Input type="number" step="0.1" required value={form.percentage} onChange={e => setForm({...form, percentage: e.target.value})} />
        </div>
      )}
      
      <button type="submit" id="submit-step-5" className="hidden" />
    </form>
  );
}

function Step6Succumbencies({ caseId, data, onNext }: any) {
  // Skeleton to skip to Step 7 for brevity, but wired to next
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground mb-8">Nesta aba você pode adicionar custas processuais, multas, e outras despesas que entram no cálculo final. (Módulo simplificado para o MVP)</p>
      <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-muted/20">
        <p className="text-muted-foreground">Pular esta etapa por enquanto.</p>
      </div>
      <button id="submit-step-6" className="hidden" onClick={onNext} />
    </div>
  );
}

function Step7Final({ caseId, data }: any) {
  const mutFinal = useUpdateFinalMetadata(caseId);
  const computeMut = useComputeCase(caseId);
  const reportMut = useGenerateReport(caseId);

  const [form, setForm] = useState({
    preparedBy: data.finalMeta?.preparedBy || "",
    city: data.finalMeta?.city || "",
  });

  const handleCompute = async () => {
    await mutFinal.mutateAsync(form);
    await computeMut.mutateAsync();
  };

  const handleReport = async () => {
    const res = await reportMut.mutateAsync();
    // Open report in new tab via Blob
    const blob = new Blob([res.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-2xl border border-border/50">
        <div><Label>Responsável pelo Cálculo</Label><Input value={form.preparedBy} onChange={e => setForm({...form, preparedBy: e.target.value})} placeholder="Nome do Contador/Advogado" /></div>
        <div><Label>Local e Data (Cidade/UF)</Label><Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="Brasília/DF" /></div>
      </div>

      {data.case.status !== "draft" && data.case.status !== "in_progress" && computeMut.isSuccess && (
        <div className="bg-primary text-primary-foreground p-8 rounded-3xl shadow-xl bg-[url('/images/legal-bg.png')] bg-cover bg-blend-overlay bg-opacity-90">
          <h3 className="text-accent uppercase tracking-widest text-sm font-bold mb-2">Resultado da Apuração</h3>
          <div className="text-5xl font-display font-black mb-6">
            {formatBRL(computeMut.data?.grandTotalGross)}
          </div>
          <div className="space-y-2 text-primary-foreground/80">
            {computeMut.data?.partyResults?.map((pr: any) => (
              <div key={pr.partyId} className="flex justify-between border-b border-primary-foreground/20 pb-2">
                <span>{pr.name}</span>
                <span className="font-mono">{formatBRL(pr.totalUpdated)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 pt-6 border-t border-border/50">
        <Button size="lg" className="flex-1 text-lg h-16" onClick={handleCompute} isLoading={computeMut.isPending || mutFinal.isPending}>
          <Calculator className="w-6 h-6 mr-2" /> Executar Atualização
        </Button>
        
        {(data.case.status === "computed" || data.case.status === "report_generated" || computeMut.isSuccess) && (
          <Button size="lg" variant="outline" className="flex-1 text-lg h-16 border-2 border-accent text-primary hover:bg-accent hover:text-primary" onClick={handleReport} isLoading={reportMut.isPending}>
            <Download className="w-6 h-6 mr-2" /> Gerar Relatório Jurídico
          </Button>
        )}
      </div>
    </div>
  );
}
