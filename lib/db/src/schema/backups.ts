import { pgTable, serial, text, integer, timestamp, jsonb, bigint } from "drizzle-orm/pg-core";
import { users } from "./users";

export const backupsTable = pgTable("backups", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  scope: text("scope").notNull().default("user"),
  label: text("label").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
  data: jsonb("data").notNull(),
  restoredAt: timestamp("restored_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Backup = typeof backupsTable.$inferSelect;
export type InsertBackup = typeof backupsTable.$inferInsert;
