import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Landmark, Loader2, Eye, EyeOff, CheckCircle2,
  ChevronRight, ShieldCheck, KeyRound,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA",
  "MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN",
  "RO","RR","RS","SC","SE","SP","TO",
];

interface ConvenioOption {
  id: string;
  codigo: string;
  nomeConvenio: string;
  tipoConvenio: string;
  dataFim: string;
}

type Stage = "form" | "escolha" | "sucesso";

function PasswordStrength({ senha }: { senha: string }) {
  const hasLen = senha.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(senha);
  const hasNumber = /[0-9]/.test(senha);

  if (!senha) return null;
  return (
    <div className="mt-1.5 space-y-1">
      {[
        { ok: hasLen, label: "Mínimo 8 caracteres" },
        { ok: hasLetter, label: "Pelo menos 1 letra" },
        { ok: hasNumber, label: "Pelo menos 1 número" },
      ].map(({ ok, label }) => (
        <div key={label} className={`flex items-center gap-1.5 text-xs ${ok ? "text-green-600" : "text-slate-400"}`}>
          <CheckCircle2 className="h-3 w-3" />
          {label}
        </div>
      ))}
    </div>
  );
}

export default function ConvenioSignup() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>("form");
  const [loading, setLoading] = useState(false);
  const [convenioOptions, setConvenioOptions] = useState<ConvenioOption[]>([]);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Formulário
  const [form, setForm] = useState({
    codigoConvenio: "",
    nome: "",
    email: "",
    senha: "",
    confirmarSenha: "",
    cpf: "",
    telefone: "",
    numeroOab: "",
    ufOab: "",
    matricula: "",
    dataNascimento: "",
    cidade: "",
    estado: "",
    especialidade: "",
  });

  function f(field: keyof typeof form, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  function formatCpf(v: string) {
    const n = v.replace(/\D/g, "").slice(0, 11);
    return n
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  function formatTel(v: string) {
    const n = v.replace(/\D/g, "").slice(0, 11);
    if (n.length <= 10) return n.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
    return n.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
  }

  function validate(): string | null {
    if (!form.codigoConvenio.trim()) return "Informe o código do convênio fornecido pela sua instituição.";
    if (!form.nome.trim()) return "Informe o nome completo.";
    if (!form.email.trim()) return "Informe o e-mail.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "E-mail inválido.";
    if (!form.senha) return "Informe a senha.";
    if (form.senha.length < 8) return "A senha deve ter ao menos 8 caracteres.";
    if (!/[a-zA-Z]/.test(form.senha) || !/[0-9]/.test(form.senha)) return "A senha deve conter ao menos 1 letra e 1 número.";
    if (form.senha !== form.confirmarSenha) return "As senhas não coincidem.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent, convenioId?: string) {
    e.preventDefault();
    const err = validate();
    if (err) { toast({ title: "Atenção", description: err, variant: "destructive" }); return; }

    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/signup-convenio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigoConvenio: form.codigoConvenio.trim().toUpperCase(),
          nome: form.nome,
          email: form.email,
          senha: form.senha,
          cpf: form.cpf || undefined,
          telefone: form.telefone || undefined,
          numeroOab: form.numeroOab || undefined,
          ufOab: form.ufOab || undefined,
          matricula: form.matricula || undefined,
          dataNascimento: form.dataNascimento || undefined,
          cidade: form.cidade || undefined,
          estado: form.estado || undefined,
          especialidade: form.especialidade || undefined,
        }),
      });

      const data = await res.json();

      if (res.status === 300 && data.code === "multiplos_convenios") {
        setConvenioOptions(data.convenios);
        setStage("escolha");
        return;
      }

      if (!res.ok) {
        if (data.code === "email_duplicado") {
          toast({
            title: "E-mail já cadastrado",
            description: "Este e-mail já possui cadastro neste convênio. Acesse a página de login para entrar.",
            variant: "destructive",
          });
          return;
        }
        const title =
          data.code === "nao_elegivel"
            ? "Acesso não liberado"
            : data.code === "sem_convenio"
            ? "Convênio não encontrado"
            : "Erro no cadastro";
        toast({ title, description: data.error || "Tente novamente.", variant: "destructive" });
        return;
      }

      // Salva token e redireciona para o painel
      localStorage.setItem("veritas_token", data.token);
      setStage("sucesso");
    } catch {
      toast({ title: "Erro", description: "Não foi possível conectar ao servidor.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleEscolha(convenioId: string) {
    const synth = { preventDefault: () => {} } as React.FormEvent;
    await handleSubmit(synth, convenioId);
  }

  // ─── Estágio: Sucesso ──────────────────────────────────────────────────────
  if (stage === "sucesso") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
          <CardContent className="p-8 text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <ShieldCheck className="h-9 w-9 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Cadastro concluído!</h2>
            <p className="text-sm text-slate-600">
              Seu cadastro conveniado foi concluído com sucesso. Você já pode acessar a plataforma.
            </p>
            <Button className="w-full bg-blue-700 hover:bg-blue-800" onClick={() => { window.location.href = `${BASE}/convenio/painel`; }}>
              Acessar o painel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Estágio: Escolha de convênio ─────────────────────────────────────────
  if (stage === "escolha") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-slate-900 to-blue-900 px-6 py-5">
            <h2 className="text-white font-bold text-lg">Múltiplos convênios encontrados</h2>
            <p className="text-blue-200 text-sm mt-0.5">
              Mais de um convênio compatível foi encontrado. Escolha um para continuar.
            </p>
          </div>
          <CardContent className="p-5 space-y-3">
            {convenioOptions.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={loading}
                onClick={() => handleEscolha(c.id)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm hover:bg-blue-50 hover:border-blue-200 transition"
              >
                <div>
                  <div className="font-semibold text-slate-800">{c.nomeConvenio}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{c.tipoConvenio} · Código: {c.codigo} · Válido até: {new Date(c.dataFim).toLocaleDateString("pt-BR")}</div>
                </div>
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              </button>
            ))}
            <button
              type="button"
              className="w-full text-center text-sm text-slate-500 hover:text-slate-700 pt-2"
              onClick={() => setStage("form")}
            >
              ← Voltar e revisar dados
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Estágio: Formulário ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-blue-900 px-8 py-6 flex items-center gap-4">
            <div className="rounded-xl bg-blue-800 p-2.5">
              <Landmark className="h-6 w-6 text-blue-100" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">Cadastro via Convênio</h2>
              <p className="text-blue-200 text-sm">Área exclusiva para usuários institucionais conveniados</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">

            {/* Código do convênio */}
            <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="h-4 w-4 text-blue-700" />
                <span className="text-sm font-semibold text-blue-900">Código do convênio *</span>
              </div>
              <Input
                placeholder="XXXX-XXXX"
                value={form.codigoConvenio}
                onChange={(e) => f("codigoConvenio", e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                className="font-mono font-bold text-base tracking-widest text-center uppercase bg-white"
                maxLength={9}
              />
              <p className="text-xs text-blue-700 mt-2">
                Informe o código fornecido pela sua instituição. Sem ele, o cadastro não pode ser concluído.
              </p>
            </div>

            {/* Dados pessoais */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Dados pessoais</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label className="text-sm text-slate-700">Nome completo *</Label>
                  <Input className="mt-1" placeholder="Seu nome completo" value={form.nome} onChange={(e) => f("nome", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm text-slate-700">E-mail *</Label>
                  <Input className="mt-1" type="email" placeholder="seu@email.com.br" value={form.email} onChange={(e) => f("email", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm text-slate-700">CPF</Label>
                  <Input className="mt-1" placeholder="000.000.000-00" value={form.cpf} onChange={(e) => f("cpf", formatCpf(e.target.value))} />
                </div>
                <div>
                  <Label className="text-sm text-slate-700">Telefone</Label>
                  <Input className="mt-1" placeholder="(00) 00000-0000" value={form.telefone} onChange={(e) => f("telefone", formatTel(e.target.value))} />
                </div>
              </div>
            </div>

            {/* Dados de identificação */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Identificação profissional</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Label className="text-sm text-slate-700">Número da OAB</Label>
                  <Input className="mt-1" placeholder="000000" value={form.numeroOab} onChange={(e) => f("numeroOab", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm text-slate-700">UF da OAB</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.ufOab}
                    onChange={(e) => f("ufOab", e.target.value)}
                  >
                    <option value="">UF</option>
                    {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <Label className="text-sm text-slate-700">Matrícula institucional (se aplicável)</Label>
                  <Input className="mt-1" placeholder="Matrícula" value={form.matricula} onChange={(e) => f("matricula", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Dados opcionais */}
            <details className="group">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-blue-600 hover:text-blue-800 list-none flex items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                Dados adicionais (opcionais)
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-sm text-slate-700">Data de nascimento</Label>
                  <Input className="mt-1" type="date" value={form.dataNascimento} onChange={(e) => f("dataNascimento", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm text-slate-700">Especialidade</Label>
                  <Input className="mt-1" placeholder="Ex: Trabalhista" value={form.especialidade} onChange={(e) => f("especialidade", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm text-slate-700">Cidade</Label>
                  <Input className="mt-1" placeholder="Cidade" value={form.cidade} onChange={(e) => f("cidade", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm text-slate-700">Estado</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.estado}
                    onChange={(e) => f("estado", e.target.value)}
                  >
                    <option value="">Estado</option>
                    {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
              </div>
            </details>

            {/* Senha */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Senha de acesso</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-sm text-slate-700">Senha *</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showPass ? "text" : "password"}
                      placeholder="Mínimo 8 caracteres"
                      value={form.senha}
                      onChange={(e) => f("senha", e.target.value)}
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShowPass((v) => !v)}>
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <PasswordStrength senha={form.senha} />
                </div>
                <div>
                  <Label className="text-sm text-slate-700">Confirmar senha *</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Repita a senha"
                      value={form.confirmarSenha}
                      onChange={(e) => f("confirmarSenha", e.target.value)}
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShowConfirm((v) => !v)}>
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {form.confirmarSenha && form.senha !== form.confirmarSenha && (
                    <p className="text-xs text-red-500 mt-1.5">As senhas não coincidem</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />
              A senha é armazenada com criptografia segura (bcrypt) e nunca é visível para terceiros.
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 font-semibold text-white py-2.5"
            >
              {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              {loading ? "Verificando elegibilidade..." : "Cadastrar via Convênio"}
            </Button>

            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
                onClick={() => navigate("/login")}
              >
                <ArrowLeft size={14} /> Voltar para o login
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-blue-300 mt-4">
          Veritas Analytics · Acesso Institucional Conveniado
        </p>
      </div>
    </div>
  );
}
