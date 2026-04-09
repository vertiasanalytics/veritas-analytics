/**
 * Rotas para integração do Índice de Atualização Monetária do TJMG.
 *
 * GET  /tjmg/status         — status da integração (última sync, totais, competência mais recente)
 * POST /tjmg/sync           — importa tabela de fatores (aceita JSON manual ou tenta fetch da página)
 * POST /tjmg/lookup         — consulta o fator e calcula o valor atualizado
 * GET  /tjmg/factors        — lista registros importados (paginado, ?limit=200)
 */

import { Router, type IRouter } from "express";
import { desc, eq, and, sql, count, max } from "drizzle-orm";
import { db } from "@workspace/db";
import { tjmgFactorsTable } from "@workspace/db/schema";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import crypto from "node:crypto";

const router: IRouter = Router();

// ── GET /tjmg/status ────────────────────────────────────────────────────────

router.get("/status", requireAuth, async (_req, res) => {
  try {
    const [totals] = await db
      .select({
        total: count(),
        ultimaImportacao: max(tjmgFactorsTable.importadoEm),
        competenciaMaisRecente: max(tjmgFactorsTable.competenciaReferencia),
        hashArquivo: max(tjmgFactorsTable.hashArquivo),
      })
      .from(tjmgFactorsTable);

    res.json({
      success: true,
      fonteNome: "TJMG — Fator de Atualização Monetária (ICGJ/TJMG)",
      fonteUrl:
        "https://www.tjmg.jus.br/portal-tjmg/processos/indicadores/fator-de-atualizacao-monetaria.htm",
      totalRegistros: Number(totals?.total ?? 0),
      ultimaImportacaoEm: totals?.ultimaImportacao ?? null,
      competenciaMaisRecente: totals?.competenciaMaisRecente ?? "",
      hashArquivo: totals?.hashArquivo ?? null,
      mensagem:
        Number(totals?.total ?? 0) === 0
          ? "Nenhum registro importado. Use Sincronizar para importar a tabela do TJMG."
          : `${totals?.total} registros disponíveis. Última competência: ${totals?.competenciaMaisRecente ?? "—"}.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao consultar status.";
    res.status(500).json({ success: false, mensagem: msg });
  }
});

// ── POST /tjmg/sync ─────────────────────────────────────────────────────────

/**
 * Importa fatores do TJMG.
 *
 * Aceita um array `factors` no body com objetos:
 *   { indiceNome, competenciaOrigem, competenciaReferencia, fator }
 *
 * Se `factors` não for fornecido, tenta obter a tabela diretamente do portal TJMG
 * (experimental; pode falhar por bloqueio CORS/robot ou mudança de layout).
 */
router.post("/sync", requireAdmin, async (req, res) => {
  try {
    const { factors, fonte } = req.body as {
      factors?: {
        indiceNome?: string;
        competenciaOrigem: string;
        competenciaReferencia: string;
        fator: number | string;
      }[];
      fonte?: string;
    };

    let registros: typeof factors = factors ?? [];
    let hashArquivo: string | null = null;
    let mensagem = "";

    if (registros.length > 0) {
      // ── Importação manual via payload JSON ──────────────────────────────
      hashArquivo = crypto
        .createHash("sha256")
        .update(JSON.stringify(registros))
        .digest("hex")
        .slice(0, 16);

      mensagem = `Importação manual via JSON: ${registros.length} registros.`;
    } else {
      // ── Tentativa de fetch automático da página do TJMG ─────────────────
      // O portal não expõe uma API pública estável; a lógica abaixo tenta
      // encontrar um link de download XLS/XLSX na página HTML e extrair dados.
      // Em ambiente de produção recomenda-se um job agendado no servidor.
      try {
        const pageUrl =
          "https://www.tjmg.jus.br/portal-tjmg/processos/indicadores/fator-de-atualizacao-monetaria.htm";

        const response = await fetch(pageUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; VeritasAnalytics/1.0; +https://veritasanalytics.com.br)",
            Accept: "text/html,application/xhtml+xml",
          },
          signal: AbortSignal.timeout(15_000),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ao acessar o portal TJMG.`);
        }

        mensagem =
          "Página do TJMG acessada. A extração automática de XLS requer parser especializado. " +
          "Utilize a importação manual via payload JSON enquanto o parser automático não está disponível.";
      } catch (fetchErr) {
        mensagem =
          fetchErr instanceof Error
            ? `Não foi possível acessar o portal TJMG automaticamente: ${fetchErr.message}. Use importação manual.`
            : "Falha ao acessar portal TJMG. Use importação manual.";
      }
    }

    // ── Persistência dos registros ───────────────────────────────────────
    let inseridos = 0;
    if (registros.length > 0) {
      const fonteUrl =
        "https://www.tjmg.jus.br/portal-tjmg/processos/indicadores/fator-de-atualizacao-monetaria.htm";

      for (const r of registros) {
        if (!r.competenciaOrigem || !r.competenciaReferencia || r.fator === undefined) continue;

        await db
          .insert(tjmgFactorsTable)
          .values({
            indiceNome: r.indiceNome ?? "ICGJ/TJMG",
            competenciaOrigem: r.competenciaOrigem,
            competenciaReferencia: r.competenciaReferencia,
            fator: String(Number(r.fator)),
            fonteUrl,
            hashArquivo,
          })
          .onConflictDoNothing();

        inseridos++;
      }
    }

    // ── Status atualizado ────────────────────────────────────────────────
    const [totals] = await db
      .select({
        total: count(),
        ultimaImportacao: max(tjmgFactorsTable.importadoEm),
        competenciaMaisRecente: max(tjmgFactorsTable.competenciaReferencia),
      })
      .from(tjmgFactorsTable);

    res.json({
      success: true,
      fonteNome: "TJMG — Fator de Atualização Monetária (ICGJ/TJMG)",
      fonteUrl:
        "https://www.tjmg.jus.br/portal-tjmg/processos/indicadores/fator-de-atualizacao-monetaria.htm",
      totalRegistros: Number(totals?.total ?? 0),
      ultimaImportacaoEm: totals?.ultimaImportacao ?? null,
      competenciaMaisRecente: totals?.competenciaMaisRecente ?? "",
      hashArquivo,
      inseridos,
      mensagem: inseridos > 0 ? `${inseridos} registros importados com sucesso.` : mensagem,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao sincronizar tabela TJMG.";
    res.status(500).json({ success: false, mensagem: msg });
  }
});

// ── POST /tjmg/lookup ────────────────────────────────────────────────────────

router.post("/lookup", requireAuth, async (req, res) => {
  try {
    const { valorHistorico, competenciaOrigem, competenciaReferencia, indiceNome } = req.body as {
      valorHistorico: number;
      competenciaOrigem: string;
      competenciaReferencia: string;
      indiceNome?: string;
    };

    if (!competenciaOrigem || !competenciaReferencia) {
      res.status(400).json({ success: false, mensagem: "competenciaOrigem e competenciaReferencia são obrigatórios." });
      return;
    }

    const nomeIndice = indiceNome ?? "ICGJ/TJMG";
    const valor = Number(valorHistorico) || 0;

    // Busca fator direto (tabela do TJMG pode ter o fator acumulado direto)
    const [registro] = await db
      .select()
      .from(tjmgFactorsTable)
      .where(
        and(
          eq(tjmgFactorsTable.indiceNome, nomeIndice),
          eq(tjmgFactorsTable.competenciaOrigem, competenciaOrigem),
          eq(tjmgFactorsTable.competenciaReferencia, competenciaReferencia)
        )
      )
      .limit(1);

    if (registro) {
      const fator = parseFloat(registro.fator);
      res.json({
        success: true,
        indiceNome: registro.indiceNome,
        competenciaOrigem: registro.competenciaOrigem,
        competenciaReferencia: registro.competenciaReferencia,
        fator,
        valorHistorico: valor,
        valorAtualizado: parseFloat((valor * fator).toFixed(2)),
        metodologia: "valorHistorico × fatorTJMG (tabela ICGJ/TJMG)",
        observacao: undefined,
      });
      return;
    }

    // Fator direto não encontrado — tenta composição via fator base 1.000000 (origem = referência)
    // Busca todos os registros do índice para tentar compor o fator
    const todos = await db
      .select()
      .from(tjmgFactorsTable)
      .where(eq(tjmgFactorsTable.indiceNome, nomeIndice))
      .orderBy(tjmgFactorsTable.competenciaOrigem);

    if (todos.length === 0) {
      res.status(404).json({
        success: false,
        mensagem:
          "Nenhum fator localizado para o índice e período informados. Sincronize a tabela do TJMG primeiro.",
      });
      return;
    }

    // Composição via data-base comum: a tabela TJMG armazena competenciaOrigem fixa
    // (ex.: "1994-07") com a competenciaReferencia variando a cada mês.
    // fator(A→B) = f(base→B) / f(base→A)
    const dataBase = todos[0].competenciaOrigem;
    const fatorA = todos.find((r) => r.competenciaReferencia === competenciaOrigem);
    const fatorB = todos.find((r) => r.competenciaReferencia === competenciaReferencia);

    if (fatorA && fatorB) {
      const fatorComposto = parseFloat(fatorB.fator) / parseFloat(fatorA.fator);
      const valorAtualizado = parseFloat((valor * fatorComposto).toFixed(2));
      res.json({
        success: true,
        indiceNome: nomeIndice,
        competenciaOrigem,
        competenciaReferencia,
        fator: parseFloat(fatorComposto.toFixed(8)),
        valorHistorico: valor,
        valorAtualizado,
        metodologia: `Fator composto: f(${dataBase}, ${competenciaReferencia}) ÷ f(${dataBase}, ${competenciaOrigem})`,
        observacao: `Fator calculado por composição usando data-base ${dataBase} do TJMG.`,
      });
      return;
    }

    res.status(404).json({
      success: false,
      mensagem: `Fator não localizado para ${competenciaOrigem} → ${competenciaReferencia}. Verifique se a tabela foi sincronizada para este período.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro na consulta do fator TJMG.";
    res.status(500).json({ success: false, mensagem: msg });
  }
});

// ── GET /tjmg/factors ────────────────────────────────────────────────────────

router.get("/factors", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const indiceNome = req.query.indice as string | undefined;

    let query = db
      .select()
      .from(tjmgFactorsTable)
      .$dynamic();

    if (indiceNome) {
      query = query.where(eq(tjmgFactorsTable.indiceNome, indiceNome));
    }

    const rows = await query
      .orderBy(desc(tjmgFactorsTable.competenciaReferencia))
      .limit(limit);

    res.json(
      rows.map((r) => ({
        id: r.id,
        indiceNome: r.indiceNome,
        competenciaOrigem: r.competenciaOrigem,
        competenciaReferencia: r.competenciaReferencia,
        fator: parseFloat(r.fator),
        fonteUrl: r.fonteUrl,
        importadoEm: r.importadoEm,
      }))
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao listar fatores TJMG.";
    res.status(500).json({ success: false, mensagem: msg });
  }
});

export default router;
