import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Landmark, ShieldAlert } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ConvenioLogin() {
  const { loginConvenio } = useAuth();
  const [, navigate] = useLocation();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !senha) {
      setError("Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    try {
      const user = await loginConvenio(email.trim(), senha);
      if (user.primeiroAcessoPendente || user.redefinirSenhaObrigatoria) {
        navigate("/convenio/primeiro-acesso");
      } else {
        navigate("/convenio/painel");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f2744] to-[#1a3a5c] p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="flex justify-center">
            <img
              src={`${BASE}/logo-veritas.png`}
              alt="Veritas Analytics"
              className="h-16 w-auto"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white tracking-tight">
            Veritas Analytics
          </h1>
          <p className="mt-1 text-sm text-blue-200">
            Plataforma de Cálculos Judiciais Federais
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white shadow-2xl p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-2">
              <Landmark className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Acesso Conveniado</h2>
              <p className="text-xs text-slate-500">Área exclusiva para usuários institucionais</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={showSenha ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  onClick={() => setShowSenha((v) => !v)}
                  tabIndex={-1}
                >
                  {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center">
            <a
              href={`${BASE}/login`}
              className="text-xs text-slate-500 hover:text-blue-700 underline underline-offset-2"
            >
              Área do advogado — login pessoal
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-blue-300">
          Veritas Analytics &copy; {new Date().getFullYear()} · Uso institucional
        </p>
      </div>
    </div>
  );
}
