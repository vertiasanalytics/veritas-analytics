/**
 * tax-tables.ts — Rotas de Tabelas Fiscais (INSS / IRRF)
 * Veritas Analytics — Módulo Trabalhista
 *
 * GET  /api/tax-tables          → tabelas ativas (todas ou por ?type=inss|irrf)
 * GET  /api/tax-tables/history  → histórico (admin)
 * PUT  /api/tax-tables/:type    → atualiza/cria nova vigência (admin)
 * POST /api/tax-tables/seed     → popula tabelas padrão se vazias (admin)
 */

import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { taxTablesTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";

const router = Router();

// ─── Tabelas-padrão 2025 ──────────────────────────────────────────────────────

const DEFAULT_INSS_2025 = {
  type: "inss",
  vigencia: "2025-01",
  label: "INSS Progressivo 2025 (RPS nº 6/2024)",
  notes: "Tabela progressiva conforme RPS nº 6/2024 — vigência jan/2025",
  faixas: [
    { limite: 1518.00,  aliquota: 0.075, descricao: "Até R$ 1.518,00"     },
    { limite: 2793.88,  aliquota: 0.09,  descricao: "De R$ 1.518,01 a R$ 2.793,88" },
    { limite: 4190.83,  aliquota: 0.12,  descricao: "De R$ 2.793,89 a R$ 4.190,83" },
    { limite: 8157.41,  aliquota: 0.14,  descricao: "De R$ 4.190,84 a R$ 8.157,41" },
  ],
};

const DEFAULT_IRRF_2025 = {
  type: "irrf",
  vigencia: "2025-01",
  label: "IRRF 2025 (RIR / IN RFB 2.178/2024)",
  notes: "Tabela progressiva IRRF conforme RIR art. 677 e IN RFB 2.178/2024 — vigência jan/2025",
  faixas: [
    { limite: 2428.80,  aliquota: 0,     deducao: 0,       descricao: "Isento — até R$ 2.428,80" },
    { limite: 2826.65,  aliquota: 0.075, deducao: 182.16,  descricao: "7,5% — de R$ 2.428,81 a R$ 2.826,65" },
    { limite: 3751.05,  aliquota: 0.15,  deducao: 394.16,  descricao: "15% — de R$ 2.826,66 a R$ 3.751,05" },
    { limite: 4664.68,  aliquota: 0.225, deducao: 675.49,  descricao: "22,5% — de R$ 3.751,06 a R$ 4.664,68" },
    { limite: Infinity, aliquota: 0.275, deducao: 908.74,  descricao: "27,5% — acima de R$ 4.664,68" },
  ],
};

// ─── GET /api/tax-tables ──────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    let rows;

    if (type && (type === "inss" || type === "irrf")) {
      rows = await db
        .select()
        .from(taxTablesTable)
        .where(and(eq(taxTablesTable.type, type as string), eq(taxTablesTable.ativo, true)))
        .orderBy(desc(taxTablesTable.vigencia))
        .limit(1);
    } else {
      // Retorna a mais recente de cada tipo
      const inssRows = await db
        .select()
        .from(taxTablesTable)
        .where(and(eq(taxTablesTable.type, "inss"), eq(taxTablesTable.ativo, true)))
        .orderBy(desc(taxTablesTable.vigencia))
        .limit(1);

      const irrfRows = await db
        .select()
        .from(taxTablesTable)
        .where(and(eq(taxTablesTable.type, "irrf"), eq(taxTablesTable.ativo, true)))
        .orderBy(desc(taxTablesTable.vigencia))
        .limit(1);

      rows = [...inssRows, ...irrfRows];
    }

    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[tax-tables] GET error:", err);
    res.status(500).json({ ok: false, error: "Erro ao buscar tabelas fiscais" });
  }
});

// ─── GET /api/tax-tables/history ─────────────────────────────────────────────
router.get("/history", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(taxTablesTable)
      .orderBy(desc(taxTablesTable.createdAt));

    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[tax-tables] history error:", err);
    res.status(500).json({ ok: false, error: "Erro ao buscar histórico" });
  }
});

// ─── PUT /api/tax-tables/:type ────────────────────────────────────────────────
router.put("/:type", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { type } = req.params;
  if (type !== "inss" && type !== "irrf") {
    return res.status(400).json({ ok: false, error: "Tipo inválido. Use 'inss' ou 'irrf'." });
  }

  const { vigencia, label, faixas, notes } = req.body;
  if (!vigencia || !faixas || !Array.isArray(faixas)) {
    return res.status(400).json({ ok: false, error: "Campos obrigatórios: vigencia, faixas[]" });
  }

  const userId = (req as any).user?.userId ?? null;

  try {
    // Desativa registros antigos do mesmo tipo
    await db
      .update(taxTablesTable)
      .set({ ativo: false })
      .where(eq(taxTablesTable.type, type));

    // Insere nova vigência como ativa
    const [inserted] = await db
      .insert(taxTablesTable)
      .values({
        type,
        vigencia,
        label: label ?? `${type.toUpperCase()} ${vigencia}`,
        faixas: faixas as any,
        notes: notes ?? null,
        ativo: true,
        createdBy: userId,
      })
      .returning();

    res.json({ ok: true, data: inserted, message: `Tabela ${type.toUpperCase()} atualizada para vigência ${vigencia}` });
  } catch (err) {
    console.error("[tax-tables] PUT error:", err);
    res.status(500).json({ ok: false, error: "Erro ao atualizar tabela fiscal" });
  }
});

// ─── POST /api/tax-tables/seed ───────────────────────────────────────────────
router.post("/seed", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const existing = await db.select().from(taxTablesTable).limit(1);
    if (existing.length > 0) {
      return res.json({ ok: true, message: "Tabelas já existem — seed ignorado" });
    }

    await db.insert(taxTablesTable).values([
      { ...DEFAULT_INSS_2025, faixas: DEFAULT_INSS_2025.faixas as any, ativo: true, createdBy: null },
      { ...DEFAULT_IRRF_2025, faixas: DEFAULT_IRRF_2025.faixas as any, ativo: true, createdBy: null },
    ]);

    res.json({ ok: true, message: "Tabelas padrão INSS/IRRF 2025 inseridas com sucesso" });
  } catch (err) {
    console.error("[tax-tables] seed error:", err);
    res.status(500).json({ ok: false, error: "Erro ao semear tabelas" });
  }
});

export default router;
