/**
 * admin-tabelas-fiscais.tsx
 * Gerenciamento de Tabelas INSS e IRRF — Área Administrativa
 * Veritas Analytics
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle2, RefreshCw, Plus, Trash2, Save, Info } from "lucide-react";
import { Link, useLocation } from "wouter";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const fmt = (n: number) =>
  n >= 9_000_000 ? "∞" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface InssGrade  { limite: number; aliquota: number; descricao?: string }
interface IrrfGrade  { limite: number; aliquota: number; deducao: number; descricao?: string }
interface TaxTable   { id: number; type: string; vigencia: string; label: string; faixas: any[]; ativo: boolean; notes?: string; updatedAt: string }

// ─── Hook de fetch ────────────────────────────────────────────────────────────

function useTaxHistory() {
  return useQuery<TaxTable[]>({
    queryKey: ["tax-tables-history"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/tax-tables/history`, { headers: getAuthHeaders() });
      const json = await res.json();
      return json.data ?? [];
    },
  });
}

function useActiveTables() {
  return useQuery<TaxTable[]>({
    queryKey: ["tax-tables"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/tax-tables`);
      const json = await res.json();
      return json.data ?? [];
    },
  });
}

// ─── Componente InssEditor ────────────────────────────────────────────────────

function InssEditor({ current }: { current?: TaxTable }) {
  const qc = useQueryClient();
  const [vigencia, setVigencia] = useState(current?.vigencia ?? "2025-01");
  const [label, setLabel] = useState(current?.label ?? "INSS Progressivo 2025");
  const [notes, setNotes] = useState(current?.notes ?? "");
  const [faixas, setFaixas] = useState<InssGrade[]>(
    (current?.faixas as InssGrade[]) ?? [
      { limite: 1518.00, aliquota: 0.075, descricao: "Até R$ 1.518,00" },
      { limite: 2793.88, aliquota: 0.09,  descricao: "De R$ 1.518,01 a R$ 2.793,88" },
      { limite: 4190.83, aliquota: 0.12,  descricao: "De R$ 2.793,89 a R$ 4.190,83" },
      { limite: 8157.41, aliquota: 0.14,  descricao: "De R$ 4.190,84 a R$ 8.157,41" },
    ],
  );
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/tax-tables/inss`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ vigencia, label, notes, faixas }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro desconhecido");
      return json;
    },
    onSuccess: (data) => {
      setSuccess(data.message ?? "Tabela INSS atualizada com sucesso!");
      setError("");
      qc.invalidateQueries({ queryKey: ["tax-tables"] });
      qc.invalidateQueries({ queryKey: ["tax-tables-history"] });
    },
    onError: (e: any) => { setError(e.message); setSuccess(""); },
  });

  function updateFaixa(i: number, field: keyof InssGrade, val: string) {
    setFaixas((prev) => prev.map((f, idx) =>
      idx === i ? { ...f, [field]: field === "descricao" ? val : parseFloat(val) || 0 } : f,
    ));
  }

  function addFaixa() {
    setFaixas((prev) => [...prev, { limite: 0, aliquota: 0, descricao: "" }]);
  }

  function removeFaixa(i: number) {
    setFaixas((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Vigência (AAAA-MM)</Label>
          <Input value={vigencia} onChange={(e) => setVigencia(e.target.value)} placeholder="2025-01" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Rótulo / descrição</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Notas técnicas (opcional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" placeholder="ex: conforme RPS nº 6/2024" />
      </div>

      <Separator />

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground">Faixas INSS (progressivo)</p>
          <Button size="sm" variant="outline" onClick={addFaixa} className="gap-1 text-xs h-7">
            <Plus className="w-3 h-3" /> Adicionar faixa
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-10">#</TableHead>
              <TableHead className="text-xs">Limite (R$)</TableHead>
              <TableHead className="text-xs">Alíquota (%)</TableHead>
              <TableHead className="text-xs">Descrição</TableHead>
              <TableHead className="text-xs w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {faixas.map((f, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                <TableCell>
                  <Input type="number" value={f.limite} onChange={(e) => updateFaixa(i, "limite", e.target.value)}
                    className="h-7 text-xs w-28" />
                </TableCell>
                <TableCell>
                  <Input type="number" step="0.1" value={(f.aliquota * 100).toFixed(1)}
                    onChange={(e) => updateFaixa(i, "aliquota", String(parseFloat(e.target.value) / 100))}
                    className="h-7 text-xs w-20" />
                </TableCell>
                <TableCell>
                  <Input value={f.descricao ?? ""} onChange={(e) => updateFaixa(i, "descricao", e.target.value)}
                    className="h-7 text-xs" />
                </TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600"
                    onClick={() => removeFaixa(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {success && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="gap-2">
        <Save className="w-4 h-4" />
        {mutation.isPending ? "Salvando…" : "Salvar Tabela INSS"}
      </Button>
    </div>
  );
}

// ─── Componente IrrfEditor ────────────────────────────────────────────────────

function IrrfEditor({ current }: { current?: TaxTable }) {
  const qc = useQueryClient();
  const [vigencia, setVigencia] = useState(current?.vigencia ?? "2025-01");
  const [label, setLabel] = useState(current?.label ?? "IRRF 2025");
  const [notes, setNotes] = useState(current?.notes ?? "");
  const [faixas, setFaixas] = useState<IrrfGrade[]>(
    (current?.faixas as IrrfGrade[]) ?? [
      { limite: 2428.80, aliquota: 0,     deducao: 0,      descricao: "Isento" },
      { limite: 2826.65, aliquota: 0.075, deducao: 182.16, descricao: "7,5%" },
      { limite: 3751.05, aliquota: 0.15,  deducao: 394.16, descricao: "15%" },
      { limite: 4664.68, aliquota: 0.225, deducao: 675.49, descricao: "22,5%" },
      { limite: 9999999, aliquota: 0.275, deducao: 908.74, descricao: "27,5%" },
    ],
  );
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/tax-tables/irrf`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ vigencia, label, notes, faixas }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro desconhecido");
      return json;
    },
    onSuccess: (data) => {
      setSuccess(data.message ?? "Tabela IRRF atualizada com sucesso!");
      setError("");
      qc.invalidateQueries({ queryKey: ["tax-tables"] });
      qc.invalidateQueries({ queryKey: ["tax-tables-history"] });
    },
    onError: (e: any) => { setError(e.message); setSuccess(""); },
  });

  function updateFaixa(i: number, field: keyof IrrfGrade, val: string) {
    setFaixas((prev) => prev.map((f, idx) =>
      idx === i ? { ...f, [field]: field === "descricao" ? val : parseFloat(val) || 0 } : f,
    ));
  }

  function addFaixa() {
    setFaixas((prev) => [...prev, { limite: 0, aliquota: 0, deducao: 0, descricao: "" }]);
  }

  function removeFaixa(i: number) {
    setFaixas((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Vigência (AAAA-MM)</Label>
          <Input value={vigencia} onChange={(e) => setVigencia(e.target.value)} placeholder="2025-01" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Rótulo / descrição</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Notas técnicas (opcional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" placeholder="ex: IN RFB 2.178/2024" />
      </div>

      <Separator />

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground">Faixas IRRF (tabela progressiva)</p>
          <Button size="sm" variant="outline" onClick={addFaixa} className="gap-1 text-xs h-7">
            <Plus className="w-3 h-3" /> Adicionar faixa
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-10">#</TableHead>
              <TableHead className="text-xs">Limite (R$) <span className="text-muted-foreground font-normal">ou 9999999 p/ ∞</span></TableHead>
              <TableHead className="text-xs">Alíquota (%)</TableHead>
              <TableHead className="text-xs">Dedução (R$)</TableHead>
              <TableHead className="text-xs">Descrição</TableHead>
              <TableHead className="text-xs w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {faixas.map((f, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                <TableCell>
                  <Input type="number" value={f.limite} onChange={(e) => updateFaixa(i, "limite", e.target.value)}
                    className="h-7 text-xs w-28" />
                </TableCell>
                <TableCell>
                  <Input type="number" step="0.1" value={(f.aliquota * 100).toFixed(1)}
                    onChange={(e) => updateFaixa(i, "aliquota", String(parseFloat(e.target.value) / 100))}
                    className="h-7 text-xs w-20" />
                </TableCell>
                <TableCell>
                  <Input type="number" step="0.01" value={f.deducao}
                    onChange={(e) => updateFaixa(i, "deducao", e.target.value)}
                    className="h-7 text-xs w-24" />
                </TableCell>
                <TableCell>
                  <Input value={f.descricao ?? ""} onChange={(e) => updateFaixa(i, "descricao", e.target.value)}
                    className="h-7 text-xs" />
                </TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600"
                    onClick={() => removeFaixa(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {success && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="gap-2">
        <Save className="w-4 h-4" />
        {mutation.isPending ? "Salvando…" : "Salvar Tabela IRRF"}
      </Button>
    </div>
  );
}

// ─── Aba Visualização das tabelas vigentes ────────────────────────────────────

function TabelasVigentes({ data }: { data: TaxTable[] }) {
  const inss = data.find((t) => t.type === "inss");
  const irrf = data.find((t) => t.type === "irrf");

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* INSS */}
      <Card className="border border-red-200 bg-red-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-red-700">INSS Progressivo</CardTitle>
          <CardDescription className="text-xs">{inss?.label ?? "—"}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Faixa</TableHead>
                <TableHead className="text-xs text-right">Limite</TableHead>
                <TableHead className="text-xs text-right">Alíquota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(inss?.faixas as InssGrade[] ?? []).map((f, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs text-muted-foreground">{f.descricao ?? `Faixa ${i + 1}`}</TableCell>
                  <TableCell className="text-xs text-right font-mono">R$ {fmt(f.limite)}</TableCell>
                  <TableCell className="text-xs text-right font-mono text-red-600">{pct(f.aliquota)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {inss?.notes && (
            <p className="text-xs text-muted-foreground mt-3 flex gap-1 items-start">
              <Info className="w-3 h-3 mt-0.5 shrink-0" /> {inss.notes}
            </p>
          )}
        </CardContent>
      </Card>

      {/* IRRF */}
      <Card className="border border-amber-200 bg-amber-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-amber-700">IRRF Progressivo</CardTitle>
          <CardDescription className="text-xs">{irrf?.label ?? "—"}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Faixa</TableHead>
                <TableHead className="text-xs text-right">Limite</TableHead>
                <TableHead className="text-xs text-right">Alíquota</TableHead>
                <TableHead className="text-xs text-right">Dedução</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(irrf?.faixas as IrrfGrade[] ?? []).map((f, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs text-muted-foreground">{f.descricao ?? `Faixa ${i + 1}`}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{f.limite >= 9_000_000 ? "∞" : `R$ ${fmt(f.limite)}`}</TableCell>
                  <TableCell className="text-xs text-right font-mono text-amber-700">{pct(f.aliquota)}</TableCell>
                  <TableCell className="text-xs text-right font-mono">R$ {fmt(f.deducao)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {irrf?.notes && (
            <p className="text-xs text-muted-foreground mt-3 flex gap-1 items-start">
              <Info className="w-3 h-3 mt-0.5 shrink-0" /> {irrf.notes}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Histórico ────────────────────────────────────────────────────────────────

function Historico({ data }: { data: TaxTable[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Tipo</TableHead>
          <TableHead className="text-xs">Vigência</TableHead>
          <TableHead className="text-xs">Rótulo</TableHead>
          <TableHead className="text-xs">Status</TableHead>
          <TableHead className="text-xs">Atualizado em</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((t) => (
          <TableRow key={t.id}>
            <TableCell>
              <Badge variant="outline" className={`text-xs ${t.type === "inss" ? "border-red-300 text-red-700" : "border-amber-300 text-amber-700"}`}>
                {t.type.toUpperCase()}
              </Badge>
            </TableCell>
            <TableCell className="font-mono text-xs">{t.vigencia}</TableCell>
            <TableCell className="text-xs">{t.label}</TableCell>
            <TableCell>
              <Badge className={`text-xs ${t.ativo ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`} variant="outline">
                {t.ativo ? "Ativo" : "Inativo"}
              </Badge>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {new Date(t.updatedAt).toLocaleDateString("pt-BR")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AdminTabelasFiscais() {
  const { user } = useAuth();
  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-lg font-semibold">Acesso restrito ao administrador.</p>
        <Link href="/dashboard"><Button variant="outline">Voltar ao Dashboard</Button></Link>
      </div>
    );
  }

  const [, navigate] = useLocation();
  const { data: active = [], isLoading: loadingActive, refetch: refetchActive } = useActiveTables();
  const { data: history = [], isLoading: loadingHistory, refetch: refetchHistory } = useTaxHistory();

  const inssActive = active.find((t) => t.type === "inss");
  const irrfActive = active.find((t) => t.type === "irrf");

  function handleRefresh() {
    refetchActive();
    refetchHistory();
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Tabelas Fiscais INSS / IRRF</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie as tabelas de desconto utilizadas no módulo Trabalhista (PJe-Calc). As alterações entram em vigor imediatamente.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1 text-xs">
            <RefreshCw className="w-3 h-3" /> Atualizar
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/dashboard")}>
            ← Dashboard
          </Button>
        </div>
      </div>

      {/* Alerta informativo */}
      <div className="flex gap-2 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
        <div>
          <p className="font-semibold mb-1">Como funciona?</p>
          <ul className="list-disc list-inside space-y-0.5 text-xs text-blue-700">
            <li>O módulo Trabalhista busca as tabelas ativas desta tela a cada cálculo.</li>
            <li>Ao salvar uma nova vigência, a anterior é desativada automaticamente.</li>
            <li>Se a API estiver inacessível, o módulo usa tabelas-padrão 2025 como fallback.</li>
            <li>Use o campo "Vigência" no formato <code className="bg-blue-100 px-1 rounded">AAAA-MM</code> (ex: 2026-01).</li>
          </ul>
        </div>
      </div>

      {/* Tabs principais */}
      <Tabs defaultValue="ver">
        <TabsList>
          <TabsTrigger value="ver">Tabelas Vigentes</TabsTrigger>
          <TabsTrigger value="inss">Editar INSS</TabsTrigger>
          <TabsTrigger value="irrf">Editar IRRF</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="ver" className="mt-5">
          {loadingActive ? (
            <p className="text-sm text-muted-foreground animate-pulse">Carregando tabelas…</p>
          ) : (
            <TabelasVigentes data={active} />
          )}
        </TabsContent>

        <TabsContent value="inss" className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Editar Tabela INSS</CardTitle>
              <CardDescription className="text-xs">
                Preencha as faixas e a vigência e clique em "Salvar". A tabela anterior será desativada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InssEditor current={inssActive} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="irrf" className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Editar Tabela IRRF</CardTitle>
              <CardDescription className="text-xs">
                Preencha as faixas, alíquotas e deduções. O último registro deve ter limite ≥ 9.000.000 (representa ∞).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IrrfEditor current={irrfActive} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de Versões</CardTitle>
              <CardDescription className="text-xs">Todas as versões salvas de INSS e IRRF.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <p className="text-sm text-muted-foreground animate-pulse">Carregando…</p>
              ) : (
                <Historico data={history} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
