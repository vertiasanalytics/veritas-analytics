/**
 * perito-assistente.tsx — Solicitação de Perito Contador Assistente
 * Veritas Analytics
 *
 * Exibe o cartão profissional do perito e permite que advogados
 * solicitem assistência técnica em processos judiciais.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  User, Phone, Mail, Award, MessageSquare,
  Send, CheckCircle2, Briefcase, Scale, FileText,
  CalendarClock, Building2, ClipboardList,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const WHATSAPP_NUMBER = "5533999991914";
const PERITO_EMAIL    = "vasconceloswakim@yahoo.com.br";
const PERITO_NOME     = "Dr. Vasconcelos Reis Wakim";
const PERITO_CRC      = "CRCMG 082870/O-8";
const PERITO_TELEFONE = "(33) 9 9999-1914";

const TIPOS_DEMANDA = [
  "Cálculo Judicial Trabalhista",
  "Liquidação de Sentença Cível",
  "Revisão de Pensão Alimentícia",
  "Danos Emergentes e Lucros Cessantes",
  "Cálculo Previdenciário",
  "Liquidação Estadual",
  "Perícia Contábil",
  "Assistência Técnica em Perícia",
  "Outro",
];

interface FormState {
  processo: string;
  tribunal: string;
  vara: string;
  tipoDemanda: string;
  prazo: string;
  descricao: string;
}

const FORM_VAZIO: FormState = {
  processo:    "",
  tribunal:    "",
  vara:        "",
  tipoDemanda: "",
  prazo:       "",
  descricao:   "",
};

export default function PeritoAssistente() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [enviado, setEnviado] = useState(false);

  const nome  = (user as any)?.nome  || (user as any)?.name  || "";
  const email = (user as any)?.email || "";

  const mutation = useMutation({
    mutationFn: async () => {
      const descricaoCompleta = [
        `**Processo:** ${form.processo || "Não informado"}`,
        `**Tribunal:** ${form.tribunal || "Não informado"}`,
        `**Vara:** ${form.vara || "Não informado"}`,
        `**Tipo de demanda:** ${form.tipoDemanda || "Não informado"}`,
        `**Prazo:** ${form.prazo || "Não informado"}`,
        ``,
        `**Descrição da necessidade:**`,
        form.descricao,
      ].join("\n");

      const res = await fetch(`${API_BASE}/api/support`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          email,
          assunto:    "Solicitação de Perito Assistente",
          prioridade: "normal",
          modulo:     "Perito Assistente",
          descricao:  descricaoCompleta,
          steps:      "",
        }),
      });
      if (!res.ok) throw new Error("Falha ao enviar solicitação");
      return res.json();
    },
    onSuccess: () => {
      setEnviado(true);
      setForm(FORM_VAZIO);
      toast({ title: "Solicitação enviada!", description: "O Dr. Wakim entrará em contato em breve." });
    },
    onError: () => {
      toast({ title: "Erro ao enviar", description: "Tente novamente ou entre em contato pelo WhatsApp.", variant: "destructive" });
    },
  });

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Olá, Dr. Wakim! Sou ${nome || "advogado(a)"} e gostaria de solicitar assistência técnica como Perito Contador Assistente através da plataforma Veritas Analytics.`
  )}`;

  const canSubmit = form.tipoDemanda && form.descricao.trim().length >= 20;

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-display text-foreground">Perito Contador Assistente</h1>
        <p className="text-muted-foreground mt-1">
          Solicite a assistência técnica de um perito contador especializado em cálculos judiciais.
        </p>
      </div>

      {/* Cartão Profissional */}
      <Card className="overflow-hidden border-[#17365d]/20 shadow-md">
        <div className="bg-gradient-to-r from-[#17365d] via-[#1e4a7a] to-[#17365d] px-6 py-5 text-white">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 border-2 border-white/30">
              <User className="w-8 h-8 text-white/90" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <h2 className="text-xl font-bold text-white">{PERITO_NOME}</h2>
                <Badge className="bg-white/20 text-white border-white/30 text-[10px] font-semibold px-2">
                  <Award className="w-3 h-3 mr-1" />
                  {PERITO_CRC}
                </Badge>
              </div>
              <p className="text-white/70 text-sm">Contador Público · Perito Judicial · Assistente Técnico</p>
            </div>
          </div>
        </div>

        <CardContent className="p-6">
          {/* Especialidades */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Áreas de atuação pericial
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "Cálculos Trabalhistas",
                "Liquidação de Sentença",
                "Revisão Alimentícia",
                "Danos Materiais",
                "Cálculos Previdenciários",
                "Perícia Contábil",
                "Assistência Técnica",
              ].map((esp) => (
                <Badge key={esp} variant="secondary" className="text-xs font-medium px-3 py-1">
                  {esp}
                </Badge>
              ))}
            </div>
          </div>

          <Separator className="mb-6" />

          {/* Contatos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
              <Phone className="w-4 h-4 text-[#17365d] flex-shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Telefone / WhatsApp</p>
                <p className="text-sm font-semibold text-foreground">{PERITO_TELEFONE}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
              <Mail className="w-4 h-4 text-[#17365d] flex-shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">E-mail profissional</p>
                <p className="text-sm font-semibold text-foreground break-all">{PERITO_EMAIL}</p>
              </div>
            </div>
          </div>

          {/* Botões de contato direto */}
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button className="w-full bg-[#25d366] hover:bg-[#1fba59] text-white gap-2 font-semibold">
                <MessageSquare className="w-4 h-4" />
                Contato via WhatsApp
              </Button>
            </a>
            <a
              href={`mailto:${PERITO_EMAIL}?subject=Solicitação de Perito Assistente – Veritas Analytics`}
              className="flex-1"
            >
              <Button variant="outline" className="w-full gap-2 border-[#17365d]/30 text-[#17365d] hover:bg-[#17365d]/5">
                <Mail className="w-4 h-4" />
                Enviar E-mail
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Formulário de Solicitação */}
      {enviado ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-8 flex flex-col items-center text-center gap-3">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <h3 className="text-lg font-semibold text-green-800">Solicitação registrada com sucesso!</h3>
            <p className="text-sm text-green-700 max-w-sm">
              O Dr. Wakim recebeu sua solicitação e entrará em contato através dos dados informados no seu perfil.
            </p>
            <Button
              variant="outline"
              className="mt-2 border-green-300 text-green-700 hover:bg-green-100"
              onClick={() => setEnviado(false)}
            >
              Enviar nova solicitação
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm border-border/60">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#17365d]" />
              Solicitar Assistência Técnica
            </CardTitle>
            <CardDescription>
              Preencha os dados do processo. Sua solicitação será registrada e o perito entrará em contato.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">

            {/* Dados do processo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="processo" className="flex items-center gap-1.5 text-xs font-semibold">
                  <FileText className="w-3.5 h-3.5" /> Número do processo
                </Label>
                <Input
                  id="processo"
                  value={form.processo}
                  onChange={(e) => setForm((f) => ({ ...f, processo: e.target.value }))}
                  placeholder="0000000-00.0000.0.00.0000"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tribunal" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Building2 className="w-3.5 h-3.5" /> Tribunal / Juízo
                </Label>
                <Input
                  id="tribunal"
                  value={form.tribunal}
                  onChange={(e) => setForm((f) => ({ ...f, tribunal: e.target.value }))}
                  placeholder="Ex: TJMG, TRT 3ª Região, JFMG"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="vara" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Scale className="w-3.5 h-3.5" /> Vara / Câmara
                </Label>
                <Input
                  id="vara"
                  value={form.vara}
                  onChange={(e) => setForm((f) => ({ ...f, vara: e.target.value }))}
                  placeholder="Ex: 3ª Vara do Trabalho de Governador Valadares"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prazo" className="flex items-center gap-1.5 text-xs font-semibold">
                  <CalendarClock className="w-3.5 h-3.5" /> Prazo / Urgência
                </Label>
                <Input
                  id="prazo"
                  type="date"
                  value={form.prazo}
                  onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tipoDemanda" className="flex items-center gap-1.5 text-xs font-semibold">
                <Briefcase className="w-3.5 h-3.5" /> Tipo de demanda <span className="text-red-500">*</span>
              </Label>
              <select
                id="tipoDemanda"
                value={form.tipoDemanda}
                onChange={(e) => setForm((f) => ({ ...f, tipoDemanda: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Selecione o tipo de demanda…</option>
                {TIPOS_DEMANDA.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="descricao" className="flex items-center gap-1.5 text-xs font-semibold">
                <MessageSquare className="w-3.5 h-3.5" /> Descrição da necessidade <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="descricao"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Descreva o que é necessário: tipo de cálculo, pontos controvertidos, pretensão da parte, documentos disponíveis…"
                className="min-h-[120px] text-sm resize-none"
              />
              <p className="text-[11px] text-muted-foreground text-right">
                {form.descricao.length} caracteres {form.descricao.length < 20 && form.descricao.length > 0 && <span className="text-amber-500">(mínimo 20)</span>}
              </p>
            </div>

            <div className="pt-1">
              <Button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !canSubmit}
                className="w-full sm:w-auto bg-[#17365d] hover:bg-[#1e4a7a] text-white gap-2"
              >
                {mutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enviando…
                  </span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar solicitação
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                * Campos obrigatórios. Você receberá retorno pelo e-mail cadastrado na plataforma.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informação sobre o serviço */}
      <Card className="bg-[#17365d]/5 border-[#17365d]/20">
        <CardContent className="p-5">
          <h3 className="font-semibold text-[#17365d] mb-2 flex items-center gap-2">
            <Award className="w-4 h-4" />
            Como funciona a assistência técnica
          </h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><span className="text-[#17365d] font-bold mt-0.5">1.</span> Preencha o formulário com os dados do processo e envie a solicitação.</li>
            <li className="flex items-start gap-2"><span className="text-[#17365d] font-bold mt-0.5">2.</span> O Dr. Wakim analisará a demanda e entrará em contato para alinhar escopo, honorários e prazo.</li>
            <li className="flex items-start gap-2"><span className="text-[#17365d] font-bold mt-0.5">3.</span> Após contratação, o laudo pericial é elaborado com o suporte da plataforma Veritas Analytics.</li>
            <li className="flex items-start gap-2"><span className="text-[#17365d] font-bold mt-0.5">4.</span> O advogado recebe o relatório técnico assinado, pronto para juntada aos autos.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
