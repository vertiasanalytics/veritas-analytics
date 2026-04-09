import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";

const LS_PROPOSTAS = "vta_propostas_juridicas";
const LS_RECEITAS  = "vta_receitas_juridicas";

function loadLS<T>(key: string, fallback: T[]): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? "[]") as T[]; } catch { return fallback; }
}

type StatusReceita = "pendente" | "aprovada" | "recebida" | "cancelada";

type PropostaJuridica = {
  id: string;
  cliente: string;
  cpfCnpj: string;
  processo: string;
  comarca: string;
  advogado: string;
  areaDireito: string;
  valorTotal: number;
  entradaPercentual: number;
  parcelasSaldo: number;
  dataProposta: string;
  usuarioResponsavel: string;
  status: StatusReceita;
};

type ParcelaFinanceira = {
  id: string;
  numero: number;
  valor: number;
  vencimento: string;
  status: "em_aberto" | "paga";
};

type ReceitaFinanceira = {
  id: string;
  origemId: string;
  tipo: "honorarios_advocaticios";
  cliente: string;
  processo: string;
  comarca: string;
  areaDireito: string;
  valorTotal: number;
  valorEntrada: number;
  saldoRestante: number;
  dataLancamento: string;
  responsavel: string;
  status: StatusReceita;
  parcelas: ParcelaFinanceira[];
};

const HOJE = new Date().toISOString().slice(0, 10);

function mkProposta(overrides: Partial<PropostaJuridica> & { cliente: string; processo: string; valorTotal: number; advogado: string; comarca: string; areaDireito?: string; responsavel: string }): PropostaJuridica {
  return {
    id: crypto.randomUUID(),
    cpfCnpj: "",
    entradaPercentual: 20,
    parcelasSaldo: 3,
    dataProposta: HOJE,
    status: "pendente",
    areaDireito: "Previdenciário",
    usuarioResponsavel: overrides.responsavel,
    ...overrides,
  };
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(v) ? v : 0
  );
}
function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
}
function addMonths(iso: string, m: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + m);
  return d.toISOString().slice(0, 10);
}

function statusColor(s: StatusReceita): string {
  return s === "pendente" ? "#92400e" : s === "aprovada" ? "#1d4ed8" : s === "recebida" ? "#166534" : "#991b1b";
}
function statusBg(s: StatusReceita): string {
  return s === "pendente" ? "#fffbeb" : s === "aprovada" ? "#eff6ff" : s === "recebida" ? "#dcfce7" : "#fee2e2";
}
function statusLabel(s: StatusReceita): string {
  return s === "pendente" ? "Pendente" : s === "aprovada" ? "Aprovada" : s === "recebida" ? "Recebida" : "Cancelada";
}

function gerarReceita(p: PropostaJuridica): ReceitaFinanceira {
  const entrada = p.valorTotal * (p.entradaPercentual / 100);
  const saldo = p.valorTotal - entrada;
  const qtde = Math.max(1, p.parcelasSaldo);
  const valParcela = saldo / qtde;
  const parcelas: ParcelaFinanceira[] = Array.from({ length: qtde }).map((_, i) => ({
    id: crypto.randomUUID(),
    numero: i + 1,
    valor: Number(valParcela.toFixed(2)),
    vencimento: addMonths(HOJE, i + 1),
    status: "em_aberto",
  }));
  return {
    id: crypto.randomUUID(),
    origemId: p.id,
    tipo: "honorarios_advocaticios",
    cliente: p.cliente,
    processo: p.processo,
    comarca: p.comarca,
    areaDireito: p.areaDireito,
    valorTotal: p.valorTotal,
    valorEntrada: Number(entrada.toFixed(2)),
    saldoRestante: Number(saldo.toFixed(2)),
    dataLancamento: HOJE,
    responsavel: p.usuarioResponsavel,
    status: "aprovada",
    parcelas,
  };
}

type NovaPropostaForm = {
  cliente: string; cpfCnpj: string; processo: string; comarca: string;
  advogado: string; areaDireito: string; valorTotal: string;
  entradaPercentual: string; parcelasSaldo: string;
};

const FORM_VAZIO: NovaPropostaForm = {
  cliente: "", cpfCnpj: "", processo: "", comarca: "", advogado: "",
  areaDireito: "Previdenciário", valorTotal: "", entradaPercentual: "20", parcelasSaldo: "3",
};

export default function LancamentoControladora() {
  const { user } = useAuth();
  const nomeResponsavel = user?.nome ?? "Usuário";

  const [propostas, setPropostas] = useState<PropostaJuridica[]>(() => loadLS<PropostaJuridica>(LS_PROPOSTAS, []));
  const [receitas, setReceitas] = useState<ReceitaFinanceira[]>(() => loadLS<ReceitaFinanceira>(LS_RECEITAS, []));
  const [selectedId, setSelectedId] = useState<string>(() => {
    const p = loadLS<PropostaJuridica>(LS_PROPOSTAS, []);
    return p[0]?.id ?? "";
  });

  useEffect(() => {
    localStorage.setItem(LS_PROPOSTAS, JSON.stringify(propostas));
    if (!selectedId && propostas.length > 0) setSelectedId(propostas[0].id);
  }, [propostas]);

  useEffect(() => {
    localStorage.setItem(LS_RECEITAS, JSON.stringify(receitas));
  }, [receitas]);

  const [mensagem, setMensagem] = useState<{ texto: string; tipo: "ok" | "erro" } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [novaForm, setNovaForm] = useState<NovaPropostaForm>(FORM_VAZIO);

  const selecionada = useMemo(() => propostas.find(p => p.id === selectedId) ?? null, [propostas, selectedId]);

  const totais = useMemo(() => {
    const receitaPrevista = receitas.reduce((a, r) => a + r.valorTotal, 0);
    const entradaPrevista = receitas.reduce((a, r) => a + r.valorEntrada, 0);
    const saldoAberto = receitas.reduce((a, r) => {
      const pago = r.parcelas.filter(p => p.status === "paga").reduce((s, p) => s + p.valor, 0);
      return a + r.saldoRestante - pago;
    }, 0);
    return { receitaPrevista, entradaPrevista, saldoAberto, qtd: receitas.length };
  }, [receitas]);

  function mostrarMsg(texto: string, tipo: "ok" | "erro" = "ok") {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem(null), 4000);
  }

  function aprovarELancar() {
    if (!selecionada) return;
    if (receitas.some(r => r.origemId === selecionada.id)) {
      mostrarMsg("Esta proposta já foi lançada na Controladora Financeira.", "erro");
      return;
    }
    const receita = gerarReceita(selecionada);
    setReceitas(prev => [receita, ...prev]);
    setPropostas(prev => prev.map(p => p.id === selecionada.id ? { ...p, status: "aprovada" } : p));
    mostrarMsg("Proposta aprovada e lançada com sucesso na Controladora Financeira.");
  }

  function cancelarProposta(id: string) {
    setPropostas(prev => prev.map(p => p.id === id ? { ...p, status: "cancelada" } : p));
    mostrarMsg("Proposta cancelada.");
  }

  function marcarParcela(receitaId: string, parcelaId: string) {
    setReceitas(prev =>
      prev.map(r => {
        if (r.id !== receitaId) return r;
        const ps = r.parcelas.map(p => p.id === parcelaId ? { ...p, status: "paga" as const } : p);
        return { ...r, parcelas: ps, status: ps.every(p => p.status === "paga") ? "recebida" : r.status };
      })
    );
  }

  function adicionarProposta() {
    const valorTotal = Number(novaForm.valorTotal);
    if (!novaForm.cliente || !valorTotal) {
      mostrarMsg("Preencha pelo menos o cliente e o valor total.", "erro");
      return;
    }
    const nova = mkProposta({
      cliente: novaForm.cliente, cpfCnpj: novaForm.cpfCnpj, processo: novaForm.processo,
      comarca: novaForm.comarca, advogado: novaForm.advogado, areaDireito: novaForm.areaDireito,
      valorTotal, entradaPercentual: Number(novaForm.entradaPercentual) || 20,
      parcelasSaldo: Number(novaForm.parcelasSaldo) || 3, responsavel: nomeResponsavel,
    });
    setPropostas(prev => [nova, ...prev]);
    setSelectedId(nova.id);
    setNovaForm(FORM_VAZIO);
    setShowForm(false);
    mostrarMsg("Proposta cadastrada com sucesso.");
  }

  const entradaPrevia = selecionada ? selecionada.valorTotal * (selecionada.entradaPercentual / 100) : 0;
  const saldoPrevia = selecionada ? selecionada.valorTotal - entradaPrevia : 0;
  const parcelaPrevia = selecionada && selecionada.parcelasSaldo > 0 ? saldoPrevia / selecionada.parcelasSaldo : saldoPrevia;

  return (
    <div style={S.page}>
      <div style={S.wrapper}>
        {/* Header */}
        <div style={S.headerRow}>
          <div>
            <h1 style={S.title}>Integralização com a Controladora Financeira</h1>
            <p style={S.subtitle}>Aprovação de propostas jurídicas com geração automática de receita e parcelas a receber.</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={S.secondaryBtn} onClick={() => setShowForm(s => !s)}>
              {showForm ? "Cancelar" : "+ Nova Proposta"}
            </button>
            <button style={S.primaryBtn} onClick={aprovarELancar} disabled={!selecionada || selecionada.status !== "pendente"}>
              Aprovar e Lançar no Financeiro
            </button>
          </div>
        </div>

        {/* Mensagem */}
        {mensagem && (
          <div style={{ ...S.infoBox, background: mensagem.tipo === "erro" ? "#fee2e2" : "#ecfeff", color: mensagem.tipo === "erro" ? "#991b1b" : "#155e75", borderColor: mensagem.tipo === "erro" ? "#fca5a5" : "#a5f3fc" }}>
            {mensagem.texto}
          </div>
        )}

        {/* Formulário nova proposta */}
        {showForm && (
          <section style={S.panel}>
            <div style={S.sectionTitle}>Nova Proposta</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
              <F label="Cliente *"><input style={S.input} value={novaForm.cliente} onChange={e => setNovaForm(p => ({ ...p, cliente: e.target.value }))} placeholder="Nome" /></F>
              <F label="CPF/CNPJ"><input style={S.input} value={novaForm.cpfCnpj} onChange={e => setNovaForm(p => ({ ...p, cpfCnpj: e.target.value }))} placeholder="000.000.000-00" /></F>
              <F label="Área do Direito"><input style={S.input} value={novaForm.areaDireito} onChange={e => setNovaForm(p => ({ ...p, areaDireito: e.target.value }))} /></F>
              <F label="Processo"><input style={S.input} value={novaForm.processo} onChange={e => setNovaForm(p => ({ ...p, processo: e.target.value }))} /></F>
              <F label="Comarca"><input style={S.input} value={novaForm.comarca} onChange={e => setNovaForm(p => ({ ...p, comarca: e.target.value }))} /></F>
              <F label="Advogado Responsável"><input style={S.input} value={novaForm.advogado} onChange={e => setNovaForm(p => ({ ...p, advogado: e.target.value }))} /></F>
              <F label="Valor Total (R$) *"><input style={S.input} type="number" min={0} step="0.01" value={novaForm.valorTotal} onChange={e => setNovaForm(p => ({ ...p, valorTotal: e.target.value }))} /></F>
              <F label="% Entrada"><input style={S.input} type="number" min={0} max={100} step="1" value={novaForm.entradaPercentual} onChange={e => setNovaForm(p => ({ ...p, entradaPercentual: e.target.value }))} /></F>
              <F label="Parcelas do saldo"><input style={S.input} type="number" min={1} step="1" value={novaForm.parcelasSaldo} onChange={e => setNovaForm(p => ({ ...p, parcelasSaldo: e.target.value }))} /></F>
            </div>
            <button style={S.primaryBtn} onClick={adicionarProposta}>Cadastrar Proposta</button>
          </section>
        )}

        {/* KPIs */}
        <div style={S.kpiGrid}>
          {[
            { label: "Receita prevista",     value: fmtCurrency(totais.receitaPrevista) },
            { label: "Entradas previstas",   value: fmtCurrency(totais.entradaPrevista) },
            { label: "Saldo em aberto",      value: fmtCurrency(totais.saldoAberto)     },
            { label: "Receitas lançadas",    value: String(totais.qtd)                  },
          ].map(k => (
            <div key={k.label} style={S.kpiCard}>
              <div style={S.kpiLabel}>{k.label}</div>
              <div style={S.kpiValue}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Lista de propostas + detalhes */}
        <div style={S.mainGrid}>
          <section style={S.panel}>
            <div style={S.sectionTitle}>Propostas Jurídicas ({propostas.length})</div>
            {propostas.map(p => (
              <button
                key={p.id} type="button"
                onClick={() => setSelectedId(p.id)}
                style={{ ...S.propostaCard, borderColor: p.id === selectedId ? "#2563eb" : "#dbe3ee", background: p.id === selectedId ? "#eff6ff" : "#fff" }}
              >
                <div style={S.rowBetween}>
                  <div style={S.cardTitle}>{p.cliente}</div>
                  <span style={{ ...S.statusBadge, color: statusColor(p.status), background: statusBg(p.status) }}>
                    {statusLabel(p.status)}
                  </span>
                </div>
                <div style={S.cardMeta}>{p.areaDireito} · {p.processo || "sem processo"}</div>
                <div style={S.cardMeta}>Comarca: {p.comarca || "—"}</div>
                <div style={S.cardMeta}>Advogado: {p.advogado || "—"}</div>
                <div style={S.cardValue}>{fmtCurrency(p.valorTotal)}</div>
              </button>
            ))}
          </section>

          <section style={S.panel}>
            <div style={S.sectionTitle}>Detalhe da Proposta Selecionada</div>
            {selecionada ? (
              <>
                <div style={S.detailGrid}>
                  <div><strong>Cliente:</strong> {selecionada.cliente}</div>
                  <div><strong>CPF/CNPJ:</strong> {selecionada.cpfCnpj || "—"}</div>
                  <div><strong>Processo:</strong> {selecionada.processo || "—"}</div>
                  <div><strong>Comarca:</strong> {selecionada.comarca || "—"}</div>
                  <div><strong>Advogado:</strong> {selecionada.advogado || "—"}</div>
                  <div><strong>Área:</strong> {selecionada.areaDireito}</div>
                  <div><strong>Data da proposta:</strong> {fmtDate(selecionada.dataProposta)}</div>
                  <div><strong>Valor total:</strong> {fmtCurrency(selecionada.valorTotal)}</div>
                  <div><strong>Entrada:</strong> {selecionada.entradaPercentual}%</div>
                  <div><strong>Parcelas do saldo:</strong> {selecionada.parcelasSaldo}</div>
                </div>
                <div style={S.previewBox}>
                  <div style={S.previewTitle}>Prévia do lançamento financeiro</div>
                  <div>Entrada prevista: {fmtCurrency(entradaPrevia)}</div>
                  <div>Saldo restante: {fmtCurrency(saldoPrevia)}</div>
                  <div>Valor estimado por parcela: {fmtCurrency(parcelaPrevia)}</div>
                </div>
                {selecionada.status === "pendente" && (
                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <button style={S.primaryBtn} onClick={aprovarELancar}>Aprovar e Lançar</button>
                    <button style={{ ...S.secondaryBtn, color: "#991b1b", borderColor: "#fca5a5" }} onClick={() => cancelarProposta(selecionada.id)}>Cancelar proposta</button>
                  </div>
                )}
                {selecionada.status === "aprovada" && (
                  <div style={{ marginTop: 12, color: "#1d4ed8", fontWeight: 700, fontSize: 14 }}>
                    ✓ Proposta já aprovada e lançada na Controladora.
                  </div>
                )}
              </>
            ) : (
              <div style={S.emptyState}>Nenhuma proposta selecionada.</div>
            )}
          </section>
        </div>

        {/* Receitas lançadas */}
        <section style={S.panel}>
          <div style={S.sectionTitle}>Receitas Lançadas na Controladora</div>
          {receitas.length === 0 ? (
            <div style={S.emptyState}>Nenhuma receita lançada até o momento. Aprove uma proposta para iniciar o controle financeiro.</div>
          ) : (
            receitas.map(r => (
              <div key={r.id} style={S.receitaCard}>
                <div style={S.rowBetween}>
                  <div>
                    <div style={S.cardTitle}>{r.cliente}</div>
                    <div style={S.cardMeta}>Honorários Advocatícios · {r.areaDireito}</div>
                    <div style={S.cardMeta}>Processo: {r.processo || "—"}</div>
                  </div>
                  <span style={{ ...S.statusBadge, color: statusColor(r.status), background: statusBg(r.status) }}>
                    {statusLabel(r.status)}
                  </span>
                </div>
                <div style={S.detailGrid}>
                  <div><strong>Data lançamento:</strong> {fmtDate(r.dataLancamento)}</div>
                  <div><strong>Responsável:</strong> {r.responsavel}</div>
                  <div><strong>Valor total:</strong> {fmtCurrency(r.valorTotal)}</div>
                  <div><strong>Entrada:</strong> {fmtCurrency(r.valorEntrada)}</div>
                  <div><strong>Saldo:</strong> {fmtCurrency(r.saldoRestante)}</div>
                </div>

                <div style={S.subTableTitle}>Parcelas a Receber</div>
                <div style={S.tableHeader}>
                  <div style={{ width: 80 }}>Parcela</div>
                  <div style={{ width: 150 }}>Vencimento</div>
                  <div style={{ width: 170, textAlign: "right" }}>Valor</div>
                  <div style={{ width: 130 }}>Status</div>
                  <div style={{ flex: 1 }}>Ação</div>
                </div>
                {r.parcelas.map(parc => (
                  <div key={parc.id} style={S.tableRow}>
                    <div style={{ width: 80 }}>{parc.numero}ª parcela</div>
                    <div style={{ width: 150 }}>{fmtDate(parc.vencimento)}</div>
                    <div style={{ width: 170, textAlign: "right" }}>{fmtCurrency(parc.valor)}</div>
                    <div style={{ width: 130, color: parc.status === "paga" ? "#166534" : "#92400e", fontWeight: 700, fontSize: 13 }}>
                      {parc.status === "paga" ? "Liquidada" : "Em aberto"}
                    </div>
                    <div style={{ flex: 1 }}>
                      {parc.status === "em_aberto" ? (
                        <button style={S.secondaryBtn} onClick={() => marcarParcela(r.id, parc.id)}>
                          Marcar como paga
                        </button>
                      ) : (
                        <span style={{ color: "#166534", fontWeight: 700, fontSize: 13 }}>✓ Paga</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 13, color: "#334155", fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:         { background: "#f8fafc", minHeight: "100vh", padding: 24, fontFamily: '"Segoe UI", Arial, sans-serif', color: "#0f172a" },
  wrapper:      { maxWidth: 1550, margin: "0 auto" },
  headerRow:    { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18, flexWrap: "wrap" },
  title:        { margin: 0, fontSize: 34, color: "#17365d", fontWeight: 800 },
  subtitle:     { marginTop: 8, marginBottom: 0, color: "#475569", fontSize: 14 },
  primaryBtn:   { background: "#16a34a", color: "#fff", border: "1px solid #16a34a", borderRadius: 10, padding: "11px 16px", fontWeight: 700, cursor: "pointer" },
  secondaryBtn: { background: "#fff", color: "#17365d", border: "1px solid #cbd5e1", borderRadius: 10, padding: "8px 12px", fontWeight: 700, cursor: "pointer" },
  infoBox:      { borderRadius: 12, padding: "12px 14px", marginBottom: 18, fontWeight: 600, border: "1px solid" },
  kpiGrid:      { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 18 },
  kpiCard:      { background: "#fff", border: "1px solid #dbe3ee", borderRadius: 14, padding: 18, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" },
  kpiLabel:     { color: "#475569", fontSize: 13, fontWeight: 700 },
  kpiValue:     { marginTop: 8, fontSize: 28, fontWeight: 800, color: "#17365d" },
  mainGrid:     { display: "grid", gridTemplateColumns: "380px minmax(0,1fr)", gap: 18, marginBottom: 18 },
  panel:        { background: "#fff", border: "1px solid #dbe3ee", borderRadius: 14, padding: 18, boxShadow: "0 1px 2px rgba(15,23,42,0.04)", marginBottom: 18 },
  sectionTitle: { fontSize: 18, color: "#17365d", fontWeight: 800, marginBottom: 14 },
  propostaCard: { width: "100%", textAlign: "left", border: "1px solid", borderRadius: 14, padding: 14, marginBottom: 12, cursor: "pointer", background: "#fff" },
  receitaCard:  { border: "1px solid #dbe3ee", borderRadius: 14, padding: 16, marginBottom: 14, background: "#fff" },
  rowBetween:   { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" },
  cardTitle:    { fontSize: 16, fontWeight: 800, color: "#0f172a" },
  cardMeta:     { fontSize: 13, color: "#475569", marginTop: 3 },
  cardValue:    { marginTop: 10, fontSize: 22, fontWeight: 800, color: "#17365d" },
  statusBadge:  { borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 800 },
  detailGrid:   { display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10, fontSize: 14, lineHeight: 1.6, marginTop: 10 },
  previewBox:   { marginTop: 16, border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 12, padding: 14, color: "#1e3a8a", lineHeight: 1.8 },
  previewTitle: { fontWeight: 800, marginBottom: 6 },
  emptyState:   { color: "#64748b", fontSize: 14, padding: "18px 0" },
  subTableTitle:{ marginTop: 16, marginBottom: 8, fontWeight: 800, color: "#17365d" },
  tableHeader:  { display: "flex", gap: 10, padding: "10px 8px", borderBottom: "2px solid #dbe3ee", fontWeight: 800, color: "#17365d", fontSize: 14 },
  tableRow:     { display: "flex", gap: 10, alignItems: "center", padding: "10px 8px", borderBottom: "1px solid #e5e7eb", fontSize: 14 },
  input:        { width: "100%", border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 12px", fontSize: 14, outline: "none", background: "#fff", boxSizing: "border-box" },
};
