import { useState, useEffect, useRef } from "react";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, HardDriveDownload, Cloud, FolderOpen, Upload,
  Trash2, RotateCcw, Download, ShieldCheck, Info, Database,
  CheckCircle2, AlertCircle, Clock,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

interface CloudBackup {
  id: number;
  user_id: number;
  scope: string;
  label: string;
  size_bytes: number;
  restored_at?: string | null;
  created_at: string;
  user_nome?: string;
  user_email?: string;
}

interface BackupPreview {
  version: string;
  scope: string;
  createdAt: string;
  createdBy: { id: number; email: string };
  data: {
    profile?: any;
    previdenciarioSaves?: any[];
    wallet?: any;
    subscription?: any;
    users?: any[];
  };
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Backup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  const [tab, setTab] = useState<"backup" | "restaurar">("backup");

  // Backup form
  const [destination, setDestination] = useState<"cloud" | "local">("cloud");
  const [scope, setScope] = useState<"user" | "full">("user");
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);

  // Cloud backups list
  const [cloudBackups, setCloudBackups] = useState<CloudBackup[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Upload restore
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [fileRaw, setFileRaw] = useState<any>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<Record<string, number> | null>(null);

  // ── Load cloud backups ──────────────────────────────────────────────────
  async function loadCloudBackups() {
    setLoadingList(true);
    try {
      const res = await fetch(`${BASE}/api/backup/list`, { headers: getAuthHeaders() });
      if (res.ok) setCloudBackups(await res.json());
    } catch { /* silent */ }
    setLoadingList(false);
  }

  useEffect(() => { loadCloudBackups(); }, []);

  // ── Create backup ───────────────────────────────────────────────────────
  async function handleCreate() {
    setCreating(true);
    try {
      const body: any = { destination, label };
      if (isAdmin) body.scope = scope;

      const res = await fetch(`${BASE}/api/backup/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });

      if (destination === "local" && res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `veritas-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Backup criado", description: "Arquivo salvo no seu computador." });
      } else if (res.ok) {
        const json = await res.json();
        toast({ title: "Backup salvo na nuvem", description: `"${json.label}" — ${formatBytes(json.sizeBytes)}` });
        await loadCloudBackups();
        setLabel("");
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Erro ao criar backup", description: err.error ?? "Tente novamente.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setCreating(false);
  }

  // ── Download cloud backup ───────────────────────────────────────────────
  async function handleDownloadCloud(id: number, label: string) {
    const res = await fetch(`${BASE}/api/backup/download/${id}`, { headers: getAuthHeaders() });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `veritas-backup-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // ── Restore from cloud ──────────────────────────────────────────────────
  async function handleRestoreCloud(id: number) {
    if (!confirm("Confirmar restauração? Os dados atuais podem ser sobrescritos.")) return;
    setRestoringId(id);
    try {
      const res = await fetch(`${BASE}/api/backup/restore/${id}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        toast({ title: "Restauração concluída", description: `Perfil: ${json.restoredItems?.profile ?? 0} | Saves: ${json.restoredItems?.previdenciarioSaves ?? 0} | Processos: ${json.restoredItems?.cases ?? 0}` });
        await loadCloudBackups();
      } else {
        toast({ title: "Erro na restauração", description: json.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setRestoringId(null);
  }

  // ── Delete cloud backup ─────────────────────────────────────────────────
  async function handleDeleteCloud(id: number) {
    if (!confirm("Excluir este backup da nuvem? Esta ação é irreversível.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${BASE}/api/backup/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        toast({ title: "Backup excluído" });
        setCloudBackups((prev) => prev.filter((b) => b.id !== id));
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Erro", description: err.error, variant: "destructive" });
      }
    } catch { }
    setDeletingId(null);
  }

  // ── File upload preview ─────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        setFileRaw(json);
        setPreview(json as BackupPreview);
        setRestoreResult(null);
      } catch {
        toast({ title: "Arquivo inválido", description: "O arquivo não é um backup Veritas válido.", variant: "destructive" });
        setPreview(null);
        setFileRaw(null);
      }
    };
    reader.readAsText(file);
  }

  // ── Restore from upload ─────────────────────────────────────────────────
  async function handleRestoreUpload() {
    if (!fileRaw) return;
    if (!confirm("Confirmar restauração? Dados do backup serão importados para sua conta.")) return;
    setRestoring(true);
    setRestoreResult(null);
    try {
      const res = await fetch(`${BASE}/api/backup/restore-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(fileRaw),
      });
      const json = await res.json();
      if (res.ok) {
        setRestoreResult(json.restoredItems);
        toast({ title: "Restauração concluída com sucesso!" });
      } else {
        toast({ title: "Erro na restauração", description: json.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setRestoring(false);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <HardDriveDownload className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Backup e Restauração</h1>
          <p className="text-sm text-zinc-400">Salve ou restaure seus dados da plataforma</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-950/40 border border-blue-500/20 rounded-xl text-sm text-blue-300">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-blue-200 mb-0.5">O que é incluído no backup?</p>
          <p className="text-blue-300/80">
            Perfil, cálculos previdenciários salvos, processos de valor-causa e histórico de cálculos.
            Saldo de créditos <strong>não</strong> é restaurado (dado financeiro protegido).
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900/60 p-1 rounded-xl border border-zinc-800 w-fit">
        {(["backup", "restaurar"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? "bg-blue-600 text-white shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t === "backup" ? "Criar Backup" : "Restaurar de Arquivo"}
          </button>
        ))}
      </div>

      {/* ── TAB: Criar Backup ─────────────────────────────────────────── */}
      {tab === "backup" && (
        <div className="space-y-6">
          {/* Create form */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Novo Backup</h2>

            {/* Label */}
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-sm">Descrição (opcional)</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Antes da audiência, Março 2026..."
                className="bg-zinc-800/60 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>

            {/* Destination */}
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Destino do backup</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "cloud", icon: Cloud, title: "Nuvem (banco de dados)", desc: "Armazenado com segurança nos nossos servidores" },
                  { key: "local", icon: FolderOpen, title: "Meu Computador", desc: "Baixado como arquivo .json para seu PC" },
                ].map(({ key, icon: Icon, title, desc }) => (
                  <button
                    key={key}
                    onClick={() => setDestination(key as any)}
                    className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                      destination === key
                        ? "bg-blue-600/20 border-blue-500/60 text-blue-200"
                        : "bg-zinc-800/40 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{title}</p>
                      <p className="text-xs opacity-70 mt-0.5">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Scope (admin only) */}
            {isAdmin && (
              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm">Escopo (admin)</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "user", icon: Database, title: "Meus Dados", desc: "Apenas os seus dados de administrador" },
                    { key: "full", icon: ShieldCheck, title: "Sistema Completo", desc: "Todos os usuários, processos e configurações" },
                  ].map(({ key, icon: Icon, title, desc }) => (
                    <button
                      key={key}
                      onClick={() => setScope(key as any)}
                      className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                        scope === key
                          ? "bg-amber-600/20 border-amber-500/60 text-amber-200"
                          : "bg-zinc-800/40 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{title}</p>
                        <p className="text-xs opacity-70 mt-0.5">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleCreate}
              disabled={creating}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {creating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando backup...</>
              ) : destination === "local" ? (
                <><Download className="w-4 h-4 mr-2" />Baixar Backup (.json)</>
              ) : (
                <><Cloud className="w-4 h-4 mr-2" />Salvar na Nuvem</>
              )}
            </Button>
          </div>

          {/* Cloud backups list */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                Backups na Nuvem{isAdmin ? " (todos)" : ""}
              </h2>
              <button
                onClick={loadCloudBackups}
                className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Atualizar
              </button>
            </div>

            {loadingList ? (
              <div className="flex items-center justify-center py-8 text-zinc-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
              </div>
            ) : cloudBackups.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm">
                Nenhum backup na nuvem ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {cloudBackups.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 p-4 bg-zinc-800/40 border border-zinc-700/50 rounded-xl"
                  >
                    <div className="w-9 h-9 rounded-lg bg-zinc-700/50 flex items-center justify-center flex-shrink-0">
                      {b.scope === "full" ? (
                        <ShieldCheck className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Database className="w-4 h-4 text-blue-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-zinc-200 truncate">{b.label}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          b.scope === "full" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"
                        }`}>
                          {b.scope === "full" ? "SISTEMA" : "USUÁRIO"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(b.created_at)}
                        </span>
                        <span>{formatBytes(b.size_bytes)}</span>
                        {isAdmin && b.user_nome && (
                          <span className="text-zinc-600">por {b.user_nome}</span>
                        )}
                        {b.restored_at && (
                          <span className="flex items-center gap-1 text-green-500/70">
                            <CheckCircle2 className="w-3 h-3" /> Restaurado
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleDownloadCloud(b.id, b.label)}
                        title="Baixar para PC"
                        className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRestoreCloud(b.id)}
                        disabled={restoringId === b.id}
                        title="Restaurar"
                        className="p-1.5 rounded-lg hover:bg-blue-600/20 text-zinc-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                      >
                        {restoringId === b.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteCloud(b.id)}
                        disabled={deletingId === b.id}
                        title="Excluir"
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        {deletingId === b.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Restaurar de Arquivo ──────────────────────────────────── */}
      {tab === "restaurar" && (
        <div className="space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Restaurar de Arquivo (.json)</h2>

            {/* Upload area */}
            <div
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed border-zinc-700 hover:border-blue-500/60 rounded-xl cursor-pointer transition-colors group"
            >
              <Upload className="w-8 h-8 text-zinc-500 group-hover:text-blue-400 transition-colors" />
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-300">Clique para selecionar o arquivo</p>
                <p className="text-xs text-zinc-500 mt-1">Formato: veritas-backup-*.json</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Preview */}
            {preview && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-zinc-800/60 border border-zinc-700 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-zinc-200">Backup detectado</p>
                    <p className="text-zinc-400">
                      <span className="text-zinc-300">Criado em:</span> {formatDate(preview.createdAt)}
                    </p>
                    <p className="text-zinc-400">
                      <span className="text-zinc-300">Por:</span> {preview.createdBy?.nome} ({preview.createdBy?.email})
                    </p>
                    <p className="text-zinc-400">
                      <span className="text-zinc-300">Escopo:</span>{" "}
                      <span className={`${preview.scope === "full" ? "text-amber-400" : "text-blue-400"}`}>
                        {preview.scope === "full" ? "Sistema Completo" : "Dados do Usuário"}
                      </span>
                    </p>
                    <p className="text-zinc-400">
                      <span className="text-zinc-300">Versão do backup:</span> {preview.version}
                    </p>
                  </div>
                </div>

                {/* What will be restored */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Perfil", value: preview.data?.profile ? "1 registro" : "—" },
                    { label: "Cálculos Previdenciários", value: preview.data?.previdenciarioSaves?.length ? `${preview.data.previdenciarioSaves.length} saves` : "—" },
                    { label: "Usuários (admin)", value: preview.data?.users?.length ? `${preview.data.users.length}` : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-zinc-800/40 rounded-lg p-3 text-center">
                      <p className="text-xs text-zinc-500 mb-1">{label}</p>
                      <p className="text-sm font-semibold text-zinc-200">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-start gap-2 p-3 bg-amber-950/30 border border-amber-500/20 rounded-lg text-xs text-amber-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Dados existentes com mesma chave pública serão mantidos (não sobrescritos).
                    Novos registros do backup serão importados.
                  </span>
                </div>

                <Button
                  onClick={handleRestoreUpload}
                  disabled={restoring}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {restoring ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Restaurando...</>
                  ) : (
                    <><RotateCcw className="w-4 h-4 mr-2" />Restaurar Dados</>
                  )}
                </Button>
              </div>
            )}

            {/* Restore result */}
            {restoreResult && (
              <div className="flex items-start gap-3 p-4 bg-green-950/30 border border-green-500/30 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-green-300 mb-2">Restauração concluída!</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(restoreResult).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <span className="text-zinc-400 capitalize">{k.replace(/([A-Z])/g, " $1")}:</span>
                        <span className="text-green-400 font-medium ml-2">{v} restaurado{v !== 1 ? "s" : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
