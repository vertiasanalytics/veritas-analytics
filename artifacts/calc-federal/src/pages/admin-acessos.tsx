import { useState, useEffect, useCallback } from "react";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity, Globe, MapPin, Monitor, User, Calendar, Download,
  Search, RefreshCw, ChevronLeft, ChevronRight, LayoutDashboard,
  Users, Wifi,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const TIPOS = [
  "Login", "Dashboard", "Previdenciário", "Trabalhista", "Pericial",
  "Jurídico", "Família", "Cível", "Estadual", "Controladoria Jurídica",
  "Administração", "Convênio", "Demonstração", "Sistema",
];

const CORES_UF: Record<string, string> = {
  SP: "#1d4ed8", MG: "#7c3aed", RJ: "#0891b2", RS: "#059669", BA: "#d97706",
  PR: "#dc2626", PE: "#db2777", CE: "#0d9488", GO: "#65a30d", SC: "#6366f1",
};

interface Summary {
  total: string; hoje: string; semana: string; mes: string;
  ips_unicos: string; estados_unicos: string;
}

interface AccessRow {
  id: number; ip: string; pais: string; uf: string; estado: string;
  cidade: string; pagina: string; tipo: string; user_agent: string;
  created_at: string; user_nome?: string; user_email?: string;
}

interface UfRow { uf: string; estado: string; total: string; }
interface TipoRow { tipo: string; total: string; }

interface PageData {
  total: number; page: number; pageSize: number; pages: number;
  rows: AccessRow[]; byUf: UfRow[]; byTipo: TipoRow[];
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function simplifyAgent(ua: string): string {
  if (!ua) return "—";
  if (/mobile|android|iphone|ipad/i.test(ua)) return "📱 Mobile";
  if (/chrome/i.test(ua)) return "Chrome";
  if (/firefox/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  if (/edge/i.test(ua)) return "Edge";
  return "Outro";
}

function StatCard({ icon: Icon, label, value, sub, color = "blue" }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", violet: "bg-violet-50 text-violet-600",
    green: "bg-green-50 text-green-600", amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600", slate: "bg-slate-50 text-slate-600",
  };
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${colors[color] ?? colors.blue}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-xl font-bold leading-tight">{Number(value ?? 0).toLocaleString("pt-BR")}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminAcessos() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState({ uf: "", tipo: "", pagina: "", inicio: "", fim: "" });
  const [tempFilters, setTempFilters] = useState({ ...filters });

  useEffect(() => {
    if (user?.role !== "admin") { navigate("/"); return; }
  }, [user, navigate]);

  const fetchSummary = useCallback(async () => {
    const res = await fetch(`${BASE}/api/access-logs/admin/summary`, { headers: getAuthHeaders() });
    if (res.ok) setSummary(await res.json());
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (filters.uf) params.set("uf", filters.uf);
    if (filters.tipo) params.set("tipo", filters.tipo);
    if (filters.pagina) params.set("pagina", filters.pagina);
    if (filters.inicio) params.set("inicio", filters.inicio);
    if (filters.fim) params.set("fim", filters.fim);
    const res = await fetch(`${BASE}/api/access-logs/admin?${params}`, { headers: getAuthHeaders() });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [page, filters]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchData(); }, [fetchData]);

  function applyFilters() { setFilters({ ...tempFilters }); setPage(1); }
  function clearFilters() {
    const empty = { uf: "", tipo: "", pagina: "", inicio: "", fim: "" };
    setTempFilters(empty); setFilters(empty); setPage(1);
  }

  function exportCsv() {
    if (!data?.rows.length) return;
    const headers = ["Data/Hora", "IP", "UF", "Estado", "Cidade", "Página", "Tipo", "Usuário", "E-mail", "Navegador"];
    const rows = data.rows.map(r => [
      formatDate(r.created_at), r.ip, r.uf, r.estado, r.cidade,
      r.pagina, r.tipo, r.user_nome ?? "—", r.user_email ?? "—", simplifyAgent(r.user_agent),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `acessos_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const chartData = (data?.byUf ?? []).slice(0, 15).map(r => ({
    uf: r.uf, total: parseInt(r.total, 10), estado: r.estado,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/15 flex items-center justify-center flex-shrink-0">
            <Activity className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Relatório de Acessos</h1>
            <p className="text-sm text-muted-foreground">
              Rastreamento de visitas — login, demonstração e módulos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { fetchSummary(); fetchData(); }}>
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
          <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-500" onClick={exportCsv} disabled={!data?.rows.length}>
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard icon={Activity} label="Total Geral" value={summary?.total ?? 0} color="blue" />
        <StatCard icon={Calendar} label="Hoje" value={summary?.hoje ?? 0} color="green" />
        <StatCard icon={Calendar} label="7 dias" value={summary?.semana ?? 0} color="violet" />
        <StatCard icon={Calendar} label="30 dias" value={summary?.mes ?? 0} color="amber" />
        <StatCard icon={Wifi} label="IPs Únicos" value={summary?.ips_unicos ?? 0} color="rose" />
        <StatCard icon={MapPin} label="Estados" value={summary?.estados_unicos ?? 0} color="slate" />
      </div>

      {/* Chart + Tipo breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
        {/* Bar chart by UF */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-500" /> Acessos por Estado (UF)
          </h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="uf" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v: number, _n: string, props: any) => [v.toLocaleString("pt-BR"), props.payload?.estado ?? ""]}
                  labelFormatter={(l) => `UF: ${l}`}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.uf} fill={CORES_UF[entry.uf] ?? "#6366f1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Sem dados para exibir
            </div>
          )}
        </div>

        {/* Tipo breakdown */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-violet-500" /> Por Tipo de Página
          </h2>
          <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
            {(data?.byTipo ?? []).map((t) => {
              const total = data?.total ?? 1;
              const pct = Math.round((parseInt(t.total, 10) / total) * 100);
              return (
                <div key={t.tipo} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-28 truncate flex-shrink-0">{t.tipo || "—"}</span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold w-12 text-right">
                    {parseInt(t.total, 10).toLocaleString("pt-BR")}
                  </span>
                </div>
              );
            })}
            {(data?.byTipo ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center pt-4">Sem dados</p>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" /> Filtros
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">UF</label>
            <Input
              placeholder="Ex: MG"
              value={tempFilters.uf}
              onChange={e => setTempFilters(p => ({ ...p, uf: e.target.value.toUpperCase().slice(0, 2) }))}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
            <Select value={tempFilters.tipo || "__all__"} onValueChange={v => setTempFilters(p => ({ ...p, tipo: v === "__all__" ? "" : v }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Página (contém)</label>
            <Input
              placeholder="/trabalhista"
              value={tempFilters.pagina}
              onChange={e => setTempFilters(p => ({ ...p, pagina: e.target.value }))}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">De</label>
            <Input type="date" value={tempFilters.inicio} onChange={e => setTempFilters(p => ({ ...p, inicio: e.target.value }))} className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Até</label>
            <Input type="date" value={tempFilters.fim} onChange={e => setTempFilters(p => ({ ...p, fim: e.target.value }))} className="h-8 text-xs" />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-500 gap-1.5" onClick={applyFilters}>
            <Search className="w-3.5 h-3.5" /> Filtrar
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={clearFilters}>Limpar</Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-400" />
            Registros
            {data && (
              <Badge variant="secondary" className="text-xs ml-1">
                {data.total.toLocaleString("pt-BR")} total
              </Badge>
            )}
          </h2>
          {data && data.pages > 1 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Pág. {data.page}/{data.pages}</span>
              <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page >= data.pages}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (data?.rows ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Activity className="w-8 h-8 opacity-30" />
            <p className="text-sm">Nenhum acesso registrado com esses filtros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Data/Hora</th>
                  <th className="text-left px-4 py-2 font-semibold text-muted-foreground">IP</th>
                  <th className="text-left px-4 py-2 font-semibold text-muted-foreground">UF</th>
                  <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Cidade</th>
                  <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Tipo</th>
                  <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Página</th>
                  <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Usuário</th>
                  <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Navegador</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((row, i) => (
                  <tr key={row.id} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-muted/20"} hover:bg-muted/40 transition-colors`}>
                    <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-4 py-2 font-mono text-[10px] text-slate-600 whitespace-nowrap">
                      {row.ip}
                    </td>
                    <td className="px-4 py-2">
                      {row.uf ? (
                        <Badge className="text-[10px] px-1.5 py-0 h-4 font-bold"
                          style={{ background: CORES_UF[row.uf] ?? "#6366f1", color: "white", border: "none" }}>
                          {row.uf}
                        </Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground max-w-[100px] truncate">{row.cidade || "—"}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 whitespace-nowrap">
                        {row.tipo || "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground max-w-[180px] truncate" title={row.pagina}>
                      {row.pagina}
                    </td>
                    <td className="px-4 py-2">
                      {row.user_nome ? (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-blue-400 flex-shrink-0" />
                          <span className="truncate max-w-[120px]" title={row.user_email ?? ""}>{row.user_nome}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50 flex items-center gap-1">
                          <Monitor className="w-3 h-3" /> Anônimo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{simplifyAgent(row.user_agent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.pages > 1 && (
          <div className="flex items-center justify-center gap-2 py-3 border-t border-border">
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setPage(1)} disabled={page === 1}>
              Primeira
            </Button>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              Pág. {data.page} de {data.pages}
            </span>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page >= data.pages}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setPage(data.pages)} disabled={page >= data.pages}>
              Última
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
