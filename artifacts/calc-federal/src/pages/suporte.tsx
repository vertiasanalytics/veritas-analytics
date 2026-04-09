/**
 * suporte.tsx — Suporte Técnico
 * Veritas Analytics
 *
 * Formulário para abertura de chamados técnicos.
 * Os chamados são armazenados no sistema e notificam o administrador.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import {
  AlertCircle, CheckCircle2, Send, Clock, ShieldCheck,
  MessageSquare, LifeBuoy, Zap, Info, Bell,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const MODULOS = [
  "Geral / Sistema",
  "Dashboard",
  "Autenticação / Login",
  "Módulo Previdenciário",
  "Módulo Trabalhista",
  "Módulo Valor da Causa",
  "Módulo Lucro Cessante (DCF)",
  "Módulo Juros / Amortização",
  "Controladoria Jurídica",
  "Índices Econômicos",
  "Tabelas Fiscais (INSS/IRRF)",
  "Planos e Assinaturas",
  "Carteira de Créditos",
  "Backup e Restauração",
  "Equipe",
  "Manual do Sistema",
];

const PRIORIDADES = [
  { value: "critica",  label: "🔴 Crítica",  desc: "Sistema inutilizável, perda de dados" },
  { value: "alta",     label: "🟠 Alta",     desc: "Funcionalidade principal comprometida" },
  { value: "normal",   label: "🟡 Normal",   desc: "Problema afeta uso mas há contorno" },
  { value: "baixa",    label: "🟢 Baixa",    desc: "Melhoria ou dúvida" },
];

interface TicketResult {
  ticketId: number;
  message: string;
}

export default function Suporte() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [nome, setNome]             = useState(user?.nome ?? "");
  const [email, setEmail]           = useState(user?.email ?? "");
  const [assunto, setAssunto]       = useState("");
  const [prioridade, setPrioridade] = useState("normal");
  const [modulo, setModulo]         = useState("Geral / Sistema");
  const [descricao, setDescricao]   = useState("");
  const [steps, setSteps]           = useState("");
  const [result, setResult]         = useState<TicketResult | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/support`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ nome, email, assunto, prioridade, modulo, descricao, steps }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro ao registrar chamado");
      return json as TicketResult;
    },
    onSuccess: (data) => setResult(data),
  });

  if (result) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
        {/* Ícone de sucesso */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">Chamado registrado!</h1>
          <p className="text-muted-foreground text-sm">
            Seu chamado foi aberto com sucesso como{" "}
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-mono" variant="outline">
              #{result.ticketId}
            </Badge>
          </p>
        </div>

        {/* Confirmação */}
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-6 space-y-4">
            <div className="flex gap-3">
              <Bell className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800 mb-1">
                  Administrador notificado automaticamente
                </p>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  O chamado foi registrado no sistema e o administrador foi alertado em tempo real
                  pelo painel de notificações. Você será contatado conforme o prazo de resposta da prioridade selecionada.
                </p>
              </div>
            </div>
            <div className="bg-emerald-100/60 rounded-lg p-3 flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-xs text-emerald-800">
                <span className="font-semibold">Número do protocolo:</span>{" "}
                <span className="font-mono font-bold">#{result.ticketId}</span>
                {" "}— guarde este número para acompanhamento.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Prazo de resposta */}
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="p-4 flex gap-3">
            <Clock className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Prazo de resposta estimado</p>
              <div className="mt-2 space-y-1">
                {PRIORIDADES.map((p) => (
                  <div key={p.value} className={`flex items-center gap-2 text-xs ${prioridade === p.value ? "font-semibold text-blue-800" : "text-muted-foreground"}`}>
                    <span>{p.label}</span>
                    <span className="text-muted-foreground">—</span>
                    <span className={prioridade === p.value ? "text-blue-700" : "text-muted-foreground"}>
                      {p.value === "critica" ? "até 4 horas" : p.value === "alta" ? "até 24 horas" : p.value === "normal" ? "até 72 horas" : "até 7 dias"}
                    </span>
                    {prioridade === p.value && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-100 text-blue-700 border-blue-200">seu chamado</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => {
            setResult(null);
            setAssunto("");
            setDescricao("");
            setSteps("");
            setPrioridade("normal");
            setModulo("Geral / Sistema");
          }}>
            Abrir novo chamado
          </Button>
          <Button className="flex-1" onClick={() => navigate("/dashboard")}>
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LifeBuoy className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-display font-bold text-foreground">Suporte Técnico</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Relate problemas, erros ou sugestões. Nossa equipe responde conforme a prioridade do chamado.
          </p>
        </div>
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/dashboard")}>
          ← Dashboard
        </Button>
      </div>

      {/* Cards informativos */}
      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="p-4 flex items-start gap-3">
            <Send className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-blue-800">Registro automático</p>
              <p className="text-xs text-blue-600 mt-0.5">Chamado salvo instantaneamente no sistema com número de protocolo</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-violet-200 bg-violet-50/40">
          <CardContent className="p-4 flex items-start gap-3">
            <Bell className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-violet-800">Alerta ao administrador</p>
              <p className="text-xs text-violet-600 mt-0.5">Notificação em tempo real no painel do administrador</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="p-4 flex items-start gap-3">
            <Zap className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-emerald-800">Resposta rápida</p>
              <p className="text-xs text-emerald-600 mt-0.5">Chamados críticos respondidos em até 4 horas úteis</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> Novo Chamado de Suporte
          </CardTitle>
          <CardDescription className="text-xs">
            Preencha todas as informações para agilizar a análise. Quanto mais detalhada a descrição, mais rápida a solução.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Identificação */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Seus dados</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nome" className="text-xs">Nome completo <span className="text-red-500">*</span></Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)}
                  placeholder="Dr. João da Silva" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="email" className="text-xs">E-mail de contato <span className="text-red-500">*</span></Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com" className="mt-1" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Chamado */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Detalhes do problema</p>

            <div className="space-y-4">
              <div>
                <Label htmlFor="assunto" className="text-xs">Assunto / título <span className="text-red-500">*</span></Label>
                <Input id="assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)}
                  placeholder="ex: Erro ao gerar PDF no módulo trabalhista" className="mt-1" />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Módulo relacionado</Label>
                  <select
                    value={modulo}
                    onChange={(e) => setModulo(e.target.value)}
                    className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {MODULOS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs">Prioridade <span className="text-red-500">*</span></Label>
                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                    {PRIORIDADES.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPrioridade(p.value)}
                        title={p.desc}
                        className={`h-8 px-2 rounded-md border text-xs font-medium transition-all ${
                          prioridade === p.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {PRIORIDADES.find((p) => p.value === prioridade)?.desc}
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="descricao" className="text-xs">
                  Descrição detalhada do problema <span className="text-red-500">*</span>
                </Label>
                <textarea
                  id="descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva o problema com o máximo de detalhes: o que aconteceu, quando começou, mensagens de erro exibidas, dados utilizados no cálculo, etc."
                  rows={5}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
              </div>

              <div>
                <Label htmlFor="steps" className="text-xs">
                  Passos para reproduzir o problema{" "}
                  <span className="text-muted-foreground font-normal">(recomendado)</span>
                </Label>
                <textarea
                  id="steps"
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  placeholder={
                    "1. Acesse o módulo Trabalhista\n" +
                    "2. Preencha os dados do contrato\n" +
                    "3. Clique em 'Calcular'\n" +
                    "4. O erro aparece na tela"
                  }
                  rows={4}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Aviso */}
          <div className="flex gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" />
            <span>
              Ao registrar o chamado, ele será salvo automaticamente no sistema e o administrador
              receberá um <strong>alerta em tempo real</strong> no painel de notificações.
            </span>
          </div>

          {mutation.isError && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {(mutation.error as any)?.message ?? "Erro ao registrar chamado. Tente novamente."}
            </div>
          )}

          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !nome || !email || !assunto || !descricao}
            className="w-full gap-2"
            size="lg"
          >
            {mutation.isPending ? (
              <><span className="animate-spin">⏳</span> Registrando…</>
            ) : (
              <><Send className="w-4 h-4" /> Registrar chamado</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
