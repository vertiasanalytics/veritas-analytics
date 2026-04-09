import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import bcrypt from "bcryptjs";

const router = Router();

function isMaster(req: Request): boolean {
  return (req.user as any)?.accountRole === "master" || (req.user as any)?.role === "admin";
}

// ─── GET /api/team ── listar membros da equipe ────────────────────────────────
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const members = (await db.execute(sql`
    SELECT id, nome, email, role, account_role, ativo, created_at, updated_at
    FROM users
    WHERE account_id = ${userId}
    ORDER BY account_role DESC, nome ASC
  `)).rows;

  const sub = (await db.execute(sql`
    SELECT s.*, p.max_users, p.name AS plan_name
    FROM subscriptions s JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ${userId} AND s.status = 'active'
    ORDER BY s.created_at DESC LIMIT 1
  `)).rows[0] as any ?? null;

  const maxUsers = Number(sub?.max_users ?? 1);
  const activeCount = members.filter((m: any) => m.ativo).length;

  res.json({
    members,
    maxUsers,
    activeCount,
    planName: sub?.plan_name ?? null,
    availableSlots: Math.max(maxUsers - activeCount, 0),
  });
});

// ─── POST /api/team ── adicionar membro ───────────────────────────────────────
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const sub = (await db.execute(sql`
    SELECT p.max_users FROM subscriptions s JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ${userId} AND s.status = 'active'
    ORDER BY s.created_at DESC LIMIT 1
  `)).rows[0] as any;

  if (!sub) {
    return res.status(400).json({ error: "Assine um plano para adicionar membros à equipe." });
  }

  const activeCount = Number((await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM users WHERE account_id = ${userId} AND ativo = TRUE
  `)).rows[0] as any).valueOf() || 1;

  if (activeCount >= Number(sub.max_users)) {
    return res.status(400).json({
      error: `Limite de ${sub.max_users} usuário(s) atingido. Faça upgrade do plano.`
    });
  }

  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ error: "nome, email e senha são obrigatórios." });
  }

  const existing = (await db.execute(sql`SELECT id FROM users WHERE email = ${email}`)).rows[0];
  if (existing) return res.status(409).json({ error: "E-mail já cadastrado." });

  const hash = await bcrypt.hash(senha, 10);
  const [member] = (await db.execute(sql`
    INSERT INTO users (nome, email, senha_hash, role, account_id, account_role, ativo)
    VALUES (${nome}, ${email}, ${hash}, 'user', ${userId}, 'member', TRUE)
    RETURNING id, nome, email, account_role, ativo, created_at
  `)).rows as any[];

  res.status(201).json({ message: "Membro adicionado.", member });
});

// ─── PUT /api/team/:id/toggle ── ativar/inativar membro ───────────────────────
router.put("/:id/toggle", requireAuth, async (req: Request, res: Response) => {
  const masterId = req.user!.userId;
  const memberId = Number(req.params.id);

  const target = (await db.execute(sql`
    SELECT id, ativo, account_role FROM users
    WHERE id = ${memberId} AND account_id = ${masterId}
  `)).rows[0] as any;

  if (!target) return res.status(404).json({ error: "Membro não encontrado." });
  if (target.account_role === "master") return res.status(400).json({ error: "Não é possível alterar o status do master." });

  if (!target.ativo) {
    const sub = (await db.execute(sql`
      SELECT p.max_users FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = ${masterId} AND s.status = 'active'
      ORDER BY s.created_at DESC LIMIT 1
    `)).rows[0] as any;
    const activeCount = Number((await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM users WHERE account_id = ${masterId} AND ativo = TRUE
    `)).rows[0] as any) || 1;
    if (sub && activeCount >= Number(sub.max_users)) {
      return res.status(400).json({ error: "Limite do plano atingido." });
    }
  }

  await db.execute(sql`UPDATE users SET ativo = ${!target.ativo}, updated_at = NOW() WHERE id = ${memberId}`);
  res.json({ message: `Membro ${!target.ativo ? "ativado" : "inativado"}.` });
});

// ─── PUT /api/team/:id/reset-password ── redefinir senha ─────────────────────
router.put("/:id/reset-password", requireAuth, async (req: Request, res: Response) => {
  const masterId = req.user!.userId;
  const memberId = Number(req.params.id);

  const target = (await db.execute(sql`
    SELECT id, account_role FROM users
    WHERE id = ${memberId} AND account_id = ${masterId}
  `)).rows[0] as any;

  if (!target) return res.status(404).json({ error: "Membro não encontrado." });
  if (target.account_role === "master") return res.status(400).json({ error: "Use o perfil para alterar sua própria senha." });

  const { senha } = req.body;
  if (!senha || senha.length < 6) return res.status(400).json({ error: "A nova senha deve ter ao menos 6 caracteres." });

  const hash = await bcrypt.hash(senha, 10);
  await db.execute(sql`UPDATE users SET senha_hash = ${hash}, updated_at = NOW() WHERE id = ${memberId}`);
  res.json({ message: "Senha redefinida com sucesso." });
});

// ─── DELETE /api/team/:id ── remover membro ───────────────────────────────────
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const masterId = req.user!.userId;
  const memberId = Number(req.params.id);

  const target = (await db.execute(sql`
    SELECT id, account_role FROM users
    WHERE id = ${memberId} AND account_id = ${masterId}
  `)).rows[0] as any;

  if (!target) return res.status(404).json({ error: "Membro não encontrado." });
  if (target.account_role === "master") return res.status(400).json({ error: "Não é possível remover o master." });

  await db.execute(sql`UPDATE users SET ativo = FALSE, updated_at = NOW() WHERE id = ${memberId}`);
  res.json({ message: "Membro removido." });
});

export default router;
