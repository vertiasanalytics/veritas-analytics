/**
 * ══════════════════════════════════════════════════════════════════
 *  Veritas Analytics — Integração Mercado Pago
 *  Módulo exclusivo para cobranças Pix e Checkout Pro (cartão).
 *  Toda identidade de pagamento reflete unicamente a marca
 *  Veritas Analytics. Nenhuma referência legada é tolerada.
 * ══════════════════════════════════════════════════════════════════
 */

import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

// ── Configuração de ambiente ──────────────────────────────────────
const MP_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN ?? "";
export const MP_CONFIGURED = MP_TOKEN.length > 60;
const IS_SANDBOX = MP_TOKEN.startsWith("TEST-") || MP_TOKEN.startsWith("APP_USR-") === false;

if (MP_CONFIGURED) {
  console.log(`[MP] Mercado Pago configurado | ambiente: ${IS_SANDBOX ? "SANDBOX/TESTE" : "PRODUÇÃO"}`);
} else {
  console.warn("[MP] Token não configurado — cobranças MP desativadas");
}

// ── Identidade da marca ───────────────────────────────────────────
const BRAND = {
  nome:       "Veritas Analytics",
  descriptor: "VERITAS ANALYTICS",    // máx 22 chars — aparece na fatura do cartão
  descricao:  "Assinatura do sistema Veritas Analytics",
};

// ── Definição dos planos (referência interna) ─────────────────────
export const PLANOS_VERITAS = {
  essencial:     { titulo: "Plano Essencial - Veritas Analytics" },
  profissional:  { titulo: "Plano Profissional - Veritas Analytics" },
  avancado:      { titulo: "Plano Avançado - Veritas Analytics" },
} as const;

// ── Cliente MP (singleton) ────────────────────────────────────────
let _client: MercadoPagoConfig | null = null;
function getClient(): MercadoPagoConfig {
  if (!_client) _client = new MercadoPagoConfig({ accessToken: MP_TOKEN });
  return _client;
}

// ── Interfaces ────────────────────────────────────────────────────
export interface MPPixResult {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  expiresAt: Date;
}

export interface MPCheckoutResult {
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint: string;
}

// ── Criação de cobrança Pix ───────────────────────────────────────
/**
 * Gera uma nova cobrança Pix via API Mercado Pago.
 * Cada chamada cria uma cobrança nova (sem reaproveitamento).
 *
 * @param opts.txid         ID único da transação (identificador interno)
 * @param opts.titulo       Ex: "Plano Profissional - Veritas Analytics"
 * @param opts.valor        Valor em R$ já com desconto de 5% (Pix)
 * @param opts.pagadorEmail E-mail do cliente
 * @param opts.pagadorNome  Nome completo do cliente (opcional)
 */
export async function criarPixMP(opts: {
  txid: string;
  titulo: string;
  valor: number;
  pagadorEmail: string;
  pagadorNome?: string;
}): Promise<MPPixResult> {
  const payment = new Payment(getClient());

  const body = {
    transaction_amount: opts.valor,
    description: opts.titulo,
    payment_method_id: "pix" as const,
    payer: {
      email: opts.pagadorEmail,
      first_name: opts.pagadorNome?.split(" ")[0] ?? "Cliente",
      last_name:  opts.pagadorNome?.split(" ").slice(1).join(" ") || BRAND.nome,
    },
    date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    additional_info: {
      items: [{
        id:          opts.txid,
        title:       opts.titulo,
        description: BRAND.descricao,
        quantity:    1,
        unit_price:  opts.valor,
      }],
    },
  };

  console.log(`[MP Pix] Criando cobrança:`);
  console.log(`  txid:       ${opts.txid}`);
  console.log(`  título:     ${opts.titulo}`);
  console.log(`  valor:      R$ ${opts.valor.toFixed(2)}`);
  console.log(`  pagador:    ${opts.pagadorEmail}`);

  const result = await payment.create({
    body,
    requestOptions: { idempotencyKey: `veritas-pix-${opts.txid}` },
  });

  const pix = result.point_of_interaction?.transaction_data;
  if (!pix?.qr_code) {
    throw new Error(
      `[MP Pix] QR Code não retornado. status=${result.status} | id=${result.id}`
    );
  }

  console.log(`[MP Pix] Cobrança criada com sucesso:`);
  console.log(`  paymentId:  ${result.id}`);
  console.log(`  status:     ${result.status}`);

  return {
    paymentId:    String(result.id),
    qrCode:       pix.qr_code,
    qrCodeBase64: pix.qr_code_base64 ?? "",
    ticketUrl:    pix.ticket_url ?? "",
    expiresAt:    new Date(Date.now() + 30 * 60 * 1000),
  };
}

// ── Criação de Preference (Checkout Pro — cartão) ─────────────────
/**
 * Cria uma nova Preference do Mercado Pago para pagamento por cartão.
 * Sempre gera preference nova — nunca reutiliza link anterior.
 * Aparece como "VERITAS ANALYTICS" na fatura do cartão do cliente.
 *
 * @param opts.txid            ID único da transação (= external_reference)
 * @param opts.titulo          Ex: "Plano Profissional - Veritas Analytics"
 * @param opts.valor           Valor total com acréscimo de 5% (cartão)
 * @param opts.pagadorEmail    E-mail do cliente
 * @param opts.successUrl      URL de retorno após aprovação
 * @param opts.failureUrl      URL de retorno após falha
 * @param opts.pendingUrl      URL de retorno quando pendente
 * @param opts.notificationUrl Webhook IPN do sistema
 * @param opts.maxInstallments Nº máx de parcelas (padrão 12)
 */
export async function criarPreferenciaMP(opts: {
  txid: string;
  titulo: string;
  valor: number;
  pagadorEmail: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  notificationUrl: string;
  maxInstallments?: number;
}): Promise<MPCheckoutResult> {
  const pref = new Preference(getClient());
  const installments = opts.maxInstallments ?? 12;

  const body = {
    items: [{
      id:          opts.txid,
      title:       opts.titulo,
      description: BRAND.descricao,
      quantity:    1,
      unit_price:  opts.valor,
      currency_id: "BRL" as const,
    }],
    payer:              { email: opts.pagadorEmail },
    external_reference: opts.txid,
    back_urls: {
      success: opts.successUrl,
      failure: opts.failureUrl,
      pending: opts.pendingUrl,
    },
    auto_return:         "approved" as const,
    notification_url:    opts.notificationUrl,
    statement_descriptor: BRAND.descriptor,
    payment_methods: {
      installments,
    },
  };

  console.log(`[MP Checkout] Criando preference:`);
  console.log(`  txid:            ${opts.txid}`);
  console.log(`  título:          ${opts.titulo}`);
  console.log(`  valor:           R$ ${opts.valor.toFixed(2)}`);
  console.log(`  descriptor:      ${BRAND.descriptor}`);
  console.log(`  max_parcelas:    ${installments}`);
  console.log(`  external_ref:    ${opts.txid}`);
  console.log(`  notification:    ${opts.notificationUrl}`);

  const result = await pref.create({ body });

  const initPoint        = result.init_point         ?? "";
  const sandboxInitPoint = result.sandbox_init_point ?? "";

  console.log(`[MP Checkout] Preference criada:`);
  console.log(`  preferenceId:    ${result.id}`);
  console.log(`  initPoint:       ${IS_SANDBOX ? sandboxInitPoint : initPoint}`);

  return {
    preferenceId:    String(result.id),
    initPoint,
    sandboxInitPoint,
  };
}

// ── Consulta de status de pagamento ──────────────────────────────
/**
 * Retorna status simplificado de um pagamento MP pelo ID interno.
 */
export async function consultarPagamentoMP(
  paymentId: string
): Promise<"pending" | "approved" | "rejected" | "cancelled"> {
  const payment = new Payment(getClient());
  const result = await payment.get({ id: Number(paymentId) });

  console.log(`[MP] Consultando payment ${paymentId}: status=${result.status}`);

  switch (result.status) {
    case "approved": return "approved";
    case "rejected":
    case "cancelled": return "rejected";
    default:          return "pending";
  }
}

/**
 * Retorna status e external_reference de um pagamento MP.
 * Usado pelo webhook para identificar a transação correspondente.
 */
export async function consultarPagamentoCompletoMP(paymentId: string) {
  const payment = new Payment(getClient());
  const result = await payment.get({ id: Number(paymentId) });

  console.log(`[MP] Consulta completa payment ${paymentId}:`);
  console.log(`  status:            ${result.status}`);
  console.log(`  external_reference: ${result.external_reference ?? "(none)"}`);

  return {
    status:            result.status ?? "pending",
    externalReference: result.external_reference ?? null,
  };
}
