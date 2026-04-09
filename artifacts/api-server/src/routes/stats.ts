import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { users, calculationCasesTable } from "@workspace/db/schema";
import { count, eq, sql } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/admin", requireAdmin, async (_req: Request, res: Response) => {
  const [userCount] = await db.select({ total: count() }).from(users).where(eq(users.ativo, true));
  const [calcCount] = await db.select({ total: count() }).from(calculationCasesTable);

  // Cobranças Pix (pacotes de crédito avulso)
  const pixStats = (await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'paid') AS charges_paid,
      COUNT(*) FILTER (WHERE status = 'pending' AND expires_at > NOW()) AS charges_pending,
      COUNT(*) FILTER (WHERE status = 'expired' OR (status = 'pending' AND expires_at <= NOW())) AS charges_expired,
      COALESCE(SUM(creditos) FILTER (WHERE status = 'paid'), 0) AS total_creditos_vendidos,
      COALESCE(SUM(valor) FILTER (WHERE status = 'paid'), 0) AS receita_pix,
      COALESCE(SUM(valor) FILTER (WHERE status = 'pending' AND expires_at > NOW()), 0) AS receita_pendente
    FROM pix_charges
  `)).rows[0] as {
    charges_paid: string;
    charges_pending: string;
    charges_expired: string;
    total_creditos_vendidos: string;
    receita_pix: string;
    receita_pendente: string;
  };

  // Receita de assinaturas ativas/pagas
  const subStats = (await db.execute(sql`
    SELECT COALESCE(SUM(amount), 0) AS receita_assinaturas
    FROM subscriptions
    WHERE status = 'active'
  `)).rows[0] as { receita_assinaturas: string };

  const receitaTotal = Number(pixStats?.receita_pix ?? 0) + Number(subStats?.receita_assinaturas ?? 0);

  // Últimas 5 vendas (pacotes avulso)
  const recentSales = (await db.execute(sql`
    SELECT pc.txid, pc.valor, pc.creditos, pc.package_id, pc.paid_at, u.nome, u.email
    FROM pix_charges pc
    JOIN users u ON u.id = pc.user_id
    WHERE pc.status = 'paid'
    ORDER BY pc.paid_at DESC LIMIT 5
  `)).rows;

  // Usuários com mais créditos comprados
  const topUsers = (await db.execute(sql`
    SELECT u.nome, u.email, cw.balance, cw.total_bought, cw.total_used
    FROM credit_wallets cw
    JOIN users u ON u.id = cw.user_id
    ORDER BY cw.total_bought DESC LIMIT 5
  `)).rows;

  res.json({
    userCount: userCount?.total ?? 0,
    calcCount: calcCount?.total ?? 0,
    chargesPaid: Number(pixStats?.charges_paid ?? 0),
    chargesPending: Number(pixStats?.charges_pending ?? 0),
    chargesExpired: Number(pixStats?.charges_expired ?? 0),
    creditosTotalVendidos: Number(pixStats?.total_creditos_vendidos ?? 0),
    receitaTotal,
    receitaPendente: Number(pixStats?.receita_pendente ?? 0),
    recentSales,
    topUsers,
  });
});

router.get("/user", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const walletRows = (await db.execute(sql`
    SELECT balance, total_bought, total_used FROM credit_wallets WHERE user_id = ${userId} LIMIT 1
  `)).rows as { balance: number; total_bought: number; total_used: number }[];

  const wallet = walletRows[0];

  // Conta apenas os cálculos do próprio usuário
  const [calcCount] = await db
    .select({ total: count() })
    .from(calculationCasesTable)
    .where(eq(calculationCasesTable.userId, userId));

  res.json({
    credits: wallet ? Number(wallet.balance) : 0,
    creditsUsed: wallet ? Number(wallet.total_used) : 0,
    creditsBought: wallet ? Number(wallet.total_bought) : 0,
    calcCount: calcCount?.total ?? 0,
  });
});

export default router;
