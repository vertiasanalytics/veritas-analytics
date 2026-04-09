import { useState, useEffect } from "react";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  TicketPercent, Plus, Trash2, Loader2, RefreshCw,
  Copy, CheckCircle2, Tag, ShieldOff,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CouponRow {
  id: number;
  code: string;
  percentual: number;
  ativo: boolean;
  created_at: string;
  criado_por_nome: string | null;
}

export default function AdminCupons() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [percentual, setPercentual] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    if (user && (user as any).role !== "admin") navigate("/");
  }, [user, navigate]);

  const { data: coupons = [], isLoading, refetch } = useQuery<CouponRow[]>({
    queryKey: ["admin-cupons"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/cupons`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Erro ao carregar cupons");
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (pct: number) => {
      const r = await fetch(`${BASE}/api/admin/cupons`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ percentual: pct }),
      });
      if (!r.ok) { const b = await r.json(); throw new Error(b.error); }
      return r.json();
    },
    onSuccess: (data: CouponRow) => {
      queryClient.invalidateQueries({ queryKey: ["admin-cupons"] });
      setPercentual("");
      toast({ title: "Cupom criado!", description: `Código: ${data.code}` });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${BASE}/api/admin/cupons/${id}`, {
        method: "DELETE", headers: getAuthHeaders(),
      });
      if (!r.ok) throw new Error("Erro ao desativar");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cupons"] });
      toast({ title: "Cupom desativado." });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const reativarMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${BASE}/api/admin/cupons/${id}/reativar`, {
        method: "POST", headers: getAuthHeaders(),
      });
      if (!r.ok) throw new Error("Erro ao reativar");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cupons"] });
      toast({ title: "Cupom reativado." });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  function handleCreate() {
    const pct = Number(percentual);
    if (!pct || pct <= 0 || pct > 100) {
      toast({ title: "Percentual inválido", description: "Informe um valor entre 1 e 100.", variant: "destructive" });
      return;
    }
    createMutation.mutate(pct);
  }

  async function copyCode(id: number, code: string) {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast({ title: "Código copiado!" });
    setTimeout(() => setCopiedId(null), 2000);
  }

  const ativos   = coupons.filter(c => c.ativo);
  const inativos = coupons.filter(c => !c.ativo);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center">
              <TicketPercent className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Gestão de Cupons</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Crie e gerencie cupons de desconto para os planos
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">

          {/* Painel de criação */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4 text-amber-500" />
                Novo Cupom
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Desconto (%)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={percentual}
                      onChange={e => setPercentual(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleCreate()}
                      placeholder="Ex: 25"
                      className="pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">%</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    O código será gerado automaticamente no formato <code className="bg-slate-100 px-1 rounded">DESCxx-YYYY</code>
                  </p>
                </div>

                {percentual && Number(percentual) > 0 && Number(percentual) <= 100 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                    <p className="text-xs text-amber-600 font-semibold mb-1">Pré-visualização</p>
                    <p className="font-mono font-bold text-amber-800 text-lg">
                      DESC{percentual}-????
                    </p>
                    <p className="text-xs text-amber-600 mt-1">{percentual}% de desconto · sem validade</p>
                  </div>
                )}

                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white gap-2"
                >
                  {createMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Criando…</>
                  ) : (
                    <><Plus className="h-4 w-4" /> Gerar Cupom</>
                  )}
                </Button>
              </div>

              {/* Resumo */}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-center">
                  <p className="text-2xl font-black text-emerald-700">{ativos.length}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Ativos</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-center">
                  <p className="text-2xl font-black text-slate-500">{inativos.length}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Inativos</p>
                </div>
              </div>
            </div>
          </div>

          {/* Lista de cupons */}
          <div className="lg:col-span-2 space-y-4">

            {/* Ativos */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <Tag className="h-4 w-4 text-emerald-500" />
                  Cupons ativos
                </h3>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{ativos.length}</Badge>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                </div>
              ) : ativos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                  <TicketPercent className="h-8 w-8 opacity-30" />
                  <p className="text-sm">Nenhum cupom ativo. Crie o primeiro!</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {ativos.map(c => (
                    <li key={c.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                          <span className="text-xs font-black text-amber-600">{c.percentual}%</span>
                        </div>
                        <div>
                          <p className="font-mono font-bold text-slate-800 text-sm">{c.code}</p>
                          <p className="text-xs text-slate-400">
                            {c.percentual}% de desconto · sem validade
                            {c.criado_por_nome && ` · criado por ${c.criado_por_nome}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => copyCode(c.id, c.code)}
                          className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 flex items-center justify-center transition"
                          title="Copiar código"
                        >
                          {copiedId === c.id ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(c.id)}
                          disabled={deleteMutation.isPending}
                          className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-300 flex items-center justify-center transition"
                          title="Desativar cupom"
                        >
                          {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Inativos */}
            {inativos.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-400 flex items-center gap-2">
                    <ShieldOff className="h-4 w-4" />
                    Cupons inativos
                  </h3>
                  <Badge variant="secondary">{inativos.length}</Badge>
                </div>
                <ul className="divide-y divide-slate-50">
                  {inativos.map(c => (
                    <li key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition opacity-60">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-black text-slate-400">{c.percentual}%</span>
                        </div>
                        <div>
                          <p className="font-mono text-sm text-slate-500 line-through">{c.code}</p>
                          <p className="text-xs text-slate-400">{c.percentual}% · desativado</p>
                        </div>
                      </div>
                      <button
                        onClick={() => reativarMutation.mutate(c.id)}
                        disabled={reativarMutation.isPending}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition"
                      >
                        Reativar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
