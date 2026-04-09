import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import {
  Calculator, FileText, KeyRound, Copy, Loader2, RefreshCw,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Plus, Trash2,
  Info, MapPin, Building2, TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useDebitCredits } from "@/hooks/use-wallet";

// ─────────────────────────────────────────────────────────────────────────────
// Módulo Valor da Causa — engine, tipos e utilitários
// ─────────────────────────────────────────────────────────────────────────────
import {
  parseIso, r2,
  calcSB80, calcItem,
  criterioToKey,
  FORM_STATE_INITIAL,
  buildLaudoValorCausa,
  runCalculo,
  dcParseLine, dcCalcDecimos, dcMontarLinhas, dcToCsv,
  DC_EXEMPLO,
} from "@/modules/valor-causa";

import type {
  ResultadoCalculo, FormState, ItemCalculo,
  Contribuicao, GrupoItem, OrigemBase,
  DcCompetencia, DcLinhaResultado, DcDecimoItem,
} from "@/modules/valor-causa";

import { fmtR, toBrDate, uid, buildRateMap } from "@/lib/engines/dateUtils";
import type { RateEntry } from "@/lib/engines/dateUtils";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// Alias local para compatibilidade com o código de UI existente
const INITIAL: FormState = FORM_STATE_INITIAL;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente: Formulário inline de item (abatimento/crédito)
// ─────────────────────────────────────────────────────────────────────────────
function ItemForm({ onSave, onCancel }: { onSave: (i: ItemCalculo) => void; onCancel: () => void }) {
  const [tipo, setTipo] = useState<GrupoItem>("beneficio_recebido");
  const [desc, setDesc] = useState("");
  const [rmi, setRmi] = useState("");
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [valor, setValor] = useState("");
  const [juros, setJuros] = useState("");
  const [selic, setSelicV] = useState("");

  function salvar() {
    const item: ItemCalculo = { id: uid(), tipo, descricao: desc };
    if (tipo === "beneficio_recebido") {
      item.rmi = parseFloat(rmi) || 0; item.dataInicio = ini; item.dataFim = fim;
    } else {
      item.valor = parseFloat(valor) || 0; item.juros = parseFloat(juros) || 0; item.selic = parseFloat(selic) || 0;
    }
    onSave(item);
  }

  const LABEL: Record<GrupoItem, string> = { beneficio_recebido: "Benefício Recebido", outro_credito: "Outro Crédito", outro_desconto: "Outro Desconto" };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div>
        <Label className="text-[10px] text-slate-500">Tipo</Label>
        <Select value={tipo} onValueChange={(v) => setTipo(v as GrupoItem)}>
          <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="beneficio_recebido">Benefício Recebido (a deduzir)</SelectItem>
            <SelectItem value="outro_credito">Outro Crédito (a somar)</SelectItem>
            <SelectItem value="outro_desconto">Outro Desconto (a deduzir)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-[10px] text-slate-500">Descrição</Label>
        <Input className="h-7 text-xs mt-0.5" placeholder={LABEL[tipo]} value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
      {tipo === "beneficio_recebido" ? (
        <>
          <div><Label className="text-[10px] text-slate-500">RMI recebida</Label><Input className="h-7 text-xs mt-0.5" type="number" min="0" step="0.01" placeholder="0,00" value={rmi} onChange={(e) => setRmi(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[10px] text-slate-500">Data início</Label><Input className="h-7 text-xs mt-0.5" type="date" value={ini} onChange={(e) => setIni(e.target.value)} /></div>
            <div><Label className="text-[10px] text-slate-500">Data fim</Label><Input className="h-7 text-xs mt-0.5" type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <div><Label className="text-[10px] text-slate-500">Valor</Label><Input className="h-7 text-xs mt-0.5" type="number" min="0" step="0.01" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
          <div><Label className="text-[10px] text-slate-500">Juros</Label><Input className="h-7 text-xs mt-0.5" type="number" min="0" step="0.01" placeholder="0,00" value={juros} onChange={(e) => setJuros(e.target.value)} /></div>
          <div><Label className="text-[10px] text-slate-500">SELIC</Label><Input className="h-7 text-xs mt-0.5" type="number" min="0" step="0.01" placeholder="0,00" value={selic} onChange={(e) => setSelicV(e.target.value)} /></div>
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs bg-[#0f2a4a] hover:bg-[#1e3a5f] text-white flex-1" onClick={salvar}>Gravar</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente: Tabela de contribuições (para urbano em concessão)
// ─────────────────────────────────────────────────────────────────────────────
function ContribuicoesTable({
  contribuicoes, onChange,
}: { contribuicoes: Contribuicao[]; onChange: (v: Contribuicao[]) => void; }) {
  const [novaComp, setNovaComp] = useState("");
  const [novaVal, setNovaVal] = useState("");

  function adicionar() {
    if (!novaComp || !novaVal) return;
    onChange([...contribuicoes, { id: uid(), competencia: novaComp, valor: parseFloat(novaVal) || 0 }]);
    setNovaComp(""); setNovaVal("");
  }
  function remover(id: string) { onChange(contribuicoes.filter((c) => c.id !== id)); }

  const sb80 = calcSB80(contribuicoes);
  const excluidas20Ids = new Set(sb80.excluidas20.map((c) => c.id));

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <Input type="month" className="h-7 text-xs flex-1" value={novaComp} onChange={(e) => setNovaComp(e.target.value)} />
        <Input type="number" min="0" step="0.01" className="h-7 text-xs w-24" placeholder="Valor (R$)" value={novaVal} onChange={(e) => setNovaVal(e.target.value)} />
        <Button size="sm" className="h-7 px-2 text-xs bg-[#0f2a4a] hover:bg-[#1e3a5f] text-white" onClick={adicionar}>
          <Plus className="w-3 h-3" />
        </Button>
      </div>
      {contribuicoes.length > 0 ? (
        <div className="rounded-md border border-slate-200 overflow-hidden">
          <table className="w-full text-[10px]">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left px-2 py-1 font-semibold text-slate-600">Competência</th>
                <th className="text-right px-2 py-1 font-semibold text-slate-600">Sal. Contribuição</th>
                <th className="text-center px-1 py-1 font-semibold text-slate-600">80%</th>
                <th className="w-6"></th>
              </tr>
            </thead>
            <tbody>
              {contribuicoes.map((c) => {
                const excluida = excluidas20Ids.has(c.id);
                return (
                  <tr key={c.id} className={`border-t border-slate-100 ${excluida ? "bg-red-50" : ""}`}>
                    <td className={`px-2 py-0.5 font-mono ${excluida ? "text-slate-400 line-through" : ""}`}>{c.competencia}</td>
                    <td className={`px-2 py-0.5 text-right font-mono ${excluida ? "text-slate-400 line-through" : ""}`}>{fmtR(c.valor)}</td>
                    <td className="px-1 py-0.5 text-center">
                      {excluida
                        ? <span title="Excluído (20% menores)" className="text-red-400 font-bold">✕</span>
                        : <span title="Incluído (80% melhores)" className="text-emerald-600 font-bold">✓</span>
                      }
                    </td>
                    <td className="px-1 py-0.5">
                      <button onClick={() => remover(c.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {sb80.nExcluir > 0 && (
                <tr className="border-t border-dashed border-red-200 bg-red-50">
                  <td colSpan={4} className="px-2 py-0.5 text-[9px] text-red-500 italic">
                    ✕ {sb80.nExcluir} menor{sb80.nExcluir > 1 ? "es salários descartados" : " salário descartado"} — regra dos 20% (art. 29, Lei 8.213/91)
                  </td>
                </tr>
              )}
              <tr className="border-t-2 border-slate-300 bg-blue-50">
                <td className="px-2 py-1 font-semibold text-slate-700">
                  SB estimado <span className="font-normal text-slate-500">({sb80.nManter} de {sb80.validas.length} sal.)</span>
                </td>
                <td className="px-2 py-1 text-right font-bold text-blue-700 font-mono">{fmtR(sb80.sbEstimado)}</td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[10px] text-slate-400 text-center py-2">Nenhum salário de contribuição informado. Adicione ao menos um para calcular a RMI estimada.</p>
      )}
      {contribuicoes.length > 0 && (
        <p className="text-[9px] text-slate-400 leading-relaxed">
          ✓ Incluídos (verde) · ✕ Excluídos (vermelho) — os {sb80.nManter} maiores salários de contribuição são considerados para o SB estimado conforme art. 29, Lei 8.213/91.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Painel 13º Salário — helpers de UI (apenas DOM; lógica pura em engine.ts)
// ─────────────────────────────────────────────────────────────────────────────
function dcDownload(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

function DecimoTerceiroPanel() {
  const [nomeSegurado, setNomeSegurado] = useState("MARIA DE LOURDES FRANCISCO RODRIGUES");
  const [beneficio, setBeneficio] = useState("Aposentadoria por idade (Rural)");
  const [dataInicio, setDataInicio] = useState("2023-11-16");
  const [dataFim, setDataFim] = useState("2025-06-30");
  const [texto, setTexto] = useState(DC_EXEMPLO);
  const [showAll, setShowAll] = useState(false);

  const calc = useMemo(() => {
    try {
      const comps = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map(dcParseLine);
      const decimos = dcCalcDecimos(comps, dataInicio, dataFim);
      const linhas = dcMontarLinhas(comps, decimos);
      const totalMensais = r2(linhas.filter((l) => l.tipo === "mensal").reduce((s, l) => s + l.valorCorrigido, 0));
      const totalDecimos = r2(linhas.filter((l) => l.tipo === "decimo").reduce((s, l) => s + l.valorCorrigido, 0));
      return { ok: true, linhas, decimos, totalMensais, totalDecimos, totalGeral: r2(totalMensais + totalDecimos), erro: "" };
    } catch (e) {
      return { ok: false, linhas: [] as DcLinhaResultado[], decimos: [] as DcDecimoItem[], totalMensais: 0, totalDecimos: 0, totalGeral: 0, erro: e instanceof Error ? e.message : "Erro." };
    }
  }, [texto, dataInicio, dataFim]);

  const linhasExib = showAll ? calc.linhas : calc.linhas.slice(0, 18);

  const carregarExemplo = () => {
    setNomeSegurado("MARIA DE LOURDES FRANCISCO RODRIGUES"); setBeneficio("Aposentadoria por idade (Rural)");
    setDataInicio("2023-11-16"); setDataFim("2025-06-30"); setTexto(DC_EXEMPLO);
  };

  return (
    <div className="flex gap-4 h-full overflow-hidden">
      {/* Painel esquerdo */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto pb-4">
        <Card className="shadow-sm">
          <CardHeader className="py-2 px-3 border-b"><CardTitle className="text-xs text-slate-600">Parâmetros</CardTitle></CardHeader>
          <CardContent className="p-3 space-y-3">
            <div>
              <Label className="text-[10px] text-slate-500">Nome do segurado</Label>
              <Input className="h-7 text-xs mt-0.5" value={nomeSegurado} onChange={(e) => setNomeSegurado(e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px] text-slate-500">Benefício</Label>
              <Input className="h-7 text-xs mt-0.5" value={beneficio} onChange={(e) => setBeneficio(e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px] text-slate-500">Data de início do benefício</Label>
              <Input type="date" className="h-7 text-xs mt-0.5" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px] text-slate-500">Fim dos atrasados</Label>
              <Input type="date" className="h-7 text-xs mt-0.5" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
            <div className="rounded-md bg-amber-50 border border-amber-200 p-2.5 space-y-1">
              <p className="text-[10px] font-semibold text-amber-800">Regra da Quinzena</p>
              <p className="text-[10px] text-amber-700 leading-relaxed">Início até dia 15 → 1º mês integral. Início após dia 15 → proporcional. O 13º é calculado automaticamente após a competência dezembro de cada ano.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="py-2 px-3 border-b flex-row items-center justify-between">
            <CardTitle className="text-xs text-slate-600">Competências mensais</CardTitle>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-blue-600" onClick={carregarExemplo}>Exemplo</Button>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            <p className="text-[10px] text-slate-400 leading-relaxed">Uma linha por competência:<br /><strong className="text-slate-600">MM/AAAA;valorOriginal;abatimentos;fatorCorrecao</strong></p>
            <textarea
              className="w-full min-h-[300px] rounded-md border border-slate-200 bg-white px-2.5 py-2 font-mono text-[10px] text-slate-700 shadow-sm resize-y outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
              value={texto} onChange={(e) => setTexto(e.target.value)}
            />
            {calc.erro && (
              <div className="flex gap-1.5 items-start rounded-md bg-red-50 border border-red-200 px-2.5 py-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-red-700 leading-relaxed">{calc.erro}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Área direita */}
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto pb-4 min-w-0">
        {/* Totais */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Parcelas mensais</p>
              <p className="text-xl font-bold mt-1">{fmtR(calc.totalMensais)}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-amber-200">
            <CardContent className="p-3">
              <p className="text-[10px] text-amber-600 uppercase tracking-wide font-semibold">13º salário</p>
              <p className="text-xl font-bold mt-1 text-amber-700">{fmtR(calc.totalDecimos)}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-emerald-200">
            <CardContent className="p-3">
              <p className="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold">Total geral</p>
              <p className="text-xl font-bold mt-1 text-emerald-700">{fmtR(calc.totalGeral)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela demonstrativa */}
        <Card className="shadow-sm">
          <CardHeader className="py-2 px-4 border-b flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xs text-slate-600">Demonstrativo do cálculo</CardTitle>
              <p className="text-[10px] text-slate-400 mt-0.5">{nomeSegurado || "—"} · {beneficio || "—"}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => dcDownload("valor-causa-decimo.csv", dcToCsv(calc.linhas), "text/csv;charset=utf-8")}>CSV</Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => dcDownload("valor-causa-decimo.json", JSON.stringify({ nomeSegurado, beneficio, dataInicio, dataFim, resultado: { totalMensais: calc.totalMensais, totalDecimos: calc.totalDecimos, totalGeral: calc.totalGeral }, linhas: calc.linhas, decimos: calc.decimos }, null, 2), "application/json")}>JSON</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-72">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="py-2 text-[10px] w-28">Competência</TableHead>
                    <TableHead className="py-2 text-[10px] text-right">Valor original</TableHead>
                    <TableHead className="py-2 text-[10px] text-right">Abatimentos</TableHead>
                    <TableHead className="py-2 text-[10px] text-right">Fator de correção</TableHead>
                    <TableHead className="py-2 text-[10px] text-right">Valor corrigido</TableHead>
                    <TableHead className="py-2 text-[10px]">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhasExib.map((l, i) => (
                    <TableRow key={`${l.competencia}-${i}`} className={l.tipo === "decimo" ? "bg-amber-50/70" : ""}>
                      <TableCell className={`py-1.5 text-xs ${l.tipo === "decimo" ? "font-bold text-amber-700" : "font-medium"}`}>{l.competencia}</TableCell>
                      <TableCell className="py-1.5 text-xs text-right tabular-nums">{fmtR(l.valorOriginal)}</TableCell>
                      <TableCell className="py-1.5 text-xs text-right tabular-nums text-slate-400">{fmtR(l.abatimentos)}</TableCell>
                      <TableCell className="py-1.5 text-xs text-right tabular-nums text-slate-500">{l.fatorCorrecao.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 8 })}</TableCell>
                      <TableCell className="py-1.5 text-xs text-right tabular-nums font-semibold">{fmtR(l.valorCorrigido)}</TableCell>
                      <TableCell className="py-1.5 text-[10px] text-slate-500 max-w-[200px] truncate" title={l.detalhes}>{l.detalhes ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            {calc.linhas.length > 18 && (
              <div className="px-4 py-2 border-t text-center">
                <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? <><ChevronUp className="w-3 h-3" />Mostrar menos</> : <><ChevronDown className="w-3 h-3" />Ver todas ({calc.linhas.length} linhas)</>}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumo 13º por ano */}
        {calc.decimos.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-4 border-b"><CardTitle className="text-xs text-slate-600">Resumo do 13º por ano</CardTitle></CardHeader>
            <CardContent className="p-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {calc.decimos.map((d) => (
                <div key={d.ano} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800">Ano {d.ano}</span>
                    <span className="text-sm font-bold text-amber-700">{fmtR(d.valorCorrigido)}</span>
                  </div>
                  <Separator className="bg-amber-100" />
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] text-slate-600">
                    <div><span className="text-slate-400 block">Benefício base</span><strong>{fmtR(d.beneficioBase)}</strong></div>
                    <div><span className="text-slate-400 block">Meses considerados</span><strong>{d.mesesConsiderados}</strong></div>
                    <div><span className="text-slate-400 block">Valor s/ correção</span><strong>{fmtR(d.valorOriginal)}</strong></div>
                    <div><span className="text-slate-400 block">Fator de correção</span><strong>{d.fatorCorrecao.toFixed(6)}</strong></div>
                    <div className="col-span-2"><span className="text-slate-400 block">Referência de correção</span><strong>{d.referenciaCorrecao}</strong></div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Fórmula */}
        <Card className="shadow-sm border-slate-100">
          <CardContent className="p-3 space-y-2">
            <p className="text-[10px] font-semibold text-slate-600">Fórmula aplicada</p>
            <p className="text-[10px] text-slate-500 leading-relaxed">Base do 13º = competência de dezembro daquele ano (ou última do ano se dezembro não constar). No ano inicial, o 1º mês entra integralmente se o início for até o dia 15; se após, entra proporcionalmente.</p>
            <div className="rounded-md bg-slate-100 px-3 py-2 font-mono text-[10px] text-slate-700 space-y-0.5">
              <div>13º = (benefício base ÷ 12) × meses considerados</div>
              <div>valor corrigido = (valor original − abatimentos) × fator de correção</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────
export default function ValorCausaPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const debitCredits = useDebitCredits();
  const [creditoDebitado, setCreditoDebitado] = useState(false);
  const searchString = useSearch();
  const { data: embeddedData } = useQuery({
    queryKey: ["embedded-indexes-vc"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/indexes/embedded`);
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: Infinity,
  });

  const [form, setForm] = useState<FormState>(INITIAL);
  const [result, setResult] = useState<ResultadoCalculo | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [showAllParcelas, setShowAllParcelas] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // ── INPC map — reajuste anual do benefício (art. 41-A Lei 8.213/91) ────────
  const inpcMapAtual = useMemo<Map<string, number>>(() => {
    const embIndices: any[] = (embeddedData as any)?.indices ?? [];
    const inpcIdx = embIndices.find((i: any) => i.key === "INPC");
    const rates: RateEntry[] = (inpcIdx?.records ?? []).map((r: any) => ({
      competencia: String(r.period ?? ""), taxa: Number(r.rate ?? 0),
    }));
    return buildRateMap(rates);
  }, [embeddedData]);

  // ── Mapa de correção — bifásico (EC 113/2021) ou uniforme ────────────────
  // Fase 1 (≤ 2021-11): critérioCorrecao (IPCA-E ou INPC) | Fase 2 (≥ 2021-12): SELIC
  const corrMapAtual = useMemo<Map<string, number>>(() => {
    const embIndices: any[] = (embeddedData as any)?.indices ?? [];

    const isBifasica = form.usarSelicPosEC113 && criterioToKey(form.criterioCorrecao) !== "SELIC";

    if (isBifasica) {
      const fase1Key = criterioToKey(form.criterioCorrecao); // IPCA_E ou INPC
      const fase1Idx = embIndices.find((i: any) => i.key === fase1Key);
      const selicIdx = embIndices.find((i: any) => i.key === "SELIC");
      const rates: RateEntry[] = [];
      for (const r of (fase1Idx?.records ?? [])) {
        if (String(r.period ?? "") <= "2021-11")
          rates.push({ competencia: String(r.period), taxa: Number(r.rate ?? 0) });
      }
      for (const r of (selicIdx?.records ?? [])) {
        if (String(r.period ?? "") >= "2021-12")
          rates.push({ competencia: String(r.period), taxa: Number(r.rate ?? 0) });
      }
      return buildRateMap(rates);
    }

    // Unifásico
    const embKey = criterioToKey(form.criterioCorrecao);
    const embIdx = embIndices.find((i: any) => i.key === embKey);
    const rates: RateEntry[] = (embIdx?.records ?? []).map((r: any) => ({
      competencia: String(r.period ?? ""), taxa: Number(r.rate ?? 0),
    }));
    return buildRateMap(rates);
  }, [embeddedData, form.criterioCorrecao, form.usarSelicPosEC113]);

  const [chaveRecuperacao, setChaveRecuperacao] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [liquidacaoImportada, setLiquidacaoImportada] = useState(false);
  const [adicionandoItem, setAdicionandoItem] = useState(false);

  function upd<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // ── Preview dinâmico da regra de base ────────────────────────────────────
  const previewTexto = useMemo(() => {
    if (form.naturezaSegurado === "rural")
      return "Será utilizado o salário mínimo vigente em cada competência (piso legal rural).";
    if (form.situacaoBeneficio === "concedido")
      return "Será utilizada a RMI informada, com reajustes previdenciários anuais no mês-aniversário da DIB.";
    if (form.origemBase === "contribuicoes") {
      const sb80 = calcSB80(form.contribuicoes);
      if (sb80.validas.length > 0) {
        const { sbEstimado, nManter, nExcluir, validas } = sb80;
        const rmiEst = r2(sbEstimado * form.coeficiente);
        const exclTxt = nExcluir > 0 ? `, descartando ${nExcluir} menor${nExcluir > 1 ? "es" : ""}` : "";
        return `Regra dos 80% (art. 29, Lei 8.213/91): ${nManter} de ${validas.length} salários considerados${exclTxt}. SB estimado = ${fmtR(sbEstimado)}, coef. ${(form.coeficiente * 100).toFixed(0)}% → RMI estimada = ${fmtR(rmiEst)}. Reajustes anuais serão aplicados.`;
      }
      return "Será estimada a RMI com base no histórico contributivo. Informe os salários de contribuição abaixo.";
    }
    return "Na ausência de histórico contributivo válido, será aplicado o salário mínimo da competência como critério subsidiário.";
  }, [form.naturezaSegurado, form.situacaoBeneficio, form.origemBase, form.contribuicoes, form.coeficiente]);

  const precisaRmi = form.naturezaSegurado === "urbano" &&
    (form.situacaoBeneficio === "concedido" ||
      (form.situacaoBeneficio === "concessao" && form.origemBase === "rmi"));

  // ── Importação automática do localStorage (vindo do Previdenciário) ──────
  useEffect(() => {
    const raw = localStorage.getItem("veritas_liquidacao_export");
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      setForm((f) => ({
        ...f,
        autorNome:       d.segurado         || f.autorNome,
        especie:         d.especie           || f.especie,
        dib:             d.dib               || f.dib,
        dip:             d.dip               || f.dip,
        der:             d.der               || f.der,
        dataSentenca:    d.data_sentenca     || f.dataSentenca,
        dataBaseCalculo: d.data_base_calculo || f.dataBaseCalculo,
        rmi:             Number(d.rmi)       || f.rmi,
        rma:             Number(d.rma)       || f.rma,
        origemRmi:       "manual",
        liquidacaoJson:  raw,
      }));
      setLiquidacaoImportada(true);
      localStorage.removeItem("veritas_liquidacao_export");
      toast({ title: "Liquidação importada", description: `RMI: ${fmtR(Number(d.rmi))} · DIB: ${d.dib ?? "—"}` });
    } catch (_) {}
  }, []);

  // ── Recuperação por URL ?key= ─────────────────────────────────────────────
  useEffect(() => {
    const key = new URLSearchParams(searchString).get("key");
    if (!key) return;
    setRecuperando(true);
    fetch(`${API_BASE}/api/previdenciario/recover/${key.toUpperCase()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const s = data.calcState;
        if (s.form) setForm(s.form);
        if (s.result) setResult(s.result);
        setChaveRecuperacao(data.publicKey);
        toast({ title: "Cálculo recuperado", description: `Chave: ${data.publicKey}` });
      })
      .catch(() => toast({ title: "Chave não encontrada", variant: "destructive" }))
      .finally(() => setRecuperando(false));
  }, [searchString]);

  // ── Importar JSON da liquidação ───────────────────────────────────────────
  const importarJson = useCallback(() => {
    setJsonError(null);
    try {
      const raw = JSON.parse(form.liquidacaoJson);
      if (!raw.rmi) throw new Error("Campo 'rmi' não encontrado no JSON.");
      setForm((f) => ({
        ...f,
        rmi: Number(raw.rmi) || f.rmi,
        dib: raw.dib || f.dib, dip: raw.dip || f.dip, der: raw.der || f.der,
        dataSentenca: raw.data_sentenca || f.dataSentenca,
        dataBaseCalculo: raw.data_base_calculo || f.dataBaseCalculo,
        rma: Number(raw.rma) || f.rma, especie: raw.especie || f.especie,
        autorNome: raw.segurado && !f.autorNome ? raw.segurado : f.autorNome,
        autorCpf: raw.cpf && !f.autorCpf ? raw.cpf : f.autorCpf,
      }));
      toast({ title: "JSON importado", description: `RMI: ${fmtR(Number(raw.rmi))}` });
    } catch (e: any) { setJsonError(e.message ?? "JSON inválido"); }
  }, [form.liquidacaoJson, form.autorNome, form.autorCpf, toast]);

  // ── Calcular ──────────────────────────────────────────────────────────────
  const calcular = useCallback(async () => {
    if (!creditoDebitado) {
      const ok = await debitCredits(3, "Cálculo do Valor da Causa");
      if (!ok) return;
      setCreditoDebitado(true);
    }
    setCalcError(null); setResult(null);
    try {
      const res = runCalculo(form, corrMapAtual, inpcMapAtual);
      setResult(res);
      setShowAllParcelas(false);
    } catch (e: any) { setCalcError(e.message ?? "Erro no cálculo"); }
  }, [form, corrMapAtual, inpcMapAtual, debitCredits, creditoDebitado]);

  // ── Gerar Laudo ────────────────────────────────────────────────────────────
  const gerarLaudo = useCallback(async () => {
    if (!result) return;
    const agora   = new Date().toLocaleString("pt-BR");
    const logoUrl = `${window.location.origin}${API_BASE}/veritasanalytics.png`;
    const html = buildLaudoValorCausa({ form, result, user, corrMap: corrMapAtual, chaveRecuperacao, agora, logoUrl });

    const w = window.open("", "_blank", "width=1100,height=900,scrollbars=yes");
    if (!w) { toast({ title: "Popup bloqueado", description: "Permita popups para este site.", variant: "destructive" }); return; }
    w.document.write(html);
    w.document.close();

    setSalvando(true);
    try {
      const res = await fetch(`${API_BASE}/api/previdenciario/save`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ calcState: { form, result } }),
      });
      if (res.ok) {
        const data = await res.json();
        setChaveRecuperacao(data.publicKey);
        try { const el = w.document.getElementById("laudo-chave"); if (el) el.textContent = `Chave: ${data.publicKey}`; } catch (_) {}
      }
    } catch (_) {} finally { setSalvando(false); }
  }, [result, form, chaveRecuperacao, user, toast, corrMapAtual, inpcMapAtual]);

  const resetar = () => {
    setForm(INITIAL); setResult(null); setCalcError(null);
    setChaveRecuperacao(null); setJsonError(null);
    setLiquidacaoImportada(false); setCreditoDebitado(false);
  };

  const GRUPO_LABEL: Record<GrupoItem, string> = { beneficio_recebido: "Ben. Recebido", outro_credito: "Outro Crédito", outro_desconto: "Outro Desconto" };
  const GRUPO_COLOR: Record<GrupoItem, string> = { beneficio_recebido: "text-red-600", outro_credito: "text-green-600", outro_desconto: "text-orange-600" };
  const parcelasExib = showAllParcelas ? (result?.parcelasVencidas ?? []) : (result?.parcelasVencidas.slice(0, 12) ?? []);

  // ── Badge de base (UI) ───────────────────────────────────────────────────
  const badgeUiConfig = useMemo(() => {
    if (form.naturezaSegurado === "rural")
      return { label: "Base rural", color: "border-green-400 text-green-700 bg-green-50" };
    if (form.situacaoBeneficio === "concedido")
      return { label: "Base urbana por RMI", color: "border-blue-400 text-blue-700 bg-blue-50" };
    if (form.origemBase === "contribuicoes" && form.contribuicoes.filter((c) => c.valor > 0).length > 0)
      return { label: "Base urbana por contribuições", color: "border-violet-400 text-violet-700 bg-violet-50" };
    return { label: "Base subsidiária", color: "border-amber-400 text-amber-700 bg-amber-50" };
  }, [form.naturezaSegurado, form.situacaoBeneficio, form.origemBase, form.contribuicoes]);

  return (
    <div className="flex flex-col h-full gap-3 overflow-hidden">

      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">

      {/* ── Painel esquerdo ── */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto pb-4">

        <Card className="shadow-sm bg-gradient-to-br from-[#0f2a4a] to-[#1c5ca4] text-white border-0">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="w-4 h-4 text-blue-300" />
              <span className="text-xs font-bold tracking-wide">CÁLCULO DO VALOR DA CAUSA</span>
            </div>
            <p className="text-[10px] text-blue-200 leading-tight">Módulo Previdenciário · CJF 2025</p>
          </CardContent>
        </Card>

        {liquidacaoImportada && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 space-y-0.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
              <CheckCircle2 className="w-3 h-3" />Dados importados automaticamente
            </div>
            <p className="text-[10px] text-emerald-600 leading-tight">RMI, DIB, DER e dados do segurado transferidos da Liquidação Previdenciária.</p>
            <button className="text-[10px] text-emerald-500 hover:text-emerald-700 underline" onClick={() => setLiquidacaoImportada(false)}>Fechar</button>
          </div>
        )}

        {recuperando && (
          <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-2.5 py-2 text-xs text-blue-700">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />Recuperando cálculo…
          </div>
        )}

        {/* ── Definição da Base Previdenciária ── */}
        <Card className="shadow-sm border-blue-200">
          <CardHeader className="py-2 px-3 border-b bg-blue-50">
            <CardTitle className="text-xs text-blue-800 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />Definição da Base Previdenciária
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-3">
            {/* Natureza do segurado */}
            <div>
              <Label className="text-[10px] text-slate-500 mb-1 block">Natureza do segurado</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {([["urbano", "Urbano", Building2], ["rural", "Rural", MapPin]] as const).map(([val, label, Icon]) => (
                  <button
                    key={val}
                    onClick={() => upd("naturezaSegurado", val)}
                    className={`flex items-center gap-1.5 justify-center rounded-md border px-2 py-1.5 text-[10px] font-semibold transition-colors ${form.naturezaSegurado === val ? "bg-[#0f2a4a] border-[#0f2a4a] text-white" : "border-slate-200 text-slate-500 hover:border-slate-400"}`}
                  >
                    <Icon className="w-3 h-3" />{label}
                  </button>
                ))}
              </div>
            </div>

            {/* Situação do benefício — apenas para urbano */}
            {form.naturezaSegurado === "urbano" && (
              <div>
                <Label className="text-[10px] text-slate-500 mb-1 block">Situação do benefício</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {([["concedido", "Já concedido"], ["concessao", "Concessão / revisão"]] as const).map(([val, label]) => (
                    <button key={val} onClick={() => upd("situacaoBeneficio", val)}
                      className={`rounded-md border px-2 py-1.5 text-[10px] font-semibold transition-colors ${form.situacaoBeneficio === val ? "bg-[#0f2a4a] border-[#0f2a4a] text-white" : "border-slate-200 text-slate-500 hover:border-slate-400"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Origem da base — apenas para urbano em concessão */}
            {form.naturezaSegurado === "urbano" && form.situacaoBeneficio === "concessao" && (
              <div>
                <Label className="text-[10px] text-slate-500 mb-1 block">Origem da base de cálculo</Label>
                <Select value={form.origemBase} onValueChange={(v) => upd("origemBase", v as OrigemBase)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rmi">RMI informada manualmente</SelectItem>
                    <SelectItem value="contribuicoes">Contribuições do segurado</SelectItem>
                    <SelectItem value="subsidiario">Salário mínimo subsidiário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Preview da regra */}
            <div className="rounded-md bg-slate-50 border border-slate-200 px-2.5 py-2">
              <Badge variant="outline" className={`text-[9px] mb-1.5 ${badgeUiConfig.color}`}>
                {badgeUiConfig.label}
              </Badge>
              <p className="text-[10px] text-slate-500 leading-relaxed">{previewTexto}</p>
            </div>

            {/* Alerta subsidiário */}
            {(form.naturezaSegurado === "urbano" && form.situacaoBeneficio === "concessao" && form.origemBase === "subsidiario") && (
              <div className="flex gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700 leading-relaxed">Base urbana sem histórico contributivo. Aplicado salário mínimo como critério subsidiário.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dados processuais */}
        <Card className="shadow-sm">
          <CardHeader className="py-2 px-3 border-b"><CardTitle className="text-xs text-slate-600">Dados Processuais</CardTitle></CardHeader>
          <CardContent className="p-3 space-y-2">
            <div><Label className="text-[10px] text-slate-500">Nº do Processo</Label><Input className="h-7 text-xs mt-0.5" placeholder="0000000-00.0000.0.00.0000" value={form.processoNumero} onChange={(e) => upd("processoNumero", e.target.value)} /></div>
            <div><Label className="text-[10px] text-slate-500">Data de Ajuizamento *</Label><Input className="h-7 text-xs mt-0.5" type="date" value={form.dataAjuizamento} onChange={(e) => upd("dataAjuizamento", e.target.value)} /></div>
            <div><Label className="text-[10px] text-slate-500">Autor / Exequente</Label><Input className="h-7 text-xs mt-0.5" placeholder="Nome completo" value={form.autorNome} onChange={(e) => upd("autorNome", e.target.value)} /></div>
            <div><Label className="text-[10px] text-slate-500">CPF</Label><Input className="h-7 text-xs mt-0.5" placeholder="000.000.000-00" value={form.autorCpf} onChange={(e) => upd("autorCpf", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-[10px] text-slate-500">% do Acordo</Label><Input className="h-7 text-xs mt-0.5" type="number" min="1" max="100" value={form.percentualAcordo} onChange={(e) => upd("percentualAcordo", Number(e.target.value))} /></div>
              <div><Label className="text-[10px] text-slate-500">Parc. Vincendas</Label><Input className="h-7 text-xs mt-0.5" type="number" min="0" value={form.parcelasVincendas} onChange={(e) => upd("parcelasVincendas", Number(e.target.value))} /></div>
            </div>
            <div
              className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer select-none transition-colors ${form.incluir13o ? "bg-amber-50 border-amber-300" : "border-slate-200 hover:bg-slate-50"}`}
              onClick={() => upd("incluir13o", !form.incluir13o)}
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${form.incluir13o ? "bg-amber-500 border-amber-500" : "border-slate-300"}`}>
                {form.incluir13o && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-700 leading-tight">Incluir 13º salário nas parcelas</p>
                <p className="text-[9px] text-slate-400 leading-tight">Regra da quinzena — art. 40, §6º Lei 8.213/91</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dados do benefício */}
        <Card className="shadow-sm">
          <CardHeader className="py-2 px-3 border-b"><CardTitle className="text-xs text-slate-600">Dados do Benefício</CardTitle></CardHeader>
          <CardContent className="p-3 space-y-2">
            <Select value={form.origemRmi} onValueChange={(v) => upd("origemRmi", v as "manual" | "liquidacao_json")}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Informar manualmente</SelectItem>
                <SelectItem value="liquidacao_json">Importar JSON da liquidação</SelectItem>
              </SelectContent>
            </Select>

            {form.origemRmi === "liquidacao_json" && (
              <div className="space-y-2">
                <textarea className="w-full h-28 text-[10px] font-mono p-2 rounded-md border border-slate-200 bg-slate-50 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder={'{\n  "rmi": 1319.60,\n  "dib": "2023-11-16",\n  ...\n}'}
                  value={form.liquidacaoJson} onChange={(e) => { setJsonError(null); upd("liquidacaoJson", e.target.value); }} />
                {jsonError && <p className="text-[10px] text-red-600">{jsonError}</p>}
                <Button size="sm" variant="outline" className="h-7 text-xs w-full" onClick={importarJson}>Importar campos do JSON</Button>
              </div>
            )}

            <Separator />
            <div><Label className="text-[10px] text-slate-500">Espécie</Label><Input className="h-7 text-xs mt-0.5" placeholder="Aposentadoria por Idade" value={form.especie} onChange={(e) => upd("especie", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-[10px] text-slate-500">DIB *</Label><Input className="h-7 text-xs mt-0.5" type="date" value={form.dib} onChange={(e) => upd("dib", e.target.value)} /></div>
              <div><Label className="text-[10px] text-slate-500">DIP</Label><Input className="h-7 text-xs mt-0.5" type="date" value={form.dip} onChange={(e) => upd("dip", e.target.value)} /></div>
              <div><Label className="text-[10px] text-slate-500">DER</Label><Input className="h-7 text-xs mt-0.5" type="date" value={form.der} onChange={(e) => upd("der", e.target.value)} /></div>
              <div><Label className="text-[10px] text-slate-500">Data Sentença</Label><Input className="h-7 text-xs mt-0.5" type="date" value={form.dataSentenca} onChange={(e) => upd("dataSentenca", e.target.value)} /></div>
            </div>

            {/* RMI: só exibe se for necessária (urbano concedido ou concessão por RMI) */}
            {precisaRmi ? (
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px] text-slate-500">RMI *</Label><Input className="h-7 text-xs mt-0.5" type="number" min="0" step="0.01" placeholder="0,00" value={form.rmi || ""} onChange={(e) => upd("rmi", Number(e.target.value))} /></div>
                <div><Label className="text-[10px] text-slate-500">RMA</Label><Input className="h-7 text-xs mt-0.5" type="number" min="0" step="0.01" placeholder="0,00" value={form.rma || ""} onChange={(e) => upd("rma", Number(e.target.value))} /></div>
              </div>
            ) : (
              <div>
                <Label className="text-[10px] text-slate-500">RMA (opcional)</Label>
                <Input className="h-7 text-xs mt-0.5" type="number" min="0" step="0.01" placeholder="0,00 — será calculado automaticamente" value={form.rma || ""} onChange={(e) => upd("rma", Number(e.target.value))} />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {form.naturezaSegurado === "rural"
                    ? "Valor base: salário mínimo da última competência."
                    : "RMI será estimada via contribuições ou salário mínimo."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contribuições — apenas para urbano em concessão + contribuições */}
        {form.naturezaSegurado === "urbano" && form.situacaoBeneficio === "concessao" && form.origemBase === "contribuicoes" && (
          <Card className="shadow-sm border-violet-200">
            <CardHeader className="py-2 px-3 border-b bg-violet-50">
              <CardTitle className="text-xs text-violet-800 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />Salários de Contribuição
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              <ContribuicoesTable contribuicoes={form.contribuicoes} onChange={(v) => upd("contribuicoes", v)} />
              <div>
                <Label className="text-[10px] text-slate-500">Coeficiente do benefício</Label>
                <Select value={String(form.coeficiente)} onValueChange={(v) => upd("coeficiente", parseFloat(v))}>
                  <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1.0">100% — Aposentadoria por invalidez / acidente</SelectItem>
                    <SelectItem value="0.8">80% — Aposentadoria por idade (estimativa)</SelectItem>
                    <SelectItem value="0.7">70% — Fator previdenciário baixo (estimativa)</SelectItem>
                    <SelectItem value="0.91">91% — Auxílio por incapacidade</SelectItem>
                    <SelectItem value="0.5">50% — Pensão por morte (cota mínima)</SelectItem>
                  </SelectContent>
                </Select>
                {form.contribuicoes.filter((c) => c.valor > 0).length > 0 && (
                  <p className="text-[10px] text-violet-600 mt-1">
                    SB médio = {fmtR(r2(form.contribuicoes.reduce((s, c) => s + c.valor, 0) / form.contribuicoes.filter((c) => c.valor > 0).length))} × {(form.coeficiente * 100).toFixed(0)}% = <strong>{fmtR(r2((form.contribuicoes.reduce((s, c) => s + c.valor, 0) / form.contribuicoes.filter((c) => c.valor > 0).length) * form.coeficiente))}</strong>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Parâmetros */}
        <Card className="shadow-sm">
          <CardHeader className="py-2 px-3 border-b"><CardTitle className="text-xs text-slate-600">Parâmetros do Cálculo</CardTitle></CardHeader>
          <CardContent className="p-3 space-y-2">
            <div><Label className="text-[10px] text-slate-500">Critério de Correção</Label>
              <Select value={form.criterioCorrecao} onValueChange={(v) => upd("criterioCorrecao", v)}>
                <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SELIC">SELIC</SelectItem>
                  <SelectItem value="INPC">INPC</SelectItem>
                  <SelectItem value="IPCA-E">IPCA-E</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between py-1">
              <Label className="text-[10px] text-slate-500">SELIC pós EC 113/2021</Label>
              <Switch checked={form.usarSelicPosEC113} onCheckedChange={(v) => upd("usarSelicPosEC113", v)} />
            </div>
          </CardContent>
        </Card>

        {/* Abatimentos e créditos */}
        <Card className="shadow-sm">
          <CardHeader className="py-2 px-3 border-b flex-row items-center justify-between">
            <CardTitle className="text-xs text-slate-600">Abatimentos e Créditos</CardTitle>
            {!adicionandoItem && (
              <Button size="sm" variant="ghost" className="h-6 text-[10px] text-blue-600 gap-0.5 px-1.5" onClick={() => setAdicionandoItem(true)}>
                <Plus className="w-3 h-3" />Adicionar
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            {adicionandoItem && (
              <ItemForm
                onSave={(item) => { upd("itens", [...form.itens, item]); setAdicionandoItem(false); }}
                onCancel={() => setAdicionandoItem(false)}
              />
            )}
            {form.itens.length === 0 && !adicionandoItem && (
              <p className="text-[10px] text-slate-400 text-center py-2">Nenhum item cadastrado.<br />Use o botão acima para adicionar.</p>
            )}
            {form.itens.map((item) => (
              <div key={item.id} className="flex items-start justify-between rounded-md bg-slate-50 border border-slate-100 px-2 py-1.5 gap-1">
                <div className="flex-1 min-w-0">
                  <span className={`text-[9px] font-bold uppercase tracking-wide ${GRUPO_COLOR[item.tipo]}`}>{GRUPO_LABEL[item.tipo]}</span>
                  <p className="text-[10px] text-slate-700 truncate">{item.descricao || "—"}</p>
                  {item.tipo === "beneficio_recebido"
                    ? <p className="text-[9px] text-slate-400 font-mono">{fmtR(item.rmi ?? 0)} · {toBrDate(item.dataInicio)} → {toBrDate(item.dataFim)}</p>
                    : <p className="text-[9px] text-slate-400 font-mono">{fmtR((item.valor ?? 0) + (item.juros ?? 0) + (item.selic ?? 0))}</p>
                  }
                </div>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400 hover:text-red-600 flex-shrink-0"
                  onClick={() => upd("itens", form.itens.filter((i) => i.id !== item.id))}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="space-y-2">
          <Button className="w-full h-8 text-xs bg-[#0f2a4a] hover:bg-[#1e3a5f] text-white gap-1.5" onClick={calcular}>
            <Calculator className="w-3.5 h-3.5" />Calcular Valor da Causa
          </Button>
          <Button variant="outline" className="w-full h-7 text-xs gap-1.5 text-slate-500" onClick={resetar}>
            <RefreshCw className="w-3 h-3" />Limpar
          </Button>
        </div>
      </div>

      {/* ── Painel direito: resultado ── */}
      <div className="flex-1 overflow-y-auto pb-4 space-y-3">
        {!result && !calcError && (
          <div className="flex flex-col items-center justify-center h-60 text-center text-slate-400 gap-3">
            <Calculator className="w-12 h-12 text-slate-200" />
            <div><p className="font-semibold text-slate-500">Preencha os dados e clique em Calcular</p><p className="text-xs mt-1">O resultado aparecerá aqui</p></div>
          </div>
        )}

        {calcError && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{calcError}
          </div>
        )}

        {result && (
          <>
            {/* Badge de base + alerta */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`text-xs font-semibold ${badgeUiConfig.color}`}>
                {result.badgeBase}
              </Badge>
              {result.temAlertaSubsidiario && (
                <div className="flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs text-amber-700">
                  <AlertCircle className="w-3.5 h-3.5" />Base urbana sem histórico contributivo — salário mínimo subsidiário aplicado
                </div>
              )}
              {result.rmiEstimada && (
                <Badge variant="outline" className="text-xs border-violet-300 text-violet-700 bg-violet-50">
                  SB {fmtR(result.sbEstimado ?? 0)} → RMI estimada {fmtR(result.rmiEstimada)}
                </Badge>
              )}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Benefícios Devidos", value: fmtR(result.totalVencidasCorrigidas), color: "bg-slate-700" },
                { label: "Vincendas", value: fmtR(result.totalVincendas), color: "bg-indigo-700" },
                { label: "Total Abatimentos", value: fmtR(result.totalAbatimentos), color: "bg-red-600" },
                { label: "Valor da Causa Final", value: fmtR(result.valorCausaFinal), color: "bg-green-600" },
              ].map((m) => (
                <div key={m.label} className={`${m.color} text-white rounded-xl p-3`}>
                  <p className="text-[9px] uppercase tracking-widest opacity-70 mb-1">{m.label}</p>
                  <p className="text-sm font-extrabold leading-tight">{m.value}</p>
                </div>
              ))}
            </div>

            {/* Abatimentos e créditos */}
            {form.itens.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="py-2 px-4 border-b"><CardTitle className="text-xs text-slate-600">Abatimentos e Créditos Adicionais</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs py-1.5">Grupo</TableHead>
                        <TableHead className="text-xs py-1.5">Descrição</TableHead>
                        <TableHead className="text-xs py-1.5 text-right">Valor Apurado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.itens.map((item) => {
                        const val = calcItem(item, parseIso(form.dataAjuizamento), corrMapAtual);
                        const sinal = item.tipo === "outro_credito" ? "+" : "−";
                        return (
                          <TableRow key={item.id} className="text-xs">
                            <TableCell className="py-1"><span className={`font-bold ${GRUPO_COLOR[item.tipo]}`}>{GRUPO_LABEL[item.tipo]}</span></TableCell>
                            <TableCell className="py-1 text-slate-600">{item.descricao || "—"}</TableCell>
                            <TableCell className={`py-1 text-right font-mono font-semibold ${item.tipo === "outro_credito" ? "text-green-600" : "text-red-600"}`}>{sinal} {fmtR(val)}</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-slate-50 font-semibold text-xs">
                        <TableCell className="py-1 text-slate-500" colSpan={2}>Total Líquido</TableCell>
                        <TableCell className="py-1 text-right font-mono text-slate-700">{fmtR(result.outrosCreditos - result.beneficiosRecebidos - result.outrosDescontos)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Apuração sintética */}
            <Card className="shadow-sm">
              <CardHeader className="py-2 px-4 border-b"><CardTitle className="text-xs text-slate-600">Apuração Sintética</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    <TableRow className="text-xs">
                      <TableCell className="py-2 text-slate-500">Benefícios devidos (corrigidos)</TableCell>
                      <TableCell className="py-2 text-right font-mono">{fmtR(result.totalVencidasCorrigidas)}</TableCell>
                      <TableCell className="py-2 text-slate-500">Vincendas ({form.parcelasVincendas}×) <span className="block text-[9px] text-indigo-600 font-mono">RMA: {fmtR(result.rmaFinal)}</span></TableCell>
                      <TableCell className="py-2 text-right font-mono">{fmtR(result.totalVincendas)}</TableCell>
                    </TableRow>
                    <TableRow className="text-xs">
                      <TableCell className="py-2 text-green-600 font-medium">Outros créditos (+)</TableCell>
                      <TableCell className="py-2 text-right font-mono text-green-600">{fmtR(result.outrosCreditos)}</TableCell>
                      <TableCell className="py-2 text-red-600 font-medium">Benefícios recebidos (−)</TableCell>
                      <TableCell className="py-2 text-right font-mono text-red-600">{fmtR(result.beneficiosRecebidos)}</TableCell>
                    </TableRow>
                    <TableRow className="text-xs">
                      <TableCell className="py-2 text-orange-600 font-medium">Outros descontos (−)</TableCell>
                      <TableCell className="py-2 text-right font-mono text-orange-600">{fmtR(result.outrosDescontos)}</TableCell>
                      <TableCell className="py-2 text-slate-500">Valor bruto</TableCell>
                      <TableCell className="py-2 text-right font-mono font-semibold">{fmtR(result.valorCausaBruto)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-green-50 text-xs">
                      <TableCell className="py-2 font-bold text-green-700" colSpan={2}>Valor da Causa Final ({form.percentualAcordo}%)</TableCell>
                      <TableCell className="py-2 text-right text-base font-extrabold text-green-700 tabular-nums" colSpan={2}>{fmtR(result.valorCausaFinal)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Parcelas vencidas */}
            <Card className="shadow-sm">
              <CardHeader className="py-2 px-4 border-b flex-row items-center justify-between">
                <CardTitle className="text-xs text-slate-600">Parcelas Vencidas — {result.mesesVencidos} competências</CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  {form.usarSelicPosEC113 && criterioToKey(form.criterioCorrecao) !== "SELIC"
                    ? `${form.criterioCorrecao} (até 11/2021) + SELIC (≥ 12/2021) — EC 113/2021`
                    : form.criterioCorrecao}
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-64">
                  <Table>
                    <TableHeader className="sticky top-0 bg-slate-50">
                      <TableRow>
                        <TableHead className="text-xs py-1.5">Competência</TableHead>
                        <TableHead className="text-xs py-1.5 text-right">Valor Base</TableHead>
                        <TableHead className="text-xs py-1.5">Origem</TableHead>
                        <TableHead className="text-xs py-1.5 text-center">Reaj. Prev.</TableHead>
                        <TableHead className="text-xs py-1.5 text-center">Fator Corr.</TableHead>
                        <TableHead className="text-xs py-1.5 text-right">Corrigido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parcelasExib.map((p, i) => {
                        const hasReaj = p.reajustePrevPct !== "—" && !p.is13o;
                        if (p.is13o) {
                          return (
                            <TableRow key={i} className="text-xs bg-amber-50 border-t border-amber-200">
                              <TableCell className="py-1 font-mono font-bold text-amber-700">
                                {p.competencia}
                                <span className="ml-1.5 text-[9px] bg-amber-200 text-amber-800 rounded px-1 font-semibold">13º</span>
                              </TableCell>
                              <TableCell className="py-1 text-right tabular-nums text-amber-800 font-semibold">{fmtR(p.valorBase)}</TableCell>
                              <TableCell className="py-1 text-[9px] text-amber-600 max-w-[120px] truncate" title={p.detalhes13o}>{p.detalhes13o}</TableCell>
                              <TableCell className="py-1 text-center tabular-nums text-[9px] text-amber-700 font-semibold">{p.reajustePrevPct}</TableCell>
                              <TableCell className="py-1 text-center tabular-nums text-slate-500 text-[10px]">{p.fatorCorrecao.toFixed(6)}</TableCell>
                              <TableCell className="py-1 text-right tabular-nums font-bold text-amber-800">{fmtR(p.valorCorrigido)}</TableCell>
                            </TableRow>
                          );
                        }
                        return (
                          <TableRow key={i} className={`text-xs ${hasReaj ? "bg-violet-50" : ""}`}>
                            <TableCell className="py-1 font-mono">
                              {p.competencia}
                              {hasReaj && <span className="ml-1 text-[9px] text-violet-600 font-bold">↑</span>}
                            </TableCell>
                            <TableCell className="py-1 text-right tabular-nums">{fmtR(p.valorBase)}</TableCell>
                            <TableCell className="py-1 text-[9px] text-slate-400 max-w-[120px] truncate" title={p.origemValorBase}>{p.origemValorBase}</TableCell>
                            <TableCell className={`py-1 text-center tabular-nums text-[9px] ${hasReaj ? "text-violet-600 font-semibold" : "text-slate-400"}`}>{p.reajustePrevPct}</TableCell>
                            <TableCell className="py-1 text-center tabular-nums text-slate-500 text-[10px]">{p.fatorCorrecao.toFixed(6)}</TableCell>
                            <TableCell className="py-1 text-right tabular-nums font-semibold">{fmtR(p.valorCorrigido)}</TableCell>
                          </TableRow>
                        );
                      })}
                      {(result.parcelasVencidas.length > 12) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-2">
                            <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => setShowAllParcelas((v) => !v)}>
                              {showAllParcelas ? <><ChevronUp className="w-3 h-3" />Mostrar menos</> : <><ChevronDown className="w-3 h-3" />Ver todas as {result.parcelasVencidas.length} parcelas</>}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Metodologia */}
            <Card className="shadow-sm border-blue-100">
              <CardHeader className="py-2 px-4 border-b bg-blue-50">
                <CardTitle className="text-xs text-blue-800 flex items-center gap-1.5"><Info className="w-3 h-3" />Metodologia da Base</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <p className="text-[10px] text-slate-600 leading-relaxed">{result.metodologiaBase}</p>
              </CardContent>
            </Card>

            {/* Laudo + Chave */}
            <Card className="shadow-sm">
              <CardContent className="p-3 space-y-2">
                <div className="flex gap-2">
                  <Button
                    className="flex-1 h-8 text-xs bg-[#0f2a4a] hover:bg-[#1e3a5f] text-white gap-1.5"
                    onClick={gerarLaudo} disabled={salvando}
                  >
                    {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                    Gerar Laudo PDF
                  </Button>
                </div>
                {chaveRecuperacao && (
                  <div className="flex items-center gap-2 rounded-md bg-slate-50 border border-slate-200 px-2.5 py-2">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] text-slate-400 uppercase tracking-wide">Chave de recuperação</p>
                      <p className="text-xs font-mono font-bold text-slate-700">{chaveRecuperacao}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
                      onClick={() => { navigator.clipboard.writeText(chaveRecuperacao); toast({ title: "Chave copiada" }); }}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
