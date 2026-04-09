import { useMemo, useState, useEffect } from "react";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useLocation } from "wouter";
import veritasLogoUrl from "@assets/veritas_analytics_1775154424712.png";
import { buildVeritasReport, openVeritasReport } from "@/components/reports/VeritasReportLayout";

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
function addMonths(iso: string, m: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + m);
  return d.toISOString().slice(0, 10);
}

type ActivityItem = {
  id: number;
  descricao: string;
  horas: number;
  total: number;
  modo: "hora" | "valor_direto";
};

type LoggedUser = {
  nomeAssinatura: string;
  tituloProfissional: string;
  registroProfissional: string;
};

type FormData = {
  clienteParte: string;
  cpfCnpj: string;
  processo: string;
  advogado: string;
  comarca: string;
  horaTecnica: number;
  entradaPercentual: number;
  parcelasSaldo: number;
  habilitarCBSIBS: boolean;
  cbsPercentual: number;
  ibsPercentual: number;
  validadeDias: number;
  observacoes: string;
};

const DEFAULT_ACTIVITIES: ActivityItem[] = [
  { id: 1, descricao: "Estudo e Manuseio do Material/Processo", horas: 0, total: 0, modo: "hora" },
  { id: 2, descricao: "Diligência e Prova Pericial", horas: 0, total: 0, modo: "hora" },
  { id: 3, descricao: "Pesquisa Contábil/Análise de Documentos", horas: 0, total: 0, modo: "hora" },
  { id: 4, descricao: "Cálculos Matemáticos e Estatísticos", horas: 0, total: 0, modo: "hora" },
  { id: 5, descricao: "Elaboração do Laudo Pericial", horas: 0, total: 0, modo: "hora" },
  { id: 6, descricao: "Auxiliar do Perito", horas: 0, total: 0, modo: "hora" },
  { id: 7, descricao: "Custos Diretos (Material de Escritório, Xerox)", horas: 0, total: 0, modo: "valor_direto" },
];

const DEFAULT_FORM: FormData = {
  clienteParte: "",
  cpfCnpj: "",
  processo: "",
  advogado: "",
  comarca: "",
  horaTecnica: 560,
  entradaPercentual: 0,
  parcelasSaldo: 1,
  habilitarCBSIBS: false,
  cbsPercentual: 8.5,
  ibsPercentual: 17.7,
  validadeDias: 15,
  observacoes: "",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0
  );
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("pt-BR");
}

function clampNumber(value: number, min = 0): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return min;
  return Math.max(min, value);
}

function sanitizeText(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function genChave(): string {
  const ADJETIVOS = ["FEDERAL","JUDICIAL","LEGAL","OFICIAL","FORMAL","CERTO","FIRME","CLARO","JUSTO","BREVE","FORTE","PURO","NOBRE","LEAL","REAL"];
  const SUBSTANTIVOS = ["CALCULO","PROCESSO","ACAO","VALOR","CREDITO","DEBITO","PARCELA","INDICE","FATOR","SALDO","CONTA","BALANCO","ORDEM","TITULO","LAUDO"];
  const adj  = ADJETIVOS[Math.floor(Math.random() * ADJETIVOS.length)];
  const noun = SUBSTANTIVOS[Math.floor(Math.random() * SUBSTANTIVOS.length)];
  const hex  = () => Math.floor(Math.random() * 65536).toString(16).toUpperCase().padStart(4, "0");
  return `${adj}-${noun}-${hex()}-${hex()}`;
}

function getProposalHtml(params: {
  form: FormData;
  activities: ActivityItem[];
  user: LoggedUser;
  subtotalTecnico: number;
  totalHorasTecnicas: number;
  cbsValor: number;
  ibsValor: number;
  totalTributos: number;
  totalGeral: number;
  valorEntrada: number;
  saldoRestante: number;
  valorParcela: number;
}) {
  const {
    form, activities, user, subtotalTecnico, totalHorasTecnicas,
    cbsValor, ibsValor, totalTributos, totalGeral,
    valorEntrada, saldoRestante, valorParcela,
  } = params;

  const today = new Date();
  const chave = genChave();
  const emitidoEm = today.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
  const logoSrc = window.location.origin + veritasLogoUrl;

  const rows = activities
    .filter((item) => item.horas > 0 || item.total > 0)
    .map((item) => {
      const valorUnitario = item.modo === "hora" ? form.horaTecnica : item.total;
      const qtde = item.modo === "hora" ? item.horas : 1;
      return `
        <tr>
          <td>${item.id}</td>
          <td>${sanitizeText(item.descricao)}</td>
          <td style="text-align:right;">${qtde.toLocaleString("pt-BR")}</td>
          <td style="text-align:right;">${formatCurrency(valorUnitario)}</td>
          <td style="text-align:right;">${formatCurrency(item.total)}</td>
        </tr>
      `;
    })
    .join("");

  const credencial = [sanitizeText(user.tituloProfissional || ""), user.registroProfissional ? `— ${sanitizeText(user.registroProfissional)}` : ""].filter(Boolean).join(" ");

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
        <div><strong>Perito:</strong> ${sanitizeText(user.nomeAssinatura || "—")}</div>
        ${credencial ? `<div>${credencial}</div>` : ""}
      </div>
    </div>

    <div class="vr-title-bar">
      <div class="vr-title-bar-title">Proposição de Honorários Periciais Contábeis</div>
      <div class="vr-title-bar-chave">Chave: ${chave}</div>
    </div>

    <div class="vr-body">
      <div class="vr-notes">
        <div><strong>Processo:</strong> ${sanitizeText(form.processo || "Não informado")}</div>
        <div><strong>Comarca:</strong> ${sanitizeText(form.comarca || "Não informada")}</div>
        <div><strong>Parte/Cliente:</strong> ${sanitizeText(form.clienteParte || "Não informado")}${form.cpfCnpj ? ` (${sanitizeText(form.cpfCnpj)})` : ""}</div>
        <div><strong>Advogado:</strong> ${sanitizeText(form.advogado || "Não informado")}</div>
      </div>

      <div class="vr-paragraph">
        A proposição dos honorários periciais foi realizada em conformidade com os critérios técnicos previstos nas Normas Brasileiras de Contabilidade aplicáveis à Perícia Contábil (NBC PP 01 e NBC TP 01), considerando-se a natureza e a extensão dos trabalhos periciais a serem executados. Para a definição do valor apresentado, este perito levou em consideração a relevância, o vulto econômico e a complexidade dos serviços, o tempo técnico estimado, a qualificação profissional da equipe técnica e o prazo estabelecido para a entrega do laudo. Adicionalmente, observou-se o disposto no art. 95 do CPC, que estabelece que a remuneração do perito deve ser fixada de forma compatível com a natureza, a complexidade e a extensão do trabalho pericial a ser desenvolvido.
      </div>

      <div class="vr-section-title">QUADRO ORÇAMENTÁRIO</div>

      <table>
        <thead>
          <tr>
            <th style="width:50px;">ITEM</th>
            <th>ATIVIDADES</th>
            <th class="right" style="width:110px;">QTDE.</th>
            <th class="right" style="width:140px;">VALOR UNIT.</th>
            <th class="right" style="width:150px;">VALOR TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px;">Nenhuma atividade informada.</td></tr>`}
        </tbody>
      </table>

      <div class="vr-summary">
        <div class="vr-summary-row">
          <span>VALOR TOTAL DE HORAS / FINANCEIRO</span>
          <span>${totalHorasTecnicas.toLocaleString("pt-BR")} h | ${formatCurrency(subtotalTecnico)}</span>
        </div>
        ${form.habilitarCBSIBS ? `
          <div class="vr-summary-row"><span>CBS (${form.cbsPercentual.toLocaleString("pt-BR")}%)</span><span>${formatCurrency(cbsValor)}</span></div>
          <div class="vr-summary-row"><span>IBS (${form.ibsPercentual.toLocaleString("pt-BR")}%)</span><span>${formatCurrency(ibsValor)}</span></div>
          <div class="vr-summary-row"><span>TRIBUTOS</span><span>${formatCurrency(totalTributos)}</span></div>
        ` : ""}
        <div class="vr-summary-row">
          <span>TOTAL GERAL DA PROPOSTA</span>
          <span>${formatCurrency(totalGeral)}</span>
        </div>
      </div>

      <div class="vr-notes" style="margin-top:12px;">
        <div><strong>Condição de pagamento:</strong> entrada de ${form.entradaPercentual.toLocaleString("pt-BR")}% (${formatCurrency(valorEntrada)}) e saldo de ${formatCurrency(saldoRestante)} em ${form.parcelasSaldo} parcela(s) de ${formatCurrency(valorParcela)}.</div>
        <div><strong>Data da Proposta:</strong> ${formatDate(today)}</div>
        <div><strong>Validade da Proposta:</strong> ${form.validadeDias} dias</div>
        ${form.observacoes ? `<div><strong>Observações:</strong> ${sanitizeText(form.observacoes)}</div>` : ""}
      </div>

      <div class="vr-signature">
        <div class="vr-signature-line"></div>
        <div class="vr-signature-name">${sanitizeText(user.nomeAssinatura)}</div>
        <div class="vr-signature-role">${sanitizeText(user.tituloProfissional)}${user.registroProfissional ? ` — ${sanitizeText(user.registroProfissional)}` : ""}</div>
        <div class="vr-footer-chave">Chave de recuperação: <strong>${chave}</strong> — Veritas Analytics · ${emitidoEm}</div>
      </div>

      <div class="vr-footer">
        <span>Veritas Analytics — Plataforma de Cálculos Jurídicos e Periciais</span>
        <span>Emitido em ${emitidoEm}</span>
      </div>
      <p class="vr-ressalva">Este documento é de natureza técnica e não substitui pareceres jurídicos. Os valores são estimativos e devem ser conferidos com documentos e índices oficiais antes de utilização processual.</p>
    </div>`;

  return buildVeritasReport({ title: "Proposição de Honorários Periciais Contábeis", body });
}

export default function HonorariosPericiais() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [activities, setActivities] = useState<ActivityItem[]>(DEFAULT_ACTIVITIES);
  const [loggedUser, setLoggedUser] = useState<LoggedUser>({
    nomeAssinatura: "",
    tituloProfissional: "Perito Contador",
    registroProfissional: "",
  });
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (user?.nome) {
      setLoggedUser((prev) => ({
        ...prev,
        nomeAssinatura: user.nome,
        registroProfissional: (user as any).numeroOab
          ? `CRC ${(user as any).ufOab || "MG"} ${(user as any).numeroOab}/O`
          : prev.registroProfissional,
      }));
    }
  }, [user]);

  const subtotalTecnico = useMemo(() => activities.reduce((acc, item) => acc + item.total, 0), [activities]);
  const totalHorasTecnicas = useMemo(() => activities.filter((i) => i.modo === "hora").reduce((acc, i) => acc + i.horas, 0), [activities]);
  const cbsValor = useMemo(() => (form.habilitarCBSIBS ? subtotalTecnico * (form.cbsPercentual / 100) : 0), [form.habilitarCBSIBS, form.cbsPercentual, subtotalTecnico]);
  const ibsValor = useMemo(() => (form.habilitarCBSIBS ? subtotalTecnico * (form.ibsPercentual / 100) : 0), [form.habilitarCBSIBS, form.ibsPercentual, subtotalTecnico]);
  const totalTributos = cbsValor + ibsValor;
  const totalGeral = subtotalTecnico + totalTributos;
  const valorEntrada = totalGeral * (form.entradaPercentual / 100);
  const saldoRestante = totalGeral - valorEntrada;
  const valorParcela = form.parcelasSaldo > 0 ? saldoRestante / form.parcelasSaldo : saldoRestante;

  function updateForm<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateUser<K extends keyof LoggedUser>(field: K, value: LoggedUser[K]) {
    setLoggedUser((prev) => ({ ...prev, [field]: value }));
  }

  function handleActivityHoursChange(id: number, value: number) {
    setActivities((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const horas = clampNumber(value);
        return { ...item, horas, total: item.modo === "hora" ? horas * form.horaTecnica : item.total };
      })
    );
  }

  function handleActivityTotalChange(id: number, value: number) {
    setActivities((prev) => prev.map((item) => (item.id === id ? { ...item, total: clampNumber(value) } : item)));
  }

  function recalculateTotals() {
    setActivities((prev) => prev.map((item) => (item.modo === "hora" ? { ...item, total: item.horas * form.horaTecnica } : item)));
  }

  function handleClearNew() {
    setForm(DEFAULT_FORM);
    setActivities(DEFAULT_ACTIVITIES);
    setShowSuccess(false);
  }

  async function handleSaveData() {
    recalculateTotals();
    const hoje = new Date().toISOString().slice(0, 10);
    const cliente = form.clienteParte || "Não informado";
    const processo = form.processo || "s/n";
    const qtde = Math.max(1, form.parcelasSaldo);
    // usa os valores já calculados (após recalculateTotals aplicado acima)
    const totalGeralAtual = subtotalTecnico + totalTributos;
    const entradaVal = totalGeralAtual * (form.entradaPercentual / 100);
    const saldoVal = totalGeralAtual - entradaVal;
    const parcelaVal = qtde > 0 ? saldoVal / qtde : saldoVal;

    setShowSuccess(true);
    try {
      if (entradaVal > 0.01) {
        await postReceivable({
          cliente,
          processo,
          contrato: "Honorários Periciais — Entrada (Perícia Contábil)",
          vencimento: hoje,
          valor: Number(entradaVal.toFixed(2)),
          status: "Aberto",
        });
      }
      for (let i = 0; i < qtde; i++) {
        await postReceivable({
          cliente,
          processo,
          contrato: `Honorários Periciais — Parcela ${i + 1}/${qtde} (Perícia Contábil)`,
          vencimento: addMonths(hoje, i + 1),
          valor: Number(parcelaVal.toFixed(2)),
          status: "Aberto",
        });
      }
    } catch {
      // falha silenciosa
    }
    setTimeout(() => navigate("/controladoria-juridica"), 1400);
  }

  function handleGenerateProposal() {
    recalculateTotals();
    const html = getProposalHtml({
      form, activities, user: loggedUser,
      subtotalTecnico, totalHorasTecnicas,
      cbsValor, ibsValor, totalTributos, totalGeral,
      valorEntrada, saldoRestante, valorParcela,
    });
    openVeritasReport(html);
  }

  return (
    <div style={s.page}>
      <div style={s.wrapper}>

        {/* Header */}
        <div style={s.headerRow}>
          <div>
            <h1 style={s.title}>Honorários Periciais</h1>
            <p style={s.subtitle}>Precificação e geração de proposta técnica para perícias contábeis judiciais.</p>
          </div>
          <div style={s.actionsRow}>
            <button style={s.secondaryBtn} onClick={handleClearNew}>Limpar / Nova Proposta</button>
            <button style={s.primaryBtn} onClick={handleGenerateProposal}>Gerar Proposta PDF</button>
          </div>
        </div>

        {showSuccess && (
          <div style={s.successBox}>Honorários Periciais lançados na Controladoria Jurídica (Contas a Receber). Redirecionando…</div>
        )}

        {/* Dados do processo */}
        <section style={s.panel}>
          <div style={s.sectionLabel}>Dados do Processo</div>

          <div style={s.grid2}>
            <div style={s.field}>
              <label style={s.label}>Cliente / Parte</label>
              <input style={s.input} value={form.clienteParte} onChange={(e) => updateForm("clienteParte", e.target.value)} placeholder="Nome do cliente ou parte no processo" />
            </div>
            <div style={s.field}>
              <label style={s.label}>CPF / CNPJ</label>
              <input style={s.input} value={form.cpfCnpj} onChange={(e) => updateForm("cpfCnpj", e.target.value)} placeholder="000.000.000-00 ou 00.000.000/0001-00" />
            </div>
          </div>

          <div style={s.grid2}>
            <div style={s.field}>
              <label style={s.label}>Número do Processo</label>
              <input style={s.input} value={form.processo} onChange={(e) => updateForm("processo", e.target.value)} placeholder="0000000-00.0000.0.00.0000" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Advogado</label>
              <input style={s.input} value={form.advogado} onChange={(e) => updateForm("advogado", e.target.value)} placeholder="Nome do advogado da parte" />
            </div>
          </div>

          <div style={s.grid3}>
            <div style={s.field}>
              <label style={s.label}>Comarca</label>
              <input style={s.input} value={form.comarca} onChange={(e) => updateForm("comarca", e.target.value)} placeholder="Cidade/UF" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Valor da Hora Técnica (R$)</label>
              <input
                style={s.input} type="number" min={0} step="0.01"
                value={form.horaTecnica}
                onChange={(e) => updateForm("horaTecnica", clampNumber(Number(e.target.value)))}
                onBlur={recalculateTotals}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Validade da Proposta (dias)</label>
              <input
                style={s.input} type="number" min={1} step="1"
                value={form.validadeDias}
                onChange={(e) => updateForm("validadeDias", clampNumber(Number(e.target.value), 1))}
              />
            </div>
          </div>
        </section>

        {/* Atividades */}
        <section style={s.panel}>
          <div style={s.sectionLabel}>Quadro Orçamentário de Atividades</div>

          <div style={s.tableHeader}>
            <div style={{ width: 40 }}>Item</div>
            <div style={{ flex: 1 }}>Descrição da Atividade</div>
            <div style={{ width: 160, textAlign: "center" }}>Horas / Base</div>
            <div style={{ width: 190, textAlign: "right" }}>Valor Total (R$)</div>
          </div>

          {activities.map((item) => (
            <div key={item.id} style={s.tableRow}>
              <div style={{ width: 40, fontWeight: 700, color: "#17365d" }}>{item.id}</div>
              <div style={{ flex: 1, fontSize: 14 }}>{item.descricao}</div>
              <div style={{ width: 160 }}>
                {item.modo === "hora" ? (
                  <input
                    style={{ ...s.input, textAlign: "center", marginBottom: 0 }}
                    type="number" min={0} step="0.5"
                    value={item.horas}
                    onChange={(e) => handleActivityHoursChange(item.id, Number(e.target.value))}
                  />
                ) : (
                  <span style={s.costTag}>Valor direto</span>
                )}
              </div>
              <div style={{ width: 190 }}>
                {item.modo === "hora" ? (
                  <div style={s.totalCell}>{formatCurrency(item.total)}</div>
                ) : (
                  <input
                    style={{ ...s.input, textAlign: "right", marginBottom: 0 }}
                    type="number" min={0} step="0.01"
                    value={item.total}
                    onChange={(e) => handleActivityTotalChange(item.id, Number(e.target.value))}
                  />
                )}
              </div>
            </div>
          ))}

          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
            <button style={s.secondaryBtn} onClick={recalculateTotals}>Atualizar Totais</button>
          </div>
        </section>

        {/* Condições de pagamento */}
        <section style={s.panel}>
          <div style={s.sectionLabel}>Condições de Pagamento e Tributação</div>

          <div style={s.grid4}>
            <div style={s.field}>
              <label style={s.label}>Entrada (%)</label>
              <input
                style={s.input} type="number" min={0} max={100} step="0.01"
                value={form.entradaPercentual}
                onChange={(e) => updateForm("entradaPercentual", clampNumber(Number(e.target.value)))}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Parcelas do saldo</label>
              <input
                style={s.input} type="number" min={1} step="1"
                value={form.parcelasSaldo}
                onChange={(e) => updateForm("parcelasSaldo", clampNumber(Number(e.target.value), 1))}
              />
            </div>
            <div style={{ ...s.field, justifyContent: "flex-end", paddingBottom: 8 }}>
              <label style={s.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={form.habilitarCBSIBS}
                  onChange={(e) => updateForm("habilitarCBSIBS", e.target.checked)}
                />
                Habilitar CBS / IBS (Reforma Tributária)
              </label>
            </div>
            <div />
          </div>

          <div style={s.grid4}>
            <div style={s.field}>
              <label style={s.label}>CBS (%)</label>
              <input
                style={{ ...s.input, opacity: form.habilitarCBSIBS ? 1 : 0.4 }}
                type="number" min={0} step="0.01"
                value={form.cbsPercentual}
                disabled={!form.habilitarCBSIBS}
                onChange={(e) => updateForm("cbsPercentual", clampNumber(Number(e.target.value)))}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>IBS (%)</label>
              <input
                style={{ ...s.input, opacity: form.habilitarCBSIBS ? 1 : 0.4 }}
                type="number" min={0} step="0.01"
                value={form.ibsPercentual}
                disabled={!form.habilitarCBSIBS}
                onChange={(e) => updateForm("ibsPercentual", clampNumber(Number(e.target.value)))}
              />
            </div>
            <div style={{ ...s.field, gridColumn: "span 2" }}>
              <label style={s.label}>Observações</label>
              <input
                style={s.input}
                value={form.observacoes}
                onChange={(e) => updateForm("observacoes", e.target.value)}
                placeholder="Observações que aparecerão na proposta (ex: deslocamento incluso)"
              />
            </div>
          </div>
        </section>

        {/* Assinatura */}
        <section style={s.panel}>
          <div style={s.sectionLabel}>Assinatura da Proposta</div>
          <div style={s.grid3}>
            <div style={s.field}>
              <label style={s.label}>Nome de assinatura</label>
              <input style={s.input} value={loggedUser.nomeAssinatura} onChange={(e) => updateUser("nomeAssinatura", e.target.value)} placeholder="Dr. Fulano de Tal" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Título profissional</label>
              <input style={s.input} value={loggedUser.tituloProfissional} onChange={(e) => updateUser("tituloProfissional", e.target.value)} placeholder="Perito Contador" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Registro profissional (CRC / OAB)</label>
              <input style={s.input} value={loggedUser.registroProfissional} onChange={(e) => updateUser("registroProfissional", e.target.value)} placeholder="CRCMG 000000/O-0" />
            </div>
          </div>
        </section>

        {/* Rodapé de totais */}
        <section style={s.footer}>
          <div>
            <div style={s.footerLabel}>TOTAL GERAL DA PROPOSTA</div>
            <div style={s.footerValue}>{formatCurrency(totalGeral)}</div>
            <div style={s.footerMeta}>
              Subtotal técnico: {formatCurrency(subtotalTecnico)}
              {totalTributos > 0 && ` | Tributos: ${formatCurrency(totalTributos)}`}
              {` | ${totalHorasTecnicas.toLocaleString("pt-BR")} horas técnicas`}
            </div>
            <div style={s.footerMeta}>
              Entrada: {formatCurrency(valorEntrada)} | Saldo: {formatCurrency(saldoRestante)} | Parcela: {formatCurrency(valorParcela)}
            </div>
          </div>
          <div style={s.actionsRow}>
            <button style={s.secondaryBtn} onClick={handleSaveData}>Salvar Dados</button>
            <button style={s.primaryBtn} onClick={handleGenerateProposal}>Gerar Proposta PDF</button>
          </div>
        </section>

      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: "#f8fafc", minHeight: "100vh", padding: "24px 28px", color: "#0f172a", fontFamily: '"Inter", "Segoe UI", Arial, sans-serif' },
  wrapper: { maxWidth: 1200, margin: "0 auto" },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 30, lineHeight: 1.2, color: "#17365d", fontWeight: 800 },
  subtitle: { marginTop: 6, marginBottom: 0, color: "#64748b", fontSize: 14 },
  actionsRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  panel: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 22px", marginBottom: 16, boxShadow: "0 1px 3px rgba(15,23,42,0.05)" },
  sectionLabel: { fontWeight: 700, color: "#17365d", marginBottom: 16, fontSize: 16, borderBottom: "1px solid #f1f5f9", paddingBottom: 10 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginBottom: 14 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, marginBottom: 14 },
  grid4: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 14 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  label: { fontSize: 12, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#0f172a", fontWeight: 600, cursor: "pointer" },
  input: { border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", fontSize: 14, outline: "none", background: "#fff", boxSizing: "border-box", width: "100%", color: "#0f172a" },
  tableHeader: { display: "flex", gap: 12, padding: "10px 8px", borderBottom: "2px solid #e2e8f0", fontWeight: 700, color: "#334155", fontSize: 13, marginBottom: 2 },
  tableRow: { display: "flex", gap: 12, alignItems: "center", padding: "10px 8px", borderBottom: "1px solid #f1f5f9", fontSize: 14 },
  totalCell: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", fontWeight: 600, color: "#0f172a", textAlign: "right" as const, fontSize: 14 },
  costTag: { display: "inline-block", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 700 },
  footer: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 22px", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap", boxShadow: "0 1px 3px rgba(15,23,42,0.05)" },
  footerLabel: { fontSize: 13, fontWeight: 700, color: "#475569", textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  footerValue: { fontSize: 38, fontWeight: 800, color: "#17365d", marginTop: 4, lineHeight: 1 },
  footerMeta: { fontSize: 13, color: "#64748b", marginTop: 6 },
  secondaryBtn: { border: "1px solid #e2e8f0", background: "#fff", color: "#334155", borderRadius: 9, padding: "10px 18px", fontWeight: 600, cursor: "pointer", fontSize: 14 },
  primaryBtn: { border: "1px solid #2563eb", background: "#2563eb", color: "#fff", borderRadius: 9, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14 },
  successBox: { background: "#f0fdf4", border: "1px solid #86efac", color: "#166534", borderRadius: 10, padding: "12px 16px", marginBottom: 14, fontWeight: 600, fontSize: 14 },
};
