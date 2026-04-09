import { pgTable, serial, text, jsonb, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ============================================================
// TABELAS FISCAIS — INSS e IRRF (trabalhista)
// ============================================================

/**
 * Armazena as faixas de INSS (progressivo) e IRRF vigentes.
 * type: "inss" | "irrf"
 * vigencia: "YYYY-MM" — mês de início de vigência
 * faixas (INSS): [{ limite: number, aliquota: number }]
 * faixas (IRRF): [{ limite: number, aliquota: number, deducao: number }]
 */
export const taxTablesTable = pgTable("tax_tables", {
  id:        serial("id").primaryKey(),
  type:      text("type").notNull(),            // "inss" | "irrf"
  vigencia:  text("vigencia").notNull(),         // "YYYY-MM"
  label:     text("label").notNull(),            // ex: "INSS 2025 (Jan-Dez)"
  faixas:    jsonb("faixas").notNull(),          // JSON array de faixas
  ativo:     boolean("ativo").notNull().default(true),
  createdBy: integer("created_by"),             // user id do admin que criou
  notes:     text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTaxTableSchema = createInsertSchema(taxTablesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type TaxTable = typeof taxTablesTable.$inferSelect;
export type InsertTaxTable = z.infer<typeof insertTaxTableSchema>;
