import { useState, useEffect } from "react";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Lock, Save } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PROFISSOES = [
  "Advogado(a)", "Contador(a)", "Perito(a) Judicial", "Engenheiro(a)",
  "Economista", "Administrador(a)", "Assistente Social", "Médico(a)",
  "Servidor Público", "Outro",
];

export default function Perfil() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<"dados" | "senha">("dados");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    nome: "", email: "", tipoPessoa: "PF", cpfCnpj: "", profissao: "",
    telefone: "", razaoSocial: "", inscricaoEstadual: "", dataNascimento: "",
  });

  const [senhaForm, setSenhaForm] = useState({ senhaAtual: "", novaSenha: "", confirmar: "" });

  useEffect(() => {
    if (!user) return;
    fetch(`${BASE}/api/users/${user.id}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => {
        setForm({
          nome: data.nome || "",
          email: data.email || "",
          tipoPessoa: data.tipoPessoa || "PF",
          cpfCnpj: data.cpfCnpj || "",
          profissao: data.profissao || "",
          telefone: data.telefone || "",
          razaoSocial: data.razaoSocial || "",
          inscricaoEstadual: data.inscricaoEstadual || "",
          dataNascimento: data.dataNascimento || "",
        });
      });
  }, [user]);

  function setField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function saveDados(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/users/${user!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      await refreshUser();
      toast({ title: "Dados atualizados com sucesso!" });
    } catch (err: unknown) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro ao salvar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function saveSenha(e: React.FormEvent) {
    e.preventDefault();
    if (senhaForm.novaSenha !== senhaForm.confirmar) {
      toast({ title: "Erro", description: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/change-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ senhaAtual: senhaForm.senhaAtual, novaSenha: senhaForm.novaSenha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Senha alterada com sucesso!" });
      setSenhaForm({ senhaAtual: "", novaSenha: "", confirmar: "" });
    } catch (err: unknown) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro ao alterar senha", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie seus dados cadastrais e senha de acesso.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {(["dados", "senha"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "dados" ? <><User size={14} className="inline mr-1.5" />Dados Cadastrais</> : <><Lock size={14} className="inline mr-1.5" />Alterar Senha</>}
          </button>
        ))}
      </div>

      {tab === "dados" && (
        <form onSubmit={saveDados} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Nome completo *</Label>
              <Input className="mt-1" value={form.nome} onChange={(e) => setField("nome", e.target.value)} required />
            </div>
            <div>
              <Label>Email *</Label>
              <Input className="mt-1" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} required />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input className="mt-1" placeholder="(11) 99999-9999" value={form.telefone} onChange={(e) => setField("telefone", e.target.value)} />
            </div>
            <div>
              <Label>Tipo de Pessoa</Label>
              <Select value={form.tipoPessoa} onValueChange={(v) => setField("tipoPessoa", v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
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
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {PROFISSOES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
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
          <div className="flex justify-end">
            <Button type="submit" className="bg-blue-700 hover:bg-blue-800 text-white" disabled={loading}>
              {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save size={16} className="mr-2" />}
              Salvar dados
            </Button>
          </div>
        </form>
      )}

      {tab === "senha" && (
        <form onSubmit={saveSenha} className="space-y-4 max-w-sm">
          <div>
            <Label>Senha atual *</Label>
            <Input className="mt-1" type="password" required value={senhaForm.senhaAtual} onChange={(e) => setSenhaForm((s) => ({ ...s, senhaAtual: e.target.value }))} />
          </div>
          <div>
            <Label>Nova senha *</Label>
            <Input className="mt-1" type="password" required minLength={6} value={senhaForm.novaSenha} onChange={(e) => setSenhaForm((s) => ({ ...s, novaSenha: e.target.value }))} />
            <p className="text-xs text-muted-foreground mt-1">Mínimo 6 caracteres</p>
          </div>
          <div>
            <Label>Confirmar nova senha *</Label>
            <Input className="mt-1" type="password" required value={senhaForm.confirmar} onChange={(e) => setSenhaForm((s) => ({ ...s, confirmar: e.target.value }))} />
          </div>
          <Button type="submit" className="bg-blue-700 hover:bg-blue-800 text-white" disabled={loading}>
            {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : <Lock size={16} className="mr-2" />}
            Alterar senha
          </Button>
        </form>
      )}
    </div>
  );
}
