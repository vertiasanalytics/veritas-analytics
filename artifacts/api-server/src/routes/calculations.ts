/**
 * Rotas de cálculos de atualização monetária.
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  calculationsTable,
  calculationVersionsTable,
  generatedReportsTable,
} from "@workspace/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { generatePublicKey } from "../lib/publicKey.js";
import { logAudit } from "../lib/audit.js";
import { computeMonetaryUpdate } from "../engine/calculator.js";
import { generateHTMLReport } from "../engine/reportGenerator.js";
import { z } from "zod";

const router: IRouter = Router();

// ── Schemas de validação ─────────────────────────────────────────────────────

const CorrectionIndexSchema = z.enum(["IPCA", "IPCA_E", "INPC", "SELIC", "TR", "MANUAL"]);
const InterestRuleSchema = z.enum([
  "none",
  "simple_1_percent",
  "compound_selic",
  "compound_12_percent_year",
  "manual",
]);

const CreateCalculationSchema = z.object({
  title: z.string().min(1, "Título obrigatório"),
  processNumber: z.string().optional(),
  claimantName: z.string().optional(),
  notes: z.string().optional(),
  originalValue: z.number().positive("Valor deve ser positivo"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato: YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato: YYYY-MM-DD"),
  correctionIndex: CorrectionIndexSchema,
  interestRule: InterestRuleSchema,
});

// ── Helper ───────────────────────────────────────────────────────────────────

function formatCalculation(calc: typeof calculationsTable.$inferSelect) {
  return {
    id: calc.id,
    publicKey: calc.publicKey,
    title: calc.title,
    processNumber: calc.processNumber,
    claimantName: calc.claimantName,
    notes: calc.notes,
    originalValue: parseFloat(calc.originalValue),
    startDate: calc.startDate,
    endDate: calc.endDate,
    correctionIndex: calc.correctionIndex,
    interestRule: calc.interestRule,
    calculatedValue: calc.calculatedValue ? parseFloat(calc.calculatedValue) : null,
    status: calc.status,
    createdAt: calc.createdAt.toISOString(),
    updatedAt: calc.updatedAt.toISOString(),
  };
}

// ── GET /calculations ─────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const page = parseInt(String(req.query.page || "1"));
    const limit = parseInt(String(req.query.limit || "20"));
    const offset = (page - 1) * limit;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(calculationsTable)
        .orderBy(desc(calculationsTable.updatedAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(calculationsTable),
    ]);

    res.json({
      success: true,
      calculations: rows.map(formatCalculation),
      total: totalResult[0]?.count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    console.error("[GET /calculations]", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Erro interno ao listar cálculos" });
  }
});

// ── POST /calculations ────────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  try {
    const parsed = CreateCalculationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Dados inválidos",
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;
    const publicKey = generatePublicKey();

    const [calc] = await db
      .insert(calculationsTable)
      .values({
        publicKey,
        title: data.title,
        processNumber: data.processNumber,
        claimantName: data.claimantName,
        notes: data.notes,
        originalValue: String(data.originalValue),
        startDate: data.startDate,
        endDate: data.endDate,
        correctionIndex: data.correctionIndex,
        interestRule: data.interestRule,
        status: "draft",
      })
      .returning();

    await logAudit({
      action: "CALCULATION_CREATED",
      entity: "calculations",
      entityId: calc.id,
      details: { publicKey, title: data.title },
    });

    res.status(201).json({ success: true, calculation: formatCalculation(calc) });
  } catch (err) {
    console.error("[POST /calculations]", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Erro ao criar cálculo" });
  }
});

// ── GET /calculations/recover/:publicKey ─────────────────────────────────────

router.get("/recover/:publicKey", async (req, res) => {
  try {
    const [calc] = await db
      .select()
      .from(calculationsTable)
      .where(eq(calculationsTable.publicKey, req.params.publicKey))
      .limit(1);

    if (!calc) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: `Cálculo não encontrado para a chave: ${req.params.publicKey}`,
      });
    }

    await logAudit({
      action: "CALCULATION_RECOVERED",
      entity: "calculations",
      entityId: calc.id,
      details: { publicKey: req.params.publicKey },
    });

    res.json({ success: true, calculation: formatCalculation(calc) });
  } catch (err) {
    console.error("[GET /calculations/recover]", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Erro ao recuperar cálculo" });
  }
});

// ── GET /calculations/:id ─────────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [calc] = await db
      .select()
      .from(calculationsTable)
      .where(eq(calculationsTable.id, id))
      .limit(1);

    if (!calc) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Cálculo não encontrado" });
    }

    res.json({ success: true, calculation: formatCalculation(calc) });
  } catch (err) {
    console.error("[GET /calculations/:id]", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Erro ao buscar cálculo" });
  }
});

// ── PUT /calculations/:id ─────────────────────────────────────────────────────

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = req.body;

    const [calc] = await db
      .update(calculationsTable)
      .set({
        title: data.title,
        processNumber: data.processNumber,
        claimantName: data.claimantName,
        notes: data.notes,
        originalValue: data.originalValue ? String(data.originalValue) : undefined,
        startDate: data.startDate,
        endDate: data.endDate,
        correctionIndex: data.correctionIndex,
        interestRule: data.interestRule,
        updatedAt: new Date(),
      })
      .where(eq(calculationsTable.id, id))
      .returning();

    if (!calc) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Cálculo não encontrado" });
    }

    await logAudit({
      action: "CALCULATION_UPDATED",
      entity: "calculations",
      entityId: id,
      details: data,
    });

    res.json({ success: true, calculation: formatCalculation(calc) });
  } catch (err) {
    console.error("[PUT /calculations/:id]", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Erro ao atualizar cálculo" });
  }
});

// ── POST /calculations/:id/compute ───────────────────────────────────────────

router.post("/:id/compute", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [calc] = await db
      .select()
      .from(calculationsTable)
      .where(eq(calculationsTable.id, id))
      .limit(1);

    if (!calc) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Cálculo não encontrado" });
    }

    const endDate = req.body?.endDate || calc.endDate;

    const result = await computeMonetaryUpdate({
      originalValue: parseFloat(calc.originalValue),
      startDate: calc.startDate,
      endDate,
      correctionIndex: calc.correctionIndex,
      interestRule: calc.interestRule,
    });

    // Salvar versão
    const versions = await db
      .select({ version: calculationVersionsTable.version })
      .from(calculationVersionsTable)
      .where(eq(calculationVersionsTable.calculationId, id))
      .orderBy(desc(calculationVersionsTable.version))
      .limit(1);

    const nextVersion = (versions[0]?.version ?? 0) + 1;

    await db.insert(calculationVersionsTable).values({
      calculationId: id,
      version: nextVersion,
      originalValue: String(result.originalValue),
      calculatedValue: String(result.finalValue),
      startDate: result.startDate,
      endDate: result.endDate,
      correctionIndex: result.correctionIndex,
      interestRule: result.interestRule,
      accumulatedFactor: String(result.accumulatedFactor),
      integrityHash: result.integrityHash,
      resultSnapshot: result as unknown as Record<string, unknown>,
    });

    // Atualizar status do cálculo
    await db
      .update(calculationsTable)
      .set({
        calculatedValue: String(result.finalValue),
        endDate,
        status: "calculated",
        updatedAt: new Date(),
      })
      .where(eq(calculationsTable.id, id));

    await logAudit({
      action: "CALCULATION_COMPUTED",
      entity: "calculations",
      entityId: id,
      indexType: calc.correctionIndex,
      source: result.dataSource,
      details: {
        version: nextVersion,
        finalValue: result.finalValue,
        accumulatedFactor: result.accumulatedFactor,
        integrityHash: result.integrityHash,
      },
    });

    const [updatedCalc] = await db
      .select()
      .from(calculationsTable)
      .where(eq(calculationsTable.id, id))
      .limit(1);

    res.json({
      success: true,
      calculation: formatCalculation(updatedCalc),
      result,
    });
  } catch (err) {
    console.error("[POST /calculations/:id/compute]", err);
    const message = err instanceof Error ? err.message : "Erro ao processar cálculo";
    res.status(400).json({ error: "CALCULATION_ERROR", message });
  }
});

// ── GET /calculations/:id/versions ───────────────────────────────────────────

router.get("/:id/versions", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const versions = await db
      .select()
      .from(calculationVersionsTable)
      .where(eq(calculationVersionsTable.calculationId, id))
      .orderBy(desc(calculationVersionsTable.version));

    res.json({
      success: true,
      versions: versions.map((v) => ({
        id: v.id,
        calculationId: v.calculationId,
        version: v.version,
        originalValue: parseFloat(v.originalValue),
        calculatedValue: parseFloat(v.calculatedValue),
        startDate: v.startDate,
        endDate: v.endDate,
        correctionIndex: v.correctionIndex,
        interestRule: v.interestRule,
        accumulatedFactor: parseFloat(v.accumulatedFactor),
        integrityHash: v.integrityHash,
        computedAt: v.computedAt.toISOString(),
        notes: v.notes,
      })),
    });
  } catch (err) {
    console.error("[GET /calculations/:id/versions]", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Erro ao buscar versões" });
  }
});

// ── POST /calculations/:id/report ─────────────────────────────────────────────

router.post("/:id/report", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const format = req.body?.format || "html";

    const [calc] = await db
      .select()
      .from(calculationsTable)
      .where(eq(calculationsTable.id, id))
      .limit(1);

    if (!calc) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Cálculo não encontrado" });
    }

    if (!calc.calculatedValue) {
      return res.status(400).json({
        error: "NOT_CALCULATED",
        message: "Execute o cálculo antes de gerar o relatório",
      });
    }

    // Buscar última versão para dados do resultado
    const [lastVersion] = await db
      .select()
      .from(calculationVersionsTable)
      .where(eq(calculationVersionsTable.calculationId, id))
      .orderBy(desc(calculationVersionsTable.version))
      .limit(1);

    if (!lastVersion?.resultSnapshot) {
      return res.status(400).json({
        error: "NO_SNAPSHOT",
        message: "Recalcule o cálculo para gerar o relatório",
      });
    }

    const result = lastVersion.resultSnapshot as unknown as import("../engine/calculator.js").CalculationResult;
    const htmlContent = generateHTMLReport(calc, result, calc.publicKey);

    const [report] = await db
      .insert(generatedReportsTable)
      .values({
        calculationId: id,
        format,
        htmlContent,
      })
      .returning();

    // Atualizar status
    await db
      .update(calculationsTable)
      .set({ status: "report_generated", updatedAt: new Date() })
      .where(eq(calculationsTable.id, id));

    await logAudit({
      action: "REPORT_GENERATED",
      entity: "generated_reports",
      entityId: report.id,
      details: { calculationId: id, format, publicKey: calc.publicKey },
    });

    res.json({
      success: true,
      reportId: report.id,
      format,
      url: `/api/reports/${report.id}`,
      htmlContent,
      generatedAt: report.generatedAt.toISOString(),
    });
  } catch (err) {
    console.error("[POST /calculations/:id/report]", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Erro ao gerar relatório" });
  }
});

export default router;
