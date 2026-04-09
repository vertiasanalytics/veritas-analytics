/**
 * Envio de notificações WhatsApp via CallMeBot (https://www.callmebot.com)
 * Requer WHATSAPP_PHONE e WHATSAPP_APIKEY nas variáveis de ambiente.
 */

const CALLMEBOT_URL = "https://api.callmebot.com/whatsapp.php";

export async function sendWhatsApp(message: string): Promise<void> {
  const phone  = process.env.WHATSAPP_PHONE;
  const apikey = process.env.WHATSAPP_APIKEY;

  if (!phone || !apikey) {
    console.log("[WhatsApp] Notificação desabilitada — WHATSAPP_PHONE ou WHATSAPP_APIKEY não configurados.");
    return;
  }

  const url = `${CALLMEBOT_URL}?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apikey)}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[WhatsApp] Falha ao enviar (HTTP ${res.status}): ${body.slice(0, 200)}`);
    } else {
      console.log("[WhatsApp] Notificação enviada com sucesso.");
    }
  } catch (err: any) {
    console.warn("[WhatsApp] Erro ao enviar notificação:", err.message);
  }
}

/** Formata mensagem de nova venda para o admin */
export function msgNovaVenda(opts: {
  nomeCliente: string;
  emailCliente: string;
  packageName: string;
  valor: number;
  creditos: number;
}): string {
  return (
    `🔔 *Veritas Analytics — Nova Venda!*\n` +
    `👤 Cliente: ${opts.nomeCliente}\n` +
    `📧 E-mail: ${opts.emailCliente}\n` +
    `📦 Pacote: ${opts.packageName}\n` +
    `💰 Valor: R$ ${opts.valor.toFixed(2)}\n` +
    `🪙 Créditos: ${opts.creditos}\n\n` +
    `➡️ Acesse o Controle Financeiro no painel admin para confirmar o recebimento do Pix.`
  );
}

/** Formata mensagem de confirmação de pagamento */
export function msgPagamentoConfirmado(opts: {
  nomeCliente: string;
  emailCliente: string;
  packageName: string;
  valor: number;
  creditos: number;
}): string {
  return (
    `✅ *Veritas Analytics — Pagamento Confirmado!*\n` +
    `👤 Cliente: ${opts.nomeCliente}\n` +
    `📧 E-mail: ${opts.emailCliente}\n` +
    `📦 Pacote: ${opts.packageName}\n` +
    `💰 Valor: R$ ${opts.valor.toFixed(2)}\n` +
    `🪙 Créditos liberados: ${opts.creditos}`
  );
}
