/**
 * admin-suporte.tsx — Gestão de Chamados de Suporte Técnico
 * Veritas Analytics — Área Administrativa
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import {
  AlertCircle, RefreshCw, Mail, ChevronDown, ChevronUp,
  Trash2, CheckCircle2, Clock, Zap, MessageSquare, LifeBuoy,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Ticket {
  id: number;
  user_id: number | null;
  nome: string;
  email: string;
  assunto: string;
  prioridade: string;
  modulo: string | null;
  descricao: string;
  steps: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

const PRIORIDADE_CONFIG: Record<string, { label: string; cls: string }> = {
  critica: { label: "🔴 Crítica",  cls: "border-red-300 text-red-700 bg-red-50"     },
  alta:    { label: "🟠 Alta",     cls: "border-orange-300 text-orange-700 bg-orange-50" },
  normal:  { label: "🟡 Normal",   cls: "border-yellow-300 text-yellow-700 bg-yellow-50" },
  baixa:   { label: "🟢 Baixa",   cls: "border-emerald-300 text-emerald-700 bg-emerald-50" },
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  aberto:       { label: "Aberto",       cls: "border-blue-300 text-blue-700 bg-blue-50"    },
  em_andamento: { label: "Em andamento", cls: "border-amber-300 text-amber-700 bg-amber-50" },
  resolvido:    { label: "Resolvido",    cls: "border-emerald-300 text-emerald-700 bg-emerald-50" },
  fechado:      { label: "Fechado",      cls: "border-gray-300 text-gray-500 bg-gray-50"    },
};

function TicketCard({ ticket, onUpdate }: { ticket: Ticket; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(ticket.admin_notes ?? "");
  const [newStatus, setNewStatus] = useState(ticket.status);
  const qc = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/support/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ status: newStatus, admin_notes: notes }),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      onUpdate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/support/${ticket.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["support-tickets"] }),
  });

  const prio = PRIORIDADE_CONFIG[ticket.prioridade] ?? PRIORIDADE_CONFIG.normal;
  const sts  = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.aberto;
  const mailSubject = encodeURIComponent(`Re: [Veritas #${ticket.id}] ${ticket.assunto}`);
  const mailtoReply = `mailto:${ticket.email}?subject=${mailSubject}`;

  return (
    <Card className={`border ${ticket.status === "fechado" || ticket.status === "resolvido" ? "opacity-70" : ""}`}>
      <CardContent className="p-0">
        {/* Header do ticket */}
        <button
          className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/30 transition-colors rounded-t-lg"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-xs text-muted-foreground">#{ticket.id}</span>
              <Badge variant="outline" className={`text-xs ${prio.cls}`}>{prio.label}</Badge>
              <Badge variant="outline" className={`text-xs ${sts.cls}`}>{sts.label}</Badge>
              {ticket.modulo && (
                <Badge variant="outline" className="text-xs border-violet-200 text-violet-600 bg-violet-50">
                  {ticket.modulo}
                </Badge>
              )}
            </div>
            <p className="text-sm font-semibold text-foreground leading-tight truncate">{ticket.assunto}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ticket.nome} · {ticket.email} · {new Date(ticket.created_at).toLocaleString("pt-BR")}
            </p>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground mt-1 shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />}
        </button>

        {/* Corpo expandido */}
        {expanded && (
          <div className="px-4 pb-4 space-y-4 border-t pt-4">
            {/* Descrição */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Descrição</p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-lg p-3">{ticket.descricao}</p>
            </div>

            {ticket.steps && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Passos para reproduzir</p>
                <pre className="text-xs text-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3 font-mono leading-relaxed">{ticket.steps}</pre>
              </div>
            )}

            <Separator />

            {/* Resposta do admin */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Notas / resposta interna</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Anotações internas, diagnóstico, ação tomada…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Alterar status</label>
                <div className="space-y-1.5">
                  {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                    <button
                      key={val}
                      onClick={() => setNewStatus(val)}
                      className={`w-full h-8 px-3 rounded-md border text-xs font-medium text-left transition-all ${
                        newStatus === val ? `${cfg.cls} border-current` : "border-border bg-background text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="gap-1 text-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {updateMutation.isPending ? "Salvando…" : "Salvar alterações"}
              </Button>
              <a href={mailtoReply} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1 text-xs">
                  <Mail className="w-3.5 h-3.5" /> Responder por e-mail
                </Button>
              </a>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 ml-auto"
                onClick={() => { if (confirm("Excluir este chamado?")) deleteMutation.mutate(); }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AdminSuporte() {
  const { user } = useAuth();
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroPrio, setFiltroPrio]     = useState<string>("todos");

  const { data: tickets = [], isLoading, refetch } = useQuery<Ticket[]>({
    queryKey: ["support-tickets"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/support`, { headers: getAuthHeaders() });
      const json = await res.json();
      return json.data ?? [];
    },
    refetchInterval: 60_000,
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-lg font-semibold">Acesso restrito ao administrador.</p>
        <Link href="/dashboard"><Button variant="outline">Voltar ao Dashboard</Button></Link>
      </div>
    );
  }

  const filtered = tickets.filter((t) => {
    const okStatus = filtroStatus === "todos" || t.status === filtroStatus;
    const okPrio   = filtroPrio === "todos" || t.prioridade === filtroPrio;
    return okStatus && okPrio;
  });

  const counts = {
    total:  tickets.length,
    aberto: tickets.filter((t) => t.status === "aberto").length,
    andamento: tickets.filter((t) => t.status === "em_andamento").length,
    critico: tickets.filter((t) => t.prioridade === "critica" && t.status !== "fechado" && t.status !== "resolvido").length,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LifeBuoy className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-display font-bold text-foreground">Chamados de Suporte</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Gerencie todos os chamados técnicos enviados pelos usuários.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1 text-xs">
            <RefreshCw className="w-3 h-3" /> Atualizar
          </Button>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-xs">← Dashboard</Button>
          </Link>
        </div>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: MessageSquare, label: "Total",         value: counts.total,    color: "blue"    },
          { icon: Clock,         label: "Abertos",       value: counts.aberto,   color: "amber"   },
          { icon: Zap,           label: "Em andamento",  value: counts.andamento, color: "violet" },
          { icon: AlertCircle,   label: "Críticos abertos", value: counts.critico, color: "red"   },
        ].map((m) => (
          <Card key={m.label} className={`border-${m.color}-200 bg-${m.color}-50/30`}>
            <CardContent className="p-4 flex items-center gap-3">
              <m.icon className={`w-5 h-5 text-${m.color}-500`} />
              <div>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-xl font-bold text-foreground">{m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <span className="text-xs font-semibold text-muted-foreground">Status:</span>
          {["todos", "aberto", "em_andamento", "resolvido", "fechado"].map((s) => (
            <button key={s} onClick={() => setFiltroStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${filtroStatus === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
              {s === "todos" ? "Todos" : STATUS_CONFIG[s]?.label ?? s}
            </button>
          ))}
          <span className="text-xs font-semibold text-muted-foreground ml-4">Prioridade:</span>
          {["todos", "critica", "alta", "normal", "baixa"].map((p) => (
            <button key={p} onClick={() => setFiltroPrio(p)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${filtroPrio === p ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
              {p === "todos" ? "Todas" : PRIORIDADE_CONFIG[p]?.label ?? p}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} chamado(s)</span>
        </CardContent>
      </Card>

      {/* Lista de chamados */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <LifeBuoy className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum chamado encontrado com os filtros selecionados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <TicketCard key={t.id} ticket={t} onUpdate={() => refetch()} />
          ))}
        </div>
      )}
    </div>
  );
}
