/**
 * cases.ts — Rotas da entidade CalculationCase
 * Sistema Veritas Analytics — Cálculos Judiciais Federais
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  calculationCasesTable,
  processDataTable,
  caseMonetaryConfigTable,
  caseInterestConfigTable,
  partiesTable,
  partyInstallmentsTable,
  partyDiscountsTable,
  currencyConversionLogsTable,
  succumbentialFeesTable,
  otherSuccumbenciesTable,
  finalMetadataTable,
  caseReportsTable,
  caseAuditLogsTable,
  monetaryCriteriaTable,
  interestRulesTable,
  users,
} from "@workspace/db/schema";
import { eq, desc, inArray, count } from "drizzle-orm";
import { generatePublicKey } from "../lib/publicKey.js";
import { computeInstallmentProjectef } from "../engine/correctionEngine.js";
import { computeFees } from "../engine/feesEngine.js";
import { generateCaseReportHTML } from "../engine/caseReportEngine.js";
import { getCurrencyAtPeriod } from "../engine/currencyConversionEngine.js";
import { z } from "zod";

const router: IRouter = Router();

// ── Audit helper ─────────────────────────────────────────────────────────────
async function auditCase(
  caseId: number,
  action: string,
  entity: string,
  entityId?: number,
  details?: unknown
) {
  await db.insert(caseAuditLogsTable).values({
    caseId,
    action,
    entity,
    entityId,
    details: details as any,
  });
}

// ============================================================
// Stats
// ============================================================

// GET /api/cases/count — Total de cálculos criados (para dashboard)
router.get("/count", async (_req, res) => {
  try {
    const result = await db.select({ total: count() }).from(calculationCasesTable);
    res.json({ success: true, total: Number(result[0]?.total ?? 0) });
  } catch (err) {
    console.error("[GET /cases/count]", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Erro ao contar cálculos" });
  }
});

// ============================================================
// CRUD — CalculationCases
// ============================================================

// POST /api/cases — Criar novo caso
router.post("/", async (req, res) => {
  try {
    const publicKey = generatePublicKey();
    const [newCase] = await db.insert(calculationCasesTable).values({ publicKey }).returning();

    // Criar sub-entidades padrão
    await Promise.all([
      db.insert(processDataTable).values({ caseId: newCase.id }).onConflictDoNothing(),
      db.insert(caseMonetaryConfigTable).values({ caseId: newCase.id }).onConflictDoNothing(),
      db.insert(caseInterestConfigTable).values({ caseId: newCase.id }).onConflictDoNothing(),
      db.insert(finalMetadataTable).values({ caseId: newCase.id }).onConflictDoNothing(),
    ]);

    await auditCase(newCase.id, "create", "calculation_cases", newCase.id);
    return res.status(201).json({ case: newCase, publicKey: newCase.publicKey });
  } catch (err) {
    console.error("[cases] Erro ao criar caso:", err);
    return res.status(500).json({ error: "Erro ao criar caso" });
  }
});

// GET /api/cases — Listar casos
router.get("/", async (_req, res) => {
  try {
    const cases = await db.select().from(calculationCasesTable).orderBy(desc(calculationCasesTable.updatedAt)).limit(100);
    return res.json({ cases });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao listar casos" });
  }
});

// GET /api/cases/recover/:publicKey — Recuperar por chave pública
router.get("/recover/:publicKey", async (req, res) => {
  try {
    const { publicKey } = req.params;
    const [found] = await db.select().from(calculationCasesTable)
      .where(eq(calculationCasesTable.publicKey, publicKey.toUpperCase()))
      .limit(1);
    if (!found) return res.status(404).json({ error: "Caso não encontrado para essa chave pública" });
    const full = await getCaseFull(found.id);
    return res.json(full);
  } catch (err) {
    return res.status(500).json({ error: "Erro ao recuperar caso" });
  }
});

// GET /api/cases/:id — Obter caso completo
router.get("/:id", async (req, res) => {
  try {
    const caseId = parseInt(req.params.id);
    if (isNaN(caseId)) return res.status(400).json({ error: "ID inválido" });
    const full = await getCaseFull(caseId);
    if (!full) return res.status(404).json({ error: "Caso não encontrado" });
    return res.json(full);
  } catch (err) {
    return res.status(500).json({ error: "Erro ao obter caso" });
  }
});

// ── helper: obter caso completo ───────────────────────────────────────────────
async function getCaseFull(caseId: number) {
  const [kase] = await db.select().from(calculationCasesTable).where(eq(calculationCasesTable.id, caseId)).limit(1);
  if (!kase) return null;

  const [processData] = await db.select().from(processDataTable).where(eq(processDataTable.caseId, caseId)).limit(1);
  const [monetaryConfig] = await db.select().from(caseMonetaryConfigTable).where(eq(caseMonetaryConfigTable.caseId, caseId)).limit(1);
  const [interestConfig] = await db.select().from(caseInterestConfigTable).where(eq(caseInterestConfigTable.caseId, caseId)).limit(1);
  const [finalMeta] = await db.select().from(finalMetadataTable).where(eq(finalMetadataTable.caseId, caseId)).limit(1);
  const fees = await db.select().from(succumbentialFeesTable).where(eq(succumbentialFeesTable.caseId, caseId));
  const succumbencies = await db.select().from(otherSuccumbenciesTable).where(eq(otherSuccumbenciesTable.caseId, caseId)).orderBy(otherSuccumbenciesTable.sortOrder);

  const partiesRaw = await db.select().from(partiesTable).where(eq(partiesTable.caseId, caseId)).orderBy(partiesTable.sortOrder);
  const parties = await Promise.all(partiesRaw.map(async (p) => {
    const installments = await db.select().from(partyInstallmentsTable)
      .where(eq(partyInstallmentsTable.partyId, p.id))
      .orderBy(partyInstallmentsTable.sortOrder);
    const discounts = await db.select().from(partyDiscountsTable)
      .where(eq(partyDiscountsTable.partyId, p.id))
      .orderBy(partyDiscountsTable.sortOrder);
    return { ...p, installments, discounts };
  }));

  return { case: kase, processData, monetaryConfig, interestConfig, parties, fees, succumbencies, finalMeta };
}

// ============================================================
// ABA 1 — DADOS DO PROCESSO
// ============================================================

router.put("/:id/process-data", async (req, res) => {
  try {
    const caseId = parseInt(req.params.id);
    const data = req.body;
    await db.insert(processDataTable)
      .values({ caseId, ...data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: processDataTable.caseId, set: { ...data, updatedAt: new Date() } });
    await db.update(calculationCasesTable).set({ updatedAt: new Date(), status: "in_progress" }).where(eq(calculationCasesTable.id, caseId));
    await auditCase(caseId, "update", "process_data", undefined, data);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao salvar dados do processo" });
  }
});

// ============================================================
// ABA 2 — CORREÇÃO MONETÁRIA
// ============================================================

router.put("/:id/monetary-config", async (req, res) => {
  try {
    const caseId = parseInt(req.params.id);
    const data = req.body;
    await db.insert(caseMonetaryConfigTable)
      .values({ caseId, ...data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: caseMonetaryConfigTable.caseId, set: { ...data, updatedAt: new Date() } });
    await db.update(calculationCasesTable).set({ updatedAt: new Date() }).where(eq(calculationCasesTable.id, caseId));
    await auditCase(caseId, "update", "case_monetary_config", undefined, data);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao salvar configuração monetária" });
  }
});

// ============================================================
// ABA 3 — JUROS
// ============================================================

router.put("/:id/interest-config", async (req, res) => {
  try {
    const caseId = parseInt(req.params.id);
    const data = req.body;
    await db.insert(caseInterestConfigTable)
      .values({ caseId, ...data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: caseInterestConfigTable.caseId, set: { ...data, updatedAt: new Date() } });
    await db.update(calculationCasesTable).set({ updatedAt: new Date() }).where(eq(calculationCasesTable.id, caseId));
    await auditCase(caseId, "update", "case_interest_config", undefined, data);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao salvar configuração de juros" });
  }
});

// ============================================================
// ABA 4 — PARTES
// ============================================================

// GET /api/cases/:id/parties
router.get("/:id/parties", async (req, res) => {
  try {
    const caseId = parseInt(req.params.id);
    const parties = await db.select().from(partiesTable)
      .where(eq(partiesTable.caseId, caseId))
      .orderBy(partiesTable.sortOrder);
    return res.json({ parties });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao listar partes" });
  }
});

// POST /api/cases/:id/parties
router.post("/:id/parties", async (req, res) => {
  try {
    const caseId = parseInt(req.params.id);
    const { name, cpfCnpj, contractualFeesPct, contractualFeesBeneficiaryCpfCnpj, pssMode } = req.body;
    if (!name) return res.status(400).json({ error: "Nome da parte é obrigatório" });

    const existingParties = await db.select({ id: partiesTable.id }).from(partiesTable).where(eq(partiesTable.caseId, caseId));
    const [party] = await db.insert(partiesTable).values({
      caseId, name, cpfCnpj, contractualFeesPct, contractualFeesBeneficiaryCpfCnpj,
      pssMode: pssMode ?? "none",
      sortOrder: existingParties.length,
    }).returning();
    await auditCase(caseId, "create", "parties", party.id, { name });
    return res.status(201).json({ party });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao criar parte" });
  }
});

// PUT /api/cases/:id/parties/:partyId
router.put("/:id/parties/:partyId", async (req, res) => {
  try {
    const partyId = parseInt(req.params.partyId);
    const { name, cpfCnpj, contractualFeesPct, contractualFeesBeneficiaryCpfCnpj, pssMode } = req.body;
    const [updated] = await db.update(partiesTable)
      .set({ name, cpfCnpj, contractualFeesPct, contractualFeesBeneficiaryCpfCnpj, pssMode, updatedAt: new Date() })
      .where(eq(partiesTable.id, partyId))
      .returning();
    if (!updated) return res.status(404).json({ error: "Parte não encontrada" });
    return res.json({ party: updated });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao atualizar parte" });
  }
});

// DELETE /api/cases/:id/parties/:partyId
router.delete("/:id/parties/:partyId", async (req, res) => {
  try {
    const partyId = parseInt(req.params.partyId);
    const caseId = parseInt(req.params.id);
    if (isNaN(partyId) || isNaN(caseId)) return res.status(400).json({ error: "IDs inválidos" });

    // 1. Obter IDs das parcelas desta parte para deletar os logs de conversão (FK constraint)
    const instRows = await db.select({ id: partyInstallmentsTable.id })
      .from(partyInstallmentsTable)
      .where(eq(partyInstallmentsTable.partyId, partyId));

    if (instRows.length > 0) {
      const instIds = instRows.map((r) => r.id);
      await db.delete(currencyConversionLogsTable)
        .where(inArray(currencyConversionLogsTable.installmentId, instIds));
    }

    // 2. Deletar descontos, parcelas e parte
    await db.delete(partyDiscountsTable).where(eq(partyDiscountsTable.partyId, partyId));
    await db.delete(partyInstallmentsTable).where(eq(partyInstallmentsTable.partyId, partyId));
    await db.delete(partiesTable).where(eq(partiesTable.id, partyId));
    await auditCase(caseId, "delete", "parties", partyId);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[cases] Erro ao remover parte:", err?.message);
    return res.status(500).json({ error: "Erro ao remover parte: " + (err?.message ?? "") });
  }
});

// ── Parcelas ─────────────────────────────────────────────────────────────────

// GET /api/cases/:id/parties/:partyId/installments
router.get("/:id/parties/:partyId/installments", async (req, res) => {
  try {
    const partyId = parseInt(req.params.partyId);
    if (isNaN(partyId)) return res.status(400).json({ error: "partyId inválido" });
    const installments = await db.select().from(partyInstallmentsTable)
      .where(eq(partyInstallmentsTable.partyId, partyId))
      .orderBy(partyInstallmentsTable.sortOrder);
    return res.json({ installments });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao listar parcelas" });
  }
});

// POST /api/cases/:id/parties/:partyId/installments — Individual ou lote
router.post("/:id/parties/:partyId/installments", async (req, res) => {
  try {
    const partyId = parseInt(req.params.partyId);
    const caseId = parseInt(req.params.id);
    if (isNaN(partyId)) return res.status(400).json({ error: "partyId inválido" });
    if (isNaN(caseId)) return res.status(400).json({ error: "caseId inválido" });
    const { installments: batch, ...single } = req.body;

    const toInsert: typeof single[] = batch ?? [single];

    const existingCount = await db.select({ id: partyInstallmentsTable.id }).from(partyInstallmentsTable)
      .where(eq(partyInstallmentsTable.partyId, partyId));

    const inserted = [];
    for (let i = 0; i < toInsert.length; i++) {
      const inst = toInsert[i];
      if (!inst.period || !inst.principalAmount) continue;

      // Detectar moeda original automaticamente
      const detectedCurrency = getCurrencyAtPeriod(inst.period);
      const originalCurrency = inst.originalCurrency ?? detectedCurrency;

      const [row] = await db.insert(partyInstallmentsTable).values({
        partyId,
        period: inst.period,
        principalAmount: String(inst.principalAmount),
        selicAmount: inst.selicAmount ? String(inst.selicAmount) : null,
        interestAmount: inst.interestAmount ? String(inst.interestAmount) : null,
        fixedInterestFrom: inst.fixedInterestFrom,
        originalCurrency,
        originalAmountInCurrency: inst.originalAmountInCurrency ? String(inst.originalAmountInCurrency) : null,
        notes: inst.notes,
        sortOrder: existingCount.length + i,
      }).returning();
      inserted.push(row);
    }

    // Atualizar contadores da parte
    await updatePartyCounters(partyId);
    await auditCase(caseId, "create", "party_installments", partyId, { count: inserted.length });

    return res.status(201).json({ installments: inserted });
  } catch (err) {
    console.error("[cases] Erro ao criar parcelas:", err);
    return res.status(500).json({ error: "Erro ao criar parcelas" });
  }
});

// POST /api/cases/:id/parties/:partyId/installments/paste — Colar de planilha
router.post("/:id/parties/:partyId/installments/paste", async (req, res) => {
  try {
    const partyId = parseInt(req.params.partyId);
    const caseId = parseInt(req.params.id);
    const { text } = req.body;

    if (!text) return res.status(400).json({ error: "Texto não fornecido" });

    const lines = text.trim().split("\n").filter((l: string) => l.trim());
    const parsed: { period: string; principalAmount: number }[] = [];

    for (const line of lines) {
      const parts = line.split(/[\t;,]/).map((p: string) => p.trim());
      if (parts.length < 2) continue;

      // Primeira coluna: período (mm/aaaa ou aaaa-mm)
      let period = parts[0];
      if (period.includes("/")) {
        const [m, y] = period.split("/");
        period = `${y}-${m.padStart(2, "0")}`;
      }
      if (!/^\d{4}-\d{2}$/.test(period)) continue;

      // Segunda coluna: valor — aceita formatos:
      //   BR com milhar:   R$ 1.500,00 → 1500.00
      //   BR sem milhar:   1500,50     → 1500.50
      //   US/float nativo: 798411.61   → 798411.61
      const raw = parts[1].replace(/[R$\s]/g, "").trim();
      let normalized: string;
      if (raw.includes(".") && raw.includes(",")) {
        // Formato BR com separador de milhar: 1.500,00
        normalized = raw.replace(/\./g, "").replace(",", ".");
      } else if (raw.includes(",")) {
        // Formato BR sem milhar: 1500,50
        normalized = raw.replace(",", ".");
      } else {
        // Ponto decimal US ou inteiro: 798411.61 / 1500
        normalized = raw;
      }
      const principalAmount = parseFloat(normalized);
      if (isNaN(principalAmount) || principalAmount === 0) continue;

      parsed.push({ period, principalAmount });
    }

    if (parsed.length === 0) return res.status(400).json({ error: "Nenhuma linha válida encontrada" });

    const existing = await db.select({ id: partyInstallmentsTable.id }).from(partyInstallmentsTable)
      .where(eq(partyInstallmentsTable.partyId, partyId));

    const inserted = [];
    for (let i = 0; i < parsed.length; i++) {
      const { period, principalAmount } = parsed[i];
      const detectedCurrency = getCurrencyAtPeriod(period);
      const [row] = await db.insert(partyInstallmentsTable).values({
        partyId,
        period,
        principalAmount: String(principalAmount),
        originalCurrency: detectedCurrency,
        sortOrder: existing.length + i,
      }).returning();
      inserted.push(row);
    }

    await updatePartyCounters(partyId);
    await auditCase(caseId, "paste", "party_installments", partyId, { count: inserted.length });

    return res.status(201).json({ installments: inserted, parsedCount: parsed.length });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao processar colagem de planilha" });
  }
});

// PUT /api/cases/:id/parties/:partyId/installments/:instId
router.put("/:id/parties/:partyId/installments/:instId", async (req, res) => {
  try {
    const instId = parseInt(req.params.instId);
    const { period, principalAmount, selicAmount, interestAmount, fixedInterestFrom, notes } = req.body;

    const detectedCurrency = period ? getCurrencyAtPeriod(period) : undefined;

    const [updated] = await db.update(partyInstallmentsTable)
      .set({
        period,
        principalAmount: principalAmount ? String(principalAmount) : undefined,
        selicAmount: selicAmount ? String(selicAmount) : null,
        interestAmount: interestAmount ? String(interestAmount) : null,
        fixedInterestFrom,
        originalCurrency: detectedCurrency,
        notes,
        status: "pending",
      })
      .where(eq(partyInstallmentsTable.id, instId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Parcela não encontrada" });
    await updatePartyCounters(parseInt(req.params.partyId));
    return res.json({ installment: updated });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao atualizar parcela" });
  }
});

// DELETE /api/cases/:id/parties/:partyId/installments/:instId
router.delete("/:id/parties/:partyId/installments/:instId", async (req, res) => {
  try {
    const instId = parseInt(req.params.instId);
    const partyId = parseInt(req.params.partyId);
    await db.delete(currencyConversionLogsTable).where(eq(currencyConversionLogsTable.installmentId, instId));
    await db.delete(partyInstallmentsTable).where(eq(partyInstallmentsTable.id, instId));
    await updatePartyCounters(partyId);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao remover parcela" });
  }
});

// ── Descontos ─────────────────────────────────────────────────────────────────

// GET /api/cases/:id/parties/:partyId/discounts
router.get("/:id/parties/:partyId/discounts", async (req, res) => {
  try {
    const partyId = parseInt(req.params.partyId);
    const discounts = await db.select().from(partyDiscountsTable)
      .where(eq(partyDiscountsTable.partyId, partyId))
      .orderBy(partyDiscountsTable.sortOrder);
    return res.json({ discounts });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao listar descontos" });
  }
});

// POST /api/cases/:id/parties/:partyId/discounts
router.post("/:id/parties/:partyId/discounts", async (req, res) => {
  try {
    const partyId = parseInt(req.params.partyId);
    const { description, amount, date, notes } = req.body;
    if (!description || !amount) return res.status(400).json({ error: "Descrição e valor são obrigatórios" });
    const [discount] = await db.insert(partyDiscountsTable).values({
      partyId, description, amount: String(amount), date, notes,
    }).returning();
    await updatePartyCounters(partyId);
    return res.status(201).json({ discount });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao criar desconto" });
  }
});

// DELETE /api/cases/:id/parties/:partyId/discounts/:discId
router.delete("/:id/parties/:partyId/discounts/:discId", async (req, res) => {
  try {
    const discId = parseInt(req.params.discId);
    const partyId = parseInt(req.params.partyId);
    await db.delete(partyDiscountsTable).where(eq(partyDiscountsTable.id, discId));
    await updatePartyCounters(partyId);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao remover desconto" });
  }
});

// ============================================================
// ABA 5 — HONORÁRIOS
// ============================================================

router.put("/:id/fees", async (req, res) => {
  try {
    const caseId = parseInt(req.params.id);
    const { feesType = "succumbential", ...data } = req.body;

    // Upsert: remover registro existente do mesmo tipo e inserir novo
    await db.delete(succumbentialFeesTable).where(
      eq(succumbentialFeesTable.caseId, caseId)
    );
    const [fees] = await db.insert(succumbentialFeesTable).values({
      caseId, feesType, ...data, updatedAt: new Date()
    }).returning();
    await auditCase(caseId, "update", "succumbential_fees", fees.id, data);
    return res.json({ fees });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao salvar honorários" });
  }
});

// ============================================================
// ABA 6 — OUTRAS SUCUMBÊNCIAS
// ============================================================

router.get("/:id/succumbencies", async (req, res) => {
  try {
    const caseId = parseInt(req.params.id);
    const rows = await db.select().from(otherSuccumbenciesTable)
      .where(eq(otherSuccumbenciesTable.caseId, caseId))
      .orderBy(otherSuccumbenciesTable.sortOrder);
    return res.json({ succumbencies: rows });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao listar sucumbências" });
  }
});

router.post("/:id/succumbencies", async (req, res) => {
  try {
    const caseId = parseInt(req.params.id);
    const { type, cpfCnpj, description, date, amount, apply10PctFine, apply10PctFees, useAlternativeCriteria, alternativeCriteriaId } = req.body;
    if (!type || !amount) return res.status(400).json({ error: "Tipo e valor são obrigatórios" });
    const [row] = await db.insert(otherSuccumbenciesTable).values({
      caseId, type, cpfCnpj, description, date,
      amount: String(amount),
      apply10PctFine: apply10PctFine ?? false,
      apply10PctFees: apply10PctFees ?? false,
      useAlternativeCriteria: useAlternativeCriteria ?? false,
      alternativeCriteriaId,
    }).returning();
    return res.status(201).json({ succumbency: row });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao criar sucumbência" });
  }
});

router.put("/:id/succumbencies/:sid", async (req, res) => {
  try {
    const sid = parseInt(req.params.sid);
    const data = req.body;
    if (data.amount) data.amount = String(data.amount);
    const [updated] = await db.update(otherSuccumbenciesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(otherSuccumbenciesTable.id, sid))
      .returning();
    if (!updated) return res.status(404).json({ error: "Sucumbência não encontrada" });
    return res.json({ succumbency: updated });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao atualizar sucumbência" });
  }
});

router.delete("/:id/succumbencies/:sid", async (req, res) => {
  try {
    const sid = parseInt(req.params.sid);
    await db.delete(otherSuccumbenciesTable).where(eq(otherSuccumbenciesTable.id, sid));
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao remover sucumbência" });
  }
});

// ============================================================
// ABA 7 — DADOS FINAIS
// ============================================================

router.put("/:id/final-metadata", async (req, res) => {
  try {
    const caseId = parseInt(req.params.id);
    const data = req.body;
    await db.insert(finalMetadataTable)
      .values({ caseId, ...data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: finalMetadataTable.caseId, set: { ...data, updatedAt: new Date() } });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao salvar dados finais" });
  }
});

// ============================================================
// COMPUTE — Calcular tudo
// ============================================================

router.post("/:id/compute", async (req, res) => {
  try {
    const caseId = parseInt(req.params.id);

    const [kase] = await db.select().from(calculationCasesTable).where(eq(calculationCasesTable.id, caseId)).limit(1);
    if (!kase) return res.status(404).json({ error: "Caso não encontrado" });

    const [monetaryConfig] = await db.select().from(caseMonetaryConfigTable).where(eq(caseMonetaryConfigTable.caseId, caseId)).limit(1);
    const [interestConfig] = await db.select().from(caseInterestConfigTable).where(eq(caseInterestConfigTable.caseId, caseId)).limit(1);

    if (!monetaryConfig?.criteriaId) {
      return res.status(400).json({ error: "Configure o critério de correção monetária antes de calcular" });
    }
    if (!monetaryConfig?.baseDate) {
      return res.status(400).json({ error: "Configure a data-base antes de calcular" });
    }

    // Buscar critério
    const [criteria] = await db.select().from(monetaryCriteriaTable)
      .where(eq(monetaryCriteriaTable.id, monetaryConfig.criteriaId)).limit(1);

    // Buscar regra de juros
    let interestRuleCode = "NONE";
    if (interestConfig?.interestRuleId) {
      const [rule] = await db.select().from(interestRulesTable)
        .where(eq(interestRulesTable.id, interestConfig.interestRuleId)).limit(1);
      if (rule) interestRuleCode = rule.code;
    }

    const basePeriod = monetaryConfig.baseDate; // "YYYY-MM"
    const parties = await db.select().from(partiesTable).where(eq(partiesTable.caseId, caseId));

    // Mapa: criteria.code → índice de correção usado pelo correctionEngine
    // CONDENAT_GERAL preservado como "CONDENAT_GERAL" para que o engine aplique
    // a sequência histórica correta: UFIR (jul/1994-dez/2000) → IPCA-E (jan/2001+)
    const corrIndexMap: Record<string, string> = {
      CONDENAT_GERAL: "CONDENAT_GERAL",
      IPCA_E: "IPCA_E",
      PREV_I: "INPC",
      PREV_II: "INPC",
      PREV_III: "INPC",
      TRIBUTARIO: "SELIC",
      NONE: "NONE",
    };
    const correctionIndex = corrIndexMap[criteria.code] ?? "CONDENAT_GERAL";

    // Mapa: DB rule codes → historicalRates rule codes
    const ruleToInterestCode: Record<string, string> = {
      NONE: "NONE",
      SAVINGS: "JUROS_POUPANCA_CONDENAT",
      JUROS_POUPANCA_CONDENAT: "JUROS_POUPANCA_CONDENAT",
      JUROS_POUPANCA_PREV: "JUROS_POUPANCA_PREV",
      JUROS_1PCT: "JUROS_1PCT",
      "JUROS_0.5PCT": "JUROS_0.5PCT",
      JUROS_SELIC: "JUROS_SELIC",
      SELIC: "JUROS_SELIC",
      SIMPLE_6_YEAR: "JUROS_0.5PCT",
      SIMPLE_12_YEAR: "JUROS_1PCT",
      SIMPLE_1_MONTH: "JUROS_1PCT",
      LEGAL_RATE: "JUROS_1PCT",
      MIXED_6_12: "JUROS_POUPANCA_CONDENAT",
    };
    const mappedRuleCode = ruleToInterestCode[interestRuleCode] ?? "JUROS_POUPANCA_CONDENAT";

    // Data da citação (início dos juros)
    const citationPeriod = interestConfig?.startDate
      ? interestConfig.startDate.substring(0, 7)
      : "1900-01"; // fallback: sem citação → juros desde a parcela

    let grandTotalGross = 0;
    const partyResults = [];

    for (const party of parties) {
      const installments = await db.select().from(partyInstallmentsTable)
        .where(eq(partyInstallmentsTable.partyId, party.id));

      let partyTotalA = 0;
      let partyTotalC = 0;
      let partyTotalE = 0;
      let partyTotalG = 0;
      let partyTotalH = 0;

      for (const inst of installments) {
        try {
          // Motor bifásico Projef Web: C=A×B, E=C×D, G=(C+E)×F, H=C+E+G
          const result = computeInstallmentProjectef(
            inst.period,
            parseFloat(inst.principalAmount),
            inst.originalCurrency ?? "BRL",
            correctionIndex,
            mappedRuleCode,
            citationPeriod,
            basePeriod
          );

          // Persistir resultados — nova arquitetura com B_conv e B_corr separados
          await db.update(partyInstallmentsTable)
            .set({
              // A permanece como valor original (principalAmount já é o valor na moeda histórica)
              originalAmountInCurrency: String(result.A.toFixed(10)),
              // Colunas Projef Web
              updatedPrincipal: String(result.C.toFixed(6)),   // C = A × B (BRL)
              updatedInterest: String(result.E.toFixed(6)),    // E = C × D
              updatedSelic: String(result.G.toFixed(6)),       // G = (C+E) × F
              totalUpdated: String(result.H.toFixed(6)),       // H = C+E+G
              // B decomposto
              accumulatedFactor: String(result.B.toFixed(10)),       // B = B_conv × B_corr
              currencyFactor: String(result.B_conv.toFixed(12)),     // B_conv (conversão histórica)
              correctionFactor: String(result.B_corr.toFixed(10)),   // B_corr (IPCA-E/INPC)
              // Histórico de conversão monetária (passos individuais)
              currencyConversionHistory: result.audit.currencyConversionSteps.length > 0
                ? result.audit.currencyConversionSteps as any
                : null,
              // Memória de cálculo auditável completa
              correctionMemory: {
                // Cabeçalho
                period: result.period,
                originalCurrency: result.originalCurrency,
                phase: result.audit.phase,
                correctionIndex: result.audit.correctionIndex,
                interestRuleCode: result.audit.interestRuleCode,
                citationPeriod: result.audit.citationPeriod,
                settlementPeriod: result.audit.settlementPeriod,
                // Colunas Projef Web
                A: result.A,
                B_conv: result.B_conv,
                B_corr: result.B_corr,
                B: result.B,
                C: result.C,
                D: result.D,
                E: result.E,
                F: result.F,
                G: result.G,
                H: result.H,
                // Início efetivo da correção monetária em BRL
                bCorrStartPeriod: result.audit.bCorrStartPeriod,
                // Registros mês a mês
                currencyConversionSteps: result.audit.currencyConversionSteps,
                correctionRecords: result.audit.correctionRecords,
                interestRecords: result.audit.interestRecords,
                selicRecords: result.audit.selicRecords,
              } as any,
              status: "computed",
            })
            .where(eq(partyInstallmentsTable.id, inst.id));

          // Log de conversão monetária histórica (passos individuais na tabela separada)
          if (result.audit.currencyConversionSteps?.length) {
            // Limpar logs anteriores para esta parcela antes de re-inserir
            await db.delete(currencyConversionLogsTable)
              .where(eq(currencyConversionLogsTable.installmentId, inst.id));
            for (const step of result.audit.currencyConversionSteps) {
              await db.insert(currencyConversionLogsTable).values({
                installmentId: inst.id,
                originalCurrency: step.fromCurrency,
                convertedCurrency: step.toCurrency,
                transitionDate: step.transitionDate,
                appliedFactor: String(step.appliedFactor),
                amountBefore: String(step.amountBefore.toFixed(10)),
                amountAfter: String(step.amountAfter.toFixed(10)),
                notes: step.legalNote,
              });
            }
          }

          partyTotalA += result.A;
          partyTotalC += result.C;
          partyTotalE += result.E;
          partyTotalG += result.G;
          partyTotalH += result.H;
        } catch (instErr) {
          console.error(`[cases] Erro ao calcular parcela ${inst.id}:`, instErr);
          await db.update(partyInstallmentsTable)
            .set({ status: "error" })
            .where(eq(partyInstallmentsTable.id, inst.id));
        }
      }

      // Atualizar totais da parte (C=corrigido, E=juros, G=Selic, H=total)
      await db.update(partiesTable)
        .set({
          totalPrincipal: String(partyTotalC.toFixed(6)),  // principal corrigido
          totalInterest: String(partyTotalE.toFixed(6)),   // juros até 12/2021
          totalSelic: String(partyTotalG.toFixed(6)),      // Selic pós-12/2021
          totalUpdated: String(partyTotalH.toFixed(6)),    // total H
          installmentCount: installments.length,
          updatedAt: new Date(),
        })
        .where(eq(partiesTable.id, party.id));

      grandTotalGross += partyTotalH;
      partyResults.push({ partyId: party.id, name: party.name, totalUpdated: partyTotalH });
    }

    // Atualizar status do case
    await db.update(calculationCasesTable)
      .set({ status: "computed", computedAt: new Date(), updatedAt: new Date() })
      .where(eq(calculationCasesTable.id, caseId));

    await auditCase(caseId, "compute", "calculation_cases", caseId, { grandTotalGross, partyCount: parties.length });

    return res.json({
      ok: true,
      grandTotalGross: parseFloat(grandTotalGross.toFixed(2)),
      partyResults,
    });
  } catch (err) {
    console.error("[cases] Erro ao computar:", err);
    return res.status(500).json({ error: "Erro ao executar cálculo" });
  }
});

// ============================================================
// RELATÓRIO
// ============================================================

router.post("/:id/report", async (req, res) => {
  try {
    const caseId = parseInt(req.params.id);
    const full = await getCaseFull(caseId);
    if (!full) return res.status(404).json({ error: "Caso não encontrado" });

    const { case: kase, processData, monetaryConfig, interestConfig, parties, fees, succumbencies, finalMeta } = full;

    // Buscar critério e regra de juros
    let criteriaName = "—";
    let criteriaCode: string | undefined;
    if (monetaryConfig?.criteriaId) {
      const [c] = await db.select().from(monetaryCriteriaTable).where(eq(monetaryCriteriaTable.id, monetaryConfig.criteriaId)).limit(1);
      if (c) { criteriaName = c.name; criteriaCode = c.code; }
    }

    let ruleName = "—";
    if (interestConfig?.interestRuleId) {
      const [r] = await db.select().from(interestRulesTable).where(eq(interestRulesTable.id, interestConfig.interestRuleId)).limit(1);
      if (r) ruleName = r.code; // usar code para descrJuros()
    }

    // Preparar partes no formato Projef Web — nova arquitetura B_conv × B_corr
    const partesForReport = parties.map((p) => {
      let totalA = 0, totalC = 0, totalE = 0, totalG = 0, totalH = 0;
      const parcelas = (p.installments as any[]).map((inst: any, idx: number) => {
        // Lê os valores da memória de cálculo auditável (salva pelo compute)
        const mem = inst.correctionMemory as Record<string, any> | null;
        const A        = mem?.A        ?? parseFloat(inst.principalAmount);
        const B_conv   = mem?.B_conv   ?? parseFloat(inst.currencyFactor  ?? "1");
        const B_corr   = mem?.B_corr   ?? parseFloat(inst.correctionFactor ?? "1");
        const B        = mem?.B        ?? parseFloat(inst.accumulatedFactor ?? "1");
        const C        = mem?.C        ?? parseFloat(inst.updatedPrincipal ?? "0");
        const D        = mem?.D        ?? 0;
        const E        = mem?.E        ?? parseFloat(inst.updatedInterest ?? "0");
        const F        = mem?.F        ?? 0;
        const G        = mem?.G        ?? parseFloat(inst.updatedSelic ?? "0");
        const H        = mem?.H        ?? parseFloat(inst.totalUpdated ?? "0");
        const originalCurrency = mem?.originalCurrency ?? inst.originalCurrency ?? "BRL";
        const phase    = mem?.phase    ?? 1;
        const bCorrStartPeriod        = mem?.bCorrStartPeriod        ?? inst.period;
        const currencyConversionSteps = mem?.currencyConversionSteps ?? [];
        const correctionRecords       = mem?.correctionRecords       ?? [];
        const interestRecords         = mem?.interestRecords         ?? [];
        const selicRecords            = mem?.selicRecords            ?? [];
        totalA += A; totalC += C; totalE += E; totalG += G; totalH += H;
        return {
          seq: idx + 1,
          period: inst.period,
          A, B_conv, B_corr, B, C, D, E, F, G, H,
          originalCurrency,
          phase,
          bCorrStartPeriod,
          currencyConversionSteps,
          correctionRecords,
          interestRecords,
          selicRecords,
        };
      });
      return {
        nome: p.name,
        cpfCnpj: p.cpfCnpj ?? undefined,
        parcelas,
        totalA,
        totalC,
        totalE,
        totalG,
        totalH,
      };
    });

    const totalGross = partesForReport.reduce((s, p) => s + p.totalH, 0);
    const totalFees = fees.reduce((s, f) => s + parseFloat(f.computedAmount ?? "0"), 0);
    const totalSucc = succumbencies.reduce((s, sc) => s + parseFloat(sc.computedAmount ?? sc.amount), 0);
    const totalNet = totalGross + totalFees + totalSucc;

    // Buscar nome do usuário para o relatório
    let userName: string | undefined;
    if (req.user?.userId) {
      const [u] = await db.select({ nome: users.nome, email: users.email })
        .from(users).where(eq(users.id, req.user.userId)).limit(1);
      userName = u?.nome ?? u?.email ?? undefined;
    }

    const html = generateCaseReportHTML({
      publicKey: kase.publicKey,
      userName,
      processData: {
        processNumber: processData?.processNumber ?? undefined,
        claimant: processData?.claimant ?? undefined,
        defendant: processData?.defendant ?? undefined,
        generalNotes: processData?.generalNotes ?? undefined,
      },
      monetaryConfig: {
        criteriaCode,
        criteriaName,
        baseDate: monetaryConfig?.baseDate ?? undefined,
      },
      interestConfig: {
        ruleName,
        startDate: interestConfig?.startDate?.substring(0, 7) ?? undefined,
      },
      partes: partesForReport,
      fees: fees.map((f) => ({
        feesType: f.feesType,
        computedAmount: parseFloat(f.computedAmount ?? "0"),
        description: undefined,
      })),
      succumbencies: succumbencies.map((s) => ({
        type: s.type,
        description: s.description ?? undefined,
        amount: parseFloat(s.amount),
        computedAmount: s.computedAmount ? parseFloat(s.computedAmount) : undefined,
      })),
      finalMetadata: {
        preparedBy: finalMeta?.preparedBy ?? undefined,
        institution: finalMeta?.institution ?? undefined,
        city: finalMeta?.city ?? undefined,
        stateUf: finalMeta?.stateUf ?? undefined,
        finalNotes: finalMeta?.finalNotes ?? undefined,
      },
      totalGross: parseFloat(totalGross.toFixed(2)),
      totalNet: parseFloat(totalNet.toFixed(2)),
      generatedAt: new Date(),
    });

    // Salvar relatório
    const [report] = await db.insert(caseReportsTable).values({
      caseId,
      format: "html",
      htmlContent: html,
      totalAmount: String(totalNet.toFixed(6)),
      generatedAt: new Date(),
    }).returning();

    await db.update(calculationCasesTable)
      .set({ status: "report_generated", updatedAt: new Date() })
      .where(eq(calculationCasesTable.id, caseId));

    await auditCase(caseId, "report", "calculation_cases", caseId, { format: "html", totalNet });

    return res.json({
      reportId: report.id,
      html,
      totalGross: parseFloat(totalGross.toFixed(2)),
      totalNet: parseFloat(totalNet.toFixed(2)),
    });
  } catch (err) {
    console.error("[cases] Erro ao gerar relatório:", err);
    return res.status(500).json({ error: "Erro ao gerar relatório" });
  }
});

// ── Helper: atualizar contadores da parte ─────────────────────────────────────
async function updatePartyCounters(partyId: number) {
  const installments = await db.select({ id: partyInstallmentsTable.id })
    .from(partyInstallmentsTable).where(eq(partyInstallmentsTable.partyId, partyId));
  const discounts = await db.select({ id: partyDiscountsTable.id })
    .from(partyDiscountsTable).where(eq(partyDiscountsTable.partyId, partyId));
  await db.update(partiesTable)
    .set({ installmentCount: installments.length, discountCount: discounts.length, updatedAt: new Date() })
    .where(eq(partiesTable.id, partyId));
}

export default router;
