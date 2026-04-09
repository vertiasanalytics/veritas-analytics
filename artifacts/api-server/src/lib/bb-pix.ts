/**
 * Integração com a API Pix do Banco do Brasil
 * Documentação: https://developers.bb.com.br/apis/pix
 * Suporta sandbox (BB_ENV=sandbox) e produção (BB_ENV=production)
 */

const IS_SANDBOX = (process.env.BB_ENV ?? "sandbox") !== "production";

const BB_OAUTH_URL = IS_SANDBOX
  ? "https://oauth.sandbox.bb.com.br/oauth/token"
  : "https://oauth.bb.com.br/oauth/token";

const BB_API_BASE = IS_SANDBOX
  ? "https://api.sandbox.bb.com.br/pix/v1"
  : "https://api.bb.com.br/pix/v1";

// ─── Cache de token OAuth2 ────────────────────────────────────────────────────
let tokenCache: { token: string; expires: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expires) return tokenCache.token;

  const basic  = process.env.BB_BASIC;
  const appKey = process.env.BB_APPKEY;
  if (!basic || !appKey) throw new Error("Credenciais BB não configuradas (BB_BASIC / BB_APPKEY)");

  const url = `${BB_OAUTH_URL}?gw-dev-app-key=${appKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=cob.read+cob.write+pix.read+pix.write",
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`BB OAuth falhou (${res.status}): ${txt.slice(0, 300)}`);
  }

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expires: Date.now() + (Number(data.expires_in) - 60) * 1000,
  };
  return tokenCache.token;
}

function apiUrl(path: string): string {
  const appKey = process.env.BB_APPKEY ?? "";
  return `${BB_API_BASE}${path}?gw-dev-app-key=${appKey}`;
}

// ─── Criar cobrança imediata (cob) ───────────────────────────────────────────
export async function criarCobrancaBB(opts: {
  txid: string;
  valor: number;
  chave: string;
  descricao?: string;
}) {
  const token = await getAccessToken();

  const body = {
    calendario: { expiracao: 1800 },           // 30 min
    valor: { original: opts.valor.toFixed(2) },
    chave: opts.chave,
    solicitacaoPagador: opts.descricao ?? "Compra de créditos — Veritas Analytics",
  };

  // BB usa PUT /cob/{txid} para criar cobrança com txid pré-definido
  const res = await fetch(apiUrl(`/cob/${opts.txid}`), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`BB criar cobrança falhou (${res.status}): ${txt.slice(0, 400)}`);
  }

  return res.json() as Promise<BBCobrancaResponse>;
}

// ─── Consultar cobrança ───────────────────────────────────────────────────────
export async function consultarCobrancaBB(txid: string): Promise<BBCobrancaResponse> {
  const token = await getAccessToken();

  const res = await fetch(apiUrl(`/cob/${txid}`), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`BB consultar cobrança falhou (${res.status}): ${txt.slice(0, 300)}`);
  }

  return res.json();
}

// ─── Registrar webhook ────────────────────────────────────────────────────────
export async function registrarWebhookBB(chave: string, webhookUrl: string): Promise<void> {
  const token = await getAccessToken();

  const res = await fetch(apiUrl(`/webhook/${encodeURIComponent(chave)}`), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ webhookUrl }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok && res.status !== 204) {
    const txt = await res.text().catch(() => "");
    console.warn(`[BB Pix] Webhook não registrado (${res.status}): ${txt.slice(0, 200)}`);
  } else {
    console.log(`[BB Pix] Webhook registrado com sucesso: ${webhookUrl}`);
  }
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface BBCobrancaResponse {
  txid: string;
  status: "ATIVA" | "CONCLUIDA" | "REMOVIDA_PELO_USUARIO_RECEBEDOR" | "REMOVIDA_PELO_PSP";
  pixCopiaECola?: string;
  location?: string;
  valor: { original: string };
  chave: string;
  pix?: Array<{
    endToEndId: string;
    txid: string;
    valor: string;
    horario: string;
    infoPagador?: string;
  }>;
}

export function bbStatusParaLocal(status: BBCobrancaResponse["status"]): "pending" | "paid" | "expired" {
  if (status === "CONCLUIDA") return "paid";
  if (status === "ATIVA")     return "pending";
  return "expired";
}

export const BB_CONFIGURED = !!(process.env.BB_BASIC && process.env.BB_APPKEY);
