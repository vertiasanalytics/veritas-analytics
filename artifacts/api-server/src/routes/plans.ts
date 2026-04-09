import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import { criarPixMP, criarPreferenciaMP, MP_CONFIGURED } from "../lib/mercadopago.js";
import { criarCobrancaBB, BB_CONFIGURED } from "../lib/bb-pix.js";

const router = Router();

// ─── EMV PIX local (fallback) ─────────────────────────────────────────────────
function emvField(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}
function crc16(str: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(str, "utf8")) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function sanitize(s: string, n: number) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 ]/g, "").trim().slice(0, n);
}
function buildPixEMV(chave: string, valor: number, txid: string): string {
  const txidSafe = txid.replace(/[^A-Za-z0-9]/g, "").slice(0, 25);
  const nome = sanitize("Veritas Analytics Ltda", 25);
  const cidade = sanitize("SAO PAULO", 15);
  const merchantInfo = emvField("26", emvField("00", "BR.GOV.BCB.PIX") + emvField("01", chave));
  const additional = emvField("62", emvField("05", txidSafe));
  const body =
    emvField("00", "01") + emvField("01", "12") + merchantInfo +
    emvField("52", "0000") + emvField("53", "986") +
    emvField("54", valor.toFixed(2)) + emvField("58", "BR") +
    emvField("59", nome) + emvField("60", cidade) + additional + "6304";
  return body + crc16(body);
}

// ─── Helper: ciclo atual YYYY-MM ─────────────────────────────────────────────
function getCurrentCycle(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Helper: ativar assinatura após pagamento confirmado ──────────────────────
export async function activateSubscription(userId: number, planId: number, txid: string) {
  const plan = (await db.execute(sql`SELECT * FROM plans WHERE id = ${planId}`)).rows[0] as any;
  if (!plan) throw new Error("Plano não encontrado");

  const allowAccumulation: boolean = plan.allow_accumulation !== false;
  const currentCycle = getCurrentCycle();

  await db.execute(sql`
    UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ${userId} AND status = 'active'
  `);

  const [newSub] = (await db.execute(sql`
    INSERT INTO subscriptions (user_id, plan_id, amount, status, starts_at, ends_at)
    VALUES (${userId}, ${planId}, ${plan.price_monthly}, 'active', NOW(), NOW() + INTERVAL '30 days')
    RETURNING id
  `)).rows as any[];

  const credits = Number(plan.credits_monthly);
  const existing = (await db.execute(sql`
    SELECT id, balance, subscription_balance, extra_balance FROM credit_wallets WHERE user_id = ${userId} LIMIT 1
  `)).rows[0] as any;

  if (existing) {
    // Planos sem acúmulo (ex: educacional): subscription_balance = créditos do plano (sem somar o anterior)
    // Planos com acúmulo: subscription_balance += créditos
    const prevSub   = allowAccumulation ? Number(existing.subscription_balance) : 0;
    const newSubBal = prevSub + credits;
    const newTotal  = Number(existing.extra_balance) + newSubBal;

    await db.execute(sql`
      UPDATE credit_wallets
      SET subscription_balance = ${newSubBal},
          balance              = ${newTotal},
          last_reset_cycle     = ${currentCycle},
          total_bought         = total_bought + ${credits},
          updated_at           = NOW()
      WHERE user_id = ${userId}
    `);
    await db.execute(sql`
      INSERT INTO credit_transactions (wallet_id, user_id, type, amount, balance_after, description, reference_id)
      VALUES (${existing.id}, ${userId}, 'subscription', ${credits}, ${newTotal},
              ${allowAccumulation
                ? `Créditos do plano ${plan.name} (${credits} cr/mês)`
                : `Ativação do plano ${plan.name} — ${credits} cr mensais (sem acúmulo de saldo anterior)`},
              ${`PLAN-${planId}-${newSub.id}-${txid}`})
    `);
  } else {
    const [w] = (await db.execute(sql`
      INSERT INTO credit_wallets (user_id, balance, subscription_balance, extra_balance, total_bought, total_used, last_reset_cycle)
      VALUES (${userId}, ${credits}, ${credits}, 0, ${credits}, 0, ${currentCycle}) RETURNING id
    `)).rows as any[];
    await db.execute(sql`
      INSERT INTO credit_transactions (wallet_id, user_id, type, amount, balance_after, description)
      VALUES (${w.id}, ${userId}, 'subscription', ${credits}, ${credits}, ${`Créditos do plano ${plan.name}`})
    `);
  }

  console.log(`[Plans] Assinatura ativada: user=${userId} plan=${plan.name} slug=${plan.slug} txid=${txid} +${credits}cr acumula=${allowAccumulation}`);
  return { plan, subscriptionId: newSub.id, credits };
}

// ─── Helpers de precificação ─────────────────────────────────────────────────
const PIX_DISCOUNT   = 0.05;  // 5% de desconto
const CARD_SURCHARGE = 0.05;  // 5% de acréscimo
const CARD_MAX_INSTALLMENTS = 3;

function round2(n: number) { return Math.round(n * 100) / 100; }

function planPricing(basePrice: number) {
  const base = Number(basePrice);
  const pixPrice  = round2(base * (1 - PIX_DISCOUNT));
  const cardPrice = round2(base * (1 + CARD_SURCHARGE));
  const card3x    = round2(cardPrice / CARD_MAX_INSTALLMENTS);
  return { base, pixPrice, cardPrice, card3x, maxInstallments: CARD_MAX_INSTALLMENTS };
}

// ─── GET /api/plans ── lista planos ativos + status do usuário ────────────────
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const rawPlans = (await db.execute(sql`
    SELECT * FROM plans WHERE active = TRUE ORDER BY display_order
  `)).rows;

  const plans = (rawPlans as any[]).map(p => ({
    ...p,
    pricing: planPricing(p.price_monthly),
  }));

  const sub = (await db.execute(sql`
    SELECT s.*, p.name AS plan_name, p.slug, p.credits_monthly, p.max_users, p.price_monthly
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ${userId} AND s.status = 'active'
    ORDER BY s.created_at DESC LIMIT 1
  `)).rows[0] ?? null;

  const wallet = (await db.execute(sql`
    SELECT balance, subscription_balance, extra_balance
    FROM credit_wallets WHERE user_id = ${userId} LIMIT 1
  `)).rows[0] as any ?? { balance: 0, subscription_balance: 0, extra_balance: 0 };

  const teamCount = (await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM users WHERE account_id = ${userId} AND ativo = TRUE
  `)).rows[0] as any;

  const pendingPlanPix = (await db.execute(sql`
    SELECT id, txid, valor, status, plan_id, pix_copia_cola, expires_at
    FROM pix_charges
    WHERE user_id = ${userId} AND plan_id IS NOT NULL AND status = 'pending' AND expires_at > NOW()
    ORDER BY created_at DESC LIMIT 1
  `)).rows[0] ?? null;

  res.json({
    plans,
    currentSubscription: sub,
    wallet,
    teamCount: Number(teamCount?.cnt ?? 1),
    pendingPlanPix,
  });
});

// ─── GET /api/plans/current ── assinatura atual ───────────────────────────────
router.get("/current", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const sub = (await db.execute(sql`
    SELECT s.*, p.name AS plan_name, p.slug, p.credits_monthly, p.max_users, p.price_monthly
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ${userId} AND s.status = 'active'
    ORDER BY s.created_at DESC LIMIT 1
  `)).rows[0] ?? null;
  res.json({ subscription: sub });
});

// ─── POST /api/plans/:id/subscribe ── cria cobrança Pix para o plano ──────────
router.post("/:id/subscribe", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const planId = Number(req.params.id);

  const plan = (await db.execute(sql`
    SELECT * FROM plans WHERE id = ${planId} AND active = TRUE
  `)).rows[0] as any;

  if (!plan) return res.status(404).json({ error: "Plano não encontrado." });

  const teamCount = (await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM users WHERE account_id = ${userId} AND ativo = TRUE
  `)).rows[0] as any;

  if (Number(teamCount?.cnt ?? 1) > Number(plan.max_users)) {
    return res.status(400).json({
      error: `Este plano permite até ${plan.max_users} usuário(s). Sua equipe tem ${teamCount.cnt} membros ativos.`,
    });
  }

  // Expira cobranças Pix de plano antigas do mesmo usuário
  await db.execute(sql`
    UPDATE pix_charges SET status = 'expired', updated_at = NOW()
    WHERE user_id = ${userId} AND plan_id IS NOT NULL AND status = 'pending'
  `);

  const txid = randomUUID().replace(/-/g, "").toUpperCase().slice(0, 32);

  // Usa o valor enviado pelo frontend (já calculado com desconto Pix e período correto)
  // Fallback para planPricing mensal caso o frontend não envie
  const { billing, valor: valorBody } = req.body ?? {};
  const valor = valorBody && Number(valorBody) > 0
    ? round2(Number(valorBody))
    : planPricing(plan.price_monthly).pixPrice;

  const periodLabel = billing === "anual" ? "Anual" : "Mensal";
  const chavePix = process.env.PIX_KEY ?? "";

  const [cliente] = (await db.execute(sql`
    SELECT nome, email FROM users WHERE id = ${userId} LIMIT 1
  `)).rows as any[];

  const tituloPix = `Plano ${plan.name} ${periodLabel} - Veritas Analytics`;

  let pixCopiaECola: string;
  let mpPaymentId: string | null = null;
  let pixQrBase64: string | null = null;

  if (MP_CONFIGURED) {
    try {
      const mp = await criarPixMP({
        txid,
        titulo: tituloPix,
        valor,
        pagadorEmail: cliente?.email ?? req.user!.email,
        pagadorNome:  cliente?.nome ?? undefined,
      });
      pixCopiaECola = mp.qrCode;
      pixQrBase64   = mp.qrCodeBase64;
      mpPaymentId   = mp.paymentId;
    } catch (err) {
      console.error("[Plans] Falha MP Pix, usando EMV local:", err);
      if (!chavePix) throw new Error("PIX_KEY não configurada e MP indisponível");
      pixCopiaECola = buildPixEMV(chavePix, valor, txid);
    }
  } else if (BB_CONFIGURED) {
    try {
      const bb = await criarCobrancaBB({
        txid, valor, chave: chavePix,
        descricao: `Plano ${plan.name} - Veritas Analytics`,
      });
      pixCopiaECola = bb.pixCopiaECola ?? buildPixEMV(chavePix, valor, txid);
    } catch (err) {
      console.error("[Plans] Falha BB Pix, usando EMV local:", err);
      pixCopiaECola = buildPixEMV(chavePix, valor, txid);
    }
  } else {
    if (!chavePix) throw new Error("Nenhum gateway de pagamento configurado (MP nem BB) e PIX_KEY ausente");
    pixCopiaECola = buildPixEMV(chavePix, valor, txid);
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await db.execute(sql`
    INSERT INTO pix_charges
      (user_id, txid, valor, creditos, status, package_id, pix_copia_cola, expires_at, mp_payment_id, pix_key, plan_id)
    VALUES
      (${userId}, ${txid}, ${valor}, ${plan.credits_monthly}, 'pending',
       ${'plan'}, ${pixCopiaECola}, ${expiresAt}, ${mpPaymentId}, ${chavePix}, ${planId})
  `);

  res.status(201).json({
    txid,
    valor,
    planName: plan.name,
    creditos: plan.credits_monthly,
    pixCopiaECola,
    pixQrBase64: pixQrBase64 ?? undefined,
    expiresAt,
    status: "pending",
    provider: mpPaymentId ? "mercadopago" : BB_CONFIGURED ? "bb" : "emv",
  });
});

// ─── GET /api/plans/pix/:txid ── consulta status da cobrança de plano ─────────
router.get("/pix/:txid", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { txid } = req.params;

  const [charge] = (await db.execute(sql`
    SELECT pc.*, p.name AS plan_name, p.credits_monthly
    FROM pix_charges pc
    LEFT JOIN plans p ON p.id = pc.plan_id
    WHERE pc.txid = ${txid} AND pc.user_id = ${userId} AND pc.plan_id IS NOT NULL
    LIMIT 1
  `)).rows as any[];

  if (!charge) return res.status(404).json({ error: "Cobrança não encontrada." });
  if (charge.status === "paid") return res.json({ status: "paid", txid, charge });

  // Polling Mercado Pago
  if (MP_CONFIGURED && charge.mp_payment_id) {
    try {
      const { consultarPagamentoMP } = await import("../lib/mercadopago.js");
      const mpStatus = await consultarPagamentoMP(charge.mp_payment_id);

      if (mpStatus === "approved") {
        await db.execute(sql`
          UPDATE pix_charges SET status = 'paid', paid_at = NOW(), updated_at = NOW()
          WHERE id = ${charge.id}
        `);
        await activateSubscription(userId, Number(charge.plan_id), txid);
        return res.json({ status: "paid", txid });
      } else if (mpStatus === "rejected" || mpStatus === "cancelled") {
        await db.execute(sql`
          UPDATE pix_charges SET status = 'expired', updated_at = NOW() WHERE id = ${charge.id}
        `);
        return res.json({ status: "expired", txid });
      }
    } catch {
      // silencioso
    }
  }

  res.json({ status: charge.status, txid });
});

// ─── POST /api/plans/pix/:txid/simulate ── simular pagamento (dev/demo) ───────
router.post("/pix/:txid/simulate", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { txid } = req.params;

  const [charge] = (await db.execute(sql`
    SELECT * FROM pix_charges WHERE txid = ${txid} AND user_id = ${userId} AND plan_id IS NOT NULL LIMIT 1
  `)).rows as any[];

  if (!charge) return res.status(404).json({ error: "Cobrança não encontrada." });
  if (charge.status !== "pending") return res.status(400).json({ error: "Cobrança já processada." });

  await db.execute(sql`
    UPDATE pix_charges SET status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = ${charge.id}
  `);

  const result = await activateSubscription(userId, Number(charge.plan_id), txid);

  res.json({
    message: `Pagamento confirmado. Plano ${result.plan.name} ativado com ${result.credits} créditos!`,
    status: "paid",
  });
});

// ─── POST /api/plans/:id/subscribe/checkout ── checkout por cartão (MP) ────────
router.post("/:id/subscribe/checkout", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const planId = Number(req.params.id);

  if (!MP_CONFIGURED) {
    return res.status(503).json({ error: "Pagamento por cartão indisponível no momento." });
  }

  const plan = (await db.execute(sql`
    SELECT * FROM plans WHERE id = ${planId} AND active = TRUE
  `)).rows[0] as any;

  if (!plan) return res.status(404).json({ error: "Plano não encontrado." });

  const teamCount = (await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM users WHERE account_id = ${userId} AND ativo = TRUE
  `)).rows[0] as any;

  if (Number(teamCount?.cnt ?? 1) > Number(plan.max_users)) {
    return res.status(400).json({
      error: `Este plano permite até ${plan.max_users} usuário(s). Sua equipe tem ${teamCount.cnt} membros ativos.`,
    });
  }

  // Expira cobranças pendentes de plano
  await db.execute(sql`
    UPDATE pix_charges SET status = 'expired', updated_at = NOW()
    WHERE user_id = ${userId} AND plan_id IS NOT NULL AND status = 'pending'
  `);

  const txid = randomUUID().replace(/-/g, "").toUpperCase().slice(0, 32);

  // Usa o valor e parcelas enviados pelo frontend (período correto: mensal ou anual)
  // Fallback para planPricing mensal caso o frontend não envie
  const { billing, valor: valorBody, maxInstallments: maxInstBody } = req.body ?? {};
  const fallback = planPricing(plan.price_monthly);
  const valor         = valorBody && Number(valorBody) > 0 ? round2(Number(valorBody)) : fallback.cardPrice;
  const maxInstallments = maxInstBody && Number(maxInstBody) > 0 ? Number(maxInstBody) : fallback.maxInstallments;
  const periodLabel   = billing === "anual" ? "Anual" : "Mensal";

  const [cliente] = (await db.execute(sql`
    SELECT nome, email FROM users WHERE id = ${userId} LIMIT 1
  `)).rows as any[];

  const origin = req.headers.origin ?? `https://${req.headers.host}`;
  const basePath = process.env.FRONTEND_BASE_PATH ?? "";

  const mp = await criarPreferenciaMP({
    txid,
    titulo: `Plano ${plan.name} ${periodLabel} - Veritas Analytics`,
    valor,
    maxInstallments,
    pagadorEmail: cliente?.email ?? req.user!.email,
    successUrl: `${origin}${basePath}/planos?payment=success&txid=${txid}`,
    failureUrl: `${origin}${basePath}/planos?payment=failure&txid=${txid}`,
    pendingUrl: `${origin}${basePath}/planos?payment=pending&txid=${txid}`,
    notificationUrl: `${origin}/api/webhooks/mp`,
  });

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await db.execute(sql`
    INSERT INTO pix_charges
      (user_id, txid, valor, creditos, status, package_id, pix_copia_cola, expires_at,
       mp_preference_id, payment_method, plan_id)
    VALUES
      (${userId}, ${txid}, ${valor}, ${plan.credits_monthly}, 'pending',
       ${'plan'}, ${'checkout'}, ${expiresAt},
       ${mp.preferenceId}, ${'card'}, ${planId})
  `);

  const isSandbox = (process.env.MERCADOPAGO_ACCESS_TOKEN ?? "").startsWith("TEST");
  const checkoutUrl = isSandbox ? mp.sandboxInitPoint : mp.initPoint;

  res.status(201).json({
    txid,
    valor,
    planName: plan.name,
    creditos: plan.credits_monthly,
    checkoutUrl,
    preferenceId: mp.preferenceId,
    expiresAt,
    status: "pending",
    provider: "mercadopago_card",
  });
});

// ─── DELETE /api/plans/cancel ── cancelar assinatura ──────────────────────────
router.delete("/cancel", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  await db.execute(sql`
    UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ${userId} AND status = 'active'
  `);
  res.json({ message: "Assinatura cancelada." });
});

// ─── POST /api/plans/educational/assign ── atribuir plano educacional (admin) ──
router.post("/educational/assign", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, institutionName } = req.body;
    if (!userId) return res.status(400).json({ error: "userId é obrigatório." });

    const plan = (await db.execute(sql`
      SELECT * FROM plans WHERE slug = 'educacional' AND active = TRUE LIMIT 1
    `)).rows[0] as any;

    if (!plan) return res.status(404).json({ error: "Plano Educacional não encontrado. Execute as migrações." });

    const targetUser = (await db.execute(sql`
      SELECT id, nome, email FROM users WHERE id = ${Number(userId)} LIMIT 1
    `)).rows[0] as any;

    if (!targetUser) return res.status(404).json({ error: "Usuário não encontrado." });

    // Atualiza institution_name se informado
    if (institutionName) {
      await db.execute(sql`
        UPDATE users SET nome = ${targetUser.nome} WHERE id = ${Number(userId)}
      `);
    }

    // Ativa a assinatura educacional (função já lida com no-accumulation e wallet reset)
    const result = await activateSubscription(Number(userId), plan.id, `ADMIN-EDU-${Date.now()}`);

    console.log(`[Plans] Plano Educacional atribuído: admin=${req.user!.userId} → user=${userId} nome=${targetUser.nome}`);

    res.json({
      message: `Plano Educacional atribuído com sucesso a ${targetUser.nome || targetUser.email}.`,
      user: targetUser,
      plan: result.plan,
      credits: result.credits,
    });
  } catch (err) {
    console.error("[Plans] Erro ao atribuir plano educacional:", err);
    res.status(500).json({ error: "Erro interno ao atribuir plano." });
  }
});

// ─── GET /api/plans/educational/subscribers ── lista assinantes educacionais ───
router.get("/educational/subscribers", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rows = (await db.execute(sql`
      SELECT
        u.id, u.nome, u.email, u.created_at AS user_created_at,
        s.id AS sub_id, s.starts_at, s.ends_at, s.status AS sub_status,
        cw.balance, cw.subscription_balance, cw.extra_balance,
        cw.total_used, cw.last_reset_cycle
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id AND p.slug = 'educacional'
      JOIN users u ON u.id = s.user_id
      LEFT JOIN credit_wallets cw ON cw.user_id = u.id
      WHERE s.status = 'active'
      ORDER BY s.starts_at DESC
    `)).rows;

    res.json({ subscribers: rows, total: rows.length });
  } catch (err) {
    console.error("[Plans] Erro ao listar assinantes educacionais:", err);
    res.status(500).json({ error: "Erro interno." });
  }
});

// ─── DELETE /api/plans/educational/revoke/:userId ── revogar plano educacional ─
router.delete("/educational/revoke/:userId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const targetUserId = Number(req.params.userId);

    await db.execute(sql`
      UPDATE subscriptions s
      SET status = 'cancelled'
      FROM plans p
      WHERE s.plan_id = p.id AND p.slug = 'educacional'
        AND s.user_id = ${targetUserId} AND s.status = 'active'
    `);

    res.json({ message: "Assinatura educacional revogada." });
  } catch (err) {
    console.error("[Plans] Erro ao revogar plano educacional:", err);
    res.status(500).json({ error: "Erro interno ao revogar plano." });
  }
});

export default router;
