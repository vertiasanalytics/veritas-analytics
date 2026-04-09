import { useState, useEffect, useCallback } from "react";
import { getAuthHeaders } from "@/context/auth-context";
import type {
  Receivable,
  Payable,
  AlertItem,
  ActivityItem,
  Cliente,
  Fornecedor,
  Contrato,
  ProcessoFinanceiro,
} from "@/pages/controladoria-juridica";

const BASE = "/api/controladoria";

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

function nowTime() {
  return `Hoje, ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function countThisMonth(items: Array<{ createdAt?: string | null }>): number {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return items.filter((i) => (i.createdAt ?? "").startsWith(ym)).length;
}

export interface CtrlData {
  loading: boolean;
  receivables: Receivable[];
  payables: Payable[];
  activities: ActivityItem[];
  alerts: AlertItem[];
  clientes: Cliente[];
  fornecedores: Fornecedor[];
  contratos: Contrato[];
  processos: ProcessoFinanceiro[];
  monthlyCount: number;

  addReceivable: (item: Omit<Receivable, "id">) => Promise<Receivable | null>;
  updateReceivableStatus: (id: string, status: Receivable["status"]) => Promise<void>;
  deleteReceivable: (id: string) => Promise<void>;

  addPayable: (item: Omit<Payable, "id">) => Promise<Payable | null>;
  updatePayableStatus: (id: string) => Promise<void>;
  deletePayable: (id: string) => Promise<void>;

  addCliente: (item: Omit<Cliente, "id">) => Promise<void>;
  addFornecedor: (item: Omit<Fornecedor, "id">) => Promise<void>;
  addContrato: (item: Omit<Contrato, "id">) => Promise<void>;
  addProcesso: (item: Omit<ProcessoFinanceiro, "id">) => Promise<void>;
  clearAlerts: () => Promise<void>;
  refetchAll: () => void;
}

export function useCtrlData(): CtrlData {
  const [loading, setLoading] = useState(true);
  const [fetchTick, setFetchTick] = useState(0);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [processos, setProcessos] = useState<ProcessoFinanceiro[]>([]);
  const [monthlyCount, setMonthlyCount] = useState(0);

  const refetchAll = useCallback(() => setFetchTick(t => t + 1), []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<Receivable[]>("/receivables"),
      apiFetch<Payable[]>("/payables"),
      apiFetch<ActivityItem[]>("/activities"),
      apiFetch<AlertItem[]>("/alerts"),
      apiFetch<Cliente[]>("/clientes"),
      apiFetch<Fornecedor[]>("/fornecedores"),
      apiFetch<Contrato[]>("/contratos"),
      apiFetch<ProcessoFinanceiro[]>("/processos"),
    ])
      .then(([rec, pay, act, alrt, cli, forn, cont, proc]) => {
        setReceivables(rec);
        setPayables(pay);
        setActivities(act);
        setAlerts(alrt);
        setClientes(cli);
        setFornecedores(forn);
        setContratos(cont);
        setProcessos(proc);
        const all = [...rec, ...pay, ...cli, ...forn, ...cont, ...proc];
        setMonthlyCount(countThisMonth(all as Array<{ createdAt?: string | null }>));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchTick]);

  // ── Internal helper ────────────────────────────────────────────────────────

  const logActivity = useCallback(
    async (title: string, description: string, value?: number) => {
      try {
        const act = await apiFetch<ActivityItem>("/activities", {
          method: "POST",
          body: JSON.stringify({ title, description, value, time: nowTime() }),
        });
        setActivities((prev) => [act, ...prev]);
      } catch {}
    },
    []
  );

  // ── Receivables ────────────────────────────────────────────────────────────

  const addReceivable = useCallback(
    async (item: Omit<Receivable, "id">): Promise<Receivable | null> => {
      try {
        const created = await apiFetch<Receivable>("/receivables", {
          method: "POST",
          body: JSON.stringify(item),
        });
        setReceivables((prev) => [created, ...prev]);
        setMonthlyCount((c) => c + 1);
        await logActivity("Nova receita lançada", `${item.cliente} — ${item.contrato}`, item.valor);
        return created;
      } catch {
        return null;
      }
    },
    [logActivity]
  );

  const updateReceivableStatus = useCallback(
    async (id: string, status: Receivable["status"]) => {
      try {
        const updated = await apiFetch<Receivable>(`/receivables/${id}`, {
          method: "PUT",
          body: JSON.stringify({ status }),
        });
        setReceivables((prev) => prev.map((r) => (r.id === id ? updated : r)));
        const label =
          status === "Liquidado" ? "Baixa registrada" : "Recebimento parcial";
        const rec = receivables.find((r) => r.id === id);
        if (rec) await logActivity(label, rec.cliente, rec.valor);
      } catch {}
    },
    [receivables, logActivity]
  );

  const deleteReceivable = useCallback(async (id: string) => {
    try {
      await apiFetch(`/receivables/${id}`, { method: "DELETE" });
      setReceivables((prev) => prev.filter((r) => r.id !== id));
    } catch {}
  }, []);

  // ── Payables ───────────────────────────────────────────────────────────────

  const addPayable = useCallback(
    async (item: Omit<Payable, "id">): Promise<Payable | null> => {
      try {
        const created = await apiFetch<Payable>("/payables", {
          method: "POST",
          body: JSON.stringify(item),
        });
        setPayables((prev) => [created, ...prev]);
        setMonthlyCount((c) => c + 1);
        await logActivity(
          "Nova despesa lançada",
          `${item.fornecedor} — ${item.categoria}`,
          -item.valor
        );
        return created;
      } catch {
        return null;
      }
    },
    [logActivity]
  );

  const updatePayableStatus = useCallback(
    async (id: string) => {
      try {
        const updated = await apiFetch<Payable>(`/payables/${id}`, {
          method: "PUT",
          body: JSON.stringify({ status: "Pago" }),
        });
        setPayables((prev) => prev.map((p) => (p.id === id ? updated : p)));
        const pay = payables.find((p) => p.id === id);
        if (pay)
          await logActivity(
            "Pagamento confirmado",
            `${pay.fornecedor} — ${pay.categoria}`,
            -pay.valor
          );
      } catch {}
    },
    [payables, logActivity]
  );

  const deletePayable = useCallback(async (id: string) => {
    try {
      await apiFetch(`/payables/${id}`, { method: "DELETE" });
      setPayables((prev) => prev.filter((p) => p.id !== id));
    } catch {}
  }, []);

  // ── Clientes ───────────────────────────────────────────────────────────────

  const addCliente = useCallback(async (item: Omit<Cliente, "id">) => {
    try {
      const created = await apiFetch<Cliente>("/clientes", {
        method: "POST",
        body: JSON.stringify(item),
      });
      setClientes((prev) => [created, ...prev]);
      setMonthlyCount((c) => c + 1);
    } catch {}
  }, []);

  // ── Fornecedores ───────────────────────────────────────────────────────────

  const addFornecedor = useCallback(async (item: Omit<Fornecedor, "id">) => {
    try {
      const created = await apiFetch<Fornecedor>("/fornecedores", {
        method: "POST",
        body: JSON.stringify(item),
      });
      setFornecedores((prev) => [created, ...prev]);
      setMonthlyCount((c) => c + 1);
    } catch {}
  }, []);

  // ── Contratos ──────────────────────────────────────────────────────────────

  const addContrato = useCallback(async (item: Omit<Contrato, "id">) => {
    try {
      const created = await apiFetch<Contrato>("/contratos", {
        method: "POST",
        body: JSON.stringify(item),
      });
      setContratos((prev) => [created, ...prev]);
      setMonthlyCount((c) => c + 1);
    } catch {}
  }, []);

  // ── Clear all alerts ───────────────────────────────────────────────────────

  const clearAlerts = useCallback(async () => {
    const ids = alerts.map((a) => a.id);
    try {
      await Promise.all(ids.map((id) => apiFetch(`/alerts/${id}`, { method: "DELETE" })));
      setAlerts([]);
    } catch {}
  }, [alerts]);

  // ── Processos ──────────────────────────────────────────────────────────────

  const addProcesso = useCallback(async (item: Omit<ProcessoFinanceiro, "id">) => {
    try {
      const created = await apiFetch<ProcessoFinanceiro>("/processos", {
        method: "POST",
        body: JSON.stringify(item),
      });
      setProcessos((prev) => [created, ...prev]);
      setMonthlyCount((c) => c + 1);
    } catch {}
  }, []);

  return {
    loading,
    receivables,
    payables,
    activities,
    alerts,
    clientes,
    fornecedores,
    contratos,
    processos,
    monthlyCount,
    addReceivable,
    updateReceivableStatus,
    deleteReceivable,
    addPayable,
    updatePayableStatus,
    deletePayable,
    addCliente,
    addFornecedor,
    addContrato,
    addProcesso,
    clearAlerts,
    refetchAll,
  };
}
