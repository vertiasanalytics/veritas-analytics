import { pgTable, serial, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const salarioMinimoSeriesTable = pgTable("salario_minimo_series", {
  id:                serial("id").primaryKey(),
  clientId:          text("client_id").notNull().unique(),
  competenciaInicio: text("competencia_inicio").notNull(),
  competenciaFim:    text("competencia_fim").notNull(),
  valor:             numeric("valor", { precision: 10, scale: 2 }).notNull(),
  atoNormativo:      text("ato_normativo"),
  observacoes:       text("observacoes"),
  ativo:             boolean("ativo").notNull().default(true),
  createdAt:         timestamp("created_at").defaultNow().notNull(),
  updatedAt:         timestamp("updated_at").defaultNow().notNull(),
});

export const insertSalarioMinimoSchema = createInsertSchema(salarioMinimoSeriesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type SalarioMinimoSeries = typeof salarioMinimoSeriesTable.$inferSelect;
export type InsertSalarioMinimoSeries = z.infer<typeof insertSalarioMinimoSchema>;
