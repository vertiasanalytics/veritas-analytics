/**
 * CorrecaoTrabalhistaUI — seção de atualização monetária compartilhada
 * Uso: <CorrecaoTrabalhistaUI verbas={[...]} />
 * Importar em trabalhista-insalubridade.tsx e trabalhista-horas-extras.tsx
 */
import React, { useMemo, useState } from "react";
import {
  TrendingUp, Calculator, Calendar, ChevronDown, ChevronRight,
  Info, AlertTriangle, CheckCircle2, BarChart3, Gavel,
} from "lucide-react";
import {
  calcularCorrecaoTrabalhista,
  fmtMoeda, fmtFator, fmtPct, fmtYM,
  type VerbaInput,
  type VerbaCorrecaoResult,
} from "@/lib/correcao-trabalhista";

// ─── Sub-componentes visuais ───────────────────────────────────────────────────

const inputCls =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white";

function CMField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function CMCard({
  icon, label, value, sub, highlight = false,
}: { icon: React.ReactNode; label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[24px] border p-5 shadow-sm ${highlight ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white" : "border-slate-200 bg-white"}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${highlight ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-white"}`}>
        {icon}
      </div>
      <div className="mt-4 text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold whitespace-nowrap text-slate-950">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function PhaseBadge({ label, color }: { label: string; color: "blue" | "violet" }) {
  const cls =
    color === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-violet-200 bg-violet-50 text-violet-700";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${cls}`}>
      {label}
    </span>
  );
}

function VerbaRow({ verba }: { verba: VerbaCorrecaoResult }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="border-t border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setOpen((p) => !p)}>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />}
            <div>
              <div className="font-medium text-slate-900 text-sm">{verba.descricao}</div>
              <div className="text-xs text-slate-400">{fmtYM(verba.competencia)} — venc. {verba.dataVencimento}</div>
            </div>
          </div>
        </td>
        <td className="px-5 py-3.5 whitespace-nowrap text-sm text-slate-700">{fmtMoeda(verba.valorNominal)}</td>
        <td className="px-5 py-3.5">
          <div className="flex flex-col gap-1">
            <PhaseBadge label="IPCA-E" color="blue" />
            <span className="text-xs text-blue-700 whitespace-nowrap">
              {verba.faseIpcaE.meses}m · ×{fmtFator(verba.faseIpcaE.fator)} · +{fmtPct(verba.faseIpcaE.taxaAcumuladaPct)}
            </span>
          </div>
        </td>
        <td className="px-5 py-3.5">
          <div className="flex flex-col gap-1">
            <PhaseBadge label="SELIC" color="violet" />
            <span className="text-xs text-violet-700 whitespace-nowrap">
              {verba.faseSelic.meses}m · ×{fmtFator(verba.faseSelic.fator)} · +{fmtPct(verba.faseSelic.taxaAcumuladaPct)}
            </span>
          </div>
        </td>
        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-semibold text-slate-700">
          ×{fmtFator(verba.fatorTotal)}
        </td>
        <td className="px-5 py-3.5 whitespace-nowrap font-bold text-slate-900">{fmtMoeda(verba.valorAtualizado)}</td>
        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-medium text-emerald-700">+{fmtMoeda(verba.acrescimo)}</td>
        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-bold text-amber-700">+{fmtPct(verba.percentualAcrescimo)}</td>
      </tr>

      {open && (
        <tr className="border-t border-slate-100 bg-slate-50">
          <td colSpan={8} className="px-8 py-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Fase IPCA-E */}
              {verba.faseIpcaE.meses > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                    <span className="h-2 w-2 rounded-full bg-blue-500" /> IPCA-E: {fmtYM(verba.faseIpcaE.deYM)} → {fmtYM(verba.faseIpcaE.ateYM)}
                  </div>
                  <div className="overflow-hidden rounded-xl border border-blue-100">
                    <table className="min-w-full text-xs">
                      <thead className="bg-blue-50 text-blue-700">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Mês</th>
                          <th className="px-3 py-2 text-right font-semibold">Taxa %</th>
                          <th className="px-3 py-2 text-right font-semibold">Fator acum.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {verba.faseIpcaE.memoria.map((m) => (
                          <tr key={m.ym} className="border-t border-blue-100">
                            <td className="px-3 py-1.5">{fmtYM(m.ym)}</td>
                            <td className="px-3 py-1.5 text-right">{fmtPct(m.taxaPct)}</td>
                            <td className="px-3 py-1.5 text-right font-mono">{fmtFator(m.fatorAcumulado)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Fase SELIC */}
              {verba.faseSelic.meses > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-700">
                    <span className="h-2 w-2 rounded-full bg-violet-500" /> SELIC: {fmtYM(verba.faseSelic.deYM)} → {fmtYM(verba.faseSelic.ateYM)}
                  </div>
                  <div className="overflow-hidden rounded-xl border border-violet-100">
                    <table className="min-w-full text-xs">
                      <thead className="bg-violet-50 text-violet-700">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Mês</th>
                          <th className="px-3 py-2 text-right font-semibold">Taxa %</th>
                          <th className="px-3 py-2 text-right font-semibold">Fator acum.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {verba.faseSelic.memoria.map((m) => (
                          <tr key={m.ym} className="border-t border-violet-100">
                            <td className="px-3 py-1.5">{fmtYM(m.ym)}</td>
                            <td className="px-3 py-1.5 text-right">{fmtPct(m.taxaPct)}</td>
                            <td className="px-3 py-1.5 text-right font-mono">{fmtFator(m.fatorAcumulado)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {verba.faseIpcaE.meses === 0 && verba.faseSelic.meses === 0 && (
                <div className="col-span-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Datas iguais — sem período de atualização para esta verba.
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  verbas: VerbaInput[];
  /** Label exibido na legenda acima das verbas (ex.: "competência", "período") */
  labelVerbas?: string;
}

export default function CorrecaoTrabalhistaUI({ verbas, labelVerbas = "verba" }: Props) {
  const hoje = new Date().toISOString().slice(0, 10);
  const cincoAnosAtras = `${new Date().getFullYear() - 5}-01-01`;

  const [dataAjuizamento, setDataAjuizamento] = useState(cincoAnosAtras);
  const [dataLiquidacao, setDataLiquidacao] = useState(hoje);
  const [expandirTodas, setExpandirTodas] = useState(false);

  const resultado = useMemo(() => {
    if (!dataAjuizamento || !dataLiquidacao || verbas.length === 0) return null;
    try {
      return calcularCorrecaoTrabalhista(verbas, dataAjuizamento, dataLiquidacao);
    } catch {
      return null;
    }
  }, [verbas, dataAjuizamento, dataLiquidacao]);

  return (
    <div className="space-y-6">

      {/* ── Fundamento legal ──────────────────────────────────────────── */}
      <div className="rounded-[24px] border border-blue-200 bg-blue-50 p-5">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-blue-900 text-sm">Fundamento: EC 113/2021 · ADC 58 STF</div>
            <p className="mt-1 text-xs leading-5 text-blue-800">
              <strong>Fase 1 (IPCA-E):</strong> Do vencimento da verba até o ajuizamento — correção monetária pura, sem juros autônomos.<br />
              <strong>Fase 2 (SELIC):</strong> Do ajuizamento até o pagamento/liquidação — SELIC acumulada substitui tanto a correção quanto os juros; <em>vedada</em> a cumulação com qualquer outro índice ou juros autônomos.
            </p>
          </div>
        </div>
      </div>

      {/* ── Parâmetros da atualização ─────────────────────────────────── */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 text-xs font-bold uppercase tracking-[0.20em] text-slate-500">Parâmetros da atualização</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CMField label="Data de ajuizamento">
            <input type="date" className={inputCls} value={dataAjuizamento} onChange={(e) => setDataAjuizamento(e.target.value)} />
          </CMField>
          <CMField label="Data final (liquidação)">
            <input type="date" className={inputCls} value={dataLiquidacao} onChange={(e) => setDataLiquidacao(e.target.value)} />
          </CMField>
          <div className="sm:col-span-2 flex items-end">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 w-full">
              <strong>{verbas.length} {labelVerbas}(s)</strong> na fila de atualização.
              Clique em qualquer linha da tabela para expandir a memória mensal completa.
            </div>
          </div>
        </div>
      </div>

      {resultado && (
        <>
          {/* ── Cards-resumo ────────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CMCard icon={<Calculator className="h-5 w-5" />} label="Total nominal" value={fmtMoeda(resultado.totais.valorNominalTotal)} sub="Soma das verbas originais" />
            <CMCard icon={<TrendingUp className="h-5 w-5" />} label="Fator médio IPCA-E" value={`×${fmtFator(resultado.totais.fatorMedioIPCAE)}`} sub="Correção pré-ajuizamento" />
            <CMCard icon={<TrendingUp className="h-5 w-5" />} label="Fator médio SELIC" value={`×${fmtFator(resultado.totais.fatorMedioSELIC)}`} sub="Correção pós-ajuizamento" />
            <CMCard icon={<Gavel className="h-5 w-5" />} label="Total atualizado" value={fmtMoeda(resultado.totais.valorAtualizadoTotal)} sub={`Acréscimo: ${fmtPct(resultado.totais.percentualMedioAcrescimo)}`} highlight />
          </div>

          {/* Banner de acréscimo */}
          <div className="rounded-[22px] bg-gradient-to-r from-slate-950 to-slate-800 p-6 text-white flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-slate-300">Acréscimo total de atualização</div>
              <div className="mt-2 text-4xl font-bold text-amber-300">{fmtMoeda(resultado.totais.acrescimoTotal)}</div>
              <div className="mt-1 text-sm text-slate-400">
                Sobre principal nominal de {fmtMoeda(resultado.totais.valorNominalTotal)} · {fmtPct(resultado.totais.percentualMedioAcrescimo)} de acréscimo médio
              </div>
            </div>
            <div className="flex gap-3">
              <div className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-center">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Fase IPCA-E</div>
                <div className="mt-1 text-lg font-semibold text-blue-300">{fmtPct((resultado.totais.fatorMedioIPCAE - 1) * 100)}</div>
                <div className="text-xs text-slate-500">média acumulada</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-center">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Fase SELIC</div>
                <div className="mt-1 text-lg font-semibold text-violet-300">{fmtPct((resultado.totais.fatorMedioSELIC - 1) * 100)}</div>
                <div className="text-xs text-slate-500">média acumulada</div>
              </div>
            </div>
          </div>

          {/* ── Tabela analítica ─────────────────────────────────────────── */}
          <div className="rounded-[26px] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-900">Memória analítica por {labelVerbas}</span>
              </div>
              <button onClick={() => setExpandirTodas((p) => !p)}
                className="text-xs font-semibold text-amber-700 hover:text-amber-900 transition">
                {expandirTodas ? "Recolher tudo" : "Expandir tudo"}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-600 text-xs">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Verba / Competência</th>
                    <th className="px-5 py-3 font-semibold whitespace-nowrap">Nominal</th>
                    <th className="px-5 py-3 font-semibold">Fase IPCA-E</th>
                    <th className="px-5 py-3 font-semibold">Fase SELIC</th>
                    <th className="px-5 py-3 font-semibold whitespace-nowrap">Fator total</th>
                    <th className="px-5 py-3 font-semibold whitespace-nowrap">Atualizado</th>
                    <th className="px-5 py-3 font-semibold whitespace-nowrap">Acréscimo</th>
                    <th className="px-5 py-3 font-semibold whitespace-nowrap">%</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.verbas.map((v) => (
                    <VerbaRowStateful key={v.id} verba={v} forceOpen={expandirTodas} />
                  ))}
                  <tr className="border-t-2 border-slate-300 bg-slate-950 text-white font-bold">
                    <td className="px-5 py-4">Total geral</td>
                    <td className="px-5 py-4 whitespace-nowrap">{fmtMoeda(resultado.totais.valorNominalTotal)}</td>
                    <td className="px-5 py-4 text-blue-300 text-xs">×{fmtFator(resultado.totais.fatorMedioIPCAE)} médio</td>
                    <td className="px-5 py-4 text-violet-300 text-xs">×{fmtFator(resultado.totais.fatorMedioSELIC)} médio</td>
                    <td className="px-5 py-4 whitespace-nowrap">—</td>
                    <td className="px-5 py-4 whitespace-nowrap text-amber-300">{fmtMoeda(resultado.totais.valorAtualizadoTotal)}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-emerald-300">+{fmtMoeda(resultado.totais.acrescimoTotal)}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-amber-300">+{fmtPct(resultado.totais.percentualMedioAcrescimo)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Aviso */}
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
            <span>
              <strong>Estimativa técnica:</strong> Os índices embutidos cobrem até mai/2025.
              Para meses posteriores, o sistema aplica fallback conservador (IPCA-E: 0,35% a.m. · SELIC: 1,00% a.m.).
              Atualize os índices via tabela oficial do IBGE/BCB antes de emitir laudo definitivo.
            </span>
          </div>
        </>
      )}

      {verbas.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-center text-slate-400 text-sm">
          Nenhuma verba calculada para atualizar. Preencha os dados nas abas anteriores e volte aqui.
        </div>
      )}
    </div>
  );
}

// Wrapper que suporta forçar abertura via prop
function VerbaRowStateful({ verba, forceOpen }: { verba: VerbaCorrecaoResult; forceOpen: boolean }) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = forceOpen || localOpen;

  return (
    <>
      <tr className="border-t border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setLocalOpen((p) => !p)}>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />}
            <div>
              <div className="font-medium text-slate-900 text-sm">{verba.descricao}</div>
              <div className="text-xs text-slate-400">{fmtYM(verba.competencia)} — venc. {verba.dataVencimento}</div>
            </div>
          </div>
        </td>
        <td className="px-5 py-3.5 whitespace-nowrap text-sm text-slate-700">{fmtMoeda(verba.valorNominal)}</td>
        <td className="px-5 py-3.5">
          <div className="flex flex-col gap-1">
            <PhaseBadge label="IPCA-E" color="blue" />
            <span className="text-xs text-blue-700 whitespace-nowrap">
              {verba.faseIpcaE.meses}m · ×{fmtFator(verba.faseIpcaE.fator)} · +{fmtPct(verba.faseIpcaE.taxaAcumuladaPct)}
            </span>
          </div>
        </td>
        <td className="px-5 py-3.5">
          <div className="flex flex-col gap-1">
            <PhaseBadge label="SELIC" color="violet" />
            <span className="text-xs text-violet-700 whitespace-nowrap">
              {verba.faseSelic.meses}m · ×{fmtFator(verba.faseSelic.fator)} · +{fmtPct(verba.faseSelic.taxaAcumuladaPct)}
            </span>
          </div>
        </td>
        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-semibold text-slate-700">
          ×{fmtFator(verba.fatorTotal)}
        </td>
        <td className="px-5 py-3.5 whitespace-nowrap font-bold text-slate-900">{fmtMoeda(verba.valorAtualizado)}</td>
        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-medium text-emerald-700">+{fmtMoeda(verba.acrescimo)}</td>
        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-bold text-amber-700">+{fmtPct(verba.percentualAcrescimo)}</td>
      </tr>

      {open && (
        <tr className="border-t border-slate-100 bg-slate-50">
          <td colSpan={8} className="px-8 py-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {verba.faseIpcaE.meses > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                    <span className="h-2 w-2 rounded-full bg-blue-500" /> IPCA-E: {fmtYM(verba.faseIpcaE.deYM)} → {fmtYM(verba.faseIpcaE.ateYM)}
                  </div>
                  <div className="overflow-hidden rounded-xl border border-blue-100 max-h-60 overflow-y-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-blue-50 text-blue-700 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Mês</th>
                          <th className="px-3 py-2 text-right font-semibold">Taxa %</th>
                          <th className="px-3 py-2 text-right font-semibold">Fator acum.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {verba.faseIpcaE.memoria.map((m) => (
                          <tr key={m.ym} className="border-t border-blue-100">
                            <td className="px-3 py-1.5">{fmtYM(m.ym)}</td>
                            <td className="px-3 py-1.5 text-right">{fmtPct(m.taxaPct)}</td>
                            <td className="px-3 py-1.5 text-right font-mono">{fmtFator(m.fatorAcumulado)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {verba.faseSelic.meses > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-700">
                    <span className="h-2 w-2 rounded-full bg-violet-500" /> SELIC: {fmtYM(verba.faseSelic.deYM)} → {fmtYM(verba.faseSelic.ateYM)}
                  </div>
                  <div className="overflow-hidden rounded-xl border border-violet-100 max-h-60 overflow-y-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-violet-50 text-violet-700 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Mês</th>
                          <th className="px-3 py-2 text-right font-semibold">Taxa %</th>
                          <th className="px-3 py-2 text-right font-semibold">Fator acum.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {verba.faseSelic.memoria.map((m) => (
                          <tr key={m.ym} className="border-t border-violet-100">
                            <td className="px-3 py-1.5">{fmtYM(m.ym)}</td>
                            <td className="px-3 py-1.5 text-right">{fmtPct(m.taxaPct)}</td>
                            <td className="px-3 py-1.5 text-right font-mono">{fmtFator(m.fatorAcumulado)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {verba.faseIpcaE.meses === 0 && verba.faseSelic.meses === 0 && (
                <div className="col-span-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Sem período de atualização para esta verba nas datas configuradas.
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
