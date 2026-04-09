import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Calculator, Save, FileText, ArrowRight, CheckCircle2, 
  TrendingUp, CalendarDays, DollarSign, Copy, AlertCircle, RefreshCw, KeyRound
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { useAppCreateCalculation, useAppComputeCalculation, useAppGenerateReport } from "@/hooks/use-calculations-wrapper";
import { useGetCalculation, CorrectionIndex, InterestRule, ComputeResult } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const formSchema = z.object({
  title: z.string().min(3, "O nome do cálculo é obrigatório"),
  processNumber: z.string().optional(),
  claimantName: z.string().optional(),
  notes: z.string().optional(),
  originalValue: z.coerce.number().min(0.01, "O valor deve ser maior que zero"),
  startDate: z.string().min(10, "Data inicial inválida"),
  endDate: z.string().min(10, "Data final inválida"),
  correctionIndex: z.nativeEnum(CorrectionIndex, { required_error: "Selecione um índice" }),
  interestRule: z.nativeEnum(InterestRule, { required_error: "Selecione a regra de juros" }),
});

type FormValues = z.infer<typeof formSchema>;

export default function AtualizacaoValores() {
  const { toast } = useToast();
  const [location] = useLocation();
  const queryParams = new URLSearchParams(window.location.search);
  const calculationId = queryParams.get("id") ? parseInt(queryParams.get("id")!) : null;

  const [activeTab, setActiveTab] = useState<"form" | "result">("form");
  const [currentId, setCurrentId] = useState<number | null>(calculationId);
  const [resultData, setResultData] = useState<ComputeResult | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [showKeyDialog, setShowKeyDialog] = useState(false);

  // API Hooks
  const createMut = useAppCreateCalculation();
  const computeMut = useAppComputeCalculation();
  const reportMut = useAppGenerateReport();
  
  // Fetch existing if ID present
  const { data: existingCalc, isLoading: isLoadingExisting } = useGetCalculation(currentId!, {
    query: { enabled: !!currentId }
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      processNumber: "",
      claimantName: "",
      notes: "",
      originalValue: 0,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      correctionIndex: CorrectionIndex.IPCA_E,
      interestRule: InterestRule.simple_1_percent,
    },
  });

  // Prefill form if editing
  useEffect(() => {
    if (existingCalc?.calculation) {
      const c = existingCalc.calculation;
      form.reset({
        title: c.title,
        processNumber: c.processNumber || "",
        claimantName: c.claimantName || "",
        notes: c.notes || "",
        originalValue: c.originalValue,
        startDate: c.startDate.split('T')[0],
        endDate: c.endDate.split('T')[0],
        correctionIndex: c.correctionIndex as CorrectionIndex,
        interestRule: c.interestRule as InterestRule,
      });
      setPublicKey(c.publicKey);
      if (existingCalc.result) {
        setResultData(existingCalc.result);
        setActiveTab("result");
      }
    }
  }, [existingCalc, form]);

  const onCalcular = async (values: FormValues) => {
    try {
      let calcId = currentId;
      
      // If new, create first
      if (!calcId) {
        const res = await createMut.mutateAsync({ data: values });
        calcId = res.calculation.id;
        setCurrentId(calcId);
        setPublicKey(res.calculation.publicKey);
      }
      
      // Then compute
      const computeRes = await computeMut.mutateAsync({ 
        id: calcId, 
        data: { endDate: values.endDate } 
      });
      
      setResultData(computeRes.result);
      setActiveTab("result");
      
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateReport = async () => {
    if (!currentId) return;
    try {
      const res = await reportMut.mutateAsync({
        id: currentId,
        data: { format: "html" }
      });
      if (res.url) {
        window.open(res.url, "_blank");
      } else if (res.htmlContent) {
        const w = window.open();
        w?.document.write(res.htmlContent);
        w?.document.close();
      }
    } catch(e) {}
  };

  const copyKey = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey);
      toast({ title: "Chave copiada", description: "A chave pública foi copiada para a área de transferência." });
    }
  };

  if (isLoadingExisting) {
    return <div className="p-12 text-center text-muted-foreground animate-pulse">Carregando cálculo...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display text-foreground flex items-center gap-3">
            <Calculator className="w-8 h-8 text-primary" />
            Atualização de Valores
          </h1>
          <p className="text-muted-foreground mt-1">Configure os parâmetros para atualização monetária e juros.</p>
        </div>
        
        {currentId && (
          <div className="flex gap-2">
            <Badge variant="outline" className="px-3 py-1 font-mono text-xs hidden md:flex items-center gap-2 border-primary/30">
              CHAVE: {publicKey}
              <button onClick={copyKey} className="hover:text-primary transition-colors">
                <Copy className="w-3 h-3" />
              </button>
            </Badge>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* FORM SECTION */}
        <Card className={`lg:col-span-${activeTab === 'result' ? '4' : '8'} transition-all duration-500 shadow-md`}>
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle className="text-lg">Parâmetros do Cálculo</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCalcular)} className="space-y-6">
                
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Identificação</h3>
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Cálculo *</FormLabel>
                      <FormControl><Input placeholder="Ex: Cumprimento de Sentença - João Silva" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="processNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nº do Processo</FormLabel>
                        <FormControl><Input placeholder="0000000-00.0000.0.00.0000" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="claimantName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Parte Autor</FormLabel>
                        <FormControl><Input placeholder="Opcional" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Valores e Datas</h3>
                  <FormField control={form.control} name="originalValue" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Original (R$) *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                          <Input type="number" step="0.01" className="pl-9" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="startDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Base (Inicial) *</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="endDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data da Atualização (Final) *</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Índices</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="correctionIndex" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Índice de Correção Monetária *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={CorrectionIndex.IPCA_E}>IPCA-E</SelectItem>
                            <SelectItem value={CorrectionIndex.IPCA}>IPCA</SelectItem>
                            <SelectItem value={CorrectionIndex.INPC}>INPC</SelectItem>
                            <SelectItem value={CorrectionIndex.SELIC}>SELIC (Apenas)</SelectItem>
                            <SelectItem value={CorrectionIndex.TR}>TR</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="interestRule" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Regra de Juros de Mora *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={InterestRule.none}>Sem Juros</SelectItem>
                            <SelectItem value={InterestRule.simple_1_percent}>1% a.m. Simples</SelectItem>
                            <SelectItem value={InterestRule.compound_selic}>Selic Composto</SelectItem>
                            <SelectItem value={InterestRule.compound_12_percent_year}>12% a.a. Composto</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl><Textarea placeholder="Anotações internas..." className="resize-none h-20" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full text-md h-12"
                  disabled={createMut.isPending || computeMut.isPending}
                >
                  {computeMut.isPending ? (
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Calculator className="w-5 h-5 mr-2" />
                  )}
                  PROCESSAR CÁLCULO
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* RESULTS SECTION */}
        <AnimatePresence>
          {activeTab === 'result' && resultData && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-8 space-y-6"
            >
              <Card className="border-primary/30 shadow-lg overflow-hidden">
                <div className="bg-primary text-primary-foreground px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <h2 className="font-display font-bold text-xl">Resultado da Apuração</h2>
                  </div>
                  <Badge variant="outline" className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 no-default-active-elevate">
                    Calculado
                  </Badge>
                </div>
                
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-b border-border/50 bg-muted/10">
                    <div className="p-6">
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Valor Original</p>
                      <p className="text-2xl font-semibold">{formatCurrency(resultData.originalValue)}</p>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" /> Base: {formatDate(resultData.startDate)}
                      </p>
                    </div>
                    <div className="p-6">
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Fator Acumulado</p>
                      <p className="text-2xl font-semibold font-mono">{resultData.accumulatedFactor.toFixed(6)}</p>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> {resultData.correctionIndex} + Juros
                      </p>
                    </div>
                    <div className="p-6 bg-primary/5">
                      <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-1">Valor Final</p>
                      <p className="text-3xl font-bold text-primary">{formatCurrency(resultData.finalValue)}</p>
                      <p className="text-xs text-primary/70 mt-2 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" /> Atualizado: {formatDate(resultData.endDate)}
                      </p>
                    </div>
                  </div>

                  <div className="p-6">
                    <h3 className="font-semibold mb-4 text-foreground/80 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Memória de Cálculo Resumida
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between py-2 border-b border-dashed">
                        <span className="text-muted-foreground">Valor Principal Corrigido</span>
                        <span className="font-medium">{formatCurrency(resultData.correctedValue)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-dashed">
                        <span className="text-muted-foreground">Juros Acumulados</span>
                        <span className="font-medium">{formatCurrency(resultData.interestValue)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-dashed">
                        <span className="text-muted-foreground">Total de Meses</span>
                        <span className="font-medium">{resultData.totalMonths} meses</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-dashed">
                        <span className="text-muted-foreground">Índices Base</span>
                        <span className="font-medium">{resultData.dataSource}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/30 p-4 flex flex-wrap gap-3 justify-end border-t">
                  <Button variant="outline" onClick={() => setShowKeyDialog(true)}>
                    <KeyRound className="w-4 h-4 mr-2" />
                    CHAVE DE ACESSO
                  </Button>
                  <Button variant="default" onClick={handleGenerateReport} disabled={reportMut.isPending}>
                    {reportMut.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                    GERAR RELATÓRIO (HTML)
                  </Button>
                </CardFooter>
              </Card>

              {/* Tabela Detalhada */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Evolução Mensal (Tabela de Índices)</CardTitle>
                  <CardDescription>Demonstrativo mês a mês aplicado sobre o valor original.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px] w-full rounded-b-lg border-t">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0 backdrop-blur-md">
                        <TableRow>
                          <TableHead className="w-[120px]">Competência</TableHead>
                          <TableHead className="text-right">Taxa/Índice do Mês</TableHead>
                          <TableHead className="text-right">Fator Acumulado</TableHead>
                          <TableHead>Fonte</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resultData.indexTable.map((row, i) => (
                          <TableRow key={i} className="hover:bg-muted/30">
                            <TableCell className="font-medium">{row.period}</TableCell>
                            <TableCell className="text-right font-mono">{formatPercent(row.rate)}</TableCell>
                            <TableCell className="text-right font-mono">{row.accumulatedFactor.toFixed(6)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{row.source}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="sm:max-w-md border-primary/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Chave de Recuperação
            </DialogTitle>
            <DialogDescription>
              Guarde esta chave. Ela é necessária para recuperar e editar este cálculo futuramente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 my-4">
            <div className="grid flex-1 gap-2">
              <Input
                readOnly
                value={publicKey || ""}
                className="h-14 text-center font-mono text-lg tracking-widest bg-muted/50 border-primary/30"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowKeyDialog(false)}>Fechar</Button>
            <Button onClick={copyKey} className="gap-2">
              <Copy className="w-4 h-4" />
              Copiar Chave
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
