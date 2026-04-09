/**
 * Provedor de índices IBGE (IPCA, IPCA-E, INPC).
 * Fonte oficial: IBGE SIDRA API - https://sidra.ibge.gov.br
 * PONTO DE HOMOLOGAÇÃO: Verificar endpoints e tabelas corretas para uso em produção.
 */

const IBGE_SIDRA_BASE = "https://servicodados.ibge.gov.br/api/v3/agregados";

// Tabelas SIDRA:
// IPCA: tabela 1737, variável 2266 (variação mensal)
// IPCA-E: tabela 3065, variável 1381
// INPC: tabela 1736, variável 44

const INDEX_TABLES: Record<string, { table: string; variable: string }> = {
  IPCA: { table: "1737", variable: "2266" },
  IPCA_E: { table: "3065", variable: "1381" },
  INPC: { table: "1736", variable: "44" },
};

export interface IBGEIndexEntry {
  period: string;
  rate: number;
  source: string;
}

/**
 * Busca índices mensais do IBGE SIDRA para um período.
 * @param indexType - Tipo de índice: IPCA, IPCA_E, INPC
 * @param startPeriod - Período inicial no formato YYYYMM
 * @param endPeriod - Período final no formato YYYYMM
 */
export async function fetchIBGEIndexes(
  indexType: "IPCA" | "IPCA_E" | "INPC",
  startPeriod: string,
  endPeriod: string
): Promise<IBGEIndexEntry[]> {
  const config = INDEX_TABLES[indexType];
  if (!config) throw new Error(`Índice desconhecido: ${indexType}`);

  const url = `${IBGE_SIDRA_BASE}/${config.table}/periodos/${startPeriod}-${endPeriod}/variaveis/${config.variable}?localidades=N1[all]`;

  console.log(`[IBGE] Buscando ${indexType}: ${url}`);

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`[IBGE] HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as Array<{
    resultados?: Array<{
      series?: Array<{
        serie?: Record<string, string>;
      }>;
    }>;
  }>;

  const entries: IBGEIndexEntry[] = [];

  if (data?.[0]?.resultados?.[0]?.series?.[0]?.serie) {
    const serie = data[0].resultados[0].series[0].serie;
    for (const [period, value] of Object.entries(serie)) {
      const raw = parseFloat(value);
      if (!isNaN(raw)) {
        // IBGE retorna a variação em pontos percentuais (ex: 0.21 significa 0.21%)
        // Convertemos para decimal: 0.21 / 100 = 0.0021
        // Sanity check: taxas mensais normais ficam entre -5% e +10%
        const rate = raw / 100;
        if (rate >= -0.05 && rate <= 0.10) {
          entries.push({
            period: formatPeriod(period),
            rate,
            source: `IBGE SIDRA - Tabela ${config.table}`,
          });
        } else {
          console.warn(`[IBGE] Taxa fora do intervalo esperado para ${period}: ${raw}% - ignorando`);
        }
      }
    }
  }

  return entries.sort((a, b) => a.period.localeCompare(b.period));
}

function formatPeriod(yyyymm: string): string {
  const year = yyyymm.substring(0, 4);
  const month = yyyymm.substring(4, 6);
  return `${year}-${month}`;
}
