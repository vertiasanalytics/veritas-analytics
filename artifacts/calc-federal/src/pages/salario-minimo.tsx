import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/context/auth-context";
import {
  Plus, Pencil, Trash2, Save, RefreshCw, AlertCircle, CheckCircle2,
  Download, ExternalLink, Database,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SalarioMinimoRecord {
  id: string;
  competenciaInicio: string;
  competenciaFim: string;
  valor: number;
  atoNormativo: string;
  observacoes: string;
  ativo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface BcbPreview {
  total: number;
  fonte: string;
  urlFonte: string;
  periodicidade: string;
  records: SalarioMinimoRecord[];
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function sortSeries(arr: SalarioMinimoRecord[]): SalarioMinimoRecord[] {
  return [...arr].sort((a, b) => a.competenciaInicio.localeCompare(b.competenciaInicio));
}

function formatCompetencia(c: string): string {
  if (!c) return "—";
  const [year, month] = c.split("-");
  if (!year || !month) return c;
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const m = parseInt(month, 10) - 1;
  return `${months[m] ?? month}/${year}`;
}

function formatCurrency(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const EMPTY_DRAFT = {
  competenciaInicio: "",
  competenciaFim: "",
  valor: "",
  atoNormativo: "",
  observacoes: "",
  ativo: true,
};

export default function SalarioMinimo() {
  const { toast } = useToast();
  const [records, setRecords] = useState<SalarioMinimoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [draftError, setDraftError] = useState<string | null>(null);

  const [filterText, setFilterText] = useState("");

  const [bcbDialogOpen, setBcbDialogOpen] = useState(false);
  const [bcbLoading, setBcbLoading] = useState(false);
  const [bcbError, setBcbError] = useState<string | null>(null);
  const [bcbPreview, setBcbPreview] = useState<BcbPreview | null>(null);

  const filtered = useMemo(() => {
    const q = filterText.toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.competenciaInicio.includes(q) ||
        r.competenciaFim.includes(q) ||
        r.atoNormativo?.toLowerCase().includes(q) ||
        r.observacoes?.toLowerCase().includes(q)
    );
  }, [records, filterText]);

  async function fetchSeries() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ferramentas/salario-minimo`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data: SalarioMinimoRecord[] = await res.json();
      setRecords(sortSeries(data));
    } catch (e: unknown) {
      setError((e as Error).message ?? "Falha ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  async function persistSeries(next: SalarioMinimoRecord[]) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/api/ferramentas/salario-minimo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Erro ${res.status}`);
      }
      const saved: SalarioMinimoRecord[] = await res.json();
      setRecords(sortSeries(saved));
      setSuccess("Série salva com sucesso.");
      toast({ title: "Salvo!", description: "Série de salário mínimo atualizada." });
    } catch (e: unknown) {
      const msg = (e as Error).message ?? "Falha ao salvar";
      setError(msg);
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    fetchSeries();
  }, []);

  function openNew() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setDraftError(null);
    setModalOpen(true);
  }

  function openEdit(record: SalarioMinimoRecord) {
    setEditingId(record.id);
    setDraft({
      competenciaInicio: record.competenciaInicio,
      competenciaFim: record.competenciaFim,
      valor: String(record.valor),
      atoNormativo: record.atoNormativo ?? "",
      observacoes: record.observacoes ?? "",
      ativo: record.ativo,
    });
    setDraftError(null);
    setModalOpen(true);
  }

  function validateDraft(): boolean {
    if (!draft.competenciaInicio.match(/^\d{4}-\d{2}$/)) {
      setDraftError("Competência início inválida (use AAAA-MM).");
      return false;
    }
    if (!draft.competenciaFim.match(/^\d{4}-\d{2}$/)) {
      setDraftError("Competência fim inválida (use AAAA-MM).");
      return false;
    }
    if (draft.competenciaFim < draft.competenciaInicio) {
      setDraftError("Competência fim deve ser ≥ início.");
      return false;
    }
    const v = parseFloat(draft.valor);
    if (isNaN(v) || v <= 0) {
      setDraftError("Valor inválido.");
      return false;
    }
    setDraftError(null);
    return true;
  }

  function handleSave() {
    if (!validateDraft()) return;
    const valor = parseFloat(draft.valor);
    let next: SalarioMinimoRecord[];
    if (editingId) {
      next = records.map((r) =>
        r.id === editingId
          ? { ...r, ...draft, valor, updatedAt: nowIso() }
          : r
      );
    } else {
      const newRecord: SalarioMinimoRecord = {
        id: generateId(),
        competenciaInicio: draft.competenciaInicio,
        competenciaFim: draft.competenciaFim,
        valor,
        atoNormativo: draft.atoNormativo,
        observacoes: draft.observacoes,
        ativo: draft.ativo,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      next = [...records, newRecord];
    }
    next = sortSeries(next);
    setRecords(next);
    setModalOpen(false);
    persistSeries(next);
  }

  async function handleDelete(id: string) {
    const next = records.filter((r) => r.id !== id);
    setRecords(next);
    await persistSeries(next);
  }

  async function openBcbImport() {
    setBcbDialogOpen(true);
    setBcbPreview(null);
    setBcbError(null);
    setBcbLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ferramentas/salario-minimo/preview-bcb`, {
        headers: getAuthHeaders(),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Erro ${res.status}`);
      setBcbPreview(body as BcbPreview);
    } catch (e: unknown) {
      setBcbError((e as Error).message ?? "Falha ao consultar BCB");
    } finally {
      setBcbLoading(false);
    }
  }

  async function confirmBcbImport() {
    if (!bcbPreview) return;
    setBcbDialogOpen(false);
    await persistSeries(bcbPreview.records);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Série Histórica — Salário Mínimo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie as competências e valores do salário mínimo nacional utilizados nos módulos de cálculo.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={fetchSeries} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={openBcbImport}>
            <Download className="w-4 h-4 mr-2" />
            Importar BCB
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" />
            Nova competência
          </Button>
        </div>
      </div>

      {/* Status messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Table card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Competências cadastradas</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {records.length} registro{records.length !== 1 ? "s" : ""} no total
              </CardDescription>
            </div>
            <Input
              placeholder="Filtrar..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-52 h-8 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm gap-3">
              <Database className="w-8 h-8 opacity-30" />
              <p>Nenhum registro encontrado.</p>
              {records.length === 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={openBcbImport}>
                    <Download className="w-4 h-4 mr-1" /> Importar dados do BCB
                  </Button>
                  <Button variant="outline" size="sm" onClick={openNew}>
                    <Plus className="w-4 h-4 mr-1" /> Cadastro manual
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs pl-4">Início</TableHead>
                  <TableHead className="text-xs">Fim</TableHead>
                  <TableHead className="text-xs text-right">Valor (R$)</TableHead>
                  <TableHead className="text-xs">Ato Normativo</TableHead>
                  <TableHead className="text-xs">Observações</TableHead>
                  <TableHead className="text-xs text-center">Ativo</TableHead>
                  <TableHead className="text-xs text-right pr-4">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm pl-4 font-medium">
                      {formatCompetencia(r.competenciaInicio)}
                    </TableCell>
                    <TableCell className="text-sm">{formatCompetencia(r.competenciaFim)}</TableCell>
                    <TableCell className="text-sm text-right font-mono">
                      {formatCurrency(r.valor)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                      {r.atoNormativo || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                      {r.observacoes || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={r.ativo ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {r.ativo ? "Sim" : "Não"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir competência?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação removerá a competência{" "}
                                <strong>
                                  {formatCompetencia(r.competenciaInicio)} — {formatCompetencia(r.competenciaFim)}
                                </strong>{" "}
                                ({formatCurrency(r.valor)}) permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(r.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {saving && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3 animate-spin" /> Salvando...
        </div>
      )}

      {/* ── Modal: cadastro / edição manual ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar competência" : "Nova competência"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Competência início (AAAA-MM)</Label>
                <Input
                  value={draft.competenciaInicio}
                  onChange={(e) => setDraft((d) => ({ ...d, competenciaInicio: e.target.value }))}
                  placeholder="2025-01"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Competência fim (AAAA-MM)</Label>
                <Input
                  value={draft.competenciaFim}
                  onChange={(e) => setDraft((d) => ({ ...d, competenciaFim: e.target.value }))}
                  placeholder="2025-12"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={draft.valor}
                onChange={(e) => setDraft((d) => ({ ...d, valor: e.target.value }))}
                placeholder="1518.00"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Ato normativo</Label>
              <Input
                value={draft.atoNormativo}
                onChange={(e) => setDraft((d) => ({ ...d, atoNormativo: e.target.value }))}
                placeholder="ex: Lei nº 14.663/2023"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Input
                value={draft.observacoes}
                onChange={(e) => setDraft((d) => ({ ...d, observacoes: e.target.value }))}
                placeholder="Opcional"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="ativo-check"
                checked={draft.ativo}
                onChange={(e) => setDraft((d) => ({ ...d, ativo: e.target.checked }))}
                className="w-4 h-4 rounded border border-border"
              />
              <Label htmlFor="ativo-check" className="text-xs cursor-pointer">
                Registro ativo
              </Label>
            </div>
            {draftError && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5" />
                {draftError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: importação BCB ── */}
      <Dialog open={bcbDialogOpen} onOpenChange={setBcbDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-500" />
              Importar dados oficiais — Banco Central do Brasil
            </DialogTitle>
            <DialogDescription>
              Série histórica completa do salário mínimo nominal via BCB Dados Abertos (SGS 1619).
              Os dados existentes serão substituídos.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {bcbLoading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                <RefreshCw className="w-7 h-7 animate-spin text-blue-500" />
                <p className="text-sm">Consultando Banco Central do Brasil…</p>
              </div>
            )}

            {bcbError && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 text-destructive">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Falha ao consultar BCB</p>
                  <p className="text-xs mt-0.5">{bcbError}</p>
                </div>
              </div>
            )}

            {bcbPreview && (
              <>
                {/* Resumo */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                    <p className="text-2xl font-bold text-foreground">{bcbPreview.total}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Registros</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-center col-span-2">
                    <p className="text-sm font-semibold text-foreground font-mono">
                      {formatCompetencia(bcbPreview.periodicidade.split(" → ")[0])}
                      {" "}→{" "}
                      {formatCompetencia(bcbPreview.periodicidade.split(" → ")[1])}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Período coberto</p>
                  </div>
                </div>

                {/* Fonte */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{bcbPreview.fonte}</span>
                  <a
                    href={bcbPreview.urlFonte}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 underline underline-offset-2 hover:opacity-80 flex-shrink-0"
                  >
                    Ver fonte <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Preview da tabela — primeiros e últimos 5 */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Pré-visualização dos dados
                  </p>
                  <div className="rounded-md border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs pl-3">Início</TableHead>
                          <TableHead className="text-xs">Fim</TableHead>
                          <TableHead className="text-xs text-right pr-3">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...bcbPreview.records.slice(0, 5), ...(bcbPreview.records.length > 10 ? [] : []), ...bcbPreview.records.slice(-5)].reduce<SalarioMinimoRecord[]>((acc, r) => {
                          if (!acc.find(x => x.id === r.id)) acc.push(r);
                          return acc;
                        }, []).map((r, idx, arr) => (
                          <React.Fragment key={r.id}>
                            {idx === 5 && bcbPreview.records.length > 10 && (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-1.5 italic">
                                  … {bcbPreview.records.length - 10} registros intermediários …
                                </TableCell>
                              </TableRow>
                            )}
                            <TableRow>
                              <TableCell className="text-xs pl-3">{formatCompetencia(r.competenciaInicio)}</TableCell>
                              <TableCell className="text-xs">{formatCompetencia(r.competenciaFim)}</TableCell>
                              <TableCell className="text-xs text-right pr-3 font-mono">{formatCurrency(r.valor)}</TableCell>
                            </TableRow>
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Esta ação <strong>substituirá todos os registros existentes</strong> pelos dados do BCB.
                    Edições manuais serão perdidas.
                  </span>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-border flex-shrink-0">
            <Button variant="outline" onClick={() => setBcbDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmBcbImport}
              disabled={!bcbPreview || bcbLoading || saving}
            >
              <Download className="w-4 h-4 mr-2" />
              Importar {bcbPreview ? `${bcbPreview.total} registros` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
