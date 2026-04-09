/**
 * support.ts — Rotas de Suporte Técnico
 * Veritas Analytics
 *
 * POST   /api/support          → abre chamado (autenticado)
 * GET    /api/support/count    → contagem de chamados abertos (admin) — para sino de notificação
 * GET    /api/support          → lista chamados (admin)
 * PATCH  /api/support/:id      → atualiza status/notas (admin)
 * DELETE /api/support/:id      → exclui chamado (admin)
 */

import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";

const router = Router();

// ─── POST /api/support ───────────────────────────────────────────────────────
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { nome, email, assunto, prioridade, modulo, descricao, steps } = req.body;

  if (!nome || !email || !assunto || !descricao) {
    return res.status(400).json({ ok: false, error: "Campos obrigatórios: nome, email, assunto, descricao" });
  }

  const userId = (req as any).user?.userId ?? null;

  try {
    const [ticket] = (await db.execute(sql`
      INSERT INTO support_tickets (user_id, nome, email, assunto, prioridade, modulo, descricao, steps, status)
      VALUES (
        ${userId},
        ${nome},
        ${email},
        ${assunto},
        ${prioridade ?? "normal"},
        ${modulo ?? null},
        ${descricao},
        ${steps ?? null},
        'aberto'
      )
      RETURNING id, created_at
    `)).rows as any[];

    res.json({
      ok: true,
      ticketId: ticket.id,
      message: `Chamado #${ticket.id} registrado com sucesso.`,
    });
  } catch (err) {
    console.error("[support] POST error:", err);
    res.status(500).json({ ok: false, error: "Erro ao registrar chamado" });
  }
});

// ─── GET /api/support/count ──────────────────────────────────────────────────
// Contagem rápida de chamados abertos/em andamento para o sino de notificação do admin
router.get("/count", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [row] = (await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('aberto', 'em_andamento'))        AS open_count,
        COUNT(*) FILTER (WHERE status = 'aberto' AND prioridade = 'critica') AS critical_count,
        COUNT(*) FILTER (WHERE status = 'aberto')                           AS new_count
      FROM support_tickets
    `)).rows as any[];

    res.json({
      ok: true,
      openCount:    Number(row.open_count    ?? 0),
      criticalCount: Number(row.critical_count ?? 0),
      newCount:     Number(row.new_count     ?? 0),
    });
  } catch (err) {
    console.error("[support] GET /count error:", err);
    res.status(500).json({ ok: false, error: "Erro ao contar chamados" });
  }
});

// ─── GET /api/support ────────────────────────────────────────────────────────
router.get("/", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = (await db.execute(sql`
      SELECT id, user_id, nome, email, assunto, prioridade, modulo,
             descricao, steps, status, admin_notes, created_at, updated_at
      FROM support_tickets
      ORDER BY
        CASE status WHEN 'aberto' THEN 0 WHEN 'em_andamento' THEN 1 ELSE 2 END,
        CASE prioridade WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
        created_at DESC
    `)).rows;

    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[support] GET error:", err);
    res.status(500).json({ ok: false, error: "Erro ao listar chamados" });
  }
});

// ─── PATCH /api/support/:id ──────────────────────────────────────────────────
router.patch("/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { status, admin_notes } = req.body;

  const validStatuses = ["aberto", "em_andamento", "resolvido", "fechado"];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ ok: false, error: "Status inválido" });
  }

  try {
    await db.execute(sql`
      UPDATE support_tickets
      SET
        status      = COALESCE(${status ?? null}, status),
        admin_notes = COALESCE(${admin_notes ?? null}, admin_notes),
        updated_at  = NOW()
      WHERE id = ${id}
    `);

    res.json({ ok: true, message: "Chamado atualizado" });
  } catch (err) {
    console.error("[support] PATCH error:", err);
    res.status(500).json({ ok: false, error: "Erro ao atualizar chamado" });
  }
});

// ─── DELETE /api/support/:id ─────────────────────────────────────────────────
router.delete("/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    await db.execute(sql`DELETE FROM support_tickets WHERE id = ${id}`);
    res.json({ ok: true, message: "Chamado excluído" });
  } catch (err) {
    console.error("[support] DELETE error:", err);
    res.status(500).json({ ok: false, error: "Erro ao excluir chamado" });
  }
});

export default router;
