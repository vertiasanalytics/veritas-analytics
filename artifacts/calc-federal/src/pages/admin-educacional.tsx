import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { getAuthHeaders } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap, UserPlus, Trash2, RefreshCw, Search,
  CreditCard, Calendar, Building2, Users, AlertCircle, CheckCircle2,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────
interface EduSubscriber {
  id: number;
  nome: string;
  email: string;
  user_created_at: string;
  sub_id: number;
  starts_at: string;
  ends_at: string;
  sub_status: string;
  balance: number;
  subscription_balance: number;
  extra_balance: number;
  total_used: number;
  last_reset_cycle: string | null;
}

interface SearchUser {
  id: number;
  nome: string;
  email: string;
  role: string;
  created_at: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(iso));
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

function fmtCredits(n: number | string) {
  return Number(n).toFixed(0);
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useEduSubscribers() {
  return useQuery<{ subscribers: EduSubscriber[]; total: number }>({
    queryKey: ["edu-subscribers"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/plans/educational/subscribers`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Erro ao carregar assinantes.");
      return res.json();
    },
  });
}

function useAllUsers() {
  return useQuery<SearchUser[]>({
    queryKey: ["all-users-list"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/users`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Erro ao carregar usuários.");
      return res.json();
    },
    staleTime: 30_000,
  });
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminEducacional() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading, error } = useEduSubscribers();
  const [search, setSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [institutionName, setInstitutionName] = useState("");
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [showAssign, setShowAssign] = useState(false);

  const { data: allUsers } = useAllUsers();
  const filteredUserResults = userSearch.length >= 2 && allUsers
    ? allUsers.filter((u) =>
        u.nome?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase())
      ).slice(0, 10)
    : [];

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error("Selecione um usuário.");
      const res = await fetch(`${BASE}/api/plans/educational/assign`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, institutionName }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Erro ao atribuir plano.");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setFeedback({ type: "ok", msg: data.message });
      setSelectedUser(null);
      setUserSearch("");
      setInstitutionName("");
      setShowAssign(false);
      qc.invalidateQueries({ queryKey: ["edu-subscribers"] });
    },
    onError: (err: Error) => {
      setFeedback({ type: "err", msg: err.message });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`${BASE}/api/plans/educational/revoke/${userId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Erro ao revogar plano.");
      }
      return res.json();
    },
    onSuccess: () => {
      setFeedback({ type: "ok", msg: "Assinatura educacional revogada com sucesso." });
      qc.invalidateQueries({ queryKey: ["edu-subscribers"] });
    },
    onError: (err: Error) => {
      setFeedback({ type: "err", msg: err.message });
    },
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full p-12 text-slate-500">
        Acesso restrito a administradores.
      </div>
    );
  }

  const subscribers = data?.subscribers ?? [];
  const filtered = search.trim()
    ? subscribers.filter((s) =>
        s.nome?.toLowerCase().includes(search.toLowerCase()) ||
        s.email?.toLowerCase().includes(search.toLowerCase())
      )
    : subscribers;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Plano Educacional</h1>
            <p className="text-sm text-slate-500">
              Gestão de assinantes — 20 créditos/mês · sem acúmulo · marca d'água nos relatórios
            </p>
          </div>
        </div>
        <Button
          onClick={() => { setShowAssign(true); setFeedback(null); }}
          className="bg-blue-700 hover:bg-blue-800 text-white gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Atribuir a usuário
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<Users className="w-4 h-4 text-blue-600" />} label="Assinantes ativos" value={data?.total ?? 0} />
        <KpiCard icon={<CreditCard className="w-4 h-4 text-emerald-600" />} label="Créditos/mês" value="20" sub="por assinante" />
        <KpiCard icon={<Calendar className="w-4 h-4 text-amber-600" />} label="Reset" value="Mensal" sub="sem acúmulo" />
        <KpiCard icon={<Building2 className="w-4 h-4 text-slate-500" />} label="Gratuito" value="R$ 0,00" sub="mensais" />
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
          feedback.type === "ok"
            ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
            : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          {feedback.type === "ok"
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0" />
          }
          {feedback.msg}
          <button className="ml-auto text-xs opacity-60 hover:opacity-100" onClick={() => setFeedback(null)}>✕</button>
        </div>
      )}

      {/* Assign modal */}
      {showAssign && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-blue-900">Atribuir Plano Educacional</h2>
            <button
              onClick={() => { setShowAssign(false); setSelectedUser(null); setUserSearch(""); }}
              className="text-slate-400 hover:text-slate-600"
            >✕</button>
          </div>
          <p className="text-sm text-blue-700">
            O usuário receberá imediatamente 20 créditos educacionais e o plano será ativado sem cobrança.
            Créditos mensais são renovados automaticamente a cada ciclo e não acumulam.
          </p>

          {/* Search user */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Buscar usuário</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                className="pl-8 text-sm"
                placeholder="Nome ou e-mail do usuário..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setSelectedUser(null); }}
              />
            </div>
            {filteredUserResults.length > 0 && !selectedUser && (
              <div className="rounded-lg border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {filteredUserResults.map((u) => (
                  <button
                    key={u.id}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 text-left"
                    onClick={() => { setSelectedUser(u); setUserSearch(u.nome || u.email); }}
                  >
                    <div>
                      <div className="font-medium text-slate-800">{u.nome || "—"}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">{u.role}</Badge>
                  </button>
                ))}
              </div>
            )}
            {selectedUser && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-100 rounded-lg text-sm text-blue-900">
                <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="font-medium">{selectedUser.nome || selectedUser.email}</span>
                <span className="text-blue-500 text-xs">{selectedUser.email}</span>
                <button className="ml-auto text-blue-400 hover:text-blue-600" onClick={() => { setSelectedUser(null); setUserSearch(""); }}>✕</button>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Instituição de ensino (opcional)</label>
            <Input
              className="text-sm"
              placeholder="Ex: USP, PUC-Rio, UFMG..."
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowAssign(false); setSelectedUser(null); setUserSearch(""); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => assignMutation.mutate()}
              disabled={!selectedUser || assignMutation.isPending}
              className="bg-blue-700 hover:bg-blue-800 text-white gap-2"
            >
              {assignMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <GraduationCap className="w-3.5 h-3.5" />}
              Atribuir plano
            </Button>
          </div>
        </div>
      )}

      {/* Subscribers table */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">
            Assinantes ativos <span className="text-slate-400 font-normal">({filtered.length})</span>
          </h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            <Input
              className="pl-7 h-7 text-xs w-52"
              placeholder="Filtrar por nome ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-red-500">Erro ao carregar dados.</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Nenhum assinante educacional ativo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600 text-xs">Usuário</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600 text-xs">Ativo desde</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-slate-600 text-xs">Ciclo atual</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 text-xs">Saldo mensais</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 text-xs">Extras</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 text-xs">Total usado</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => {
                  const subBal = Number(s.subscription_balance ?? 0);
                  const extraBal = Number(s.extra_balance ?? 0);
                  const totalUsed = Number(s.total_used ?? 0);
                  const usedPct = Math.min((20 - subBal) / 20 * 100, 100);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{s.nome || "—"}</div>
                        <div className="text-xs text-slate-500">{s.email}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{fmtDate(s.starts_at)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                          {s.last_reset_cycle ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-semibold text-slate-800">{fmtCredits(subBal)} / 20</span>
                          <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${100 - usedPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-600">{fmtCredits(extraBal)}</td>
                      <td className="px-4 py-3 text-right text-xs text-slate-600">{fmtCredits(totalUsed)}</td>
                      <td className="px-3 py-3">
                        <button
                          title="Revogar plano educacional"
                          disabled={revokeMutation.isPending}
                          onClick={() => {
                            if (confirm(`Revogar plano educacional de ${s.nome || s.email}?`)) {
                              revokeMutation.mutate(s.id);
                            }
                          }}
                          className="text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rules info box */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 grid md:grid-cols-3 gap-4 text-sm">
        <RuleBox
          title="Créditos mensais"
          items={[
            "20 créditos por ciclo (mês calendário)",
            "Reset automático a cada início de mês",
            "Sem acúmulo de saldo não utilizado",
            "Créditos extras podem ser adquiridos",
          ]}
        />
        <RuleBox
          title="Módulos disponíveis"
          items={[
            "Cálculo Previdenciário",
            "Valor da Causa",
            "Juros e Amortização",
            "Módulos avançados: requerem upgrade",
          ]}
        />
        <RuleBox
          title="Marca d'água"
          items={[
            "Todos os relatórios gerados contêm watermark educacional",
            "\"Documento educacional — não válido para uso processual\"",
            "Removida ao assinar plano pago",
            "Identificação clara para fins acadêmicos",
          ]}
        />
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({
  icon, label, value, sub,
}: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-slate-500 font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function RuleBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{title}</div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
            <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
