/**
 * criteria.ts — Critérios monetários e regras de juros
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  monetaryCriteriaTable,
  monetaryCriteriaRulesTable,
  interestRulesTable,
  currencyTransitionsTable,
} from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/criteria — Listar critérios monetários com regras
router.get("/", async (_req, res) => {
  try {
    const criteria = await db.select()
      .from(monetaryCriteriaTable)
      .where(eq(monetaryCriteriaTable.isActive, true))
      .orderBy(asc(monetaryCriteriaTable.sortOrder));

    const withRules = await Promise.all(
      criteria.map(async (c) => {
        const rules = await db.select()
          .from(monetaryCriteriaRulesTable)
          .where(eq(monetaryCriteriaRulesTable.criteriaId, c.id))
          .orderBy(asc(monetaryCriteriaRulesTable.sortOrder));
        return { ...c, rules };
      })
    );

    return res.json({ criteria: withRules });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao listar critérios" });
  }
});

// GET /api/criteria/interest-rules — Listar regras de juros
// IMPORTANTE: deve vir ANTES de /:id para não ser capturada como id="interest-rules"
router.get("/interest-rules", async (_req, res) => {
  try {
    const rules = await db.select().from(interestRulesTable)
      .where(eq(interestRulesTable.isActive, true))
      .orderBy(asc(interestRulesTable.sortOrder));
    return res.json({ rules });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao listar regras de juros" });
  }
});

// GET /api/criteria/currencies — Listar transições monetárias históricas
// IMPORTANTE: deve vir ANTES de /:id
router.get("/currencies", async (_req, res) => {
  try {
    const transitions = await db.select().from(currencyTransitionsTable).orderBy(asc(currencyTransitionsTable.effectiveDate));
    return res.json({ transitions });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao listar transições monetárias" });
  }
});

// GET /api/criteria/:id — Obter critério com regras
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    const [criteria] = await db.select().from(monetaryCriteriaTable)
      .where(eq(monetaryCriteriaTable.id, id)).limit(1);
    if (!criteria) return res.status(404).json({ error: "Critério não encontrado" });

    const rules = await db.select().from(monetaryCriteriaRulesTable)
      .where(eq(monetaryCriteriaRulesTable.criteriaId, id))
      .orderBy(asc(monetaryCriteriaRulesTable.sortOrder));

    return res.json({ criteria: { ...criteria, rules } });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao obter critério" });
  }
});

export default router;
