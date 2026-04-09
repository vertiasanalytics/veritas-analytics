import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const tjmgFactorsTable = pgTable("tjmg_factors", {
  id: serial("id").primaryKey(),
  indiceNome: text("indice_nome").notNull().default("ICGJ/TJMG"),
  competenciaOrigem: text("competencia_origem").notNull(),
  competenciaReferencia: text("competencia_referencia").notNull(),
  fator: numeric("fator", { precision: 16, scale: 8 }).notNull(),
  fonteUrl: text("fonte_url"),
  hashArquivo: text("hash_arquivo"),
  importadoEm: timestamp("importado_em").defaultNow().notNull(),
});

export type TjmgFactor = typeof tjmgFactorsTable.$inferSelect;
export type InsertTjmgFactor = typeof tjmgFactorsTable.$inferInsert;
