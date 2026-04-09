import {
  AlertTriangle, Banknote, Calculator, CreditCard, FileBarChart2,
  Landmark, Settings2, Sparkles,
} from "lucide-react";

export type JudicialCost = {
  id: string; client: string; process: string; type: string; date: string;
  value: number; reimbursable: boolean; reimbursed: boolean;
  status: "Lançada" | "Paga" | "Reembolsada";
};

export type JudicialDeposit = {
  id: string; process: string; date: string; value: number; bankRef: string;
  status: "Ativo" | "Levantado" | "Bloqueado";
};

export type JudicialAlvara = {
  id: string; process: string; issueDate: string; withdrawalDate?: string;
  beneficiary: string; value: number; status: "Expedido" | "Levantado" | "Pendente";
};

export type RevenueSplit = {
  id: string; baseRevenue: string; partner: string; role: string;
  percentage: number; amount: number; status: "Pendente" | "Provisionado" | "Pago";
};

export type TaxItem = {
  id: string; competence: string; client: string; taxType: string;
  baseAmount: number; taxRate: number; taxAmount: number;
  status: "Calculado" | "Conferido" | "Exportado";
};

export type BankMovement = {
  id: string; date: string; description: string; amount: number;
  type: "Crédito" | "Débito"; status: "Conciliado" | "Não conciliado" | "Pendente";
};

export type ReportCardItem = {
  id: string; title: string; description: string; period: string; format: string;
};

export type InsightItem = {
  id: string; title: string; description: string; severity: "Alta" | "Média" | "Baixa";
};

// ─── Custas, Depósitos e Alvarás ─────────────────────────────────────────────

export const judicialCostsMock: JudicialCost[] = [
  { id: "jc1", client: "Maria de Lourdes Silva", process: "5001234-89.2025.4.03.6183", type: "Custas iniciais", date: "10/01/2025", value: 850, reimbursable: true, reimbursed: false, status: "Lançada" },
  { id: "jc2", client: "João Carlos Santos", process: "0012847-21.2024.4.03.6100", type: "Custas recursais", date: "15/02/2025", value: 2100, reimbursable: false, reimbursed: false, status: "Paga" },
  { id: "jc3", client: "Claudia Ferreira Matos", process: "0098712-55.2024.4.03.6115", type: "Diligências", date: "20/02/2025", value: 380, reimbursable: true, reimbursed: true, status: "Reembolsada" },
  { id: "jc4", client: "Pedro Alves Nogueira", process: "1204781-44.2025.4.03.6120", type: "Custas periciais", date: "05/03/2025", value: 1750, reimbursable: true, reimbursed: false, status: "Lançada" },
  { id: "jc5", client: "Marcos Costa Pereira", process: "0011234-88.2024.4.03.6183", type: "Honorários de perito", date: "12/03/2025", value: 3200, reimbursable: false, reimbursed: false, status: "Paga" },
];

export const judicialDepositsMock: JudicialDeposit[] = [
  { id: "jd1", process: "5001234-89.2025.4.03.6183", date: "15/01/2025", value: 12500, bankRef: "DEP-2025-001", status: "Ativo" },
  { id: "jd2", process: "0012847-21.2024.4.03.6100", date: "20/02/2025", value: 8300, bankRef: "DEP-2024-089", status: "Levantado" },
  { id: "jd3", process: "0011234-88.2024.4.03.6183", date: "03/03/2025", value: 5200, bankRef: "DEP-2025-012", status: "Bloqueado" },
  { id: "jd4", process: "1204781-44.2025.4.03.6120", date: "10/03/2025", value: 22000, bankRef: "DEP-2025-021", status: "Ativo" },
];

export const judicialAlvaraMock: JudicialAlvara[] = [
  { id: "ja1", process: "0012847-21.2024.4.03.6100", issueDate: "18/01/2025", beneficiary: "João Carlos Santos", value: 8300, status: "Levantado", withdrawalDate: "22/01/2025" },
  { id: "ja2", process: "5001234-89.2025.4.03.6183", issueDate: "05/02/2025", beneficiary: "Maria de Lourdes Silva", value: 12500, status: "Expedido" },
  { id: "ja3", process: "2201234-77.2023.4.03.6100", issueDate: "10/03/2025", beneficiary: "Roberto Nunes Carvalho", value: 18700, status: "Pendente" },
];

// ─── Repasses e Sócios ────────────────────────────────────────────────────────

export const revenueSplitsMock: RevenueSplit[] = [
  { id: "rs1", baseRevenue: "Honorários — João Carlos Santos", partner: "Dr. Vasconcelos", role: "Sócio titular", percentage: 60, amount: 7680, status: "Provisionado" },
  { id: "rs2", baseRevenue: "Honorários — João Carlos Santos", partner: "Dra. Ana Lima", role: "Advogado responsável", percentage: 40, amount: 5120, status: "Provisionado" },
  { id: "rs3", baseRevenue: "Honorários — Roberto Nunes", partner: "Dr. Vasconcelos", role: "Sócio titular", percentage: 70, amount: 5950, status: "Pago" },
  { id: "rs4", baseRevenue: "Honorários — Roberto Nunes", partner: "Dra. Maria Helena", role: "Correspondente", percentage: 30, amount: 2550, status: "Pendente" },
  { id: "rs5", baseRevenue: "Consulta Empresa ABC Ltda", partner: "Dr. Marcos Costa", role: "Consultor", percentage: 50, amount: 3600, status: "Pago" },
];

// ─── Tributos e Retenções ─────────────────────────────────────────────────────

export const taxItemsMock: TaxItem[] = [
  { id: "ti1", competence: "Mar/2025", client: "Empresa ABC Ltda", taxType: "ISS", baseAmount: 7200, taxRate: 5, taxAmount: 360, status: "Calculado" },
  { id: "ti2", competence: "Mar/2025", client: "João Carlos Santos", taxType: "IRRF", baseAmount: 12800, taxRate: 11, taxAmount: 1408, status: "Conferido" },
  { id: "ti3", competence: "Fev/2025", client: "Pedro Alves Nogueira", taxType: "ISS", baseAmount: 5600, taxRate: 5, taxAmount: 280, status: "Exportado" },
  { id: "ti4", competence: "Fev/2025", client: "Marcos Costa Pereira", taxType: "IRRF", baseAmount: 4100, taxRate: 11, taxAmount: 451, status: "Conferido" },
  { id: "ti5", competence: "Mar/2025", client: "Ana Lima Rodrigues", taxType: "ISS", baseAmount: 3300, taxRate: 5, taxAmount: 165, status: "Calculado" },
  { id: "ti6", competence: "Jan/2025", client: "Claudia Ferreira", taxType: "CSLL", baseAmount: 2900, taxRate: 9, taxAmount: 261, status: "Exportado" },
];

// ─── Conciliação Bancária ─────────────────────────────────────────────────────

export const bankMovementsMock: BankMovement[] = [
  { id: "bm1", date: "25/03/2025", description: "TED — Empresa ABC Ltda", amount: 7200, type: "Crédito", status: "Conciliado" },
  { id: "bm2", date: "25/03/2025", description: "PIX — Contabilidade Oliveira", amount: 950, type: "Débito", status: "Conciliado" },
  { id: "bm3", date: "24/03/2025", description: "TED — Ana Lima Rodrigues (parcial)", amount: 1450, type: "Crédito", status: "Conciliado" },
  { id: "bm4", date: "23/03/2025", description: "Débito automático — Software Jurídico", amount: 890, type: "Débito", status: "Não conciliado" },
  { id: "bm5", date: "22/03/2025", description: "DOC — João Carlos Santos", amount: 5000, type: "Crédito", status: "Não conciliado" },
  { id: "bm6", date: "20/03/2025", description: "PIX — Correios Diligências", amount: 380, type: "Débito", status: "Conciliado" },
  { id: "bm7", date: "19/03/2025", description: "Crédito — Claudia Ferreira", amount: 1450, type: "Crédito", status: "Pendente" },
  { id: "bm8", date: "18/03/2025", description: "Tarifa bancária", amount: 210, type: "Débito", status: "Conciliado" },
];

// ─── Relatórios Gerenciais ─────────────────────────────────────────────────────

export const reportsMock: ReportCardItem[] = [
  { id: "rp1", title: "Contas a Receber", description: "Relatório completo de cobranças ativas, vencidas e liquidadas com filtro por cliente.", period: "Mar/2025", format: "PDF + Excel" },
  { id: "rp2", title: "Contas a Pagar", description: "Agenda de pagamentos, fornecedores e obrigações do período com status.", period: "Mar/2025", format: "PDF + Excel" },
  { id: "rp3", title: "Fluxo de Caixa", description: "Projeção mensal de entradas, saídas e saldo líquido do escritório.", period: "T1/2025", format: "PDF + Excel" },
  { id: "rp4", title: "DRE Gerencial", description: "Demonstração de resultado do exercício consolidado por área de atuação.", period: "Mar/2025", format: "PDF" },
  { id: "rp5", title: "Mapa de Retenções", description: "Tributos calculados, alíquotas aplicadas e status de conferência por competência.", period: "Mar/2025", format: "Excel" },
  { id: "rp6", title: "Inadimplência", description: "Análise de recebíveis vencidos, aging list e score de risco por cliente.", period: "Mar/2025", format: "PDF + Excel" },
  { id: "rp7", title: "Rentabilidade por Cliente", description: "Margem de contribuição, receita, custas e resultado líquido por cliente.", period: "T1/2025", format: "PDF" },
  { id: "rp8", title: "Repasses e Sócios", description: "Demonstrativo de distribuição de honorários entre participantes do escritório.", period: "Mar/2025", format: "PDF + Excel" },
];

// ─── Inteligência Financeira ──────────────────────────────────────────────────

export const insightsMock: InsightItem[] = [
  { id: "ins1", title: "Concentração de receita elevada", description: "67,3% da receita do trimestre está concentrada em apenas 3 clientes. Risco de carteira em caso de perda de um deles.", severity: "Alta" },
  { id: "ins2", title: "Inadimplência acima da meta", description: "Taxa de inadimplência de 23,4% no mês — acima da meta de 15%. João Carlos e Pedro Alves totalizam R$ 18.400 vencidos.", severity: "Alta" },
  { id: "ins3", title: "Margem operacional em crescimento", description: "Margem do mês (38,4%) está 4,2 p.p. acima do trimestre anterior. Redução de custas contribuiu para a melhora.", severity: "Média" },
  { id: "ins4", title: "Contratos próximos de renovação", description: "2 contratos vencem nos próximos 60 dias (Empresa ABC e Pedro Alves). Providenciar negociação preventiva.", severity: "Média" },
  { id: "ins5", title: "Tendência de caixa positiva", description: "Projeção de saldo positivo para os próximos 3 meses com base no histórico de recebimentos e despesas previstas.", severity: "Baixa" },
  { id: "ins6", title: "Repasse pendente há 25 dias", description: "Dra. Maria Helena aguarda repasse de R$ 2.550. Prazo contratual é de 30 dias após recebimento — a vencer em 5 dias.", severity: "Média" },
];

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const modulesMeta = {
  custas:      { title: "Custas, Depósitos e Alvarás",  subtitle: "Gestão processual-financeira.", icon: Landmark },
  repasses:    { title: "Repasses e Sócios",             subtitle: "Distribuição de honorários.", icon: Banknote },
  tributos:    { title: "Tributos e Retenções",          subtitle: "Acompanhamento fiscal.", icon: Calculator },
  conciliacao: { title: "Conciliação Bancária",          subtitle: "Conferência de extratos.", icon: CreditCard },
  relatorios:  { title: "Relatórios Gerenciais",         subtitle: "Relatórios executivos.", icon: FileBarChart2 },
  inteligencia:{ title: "Inteligência Financeira",       subtitle: "Insights estratégicos.", icon: Sparkles },
  config:      { title: "Configurações Financeiras",     subtitle: "Parâmetros do módulo.", icon: Settings2 },
  alert: AlertTriangle,
};
