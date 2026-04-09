import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth.js";
import { creditWallet } from "./wallet.js";
import { sendWhatsApp, msgPagamentoConfirmado } from "../lib/whatsapp.js";

const router = Router();

const PKG = { starter: "Starter", plus: "Plus", pro: "Pro" };

// ─── GET /api/admin/financial/summary ─────────────────────────────────────────
router.get("/summary", requireAdmin, async (_req: Request, res: Response) => {
  const kpis = (await db.execute(sql`
    SELECT
      COALESCE(SUM(valor) FILTER (WHERE status = 'paid'), 0)                                   AS receita_total,
      COALESCE(SUM(valor) FILTER (WHERE status = 'paid'
        AND paid_at >= date_trunc('month', NOW())), 0)                                         AS receita_mes_atual,
      COALESCE(SUM(valor) FILTER (WHERE status = 'paid'
        AND paid_at >= date_trunc('month', NOW() - INTERVAL '1 month')
        AND paid_at <  date_trunc('month', NOW())), 0)                                         AS receita_mes_anterior,
      COALESCE(SUM(valor) FILTER (WHERE status = 'pending' AND expires_at > NOW()), 0)         AS receita_pendente,
      COUNT(*) FILTER (WHERE status = 'paid')                                                  AS cobr_pagas,
      COUNT(*) FILTER (WHERE status = 'pending' AND expires_at > NOW())                        AS cobr_pendentes,
      COUNT(*) FILTER (WHERE status = 'expired' OR (status='pending' AND expires_at <= NOW())) AS cobr_expiradas,
      COUNT(*) FILTER (WHERE status = 'paid' AND paid_at >= date_trunc('month', NOW()))        AS vendas_mes,
      COALESCE(SUM(creditos) FILTER (WHERE status = 'paid'), 0)                               AS creditos_vendidos,
      COALESCE(SUM(creditos) FILTER (WHERE status = 'paid'
        AND paid_at >= date_trunc('month', NOW())), 0)                                         AS creditos_mes,
      COUNT(DISTINCT user_id) FILTER (WHERE status = 'paid')                                  AS clientes_ativos
    FROM pix_charges
  `)).rows[0] as any;

  const pagas     = Number(kpis?.cobr_pagas ?? 0);
  const pendentes = Number(kpis?.cobr_pendentes ?? 0);
  const expiradas = Number(kpis?.cobr_expiradas ?? 0);
  const total     = pagas + pendentes + expiradas;
  const recTotal  = Number(kpis?.receita_total ?? 0);
  const recMesAnt = Number(kpis?.receita_mes_anterior ?? 0);
  const recMesAt  = Number(kpis?.receita_mes_atual ?? 0);

  res.json({
    receitaTotal:        recTotal,
    receitaMesAtual:     recMesAt,
    receitaMesAnterior:  recMesAnt,
    variacaoMes:         recMesAnt > 0 ? ((recMesAt - recMesAnt) / recMesAnt) * 100 : null,
    receitaPendente:     Number(kpis?.receita_pendente ?? 0),
    cobrancasPagas:      pagas,
    cobrancasPendentes:  pendentes,
    cobrancasExpiradas:  expiradas,
    vendasMesAtual:      Number(kpis?.vendas_mes ?? 0),
    creditosVendidos:    Number(kpis?.creditos_vendidos ?? 0),
    creditosVendidosMes: Number(kpis?.creditos_mes ?? 0),
    clientesAtivos:      Number(kpis?.clientes_ativos ?? 0),
    ticketMedio:         pagas > 0 ? recTotal / pagas : 0,
    taxaConversao:       total > 0 ? Math.round((pagas / total) * 1000) / 10 : 0,
  });
});

// ─── GET /api/admin/financial/monthly ─────────────────────────────────────────
router.get("/monthly", requireAdmin, async (_req: Request, res: Response) => {
  const rows = (await db.execute(sql`
    SELECT
      TO_CHAR(date_trunc('month', paid_at), 'YYYY-MM') AS mes,
      TO_CHAR(date_trunc('month', paid_at), 'Mon/YY')  AS mes_label,
      COUNT(*)::int                                     AS vendas,
      COALESCE(SUM(valor), 0)                           AS receita,
      COALESCE(SUM(creditos), 0)::int                   AS creditos
    FROM pix_charges
    WHERE status = 'paid' AND paid_at >= NOW() - INTERVAL '12 months'
    GROUP BY date_trunc('month', paid_at)
    ORDER BY date_trunc('month', paid_at) ASC
  `)).rows;

  res.json(rows.map((r: any) => ({
    mes: r.mes, mesLabel: r.mes_label,
    vendas: Number(r.vendas), receita: Number(r.receita), creditos: Number(r.creditos),
  })));
});

// ─── GET /api/admin/financial/packages ────────────────────────────────────────
router.get("/packages", requireAdmin, async (_req: Request, res: Response) => {
  const rows = (await db.execute(sql`
    SELECT package_id,
      COUNT(*)::int               AS vendas,
      COALESCE(SUM(valor), 0)     AS receita,
      COALESCE(SUM(creditos), 0)::int AS creditos
    FROM pix_charges WHERE status = 'paid'
    GROUP BY package_id ORDER BY receita DESC
  `)).rows;

  res.json(rows.map((r: any) => ({
    packageId: r.package_id, nome: PKG[r.package_id as keyof typeof PKG] ?? r.package_id,
    vendas: Number(r.vendas), receita: Number(r.receita), creditos: Number(r.creditos),
  })));
});

// ─── GET /api/admin/financial/top-customers ───────────────────────────────────
router.get("/top-customers", requireAdmin, async (_req: Request, res: Response) => {
  const rows = (await db.execute(sql`
    SELECT u.id, u.nome, u.email, u.tipo_pessoa,
      COUNT(pc.id)::int                AS total_compras,
      COALESCE(SUM(pc.valor), 0)       AS total_gasto,
      COALESCE(SUM(pc.creditos), 0)::int AS total_creditos,
      COALESCE(cw.balance, 0)          AS saldo_atual,
      MAX(pc.paid_at)                  AS ultima_compra
    FROM pix_charges pc
    JOIN users u ON u.id = pc.user_id
    LEFT JOIN credit_wallets cw ON cw.user_id = pc.user_id
    WHERE pc.status = 'paid'
    GROUP BY u.id, u.nome, u.email, u.tipo_pessoa, cw.balance
    ORDER BY total_gasto DESC LIMIT 10
  `)).rows;

  res.json(rows.map((r: any) => ({
    id: r.id, nome: r.nome, email: r.email, tipoPessoa: r.tipo_pessoa,
    totalCompras: Number(r.total_compras), totalGasto: Number(r.total_gasto),
    totalCreditos: Number(r.total_creditos), saldoAtual: Number(r.saldo_atual ?? 0),
    ultimaCompra: r.ultima_compra,
  })));
});

// ─── GET /api/admin/financial/charges ─────────────────────────────────────────
// Usa condições condicionais inline para evitar sql.raw dinâmico
router.get("/charges", requireAdmin, async (req: Request, res: Response) => {
  const {
    status    = "all",
    packageId = "all",
    from      = null,
    to        = null,
    search    = null,
    page      = "1",
    limit     = "20",
  } = req.query as Record<string, string | null>;

  const pageNum  = Math.max(1, parseInt(page ?? "1"));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? "20")));
  const offset   = (pageNum - 1) * limitNum;

  // Filtros inline — drizzle aceita null como "sem filtro"
  const statusFilter    = status    === "all" ? null : status;
  const packageFilter   = packageId === "all" ? null : packageId;
  const searchFilter    = search    ? `%${search}%` : null;
  const fromFilter      = from      ? new Date(from)  : null;
  const toFilter        = to        ? new Date(to + "T23:59:59") : null;
  const expiredFilter   = status    === "expired";

  const rows = (await db.execute(sql`
    SELECT
      pc.id, pc.txid, pc.valor, pc.creditos, pc.status, pc.package_id,
      pc.expires_at, pc.paid_at, pc.created_at, pc.mp_payment_id, pc.user_id,
      u.nome, u.email, u.tipo_pessoa
    FROM pix_charges pc
    JOIN users u ON u.id = pc.user_id
    WHERE
      (${statusFilter}::text IS NULL OR
        CASE WHEN ${expiredFilter} THEN
          (pc.status = 'expired' OR (pc.status = 'pending' AND pc.expires_at <= NOW()))
        ELSE pc.status = ${statusFilter}::text END)
      AND (${packageFilter}::text IS NULL OR pc.package_id = ${packageFilter}::text)
      AND (${fromFilter}::timestamptz IS NULL OR pc.created_at >= ${fromFilter}::timestamptz)
      AND (${toFilter}::timestamptz  IS NULL OR pc.created_at <= ${toFilter}::timestamptz)
      AND (${searchFilter}::text IS NULL OR u.nome ILIKE ${searchFilter}::text OR u.email ILIKE ${searchFilter}::text)
    ORDER BY pc.created_at DESC
    LIMIT ${limitNum} OFFSET ${offset}
  `)).rows;

  const countRow = (await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM pix_charges pc
    JOIN users u ON u.id = pc.user_id
    WHERE
      (${statusFilter}::text IS NULL OR
        CASE WHEN ${expiredFilter} THEN
          (pc.status = 'expired' OR (pc.status = 'pending' AND pc.expires_at <= NOW()))
        ELSE pc.status = ${statusFilter}::text END)
      AND (${packageFilter}::text IS NULL OR pc.package_id = ${packageFilter}::text)
      AND (${fromFilter}::timestamptz IS NULL OR pc.created_at >= ${fromFilter}::timestamptz)
      AND (${toFilter}::timestamptz  IS NULL OR pc.created_at <= ${toFilter}::timestamptz)
      AND (${searchFilter}::text IS NULL OR u.nome ILIKE ${searchFilter}::text OR u.email ILIKE ${searchFilter}::text)
  `)).rows[0] as any;

  const total = Number(countRow?.total ?? 0);

  res.json({
    total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum),
    charges: rows.map((r: any) => ({
      id: r.id, txid: r.txid, valor: Number(r.valor), creditos: Number(r.creditos),
      status: r.status === "pending" && new Date(r.expires_at) <= new Date() ? "expired" : r.status,
      packageId: r.package_id, packageNome: PKG[r.package_id as keyof typeof PKG] ?? r.package_id,
      expiresAt: r.expires_at, paidAt: r.paid_at, createdAt: r.created_at,
      mpPaymentId: r.mp_payment_id ?? null, userId: Number(r.user_id),
      nome: r.nome, email: r.email, tipoPessoa: r.tipo_pessoa,
    })),
  });
});

// ─── POST /api/admin/financial/pix/:txid/confirm ──────────────────────────────
// Admin confirma manualmente o recebimento do Pix e libera créditos ao usuário
router.post("/pix/:txid/confirm", requireAdmin, async (req: Request, res: Response) => {
  const { txid } = req.params;

  const [charge] = (await db.execute(sql`
    SELECT * FROM pix_charges WHERE txid = ${txid} LIMIT 1
  `)).rows as any[];

  if (!charge) {
    res.status(404).json({ error: "Cobrança não encontrada" });
    return;
  }
  if (charge.status === "paid") {
    res.status(400).json({ error: "Cobrança já confirmada" });
    return;
  }

  // Marcar cobrança como paga
  await db.execute(sql`
    UPDATE pix_charges SET status = 'paid', paid_at = NOW(), updated_at = NOW()
    WHERE id = ${charge.id}
  `);

  // Creditar carteira do usuário
  const pkg = PKG[charge.package_id as keyof typeof PKG] ?? charge.package_id;
  const creditos = Number(charge.creditos);
  const novoSaldo = await creditWallet(
    Number(charge.user_id),
    creditos,
    "purchase",
    `Compra de créditos — Pacote ${pkg} (R$ ${Number(charge.valor).toFixed(2)}) — Confirmado pelo admin`,
    txid
  );

  // Buscar dados do cliente para a notificação
  const [cliente] = (await db.execute(sql`SELECT nome, email FROM users WHERE id = ${charge.user_id} LIMIT 1`)).rows as any[];

  // Notificação WhatsApp de confirmação (fire-and-forget)
  sendWhatsApp(msgPagamentoConfirmado({
    nomeCliente: cliente?.nome ?? "Desconhecido",
    emailCliente: cliente?.email ?? "",
    packageName: pkg,
    valor: Number(charge.valor),
    creditos,
  })).catch(() => {});

  res.json({ message: "Pagamento confirmado e créditos liberados", creditos, novoSaldo, txid });
});

// ─── POST /api/admin/financial/mp/:mpPaymentId/reprocessar ────────────────────
// Busca a cobrança pelo ID do MP, verifica o status e libera créditos se aprovado
router.post("/mp/:mpPaymentId/reprocessar", requireAdmin, async (req: Request, res: Response) => {
  const { mpPaymentId } = req.params;
  const MP_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN ?? "";

  if (!MP_TOKEN) {
    res.status(503).json({ error: "Mercado Pago não configurado" });
    return;
  }

  // Consulta diretamente o MP
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
  });
  if (!mpRes.ok) {
    res.status(404).json({ error: "Pagamento não encontrado no Mercado Pago" });
    return;
  }
  const mpPayment = await mpRes.json() as any;

  if (mpPayment.status !== "approved") {
    res.status(400).json({ error: `Pagamento não aprovado no MP. Status atual: ${mpPayment.status}` });
    return;
  }

  // Obtém o txid a partir do item id nos additional_info
  const txidFromItem = mpPayment.additional_info?.items?.[0]?.id as string | undefined;

  // Procura a cobrança no banco pelo mp_payment_id ou pelo txid
  const [charge] = (await db.execute(sql`
    SELECT * FROM pix_charges
    WHERE mp_payment_id = ${mpPaymentId}
       OR txid = ${txidFromItem ?? ""}
    LIMIT 1
  `)).rows as any[];

  if (!charge) {
    res.status(404).json({
      error: "Cobrança não encontrada no banco",
      dica: "Verifique se o txid foi registrado antes do pagamento",
      txidEncontradoNoMP: txidFromItem,
    });
    return;
  }
  if (charge.status === "paid") {
    res.status(400).json({ error: "Créditos já foram liberados para esta cobrança" });
    return;
  }

  await db.execute(sql`
    UPDATE pix_charges SET status = 'paid', paid_at = NOW(), updated_at = NOW()
    WHERE id = ${charge.id}
  `);

  const pkg = PKG[charge.package_id as keyof typeof PKG] ?? charge.package_id;
  const creditos = Number(charge.creditos);
  const novoSaldo = await creditWallet(
    Number(charge.user_id), creditos, "purchase",
    `Pix aprovado no MP — Pacote ${pkg} (R$ ${Number(charge.valor).toFixed(2)}) — Reprocessado pelo admin`,
    charge.txid
  );

  const [cliente] = (await db.execute(sql`SELECT nome, email FROM users WHERE id = ${charge.user_id} LIMIT 1`)).rows as any[];
  sendWhatsApp(msgPagamentoConfirmado({
    nomeCliente: cliente?.nome ?? "Desconhecido",
    emailCliente: cliente?.email ?? "",
    packageName: pkg, valor: Number(charge.valor), creditos,
  })).catch(() => {});

  res.json({
    message: `Créditos liberados com sucesso`,
    mpPaymentId, txid: charge.txid,
    cliente: cliente?.email,
    creditos, novoSaldo,
  });
});

export default router;
