import { useState, useEffect, useCallback } from "react";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, UserX, Loader2, Users, Search, Coins, GraduationCap, Trash2, AlertTriangle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PROFISSOES = [
  "Advogado(a)", "Contador(a)", "Perito(a) Judicial", "Engenheiro(a)",
  "Economista", "Administrador(a)", "Assistente Social", "Médico(a)",
  "Servidor Público", "Administrador do Sistema", "Outro",
];

interface UserRow {
  id: number;
  nome: string;
  email: string;
  role: string;
  tipoPessoa: string;
  cpfCnpj?: string;
  profissao?: string;
  telefone?: string;
  razaoSocial?: string;
  inscricaoEstadual?: string;
  dataNascimento?: string;
  ativo: boolean;
  createdAt: string;
}

const emptyForm = {
  nome: "", email: "", senha: "", role: "user", tipoPessoa: "PF",
  cpfCnpj: "", profissao: "", telefone: "", razaoSocial: "",
  inscricaoEstadual: "", dataNascimento: "",
};

export default function AdminUsuarios() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  // Doação de créditos
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantUser, setGrantUser] = useState<UserRow | null>(null);
  const [grantAmount, setGrantAmount] = useState("10");
  const [grantMotivo, setGrantMotivo] = useState("");
  const [grantLoading, setGrantLoading] = useState(false);

  // Plano educacional
  const [eduUserIds, setEduUserIds] = useState<Set<number>>(new Set());
  const [eduLoading, setEduLoading] = useState<number | null>(null);

  // Exclusão permanente
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, eduRes] = await Promise.all([
        fetch(`${BASE}/api/users`, { headers: getAuthHeaders() }),
        fetch(`${BASE}/api/plans/educational/subscribers`, { headers: getAuthHeaders() }),
      ]);
      setUsers(await usersRes.json());
      const eduData = await eduRes.json();
      const ids = new Set<number>((eduData.subscribers ?? []).map((s: { id: number }) => s.id));
      setEduUserIds(ids);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleToggleEdu(u: UserRow) {
    const hasEdu = eduUserIds.has(u.id);
    const action = hasEdu ? "revogar" : "atribuir";
    if (!confirm(`${hasEdu ? "Revogar" : "Atribuir"} plano educacional ${hasEdu ? "de" : "para"} "${u.nome}"?`)) return;
    setEduLoading(u.id);
    try {
      let res: Response;
      if (hasEdu) {
        res = await fetch(`${BASE}/api/plans/educational/revoke/${u.id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
      } else {
        res = await fetch(`${BASE}/api/plans/educational/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ userId: u.id }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: `Plano educacional ${hasEdu ? "revogado" : "atribuído"} com sucesso.` });
      setEduUserIds((prev) => {
        const next = new Set(prev);
        hasEdu ? next.delete(u.id) : next.add(u.id);
        return next;
      });
    } catch (err: unknown) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : `Erro ao ${action} plano`, variant: "destructive" });
    } finally {
      setEduLoading(null);
    }
  }

  function openNew() {
    setEditUser(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  }

  function openEdit(u: UserRow) {
    setEditUser(u);
    setForm({
      nome: u.nome, email: u.email, senha: "", role: u.role,
      tipoPessoa: u.tipoPessoa, cpfCnpj: u.cpfCnpj || "",
      profissao: u.profissao || "", telefone: u.telefone || "",
      razaoSocial: u.razaoSocial || "", inscricaoEstadual: u.inscricaoEstadual || "",
      dataNascimento: u.dataNascimento || "",
    });
    setDialogOpen(true);
  }

  function setField(key: keyof typeof emptyForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editUser) {
        const body: Record<string, unknown> = { ...form };
        delete body.senha;
        const res = await fetch(`${BASE}/api/users/${editUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast({ title: "Usuário atualizado com sucesso!" });
      } else {
        if (!form.senha) { toast({ title: "Erro", description: "Informe uma senha", variant: "destructive" }); setSaving(false); return; }
        const res = await fetch(`${BASE}/api/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast({ title: "Usuário criado com sucesso!" });
      }
      setDialogOpen(false);
      loadUsers();
    } catch (err: unknown) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: number, nome: string) {
    if (!confirm(`Desativar o usuário "${nome}"?`)) return;
    try {
      const res = await fetch(`${BASE}/api/users/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: `Usuário "${nome}" desativado.` });
      loadUsers();
    } catch (err: unknown) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro ao desativar", variant: "destructive" });
    }
  }

  async function handleDeletePermanent() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`${BASE}/api/users/${deleteTarget.id}/permanent`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok && data.code !== "has_references") throw new Error(data.error);
      toast({
        title: data.code === "has_references"
          ? `Usuário desativado (possui registros vinculados)`
          : `Usuário "${deleteTarget.nome}" excluído permanentemente.`,
        variant: data.code === "has_references" ? "default" : "default",
      });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      loadUsers();
    } catch (err: unknown) {
      toast({ title: "Erro ao excluir", description: err instanceof Error ? err.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  }

  function openGrant(u: UserRow) {
    setGrantUser(u);
    setGrantAmount("10");
    setGrantMotivo("");
    setGrantOpen(true);
  }

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!grantUser) return;
    const amount = Number(grantAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Informe uma quantidade válida", variant: "destructive" });
      return;
    }
    setGrantLoading(true);
    try {
      const res = await fetch(`${BASE}/api/wallet/admin/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ userId: grantUser.id, amount, motivo: grantMotivo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: `${amount} crédito(s) doado(s) para ${grantUser.nome}` });
      setGrantOpen(false);
    } catch (err: unknown) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro ao doar créditos", variant: "destructive" });
    } finally {
      setGrantLoading(false);
    }
  }

  const filtered = users.filter((u) =>
    u.nome.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.profissao || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users size={22} /> Gerenciamento de Usuários
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Cadastre e gerencie os usuários do sistema.</p>
        </div>
        <Button onClick={openNew} className="bg-blue-700 hover:bg-blue-800 text-white">
          <Plus size={16} className="mr-2" /> Novo Usuário
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome, email ou profissão..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Nome</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Profissão</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Perfil</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-muted-foreground"><Loader2 className="animate-spin inline mr-2" size={16} />Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum usuário encontrado</td></tr>
            ) : filtered.map((u) => (
              <tr key={u.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">
                  {u.nome}
                  <div className="text-xs text-muted-foreground md:hidden">{u.email}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{u.email}</td>
                <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{u.profissao || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <Badge variant={u.role === "admin" ? "default" : "secondary"} className={u.role === "admin" ? "bg-blue-700 text-white" : ""}>
                      {u.role === "admin" ? "Admin" : "Usuário"}
                    </Badge>
                    {eduUserIds.has(u.id) && (
                      <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] gap-1 w-fit">
                        <GraduationCap size={10} /> Educacional
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={u.ativo ? "outline" : "destructive"} className={u.ativo ? "border-green-500 text-green-700" : ""}>
                    {u.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className={eduUserIds.has(u.id)
                        ? "text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
                        : "text-slate-500 border-slate-200 hover:bg-slate-50"}
                      title={eduUserIds.has(u.id) ? "Revogar plano educacional" : "Atribuir plano educacional"}
                      onClick={() => handleToggleEdu(u)}
                      disabled={eduLoading === u.id}
                    >
                      {eduLoading === u.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <GraduationCap size={13} />}
                    </Button>
                    <Button size="sm" variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50" title="Doar créditos" onClick={() => openGrant(u)}>
                      <Coins size={13} />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                      <Pencil size={13} />
                    </Button>
                    {u.ativo && u.id !== user?.id && (
                      <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" title="Desativar usuário" onClick={() => handleDeactivate(u.id, u.nome)}>
                        <UserX size={13} />
                      </Button>
                    )}
                    {u.id !== user?.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-700 border-red-300 bg-red-50 hover:bg-red-100"
                        title="Excluir usuário permanentemente"
                        onClick={() => { setDeleteTarget(u); setDeleteDialogOpen(true); }}
                      >
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editUser ? `Editar: ${editUser.nome}` : "Novo Usuário"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label>Nome completo *</Label>
                <Input className="mt-1" required value={form.nome} onChange={(e) => setField("nome", e.target.value)} />
              </div>
              <div>
                <Label>Email *</Label>
                <Input className="mt-1" type="email" required value={form.email} onChange={(e) => setField("email", e.target.value)} />
              </div>
              <div>
                <Label>{editUser ? "Nova senha (deixe em branco para manter)" : "Senha *"}</Label>
                <Input className="mt-1" type="password" minLength={editUser ? undefined : 6} required={!editUser} value={form.senha} onChange={(e) => setField("senha", e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <Label>Perfil</Label>
                <Select value={form.role} onValueChange={(v) => setField("role", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Pessoa</Label>
                <Select value={form.tipoPessoa} onValueChange={(v) => setField("tipoPessoa", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PF">Pessoa Física</SelectItem>
                    <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{form.tipoPessoa === "PJ" ? "CNPJ" : "CPF"}</Label>
                <Input className="mt-1" placeholder={form.tipoPessoa === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"} value={form.cpfCnpj} onChange={(e) => setField("cpfCnpj", e.target.value)} />
              </div>
              <div>
                <Label>Profissão</Label>
                <Select value={form.profissao} onValueChange={(v) => setField("profissao", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {PROFISSOES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Telefone</Label>
                <Input className="mt-1" placeholder="(11) 99999-9999" value={form.telefone} onChange={(e) => setField("telefone", e.target.value)} />
              </div>
              {form.tipoPessoa === "PF" && (
                <div>
                  <Label>Data de Nascimento</Label>
                  <Input className="mt-1" type="date" value={form.dataNascimento} onChange={(e) => setField("dataNascimento", e.target.value)} />
                </div>
              )}
              {form.tipoPessoa === "PJ" && (
                <>
                  <div>
                    <Label>Razão Social</Label>
                    <Input className="mt-1" value={form.razaoSocial} onChange={(e) => setField("razaoSocial", e.target.value)} />
                  </div>
                  <div>
                    <Label>Inscrição Estadual</Label>
                    <Input className="mt-1" value={form.inscricaoEstadual} onChange={(e) => setField("inscricaoEstadual", e.target.value)} />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-blue-700 hover:bg-blue-800 text-white" disabled={saving}>
                {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
                {editUser ? "Salvar alterações" : "Criar usuário"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Excluir permanentemente */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle size={18} className="text-red-600" />
              Excluir usuário permanentemente
            </DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-4 mt-1">
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                <div className="font-semibold">{deleteTarget.nome}</div>
                <div className="text-xs text-red-600 mt-0.5">{deleteTarget.email}</div>
              </div>
              <p className="text-sm text-slate-600">
                Esta ação é <strong>irreversível</strong>. O usuário e todos os seus dados
                (cálculos, carteira, etc.) serão permanentemente removidos do sistema.
              </p>
              <p className="text-xs text-slate-500">
                Se o usuário possuir registros críticos vinculados, ele será apenas desativado em vez de excluído.
              </p>
              <div className="flex justify-end gap-3 pt-1">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
                  Cancelar
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleDeletePermanent}
                  disabled={deleteLoading}
                >
                  {deleteLoading
                    ? <Loader2 size={14} className="animate-spin mr-2" />
                    : <Trash2 size={14} className="mr-2" />}
                  Excluir permanentemente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Doar créditos */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins size={18} className="text-amber-500" />
              Doar Créditos
            </DialogTitle>
          </DialogHeader>
          {grantUser && (
            <form onSubmit={handleGrant} className="space-y-4 mt-2">
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                Destinatário: <strong>{grantUser.nome}</strong>
                <div className="text-xs text-amber-600">{grantUser.email}</div>
              </div>
              <div>
                <Label>Quantidade de créditos *</Label>
                <Input
                  className="mt-1"
                  type="number"
                  min="1"
                  max="9999"
                  required
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(e.target.value)}
                  placeholder="Ex: 50"
                />
              </div>
              <div>
                <Label>Motivo (opcional)</Label>
                <Textarea
                  className="mt-1 resize-none"
                  rows={2}
                  value={grantMotivo}
                  onChange={(e) => setGrantMotivo(e.target.value)}
                  placeholder="Ex: Bônus por indicação, compensação, cortesia..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <Button type="button" variant="outline" onClick={() => setGrantOpen(false)}>Cancelar</Button>
                <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white" disabled={grantLoading}>
                  {grantLoading ? <Loader2 className="animate-spin mr-2" size={14} /> : <Coins size={14} className="mr-2" />}
                  Confirmar Doação
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
