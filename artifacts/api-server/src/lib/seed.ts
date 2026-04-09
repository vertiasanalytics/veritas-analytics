import { db } from "@workspace/db";
import {
  currencyTransitionsTable,
  monetaryCriteriaTable,
  monetaryCriteriaRulesTable,
  interestRulesTable,
  taxTablesTable,
} from "@workspace/db/schema";
import { eq, sql as drizzleSql } from "drizzle-orm";
import { parsePdfText, loadPdfAsset } from "../providers/pdfParser.js";

// ============================================================
// SEED: Transições Monetárias Históricas do Brasil
// Fonte: legislação oficial — Réis → Real
// ============================================================

const CURRENCY_TRANSITIONS = [
  {
    fromCurrency: "BRR",
    toCurrency: "CRZ",
    effectiveDate: "1942-11-01",
    conversionFactor: "1000",
    factorType: "divisor",
    legalNote: "Lei nº 4.791/1942 — substituição do Mil-Réis pelo Cruzeiro (1 Cruzeiro = 1000 Réis)",
    technicalNote: "Dividir valor em Réis por 1000 para obter Cruzeiros",
  },
  {
    fromCurrency: "CRZ",
    toCurrency: "NCR",
    effectiveDate: "1967-01-13",
    conversionFactor: "1000",
    factorType: "divisor",
    legalNote: "Decreto-Lei nº 1/1967 — Cruzeiro Novo (1 Cruzeiro Novo = 1000 Cruzeiros Antigos)",
    technicalNote: "Dividir valor em Cruzeiros por 1000 para obter Cruzeiros Novos",
  },
  {
    fromCurrency: "NCR",
    toCurrency: "CR2",
    effectiveDate: "1970-05-15",
    conversionFactor: "1",
    factorType: "multiplicador",
    legalNote: "Lei nº 5.577/1969 — renomeação de Cruzeiro Novo para Cruzeiro (sem conversão)",
    technicalNote: "Renomeação pura — fator de conversão 1:1",
  },
  {
    fromCurrency: "CR2",
    toCurrency: "CZL",
    effectiveDate: "1986-02-28",
    conversionFactor: "1000",
    factorType: "divisor",
    legalNote: "Decreto-Lei nº 2.283/1986 (Plano Cruzado) — 1 Cruzado = 1000 Cruzeiros",
    technicalNote: "Dividir valor em Cruzeiros por 1000 para obter Cruzados",
  },
  {
    fromCurrency: "CZL",
    toCurrency: "NCZ",
    effectiveDate: "1989-01-16",
    conversionFactor: "1000",
    factorType: "divisor",
    legalNote: "Decreto-Lei nº 1/1989 (Plano Verão) — 1 Cruzado Novo = 1000 Cruzados",
    technicalNote: "Dividir valor em Cruzados por 1000 para obter Cruzados Novos",
  },
  {
    fromCurrency: "NCZ",
    toCurrency: "CR3",
    effectiveDate: "1990-03-16",
    conversionFactor: "1",
    factorType: "multiplicador",
    legalNote: "Lei nº 8.024/1990 (Plano Collor) — 1 Cruzeiro = 1 Cruzado Novo (renomeação)",
    technicalNote: "Renomeação pura — fator de conversão 1:1",
  },
  {
    fromCurrency: "CR3",
    toCurrency: "CRR",
    effectiveDate: "1993-08-01",
    conversionFactor: "1000",
    factorType: "divisor",
    legalNote: "Medida Provisória nº 336/1993 — 1 Cruzeiro Real = 1000 Cruzeiros",
    technicalNote: "Dividir valor em Cruzeiros por 1000 para obter Cruzeiros Reais",
  },
  {
    fromCurrency: "CRR",
    toCurrency: "BRL",
    effectiveDate: "1994-07-01",
    conversionFactor: "2750",
    factorType: "divisor",
    legalNote: "Medida Provisória nº 542/1994 (Plano Real) — 1 Real = 2750 Cruzeiros Reais (pela URV: 1 URV = 2750 CRR; 1 Real = 1 URV)",
    technicalNote: "Dividir valor em Cruzeiros Reais por 2750 para obter Reais",
  },
];

// ============================================================
// SEED: Critérios Monetários com Regras
// PONTO DE HOMOLOGAÇÃO: Verificar sequências com especialista jurídico
// ============================================================

const MONETARY_CRITERIA = [
  {
    code: "NONE",
    name: "Sem Correção Monetária",
    description: "Não aplica qualquer índice de correção monetária",
    hasSelic: false,
    hasSelicAfterCitation: false,
    selicStartDate: null,
    allowDeflation: false,
    sortOrder: 0,
    notes: null,
    rules: [],
  },
  {
    code: "CONDENAT_GERAL",
    name: "Ações Condenatórias em Geral",
    description: "Correção monetária para ações condenatórias gerais. IPCA-E até nov/2021 e SELIC a partir de dez/2021 (STJ/STF).",
    hasSelic: true,
    hasSelicAfterCitation: false,
    selicStartDate: "2021-12",
    allowDeflation: false,
    sortOrder: 1,
    notes: "PONTO DE HOMOLOGAÇÃO: Verificar precedentes STJ/STF vigentes",
    rules: [
      { indexCode: "IPCA_E", startDate: "1999-01-01", endDate: "2021-11-30", description: "IPCA-E até nov/2021", legalBasis: "Teses STJ/STF", sortOrder: 1 },
      { indexCode: "SELIC", startDate: "2021-12-01", endDate: null, description: "SELIC a partir de dez/2021", legalBasis: "RE 1.346.060/STF — Tema 1241", sortOrder: 2 },
    ],
  },
  {
    code: "IPCA_E",
    name: "IPCA-E (Índice Puro)",
    description: "Aplica exclusivamente o IPCA-E em todo o período",
    hasSelic: false,
    hasSelicAfterCitation: false,
    selicStartDate: null,
    allowDeflation: false,
    sortOrder: 2,
    notes: null,
    rules: [
      { indexCode: "IPCA_E", startDate: "1995-01-01", endDate: null, description: "IPCA-E em todo o período", legalBasis: null, sortOrder: 1 },
    ],
  },
  {
    code: "PREV_I",
    name: "Previdenciário I",
    description: "Critério para ações previdenciárias: ORTN/OTN → BTN/TR → IRSM → IPC-r → INPC → IPCA-E → SELIC.",
    hasSelic: true,
    hasSelicAfterCitation: false,
    selicStartDate: "2021-12",
    allowDeflation: false,
    sortOrder: 3,
    notes: "PONTO DE HOMOLOGAÇÃO: Verificar Manual de Cálculos da Justiça Federal — Previdenciário",
    rules: [
      { indexCode: "ORTN_OTN", startDate: "1964-01-01", endDate: "1989-01-31", description: "ORTN/OTN", legalBasis: "Histórico", sortOrder: 1 },
      { indexCode: "BTN_TR", startDate: "1989-02-01", endDate: "1992-12-31", description: "BTN/TR", legalBasis: "Lei 7.777/89 e ss.", sortOrder: 2 },
      { indexCode: "IRSM", startDate: "1993-01-01", endDate: "1993-11-30", description: "IRSM", legalBasis: "MP 336/93", sortOrder: 3 },
      { indexCode: "IPC_R", startDate: "1993-12-01", endDate: "1994-06-30", description: "IPC-r", legalBasis: "Lei 8.880/94", sortOrder: 4 },
      { indexCode: "INPC", startDate: "1994-07-01", endDate: "1996-04-30", description: "INPC", legalBasis: "MP 1.053/95", sortOrder: 5 },
      { indexCode: "IPCA_E", startDate: "1996-05-01", endDate: "2021-11-30", description: "IPCA-E", legalBasis: "Manual CJF / STJ", sortOrder: 6 },
      { indexCode: "SELIC", startDate: "2021-12-01", endDate: null, description: "SELIC", legalBasis: "RE 1.346.060/STF — Tema 1241", sortOrder: 7 },
    ],
  },
  {
    code: "PREV_II",
    name: "Previdenciário II",
    description: "Critério previdenciário com TR até jun/2009 e INPC a partir de jul/2009.",
    hasSelic: true,
    hasSelicAfterCitation: false,
    selicStartDate: "2021-12",
    allowDeflation: false,
    sortOrder: 4,
    notes: "PONTO DE HOMOLOGAÇÃO: Verificar Manual CJF",
    rules: [
      { indexCode: "TR", startDate: "1992-01-01", endDate: "2009-06-30", description: "TR até jun/2009", legalBasis: "Manual CJF", sortOrder: 1 },
      { indexCode: "INPC", startDate: "2009-07-01", endDate: "2021-11-30", description: "INPC a partir de jul/2009", legalBasis: "Manual CJF / Lei 11.960/09", sortOrder: 2 },
      { indexCode: "SELIC", startDate: "2021-12-01", endDate: null, description: "SELIC", legalBasis: "RE 1.346.060/STF — Tema 1241", sortOrder: 3 },
    ],
  },
  {
    code: "PREV_III",
    name: "Previdenciário III",
    description: "Critério previdenciário com INPC em todo o período a partir de jul/1994.",
    hasSelic: true,
    hasSelicAfterCitation: false,
    selicStartDate: "2021-12",
    allowDeflation: false,
    sortOrder: 5,
    notes: "PONTO DE HOMOLOGAÇÃO: Verificar Manual CJF",
    rules: [
      { indexCode: "INPC", startDate: "1994-07-01", endDate: "2021-11-30", description: "INPC", legalBasis: "Manual CJF", sortOrder: 1 },
      { indexCode: "SELIC", startDate: "2021-12-01", endDate: null, description: "SELIC", legalBasis: "RE 1.346.060/STF — Tema 1241", sortOrder: 2 },
    ],
  },
  {
    code: "TRIBUTARIO",
    name: "Tributário",
    description: "Correção monetária em matéria tributária com SELIC como único índice.",
    hasSelic: true,
    hasSelicAfterCitation: false,
    selicStartDate: null,
    allowDeflation: false,
    sortOrder: 6,
    notes: "PONTO DE HOMOLOGAÇÃO: Verificar CTN Art. 161 e legislação aplicável",
    rules: [
      { indexCode: "SELIC", startDate: "1995-01-01", endDate: null, description: "SELIC (correção + juros unificados)", legalBasis: "Art. 13 Lei 9.065/95", sortOrder: 1 },
    ],
  },
];

// ============================================================
// SEED: Regras de Juros
// ============================================================

const INTEREST_RULES = [
  {
    code: "NONE",
    name: "Sem Juros Moratórios",
    description: "Não aplica juros moratórios",
    interestType: "none" as const,
    annualRate: null,
    monthlyRate: null,
    legalBasis: null,
    sortOrder: 0,
    notes: null,
  },
  {
    code: "SIMPLE_6_YEAR",
    name: "6% a.a. (simples)",
    description: "Juros moratórios simples de 6% ao ano (0,5% ao mês)",
    interestType: "simple" as const,
    annualRate: "6.000000",
    monthlyRate: "0.500000",
    legalBasis: "Art. 1.062 CC/1916; Art. 406 CC/2002 c/c art. 161 §1º CTN (histórico)",
    sortOrder: 1,
    notes: null,
  },
  {
    code: "SIMPLE_12_YEAR",
    name: "12% a.a. (simples)",
    description: "Juros moratórios simples de 12% ao ano (1% ao mês)",
    interestType: "simple" as const,
    annualRate: "12.000000",
    monthlyRate: "1.000000",
    legalBasis: "Art. 406 CC/2002 — taxa legal",
    sortOrder: 2,
    notes: null,
  },
  {
    code: "SIMPLE_1_MONTH",
    name: "1% ao mês (simples)",
    description: "Juros moratórios simples de 1% ao mês",
    interestType: "simple" as const,
    annualRate: "12.000000",
    monthlyRate: "1.000000",
    legalBasis: "Art. 406 CC/2002",
    sortOrder: 3,
    notes: null,
  },
  {
    code: "SAVINGS",
    name: "Poupança",
    description: "Juros moratórios pela taxa da poupança (TR + 0,5% a.m. ou 70% da SELIC)",
    interestType: "savings" as const,
    annualRate: null,
    monthlyRate: null,
    legalBasis: "Art. 1°-F da Lei 9.494/97 com redação da Lei 11.960/09",
    sortOrder: 4,
    notes: "PONTO DE HOMOLOGAÇÃO: Verificar constitucionalidade após ADI 4.357/STF",
  },
  {
    code: "SELIC",
    name: "SELIC",
    description: "Juros moratórios pela taxa SELIC (inclui correção + juros)",
    interestType: "selic" as const,
    annualRate: null,
    monthlyRate: null,
    legalBasis: "RE 1.346.060/STF — Tema 1241 (pós dez/2021)",
    sortOrder: 5,
    notes: "PONTO DE HOMOLOGAÇÃO: Verificar se aplica isolada ou combinada com correção",
  },
  {
    code: "LEGAL_RATE",
    name: "Taxa Legal (art. 406 CC)",
    description: "Juros pela taxa que estiver em vigor para a mora do pagamento de impostos (SELIC ou 1% a.m.)",
    interestType: "legal" as const,
    annualRate: null,
    monthlyRate: null,
    legalBasis: "Art. 406 CC/2002",
    sortOrder: 6,
    notes: "PONTO DE HOMOLOGAÇÃO: Taxa historicamente variável — verificar período",
  },
  {
    code: "MIXED_6_12",
    name: "6% a.a. até CC/2002, 12% a.a. depois",
    description: "6% ao ano (Código Civil 1916) até 10/01/2003; 12% ao ano (CC/2002) após",
    interestType: "mixed_historical" as const,
    annualRate: null,
    monthlyRate: null,
    legalBasis: "CC/1916 art. 1.062 e CC/2002 art. 406",
    sortOrder: 7,
    notes: "PONTO DE HOMOLOGAÇÃO: Verificar data de vigência do CC/2002",
  },
  {
    code: "JUROS_POUPANCA_CONDENAT",
    name: "Poupança — Ações Condenatórias (Manual CJF)",
    description: "0,5% a.m. até 07/2009; Juros da Poupança de 08/2009 a 11/2021; SELIC a partir de 12/2021. Conforme Manual de Cálculos CJF 2025 e EC 113/2021.",
    interestType: "savings" as const,
    annualRate: null,
    monthlyRate: null,
    legalBasis: "Art. 1°-F Lei 9.494/97 c/c Lei 11.960/09; EC 113/2021; STF Tema 1.244",
    sortOrder: 8,
    notes: "Regra principal para Ações Condenatórias em Geral — Fazenda Pública",
  },
  {
    code: "JUROS_POUPANCA_PREV",
    name: "Poupança — Benefícios Previdenciários (Manual CJF)",
    description: "1% a.m. até 06/2009; 0,5% a.m. de 07/2009 a 04/2012; Juros da Poupança de 05/2012 a 11/2021; SELIC a partir de 12/2021. Conforme Manual CJF 2025.",
    interestType: "savings" as const,
    annualRate: null,
    monthlyRate: null,
    legalBasis: "Lei 8.213/91 Art. 43; Art. 1°-F Lei 9.494/97 c/c Lei 11.960/09; EC 113/2021",
    sortOrder: 9,
    notes: "Regra principal para Benefícios Previdenciários — Fazenda Pública",
  },
  // ─── Regras Projef Web (lista completa) ──────────────────────
  {
    code: "JUROS_12_07_09_POUPANCA",
    name: "12% a.a. até 07/09 e Juros Poupança",
    description: "12% a.a. (1% ao mês) até 07/2009; Juros da Poupança de 08/2009 a 11/2021; SELIC a partir de 12/2021.",
    interestType: "mixed_historical" as const,
    annualRate: "12.000000",
    monthlyRate: "1.000000",
    legalBasis: "Art. 1°-F Lei 9.494/97 c/c Lei 11.960/09; EC 113/2021",
    sortOrder: 10,
    notes: null,
  },
  {
    code: "JUROS_6_07_09_ZERO",
    name: "6% a.a. até 07/09 e 0%",
    description: "6% a.a. (0,5% ao mês) até 07/2009; sem juros a partir de 08/2009.",
    interestType: "mixed_historical" as const,
    annualRate: "6.000000",
    monthlyRate: "0.500000",
    legalBasis: "Art. 1°-F Lei 9.494/97 c/c Lei 11.960/09",
    sortOrder: 11,
    notes: null,
  },
  {
    code: "JUROS_12_07_09_ZERO",
    name: "12% a.a. até 07/09 e 0%",
    description: "12% a.a. (1% ao mês) até 07/2009; sem juros a partir de 08/2009.",
    interestType: "mixed_historical" as const,
    annualRate: "12.000000",
    monthlyRate: "1.000000",
    legalBasis: "Art. 1°-F Lei 9.494/97 c/c Lei 11.960/09",
    sortOrder: 12,
    notes: null,
  },
  {
    code: "JUROS_12_08_01_6_07_09_POUPANCA",
    name: "12% a.a. até 08/01, 6% a.a. até 07/09 e Juros Poupança",
    description: "12% a.a. até 08/2001; 6% a.a. de 09/2001 a 07/2009; Juros da Poupança de 08/2009 a 11/2021; SELIC a partir de 12/2021.",
    interestType: "mixed_historical" as const,
    annualRate: null,
    monthlyRate: null,
    legalBasis: "Art. 1°-F Lei 9.494/97 c/c Lei 11.960/09; EC 113/2021",
    sortOrder: 13,
    notes: null,
  },
  {
    code: "JUROS_6_12_02_12_07_09_POUPANCA",
    name: "6% a.a. até 12/02, 12% a.a. até 07/09 e Juros Poupança",
    description: "6% a.a. até 12/2002; 12% a.a. (CC/2002) de 01/2003 a 07/2009; Juros da Poupança de 08/2009 a 11/2021; SELIC a partir de 12/2021.",
    interestType: "mixed_historical" as const,
    annualRate: null,
    monthlyRate: null,
    legalBasis: "CC/1916 art. 1.062; CC/2002 art. 406; Art. 1°-F Lei 9.494/97 c/c Lei 11.960/09; EC 113/2021",
    sortOrder: 14,
    notes: null,
  },
  {
    code: "JUROS_12_08_24_TAXA_LEGAL",
    name: "12% a.a.(1% ao mês) até 08/24 - Taxa Legal (Lei 14.905/24)",
    description: "12% a.a. (1% ao mês) até 08/2024; Taxa Legal conforme Lei 14.905/24 (SELIC − 1 p.p.) a partir de 09/2024.",
    interestType: "legal" as const,
    annualRate: "12.000000",
    monthlyRate: "1.000000",
    legalBasis: "Lei 14.905/2024 art. 1°; CC/2002 art. 406",
    sortOrder: 15,
    notes: "PONTO DE HOMOLOGAÇÃO: Verificar aplicação após vigência da Lei 14.905/24 (setembro/2024)",
  },
];

// ============================================================
// FUNÇÃO PRINCIPAL DE SEED
// ============================================================

export async function seedDatabase(): Promise<void> {
  console.log("[seed] Verificando e inserindo dados iniciais...");

  // 1. Transições monetárias
  const existingTransitions = await db.select().from(currencyTransitionsTable).limit(1);
  if (existingTransitions.length === 0) {
    console.log("[seed] Inserindo transições monetárias históricas...");
    await db.insert(currencyTransitionsTable).values(CURRENCY_TRANSITIONS);
    console.log(`[seed] ${CURRENCY_TRANSITIONS.length} transições monetárias inseridas`);
  } else {
    console.log("[seed] Transições monetárias já existem — pulando");
  }

  // 2. Critérios monetários
  const existingCriteria = await db.select().from(monetaryCriteriaTable).limit(1);
  if (existingCriteria.length === 0) {
    console.log("[seed] Inserindo critérios monetários...");
    for (const c of MONETARY_CRITERIA) {
      const { rules, ...criteriaData } = c;
      const [inserted] = await db
        .insert(monetaryCriteriaTable)
        .values(criteriaData)
        .returning({ id: monetaryCriteriaTable.id });

      if (rules.length > 0) {
        await db.insert(monetaryCriteriaRulesTable).values(
          rules.map((r) => ({ ...r, criteriaId: inserted.id }))
        );
      }
    }
    console.log(`[seed] ${MONETARY_CRITERIA.length} critérios monetários inseridos`);
  } else {
    console.log("[seed] Critérios monetários já existem — pulando");
  }

  // 3. Regras de juros (upsert por código — permite adicionar novas regras)
  console.log("[seed] Verificando regras de juros (upsert)...");
  let rulesInserted = 0;
  for (const rule of INTEREST_RULES) {
    const existing = await db.select().from(interestRulesTable)
      .where(eq(interestRulesTable.code, rule.code)).limit(1);
    if (existing.length === 0) {
      await db.insert(interestRulesTable).values(rule);
      rulesInserted++;
    }
  }
  if (rulesInserted > 0) {
    console.log(`[seed] ${rulesInserted} novas regras de juros inseridas`);
  } else {
    console.log("[seed] Regras de juros já atualizadas");
  }

  // 4. Importação automática da Tabela TRF1 (PDF oficial)
  try {
    const existingPdf = await db.execute(drizzleSql`
      SELECT COUNT(*) AS cnt FROM pdf_historical_indexes
    `);
    const cnt = Number((existingPdf.rows[0] as { cnt: string }).cnt ?? 0);

    if (cnt === 0) {
      console.log("[seed] Importando Tabela de Índices TRF1 (PDF oficial)...");
      const text   = loadPdfAsset();
      const result = parsePdfText(text);

      let inserted = 0;
      for (const rec of result.records) {
        await db.execute(drizzleSql`
          INSERT INTO pdf_historical_indexes (periodo, indice_tipo, coef_em_real)
          VALUES (${rec.periodo}, ${rec.indiceTipo}, ${rec.coefEmReal})
          ON CONFLICT (periodo, indice_tipo) DO NOTHING
        `);
        inserted++;
      }

      const types = Object.entries(result.byType)
        .map(([t, n]) => `${t}:${n}`)
        .join(" ");
      console.log(`[seed] PDF TRF1 importado: ${inserted} registros (${types})`);
      if (result.warnings.length > 0) {
        console.warn(`[seed] PDF warnings: ${result.warnings.length}`);
      }
    } else {
      console.log(`[seed] Tabela TRF1 já importada (${cnt} registros) — pulando`);
    }
  } catch (err) {
    console.warn("[seed] Falha ao importar PDF TRF1:", err);
  }

  // 5. Seed admin user (se não existir nenhum usuário)
  try {
    const countResult = await db.execute(drizzleSql`SELECT COUNT(*) AS cnt FROM users`);
    const userCount = Number((countResult.rows[0] as { cnt: string }).cnt ?? 0);
    if (userCount === 0) {
      const bcrypt = await import("bcryptjs");
      const { users: usersTable } = await import("@workspace/db/schema");
      const hash = await bcrypt.hash("veritas@2026", 10);
      await db.insert(usersTable).values({
        nome: "Administrador",
        email: "admin@veritasanalytics.com.br",
        senhaHash: hash,
        role: "admin",
        tipoPessoa: "PJ",
        profissao: "Administrador do Sistema",
      });
      console.log("[seed] Usuário admin criado: admin@veritasanalytics.com.br / veritas@2026");
    }
  } catch (err) {
    console.warn("[seed] Falha ao criar admin:", err);
  }

  // 6. Seed dos Planos Comerciais
  try {
    const existing = await db.execute(drizzleSql`SELECT COUNT(*) AS cnt FROM plans`);
    const cnt = Number((existing.rows[0] as { cnt: string }).cnt ?? 0);
    if (cnt === 0) {
      await db.execute(drizzleSql`
        INSERT INTO plans (name, slug, price_monthly, credits_monthly, max_users, description, active, display_order) VALUES
          ('Essencial',     'essencial',     154.70, 100, 1,  'Ideal para advogados solos. 100 créditos mensais, 1 usuário.',  TRUE, 1),
          ('Profissional',  'profissional',  259.95, 250, 5,  'Para escritórios pequenos. 250 créditos mensais, até 5 usuários.', TRUE, 2),
          ('Avançado',      'avancado',      470.43, 600, 10, 'Para escritórios médios. 600 créditos mensais, até 10 usuários.', TRUE, 3)
        ON CONFLICT (slug) DO NOTHING
      `);
      console.log("[seed] 3 planos comerciais inseridos");
    } else {
      console.log("[seed] Planos já existem — pulando");
    }
  } catch (err) {
    console.warn("[seed] Falha ao criar planos:", err);
  }

  // 7. Seed das Tabelas Fiscais INSS / IRRF 2025
  try {
    const existingTax = await db.select().from(taxTablesTable).limit(1);
    if (existingTax.length === 0) {
      console.log("[seed] Inserindo tabelas fiscais INSS/IRRF 2025...");
      await db.insert(taxTablesTable).values([
        {
          type: "inss",
          vigencia: "2025-01",
          label: "INSS Progressivo 2025 (RPS nº 6/2024)",
          notes: "Tabela progressiva conforme RPS nº 6/2024 — vigência jan/2025",
          faixas: [
            { limite: 1518.00,  aliquota: 0.075, descricao: "Até R$ 1.518,00" },
            { limite: 2793.88,  aliquota: 0.09,  descricao: "De R$ 1.518,01 a R$ 2.793,88" },
            { limite: 4190.83,  aliquota: 0.12,  descricao: "De R$ 2.793,89 a R$ 4.190,83" },
            { limite: 8157.41,  aliquota: 0.14,  descricao: "De R$ 4.190,84 a R$ 8.157,41" },
          ] as any,
          ativo: true,
          createdBy: null,
        },
        {
          type: "irrf",
          vigencia: "2025-01",
          label: "IRRF 2025 (RIR / IN RFB 2.178/2024)",
          notes: "Tabela progressiva IRRF conforme RIR art. 677 e IN RFB 2.178/2024 — vigência jan/2025",
          faixas: [
            { limite: 2428.80,  aliquota: 0,     deducao: 0,       descricao: "Isento — até R$ 2.428,80" },
            { limite: 2826.65,  aliquota: 0.075, deducao: 182.16,  descricao: "7,5% — de R$ 2.428,81 a R$ 2.826,65" },
            { limite: 3751.05,  aliquota: 0.15,  deducao: 394.16,  descricao: "15% — de R$ 2.826,66 a R$ 3.751,05" },
            { limite: 4664.68,  aliquota: 0.225, deducao: 675.49,  descricao: "22,5% — de R$ 3.751,06 a R$ 4.664,68" },
            { limite: 9_999_999, aliquota: 0.275, deducao: 908.74, descricao: "27,5% — acima de R$ 4.664,68" },
          ] as any,
          ativo: true,
          createdBy: null,
        },
      ]);
      console.log("[seed] Tabelas INSS/IRRF 2025 inseridas");
    } else {
      console.log("[seed] Tabelas fiscais já existem — pulando");
    }
  } catch (err) {
    console.warn("[seed] Falha ao inserir tabelas fiscais:", err);
  }

  console.log("[seed] Seed concluído");
}
