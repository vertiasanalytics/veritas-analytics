import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth.js";
import geoip from "geoip-lite";

const router = Router();

const ESTADOS: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul",
  MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina",
  SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

const PAGINAS: Record<string, string> = {
  "/login": "Login",
  "/": "Dashboard",
  "/previdenciario": "Previdenciário",
  "/trabalhista": "Trabalhista — PJe-Calc",
  "/trabalhista?tab=insalubridade": "Trabalhista — Insalubridade",
  "/trabalhista?tab=horas-extras": "Trabalhista — Horas Extras",
  "/valor-causa": "Valor da Causa",
  "/pericial/juros-amortizacao": "Juros e Amortização",
  "/pericial/lucro-cessante-dcf": "Lucro Cessante DCF",
  "/pericial/honorarios-periciais": "Honorários Periciais",
  "/juridico/honorarios-juridicos": "Honorários Advocatícios",
  "/familia/revisao-pensao": "Pensão Alimentícia",
  "/civel/danos-emergentes": "Danos Materiais",
  "/estadual/liquidacao-sentenca": "Liquidação Estadual",
  "/creditos": "Créditos",
  "/planos": "Planos",
  "/perfil": "Perfil",
  "/controladoria-juridica": "Controladoria Jurídica",
  "/perito-assistente": "Perito Assistente",
  "/suporte": "Suporte",
  "/indices": "Índices",
  "/backup": "Backup",
  "/educacional": "Painel Educacional",
  "demo": "Demonstração",
};

function getIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0].trim();
  return req.socket?.remoteAddress ?? req.ip ?? "0.0.0.0";
}

function geoLocate(ip: string) {
  if (ip === "::1" || ip === "127.0.0.1" || ip.startsWith("10.") || ip.startsWith("172.") || ip.startsWith("192.168.")) {
    return { pais: "BR", uf: "MG", estado: "Minas Gerais", cidade: "Local" };
  }
  const geo = geoip.lookup(ip);
  if (!geo) return { pais: "", uf: "", estado: "", cidade: "" };
  const uf = geo.region ?? "";
  return {
    pais: geo.country ?? "",
    uf,
    estado: ESTADOS[uf] ?? uf,
    cidade: geo.city ?? "",
  };
}

function classifyPage(pagina: string): string {
  if (pagina === "demo") return "Demonstração";
  if (pagina === "/login") return "Login";
  if (pagina.startsWith("/admin")) return "Administração";
  if (pagina.startsWith("/convenio")) return "Convênio";
  if (pagina.startsWith("/pericial")) return "Pericial";
  if (pagina.startsWith("/juridico")) return "Jurídico";
  if (pagina.startsWith("/familia")) return "Família";
  if (pagina.startsWith("/civel")) return "Cível";
  if (pagina.startsWith("/estadual")) return "Estadual";
  if (pagina.startsWith("/trabalhista")) return "Trabalhista";
  if (pagina.startsWith("/previdenciario") || pagina.startsWith("/cases")) return "Previdenciário";
  return "Sistema";
}

router.post("/track", async (req: Request, res: Response) => {
  try {
    const pagina = (req.body?.pagina as string | undefined) ?? "/";
    const userId = (req.body?.userId as number | undefined) ?? null;
    const ip = getIp(req);
    const { pais, uf, estado, cidade } = geoLocate(ip);
    const tipo = classifyPage(pagina);
    const userAgent = (req.headers["user-agent"] ?? "").substring(0, 300);

    await db.execute(sql`
      INSERT INTO access_logs (ip, pais, uf, estado, cidade, pagina, tipo, user_id, user_agent)
      VALUES (${ip}, ${pais}, ${uf}, ${estado}, ${cidade}, ${pagina}, ${tipo}, ${userId}, ${userAgent})
    `);

    res.json({ ok: true });
  } catch (_err) {
    res.json({ ok: false });
  }
});

router.get("/admin", requireAdmin, async (req: Request, res: Response) => {
  const { uf, tipo, pagina, inicio, fim, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * pageSize;

  const where: string[] = [];
  if (uf) where.push(`a.uf = '${uf.replace(/'/g, "''")}'`);
  if (tipo) where.push(`a.tipo = '${tipo.replace(/'/g, "''")}'`);
  if (pagina) where.push(`a.pagina ILIKE '%${pagina.replace(/'/g, "''")}%'`);
  if (inicio) where.push(`a.created_at >= '${inicio}'`);
  if (fim) where.push(`a.created_at <= '${fim} 23:59:59'`);

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const [totalRow, rows, byUf, byTipo, byDay] = await Promise.all([
    db.execute(sql.raw(`SELECT COUNT(*) AS total FROM access_logs a ${whereClause}`)),
    db.execute(sql.raw(`
      SELECT
        a.id, a.ip, a.pais, a.uf, a.estado, a.cidade,
        a.pagina, a.tipo, a.user_agent,
        a.created_at,
        u.nome AS user_nome, u.email AS user_email
      FROM access_logs a
      LEFT JOIN users u ON u.id = a.user_id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `)),
    db.execute(sql.raw(`
      SELECT uf, estado, COUNT(*) AS total
      FROM access_logs a
      ${whereClause ? whereClause + " AND a.uf IS NOT NULL AND a.uf != ''" : "WHERE a.uf IS NOT NULL AND a.uf != ''"}
      GROUP BY uf, estado
      ORDER BY total DESC
      LIMIT 30
    `)),
    db.execute(sql.raw(`
      SELECT tipo, COUNT(*) AS total
      FROM access_logs a
      ${whereClause}
      GROUP BY tipo
      ORDER BY total DESC
    `)),
    db.execute(sql.raw(`
      SELECT DATE(created_at AT TIME ZONE 'America/Sao_Paulo') AS dia,
             COUNT(*) AS total
      FROM access_logs a
      ${whereClause}
      GROUP BY dia
      ORDER BY dia DESC
      LIMIT 30
    `)),
  ]);

  const total = parseInt((totalRow.rows[0] as any)?.total ?? "0", 10);

  res.json({
    total,
    page: pageNum,
    pageSize,
    pages: Math.ceil(total / pageSize),
    rows: rows.rows,
    byUf: byUf.rows,
    byTipo: byTipo.rows,
    byDay: byDay.rows,
  });
});

router.get("/admin/summary", requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db.execute(sql`
    SELECT
      COUNT(*)                                                         AS total,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') AS hoje,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS semana,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS mes,
      COUNT(DISTINCT ip)                                               AS ips_unicos,
      COUNT(DISTINCT uf)                                               AS estados_unicos
    FROM access_logs
  `);
  res.json(rows.rows[0] ?? {});
});

export default router;
