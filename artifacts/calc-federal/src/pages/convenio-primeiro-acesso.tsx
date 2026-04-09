import { useState } from "react";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, KeyRound, CheckCircle2, XCircle } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function PasswordRule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs ${ok ? "text-green-700" : "text-slate-500"}`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <XCircle className="h-3.5 w-3.5 text-slate-400" />}
      {text}
    </div>
  );
}

export default function ConvenioPrimeiroAcesso() {
  const { user, refreshUser } = useAuth();
  const [, navigate] = useLocation();

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showNova, setShowNova] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const hasMin8 = novaSenha.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(novaSenha);
  const hasNumber = /[0-9]/.test(novaSenha);
  const matches = novaSenha === confirmarSenha && confirmarSenha.length > 0;
  const valid = hasMin8 && hasLetter && hasNumber && matches;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!valid) {
      setError("Verifique os requisitos de senha.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/primeiro-acesso`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ novaSenha, confirmarSenha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao definir senha");
      setSuccess(true);
      await refreshUser();
      setTimeout(() => navigate("/convenio/painel"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao definir senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f2744] to-[#1a3a5c] p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">Veritas Analytics</h1>
          <p className="mt-1 text-sm text-blue-200">Plataforma de Cálculos Judiciais Federais</p>
        </div>

        <div className="rounded-2xl bg-white shadow-2xl p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-2">
              <KeyRound className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Troca de senha obrigatória</h2>
              <p className="text-xs text-slate-500">
                {user ? `Olá, ${user.nome}. ` : ""}
                Defina uma senha segura para continuar.
              </p>
            </div>
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <p className="text-center font-medium text-green-700">Senha definida com sucesso! Redirecionando...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div className="space-y-2">
                <Label htmlFor="novaSenha">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="novaSenha"
                    type={showNova ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    disabled={loading}
                    className="pr-10"
                  />
                  <button type="button" tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    onClick={() => setShowNova((v) => !v)}>
                    {showNova ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {novaSenha && (
                  <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3">
                    <PasswordRule ok={hasMin8} text="Mínimo 8 caracteres" />
                    <PasswordRule ok={hasLetter} text="Ao menos 1 letra" />
                    <PasswordRule ok={hasNumber} text="Ao menos 1 número" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmarSenha">Confirmar nova senha</Label>
                <div className="relative">
                  <Input
                    id="confirmarSenha"
                    type={showConfirmar ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Repita a senha"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    disabled={loading}
                    className="pr-10"
                  />
                  <button type="button" tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    onClick={() => setShowConfirmar((v) => !v)}>
                    {showConfirmar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmarSenha && (
                  <PasswordRule ok={matches} text="Senhas coincidem" />
                )}
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading || !valid}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                ) : (
                  "Definir senha e continuar"
                )}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-blue-300">
          A senha é armazenada com criptografia segura e nunca é visível para terceiros.
        </p>
      </div>
    </div>
  );
}
