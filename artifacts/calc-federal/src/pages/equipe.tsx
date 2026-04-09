import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Users, UserPlus, UserCheck, UserX, KeyRound, Crown, Loader2,
  AlertCircle, CheckCircle2, Building2, Info
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Member {
  id: number;
  nome: string;
  email: string;
  role: string;
  account_role: string;
  ativo: boolean;
  created_at: string;
}

interface TeamData {
  members: Member[];
  maxUsers: number;
  activeCount: number;
  planName: string | null;
  availableSlots: number;
}

function useTeam() {
  return useQuery<TeamData>({
    queryKey: ["team"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/team`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Erro ao carregar equipe");
      return res.json();
    },
  });
}

export default function EquipePage() {
  const { data, isLoading, error } = useTeam();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [showReset, setShowReset] = useState<Member | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", senha: "", confirma: "" });
  const [resetForm, setResetForm] = useState({ senha: "", confirma: "" });

  const addMember = useMutation({
    mutationFn: async () => {
      if (form.senha !== form.confirma) throw new Error("As senhas não coincidem.");
      if (form.senha.length < 6) throw new Error("A senha deve ter ao menos 6 caracteres.");
      const res = await fetch(`${BASE}/api/team`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ nome: form.nome, email: form.email, senha: form.senha }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Erro ao adicionar membro");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Membro adicionado com sucesso." });
      setShowAdd(false);
      setForm({ nome: "", email: "", senha: "", confirma: "" });
      qc.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const toggleMember = useMutation({
    mutationFn: async (memberId: number) => {
      const res = await fetch(`${BASE}/api/team/${memberId}/toggle`, {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Erro");
      return body;
    },
    onSuccess: (d) => {
      toast({ title: d.message });
      qc.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const resetPassword = useMutation({
    mutationFn: async (memberId: number) => {
      if (resetForm.senha !== resetForm.confirma) throw new Error("As senhas não coincidem.");
      if (resetForm.senha.length < 6) throw new Error("Mínimo 6 caracteres.");
      const res = await fetch(`${BASE}/api/team/${memberId}/reset-password`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ senha: resetForm.senha }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Erro");
      return body;
    },
    onSuccess: (d) => {
      toast({ title: d.message });
      setShowReset(null);
      setResetForm({ senha: "", confirma: "" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <div className="text-slate-600 font-medium">Erro ao carregar a equipe</div>
        <p className="text-sm text-slate-400">Verifique sua assinatura ou tente novamente.</p>
      </div>
    );
  }

  const { members, maxUsers, activeCount, planName, availableSlots } = data;
  const canAdd = availableSlots > 0 && planName !== null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-cinzel font-bold text-[#0f2a4a]">Minha Equipe</h1>
          <p className="text-slate-400 text-sm mt-0.5">Gerencie os usuários do seu escritório</p>
        </div>
        <Button
          className="gap-2"
          onClick={() => setShowAdd(true)}
          disabled={!canAdd}
        >
          <UserPlus className="h-4 w-4" />
          Adicionar Usuário
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Plano", value: planName ?? "Sem plano", icon: Crown, color: "text-violet-600" },
          { label: "Usuários permitidos", value: maxUsers, icon: Building2, color: "text-blue-600" },
          { label: "Usuários ativos", value: activeCount, icon: UserCheck, color: "text-emerald-600" },
          { label: "Vagas restantes", value: availableSlots, icon: Users, color: "text-amber-600" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs">
              <k.icon className={cn("h-3.5 w-3.5", k.color)} />
              {k.label}
            </div>
            <div className={cn("font-bold text-xl", k.color)}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Aviso sem plano */}
      {!planName && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Assinatura necessária</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Você precisa de um plano ativo para adicionar membros à equipe.
              <a href="/planos" className="ml-1 underline font-medium">Ver planos</a>
            </p>
          </div>
        </div>
      )}

      {/* Tabela de membros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">E-mail</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Perfil</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Criado em</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    Nenhum membro cadastrado.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-700">
                      <div className="flex items-center gap-2">
                        {m.account_role === "master" && (
                          <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        )}
                        {m.nome}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{m.email}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          m.account_role === "master"
                            ? "border-amber-400 text-amber-700 bg-amber-50"
                            : "border-blue-400 text-blue-700 bg-blue-50"
                        )}
                      >
                        {m.account_role === "master" ? "Master" : "Membro"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          m.ativo
                            ? "border-emerald-400 text-emerald-700 bg-emerald-50"
                            : "border-red-300 text-red-600 bg-red-50"
                        )}
                      >
                        {m.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {new Date(m.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      {m.account_role === "master" ? (
                        <span className="text-slate-300 text-xs">—</span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className={cn("text-xs gap-1", m.ativo ? "text-red-500 hover:bg-red-50" : "text-emerald-600 hover:bg-emerald-50")}
                            onClick={() => toggleMember.mutate(m.id)}
                            disabled={toggleMember.isPending}
                          >
                            {m.ativo ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                            {m.ativo ? "Inativar" : "Ativar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs gap-1 text-slate-600 hover:bg-slate-100"
                            onClick={() => setShowReset(m)}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            Senha
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog: Adicionar membro */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              Adicionar Usuário Subordinado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <Label>E-mail / Login *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Senha inicial *</Label>
                <Input
                  type="password"
                  value={form.senha}
                  onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <Label>Confirmar senha *</Label>
                <Input
                  type="password"
                  value={form.confirma}
                  onChange={(e) => setForm((f) => ({ ...f, confirma: e.target.value }))}
                  placeholder="Repetir senha"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1"
                onClick={() => addMember.mutate()}
                disabled={addMember.isPending || !form.nome || !form.email || !form.senha}
              >
                {addMember.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Salvar usuário
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Redefinir senha */}
      <Dialog open={!!showReset} onOpenChange={() => setShowReset(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-slate-600" />
              Redefinir Senha
            </DialogTitle>
          </DialogHeader>
          {showReset && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-slate-500">
                Usuário: <strong>{showReset.nome}</strong> · {showReset.email}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nova senha</Label>
                  <Input
                    type="password"
                    value={resetForm.senha}
                    onChange={(e) => setResetForm((f) => ({ ...f, senha: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Confirmar nova senha</Label>
                  <Input
                    type="password"
                    value={resetForm.confirma}
                    onChange={(e) => setResetForm((f) => ({ ...f, confirma: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1"
                  onClick={() => resetPassword.mutate(showReset.id)}
                  disabled={resetPassword.isPending || !resetForm.senha}
                >
                  {resetPassword.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Salvar nova senha
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setShowReset(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
