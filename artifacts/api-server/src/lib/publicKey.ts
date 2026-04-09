import crypto from "crypto";

const ADJECTIVES = [
  "FEDERAL", "JUDICIAL", "LEGAL", "OFICIAL", "FORMAL",
  "CERTO", "FIRME", "CLARO", "JUSTO", "BREVE",
  "FORTE", "PURO", "NOBRE", "LEAL", "REAL",
];

const NOUNS = [
  "CALCULO", "PROCESSO", "ACAO", "VALOR", "CREDITO",
  "DEBITO", "PARCELA", "INDICE", "FATOR", "SALDO",
  "CONTA", "BALANCO", "ORDEM", "TITULO", "LAUDO",
];

/**
 * Gera uma chave pública amigável e única para recuperação de cálculos.
 * Formato: ADJ-NOUN-XXXX-XXXX (ex: FEDERAL-CALCULO-4A2B-9F1C)
 * PONTO DE HOMOLOGAÇÃO: Verificar unicidade e colisões em produção.
 */
export function generatePublicKey(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const part1 = crypto.randomBytes(2).toString("hex").toUpperCase();
  const part2 = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `${adjective}-${noun}-${part1}-${part2}`;
}

/**
 * Gera hash de integridade SHA-256 para auditoria do cálculo.
 */
export function generateIntegrityHash(data: object): string {
  const json = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash("sha256").update(json).digest("hex");
}
