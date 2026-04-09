import { useMemo, useState } from "react";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useLocation } from "wouter";
import veritasLogoUrl from "@assets/veritas_analytics_1775154424712.png";
import { buildVeritasReport, openVeritasReport } from "@/components/reports/VeritasReportLayout";

export const LS_KEY = "vta_propostas_juridicas";
const API_BASE = "/api/controladoria";

async function postReceivable(body: {
  cliente: string; processo: string; contrato: string;
  vencimento: string; valor: number; status: string;
}): Promise<void> {
  await fetch(`${API_BASE}/receivables`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
}

type ModeloCobranca =
  | "fixo"
  | "por_ato"
  | "por_fase"
  | "exito"
  | "hibrido"
  | "mensal";

type ItemHonorario = {
  id: number;
  categoria: "ato" | "fase" | "despesa";
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
};

type LoggedUser = {
  nomeAssinatura: string;
  tituloProfissional: string;
  registroProfissional: string;
};

type FormData = {
  cliente: string;
  cpfCnpj: string;
  areaDireito: string;
  tipoDemanda: string;
  processo: string;
  comarca: string;
  advogadoResponsavel: string;
  valorCausa: number;
  proveitoEconomicoEstimado: number;
  modeloCobranca: ModeloCobranca;
  honorarioFixo: number;
  percentualExito: number;
  entradaPercentual: number;
  parcelasSaldo: number;
  despesasAdicionais: number;
  valorReferenciaOAB: number;
  validadeDias: number;
  observacoes: string;
};

const DEFAULT_ITEMS: ItemHonorario[] = [
  { id: 1, categoria: "ato",     descricao: "Petição inicial / requerimento principal",          quantidade: 1, valorUnitario: 0, total: 0 },
  { id: 2, categoria: "ato",     descricao: "Audiência / sustentação / atendimento técnico",     quantidade: 0, valorUnitario: 0, total: 0 },
  { id: 3, categoria: "ato",     descricao: "Recurso / contrarrazões / manifestação recursal",   quantidade: 0, valorUnitario: 0, total: 0 },
  { id: 4, categoria: "fase",    descricao: "Cumprimento de sentença / execução",                quantidade: 0, valorUnitario: 0, total: 0 },
  { id: 5, categoria: "despesa", descricao: "Despesas reembolsáveis (diligências, deslocamentos etc.)", quantidade: 1, valorUnitario: 0, total: 0 },
];

const DEFAULT_FORM: FormData = {
  cliente: "",
  cpfCnpj: "",
  areaDireito: "Previdenciário",
  tipoDemanda: "",
  processo: "",
  comarca: "",
  advogadoResponsavel: "",
  valorCausa: 0,
  proveitoEconomicoEstimado: 0,
  modeloCobranca: "hibrido",
  honorarioFixo: 0,
  percentualExito: 20,
  entradaPercentual: 0,
  parcelasSaldo: 1,
  despesasAdicionais: 0,
  valorReferenciaOAB: 0,
  validadeDias: 15,
  observacoes: "",
};

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(v) ? v : 0
  );
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}
function clamp(v: number, min = 0): number {
  if (!Number.isFinite(v) || Number.isNaN(v)) return min;
  return Math.max(min, v);
}
function esc(t: string): string {
  return t
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function modeloLabel(m: ModeloCobranca): string {
  const map: Record<ModeloCobranca, string> = {
    fixo: "Honorário Fixo", por_ato: "Honorário por Ato", por_fase: "Honorário por Fase",
    exito: "Honorário de Êxito", hibrido: "Honorário Híbrido", mensal: "Honorário Mensal",
  };
  return map[m];
}
function addMonths(iso: string, m: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + m);
  return d.toISOString().slice(0, 10);
}

function genChave(): string {
  const ADJETIVOS = ["FEDERAL","JUDICIAL","LEGAL","OFICIAL","FORMAL","CERTO","FIRME","CLARO","JUSTO","BREVE","FORTE","PURO","NOBRE","LEAL","REAL"];
  const SUBSTANTIVOS = ["CALCULO","PROCESSO","ACAO","VALOR","CREDITO","DEBITO","PARCELA","INDICE","FATOR","SALDO","CONTA","BALANCO","ORDEM","TITULO","LAUDO"];
  const adj  = ADJETIVOS[Math.floor(Math.random() * ADJETIVOS.length)];
  const noun = SUBSTANTIVOS[Math.floor(Math.random() * SUBSTANTIVOS.length)];
  const hex  = () => Math.floor(Math.random() * 65536).toString(16).toUpperCase().padStart(4, "0");
  return `${adj}-${noun}-${hex()}-${hex()}`;
}

function buildHtml(p: {
  form: FormData; items: ItemHonorario[]; user: LoggedUser;
  subtotalItens: number; valorExitoEstimado: number; totalProjetado: number;
  valorEntrada: number; saldoRestante: number; valorParcela: number; alertaOAB: boolean;
}): string {
  const today = new Date();
  const chave = genChave();
  const emitidoEm = today.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
  const logoSrc = window.location.origin + veritasLogoUrl;

  const rows = p.items
    .filter((i) => i.quantidade > 0 || i.total > 0 || i.valorUnitario > 0)
    .map((i) => `
      <tr>
        <td>${i.id}</td>
        <td>${esc(i.categoria.toUpperCase())}</td>
        <td>${esc(i.descricao)}</td>
        <td style="text-align:right;">${i.quantidade.toLocaleString("pt-BR")}</td>
        <td style="text-align:right;">${fmtCurrency(i.valorUnitario)}</td>
        <td style="text-align:right;">${fmtCurrency(i.total)}</td>
      </tr>`)
    .join("");

    const credencial = [esc(p.user.tituloProfissional||""), p.user.registroProfissional ? `— ${esc(p.user.registroProfissional)}` : ""].filter(Boolean).join(" ");

  const body = `
    <div class="vr-page-header">
      <div class="vr-brand-block">
        <div class="vr-logo-box"><img src="${logoSrc}" alt="Veritas Analytics" onerror="this.style.display='none'" /></div>
        <div>
          <div class="vr-brand-name">VERITAS ANALYTICS</div>
          <div class="vr-brand-sub">Plataforma de Cálculos Jurídicos e Periciais</div>
        </div>
      </div>
      <div class="vr-emit-info">
        <div><strong>Emitido em:</strong> ${emitidoEm}</div>
        <div><strong>Advogado:</strong> ${esc(p.user.nomeAssinatura||"—")}</div>
        ${credencial ? `<div>${credencial}</div>` : ""}
      </div>
    </div>

    <div class="vr-title-bar">
      <div class="vr-title-bar-title">Proposição de Honorários Advocatícios</div>
      <div class="vr-title-bar-chave">Chave: ${chave}</div>
    </div>

    <div class="vr-body">
      <div class="vr-notes">
        <div><strong>Cliente:</strong> ${esc(p.form.cliente||"Não informado")}${p.form.cpfCnpj ? ` (${esc(p.form.cpfCnpj)})` : ""}</div>
        <div><strong>Área do Direito:</strong> ${esc(p.form.areaDireito||"Não informada")}</div>
        <div><strong>Tipo de Demanda:</strong> ${esc(p.form.tipoDemanda||"Não informado")}</div>
        <div><strong>Processo:</strong> ${esc(p.form.processo||"Não informado")}</div>
        <div><strong>Comarca:</strong> ${esc(p.form.comarca||"Não informada")}</div>
        <div><strong>Advogado Responsável:</strong> ${esc(p.form.advogadoResponsavel||"Não informado")}</div>
      </div>
      <div class="vr-paragraph">Para a presente proposta de honorários advocatícios, foram considerados o escopo do serviço, a complexidade jurídica da demanda, os atos processuais previstos, a base econômica estimada da causa, o tempo técnico necessário, bem como as despesas operacionais relacionadas à execução do trabalho profissional, em conformidade com o Código de Ética e Disciplina da OAB e o Estatuto da Advocacia.</div>

      <div class="vr-section-title">QUADRO DE COMPOSIÇÃO DOS HONORÁRIOS</div>
      <table>
        <thead>
          <tr>
            <th style="width:50px">ITEM</th>
            <th style="width:120px">CATEGORIA</th>
            <th>DESCRIÇÃO</th>
            <th class="right" style="width:110px">QTDE.</th>
            <th class="right" style="width:140px">VALOR UNIT.</th>
            <th class="right" style="width:150px">VALOR TOTAL</th>
          </tr>
        </thead>
        <tbody>${rows||`<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px;">Nenhum item informado.</td></tr>`}</tbody>
      </table>

      <div class="vr-summary">
        <div class="vr-summary-row"><span>MODELO DE COBRANÇA</span><span>${esc(modeloLabel(p.form.modeloCobranca))}</span></div>
        <div class="vr-summary-row"><span>HONORÁRIO FIXO</span><span>${fmtCurrency(p.form.honorarioFixo)}</span></div>
        <div class="vr-summary-row"><span>ITENS / ATOS / FASES / DESPESAS</span><span>${fmtCurrency(p.subtotalItens+p.form.despesasAdicionais)}</span></div>
        <div class="vr-summary-row"><span>ÊXITO ESTIMADO (${p.form.percentualExito.toLocaleString("pt-BR")}%)</span><span>${fmtCurrency(p.valorExitoEstimado)}</span></div>
        <div class="vr-summary-row"><span>TOTAL PROJETADO</span><span>${fmtCurrency(p.totalProjetado)}</span></div>
      </div>

      <div class="vr-notes" style="margin-top:12px;">
        <div><strong>Valor da causa:</strong> ${fmtCurrency(p.form.valorCausa)}</div>
        <div><strong>Proveito econômico estimado:</strong> ${fmtCurrency(p.form.proveitoEconomicoEstimado)}</div>
        <div><strong>Condição de pagamento:</strong> entrada de ${p.form.entradaPercentual.toLocaleString("pt-BR")}% (${fmtCurrency(p.valorEntrada)}) e saldo de ${fmtCurrency(p.saldoRestante)} em ${p.form.parcelasSaldo} parcela(s) de ${fmtCurrency(p.valorParcela)}.</div>
        <div><strong>Validade da proposta:</strong> ${p.form.validadeDias} dias</div>
        <div><strong>Data da proposta:</strong> ${fmtDate(today)}</div>
        ${p.form.observacoes?`<div><strong>Observações:</strong> ${esc(p.form.observacoes)}</div>`:""}
      </div>

      ${p.alertaOAB?`<div class="vr-warning-box">⚠ <strong>Atenção:</strong> o valor projetado encontra-se abaixo da referência OAB informada para esta proposta.</div>`:""}

      <div class="vr-signature">
        <div class="vr-signature-line"></div>
        <div class="vr-signature-name">${esc(p.user.nomeAssinatura)}</div>
        <div class="vr-signature-role">${esc(p.user.tituloProfissional)} ${esc(p.user.registroProfissional)}</div>
        <div class="vr-footer-chave">Chave de recuperação: <strong>${chave}</strong> — Veritas Analytics · ${emitidoEm}</div>
      </div>

      <div class="vr-footer">
        <span>Veritas Analytics — Plataforma de Cálculos Jurídicos e Periciais</span>
        <span>Emitido em ${emitidoEm}</span>
      </div>
      <p class="vr-ressalva">Este documento é de natureza técnica e não substitui pareceres jurídicos. Os valores são estimativos e devem ser conferidos antes de utilização processual.</p>
    </div>`;

  return buildVeritasReport({ title: "Proposição de Honorários Advocatícios", body });
}

export default function HonorariosJuridicos() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const defaultUser: LoggedUser = {
    nomeAssinatura: user?.nome ?? "Advogado Responsável",
    tituloProfissional: "Advogado",
    registroProfissional: user?.oab ? `OAB ${user.oab}` : "OAB/UF 000000",
  };

  const [form, setForm] = useState<FormData>({ ...DEFAULT_FORM, advogadoResponsavel: user?.nome ?? "" });
  const [items, setItems] = useState<ItemHonorario[]>(DEFAULT_ITEMS);
  const [loggedUser, setLoggedUser] = useState<LoggedUser>(defaultUser);
  const [showSuccess, setShowSuccess] = useState(false);

  const subtotalItens = useMemo(() => items.reduce((a, i) => a + i.total, 0), [items]);

  const valorExitoEstimado = useMemo(() => {
    if (["fixo", "por_ato", "por_fase", "mensal"].includes(form.modeloCobranca)) return 0;
    return form.proveitoEconomicoEstimado * (form.percentualExito / 100);
  }, [form.modeloCobranca, form.proveitoEconomicoEstimado, form.percentualExito]);

  const totalProjetado = useMemo(
    () => form.honorarioFixo + subtotalItens + form.despesasAdicionais + valorExitoEstimado,
    [form.honorarioFixo, subtotalItens, form.despesasAdicionais, valorExitoEstimado]
  );

  const valorEntrada = totalProjetado * (form.entradaPercentual / 100);
  const saldoRestante = totalProjetado - valorEntrada;
  const valorParcela = form.parcelasSaldo > 0 ? saldoRestante / form.parcelasSaldo : saldoRestante;
  const alertaOAB = form.valorReferenciaOAB > 0 && totalProjetado < form.valorReferenciaOAB;

  function upd<K extends keyof FormData>(f: K, v: FormData[K]) {
    setForm((p) => ({ ...p, [f]: v }));
  }
  function updU<K extends keyof LoggedUser>(f: K, v: LoggedUser[K]) {
    setLoggedUser((p) => ({ ...p, [f]: v }));
  }
  function handleItem(id: number, field: keyof ItemHonorario, val: string | number) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const u = { ...it, [field]: val } as ItemHonorario;
        u.quantidade = clamp(Number(u.quantidade));
        u.valorUnitario = clamp(Number(u.valorUnitario));
        u.total = u.quantidade * u.valorUnitario;
        return u;
      })
    );
  }

  function handleClear() {
    setForm({ ...DEFAULT_FORM, advogadoResponsavel: user?.nome ?? "" });
    setItems(DEFAULT_ITEMS);
    setShowSuccess(false);
  }

  function handleDeleteItem(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function handleAddItem() {
    const nextId = Math.max(0, ...items.map((i) => i.id)) + 1;
    setItems((prev) => [
      ...prev,
      { id: nextId, categoria: "ato", descricao: "Novo item", quantidade: 1, valorUnitario: 0, total: 0 },
    ]);
  }

  async function handleSave() {
    const hoje = new Date().toISOString().slice(0, 10);
    const cliente = form.cliente || "Não informado";
    const processo = form.processo || "s/n";
    const area = form.areaDireito || "Jurídico";

    const entrada = totalProjetado * (form.entradaPercentual / 100);
    const saldo = totalProjetado - entrada;
    const qtde = Math.max(1, form.parcelasSaldo);
    const valParcela = saldo / qtde;

    setShowSuccess(true);

    try {
      // Lança entrada na Controladoria Jurídica (se houver)
      if (entrada > 0.01) {
        await postReceivable({
          cliente,
          processo,
          contrato: `Honorários Advocatícios — Entrada (${area})`,
          vencimento: hoje,
          valor: Number(entrada.toFixed(2)),
          status: "Aberto",
        });
      }
      // Lança cada parcela na Controladoria Jurídica
      for (let i = 0; i < qtde; i++) {
        await postReceivable({
          cliente,
          processo,
          contrato: `Honorários Advocatícios — Parcela ${i + 1}/${qtde} (${area})`,
          vencimento: addMonths(hoje, i + 1),
          valor: Number(valParcela.toFixed(2)),
          status: "Aberto",
        });
      }
    } catch {
      // falha silenciosa — dados ficam no localStorage de fallback
    }

    // Salva também no localStorage (fallback / histórico local)
    const propostaId = crypto.randomUUID();
    const proposta = {
      id: propostaId, cliente, cpfCnpj: form.cpfCnpj,
      processo: form.processo, comarca: form.comarca,
      advogado: form.advogadoResponsavel || loggedUser.nomeAssinatura,
      areaDireito: area, valorTotal: totalProjetado,
      entradaPercentual: form.entradaPercentual, parcelasSaldo: form.parcelasSaldo,
      dataProposta: hoje, usuarioResponsavel: loggedUser.nomeAssinatura, status: "aprovada" as const,
    };
    try {
      const ep = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
      localStorage.setItem(LS_KEY, JSON.stringify([proposta, ...ep]));
    } catch { localStorage.setItem(LS_KEY, JSON.stringify([proposta])); }

    setTimeout(() => navigate("/controladoria-juridica"), 1400);
  }

  function handleProposal() {
    const html = buildHtml({ form, items, user: loggedUser, subtotalItens, valorExitoEstimado, totalProjetado, valorEntrada, saldoRestante, valorParcela, alertaOAB });
    openVeritasReport(html);
  }

  return (
    <div style={S.page}>
      <div style={S.wrapper}>
        <div style={S.headerRow}>
          <div>
            <h1 style={S.title}>Precificação de Honorários Advocatícios</h1>
            <p style={S.subtitle}>Composição assistida de honorários jurídicos com geração de proposta e integração à Controladora Financeira.</p>
          </div>
          <div style={S.actionsRow}>
            <button style={S.secondaryBtn} onClick={handleClear}>Limpar / Novo</button>
            <button style={S.blueBtn} onClick={handleProposal}>Gerar Proposta</button>
          </div>
        </div>

        {showSuccess && (
          <div style={S.successBox}>Honorários lançados na Controladoria Jurídica (Contas a Receber). Redirecionando…</div>
        )}

        {/* Identificação */}
        <section style={S.panel}>
          <div style={S.sectionLabel}>Identificação do Caso</div>
          <div style={S.grid2}>
            <Field label="Cliente">
              <input style={S.input} value={form.cliente} onChange={e => upd("cliente", e.target.value)} placeholder="Nome do cliente" />
            </Field>
            <Field label="CPF/CNPJ">
              <input style={S.input} value={form.cpfCnpj} onChange={e => upd("cpfCnpj", e.target.value)} placeholder="000.000.000-00" />
            </Field>
          </div>
          <div style={S.grid3}>
            <Field label="Área do Direito">
              <input style={S.input} value={form.areaDireito} onChange={e => upd("areaDireito", e.target.value)} placeholder="Ex.: Previdenciário, Trabalhista" />
            </Field>
            <Field label="Tipo de Demanda">
              <input style={S.input} value={form.tipoDemanda} onChange={e => upd("tipoDemanda", e.target.value)} placeholder="Ex.: Revisão, Reclamação, Execução" />
            </Field>
            <Field label="Modelo de Cobrança">
              <select style={S.input} value={form.modeloCobranca} onChange={e => upd("modeloCobranca", e.target.value as ModeloCobranca)}>
                <option value="fixo">Honorário Fixo</option>
                <option value="por_ato">Honorário por Ato</option>
                <option value="por_fase">Honorário por Fase</option>
                <option value="exito">Honorário de Êxito</option>
                <option value="hibrido">Honorário Híbrido</option>
                <option value="mensal">Honorário Mensal</option>
              </select>
            </Field>
          </div>
          <div style={S.grid3}>
            <Field label="Processo">
              <input style={S.input} value={form.processo} onChange={e => upd("processo", e.target.value)} placeholder="Número do processo" />
            </Field>
            <Field label="Comarca">
              <input style={S.input} value={form.comarca} onChange={e => upd("comarca", e.target.value)} placeholder="Cidade/UF" />
            </Field>
            <Field label="Advogado Responsável">
              <input style={S.input} value={form.advogadoResponsavel} onChange={e => upd("advogadoResponsavel", e.target.value)} placeholder="Nome" />
            </Field>
          </div>
        </section>

        {/* Base econômica */}
        <section style={S.panel}>
          <div style={S.sectionLabel}>Base Econômica e Referência</div>
          <div style={S.grid4}>
            <Field label="Valor da Causa (R$)">
              <input style={S.input} type="number" min={0} step="0.01" value={form.valorCausa} onChange={e => upd("valorCausa", clamp(Number(e.target.value)))} />
            </Field>
            <Field label="Proveito Econômico Estimado (R$)">
              <input style={S.input} type="number" min={0} step="0.01" value={form.proveitoEconomicoEstimado} onChange={e => upd("proveitoEconomicoEstimado", clamp(Number(e.target.value)))} />
            </Field>
            <Field label="Honorário Fixo (R$)">
              <input style={S.input} type="number" min={0} step="0.01" value={form.honorarioFixo} onChange={e => upd("honorarioFixo", clamp(Number(e.target.value)))} />
            </Field>
            <Field label="Referência OAB (R$)">
              <input style={S.input} type="number" min={0} step="0.01" value={form.valorReferenciaOAB} onChange={e => upd("valorReferenciaOAB", clamp(Number(e.target.value)))} />
            </Field>
          </div>
          <div style={S.grid4}>
            <Field label="Percentual de Êxito (%)">
              <input style={S.input} type="number" min={0} step="0.01" value={form.percentualExito} onChange={e => upd("percentualExito", clamp(Number(e.target.value)))} />
            </Field>
            <Field label="Despesas Adicionais (R$)">
              <input style={S.input} type="number" min={0} step="0.01" value={form.despesasAdicionais} onChange={e => upd("despesasAdicionais", clamp(Number(e.target.value)))} />
            </Field>
            <Field label="Validade da Proposta (dias)">
              <input style={S.input} type="number" min={1} step="1" value={form.validadeDias} onChange={e => upd("validadeDias", clamp(Number(e.target.value), 1))} />
            </Field>
            <div />
          </div>
        </section>

        {/* Composição */}
        <section style={S.panel}>
          <div style={S.sectionLabel}>Composição Manual dos Honorários</div>
          <div style={S.tableHeader}>
            <div style={{ width: 36 }}>#</div>
            <div style={{ width: 120 }}>Categoria</div>
            <div style={{ flex: 1 }}>Descrição</div>
            <div style={{ width: 110, textAlign: "center" }}>Quantidade</div>
            <div style={{ width: 160, textAlign: "right" }}>Valor Unit. (R$)</div>
            <div style={{ width: 170, textAlign: "right" }}>Total (R$)</div>
            <div style={{ width: 36 }} />
          </div>
          {items.map((it, idx) => (
            <div key={it.id} style={S.tableRow}>
              <div style={{ width: 36, fontWeight: 600, color: "#64748b", fontSize: 13 }}>{idx + 1}</div>
              <div style={{ width: 120 }}>
                <select style={{ ...S.input, padding: "4px 6px" }} value={it.categoria}
                  onChange={e => handleItem(it.id, "categoria", e.target.value)}>
                  <option value="ato">Ato</option>
                  <option value="fase">Fase</option>
                  <option value="despesa">Despesa</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <input style={{ ...S.input }} value={it.descricao}
                  onChange={e => handleItem(it.id, "descricao", e.target.value)} />
              </div>
              <div style={{ width: 110 }}>
                <input style={{ ...S.input, textAlign: "center" }} type="number" min={0} step="1"
                  value={it.quantidade} onChange={e => handleItem(it.id, "quantidade", Number(e.target.value))} />
              </div>
              <div style={{ width: 160 }}>
                <input style={{ ...S.input, textAlign: "right" }} type="number" min={0} step="0.01"
                  value={it.valorUnitario} onChange={e => handleItem(it.id, "valorUnitario", Number(e.target.value))} />
              </div>
              <div style={{ width: 170 }}>
                <div style={{ ...S.totalCell, textAlign: "right" }}>{fmtCurrency(it.total)}</div>
              </div>
              <div style={{ width: 36, display: "flex", justifyContent: "center" }}>
                <button
                  onClick={() => handleDeleteItem(it.id)}
                  title="Excluir item"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 18, lineHeight: 1, padding: "2px 4px", borderRadius: 4 }}>
                  ✕
                </button>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 10 }}>
            <button onClick={handleAddItem} style={{ ...S.secondaryBtn, fontSize: 13, padding: "6px 14px" }}>
              + Adicionar Item
            </button>
          </div>
        </section>

        {/* Condições financeiras e assinatura */}
        <section style={S.panel}>
          <div style={S.sectionLabel}>Condições Financeiras e Assinatura</div>
          <div style={S.grid4}>
            <Field label="% Entrada">
              <input style={S.input} type="number" min={0} max={100} step="0.01" value={form.entradaPercentual} onChange={e => upd("entradaPercentual", clamp(Number(e.target.value)))} />
            </Field>
            <Field label="Parcelas do saldo">
              <input style={S.input} type="number" min={1} step="1" value={form.parcelasSaldo} onChange={e => upd("parcelasSaldo", clamp(Number(e.target.value), 1))} />
            </Field>
            <Field label="Nome de assinatura">
              <input style={S.input} value={loggedUser.nomeAssinatura} onChange={e => updU("nomeAssinatura", e.target.value)} />
            </Field>
            <Field label="Título profissional">
              <input style={S.input} value={loggedUser.tituloProfissional} onChange={e => updU("tituloProfissional", e.target.value)} />
            </Field>
          </div>
          <div style={S.grid4}>
            <Field label="Registro profissional">
              <input style={S.input} value={loggedUser.registroProfissional} onChange={e => updU("registroProfissional", e.target.value)} />
            </Field>
            <Field label="Observações">
              <input style={S.input} value={form.observacoes} onChange={e => upd("observacoes", e.target.value)} placeholder="Observações da proposta" />
            </Field>
            <div /><div />
          </div>
        </section>

        {/* Totais */}
        <section style={S.totalFooter}>
          <div>
            <div style={S.totalLabel}>TOTAL PROJETADO</div>
            <div style={S.totalValue}>{fmtCurrency(totalProjetado)}</div>
            <div style={S.totalMeta}>Honorário fixo: {fmtCurrency(form.honorarioFixo)} | Itens: {fmtCurrency(subtotalItens)}</div>
            <div style={S.totalMeta}>Êxito estimado: {fmtCurrency(valorExitoEstimado)} | Despesas adicionais: {fmtCurrency(form.despesasAdicionais)}</div>
            <div style={S.totalMeta}>Entrada: {fmtCurrency(valorEntrada)} | Saldo: {fmtCurrency(saldoRestante)} | Parcela: {fmtCurrency(valorParcela)}</div>
            {alertaOAB && <div style={S.alertText}>Atenção: o valor projetado está abaixo da referência OAB informada.</div>}
          </div>
          <div style={S.actionsRow}>
            <button style={S.secondaryBtn} onClick={handleSave}>Salvar Dados</button>
            <button style={S.blueBtn} onClick={handleProposal}>Gerar Proposta</button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, color: "#334155", fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:        { background: "#f8fafc", minHeight: "100vh", padding: "24px", color: "#0f172a", fontFamily: '"Segoe UI", Arial, sans-serif' },
  wrapper:     { maxWidth: 1600, margin: "0 auto" },
  headerRow:   { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18, flexWrap: "wrap" },
  title:       { margin: 0, fontSize: 34, lineHeight: 1.15, color: "#17365d", fontWeight: 700 },
  subtitle:    { marginTop: 8, marginBottom: 0, color: "#475569", fontSize: 14 },
  actionsRow:  { display: "flex", gap: 10, flexWrap: "wrap" },
  panel:       { background: "#fff", border: "1px solid #dbe3ee", borderRadius: 14, padding: 18, marginBottom: 18, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" },
  sectionLabel:{ fontWeight: 700, color: "#17365d", marginBottom: 14, fontSize: 18 },
  grid2:       { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginBottom: 14 },
  grid3:       { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, marginBottom: 14 },
  grid4:       { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 14 },
  input:       { width: "100%", border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", background: "#fff", boxSizing: "border-box" },
  tableHeader: { display: "flex", gap: 10, padding: "10px 8px", borderBottom: "2px solid #dbe3ee", fontWeight: 700, color: "#17365d", fontSize: 14 },
  tableRow:    { display: "flex", gap: 10, alignItems: "center", padding: "10px 8px", borderBottom: "1px solid #e5e7eb", fontSize: 14 },
  totalCell:   { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", fontWeight: 600, color: "#0f172a" },
  totalFooter: { background: "#fff", border: "1px solid #dbe3ee", borderRadius: 14, padding: 18, display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" },
  totalLabel:  { fontSize: 18, fontWeight: 800, color: "#17365d" },
  totalValue:  { fontSize: 34, fontWeight: 800, color: "#0f172a", marginTop: 4 },
  totalMeta:   { fontSize: 13, color: "#475569", marginTop: 6 },
  alertText:   { fontSize: 13, color: "#c2410c", marginTop: 8, fontWeight: 700 },
  secondaryBtn:{ border: "1px solid #cbd5e1", background: "#fff", color: "#17365d", borderRadius: 10, padding: "11px 16px", fontWeight: 700, cursor: "pointer" },
  blueBtn:     { border: "1px solid #2563eb", background: "#2563eb", color: "#fff", borderRadius: 10, padding: "11px 16px", fontWeight: 700, cursor: "pointer" },
  successBox:  { background: "#dcfce7", border: "1px solid #86efac", color: "#166534", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontWeight: 600 },
};
