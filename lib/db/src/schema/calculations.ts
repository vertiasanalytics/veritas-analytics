import { pgTable, serial, text, numeric, timestamp, integer, jsonb, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ============================================================
// ENUMS LEGADOS (mantidos para compatibilidade)
// ============================================================

export const calculationStatusEnum = pgEnum("calculation_status", [
  "draft",
  "calculated",
  "saved",
  "report_generated",
]);

export const correctionIndexEnum = pgEnum("correction_index", [
  "IPCA",
  "IPCA_E",
  "INPC",
  "SELIC",
  "TR",
  "MANUAL",
]);

export const interestRuleEnum = pgEnum("interest_rule", [
  "none",
  "simple_1_percent",
  "compound_selic",
  "compound_12_percent_year",
  "manual",
]);

// ============================================================
// ENUMS NOVOS
// ============================================================

export const caseStatusEnum = pgEnum("case_status", [
  "draft",
  "in_progress",
  "computed",
  "finalized",
  "report_generated",
]);

export const interestTypeEnum = pgEnum("interest_type", [
  "none",
  "simple",
  "compound",
  "savings",
  "selic",
  "legal",
  "mixed_historical",
]);

export const feesBaseEnum = pgEnum("fees_base", [
  "none",
  "condemnation_value",
  "cause_value",
  "fixed_value",
  "condemnation_no_discount",
  "condemnation_with_discount_limit",
]);

// ============================================================
// TABELAS LEGADAS (mantidas para compatibilidade)
// ============================================================

export const calculationsTable = pgTable("calculations", {
  id: serial("id").primaryKey(),
  publicKey: text("public_key").notNull().unique(),
  title: text("title").notNull(),
  processNumber: text("process_number"),
  claimantName: text("claimant_name"),
  notes: text("notes"),
  originalValue: numeric("original_value", { precision: 18, scale: 6 }).notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  correctionIndex: correctionIndexEnum("correction_index").notNull(),
  interestRule: interestRuleEnum("interest_rule").notNull(),
  calculatedValue: numeric("calculated_value", { precision: 18, scale: 6 }),
  status: calculationStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const calculationVersionsTable = pgTable("calculation_versions", {
  id: serial("id").primaryKey(),
  calculationId: integer("calculation_id").notNull().references(() => calculationsTable.id),
  version: integer("version").notNull(),
  originalValue: numeric("original_value", { precision: 18, scale: 6 }).notNull(),
  calculatedValue: numeric("calculated_value", { precision: 18, scale: 6 }).notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  correctionIndex: text("correction_index").notNull(),
  interestRule: text("interest_rule").notNull(),
  accumulatedFactor: numeric("accumulated_factor", { precision: 18, scale: 10 }).notNull(),
  integrityHash: text("integrity_hash").notNull(),
  computedAt: timestamp("computed_at").defaultNow().notNull(),
  resultSnapshot: jsonb("result_snapshot"),
  notes: text("notes"),
});

export const officialIndexesCacheTable = pgTable("official_indexes_cache", {
  id: serial("id").primaryKey(),
  indexType: text("index_type").notNull(),
  period: text("period").notNull(),
  rate: numeric("rate", { precision: 18, scale: 10 }).notNull(),
  source: text("source").notNull(),
  sourceType: text("source_type"),
  originUrl: text("origin_url"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

export const generatedReportsTable = pgTable("generated_reports", {
  id: serial("id").primaryKey(),
  calculationId: integer("calculation_id").notNull().references(() => calculationsTable.id),
  format: text("format").notNull(),
  htmlContent: text("html_content"),
  filePath: text("file_path"),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id"),
  indexType: text("index_type"),
  source: text("source"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// TRANSIÇÕES MONETÁRIAS HISTÓRICAS DO BRASIL
// ============================================================

export const currencyTransitionsTable = pgTable("currency_transitions", {
  id: serial("id").primaryKey(),
  fromCurrency: text("from_currency").notNull(),
  toCurrency: text("to_currency").notNull(),
  effectiveDate: text("effective_date").notNull(),
  conversionFactor: numeric("conversion_factor", { precision: 24, scale: 12 }).notNull(),
  factorType: text("factor_type").notNull().default("divisor"),
  legalNote: text("legal_note"),
  technicalNote: text("technical_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// CRITÉRIOS MONETÁRIOS PARAMETRIZADOS
// ============================================================

export const monetaryCriteriaTable = pgTable("monetary_criteria", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  hasSelic: boolean("has_selic").notNull().default(false),
  hasSelicAfterCitation: boolean("has_selic_after_citation").notNull().default(false),
  selicStartDate: text("selic_start_date"),
  allowDeflation: boolean("allow_deflation").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const monetaryCriteriaRulesTable = pgTable("monetary_criteria_rules", {
  id: serial("id").primaryKey(),
  criteriaId: integer("criteria_id").notNull().references(() => monetaryCriteriaTable.id),
  indexCode: text("index_code").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  description: text("description"),
  legalBasis: text("legal_basis"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ============================================================
// REGRAS DE JUROS MORATÓRIOS
// ============================================================

export const interestRulesTable = pgTable("interest_rules", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  interestType: interestTypeEnum("interest_type").notNull(),
  annualRate: numeric("annual_rate", { precision: 10, scale: 6 }),
  monthlyRate: numeric("monthly_rate", { precision: 10, scale: 6 }),
  legalBasis: text("legal_basis"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// CALCULATION CASES — Entidade principal
// ============================================================

export const calculationCasesTable = pgTable("calculation_cases", {
  id: serial("id").primaryKey(),
  publicKey: text("public_key").notNull().unique(),
  status: caseStatusEnum("case_status").notNull().default("draft"),
  integrityHash: text("integrity_hash"),
  computedAt: timestamp("computed_at"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// ABA 1 — DADOS DO PROCESSO
// ============================================================

export const processDataTable = pgTable("process_data", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => calculationCasesTable.id).unique(),
  forPaymentRequest: boolean("for_payment_request").notNull().default(false),
  processNumber: text("process_number"),
  claimant: text("claimant"),
  defendant: text("defendant"),
  agreementPercentage: numeric("agreement_percentage", { precision: 6, scale: 2 }),
  generalNotes: text("general_notes"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// ABA 2 — CORREÇÃO MONETÁRIA
// ============================================================

export const caseMonetaryConfigTable = pgTable("case_monetary_config", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => calculationCasesTable.id).unique(),
  criteriaId: integer("criteria_id").references(() => monetaryCriteriaTable.id),
  baseDate: text("base_date"),
  applySelicFrom: text("apply_selic_from"),
  selicFromCitation: boolean("selic_from_citation").notNull().default(false),
  allowDeflation: boolean("allow_deflation").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// ABA 3 — JUROS MORATÓRIOS
// ============================================================

export const caseInterestConfigTable = pgTable("case_interest_config", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => calculationCasesTable.id).unique(),
  interestRuleId: integer("interest_rule_id").references(() => interestRulesTable.id),
  startDate: text("start_date"),
  startEvent: text("start_event").notNull().default("citacao"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// ABA 4 — PARTES
// ============================================================

export const partiesTable = pgTable("parties", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => calculationCasesTable.id),
  name: text("name").notNull(),
  cpfCnpj: text("cpf_cnpj"),
  contractualFeesPct: numeric("contractual_fees_pct", { precision: 6, scale: 2 }),
  contractualFeesBeneficiaryCpfCnpj: text("contractual_fees_beneficiary_cpf_cnpj"),
  pssMode: text("pss_mode").notNull().default("none"),
  totalPrincipal: numeric("total_principal", { precision: 18, scale: 6 }),
  totalInterest: numeric("total_interest", { precision: 18, scale: 6 }),
  totalSelic: numeric("total_selic", { precision: 18, scale: 6 }),
  totalUpdated: numeric("total_updated", { precision: 18, scale: 6 }),
  installmentCount: integer("installment_count").notNull().default(0),
  discountCount: integer("discount_count").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// PARCELAS
// ============================================================

export const partyInstallmentsTable = pgTable("party_installments", {
  id: serial("id").primaryKey(),
  partyId: integer("party_id").notNull().references(() => partiesTable.id),
  period: text("period").notNull(),
  principalAmount: numeric("principal_amount", { precision: 18, scale: 6 }).notNull(),
  selicAmount: numeric("selic_amount", { precision: 18, scale: 6 }),
  interestAmount: numeric("interest_amount", { precision: 18, scale: 6 }),
  fixedInterestFrom: text("fixed_interest_from"),
  originalCurrency: text("original_currency").notNull().default("BRL"),
  originalAmountInCurrency: numeric("original_amount_in_currency", { precision: 24, scale: 10 }),
  updatedPrincipal: numeric("updated_principal", { precision: 18, scale: 6 }),
  updatedInterest: numeric("updated_interest", { precision: 18, scale: 6 }),
  updatedSelic: numeric("updated_selic", { precision: 18, scale: 6 }),
  totalUpdated: numeric("total_updated", { precision: 18, scale: 6 }),
  accumulatedFactor: numeric("accumulated_factor", { precision: 18, scale: 10 }),
  currencyFactor: numeric("currency_factor", { precision: 24, scale: 12 }),
  correctionFactor: numeric("correction_factor", { precision: 18, scale: 10 }),
  currencyConversionHistory: jsonb("currency_conversion_history"),
  correctionMemory: jsonb("correction_memory"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// LOG DE CONVERSÕES MONETÁRIAS
// ============================================================

export const currencyConversionLogsTable = pgTable("currency_conversion_logs", {
  id: serial("id").primaryKey(),
  installmentId: integer("installment_id").notNull().references(() => partyInstallmentsTable.id),
  originalCurrency: text("original_currency").notNull(),
  convertedCurrency: text("converted_currency").notNull(),
  transitionDate: text("transition_date").notNull(),
  appliedFactor: numeric("applied_factor", { precision: 24, scale: 12 }).notNull(),
  amountBefore: numeric("amount_before", { precision: 24, scale: 10 }).notNull(),
  amountAfter: numeric("amount_after", { precision: 24, scale: 10 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// DESCONTOS POR PARTE
// ============================================================

export const partyDiscountsTable = pgTable("party_discounts", {
  id: serial("id").primaryKey(),
  partyId: integer("party_id").notNull().references(() => partiesTable.id),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
  date: text("date"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// ABA 5 — HONORÁRIOS ADVOCATÍCIOS
// ============================================================

export const succumbentialFeesTable = pgTable("succumbential_fees", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => calculationCasesTable.id),
  feesType: text("fees_type").notNull().default("succumbential"),
  scaledForPublicEntity: boolean("scaled_for_public_entity").notNull().default(false),
  calcMode: feesBaseEnum("fees_base").notNull().default("none"),
  percentage: numeric("percentage", { precision: 6, scale: 2 }),
  fixedValue: numeric("fixed_value", { precision: 18, scale: 6 }),
  discountLimit: numeric("discount_limit", { precision: 18, scale: 6 }),
  scalingRanges: jsonb("scaling_ranges"),
  computedAmount: numeric("computed_amount", { precision: 18, scale: 6 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// ABA 6 — OUTRAS SUCUMBÊNCIAS
// ============================================================

export const otherSuccumbenciesTable = pgTable("other_succumbencies", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => calculationCasesTable.id),
  type: text("type").notNull(),
  cpfCnpj: text("cpf_cnpj"),
  description: text("description"),
  date: text("date"),
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
  apply10PctFine: boolean("apply_10pct_fine").notNull().default(false),
  apply10PctFees: boolean("apply_10pct_fees").notNull().default(false),
  useAlternativeCriteria: boolean("use_alternative_criteria").notNull().default(false),
  alternativeCriteriaId: integer("alternative_criteria_id").references(() => monetaryCriteriaTable.id),
  computedAmount: numeric("computed_amount", { precision: 18, scale: 6 }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// ABA 7 — DADOS FINAIS
// ============================================================

export const finalMetadataTable = pgTable("final_metadata", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => calculationCasesTable.id).unique(),
  preparedBy: text("prepared_by"),
  institution: text("institution"),
  city: text("city"),
  stateUf: text("state_uf"),
  finalNotes: text("final_notes"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// RELATÓRIOS DO CASE
// ============================================================

export const caseReportsTable = pgTable("case_reports", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => calculationCasesTable.id),
  format: text("format").notNull().default("html"),
  htmlContent: text("html_content"),
  filePath: text("file_path"),
  totalAmount: numeric("total_amount", { precision: 18, scale: 6 }),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

// ============================================================
// AUDITORIA DO CASE
// ============================================================

export const caseAuditLogsTable = pgTable("case_audit_logs", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").references(() => calculationCasesTable.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// INSERT SCHEMAS (Zod)
// ============================================================

export const insertCalculationSchema = createInsertSchema(calculationsTable).omit({
  id: true, createdAt: true, updatedAt: true, publicKey: true, status: true, calculatedValue: true,
});

export const insertCaseSchema = createInsertSchema(calculationCasesTable).omit({
  id: true, createdAt: true, updatedAt: true, publicKey: true, status: true, computedAt: true, integrityHash: true, version: true,
});

export const insertPartySchema = createInsertSchema(partiesTable).omit({
  id: true, createdAt: true, updatedAt: true, totalPrincipal: true, totalInterest: true, totalSelic: true, totalUpdated: true, installmentCount: true, discountCount: true,
});

export const insertInstallmentSchema = createInsertSchema(partyInstallmentsTable).omit({
  id: true, createdAt: true, updatedPrincipal: true, updatedInterest: true, updatedSelic: true, totalUpdated: true, accumulatedFactor: true, currencyConversionHistory: true, correctionMemory: true, status: true,
});

export const insertDiscountSchema = createInsertSchema(partyDiscountsTable).omit({
  id: true, createdAt: true,
});

export const insertOtherSuccumbencySchema = createInsertSchema(otherSuccumbenciesTable).omit({
  id: true, createdAt: true, updatedAt: true, computedAmount: true,
});

// ============================================================
// TIPOS EXPORTADOS
// ============================================================

export type Calculation = typeof calculationsTable.$inferSelect;
export type InsertCalculation = z.infer<typeof insertCalculationSchema>;
export type CalculationVersion = typeof calculationVersionsTable.$inferSelect;
export type OfficialIndexCache = typeof officialIndexesCacheTable.$inferSelect;
export type GeneratedReport = typeof generatedReportsTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;

export type CalculationCase = typeof calculationCasesTable.$inferSelect;
export type InsertCase = z.infer<typeof insertCaseSchema>;
export type ProcessData = typeof processDataTable.$inferSelect;
export type CaseMonetaryConfig = typeof caseMonetaryConfigTable.$inferSelect;
export type CaseInterestConfig = typeof caseInterestConfigTable.$inferSelect;
export type MonetaryCriteria = typeof monetaryCriteriaTable.$inferSelect;
export type MonetaryCriteriaRule = typeof monetaryCriteriaRulesTable.$inferSelect;
export type CurrencyTransition = typeof currencyTransitionsTable.$inferSelect;
export type InterestRule = typeof interestRulesTable.$inferSelect;
export type Party = typeof partiesTable.$inferSelect;
export type InsertParty = z.infer<typeof insertPartySchema>;
export type PartyInstallment = typeof partyInstallmentsTable.$inferSelect;
export type InsertInstallment = z.infer<typeof insertInstallmentSchema>;
export type PartyDiscount = typeof partyDiscountsTable.$inferSelect;
export type InsertDiscount = z.infer<typeof insertDiscountSchema>;
export type CurrencyConversionLog = typeof currencyConversionLogsTable.$inferSelect;
export type SuccumbentialFees = typeof succumbentialFeesTable.$inferSelect;
export type OtherSuccumbency = typeof otherSuccumbenciesTable.$inferSelect;
export type InsertOtherSuccumbency = z.infer<typeof insertOtherSuccumbencySchema>;
export type FinalMetadata = typeof finalMetadataTable.$inferSelect;
export type CaseReport = typeof caseReportsTable.$inferSelect;
export type CaseAuditLog = typeof caseAuditLogsTable.$inferSelect;

// ============================================================
// PREVIDENCIÁRIO — Saves para recuperação por chave pública
// ============================================================

export const previdenciarioSavesTable = pgTable("previdenciario_saves", {
  id:        serial("id").primaryKey(),
  publicKey: text("public_key").notNull().unique(),
  calcState: jsonb("calc_state").notNull(),
  userId:    integer("user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PrevidenciarioSave = typeof previdenciarioSavesTable.$inferSelect;

// ============================================================
// CIVIL/ESTADUAL — Saves para recuperação por chave pública
// ============================================================

export const civilSavesTable = pgTable("civil_saves", {
  id:        serial("id").primaryKey(),
  publicKey: text("public_key").notNull().unique(),
  modulo:    text("modulo").notNull().default("civil"),
  calcState: jsonb("calc_state").notNull(),
  userId:    integer("user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CivilSave = typeof civilSavesTable.$inferSelect;
