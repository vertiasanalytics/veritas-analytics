/**
 * Rotas para gerenciamento de índices econômicos oficiais.
 *
 * GET  /indexes             — consulta cache no banco (com filtros)
 * POST /indexes/sync        — sincroniza índices via APIs oficiais (IBGE/BCB)
 * GET  /indexes/embedded    — séries históricas embarcadas (IPCA-E, INPC, POUPANÇA, SELIC)
 * GET  /indexes/catalogue   — catálogo completo de todos os índices (9 séries)
 * POST /indexes/import-pdf  — importa dados da Tabela TRF1 (PDF oficial)
 * GET  /indexes/pdf-data    — consulta dados importados do PDF TRF1
 */

import { Router, type IRouter } from "express";
import { sql as drizzleSql, eq, gte, lte, count, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { officialIndexesCacheTable } from "@workspace/db/schema";
import { logAudit } from "../lib/audit.js";
import { IPCA_E, INPC, POUPANCA, SELIC, TJMG } from "../engine/historicalRates.js";
import { getHistoricalCatalogue } from "../providers/historicalStatic.js";
import { fetchBCBIndexes } from "../providers/bcb.js";
import { fetchIBGEIndexes } from "../providers/ibge.js";
import { parsePdfText, loadPdfAsset } from "../providers/pdfParser.js";
import { IRSM_RECORDS } from "../providers/irsmData.js";

const router: IRouter = Router();

// ── GET /indexes ──────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query as Record<string, string>;

    let query = db.select().from(officialIndexesCacheTable).$dynamic();
    const conditions = [];

    if (type)      conditions.push(eq(officialIndexesCacheTable.indexType, type));
    if (startDate) conditions.push(gte(officialIndexesCacheTable.period, startDate));
    if (endDate)   conditions.push(lte(officialIndexesCacheTable.period, endDate));
    if (conditions.length > 0) query = query.where(and(...conditions));

    const rows = await query.orderBy(officialIndexesCacheTable.period).limit(500);
    const [totalResult] = await db.select({ count: count() }).from(officialIndexesCacheTable);

    res.json({
      success: true,
      indexes: rows.map((r) => ({
        id: r.id,
        indexType: r.indexType,
        period: r.period,
        rate: parseFloat(r.rate),
        source: r.source,
        sourceType: r.sourceType ?? null,
        originUrl: r.originUrl ?? null,
        fetchedAt: r.fetchedAt.toISOString(),
      })),
      total: totalResult?.count ?? 0,
    });
  } catch (err) {
    console.error("[GET /indexes]", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Erro ao listar índices" });
  }
});

// ── POST /indexes/sync ────────────────────────────────────────────────────────
// Sincroniza IPCA_E, INPC, SELIC e POUPANCA via APIs oficiais (IBGE SIDRA + BCB SGS).

router.post("/sync", async (req, res) => {
  try {
    const { indexType = "ALL", startDate, endDate } = req.body as Record<string, string>;

    const start = startDate ?? new Date(new Date().getFullYear() - 2, 0, 1).toISOString().substring(0, 10);
    const end   = endDate   ?? new Date().toISOString().substring(0, 10);

    const SYNCABLE = ["IPCA_E", "INPC", "SELIC", "POUPANCA", "IGP_DI", "TJMG"];
    const targets  = indexType === "ALL" ? SYNCABLE : [indexType];

    let synced = 0;
    const errors: string[] = [];
    const results: Array<{ type: string; count: number; status: string; message?: string }> = [];

    for (const type of targets) {
      try {
        let entries: Array<{ period: string; rate: number; source: string }> = [];

        const startYYYYMM   = start.replace(/-/g, "").substring(0, 6);
        const endYYYYMM     = end.replace(/-/g, "").substring(0, 6);
        const startDDMMYYYY = `01/${start.substring(5, 7)}/${start.substring(0, 4)}`;
        const endDDMMYYYY   = `01/${end.substring(5, 7)}/${end.substring(0, 4)}`;

        switch (type) {
          case "IPCA_E":
            entries = await fetchIBGEIndexes("IPCA_E", startYYYYMM, endYYYYMM);
            break;
          case "INPC":
            entries = await fetchIBGEIndexes("INPC", startYYYYMM, endYYYYMM);
            break;
          case "SELIC":
            entries = await fetchBCBIndexes("SELIC", startDDMMYYYY, endDDMMYYYY);
            break;
          case "POUPANCA":
            entries = await fetchBCBIndexes("POUPANCA", startDDMMYYYY, endDDMMYYYY);
            break;
          case "IGP_DI":
            entries = await fetchBCBIndexes("IGP_DI", startDDMMYYYY, endDDMMYYYY);
            break;
          case "TJMG":
            // TJMG ICGJ: sem API pública; sincroniza via IBGE IPCA-E (série idêntica)
            entries = await fetchIBGEIndexes("IPCA_E", startYYYYMM, endYYYYMM);
            break;
          default:
            throw new Error(
              type === "ORTN" || type === "OTN" || type === "BTN" || type === "IRSM"
                ? `${type} não possui API online oficial — série histórica disponível apenas em base documental validada`
                : `Índice não suportado: ${type}`
            );
        }

        const isIBGE      = ["IPCA_E", "INPC"].includes(type);
        const isBCB       = ["SELIC", "POUPANCA", "IGP_DI"].includes(type);
        const srcType     = isIBGE ? "official_online_ibge" : "official_online_bcb";
        const srcUrl      = isIBGE ? "https://sidra.ibge.gov.br" : isBCB ? "https://dadosabertos.bcb.gov.br" : "https://dadosabertos.bcb.gov.br";

        for (const entry of entries) {
          await db
            .insert(officialIndexesCacheTable)
            .values({
              indexType: type,
              period:    entry.period,
              rate:      String(entry.rate),
              source:    entry.source,
              sourceType: srcType,
              originUrl:  srcUrl,
            })
            .onConflictDoNothing();
        }

        synced += entries.length;
        results.push({ type, count: entries.length, status: "ok" });

        await logAudit({
          action:    "INDEXES_SYNCED",
          entity:    "official_indexes_cache",
          indexType: type,
          details:   { count: entries.length, start, end, sourceType: srcType },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${type}: ${msg}`);
        results.push({ type, count: 0, status: "error", message: msg });
        console.error(`[SYNC] ${type}: ${msg}`);
      }
    }

    res.json({
      success: errors.length === 0,
      synced,
      results,
      message: `${synced} registros sincronizados${errors.length > 0 ? ` (${errors.length} erros)` : ""}`,
      errors,
    });
  } catch (err) {
    console.error("[POST /indexes/sync]", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Erro ao sincronizar índices" });
  }
});

// ── GET /indexes/embedded ─────────────────────────────────────────────────────
// Séries históricas embarcadas (IPCA-E, INPC, POUPANÇA, SELIC).

type EmbeddedRecord = { period: string; rate: number; accumulated: number };

function buildSeriesInfo(
  rawMap: Record<string, number>,
  key: string,
  name: string,
  fullName: string,
  source: string,
  sourceUrl: string,
  legislation: string,
  useCase: string,
) {
  const records: EmbeddedRecord[] = Object.entries(rawMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce((acc: EmbeddedRecord[], [period, rate]) => {
      const prev = acc.length > 0 ? acc[acc.length - 1].accumulated : 1;
      acc.push({ period, rate, accumulated: parseFloat((prev * (1 + rate)).toFixed(8)) });
      return acc;
    }, []);

  const startPeriod = records[0]?.period ?? "";
  const endPeriod   = records[records.length - 1]?.period ?? "";
  const rates       = records.map((r) => r.rate);
  const avgRate     = rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;
  const maxRate     = rates.length > 0 ? Math.max(...rates) : 0;
  const minRate     = rates.length > 0 ? Math.min(...rates) : 0;
  const accumulated = records.length > 0 ? records[records.length - 1].accumulated : 1;

  return {
    key,
    name,
    fullName,
    source,
    sourceUrl,
    legislation,
    useCase,
    sourceType: "official_online",
    startPeriod,
    endPeriod,
    totalRecords: records.length,
    stats: {
      avgRate:     parseFloat(avgRate.toFixed(6)),
      maxRate:     parseFloat(maxRate.toFixed(6)),
      minRate:     parseFloat(minRate.toFixed(6)),
      accumulated: parseFloat(accumulated.toFixed(6)),
    },
    records,
  };
}

router.get("/embedded", (_req, res) => {
  try {
    const indices = [
      buildSeriesInfo(
        IPCA_E, "IPCA_E", "IPCA-E",
        "Índice de Preços ao Consumidor Amplo Especial",
        "IBGE SIDRA — Série 13522",
        "https://sidra.ibge.gov.br/tabela/13522",
        "Art. 1º-F da Lei 9.494/97 (red. Lei 11.960/09) · Tema 905 STJ · EC 113/2021",
        "Correção monetária em ações condenatórias em geral (Fase 1 — até 11/2021)",
      ),
      buildSeriesInfo(
        INPC, "INPC", "INPC",
        "Índice Nacional de Preços ao Consumidor",
        "IBGE SIDRA — Série 188",
        "https://sidra.ibge.gov.br/tabela/1207",
        "Lei 8.213/91 · Decreto 3.048/99",
        "Correção monetária em benefícios previdenciários e ações de obrigação de pagar",
      ),
      buildSeriesInfo(
        POUPANCA, "POUPANCA", "Poupança",
        "Remuneração da Caderneta de Poupança",
        "Banco Central do Brasil — SGS série 195",
        "https://dadosabertos.bcb.gov.br/dataset/195-rendimento-mensal-da-poupanca-novo-rendimento",
        "Art. 1º-F da Lei 9.494/97 (red. Lei 11.960/09)",
        "Juros de mora em ações condenatórias contra a Fazenda Pública (a partir de 07/2009)",
      ),
      buildSeriesInfo(
        SELIC, "SELIC", "SELIC",
        "Taxa Básica de Juros (Sistema Especial de Liquidação e Custódia)",
        "Banco Central do Brasil — SGS série 4390",
        "https://dadosabertos.bcb.gov.br/dataset/4390-taxa-de-juros-selic-acumulada-no-mes",
        "EC 113/2021 · Art. 3º da Lei 14.905/2024",
        "Correção + juros de mora em ações condenatórias (Fase 2 — a partir de 12/2021)",
      ),
      buildSeriesInfo(
        TJMG, "TJMG", "TJMG (ICGJ)",
        "Índice de Correção da Justiça Estadual de Minas Gerais",
        "TJMG — Tabela de Fatores de Atualização Monetária (ICGJ/TJMG)",
        "https://www.tjmg.jus.br/portal-tjmg/processos/indicadores/fator-de-atualizacao-monetaria.htm",
        "Art. 406 CC/2002 · Regimento Interno TJMG · Código de Processo Civil/MG",
        "Correção monetária em ações na Justiça Estadual de MG (sem EC 113/2021 — continua pós-nov/2021)",
      ),
    ];

    res.json({ success: true, indices });
  } catch (err) {
    console.error("[GET /indexes/embedded]", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Erro ao carregar índices embarcados" });
  }
});

// ── GET /indexes/catalogue ────────────────────────────────────────────────────
// Catálogo completo: índices com API online + índices históricos sem API.

router.get("/catalogue", async (_req, res) => {
  try {
    const cachedCounts = await db
      .select({ indexType: officialIndexesCacheTable.indexType, total: count() })
      .from(officialIndexesCacheTable)
      .groupBy(officialIndexesCacheTable.indexType);

    const cacheMap = new Map(cachedCounts.map((r) => [r.indexType, Number(r.total)]));

    const lastSyncs = await db
      .select({ indexType: officialIndexesCacheTable.indexType, fetchedAt: officialIndexesCacheTable.fetchedAt })
      .from(officialIndexesCacheTable)
      .orderBy(officialIndexesCacheTable.fetchedAt);

    const lastSyncMap = new Map<string, string>();
    for (const r of lastSyncs) {
      lastSyncMap.set(r.indexType, r.fetchedAt.toISOString());
    }

    const embeddedEntries = [
      {
        key: "IPCA_E", name: "IPCA-E",
        fullName: "Índice de Preços ao Consumidor Amplo Especial",
        description: "Índice calculado pelo IBGE, variante do IPCA com periodicidade mensal, " +
          "adotado como indexador principal de débitos judiciais civis após a EC 113/2021 (fase pré-dezembro/2021).",
        sourceType: "official_online" as const,
        source: "IBGE SIDRA — Série 13522",
        sourceUrl: "https://sidra.ibge.gov.br/tabela/13522",
        legislation: "Art. 1º-F da Lei 9.494/97 (red. Lei 11.960/09) · Tema 905 STJ · EC 113/2021",
        useCase: "Correção monetária em ações condenatórias em geral (Fase 1 — até 11/2021)",
        startPeriod: "1994-07", endPeriod: "2021-11",
        periodicidade: "Mensal",
        engineRole: "B_corr — produto das taxas IPCA-E de 07/1994 a 11/2021",
        observacao: null,
        hasEmbeddedData: true, hasLiveApi: true,
        syncableTypes: ["IPCA_E"],
        embeddedRecords: Object.keys(IPCA_E).length,
      },
      {
        key: "INPC", name: "INPC",
        fullName: "Índice Nacional de Preços ao Consumidor",
        description: "Índice calculado pelo IBGE para famílias com renda entre 1 e 5 salários mínimos. " +
          "Utilizado em benefícios previdenciários e ações de obrigação de pagar.",
        sourceType: "official_online" as const,
        source: "IBGE SIDRA — Série 188",
        sourceUrl: "https://sidra.ibge.gov.br/tabela/1207",
        legislation: "Lei 8.213/91 · Decreto 3.048/99",
        useCase: "Correção monetária em benefícios previdenciários e ações de obrigação de pagar",
        startPeriod: "1994-07", endPeriod: "2021-11",
        periodicidade: "Mensal",
        engineRole: "Alternativa ao IPCA-E em ações previdenciárias (configurável no critério do caso)",
        observacao: null,
        hasEmbeddedData: true, hasLiveApi: true,
        syncableTypes: ["INPC"],
        embeddedRecords: Object.keys(INPC).length,
      },
      {
        key: "POUPANCA", name: "Poupança",
        fullName: "Remuneração da Caderneta de Poupança",
        description: "Rendimento mensal da caderneta de poupança divulgado pelo Banco Central. " +
          "Adotado como taxa de juros de mora em ações condenatórias contra a Fazenda Pública.",
        sourceType: "official_online" as const,
        source: "Banco Central do Brasil — SGS série 195",
        sourceUrl: "https://dadosabertos.bcb.gov.br/dataset/195-rendimento-mensal-da-poupanca-novo-rendimento",
        legislation: "Art. 1º-F da Lei 9.494/97 (red. Lei 11.960/09)",
        useCase: "Juros de mora em ações condenatórias contra a Fazenda Pública (a partir de 07/2009)",
        startPeriod: "2009-07", endPeriod: "2021-11",
        periodicidade: "Mensal",
        engineRole: "Juros de mora fase 1 em ações contra Fazenda Pública",
        observacao: "Regra atual (desde 2012): TR + 0,5%/mês se Selic > 8,5% a.a. | 70% × Selic se Selic ≤ 8,5% a.a.",
        hasEmbeddedData: true, hasLiveApi: true,
        syncableTypes: ["POUPANCA"],
        embeddedRecords: Object.keys(POUPANCA).length,
      },
      {
        key: "SELIC", name: "SELIC",
        fullName: "Taxa Básica de Juros (Sistema Especial de Liquidação e Custódia)",
        description: "Taxa de juros definida pelo Copom (BCB), usada como referência para correção " +
          "monetária e juros de mora em débitos judiciais a partir de dezembro/2021 (EC 113/2021).",
        sourceType: "official_online" as const,
        source: "Banco Central do Brasil — SGS série 4390",
        sourceUrl: "https://dadosabertos.bcb.gov.br/dataset/4390-taxa-de-juros-selic-acumulada-no-mes",
        legislation: "EC 113/2021 · Art. 3º da Lei 14.905/2024",
        useCase: "Correção + juros de mora em ações condenatórias (Fase 2 — a partir de 12/2021)",
        startPeriod: "2022-01", endPeriod: new Date().toISOString().substring(0, 7),
        periodicidade: "Mensal",
        engineRole: "Fator G da Fase 2: G = (C+E) × ∏SELIC de 12/2021 a data de atualização",
        observacao: null,
        hasEmbeddedData: true, hasLiveApi: true,
        syncableTypes: ["SELIC"],
        embeddedRecords: Object.keys(SELIC).length,
      },
      {
        key: "IGP_DI", name: "IGP-DI",
        fullName: "Índice Geral de Preços — Disponibilidade Interna",
        description: "Índice calculado pela FGV que mede a variação geral de preços no Brasil, " +
          "disponível via API oficial do Banco Central (SGS série 190). " +
          "Historicamente utilizado para correção monetária em contratos privados e em alguns " +
          "débitos judiciais com previsão contratual ou decisão judicial específica.",
        sourceType: "official_online" as const,
        source: "Banco Central do Brasil — SGS série 190 (FGV/Ibre)",
        sourceUrl: "https://dadosabertos.bcb.gov.br/dataset/190-igp-di-fgv",
        legislation: "Portarias FGV · Uso contratual ou determinação judicial específica",
        useCase: "Correção monetária em contratos privados e débitos judiciais com previsão específica",
        startPeriod: "1944-02", endPeriod: new Date().toISOString().substring(0, 7),
        periodicidade: "Mensal",
        engineRole: "Índice complementar: utilizado quando determinado por cláusula contratual ou decisão judicial expressa",
        observacao: "Apurado pela FGV/Ibre e disponibilizado pelo Banco Central via SGS série 190. " +
          "Não é o índice padrão do Manual CJF 2025 para correção de débitos judiciais federais — requer determinação expressa.",
        hasEmbeddedData: false, hasLiveApi: true,
        syncableTypes: ["IGP_DI"],
        embeddedRecords: 0,
      },
      {
        key: "TJMG", name: "TJMG (ICGJ)", group: "Estadual",
        description: "Índice de Correção da Justiça Estadual de Minas Gerais",
        longDescription: "O ICGJ/TJMG é o índice oficial de correção monetária adotado pelo Tribunal de Justiça de Minas Gerais. " +
          "Utiliza as taxas mensais do IPCA-E (IBGE) pós-Plano Real (jul/1994). Diferentemente do sistema federal, " +
          "a Emenda Constitucional 113/2021 NÃO se aplica à Justiça Estadual: o TJMG continua usando IPCA-E após nov/2021. " +
          "O TJMG publica tabelas de fatores acumulados em formato Excel sem API pública — a série histórica está embarcada neste sistema.",
        sourceInstitution: "Tribunal de Justiça de Minas Gerais (TJMG)",
        sourceUrl: "https://www.tjmg.jus.br/portal-tjmg/processos/indicadores/fator-de-atualizacao-monetaria.htm",
        legislation: "Art. 406 CC/2002 · Regimento Interno TJMG · RICJ-MG",
        useCase: "Correção monetária em ações na Justiça Estadual de MG — sem aplicação da EC 113/2021",
        startPeriod: "1994-07", endPeriod: new Date().toISOString().substring(0, 7),
        periodicidade: "Mensal",
        engineRole: "Índice estadual: substitui IPCA-E/SELIC em ações perante a Justiça Estadual de MG",
        observacao: "Não há API pública oficial do TJMG para taxas mensais; o portal disponibiliza apenas fatores acumulados em Excel. " +
          "Esta série foi construída a partir das taxas IPCA-E (IBGE) que o TJMG adota como base, " +
          "com dados embarcados de 07/1994 a 2026-03 e sincronização online via IBGE para meses recentes.",
        hasEmbeddedData: true, hasLiveApi: true,
        syncableTypes: ["TJMG"],
        embeddedRecords: Object.keys(TJMG).length,
      },
    ];

    const pdfCountsResult = await db.execute(drizzleSql`
      SELECT indice_tipo, COUNT(*) AS total,
             MAX(imported_at) AS last_import
        FROM pdf_historical_indexes
       GROUP BY indice_tipo
    `);

    const pdfMap = new Map<string, { count: number; lastImport: string | null }>();
    for (const row of pdfCountsResult.rows as Array<{ indice_tipo: string; total: string; last_import: string | null }>) {
      pdfMap.set(row.indice_tipo, {
        count: Number(row.total),
        lastImport: row.last_import ?? null,
      });
    }

    const historicalCatalogue = getHistoricalCatalogue().map((h) => {
      const pdf = pdfMap.get(h.key);
      return {
        ...h,
        description: h.description,
        hasEmbeddedData: false,
        hasPdfData: (pdf?.count ?? 0) > 0,
        pdfRecords: pdf?.count ?? 0,
        pdfLastImport: pdf?.lastImport ?? null,
        hasLiveApi: false,
        syncableTypes: [] as string[],
        embeddedRecords: 0,
      };
    });

    const ufirPdf = pdfMap.get("UFIR");
    const ufirEntry = {
      key: "UFIR",
      name: "UFIR",
      fullName: "Unidade Fiscal de Referência",
      description:
        "Criada pela Lei 8.383/1991 para substituir a OTN como indexador oficial. " +
        "Valor fixado trimestralmente pela Receita Federal. Extinta em 2001 com a adoção do Real estabilizado.",
      sourceType: "official_documental" as const,
      source: "TRF1 — Tabela de Índices Mensais (AesCveisemGeral) · Lei 8.383/1991",
      sourceUrl: null,
      legislation: "Lei 8.383/1991 · MP 1.973/2000 · Lei 9.249/1995 (art. 24)",
      useCase:
        "Correção monetária em ações condenatórias com parcelas de jan/1992 a dez/2000. " +
        "Utilizada em ações trabalhistas, previdenciárias e civis em geral.",
      startPeriod: "1992-01",
      endPeriod: "2000-12",
      periodicidade: "Trimestral (divulgação) / Mensal (tabela)",
      engineRole:
        "B_conv (fator de conversão de CR$/Real para BRL). " +
        "Valores mensais do coeficiente em Real acumulado disponíveis na tabela TRF1.",
      observacao:
        "Dados importados da Tabela de Índices Mensais TRF1 (documento oficial). " +
        "UFIR extinta a partir de 01/01/2001 por força do art. 29 da Lei 10.522/2002.",
      hasEmbeddedData: false,
      hasPdfData: (ufirPdf?.count ?? 0) > 0,
      pdfRecords: ufirPdf?.count ?? 0,
      pdfLastImport: ufirPdf?.lastImport ?? null,
      hasLiveApi: false,
      syncableTypes: [] as string[],
      embeddedRecords: 0,
    };

    const catalogue = [
      ...embeddedEntries.map((e) => {
        const pdf = pdfMap.get(e.key);
        return {
          ...e,
          hasPdfData: (pdf?.count ?? 0) > 0,
          pdfRecords: pdf?.count ?? 0,
          pdfLastImport: pdf?.lastImport ?? null,
          cachedRecords: cacheMap.get(e.key) ?? 0,
          lastSync:      lastSyncMap.get(e.key) ?? null,
        };
      }),
      ...historicalCatalogue.map((entry) => ({
        ...entry,
        cachedRecords: cacheMap.get(entry.key) ?? 0,
        lastSync:      lastSyncMap.get(entry.key) ?? null,
      })),
      {
        ...ufirEntry,
        cachedRecords: cacheMap.get("UFIR") ?? 0,
        lastSync:      lastSyncMap.get("UFIR") ?? null,
      },
    ];

    res.json({ success: true, catalogue });
  } catch (err) {
    console.error("[GET /indexes/catalogue]", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Erro ao carregar catálogo" });
  }
});

// ── POST /indexes/import-pdf ──────────────────────────────────────────────────
// Importa os dados da Tabela TRF1 (arquivo texto gerado a partir do PDF oficial).
// Opera por upsert — pode ser executado múltiplas vezes sem duplicar registros.

router.post("/import-pdf", async (_req, res) => {
  try {
    const text   = loadPdfAsset();
    const result = parsePdfText(text);

    if (result.records.length === 0) {
      return res.status(422).json({
        success: false,
        error: "PARSE_EMPTY",
        message: "Nenhum registro válido encontrado no arquivo PDF.",
        warnings: result.warnings,
        skipped:  result.skipped.length,
      });
    }

    let inserted = 0;
    let updated  = 0;

    for (const rec of result.records) {
      const existing = await db.execute(drizzleSql`
        SELECT id FROM pdf_historical_indexes
         WHERE periodo = ${rec.periodo} AND indice_tipo = ${rec.indiceTipo}
      `);

      if (existing.rows.length === 0) {
        await db.execute(drizzleSql`
          INSERT INTO pdf_historical_indexes (periodo, indice_tipo, coef_em_real)
          VALUES (${rec.periodo}, ${rec.indiceTipo}, ${rec.coefEmReal})
          ON CONFLICT (periodo, indice_tipo) DO NOTHING
        `);
        inserted++;
      } else {
        await db.execute(drizzleSql`
          UPDATE pdf_historical_indexes
             SET coef_em_real = ${rec.coefEmReal},
                 imported_at  = NOW()
           WHERE periodo = ${rec.periodo} AND indice_tipo = ${rec.indiceTipo}
        `);
        updated++;
      }
    }

    // ── IRSM (dados IBGE estáticos) ───────────────────────────────────────────
    let irsmInserted = 0;
    let irsmUpdated  = 0;

    for (const rec of IRSM_RECORDS) {
      const existing = await db.execute(drizzleSql`
        SELECT id FROM pdf_historical_indexes
         WHERE periodo = ${rec.periodo} AND indice_tipo = 'IRSM'
      `);

      if (existing.rows.length === 0) {
        await db.execute(drizzleSql`
          INSERT INTO pdf_historical_indexes (periodo, indice_tipo, coef_em_real)
          VALUES (${rec.periodo}, 'IRSM', ${rec.coefEmReal})
          ON CONFLICT (periodo, indice_tipo) DO NOTHING
        `);
        irsmInserted++;
      } else {
        await db.execute(drizzleSql`
          UPDATE pdf_historical_indexes
             SET coef_em_real = ${rec.coefEmReal},
                 imported_at  = NOW()
           WHERE periodo = ${rec.periodo} AND indice_tipo = 'IRSM'
        `);
        irsmUpdated++;
      }
    }

    await logAudit({
      action:  "PDF_IMPORT",
      entity:  "pdf_historical_indexes",
      details: {
        inserted: inserted + irsmInserted,
        updated:  updated + irsmUpdated,
        byType:   { ...result.byType, IRSM: IRSM_RECORDS.length },
        warnings: result.warnings.length,
        skipped:  result.skipped.length,
        fontes:   [
          "TRF1 — Tabela de Índices Mensais (AesCveisemGeral)",
          "IBGE — IRSM Série Histórica (dez/93=100)",
        ],
      },
    });

    res.json({
      success:  true,
      inserted: inserted + irsmInserted,
      updated:  updated + irsmUpdated,
      total:    result.records.length + IRSM_RECORDS.length,
      byType:   { ...result.byType, IRSM: IRSM_RECORDS.length },
      warnings: result.warnings,
      skipped:  result.skipped.length,
      fontes:   [
        "TRF1 — Tabela de Índices Mensais (AesCveisemGeral)",
        "IBGE — IRSM Série Histórica (dez/93=100)",
      ],
    });
  } catch (err) {
    console.error("[POST /indexes/import-pdf]", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Erro ao importar dados do PDF" });
  }
});

// ── GET /indexes/pdf-data ─────────────────────────────────────────────────────
// Retorna registros importados do PDF TRF1, filtrados por tipo e período.

router.get("/pdf-data", async (req, res) => {
  try {
    const { type, startPeriod, endPeriod } = req.query as Record<string, string>;

    let rowsResult;
    if (type && startPeriod && endPeriod) {
      rowsResult = await db.execute(drizzleSql`
        SELECT periodo, indice_tipo, coef_em_real, fonte_doc, imported_at
          FROM pdf_historical_indexes
         WHERE indice_tipo = ${type} AND periodo >= ${startPeriod} AND periodo <= ${endPeriod}
         ORDER BY periodo LIMIT 5000
      `);
    } else if (type && startPeriod) {
      rowsResult = await db.execute(drizzleSql`
        SELECT periodo, indice_tipo, coef_em_real, fonte_doc, imported_at
          FROM pdf_historical_indexes
         WHERE indice_tipo = ${type} AND periodo >= ${startPeriod}
         ORDER BY periodo LIMIT 5000
      `);
    } else if (type && endPeriod) {
      rowsResult = await db.execute(drizzleSql`
        SELECT periodo, indice_tipo, coef_em_real, fonte_doc, imported_at
          FROM pdf_historical_indexes
         WHERE indice_tipo = ${type} AND periodo <= ${endPeriod}
         ORDER BY periodo LIMIT 5000
      `);
    } else if (type) {
      rowsResult = await db.execute(drizzleSql`
        SELECT periodo, indice_tipo, coef_em_real, fonte_doc, imported_at
          FROM pdf_historical_indexes
         WHERE indice_tipo = ${type}
         ORDER BY periodo LIMIT 5000
      `);
    } else {
      rowsResult = await db.execute(drizzleSql`
        SELECT periodo, indice_tipo, coef_em_real, fonte_doc, imported_at
          FROM pdf_historical_indexes
         ORDER BY indice_tipo, periodo LIMIT 5000
      `);
    }

    const rows = (rowsResult.rows as Array<{
      periodo: string; indice_tipo: string;
      coef_em_real: string; fonte_doc: string; imported_at: string;
    }>).map((r) => ({
      periodo:     r.periodo,
      indiceTipo:  r.indice_tipo,
      coefEmReal:  parseFloat(r.coef_em_real),
      fonteDoc:    r.fonte_doc,
      importadoEm: r.imported_at,
    }));

    const byType: Record<string, number> = {};
    for (const r of rows) byType[r.indiceTipo] = (byType[r.indiceTipo] ?? 0) + 1;

    res.json({
      success: true,
      rows,
      byType,
      total: rows.length,
      fonte: "TRF1 — Tabela de Índices Mensais (AesCveisemGeral)",
    });
  } catch (err) {
    console.error("[GET /indexes/pdf-data]", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Erro ao consultar dados PDF" });
  }
});

export default router;
