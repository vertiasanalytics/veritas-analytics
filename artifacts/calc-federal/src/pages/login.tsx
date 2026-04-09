import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Gift, UserPlus, LogIn, ArrowLeft, FlaskConical, CheckCircle2, XCircle, Landmark } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Mode = "login" | "forgot" | "register";

const PROFISSOES = [
  "Advogado(a)",
  "Contador(a)",
  "Perito(a) Judicial",
  "Analista Jurídico",
  "Assistente Jurídico",
  "Servidor Público",
  "Outro",
];

export default function Login() {
  const { login, loginDemo } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // ── modos
  const [mode, setMode] = useState<Mode>("login");

  // ── demo modal
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function handleDemo() {
    setDemoLoading(true);
    try {
      await loginDemo();
      navigate("/");
    } catch (err: unknown) {
      toast({
        title: "Erro ao entrar no modo demo",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setDemoLoading(false);
      setShowDemoModal(false);
    }
  }

  // ── login
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── esqueci senha
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  // ── cadastro
  const [reg, setReg] = useState({
    nome: "",
    email: "",
    tipoPessoa: "PF" as "PF" | "PJ",
    profissao: "",
    telefone: "",
    cpfCnpj: "",
    senha: "",
    confirmarSenha: "",
  });
  const [showRegPass, setShowRegPass] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  function setRegField(field: string, value: string) {
    setReg((prev) => ({ ...prev, [field]: value }));
  }

  // ── handlers
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const loggedUser = await login(email, senha);
      if (loggedUser.role === "convenio") {
        if (loggedUser.primeiroAcessoPendente || loggedUser.redefinirSenhaObrigatoria) {
          navigate("/convenio/primeiro-acesso");
        } else {
          navigate("/convenio/painel");
        }
      } else {
        navigate("/");
      }
    } catch (err: unknown) {
      toast({
        title: "Erro ao entrar",
        description: err instanceof Error ? err.message : "Credenciais inválidas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await fetch(`${BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      toast({
        title: "Email enviado",
        description: "Se o email estiver cadastrado, você receberá a senha provisória em breve.",
      });
      setMode("login");
      setForgotEmail("");
    } catch {
      toast({ title: "Erro", description: "Não foi possível processar a solicitação.", variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!reg.nome.trim() || !reg.email.trim() || !reg.senha) {
      toast({ title: "Campos obrigatórios", description: "Preencha nome, email e senha.", variant: "destructive" });
      return;
    }
    if (reg.senha.length < 6) {
      toast({ title: "Senha fraca", description: "A senha deve ter ao menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (reg.senha !== reg.confirmarSenha) {
      toast({ title: "Senhas diferentes", description: "A confirmação de senha não confere.", variant: "destructive" });
      return;
    }

    setRegLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: reg.nome,
          email: reg.email,
          senha: reg.senha,
          tipoPessoa: reg.tipoPessoa,
          profissao: reg.profissao || undefined,
          telefone: reg.telefone || undefined,
          cpfCnpj: reg.cpfCnpj || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erro no cadastro", description: data.error || "Tente novamente.", variant: "destructive" });
        return;
      }

      // Salva token e redireciona (mesmo fluxo do login)
      localStorage.setItem("veritas_token", data.token);
      window.location.href = `${BASE}/`;
    } catch {
      toast({ title: "Erro", description: "Não foi possível realizar o cadastro.", variant: "destructive" });
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-blue-900 px-8 pt-8 pb-6 flex flex-col items-center">
            <img
              src={`${BASE}/logo.png`}
              alt="Veritas Analytics"
              className="h-24 w-auto object-contain mb-4 drop-shadow-lg"
            />
            <p className="text-blue-200 text-sm text-center">
              Plataforma de Cálculos Judiciais Federais
            </p>
          </div>

          {/* Body */}
          <div className="px-8 py-7">

            {/* ── LOGIN ─────────────────────────────────────────────────── */}
            {mode === "login" && (
              <>
                <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">Acesso ao Sistema</h2>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="email" className="text-slate-700 text-sm font-medium">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="mt-1"
                      placeholder="seu@email.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="senha" className="text-slate-700 text-sm font-medium">Senha</Label>
                    <div className="relative mt-1">
                      <Input
                        id="senha"
                        type={showPass ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        placeholder="••••••••"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        onClick={() => setShowPass(!showPass)}
                      >
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-lg mt-2"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : <LogIn size={16} className="mr-2" />}
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>

                <div className="mt-4 flex flex-col items-center gap-2">
                  <button
                    type="button"
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    onClick={() => setMode("forgot")}
                  >
                    Esqueceu sua senha?
                  </button>

                  <div className="w-full border-t border-slate-100 my-1" />

                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-900 font-medium hover:underline"
                    onClick={() => setMode("register")}
                  >
                    <UserPlus size={15} />
                    Criar nova conta — ganhe 10 créditos grátis
                  </button>

                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline"
                    onClick={() => navigate("/convenio/signup")}
                  >
                    <Landmark size={15} />
                    Cadastrar-se via convênio institucional
                  </button>

                </div>

                {/* ── Demo CTA ─────────────────────────────────────── */}
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-px bg-slate-100" />
                    <span className="text-xs text-slate-400 font-medium px-1">ou explore sem cadastro</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowDemoModal(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 px-4 font-semibold text-sm text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                    style={{
                      background: "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)",
                      boxShadow: "0 2px 10px rgba(124,58,237,0.35)",
                    }}
                  >
                    <FlaskConical size={16} />
                    Experimentar gratuitamente — Modo Demonstração
                  </button>

                  <p className="text-center text-xs text-slate-400 mt-2">
                    Sem cadastro · Sem cartão · Acesso imediato
                  </p>
                </div>
              </>
            )}

            {/* ── ESQUECI SENHA ─────────────────────────────────────────── */}
            {mode === "forgot" && (
              <>
                <h2 className="text-xl font-bold text-slate-800 mb-2 text-center">Recuperar Senha</h2>
                <p className="text-slate-500 text-sm text-center mb-6">
                  Informe seu email cadastrado e enviaremos uma senha provisória.
                </p>
                <form onSubmit={handleForgot} className="space-y-4">
                  <div>
                    <Label htmlFor="forgot-email" className="text-slate-700 text-sm font-medium">Email cadastrado</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      required
                      className="mt-1"
                      placeholder="seu@email.com.br"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                    {forgotLoading ? "Enviando..." : "Enviar senha provisória"}
                  </Button>
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-1 text-sm text-slate-500 hover:text-slate-700 pt-1"
                    onClick={() => setMode("login")}
                  >
                    <ArrowLeft size={14} /> Voltar ao login
                  </button>
                </form>
              </>
            )}

            {/* ── CADASTRO ──────────────────────────────────────────────── */}
            {mode === "register" && (
              <>
                <h2 className="text-xl font-bold text-slate-800 mb-1 text-center">Criar Conta</h2>

                {/* Banner de bônus */}
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 mb-5">
                  <Gift size={18} className="text-emerald-600 shrink-0" />
                  <p className="text-sm text-emerald-800 font-medium">
                    Ganhe <strong>10 créditos grátis</strong> ao concluir o cadastro!
                  </p>
                </div>

                <form onSubmit={handleRegister} className="space-y-3">
                  {/* Nome */}
                  <div>
                    <Label className="text-slate-700 text-sm font-medium">Nome completo <span className="text-red-500">*</span></Label>
                    <Input
                      required
                      className="mt-1"
                      placeholder="Seu nome completo"
                      value={reg.nome}
                      onChange={(e) => setRegField("nome", e.target.value)}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <Label className="text-slate-700 text-sm font-medium">Email <span className="text-red-500">*</span></Label>
                    <Input
                      type="email"
                      required
                      className="mt-1"
                      placeholder="seu@email.com.br"
                      value={reg.email}
                      onChange={(e) => setRegField("email", e.target.value)}
                    />
                  </div>

                  {/* Tipo Pessoa */}
                  <div>
                    <Label className="text-slate-700 text-sm font-medium">Tipo de pessoa</Label>
                    <div className="flex gap-3 mt-2">
                      {(["PF", "PJ"] as const).map((tipo) => (
                        <label key={tipo} className={`flex-1 flex items-center justify-center gap-2 border rounded-lg py-2 cursor-pointer text-sm font-medium transition-colors ${reg.tipoPessoa === tipo ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                          <input
                            type="radio"
                            name="tipoPessoa"
                            value={tipo}
                            checked={reg.tipoPessoa === tipo}
                            onChange={() => setRegField("tipoPessoa", tipo)}
                            className="sr-only"
                          />
                          {tipo === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Profissão */}
                  <div>
                    <Label className="text-slate-700 text-sm font-medium">Profissão / Área de atuação</Label>
                    <select
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={reg.profissao}
                      onChange={(e) => setRegField("profissao", e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {PROFISSOES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  {/* Telefone */}
                  <div>
                    <Label className="text-slate-700 text-sm font-medium">Telefone / WhatsApp</Label>
                    <Input
                      type="tel"
                      className="mt-1"
                      placeholder="(11) 99999-0000"
                      value={reg.telefone}
                      onChange={(e) => setRegField("telefone", e.target.value)}
                    />
                  </div>

                  {/* CPF / CNPJ */}
                  <div>
                    <Label className="text-slate-700 text-sm font-medium">{reg.tipoPessoa === "PJ" ? "CNPJ" : "CPF"}</Label>
                    <Input
                      className="mt-1"
                      placeholder={reg.tipoPessoa === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
                      value={reg.cpfCnpj}
                      onChange={(e) => setRegField("cpfCnpj", e.target.value)}
                    />
                  </div>

                  {/* Senha */}
                  <div>
                    <Label className="text-slate-700 text-sm font-medium">Senha <span className="text-red-500">*</span></Label>
                    <div className="relative mt-1">
                      <Input
                        type={showRegPass ? "text" : "password"}
                        required
                        placeholder="Mínimo 6 caracteres"
                        value={reg.senha}
                        onChange={(e) => setRegField("senha", e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        onClick={() => setShowRegPass(!showRegPass)}
                      >
                        {showRegPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirmar Senha */}
                  <div>
                    <Label className="text-slate-700 text-sm font-medium">Confirmar senha <span className="text-red-500">*</span></Label>
                    <Input
                      type={showRegPass ? "text" : "password"}
                      required
                      className="mt-1"
                      placeholder="Repita a senha"
                      value={reg.confirmarSenha}
                      onChange={(e) => setRegField("confirmarSenha", e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg mt-1"
                    disabled={regLoading}
                  >
                    {regLoading
                      ? <><Loader2 className="animate-spin mr-2" size={16} />Criando conta...</>
                      : <><UserPlus size={16} className="mr-2" />Criar conta e entrar</>
                    }
                  </Button>
                </form>

                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-1 text-sm text-slate-500 hover:text-slate-700 mt-4"
                  onClick={() => setMode("login")}
                >
                  <ArrowLeft size={14} /> Já tenho conta — fazer login
                </button>
              </>
            )}
          </div>

          <div className="pb-5 text-center">
            <p className="text-xs text-slate-400">Veritas Analytics © 2026 — Acesso restrito</p>
          </div>
        </div>
      </div>

      {/* ── MODAL DEMO ───────────────────────────────────────────────────── */}
      {showDemoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowDemoModal(false)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header violeta */}
            <div className="bg-gradient-to-r from-violet-700 to-blue-700 px-6 py-5 flex items-center gap-3">
              <FlaskConical size={22} className="text-white" />
              <div>
                <h3 className="text-white font-bold text-base">Modo Demonstração</h3>
                <p className="text-violet-200 text-xs mt-0.5">Explore a plataforma sem criar conta</p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-slate-600 text-sm">
                O modo demonstração permite navegar livremente por todos os módulos da Veritas Analytics.
              </p>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">O que está disponível</p>
                {[
                  "Exploração de todos os módulos de cálculo",
                  "Visualização das tabelas de índices e parâmetros",
                  "Acesso à documentação e ao Manual Técnico",
                  "Interface completa sem restrições de navegação",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-slate-700">{item}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Limitações da demonstração</p>
                {[
                  "Cálculos não são salvos ou exportados",
                  "Créditos e wallet não estão ativos",
                  "Criação de processos e clientes bloqueada",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <XCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                    <span className="text-sm text-slate-600">{item}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowDemoModal(false)}
                  disabled={demoLoading}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-violet-700 hover:bg-violet-800 text-white"
                  onClick={handleDemo}
                  disabled={demoLoading}
                >
                  {demoLoading
                    ? <><Loader2 className="animate-spin mr-2" size={15} />Entrando...</>
                    : <><FlaskConical size={15} className="mr-2" />Entrar na Demonstração</>
                  }
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
