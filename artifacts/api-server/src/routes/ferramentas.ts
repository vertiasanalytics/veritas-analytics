import { Router } from "express";
import { db } from "@workspace/db";
import { salarioMinimoSeriesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";

const router = Router();

const BCB_SM_SERIES_ID = 1619;
const BCB_API_BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

interface BcbRawEntry { data: string; valor: string; }

function parseBCBDate(ddmmyyyy: string): { year: number; month: number } {
  const parts = ddmmyyyy.split("/");
  return { year: Number(parts[2]), month: Number(parts[1]) };
}

function toCompetencia(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function prevMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

router.get("/salario-minimo/preview-bcb", requireAdmin, async (_req, res) => {
  try {
    const url = `${BCB_API_BASE}.${BCB_SM_SERIES_ID}/dados?formato=json`;
    console.log(`[ferramentas] Buscando salário mínimo BCB SGS ${BCB_SM_SERIES_ID}: ${url}`);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`BCB respondeu HTTP ${response.status} ${response.statusText}`);
    }

    const raw = (await response.json()) as BcbRawEntry[];

    if (!Array.isArray(raw) || raw.length === 0) {
      return res.status(502).json({ error: "BCB retornou dados vazios ou inválidos" });
    }

    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1;

    const records = raw.map((item, i) => {
      const ini = parseBCBDate(item.data);
      const next = raw[i + 1];
      let fim: { year: number; month: number };
      if (next) {
        const nextDate = parseBCBDate(next.data);
        fim = prevMonth(nextDate.year, nextDate.month);
      } else {
        fim = { year: nowYear, month: nowMonth };
      }
      return {
        id:                `bcb_${toCompetencia(ini.year, ini.month).replace("-", "")}_${Math.random().toString(36).slice(2, 6)}`,
        competenciaInicio: toCompetencia(ini.year, ini.month),
        competenciaFim:    toCompetencia(fim.year, fim.month),
        valor:             parseFloat(item.valor),
        atoNormativo:      `BCB SGS ${BCB_SM_SERIES_ID}`,
        observacoes:       "",
        ativo:             true,
      };
    });

    const sorted = records.sort((a, b) => a.competenciaInicio.localeCompare(b.competenciaInicio));

    res.json({
      total:        sorted.length,
      fonte:        `Banco Central do Brasil — Dados Abertos (SGS série ${BCB_SM_SERIES_ID})`,
      urlFonte:     `https://dadosabertos.bcb.gov.br/dataset/${BCB_SM_SERIES_ID}`,
      periodicidade: sorted.length > 0
        ? `${sorted[0].competenciaInicio} → ${sorted[sorted.length - 1].competenciaFim}`
        : "",
      records: sorted,
    });
  } catch (err) {
    console.error("[ferramentas] preview-bcb error:", err);
    res.status(502).json({
      error: `Falha ao consultar BCB: ${(err as Error).message}`,
    });
  }
});

router.get("/salario-minimo", requireAuth, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(salarioMinimoSeriesTable)
      .orderBy(salarioMinimoSeriesTable.competenciaInicio);
    const result = rows.map((r) => ({
      id:                r.clientId,
      competenciaInicio: r.competenciaInicio,
      competenciaFim:    r.competenciaFim,
      valor:             Number(r.valor),
      atoNormativo:      r.atoNormativo ?? "",
      observacoes:       r.observacoes ?? "",
      ativo:             r.ativo,
      createdAt:         r.createdAt.toISOString(),
      updatedAt:         r.updatedAt.toISOString(),
    }));
    res.json(result);
  } catch (err) {
    console.error("[ferramentas] GET salario-minimo error:", err);
    res.status(500).json({ error: "Erro ao buscar séries de salário mínimo" });
  }
});

router.post("/salario-minimo", requireAdmin, async (req, res) => {
  try {
    const records: Array<{
      id: string;
      competenciaInicio: string;
      competenciaFim: string;
      valor: number;
      atoNormativo?: string;
      observacoes?: string;
      ativo?: boolean;
    }> = req.body;

    if (!Array.isArray(records)) {
      return res.status(400).json({ error: "Corpo da requisição deve ser um array" });
    }

    await db.delete(salarioMinimoSeriesTable);

    if (records.length > 0) {
      await db.insert(salarioMinimoSeriesTable).values(
        records.map((r) => ({
          clientId:          r.id,
          competenciaInicio: r.competenciaInicio,
          competenciaFim:    r.competenciaFim,
          valor:             String(r.valor),
          atoNormativo:      r.atoNormativo ?? null,
          observacoes:       r.observacoes ?? null,
          ativo:             r.ativo ?? true,
        }))
      );
    }

    const saved = await db
      .select()
      .from(salarioMinimoSeriesTable)
      .orderBy(salarioMinimoSeriesTable.competenciaInicio);

    res.json(
      saved.map((r) => ({
        id:                r.clientId,
        competenciaInicio: r.competenciaInicio,
        competenciaFim:    r.competenciaFim,
        valor:             Number(r.valor),
        atoNormativo:      r.atoNormativo ?? "",
        observacoes:       r.observacoes ?? "",
        ativo:             r.ativo,
        createdAt:         r.createdAt.toISOString(),
        updatedAt:         r.updatedAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error("[ferramentas] POST salario-minimo error:", err);
    res.status(500).json({ error: "Erro ao salvar séries de salário mínimo" });
  }
});

router.delete("/salario-minimo/:clientId", requireAdmin, async (req, res) => {
  try {
    await db
      .delete(salarioMinimoSeriesTable)
      .where(eq(salarioMinimoSeriesTable.clientId, req.params.clientId));
    res.json({ ok: true });
  } catch (err) {
    console.error("[ferramentas] DELETE salario-minimo error:", err);
    res.status(500).json({ error: "Erro ao deletar registro" });
  }
});

export default router;
