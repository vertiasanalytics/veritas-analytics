import { useState, useCallback } from "react";
import { formatDateTime } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DollarSign, TrendingUp, CreditCard, Clock, ShoppingCart,
  Users, Coins, BarChart3, ArrowUpRight, ArrowDownRight, Search,
  ChevronLeft, ChevronRight, Loader2, RefreshCw, CheckCircle2
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell, Legend,
} from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (n: number) => n.toLocaleString("pt-BR");

const PKG_COLORS: Record<string, string> = {
  starter: "#6366f1",
  plus:    "#3b82f6",
  pro:     "#10b981",
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  paid:    { label: "Pago",      className: "bg-green-100 text-green-800 border-green-200" },
  pending: { label: "Pendente",  className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  expired: { label: "Expirado",  className: "bg-red-100 text-red-700 border-red-200" },
};

function useSummary() {
  return useQuery({
    queryKey: ["admin-fin-summary"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/financial/summary`, { headers: getAuthHeaders() });
      return r.json();
    },
    refetchInterval: 60_000,
  });
}

function useMonthly() {
  return useQuery({
    queryKey: ["admin-fin-monthly"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/financial/monthly`, { headers: getAuthHeaders() });
      return r.json();
    },
  });
}

function usePackages() {
  return useQuery({
    queryKey: ["admin-fin-packages"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/financial/packages`, { headers: getAuthHeaders() });
      return r.json();
    },
  });
}

function useTopCustomers() {
  return useQuery({
    queryKey: ["admin-fin-top"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/financial/top-customers`, { headers: getAuthHeaders() });
      return r.json();
    },
  });
}

function useCharges(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["admin-fin-charges", qs],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/financial/charges?${qs}`, { headers: getAuthHeaders() });
      return r.json();
    },
    placeholderData: (prev) => prev,
  });
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon, label, value, sub, color, trend, loading,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  color: string; trend?: number | null; loading?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-sm">
      <div className="absolute inset-0 opacity-5" style={{ backgroundColor: color }} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${color}20` }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          {trend != null && (
            <div className={`flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
              {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {Math.abs(Math.round(trend * 10) / 10)}%
            </div>
          )}
        </div>
        {loading ? (
          <div className="space-y-2">
            <div className="h-6 bg-muted animate-pulse rounded" />
            <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
          </div>
        ) : (
          <>
            <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium uppercase tracking-wider">{label}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Revenue Chart ────────────────────────────────────────────────────────────
function RevenueChart({ data, loading }: { data: any[]; loading: boolean }) {
  if (loading) return <div className="h-52 bg-muted/40 animate-pulse rounded-xl" />;
  if (!data?.length) return (
    <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
      Sem dados de receita ainda.
    </div>
  );
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis dataKey="mesLabel" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false}
          tickFormatter={(v) => `R$${v}`} width={52} />
        <Tooltip
          contentStyle={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }}
          formatter={(v: number) => [`R$ ${fmt(v)}`, "Receita"]}
          labelStyle={{ fontWeight: 600, color: "#374151" }}
        />
        <Area type="monotone" dataKey="receita" stroke="#3b82f6" strokeWidth={2} fill="url(#colorRec)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Package Chart ────────────────────────────────────────────────────────────
function PackageChart({ data, loading }: { data: any[]; loading: boolean }) {
  if (loading) return <div className="h-52 bg-muted/40 animate-pulse rounded-xl" />;
  if (!data?.length) return (
    <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
      Sem vendas por pacote ainda.
    </div>
  );
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis dataKey="nome" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false}
          tickFormatter={(v) => `R$${v}`} width={52} />
        <Tooltip
          contentStyle={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }}
          formatter={(v: number, name: string) => [
            name === "receita" ? `R$ ${fmt(v)}` : fmtN(v), name === "receita" ? "Receita" : "Vendas"
          ]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Bar dataKey="receita" radius={[6, 6, 0, 0]}>
          {data.map((entry: any) => (
            <Cell key={entry.packageId} fill={PKG_COLORS[entry.packageId] ?? "#6b7280"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function AdminFinanceiro() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: summary, isLoading: loadSummary } = useSummary();
  const { data: monthly = [], isLoading: loadMonthly } = useMonthly();
  const { data: packages = [], isLoading: loadPackages } = usePackages();
  const { data: topCustomers = [], isLoading: loadTop } = useTopCustomers();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["admin-fin-summary"] });
    await qc.invalidateQueries({ queryKey: ["admin-fin-monthly"] });
    await qc.invalidateQueries({ queryKey: ["admin-fin-packages"] });
    await qc.invalidateQueries({ queryKey: ["admin-fin-top"] });
    await qc.invalidateQueries({ queryKey: ["admin-fin-charges"] });
    setIsRefreshing(false);
  }, [qc]);

  // Mutation: confirmar Pix manualmente
  const confirmMut = useMutation({
    mutationFn: async (txid: string) => {
      const r = await fetch(`${BASE}/api/admin/financial/pix/${txid}/confirm`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erro ao confirmar");
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Pagamento confirmado!", description: `${data.creditos} créditos liberados para o usuário.` });
      qc.invalidateQueries({ queryKey: ["admin-fin-charges"] });
      qc.invalidateQueries({ queryKey: ["admin-fin-summary"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao confirmar", description: err.message, variant: "destructive" });
    },
  });

  // Filtros da tabela de cobranças
  const [filters, setFilters] = useState({
    status: "all", packageId: "all", from: "", to: "", search: "", page: "1", limit: "20",
  });
  const [inputSearch, setInputSearch] = useState("");

  const chargeParams = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== "" && v !== "all")
  );
  const { data: chargesData, isLoading: loadCharges, isFetching: fetchingCharges } = useCharges(chargeParams);

  const applyFilter = useCallback((key: string, val: string) => {
    setFilters((f) => ({ ...f, [key]: val, page: "1" }));
  }, []);

  const charges   = chargesData?.charges ?? [];
  const totalRows = chargesData?.total ?? 0;
  const totalPgs  = chargesData?.totalPages ?? 1;
  const curPage   = chargesData?.page ?? 1;

  return (
    <div className="space-y-8 pb-10">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <DollarSign size={22} /> Controle Financeiro
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão completa de vendas, receita e clientes da plataforma.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={isRefreshing} className="gap-2">
          <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} /> Atualizar
        </Button>
      </div>

      {/* KPIs — Receita */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Receita</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={DollarSign} label="Receita Total" color="#10b981"
            value={`R$ ${fmt(summary?.receitaTotal ?? 0)}`}
            sub={`${fmtN(summary?.creditosVendidos ?? 0)} créditos vendidos`}
            loading={loadSummary} />
          <KpiCard icon={TrendingUp} label="Receita Mês Atual" color="#3b82f6"
            value={`R$ ${fmt(summary?.receitaMesAtual ?? 0)}`}
            sub={`${fmtN(summary?.vendasMesAtual ?? 0)} vendas no mês`}
            trend={summary?.variacaoMes}
            loading={loadSummary} />
          <KpiCard icon={Clock} label="Receita Pendente" color="#f59e0b"
            value={`R$ ${fmt(summary?.receitaPendente ?? 0)}`}
            sub={`${fmtN(summary?.cobrancasPendentes ?? 0)} cobranças abertas`}
            loading={loadSummary} />
          <KpiCard icon={CreditCard} label="Ticket Médio" color="#8b5cf6"
            value={`R$ ${fmt(summary?.ticketMedio ?? 0)}`}
            sub={`${summary?.taxaConversao ?? 0}% taxa de conversão`}
            loading={loadSummary} />
        </div>
      </div>

      {/* KPIs — Operacional */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Operacional</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={BarChart3} label="Cobranças Pagas" color="#10b981"
            value={fmtN(summary?.cobrancasPagas ?? 0)} loading={loadSummary} />
          <KpiCard icon={Clock} label="Aguardando Pag." color="#f59e0b"
            value={fmtN(summary?.cobrancasPendentes ?? 0)} loading={loadSummary} />
          <KpiCard icon={ShoppingCart} label="Expiradas" color="#ef4444"
            value={fmtN(summary?.cobrancasExpiradas ?? 0)} loading={loadSummary} />
          <KpiCard icon={Users} label="Clientes Compradores" color="#06b6d4"
            value={fmtN(summary?.clientesAtivos ?? 0)}
            sub={`${fmtN(summary?.creditosVendidosMes ?? 0)} créditos vendidos no mês`}
            loading={loadSummary} />
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Receita Mensal (últimos 12 meses)</CardTitle>
          </CardHeader>
          <CardContent><RevenueChart data={monthly} loading={loadMonthly} /></CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Receita por Pacote</CardTitle>
          </CardHeader>
          <CardContent><PackageChart data={packages} loading={loadPackages} /></CardContent>
        </Card>
      </div>

      {/* Top clientes */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Users size={16} className="text-primary" /> Top 10 Maiores Compradores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadTop ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}</div>
          ) : topCustomers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma compra realizada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["#", "Cliente", "Tipo", "Compras", "Total Gasto", "Créditos", "Saldo", "Última Compra"].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(topCustomers as any[]).map((c, i) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-3">
                        <span className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{i + 1}</span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className="text-xs">{c.tipoPessoa === "pj" ? "PJ" : "PF"}</Badge>
                      </td>
                      <td className="px-3 py-3 text-center font-medium">{c.totalCompras}</td>
                      <td className="px-3 py-3 font-bold text-emerald-700">R$ {fmt(c.totalGasto)}</td>
                      <td className="px-3 py-3 text-primary font-semibold">{fmtN(c.totalCreditos)}</td>
                      <td className="px-3 py-3 text-muted-foreground">{fmtN(c.saldoAtual)}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {c.ultimaCompra ? formatDateTime(c.ultimaCompra) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela de cobranças com filtros */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <CreditCard size={16} className="text-primary" /> Todas as Cobranças
              {totalRows > 0 && <span className="text-xs font-normal text-muted-foreground">({fmtN(totalRows)} registros)</span>}
            </CardTitle>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3">
            <Select value={filters.status} onValueChange={(v) => applyFilter("status", v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.packageId} onValueChange={(v) => applyFilter("packageId", v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pacote" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os pacotes</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="plus">Plus</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>

            <Input type="date" className="h-9 text-sm" value={filters.from}
              onChange={(e) => applyFilter("from", e.target.value)} placeholder="De" />
            <Input type="date" className="h-9 text-sm" value={filters.to}
              onChange={(e) => applyFilter("to", e.target.value)} placeholder="Até" />

            <div className="flex gap-2 col-span-2 md:col-span-1">
              <Input className="h-9 text-sm flex-1" placeholder="Buscar usuário…" value={inputSearch}
                onChange={(e) => setInputSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilter("search", inputSearch)} />
              <Button size="sm" variant="outline" className="h-9 px-3"
                onClick={() => applyFilter("search", inputSearch)}>
                <Search size={14} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {loadCharges ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
          ) : charges.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhuma cobrança encontrada com os filtros selecionados.</p>
          ) : (
            <>
              <div className="overflow-x-auto relative">
                {fetchingCharges && !loadCharges && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 rounded-lg">
                    <Loader2 className="animate-spin text-primary" size={20} />
                  </div>
                )}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Status", "Cliente", "Pacote", "Créditos", "Valor", "Criado em", "Pago em", "Ações"].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map((c: any) => {
                      const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.expired;
                      const isPending = c.status === "pending";
                      const isConfirming = confirmMut.isPending && confirmMut.variables === c.txid;
                      return (
                        <tr key={c.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-3">
                            <Badge variant="outline" className={`text-xs ${sc.className}`}>{sc.label}</Badge>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium leading-tight">{c.nome}</p>
                            <p className="text-xs text-muted-foreground">{c.email}</p>
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PKG_COLORS[c.packageId] ?? "#9ca3af" }} />
                              {c.packageNome}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-semibold text-primary">{fmtN(c.creditos)}</td>
                          <td className="px-3 py-3 font-bold whitespace-nowrap">R$ {fmt(c.valor)}</td>
                          <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(c.createdAt)}
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {c.paidAt ? formatDateTime(c.paidAt) : "—"}
                          </td>
                          <td className="px-3 py-3">
                            {isPending ? (
                              <Button
                                size="sm"
                                className="h-7 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
                                disabled={isConfirming}
                                onClick={() => confirmMut.mutate(c.txid)}
                              >
                                {isConfirming
                                  ? <Loader2 size={11} className="animate-spin" />
                                  : <CheckCircle2 size={11} />}
                                Confirmar Pix
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
                <p className="text-xs text-muted-foreground">
                  Página {curPage} de {totalPgs} · {fmtN(totalRows)} registros
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={curPage <= 1}
                    onClick={() => setFilters((f) => ({ ...f, page: String(curPage - 1) }))}>
                    <ChevronLeft size={14} />
                  </Button>
                  <Button size="sm" variant="outline" disabled={curPage >= totalPgs}
                    onClick={() => setFilters((f) => ({ ...f, page: String(curPage + 1) }))}>
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
