/**
 * Serviço de busca e cache de índices econômicos oficiais.
 * Hierarquia: Cache local -> API oficial -> Fallback dev
 * PONTO DE HOMOLOGAÇÃO: Em produção, desabilitar fallback e garantir atualização periódica do cache.
 */

import { db } from "@workspace/db";
import { officialIndexesCacheTable } from "@workspace/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { fetchIBGEIndexes } from "../providers/ibge.js";
import { fetchBCBIndexes } from "../providers/bcb.js";
import { getFallbackIndexes } from "../providers/fallback.js";
import { logAudit } from "../lib/audit.js";

export interface IndexEntry {
  period: string; // YYYY-MM
  rate: number;
  source: string;
}

/**
 * Converte data YYYY-MM-DD para YYYY-MM
 */
function dateToPeriod(date: string): string {
  return date.substring(0, 7);
}

/**
 * Gera lista de períodos mensais entre duas datas.
 */
function generatePeriods(startDate: string, endDate: string): string[] {
  const periods: string[] = [];
  const start = new Date(startDate + "-01");
  const end = new Date(endDate + "-01");
  const cur = new Date(start);

  while (cur <= end) {
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, "0");
    periods.push(`${yyyy}-${mm}`);
    cur.setMonth(cur.getMonth() + 1);
  }

  return periods;
}

/**
 * Busca índices do cache local do banco de dados.
 */
async function getCachedIndexes(
  indexType: string,
  startPeriod: string,
  endPeriod: string
): Promise<IndexEntry[]> {
  const rows = await db
    .select()
    .from(officialIndexesCacheTable)
    .where(
      and(
        eq(officialIndexesCacheTable.indexType, indexType),
        gte(officialIndexesCacheTable.period, startPeriod),
        lte(officialIndexesCacheTable.period, endPeriod)
      )
    )
    .orderBy(officialIndexesCacheTable.period);

  return rows.map((r) => ({
    period: r.period,
    rate: parseFloat(r.rate),
    source: r.source,
  }));
}

/**
 * Salva índices no cache local.
 */
async function cacheIndexes(indexType: string, entries: IndexEntry[]): Promise<void> {
  for (const entry of entries) {
    await db
      .insert(officialIndexesCacheTable)
      .values({
        indexType,
        period: entry.period,
        rate: String(entry.rate),
        source: entry.source,
      })
      .onConflictDoNothing();
  }
}

/**
 * Busca índices do provedor oficial (IBGE ou BCB).
 */
async function fetchFromOfficialSource(
  indexType: string,
  startPeriod: string,
  endPeriod: string
): Promise<IndexEntry[]> {
  const startYYYYMM = startPeriod.replace("-", "");
  const endYYYYMM = endPeriod.replace("-", "");

  // Formato DD/MM/YYYY para BCB
  const startDDMMYYYY = `01/${startPeriod.substring(5, 7)}/${startPeriod.substring(0, 4)}`;
  const endDDMMYYYY = `01/${endPeriod.substring(5, 7)}/${endPeriod.substring(0, 4)}`;

  switch (indexType) {
    case "IPCA":
      return fetchIBGEIndexes("IPCA", startYYYYMM, endYYYYMM);
    case "IPCA_E":
      return fetchIBGEIndexes("IPCA_E", startYYYYMM, endYYYYMM);
    case "INPC":
      return fetchIBGEIndexes("INPC", startYYYYMM, endYYYYMM);
    case "SELIC":
      return fetchBCBIndexes("SELIC", startDDMMYYYY, endDDMMYYYY);
    case "TR":
      return fetchBCBIndexes("TR", startDDMMYYYY, endDDMMYYYY);
    case "TJMG":
      // TJMG ICGJ: sem API pública oficial; usa IPCA-E do IBGE (mesma série pós-Real)
      // Para meses pós-2021, retorna taxas IPCA-E recentes via IBGE
      return fetchIBGEIndexes("IPCA_E", startYYYYMM, endYYYYMM);
    default:
      throw new Error(`Índice não suportado: ${indexType}`);
  }
}

/**
 * Obtém índices para um período, com cache e fallback.
 * Estratégia: cache local -> API oficial -> fallback dev
 */
export async function getIndexes(
  indexType: string,
  startDate: string,
  endDate: string
): Promise<IndexEntry[]> {
  const startPeriod = dateToPeriod(startDate);
  const endPeriod = dateToPeriod(endDate);
  const requiredPeriods = generatePeriods(startPeriod, endPeriod);

  // 1. Verificar cache local
  const cached = await getCachedIndexes(indexType, startPeriod, endPeriod);
  const cachedPeriods = new Set(cached.map((c) => c.period));
  const missingPeriods = requiredPeriods.filter((p) => !cachedPeriods.has(p));

  if (missingPeriods.length === 0) {
    console.log(`[INDEX] Cache hit para ${indexType} ${startPeriod}-${endPeriod}`);
    await logAudit({
      action: "INDEX_CACHE_HIT",
      entity: "official_indexes_cache",
      indexType,
      source: "local_cache",
      details: { startPeriod, endPeriod, count: cached.length },
    });
    return cached.filter((c) => requiredPeriods.includes(c.period));
  }

  // 2. Tentar buscar da API oficial
  let officialEntries: IndexEntry[] = [];
  let source = "official_api";

  try {
    officialEntries = await fetchFromOfficialSource(indexType, startPeriod, endPeriod);
    if (officialEntries.length > 0) {
      await cacheIndexes(indexType, officialEntries);
      await logAudit({
        action: "INDEX_FETCHED_OFFICIAL",
        entity: "official_indexes_cache",
        indexType,
        source: officialEntries[0]?.source,
        details: { startPeriod, endPeriod, count: officialEntries.length },
      });
    }
  } catch (err) {
    console.warn(`[INDEX] Falha ao buscar ${indexType} da API oficial: ${err}`);
    source = "fallback_dev";
  }

  // 3. Fallback dev se necessário
  if (officialEntries.length === 0) {
    console.warn(`[INDEX] Usando fallback dev para ${indexType}`);
    officialEntries = getFallbackIndexes(indexType, startPeriod, endPeriod);
    await cacheIndexes(indexType, officialEntries);
    await logAudit({
      action: "INDEX_FALLBACK_USED",
      entity: "official_indexes_cache",
      indexType,
      source: "fallback_dev",
      details: { startPeriod, endPeriod, count: officialEntries.length },
    });
  }

  // Mesclar cache + novos
  const allEntries = [...cached, ...officialEntries];
  const uniqueMap = new Map(allEntries.map((e) => [e.period, e]));

  return requiredPeriods
    .filter((p) => uniqueMap.has(p))
    .map((p) => uniqueMap.get(p)!);
}

export { generatePeriods, dateToPeriod };
