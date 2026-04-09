/**
 * Webhooks de pagamento:
 * - POST /api/webhooks/mp  — Mercado Pago (Pix e Checkout Pro / cartão)
 * - POST /api/webhooks/bb-pix — Banco do Brasil (fallback)
 */
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { CREDIT_PACKAGES, creditWallet } from "./wallet.js";
import { activateSubscription } from "./plans.js";
import { consultarPagamentoCompletoMP, MP_CONFIGURED } from "../lib/mercadopago.js";

const router = Router();

// ─── Processar pagamento aprovado ─────────────────────────────────────────────
async function processarPagamentoAprovado(charge: any) {
  const txid: string = charge.txid;

  if (charge.plan_id) {
    await activateSubscription(Number(charge.user_id), Number(charge.plan_id), txid);
    console.log(`[MP Webhook] Plano ativado → user ${charge.user_id} plan ${charge.plan_id}`);
  } else {
    const creditos = Number(charge.creditos);
    const pkg = CREDIT_PACKAGES.find((p) => p.id === charge.package_id);
    await creditWallet(
      Number(charge.user_id),
      creditos,
      "purchase",
      `Pagamento aprovado — ${pkg?.name ?? charge.package_id} (R$ ${Number(charge.valor).toFixed(2)})`,
      txid
    );
    console.log(`[MP Webhook] Créditos liberados: ${creditos} → user ${charge.user_id}`);
  }
}

// ─── POST /api/webhooks/mp ────────────────────────────────────────────────────
router.post("/mp", async (req: Request, res: Response) => {
  try {
    const action: string = req.body?.action ?? "";
    const paymentId: string = String(req.body?.data?.id ?? "");

    if (!paymentId || !action.startsWith("payment")) {
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    console.log(`[MP Webhook] ${action} — paymentId: ${paymentId}`);

    if (!MP_CONFIGURED) {
      res.status(200).json({ ok: true, mp_not_configured: true });
      return;
    }

    // Consulta detalhes do pagamento no MP (inclui external_reference para cartão)
    const mpResult = await consultarPagamentoCompletoMP(paymentId);
    const { status: mpStatus, externalReference } = mpResult;

    console.log(`[MP Webhook] mpStatus=${mpStatus} | externalRef=${externalReference}`);

    // Busca cobrança: primeiro pelo mp_payment_id (Pix), depois pelo txid via external_reference (cartão)
    let charge: any = null;

    const byMpId = (await db.execute(sql`
      SELECT id, user_id, valor, creditos, status, package_id, txid, plan_id
      FROM pix_charges WHERE mp_payment_id = ${paymentId} LIMIT 1
    `)).rows[0];

    if (byMpId) {
      charge = byMpId;
    } else if (externalReference) {
      const byTxid = (await db.execute(sql`
        SELECT id, user_id, valor, creditos, status, package_id, txid, plan_id
        FROM pix_charges WHERE txid = ${externalReference} LIMIT 1
      `)).rows[0];
      if (byTxid) charge = byTxid;
    }

    if (!charge) {
      res.status(200).json({ ok: true, not_found: true });
      return;
    }

    if (charge.status === "paid") {
      res.status(200).json({ ok: true, already_paid: true });
      return;
    }

    if (mpStatus === "approved") {
      await db.execute(sql`
        UPDATE pix_charges
        SET status = 'paid', paid_at = NOW(), mp_payment_id = ${paymentId}, updated_at = NOW()
        WHERE id = ${charge.id}
      `);
      await processarPagamentoAprovado(charge);
      res.status(200).json({ ok: true, processed: true });

    } else if (mpStatus === "rejected" || mpStatus === "cancelled") {
      await db.execute(sql`
        UPDATE pix_charges SET status = 'expired', updated_at = NOW() WHERE id = ${charge.id}
      `);
      res.status(200).json({ ok: true, status: mpStatus });

    } else {
      res.status(200).json({ ok: true, status: "pending" });
    }

  } catch (err) {
    console.error("[MP Webhook] Erro:", err);
    res.status(200).json({ ok: false, error: String(err) });
  }
});

// ─── POST /api/webhooks/bb-pix ────────────────────────────────────────────────
router.post("/bb-pix", async (req: Request, res: Response) => {
  try {
    const pixList: Array<{ txid: string }> = req.body?.pix ?? [];
    if (!pixList.length) {
      res.status(200).json({ ok: true, processed: 0 });
      return;
    }

    let processados = 0;
    for (const pix of pixList) {
      const { txid } = pix;
      if (!txid) continue;

      const [charge] = (await db.execute(sql`
        SELECT id, user_id, valor, creditos, status, package_id, txid, plan_id
        FROM pix_charges WHERE txid = ${txid} LIMIT 1
      `)).rows as any[];

      if (!charge || charge.status !== "pending") continue;

      await db.execute(sql`
        UPDATE pix_charges SET status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = ${charge.id}
      `);

      await processarPagamentoAprovado(charge);
      console.log(`[BB Webhook] Pix ${txid} confirmado → user ${charge.user_id}${charge.plan_id ? ` (plano ${charge.plan_id})` : ` (${charge.creditos} cr)`}`);
      processados++;
    }

    res.status(200).json({ ok: true, processed: processados });
  } catch (err) {
    console.error("[BB Webhook] Erro:", err);
    res.status(200).json({ ok: false, error: String(err) });
  }
});

export default router;
