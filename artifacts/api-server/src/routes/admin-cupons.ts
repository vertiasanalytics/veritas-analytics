import { Router, type Request, type Response } from "express";
import { requireAdmin, requireAuth } from "../middlewares/auth.js";
import { pool } from "@workspace/db";

const router = Router();

function genCode(percentual: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `DESC${percentual}-${suffix}`;
}

// ─── GET /api/admin/cupons ────────────────────────────────────────────────────
router.get("/", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await pool.query(
      `SELECT c.id, c.code, c.percentual, c.ativo, c.created_at,
              u.nome AS criado_por_nome
       FROM coupons c
       LEFT JOIN users u ON u.id = c.criado_por
       ORDER BY c.created_at DESC`
    );
    return res.json(rows.rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/admin/cupons ───────────────────────────────────────────────────
router.post("/", requireAdmin, async (req: Request, res: Response) => {
  const { percentual } = req.body;
  const pct = Number(percentual);
  if (!pct || pct <= 0 || pct > 100) {
    return res.status(400).json({ error: "Percentual deve ser entre 1 e 100." });
  }
  const adminId = (req as any).user?.id ?? null;
  let code = "";
  let attempts = 0;
  while (attempts < 10) {
    code = genCode(pct);
    const exists = await pool.query("SELECT 1 FROM coupons WHERE code = $1", [code]);
    if (exists.rows.length === 0) break;
    attempts++;
  }
  try {
    const row = await pool.query(
      `INSERT INTO coupons (code, percentual, ativo, criado_por)
       VALUES ($1, $2, true, $3)
       RETURNING id, code, percentual, ativo, created_at`,
      [code, pct, adminId]
    );
    return res.status(201).json(row.rows[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/admin/cupons/:id ────────────────────────────────────────────
router.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query("UPDATE coupons SET ativo = false WHERE id = $1", [id]);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/cupons/:id/reativar ──────────────────────────────────────
router.post("/:id/reativar", requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query("UPDATE coupons SET ativo = true WHERE id = $1", [id]);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/cupons/validar (pública com auth) ──────────────────────────────
// Usada pelo checkout para validar o cupom antes de confirmar compra
router.post("/validar", requireAuth, async (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Código ausente." });
  try {
    const row = await pool.query(
      "SELECT id, code, percentual FROM coupons WHERE UPPER(code) = UPPER($1) AND ativo = true",
      [String(code).trim()]
    );
    if (row.rows.length === 0) {
      return res.status(404).json({ valid: false, error: "Cupom inválido ou inativo." });
    }
    const c = row.rows[0];
    return res.json({ valid: true, code: c.code, percentual: c.percentual, description: `${c.percentual}% de desconto` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
