import React from "react";
import { CheckCircle2, AlertTriangle, Clock3 } from "lucide-react";

export const currencyBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function PageShell({
  title,
  subtitle,
  icon,
  children,
  actions,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-[#0b1830]/90 p-6 shadow-[0_12px_60px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-300 ring-1 ring-amber-400/20">
              {icon}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{title}</h2>
              <p className="mt-1 text-sm text-slate-300">{subtitle}</p>
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

export function KpiMiniCard({
  title,
  value,
  tone = "blue",
}: {
  title: string;
  value: string;
  tone?: "blue" | "green" | "red" | "amber" | "purple";
}) {
  const tones = {
    blue:   "from-blue-500/20 to-blue-700/10 border-blue-400/20",
    green:  "from-emerald-500/20 to-emerald-700/10 border-emerald-400/20",
    red:    "from-red-500/20 to-red-700/10 border-red-400/20",
    amber:  "from-amber-500/20 to-orange-700/10 border-amber-400/20",
    purple: "from-purple-500/20 to-purple-700/10 border-purple-400/20",
  };
  return (
    <div className={`rounded-3xl border bg-gradient-to-br p-5 ${tones[tone]}`}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/70">{title}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

export function Card({
  title,
  children,
  subtitle,
}: {
  title: string;
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0b1830]/90 p-5 shadow-[0_12px_60px_rgba(0,0,0,0.25)]">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function GenericStatusBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    Lançada:          "bg-blue-500/15 text-blue-300 border border-blue-500/30",
    Paga:             "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    Reembolsada:      "bg-purple-500/15 text-purple-300 border border-purple-500/30",
    Ativo:            "bg-blue-500/15 text-blue-300 border border-blue-500/30",
    Levantado:        "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    Bloqueado:        "bg-red-500/15 text-red-300 border border-red-500/30",
    Expedido:         "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    Pendente:         "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    Provisionado:     "bg-blue-500/15 text-blue-300 border border-blue-500/30",
    Pago:             "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    Calculado:        "bg-blue-500/15 text-blue-300 border border-blue-500/30",
    Conferido:        "bg-purple-500/15 text-purple-300 border border-purple-500/30",
    Exportado:        "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    Conciliado:       "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    "Não conciliado": "bg-red-500/15 text-red-300 border border-red-500/30",
    Alta:             "bg-red-500/15 text-red-300 border border-red-500/30",
    Média:            "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    Baixa:            "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${map[value] || "bg-white/10 text-white border border-white/10"}`}>
      {value}
    </span>
  );
}

export function SimpleTable({
  columns,
  rows,
  emptyLabel,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyBlock
        title="Nenhum registro encontrado"
        description={emptyLabel ?? "Nenhum dado cadastrado ainda. Lance as informações para que apareçam aqui."}
      />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-y-2">
        <thead>
          <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-400">
            {columns.map((col) => (
              <th key={col} className="px-3 py-2">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="rounded-2xl bg-white/[0.03] text-sm text-slate-200 ring-1 ring-white/5">
              {row.map((cell, cIdx) => (
                <td
                  key={cIdx}
                  className={`px-3 py-3 ${cIdx === 0 ? "rounded-l-2xl" : ""} ${cIdx === row.length - 1 ? "rounded-r-2xl" : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InsightList({
  items,
}: {
  items: { id: string; title: string; description: string; severity: string }[];
}) {
  if (items.length === 0) {
    return (
      <EmptyBlock
        title="Sem insights disponíveis"
        description="Lance movimentações financeiras para que o sistema gere análises automáticas."
      />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="font-semibold text-white">{item.title}</div>
            <GenericStatusBadge value={item.severity} />
          </div>
          <p className="text-sm text-slate-300">{item.description}</p>
        </div>
      ))}
    </div>
  );
}

export function ReportCard({
  title,
  description,
  period,
  format,
}: {
  title: string;
  description: string;
  period: string;
  format: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-base font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-blue-300">{period}</span>
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-300">{format}</span>
      </div>
      <div className="mt-4 flex gap-2">
        <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10">
          Visualizar
        </button>
        <button className="rounded-xl border border-blue-400/20 bg-blue-500/15 px-3 py-2 text-xs font-medium text-blue-200 hover:bg-blue-500/20">
          Exportar
        </button>
      </div>
    </div>
  );
}

export function ActionButtons({
  primaryLabel,
  secondaryLabel,
}: {
  primaryLabel: string;
  secondaryLabel?: string;
}) {
  return (
    <>
      {secondaryLabel && (
        <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/10">
          {secondaryLabel}
        </button>
      )}
      <button className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 hover:brightness-110">
        {primaryLabel}
      </button>
    </>
  );
}

export function EmptyBlock({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-300">
        <Clock3 size={24} />
      </div>
      <div className="text-lg font-semibold text-white">{title}</div>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">{description}</p>
    </div>
  );
}

export function BooleanBadge({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
      <CheckCircle2 size={12} /> Sim
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2.5 py-1 text-xs font-semibold text-slate-300">
      <AlertTriangle size={12} /> Não
    </span>
  );
}
