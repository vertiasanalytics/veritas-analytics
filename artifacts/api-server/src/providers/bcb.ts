/**
 * Provedor de índices do Banco Central do Brasil (BCB).
 * Fonte oficial: API de Dados Abertos do BCB - https://dadosabertos.bcb.gov.br
 *
 * Séries SGS utilizadas:
 *   SELIC mensal acumulada: 4390  https://dadosabertos.bcb.gov.br/dataset/4390-taxa-de-juros-selic-acumulada-no-mes
 *   Poupança mensal:        195   https://dadosabertos.bcb.gov.br/dataset/195-rendimento-mensal-da-poupanca-novo-rendimento
 *   TR mensal:              226
 */

const BCB_API_BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

const BCB_SERIES: Record<string, number> = {
  SELIC:    4390,
  TR:       226,
  POUPANCA: 195,
  IGP_DI:   190,   // FGV — Índice Geral de Preços - Disponibilidade Interna (variação % mensal)
};

export interface BCBIndexEntry {
  period: string;
  rate: number;
  source: string;
}

/**
 * Busca índices mensais do BCB SGS.
 * Para POUPANCA (SGS 195) o endpoint ignora o filtro de data e retorna a série
 * completa; por isso a filtragem é feita aqui após o fetch.
 *
 * @param indexType  - "SELIC" | "TR" | "POUPANCA"
 * @param startDate  - Data inicial DD/MM/YYYY
 * @param endDate    - Data final   DD/MM/YYYY
 */
export async function fetchBCBIndexes(
  indexType: "SELIC" | "TR" | "POUPANCA" | "IGP_DI",
  startDate: string,
  endDate: string,
): Promise<BCBIndexEntry[]> {
  const seriesId = BCB_SERIES[indexType];
  if (!seriesId) throw new Error(`Série BCB desconhecida: ${indexType}`);

  const url = `${BCB_API_BASE}.${seriesId}/dados?formato=json&dataInicial=${startDate}&dataFinal=${endDate}`;
  console.log(`[BCB] Buscando ${indexType} (SGS ${seriesId}): ${url}`);

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`[BCB] HTTP ${response.status} ${response.statusText} para ${indexType}`);
  }

  const raw = await response.json() as Array<{ data: string; dataFim?: string; valor: string }>;

  if (indexType === "POUPANCA") {
    return aggregatePoupancaMonthly(raw, startDate, endDate, seriesId);
  }

  const entries: BCBIndexEntry[] = [];
  for (const item of raw) {
    const rate = parseFloat(item.valor);
    if (!isNaN(rate)) {
      entries.push({
        period: parseBCBDateToPeriod(item.data),
        rate: rate / 100,
        source: `Banco Central do Brasil — SGS série ${seriesId}`,
      });
    }
  }
  return entries.sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * A série 195 (Poupança) retorna ciclos que podem ter múltiplos registros por mês.
 * Agrupa por YYYY-MM e mantém a ÚLTIMA taxa de cada competência (mais recente do ciclo).
 * Filtra pelo intervalo de datas solicitado após o agrupamento.
 */
function aggregatePoupancaMonthly(
  raw: Array<{ data: string; dataFim?: string; valor: string }>,
  startDate: string,
  endDate: string,
  seriesId: number,
): BCBIndexEntry[] {
  const startPeriod = parseBCBDateToPeriod(startDate);
  const endPeriod   = parseBCBDateToPeriod(endDate);

  const byPeriod = new Map<string, { date: string; rate: number }>();

  for (const item of raw) {
    const period = parseBCBDateToPeriod(item.data);
    if (!period) continue;
    const rate = parseFloat(item.valor);
    if (isNaN(rate)) continue;

    const existing = byPeriod.get(period);
    if (!existing || item.data > existing.date) {
      byPeriod.set(period, { date: item.data, rate });
    }
  }

  const entries: BCBIndexEntry[] = [];
  for (const [period, { rate }] of byPeriod) {
    if (period >= startPeriod && period <= endPeriod) {
      entries.push({
        period,
        rate: rate / 100,
        source: `Banco Central do Brasil — SGS série ${seriesId}`,
      });
    }
  }
  return entries.sort((a, b) => a.period.localeCompare(b.period));
}

/** "28/11/2024" ou "01/12/2024"  →  "2024-11" */
function parseBCBDateToPeriod(ddmmyyyy: string): string {
  const parts = ddmmyyyy.split("/");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}`;
  return ddmmyyyy;
}
