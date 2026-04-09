import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import { randomUUID } from "crypto";
import { sendWhatsApp, msgNovaVenda } from "../lib/whatsapp.js";
import { criarCobrancaBB, BB_CONFIGURED } from "../lib/bb-pix.js";
import { criarPixMP, criarPreferenciaMP, MP_CONFIGURED } from "../lib/mercadopago.js";

// ─── EMV BR Code (Pix Copia e Cola) ──────────────────────────────────────────
function emvField(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16ccitt(str: string): string {
  let crc = 0xffff;
  const buf = Buffer.from(str, "utf8");
  for (const byte of buf) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function sanitize(str: string, maxLen: number): string {
  return str
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .slice(0, maxLen);
}

function buildPixEMV(chave: string, valor: number, txid: string): string {
  const txidSafe = txid.replace(/[^A-Za-z0-9]/g, "").slice(0, 25);
  const nome     = sanitize("Veritas Analytics Ltda", 25);
  const cidade   = sanitize("SAO PAULO", 15);

  const merchantInfo = emvField("26",
    emvField("00", "BR.GOV.BCB.PIX") +
    emvField("01", chave)
  );

  const additional = emvField("62", emvField("05", txidSafe));

  const body =
    emvField("00", "01") +
    emvField("01", "12") +
    merchantInfo +
    emvField("52", "0000") +
    emvField("53", "986") +
    emvField("54", valor.toFixed(2)) +
    emvField("58", "BR") +
    emvField("59", nome) +
    emvField("60", cidade) +
    additional +
    "6304";

  return body + crc16ccitt(body);
}

const router = Router();

// ─── Pacotes de créditos disponíveis ─────────────────────────────────────────
export const CREDIT_PACKAGES = [
  { id: "starter", name: "Starter",  credits: 50,  price: 100.00, bonus: 0,  popular: false },
  { id: "plus",    name: "Plus",     credits: 120, price: 150.00, bonus: 10, popular: true  },
  { id: "pro",     name: "Pro",      credits: 280, price: 280.00, bonus: 30, popular: false },
];

// ─── Helpers: auto-criar carteira ────────────────────────────────────────────
async function getOrCreateWallet(userId: number) {
  const [existing] = (await db.execute(
    sql`SELECT id, balance, subscription_balance, extra_balance, total_bought, total_used FROM credit_wallets WHERE user_id = ${userId} LIMIT 1`
  )).rows as { id: number; balance: number; subscription_balance: number; extra_balance: number; total_bought: number; total_used: number }[];

  if (existing) return existing;

  const [created] = (await db.execute(
    sql`INSERT INTO credit_wallets (user_id, balance, subscription_balance, extra_balance, total_bought, total_used) VALUES (${userId}, 0, 0, 0, 0, 0) RETURNING id, balance, subscription_balance, extra_balance, total_bought, total_used`
  )).rows as { id: number; balance: number; subscription_balance: number; extra_balance: number; total_bought: number; total_used: number }[];
  return created;
}

async function creditWallet(userId: number, amount: number, type: string, description: string, referenceId?: string) {
  const wallet = await getOrCreateWallet(userId);
  const balanceAfter = Number(wallet.balance) + amount;
  const totalBought = amount > 0 ? Number(wallet.total_bought) + amount : Number(wallet.total_bought);
  const totalUsed   = amount < 0 ? Number(wallet.total_used) + Math.abs(amount) : Number(wallet.total_used);

  // Para compras e doações, incrementa extra_balance; para débitos, consome subscription primeiro
  let newSubBal = Number(wallet.subscription_balance);
  let newExtraBal = Number(wallet.extra_balance);

  if (amount > 0 && (type === "purchase" || type === "grant")) {
    newExtraBal += amount;
  }

  await db.execute(sql`
    UPDATE credit_wallets
    SET balance = ${balanceAfter}, subscription_balance = ${newSubBal}, extra_balance = ${newExtraBal},
        total_bought = ${totalBought}, total_used = ${totalUsed}, updated_at = NOW()
    WHERE id = ${wallet.id}
  `);
  await db.execute(sql`
    INSERT INTO credit_transactions (wallet_id, user_id, type, amount, balance_after, description, reference_id)
    VALUES (${wallet.id}, ${userId}, ${type}, ${amount}, ${balanceAfter}, ${description}, ${referenceId ?? null})
  `);
  return balanceAfter;
}

// ─── Verifica e credita automaticamente charges aprovados no MP ───────────────
async function autoConfirmarPendentes(userId: number) {
  if (!MP_CONFIGURED) return;
  try {
    const pendentes = (await db.execute(sql`
      SELECT id, txid, creditos, package_id, mp_payment_id, status
      FROM pix_charges
      WHERE user_id = ${userId} AND status = 'pending'
        AND mp_payment_id IS NOT NULL AND mp_payment_id <> ''
        AND expires_at > NOW() - INTERVAL '2 hours'
    `)).rows as any[];

    const { consultarPagamentoMP } = await import("../lib/mercadopago.js");
    for (const ch of pendentes) {
      try {
        const mpStatus = await consultarPagamentoMP(ch.mp_payment_id);
        if (mpStatus === "approved") {
          await db.execute(sql`
            UPDATE pix_charges SET status = 'paid', paid_at = NOW(), updated_at = NOW()
            WHERE id = ${ch.id} AND status = 'pending'
          `);
          const creditos = Number(ch.creditos);
          const pkg = CREDIT_PACKAGES.find((p) => p.id === ch.package_id);
          await creditWallet(
            userId, creditos, "purchase",
            `Pix aprovado — Pacote ${pkg?.name ?? ch.package_id} (Mercado Pago)`,
            ch.txid
          );
          console.log(`[AutoConfirm] txid=${ch.txid} mp_id=${ch.mp_payment_id} → ${creditos}cr creditados ao user ${userId}`);
        } else if (mpStatus === "rejected" || mpStatus === "cancelled") {
          await db.execute(sql`UPDATE pix_charges SET status = 'expired', updated_at = NOW() WHERE id = ${ch.id}`);
        }
      } catch {
        // ignora erros individuais — não bloqueia o carregamento
      }
    }
  } catch {
    // silencioso
  }
}

// ─── Helper: reset mensal para planos sem acúmulo (ex: educacional) ───────────
function getCurrentCycle(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function applyEducationalResetIfNeeded(userId: number, walletId: number): Promise<void> {
  // Busca assinatura ativa e verifica se o plano não permite acúmulo
  const sub = (await db.execute(sql`
    SELECT s.id, p.slug, p.allow_accumulation, p.credits_monthly
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ${userId} AND s.status = 'active'
    ORDER BY s.created_at DESC LIMIT 1
  `)).rows[0] as any;

  if (!sub || sub.allow_accumulation !== false) return;

  // Verifica o ciclo atual vs. o ciclo do último reset
  const currentCycle = getCurrentCycle();
  const walletRow = (await db.execute(sql`
    SELECT last_reset_cycle, subscription_balance FROM credit_wallets WHERE id = ${walletId} LIMIT 1
  `)).rows[0] as any;

  if (!walletRow || walletRow.last_reset_cycle === currentCycle) return;

  // Ciclo mudou → zera subscription_balance e define novos créditos mensais
  const creditos = Number(sub.credits_monthly);
  const extraBal = (await db.execute(sql`
    SELECT extra_balance FROM credit_wallets WHERE id = ${walletId}
  `)).rows[0] as any;
  const newTotal = creditos + Number(extraBal?.extra_balance ?? 0);

  await db.execute(sql`
    UPDATE credit_wallets
    SET subscription_balance = ${creditos},
        balance              = ${newTotal},
        last_reset_cycle     = ${currentCycle},
        updated_at           = NOW()
    WHERE id = ${walletId}
  `);

  await db.execute(sql`
    INSERT INTO credit_transactions
      (wallet_id, user_id, type, amount, balance_after, description, reference_id)
    VALUES
      (${walletId}, ${userId}, 'subscription', ${creditos}, ${newTotal},
       ${`Reset mensal automático do ciclo ${currentCycle} — Plano Educacional (sem acúmulo)`},
       ${'MONTHLY_RESET_' + currentCycle})
  `);

  console.log(`[Wallet] Reset mensal educacional aplicado: user=${userId} ciclo=${currentCycle} +${creditos}cr`);
}

// ─── GET /api/wallet ──────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  // Verifica silenciosamente se há pagamentos aprovados no MP ainda não creditados
  await autoConfirmarPendentes(userId);

  const wallet = await getOrCreateWallet(userId);

  // Aplica reset mensal automático para planos sem acúmulo (ex: educacional)
  await applyEducationalResetIfNeeded(userId, wallet.id);

  // Relê após possível reset
  const walletFresh = await getOrCreateWallet(userId);

  // Busca metadados do plano ativo para o frontend
  const planMeta = (await db.execute(sql`
    SELECT p.slug, p.allow_accumulation, p.educational_watermark
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ${userId} AND s.status = 'active'
    ORDER BY s.created_at DESC LIMIT 1
  `)).rows[0] as any ?? null;

  const transactions = (await db.execute(sql`
    SELECT id, type, amount, balance_after, description, reference_id, created_at
    FROM credit_transactions WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT 10
  `)).rows;

  const pending = (await db.execute(sql`
    SELECT id, txid, valor, creditos, status, package_id, pix_copia_cola, expires_at, created_at
    FROM pix_charges WHERE user_id = ${userId} AND status = 'pending' AND expires_at > NOW()
    ORDER BY created_at DESC LIMIT 3
  `)).rows;

  res.json({
    balance: walletFresh.balance,
    subscriptionBalance: walletFresh.subscription_balance,
    extraBalance: walletFresh.extra_balance,
    totalBought: walletFresh.total_bought,
    totalUsed: walletFresh.total_used,
    transactions,
    pendingCharges: pending,
    packages: CREDIT_PACKAGES,
    // Metadados do plano para comportamento educacional no frontend
    planSlug:             planMeta?.slug ?? null,
    allowAccumulation:    planMeta?.allow_accumulation ?? true,
    educationalWatermark: planMeta?.educational_watermark ?? false,
  });
});

// ─── GET /api/wallet/transactions ────────────────────────────────────────────
router.get("/transactions", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;

  const rows = (await db.execute(sql`
    SELECT id, type, amount, balance_after, description, reference_id, created_at
    FROM credit_transactions WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
  `)).rows;

  res.json(rows);
});

// ─── POST /api/wallet/purchase ───────────────────────────────────────────────
router.post("/purchase", requireAuth, async (req: Request, res: Response) => {
  const { packageId } = req.body;
  const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) {
    res.status(400).json({ error: "Pacote inválido" });
    return;
  }

  const userId = req.user!.userId;
  const txid = randomUUID().replace(/-/g, "").toUpperCase().slice(0, 32);

  // Buscar dados do cliente para usar no Mercado Pago
  const [cliente] = (await db.execute(sql`SELECT nome, email FROM users WHERE id = ${userId} LIMIT 1`)).rows as any[];

  const chavePix = process.env.PIX_KEY ?? "";
  const tituloCredito = `Pacote ${pkg.name} - Veritas Analytics (${pkg.credits + pkg.bonus} créditos)`;
  let pixCopiaECola: string;
  let mpPaymentId: string | null = null;
  let pixQrBase64: string | null = null;

  // Prioridade 1: Mercado Pago (confirmação automática via webhook)
  if (MP_CONFIGURED) {
    try {
      const mpResult = await criarPixMP({
        txid,
        titulo:       tituloCredito,
        valor:        pkg.price,
        pagadorEmail: cliente?.email ?? req.user!.email,
        pagadorNome:  cliente?.nome ?? undefined,
      });
      pixCopiaECola = mpResult.qrCode;
      pixQrBase64   = mpResult.qrCodeBase64;
      mpPaymentId   = mpResult.paymentId;
    } catch (err) {
      console.error("[Wallet] Falha MP Pix, usando EMV local:", err);
      if (!chavePix) throw new Error("PIX_KEY não configurada e MP indisponível");
      pixCopiaECola = buildPixEMV(chavePix, pkg.price, txid);
    }
  // Prioridade 2: BB API
  } else if (BB_CONFIGURED) {
    try {
      const cobranca = await criarCobrancaBB({
        txid,
        valor:    pkg.price,
        chave:    chavePix,
        descricao: `Pacote ${pkg.name} - Veritas Analytics`,
      });
      pixCopiaECola = cobranca.pixCopiaECola ?? buildPixEMV(chavePix, pkg.price, txid);
    } catch (err) {
      console.error("[Wallet] Falha BB Pix, usando EMV local:", err);
      pixCopiaECola = buildPixEMV(chavePix, pkg.price, txid);
    }
  // Fallback: EMV local (geração offline)
  } else {
    if (!chavePix) throw new Error("Nenhum gateway de pagamento configurado e PIX_KEY ausente");
    pixCopiaECola = buildPixEMV(chavePix, pkg.price, txid);
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

  await db.execute(sql`
    INSERT INTO pix_charges (user_id, txid, valor, creditos, status, package_id, pix_copia_cola, expires_at, mp_payment_id, pix_key)
    VALUES (${userId}, ${txid}, ${pkg.price}, ${pkg.credits + pkg.bonus}, 'pending', ${pkg.id}, ${pixCopiaECola}, ${expiresAt}, ${mpPaymentId}, ${chavePix})
  `);

  // Notificação WhatsApp (fire-and-forget)
  sendWhatsApp(msgNovaVenda({
    nomeCliente: cliente?.nome ?? "Desconhecido",
    emailCliente: cliente?.email ?? req.user!.email,
    packageName: pkg.name,
    valor: pkg.price,
    creditos: pkg.credits + pkg.bonus,
  })).catch(() => {});

  res.status(201).json({
    txid,
    valor: pkg.price,
    creditos: pkg.credits + pkg.bonus,
    packageName: pkg.name,
    pixCopiaECola,
    pixQrBase64: pixQrBase64 ?? undefined,
    expiresAt,
    status: "pending",
    provider: mpPaymentId ? "mercadopago" : BB_CONFIGURED ? "bb" : "emv",
  });
});

// ─── POST /api/wallet/purchase/checkout ── compra de créditos via cartão (MP) ─
router.post("/purchase/checkout", requireAuth, async (req: Request, res: Response) => {
  const { packageId } = req.body;
  const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) return res.status(400).json({ error: "Pacote inválido" });

  if (!MP_CONFIGURED) {
    return res.status(503).json({ error: "Pagamento por cartão indisponível no momento." });
  }

  const userId = req.user!.userId;
  const txid = randomUUID().replace(/-/g, "").toUpperCase().slice(0, 32);

  const [cliente] = (await db.execute(sql`SELECT nome, email FROM users WHERE id = ${userId} LIMIT 1`)).rows as any[];

  const origin = req.headers.origin ?? `https://${req.headers.host}`;
  const basePath = process.env.FRONTEND_BASE_PATH ?? "";

  const mp = await criarPreferenciaMP({
    txid,
    titulo: `Pacote ${pkg.name} - Veritas Analytics (${pkg.credits + pkg.bonus} créditos)`,
    valor:  pkg.price,
    pagadorEmail: cliente?.email ?? req.user!.email,
    successUrl: `${origin}${basePath}/creditos?payment=success&txid=${txid}`,
    failureUrl: `${origin}${basePath}/creditos?payment=failure&txid=${txid}`,
    pendingUrl: `${origin}${basePath}/creditos?payment=pending&txid=${txid}`,
    notificationUrl: `${origin}/api/webhooks/mp`,
  });

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await db.execute(sql`
    INSERT INTO pix_charges
      (user_id, txid, valor, creditos, status, package_id, pix_copia_cola, expires_at,
       mp_preference_id, payment_method)
    VALUES
      (${userId}, ${txid}, ${pkg.price}, ${pkg.credits + pkg.bonus}, 'pending',
       ${pkg.id}, ${'checkout'}, ${expiresAt}, ${mp.preferenceId}, ${'card'})
  `);

  const isSandbox = (process.env.MERCADOPAGO_ACCESS_TOKEN ?? "").startsWith("TEST");
  const checkoutUrl = isSandbox ? mp.sandboxInitPoint : mp.initPoint;

  res.status(201).json({
    txid,
    valor: pkg.price,
    creditos: pkg.credits + pkg.bonus,
    packageName: pkg.name,
    checkoutUrl,
    preferenceId: mp.preferenceId,
    expiresAt,
    status: "pending",
    provider: "mercadopago_card",
  });
});

// ─── GET /api/wallet/pix/:txid ────────────────────────────────────────────────
router.get("/pix/:txid", requireAuth, async (req: Request, res: Response) => {
  const { txid } = req.params;
  const userId = req.user!.userId;

  const [charge] = (await db.execute(sql`
    SELECT id, txid, valor, creditos, status, package_id, pix_copia_cola, expires_at, paid_at, created_at
    FROM pix_charges WHERE txid = ${txid} AND user_id = ${userId} LIMIT 1
  `)).rows as any[];

  if (!charge) {
    res.status(404).json({ error: "Cobrança não encontrada" });
    return;
  }

  // Se ainda pendente, consulta a API em tempo real para pegar status atualizado
  if (charge.status === "pending") {
    // Prioridade 1: Mercado Pago
    if (MP_CONFIGURED && charge.mp_payment_id) {
      try {
        const { consultarPagamentoMP } = await import("../lib/mercadopago.js");
        const mpStatus = await consultarPagamentoMP(charge.mp_payment_id);

        if (mpStatus === "approved") {
          await db.execute(sql`
            UPDATE pix_charges SET status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = ${charge.id}
          `);
          const creditos = Number(charge.creditos);
          const pkg = CREDIT_PACKAGES.find((p) => p.id === charge.package_id);
          await creditWallet(
            userId, creditos, "purchase",
            `Pix aprovado — Pacote ${pkg?.name ?? charge.package_id} (Mercado Pago)`,
            txid
          );
          charge.status = "paid";
          charge.paid_at = new Date().toISOString();
          console.log(`[MP Poll] Pix ${txid} aprovado → ${creditos} cr para user ${userId}`);
        } else if (mpStatus === "rejected" || mpStatus === "cancelled") {
          await db.execute(sql`UPDATE pix_charges SET status = 'expired', updated_at = NOW() WHERE id = ${charge.id}`);
          charge.status = "expired";
        }
      } catch {
        // Silencioso
      }
    // Prioridade 2: BB
    } else if (BB_CONFIGURED) {
      try {
        const { consultarCobrancaBB, bbStatusParaLocal } = await import("../lib/bb-pix.js");
        const bbCob = await consultarCobrancaBB(txid);
        const novoStatus = bbStatusParaLocal(bbCob.status);

        if (novoStatus === "paid") {
          await db.execute(sql`
            UPDATE pix_charges SET status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = ${charge.id}
          `);
          const creditos = Number(charge.creditos);
          const pkg = CREDIT_PACKAGES.find((p) => p.id === charge.package_id);
          await creditWallet(
            userId, creditos, "purchase",
            `Compra de créditos — Pacote ${pkg?.name ?? charge.package_id} (Pix BB automático)`,
            txid
          );
          charge.status = "paid";
          charge.paid_at = new Date().toISOString();
        } else if (novoStatus === "expired") {
          await db.execute(sql`UPDATE pix_charges SET status = 'expired', updated_at = NOW() WHERE id = ${charge.id}`);
          charge.status = "expired";
        }
      } catch {
        // Silencioso
      }
    }
  }

  res.json(charge);
});

// ─── POST /api/wallet/pix/:txid/simulate ─────────────────────────────────────
// Simula confirmação de pagamento Pix (desenvolvimento / demo)
router.post("/pix/:txid/simulate", requireAuth, async (req: Request, res: Response) => {
  const { txid } = req.params;
  const userId = req.user!.userId;

  const [charge] = (await db.execute(sql`
    SELECT * FROM pix_charges WHERE txid = ${txid} AND user_id = ${userId} LIMIT 1
  `)).rows as any[];

  if (!charge) {
    res.status(404).json({ error: "Cobrança não encontrada" });
    return;
  }
  if (charge.status !== "pending") {
    res.status(400).json({ error: "Cobrança já processada" });
    return;
  }

  // Marcar como pago
  await db.execute(sql`
    UPDATE pix_charges SET status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = ${charge.id}
  `);

  // Creditar carteira
  const [pkg] = CREDIT_PACKAGES.filter((p) => p.id === charge.package_id);
  const creditos = Number(charge.creditos);
  const newBalance = await creditWallet(
    userId,
    creditos,
    "purchase",
    `Compra de créditos — Pacote ${pkg?.name ?? charge.package_id} (R$ ${Number(charge.valor).toFixed(2)})`,
    txid
  );

  res.json({ message: "Pagamento confirmado", creditosAdicionados: creditos, novoSaldo: newBalance });
});

// ─── POST /api/wallet/admin/grant ────────────────────────────────────────────
// Doação de créditos pelo administrador a um usuário específico
router.post("/admin/grant", requireAdmin, async (req: Request, res: Response) => {
  const { userId, amount, motivo } = req.body;
  if (!userId || !amount || amount <= 0) {
    res.status(400).json({ error: "userId e amount são obrigatórios" });
    return;
  }
  try {
    const desc = motivo ? `Créditos doados pelo admin — ${motivo}` : "Créditos doados pelo administrador";
    const newBalance = await creditWallet(Number(userId), Number(amount), "grant", desc);
    res.json({ message: "Créditos doados com sucesso", novoSaldo: newBalance, creditosDoados: amount });
  } catch (err) {
    console.error("[wallet/admin/grant]", err);
    res.status(500).json({ error: "Erro ao doe créditos" });
  }
});

// ─── POST /api/wallet/debit ───────────────────────────────────────────────────
// Debita créditos ao usar um módulo — consome assinatura primeiro, depois avulso
router.post("/debit", requireAuth, async (req: Request, res: Response) => {
  const { amount, module: moduleName } = req.body;
  const userId = req.user!.userId;

  if (!amount || amount <= 0) {
    res.status(400).json({ error: "Valor inválido para débito" });
    return;
  }

  const wallet = await getOrCreateWallet(userId);
  if (wallet.balance < amount) {
    res.status(402).json({ error: "Saldo insuficiente de créditos" });
    return;
  }

  // Calcula quantos débitos vêm de cada saldo
  const fromSub   = Math.min(Number(wallet.subscription_balance), amount);
  const fromExtra = amount - fromSub;

  const newSubBal   = Number(wallet.subscription_balance) - fromSub;
  const newExtraBal = Number(wallet.extra_balance) - fromExtra;
  const newTotal    = Number(wallet.balance) - amount;
  const newTotalUsed = Number(wallet.total_used) + amount;

  await db.execute(sql`
    UPDATE credit_wallets
    SET balance = ${newTotal},
        subscription_balance = ${newSubBal},
        extra_balance = ${newExtraBal},
        total_used = ${newTotalUsed},
        updated_at = NOW()
    WHERE id = ${wallet.id}
  `);
  await db.execute(sql`
    INSERT INTO credit_transactions (wallet_id, user_id, type, amount, balance_after, description, reference_id)
    VALUES (${wallet.id}, ${userId}, 'debit', ${-amount}, ${newTotal}, ${`Uso do módulo: ${moduleName}`}, ${moduleName ?? null})
  `);

  res.json({ novoSaldo: newTotal, debitado: amount, fromSubscription: fromSub, fromExtra });
});

export { getOrCreateWallet, creditWallet };
export default router;
