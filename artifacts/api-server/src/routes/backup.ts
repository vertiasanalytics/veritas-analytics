/**
 * backup.ts — Rotas de Backup e Restauração
 * Veritas Analytics — Sistema de Cálculos Judiciais Federais
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { backupsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function buildUserBackup(userId: number): Promise<object> {
  const [profile] = (await db.execute(sql`
    SELECT id, nome, email, role, tipo_pessoa, cpf_cnpj, profissao, telefone,
           razao_social, inscricao_estadual, data_nascimento, ativo, created_at
    FROM users WHERE id = ${userId}
  `)).rows;

  const saves = (await db.execute(sql`
    SELECT id, public_key, calc_state, user_id, created_at
    FROM previdenciario_saves WHERE user_id = ${userId} ORDER BY created_at DESC
  `)).rows;

  const wallet = (await db.execute(sql`
    SELECT balance, subscription_balance, extra_balance
    FROM credit_wallets WHERE user_id = ${userId} LIMIT 1
  `)).rows[0] ?? null;

  const subscription = (await db.execute(sql`
    SELECT s.id, s.user_id, s.plan_id, s.status, s.starts_at, s.ends_at,
           p.name AS plan_name, p.slug AS plan_slug
    FROM subscriptions s JOIN plans p ON s.plan_id = p.id
    WHERE s.user_id = ${userId} AND s.status = 'active' LIMIT 1
  `)).rows[0] ?? null;

  return {
    profile,
    previdenciarioSaves: saves,
    wallet,
    subscription,
  };
}

async function buildFullBackup(): Promise<object> {
  const users = (await db.execute(sql`
    SELECT id, nome, email, role, tipo_pessoa, cpf_cnpj, profissao, telefone,
           razao_social, ativo, created_at FROM users ORDER BY id
  `)).rows;

  const subscriptions = (await db.execute(sql`
    SELECT s.*, p.name AS plan_name, p.slug FROM subscriptions s
    JOIN plans p ON s.plan_id = p.id ORDER BY s.id
  `)).rows;

  const wallets = (await db.execute(sql`
    SELECT user_id, balance, subscription_balance, extra_balance, updated_at
    FROM credit_wallets ORDER BY user_id
  `)).rows;

  const saves = (await db.execute(sql`SELECT * FROM previdenciario_saves ORDER BY id`)).rows;
  const calculations = (await db.execute(sql`SELECT * FROM calculations ORDER BY id`)).rows;
  const cases = (await db.execute(sql`SELECT * FROM calculation_cases ORDER BY id`)).rows;

  const statsUsers = (await db.execute(sql`SELECT COUNT(*) AS total FROM users`)).rows[0];
  const statsCases = (await db.execute(sql`SELECT COUNT(*) AS total FROM calculation_cases`)).rows[0];

  return {
    system: {
      exportedAt: new Date().toISOString(),
      totalUsers: (statsUsers as any)?.total,
      totalCases: (statsCases as any)?.total,
    },
    users,
    subscriptions,
    wallets,
    previdenciarioSaves: saves,
    calculations,
    cases,
  };
}

// ─── POST /api/backup/create ──────────────────────────────────────────────────
router.post("/create", requireAuth, async (req: any, res) => {
  try {
    const { destination, scope, label } = req.body as {
      destination: "cloud" | "local";
      scope?: "user" | "full";
      label?: string;
    };

    if (!destination || !["cloud", "local"].includes(destination)) {
      return res.status(400).json({ error: "destination deve ser 'cloud' ou 'local'" });
    }

    const isAdmin = req.user!.role === "admin";
    const effectiveScope = isAdmin && scope === "full" ? "full" : "user";
    const reqUserId: number = req.user!.userId;

    const data = effectiveScope === "full"
      ? await buildFullBackup()
      : await buildUserBackup(reqUserId);

    const payload = {
      version: "1.0",
      scope: effectiveScope,
      createdAt: new Date().toISOString(),
      createdBy: { id: reqUserId, email: req.user!.email },
      data,
    };

    const jsonStr = JSON.stringify(payload);
    const sizeBytes = Buffer.byteLength(jsonStr, "utf8");

    const autoLabel = label?.trim() || `${effectiveScope === "full" ? "Sistema Completo" : "Meus Dados"} — ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

    if (destination === "cloud") {
      const [backup] = (await db.insert(backupsTable).values({
        userId: reqUserId,
        scope: effectiveScope,
        label: autoLabel,
        sizeBytes,
        data: payload,
      }).returning()) as any[];

      return res.json({ success: true, destination: "cloud", backupId: backup.id, label: autoLabel, sizeBytes });
    } else {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="veritas-backup-${Date.now()}.json"`);
      return res.send(jsonStr);
    }
  } catch (err: any) {
    console.error("[backup] create error:", err);
    res.status(500).json({ error: err.message ?? "Erro ao criar backup" });
  }
});

// ─── GET /api/backup/list ─────────────────────────────────────────────────────
router.get("/list", requireAuth, async (req: any, res) => {
  try {
    const isAdmin = req.user!.role === "admin";
    const reqUserId: number = req.user!.userId;
    const rows = isAdmin
      ? (await db.execute(sql`
          SELECT b.id, b.user_id, b.scope, b.label, b.size_bytes, b.restored_at, b.created_at,
                 u.nome AS user_nome, u.email AS user_email
          FROM backups b JOIN users u ON b.user_id = u.id
          ORDER BY b.created_at DESC LIMIT 50
        `)).rows
      : (await db.execute(sql`
          SELECT id, user_id, scope, label, size_bytes, restored_at, created_at
          FROM backups WHERE user_id = ${reqUserId}
          ORDER BY created_at DESC LIMIT 20
        `)).rows;

    res.json(rows);
  } catch (err: any) {
    console.error("[backup] list error:", err);
    res.status(500).json({ error: err.message ?? "Erro ao listar backups" });
  }
});

// ─── GET /api/backup/download/:id ─────────────────────────────────────────────
router.get("/download/:id", requireAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const isAdmin = req.user!.role === "admin";

    const [row] = (await db.select().from(backupsTable).where(eq(backupsTable.id, id))).slice(0, 1) as any[];
    if (!row) return res.status(404).json({ error: "Backup não encontrado" });

    if (!isAdmin && row.userId !== req.user!.userId) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    const filename = `veritas-backup-${row.scope}-${row.id}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(JSON.stringify(row.data, null, 2));
  } catch (err: any) {
    console.error("[backup] download error:", err);
    res.status(500).json({ error: err.message ?? "Erro ao baixar backup" });
  }
});

// ─── POST /api/backup/restore/:id (from cloud) ────────────────────────────────
router.post("/restore/:id", requireAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const isAdmin = req.user!.role === "admin";
    const reqUserId: number = req.user!.userId;

    const [row] = (await db.select().from(backupsTable).where(eq(backupsTable.id, id))).slice(0, 1) as any[];
    if (!row) return res.status(404).json({ error: "Backup não encontrado" });

    if (!isAdmin && row.userId !== reqUserId) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    const result = await applyRestore(row.data as any, reqUserId, isAdmin);

    await db.execute(sql`UPDATE backups SET restored_at = NOW() WHERE id = ${id}`);

    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[backup] restore error:", err);
    res.status(500).json({ error: err.message ?? "Erro ao restaurar backup" });
  }
});

// ─── POST /api/backup/restore-upload (upload JSON from PC) ────────────────────
router.post("/restore-upload", requireAuth, async (req: any, res) => {
  try {
    const payload = req.body;
    if (!payload?.version || !payload?.data) {
      return res.status(400).json({ error: "Arquivo de backup inválido ou corrompido" });
    }

    const isAdmin = req.user!.role === "admin";
    const result = await applyRestore(payload, req.user!.userId, isAdmin);

    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[backup] restore-upload error:", err);
    res.status(500).json({ error: err.message ?? "Erro ao restaurar do arquivo" });
  }
});

// ─── DELETE /api/backup/:id ───────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const isAdmin = req.user!.role === "admin";
    const reqUserId: number = req.user!.userId;

    const [row] = (await db.select().from(backupsTable).where(eq(backupsTable.id, id))).slice(0, 1) as any[];
    if (!row) return res.status(404).json({ error: "Backup não encontrado" });

    if (!isAdmin && row.userId !== reqUserId) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    await db.delete(backupsTable).where(eq(backupsTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    console.error("[backup] delete error:", err);
    res.status(500).json({ error: err.message ?? "Erro ao excluir backup" });
  }
});

// ─── Core restore logic ───────────────────────────────────────────────────────
async function applyRestore(
  payload: {
    version: string;
    scope: string;
    createdAt: string;
    createdBy: { id: number; email: string };
    data: any;
  },
  requestingUserId: number,
  isAdmin: boolean,
): Promise<{ restoredItems: Record<string, number> }> {
  const restoredItems: Record<string, number> = {
    profile: 0,
    previdenciarioSaves: 0,
  };

  const { data } = payload;

  // ── Profile (update non-sensitive fields only) ────────────────────────────
  if (data.profile && typeof data.profile === "object") {
    const p = data.profile as any;
    await db.execute(sql`
      UPDATE users SET
        nome = COALESCE(${p.nome ?? null}, nome),
        tipo_pessoa = COALESCE(${p.tipo_pessoa ?? null}, tipo_pessoa),
        cpf_cnpj = COALESCE(${p.cpf_cnpj ?? null}, cpf_cnpj),
        profissao = COALESCE(${p.profissao ?? null}, profissao),
        telefone = COALESCE(${p.telefone ?? null}, telefone),
        razao_social = COALESCE(${p.razao_social ?? null}, razao_social),
        inscricao_estadual = COALESCE(${p.inscricao_estadual ?? null}, inscricao_estadual),
        data_nascimento = COALESCE(${p.data_nascimento ?? null}, data_nascimento)
      WHERE id = ${requestingUserId}
    `);
    restoredItems.profile = 1;
  }

  // ── Previdenciário saves — columns: id, public_key, calc_state, user_id, created_at
  const saves: any[] = Array.isArray(data.previdenciarioSaves) ? data.previdenciarioSaves : [];
  for (const save of saves) {
    try {
      const calcState = save.calc_state ?? save.calcState ?? save.wizard_data ?? save.wizardData ?? {};
      const publicKey = save.public_key ?? save.publicKey ?? `RST-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await db.execute(sql`
        INSERT INTO previdenciario_saves (user_id, public_key, calc_state, created_at)
        VALUES (
          ${requestingUserId},
          ${publicKey},
          ${JSON.stringify(calcState)}::jsonb,
          ${save.created_at ?? new Date().toISOString()}
        )
        ON CONFLICT (public_key) DO NOTHING
      `);
      restoredItems.previdenciarioSaves++;
    } catch (_) {}
  }

  return { restoredItems };
}

export default router;
