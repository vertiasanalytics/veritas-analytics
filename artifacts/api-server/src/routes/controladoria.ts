import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapReceivable(r: any) {
  return {
    id: String(r.id),
    cliente: r.cliente ?? "",
    processo: r.processo ?? "",
    contrato: r.contrato ?? "",
    vencimento: r.vencimento ?? "",
    valor: Number(r.valor ?? 0),
    status: r.status ?? "Aberto",
    createdAt: r.created_at ?? null,
  };
}

function mapPayable(r: any) {
  return {
    id: String(r.id),
    fornecedor: r.fornecedor ?? "",
    categoria: r.categoria ?? "",
    processo: r.processo ?? "",
    vencimento: r.vencimento ?? "",
    valor: Number(r.valor ?? 0),
    status: r.status ?? "Aberto",
    createdAt: r.created_at ?? null,
  };
}

function mapActivity(r: any) {
  return {
    id: String(r.id),
    title: r.title ?? "",
    description: r.description ?? "",
    value: r.value != null ? Number(r.value) : undefined,
    time: r.time ?? "",
    createdAt: r.created_at ?? null,
  };
}

function mapAlert(r: any) {
  return {
    id: String(r.id),
    title: r.title ?? "",
    description: r.description ?? "",
    severity: r.severity ?? "media",
    createdAt: r.created_at ?? null,
  };
}

function mapCliente(r: any) {
  return {
    id: String(r.id),
    nome: r.nome ?? "",
    cnpjCpf: r.cnpj_cpf ?? "",
    tipo: r.tipo ?? "PF",
    responsavel: r.responsavel ?? "",
    email: r.email ?? "",
    telefone: r.telefone ?? "",
    origem: r.origem ?? "",
    status: r.status ?? "Ativo",
    processos: Number(r.processos ?? 0),
    valorCarteira: Number(r.valor_carteira ?? 0),
    createdAt: r.created_at ?? null,
  };
}

function mapFornecedor(r: any) {
  return {
    id: String(r.id),
    nome: r.nome ?? "",
    cnpjCpf: r.cnpj_cpf ?? "",
    tipo: r.tipo ?? "PF",
    email: r.email ?? "",
    telefone: r.telefone ?? "",
    categoria: r.categoria ?? "Outro",
    status: r.status ?? "Ativo",
    createdAt: r.created_at ?? null,
  };
}

function mapContrato(r: any) {
  return {
    id: String(r.id),
    numero: r.numero ?? "",
    cliente: r.cliente ?? "",
    tipo: r.tipo ?? "",
    valor: Number(r.valor ?? 0),
    periodicidade: r.periodicidade ?? "",
    percentualExito: Number(r.percentual_exito ?? 0),
    inicio: r.inicio ?? "",
    fim: r.fim ?? "",
    status: r.status ?? "Vigente",
    createdAt: r.created_at ?? null,
  };
}

function mapProcesso(r: any) {
  return {
    id: String(r.id),
    numero: r.numero ?? "",
    cliente: r.cliente ?? "",
    area: r.area ?? "",
    responsavel: r.responsavel ?? "",
    valorCausa: Number(r.valor_causa ?? 0),
    receitaTotal: Number(r.receita_total ?? 0),
    despesaTotal: Number(r.despesa_total ?? 0),
    margem: Number(r.margem ?? 0),
    status: r.status ?? "Ativo",
    createdAt: r.created_at ?? null,
  };
}

// ─── Receivables ─────────────────────────────────────────────────────────────

router.get("/receivables", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rows = (await db.execute(sql`SELECT * FROM ctrl_receivables WHERE user_id = ${userId} ORDER BY id DESC`)).rows;
    res.json(rows.map(mapReceivable));
  } catch (e) { res.status(500).json({ error: "Erro ao buscar receitas" }); }
});

router.post("/receivables", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { cliente, processo, contrato, vencimento, valor, status } = req.body;
    const row = (await db.execute(sql`
      INSERT INTO ctrl_receivables (user_id, cliente, processo, contrato, vencimento, valor, status)
      VALUES (${userId}, ${cliente ?? ""}, ${processo ?? ""}, ${contrato ?? ""}, ${vencimento ?? ""}, ${Number(valor ?? 0)}, ${status ?? "Aberto"})
      RETURNING *
    `)).rows[0];
    res.status(201).json(mapReceivable(row));
  } catch (e) { res.status(500).json({ error: "Erro ao criar receita" }); }
});

router.put("/receivables/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { status, cliente, processo, contrato, vencimento, valor } = req.body;
    const row = (await db.execute(sql`
      UPDATE ctrl_receivables
      SET status     = COALESCE(${status ?? null}, status),
          cliente    = COALESCE(${cliente ?? null}, cliente),
          processo   = COALESCE(${processo ?? null}, processo),
          contrato   = COALESCE(${contrato ?? null}, contrato),
          vencimento = COALESCE(${vencimento ?? null}, vencimento),
          valor      = COALESCE(${valor != null ? Number(valor) : null}, valor)
      WHERE id = ${Number(id)} AND user_id = ${userId}
      RETURNING *
    `)).rows[0];
    if (!row) return res.status(404).json({ error: "Não encontrado" });
    res.json(mapReceivable(row));
  } catch (e) { res.status(500).json({ error: "Erro ao atualizar receita" }); }
});

router.delete("/receivables/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    await db.execute(sql`DELETE FROM ctrl_receivables WHERE id = ${Number(req.params.id)} AND user_id = ${userId}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Erro ao excluir receita" }); }
});

// ─── Payables ─────────────────────────────────────────────────────────────────

router.get("/payables", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rows = (await db.execute(sql`SELECT * FROM ctrl_payables WHERE user_id = ${userId} ORDER BY id DESC`)).rows;
    res.json(rows.map(mapPayable));
  } catch (e) { res.status(500).json({ error: "Erro ao buscar despesas" }); }
});

router.post("/payables", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { fornecedor, categoria, processo, vencimento, valor, status } = req.body;
    const row = (await db.execute(sql`
      INSERT INTO ctrl_payables (user_id, fornecedor, categoria, processo, vencimento, valor, status)
      VALUES (${userId}, ${fornecedor ?? ""}, ${categoria ?? ""}, ${processo ?? ""}, ${vencimento ?? ""}, ${Number(valor ?? 0)}, ${status ?? "Aberto"})
      RETURNING *
    `)).rows[0];
    res.status(201).json(mapPayable(row));
  } catch (e) { res.status(500).json({ error: "Erro ao criar despesa" }); }
});

router.put("/payables/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { status, fornecedor, categoria, processo, vencimento, valor } = req.body;
    const row = (await db.execute(sql`
      UPDATE ctrl_payables
      SET status     = COALESCE(${status ?? null}, status),
          fornecedor = COALESCE(${fornecedor ?? null}, fornecedor),
          categoria  = COALESCE(${categoria ?? null}, categoria),
          processo   = COALESCE(${processo ?? null}, processo),
          vencimento = COALESCE(${vencimento ?? null}, vencimento),
          valor      = COALESCE(${valor != null ? Number(valor) : null}, valor)
      WHERE id = ${Number(id)} AND user_id = ${userId}
      RETURNING *
    `)).rows[0];
    if (!row) return res.status(404).json({ error: "Não encontrado" });
    res.json(mapPayable(row));
  } catch (e) { res.status(500).json({ error: "Erro ao atualizar despesa" }); }
});

router.delete("/payables/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    await db.execute(sql`DELETE FROM ctrl_payables WHERE id = ${Number(req.params.id)} AND user_id = ${userId}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Erro ao excluir despesa" }); }
});

// ─── Activities ───────────────────────────────────────────────────────────────

router.get("/activities", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rows = (await db.execute(sql`SELECT * FROM ctrl_activities WHERE user_id = ${userId} ORDER BY id DESC LIMIT 50`)).rows;
    res.json(rows.map(mapActivity));
  } catch (e) { res.status(500).json({ error: "Erro ao buscar atividades" }); }
});

router.post("/activities", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { title, description, value, time } = req.body;
    const row = (await db.execute(sql`
      INSERT INTO ctrl_activities (user_id, title, description, value, time)
      VALUES (${userId}, ${title ?? ""}, ${description ?? ""}, ${value != null ? Number(value) : null}, ${time ?? ""})
      RETURNING *
    `)).rows[0];
    res.status(201).json(mapActivity(row));
  } catch (e) { res.status(500).json({ error: "Erro ao criar atividade" }); }
});

router.delete("/activities/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    await db.execute(sql`DELETE FROM ctrl_activities WHERE id = ${Number(req.params.id)} AND user_id = ${userId}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Erro ao excluir atividade" }); }
});

// ─── Alerts ───────────────────────────────────────────────────────────────────

router.get("/alerts", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rows = (await db.execute(sql`SELECT * FROM ctrl_alerts WHERE user_id = ${userId} ORDER BY id DESC`)).rows;
    res.json(rows.map(mapAlert));
  } catch (e) { res.status(500).json({ error: "Erro ao buscar alertas" }); }
});

router.post("/alerts", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { title, description, severity } = req.body;
    const row = (await db.execute(sql`
      INSERT INTO ctrl_alerts (user_id, title, description, severity)
      VALUES (${userId}, ${title ?? ""}, ${description ?? ""}, ${severity ?? "media"})
      RETURNING *
    `)).rows[0];
    res.status(201).json(mapAlert(row));
  } catch (e) { res.status(500).json({ error: "Erro ao criar alerta" }); }
});

router.delete("/alerts/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    await db.execute(sql`DELETE FROM ctrl_alerts WHERE id = ${Number(req.params.id)} AND user_id = ${userId}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Erro ao excluir alerta" }); }
});

// ─── Clientes ─────────────────────────────────────────────────────────────────

router.get("/clientes", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rows = (await db.execute(sql`SELECT * FROM ctrl_clientes WHERE user_id = ${userId} ORDER BY id DESC`)).rows;
    res.json(rows.map(mapCliente));
  } catch (e) { res.status(500).json({ error: "Erro ao buscar clientes" }); }
});

router.post("/clientes", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { nome, cnpjCpf, tipo, responsavel, email, telefone, origem, status, processos, valorCarteira } = req.body;
    const row = (await db.execute(sql`
      INSERT INTO ctrl_clientes (user_id, nome, cnpj_cpf, tipo, responsavel, email, telefone, origem, status, processos, valor_carteira)
      VALUES (${userId}, ${nome ?? ""}, ${cnpjCpf ?? ""}, ${tipo ?? "PF"}, ${responsavel ?? ""}, ${email ?? ""}, ${telefone ?? ""}, ${origem ?? ""}, ${status ?? "Ativo"}, ${Number(processos ?? 0)}, ${Number(valorCarteira ?? 0)})
      RETURNING *
    `)).rows[0];
    res.status(201).json(mapCliente(row));
  } catch (e) { res.status(500).json({ error: "Erro ao criar cliente" }); }
});

router.delete("/clientes/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    await db.execute(sql`DELETE FROM ctrl_clientes WHERE id = ${Number(req.params.id)} AND user_id = ${userId}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Erro ao excluir cliente" }); }
});

// ─── Fornecedores ─────────────────────────────────────────────────────────────

router.get("/fornecedores", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rows = (await db.execute(sql`SELECT * FROM ctrl_fornecedores WHERE user_id = ${userId} ORDER BY id DESC`)).rows;
    res.json(rows.map(mapFornecedor));
  } catch (e) { res.status(500).json({ error: "Erro ao buscar fornecedores" }); }
});

router.post("/fornecedores", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { nome, cnpjCpf, tipo, email, telefone, categoria, status } = req.body;
    const row = (await db.execute(sql`
      INSERT INTO ctrl_fornecedores (user_id, nome, cnpj_cpf, tipo, email, telefone, categoria, status)
      VALUES (${userId}, ${nome ?? ""}, ${cnpjCpf ?? ""}, ${tipo ?? "PF"}, ${email ?? ""}, ${telefone ?? ""}, ${categoria ?? "Outro"}, ${status ?? "Ativo"})
      RETURNING *
    `)).rows[0];
    res.status(201).json(mapFornecedor(row));
  } catch (e) { res.status(500).json({ error: "Erro ao criar fornecedor" }); }
});

router.delete("/fornecedores/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    await db.execute(sql`DELETE FROM ctrl_fornecedores WHERE id = ${Number(req.params.id)} AND user_id = ${userId}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Erro ao excluir fornecedor" }); }
});

// ─── Contratos ────────────────────────────────────────────────────────────────

router.get("/contratos", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rows = (await db.execute(sql`SELECT * FROM ctrl_contratos WHERE user_id = ${userId} ORDER BY id DESC`)).rows;
    res.json(rows.map(mapContrato));
  } catch (e) { res.status(500).json({ error: "Erro ao buscar contratos" }); }
});

router.post("/contratos", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { numero, cliente, tipo, valor, periodicidade, percentualExito, inicio, fim, status } = req.body;
    const row = (await db.execute(sql`
      INSERT INTO ctrl_contratos (user_id, numero, cliente, tipo, valor, periodicidade, percentual_exito, inicio, fim, status)
      VALUES (${userId}, ${numero ?? ""}, ${cliente ?? ""}, ${tipo ?? ""}, ${Number(valor ?? 0)}, ${periodicidade ?? ""}, ${Number(percentualExito ?? 0)}, ${inicio ?? ""}, ${fim ?? ""}, ${status ?? "Vigente"})
      RETURNING *
    `)).rows[0];
    res.status(201).json(mapContrato(row));
  } catch (e) { res.status(500).json({ error: "Erro ao criar contrato" }); }
});

router.delete("/contratos/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    await db.execute(sql`DELETE FROM ctrl_contratos WHERE id = ${Number(req.params.id)} AND user_id = ${userId}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Erro ao excluir contrato" }); }
});

// ─── Processos ────────────────────────────────────────────────────────────────

router.get("/processos", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rows = (await db.execute(sql`SELECT * FROM ctrl_processos WHERE user_id = ${userId} ORDER BY id DESC`)).rows;
    res.json(rows.map(mapProcesso));
  } catch (e) { res.status(500).json({ error: "Erro ao buscar processos" }); }
});

router.post("/processos", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { numero, cliente, area, responsavel, valorCausa, receitaTotal, despesaTotal, margem, status } = req.body;
    const row = (await db.execute(sql`
      INSERT INTO ctrl_processos (user_id, numero, cliente, area, responsavel, valor_causa, receita_total, despesa_total, margem, status)
      VALUES (${userId}, ${numero ?? ""}, ${cliente ?? ""}, ${area ?? ""}, ${responsavel ?? ""}, ${Number(valorCausa ?? 0)}, ${Number(receitaTotal ?? 0)}, ${Number(despesaTotal ?? 0)}, ${Number(margem ?? 0)}, ${status ?? "Ativo"})
      RETURNING *
    `)).rows[0];
    res.status(201).json(mapProcesso(row));
  } catch (e) { res.status(500).json({ error: "Erro ao criar processo" }); }
});

router.delete("/processos/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    await db.execute(sql`DELETE FROM ctrl_processos WHERE id = ${Number(req.params.id)} AND user_id = ${userId}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Erro ao excluir processo" }); }
});

// ─── Backup & Restore ─────────────────────────────────────────────────────────

router.get("/backup", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [rec, pay, act, cli, forn, cont, proc] = await Promise.all([
      db.execute(sql`SELECT * FROM ctrl_receivables WHERE user_id = ${userId} ORDER BY id`),
      db.execute(sql`SELECT * FROM ctrl_payables WHERE user_id = ${userId} ORDER BY id`),
      db.execute(sql`SELECT * FROM ctrl_activities WHERE user_id = ${userId} ORDER BY id DESC LIMIT 500`),
      db.execute(sql`SELECT * FROM ctrl_clientes WHERE user_id = ${userId} ORDER BY id`),
      db.execute(sql`SELECT * FROM ctrl_fornecedores WHERE user_id = ${userId} ORDER BY id`),
      db.execute(sql`SELECT * FROM ctrl_contratos WHERE user_id = ${userId} ORDER BY id`),
      db.execute(sql`SELECT * FROM ctrl_processos WHERE user_id = ${userId} ORDER BY id`),
    ]);
    res.json({
      version: "1.0",
      exportedAt: new Date().toISOString(),
      receivables: rec.rows.map(mapReceivable),
      payables: pay.rows.map(mapPayable),
      activities: act.rows.map(mapActivity),
      clientes: cli.rows.map(mapCliente),
      fornecedores: forn.rows.map(mapFornecedor),
      contratos: cont.rows.map(mapContrato),
      processos: proc.rows.map(mapProcesso),
    });
  } catch (e) { res.status(500).json({ error: "Erro ao gerar backup" }); }
});

router.post("/restore", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;
    if (!data?.version) return res.status(400).json({ error: "Arquivo de backup inválido" });

    let imported = 0;

    for (const r of (data.receivables ?? [])) {
      await db.execute(sql`
        INSERT INTO ctrl_receivables (user_id, cliente, processo, contrato, vencimento, valor, status)
        VALUES (${userId}, ${r.cliente ?? ""}, ${r.processo ?? ""}, ${r.contrato ?? ""}, ${r.vencimento ?? ""}, ${Number(r.valor ?? 0)}, ${r.status ?? "Aberto"})
      `);
      imported++;
    }

    for (const p of (data.payables ?? [])) {
      await db.execute(sql`
        INSERT INTO ctrl_payables (user_id, fornecedor, categoria, processo, vencimento, valor, status)
        VALUES (${userId}, ${p.fornecedor ?? ""}, ${p.categoria ?? ""}, ${p.processo ?? ""}, ${p.vencimento ?? ""}, ${Number(p.valor ?? 0)}, ${p.status ?? "Aberto"})
      `);
      imported++;
    }

    for (const c of (data.clientes ?? [])) {
      await db.execute(sql`
        INSERT INTO ctrl_clientes (user_id, nome, cnpj_cpf, tipo, responsavel, email, telefone, origem, status, processos, valor_carteira)
        VALUES (${userId}, ${c.nome ?? ""}, ${c.cnpjCpf ?? ""}, ${c.tipo ?? "PF"}, ${c.responsavel ?? ""}, ${c.email ?? ""}, ${c.telefone ?? ""}, ${c.origem ?? ""}, ${c.status ?? "Ativo"}, ${Number(c.processos ?? 0)}, ${Number(c.valorCarteira ?? 0)})
      `);
      imported++;
    }

    for (const f of (data.fornecedores ?? [])) {
      await db.execute(sql`
        INSERT INTO ctrl_fornecedores (user_id, nome, cnpj_cpf, tipo, email, telefone, categoria, status)
        VALUES (${userId}, ${f.nome ?? ""}, ${f.cnpjCpf ?? ""}, ${f.tipo ?? "PF"}, ${f.email ?? ""}, ${f.telefone ?? ""}, ${f.categoria ?? "Outro"}, ${f.status ?? "Ativo"})
      `);
      imported++;
    }

    for (const c of (data.contratos ?? [])) {
      await db.execute(sql`
        INSERT INTO ctrl_contratos (user_id, numero, cliente, tipo, valor, periodicidade, percentual_exito, inicio, fim, status)
        VALUES (${userId}, ${c.numero ?? ""}, ${c.cliente ?? ""}, ${c.tipo ?? ""}, ${Number(c.valor ?? 0)}, ${c.periodicidade ?? "Mensal"}, ${Number(c.percentualExito ?? 0)}, ${c.inicio ?? ""}, ${c.fim ?? ""}, ${c.status ?? "Vigente"})
      `);
      imported++;
    }

    for (const p of (data.processos ?? [])) {
      await db.execute(sql`
        INSERT INTO ctrl_processos (user_id, numero, cliente, area, responsavel, valor_causa, receita_total, despesa_total, margem, status)
        VALUES (${userId}, ${p.numero ?? ""}, ${p.cliente ?? ""}, ${p.area ?? ""}, ${p.responsavel ?? ""}, ${Number(p.valorCausa ?? 0)}, ${Number(p.receitaTotal ?? 0)}, ${Number(p.despesaTotal ?? 0)}, ${Number(p.margem ?? 0)}, ${p.status ?? "Ativo"})
      `);
      imported++;
    }

    res.json({ ok: true, imported });
  } catch (e: any) { res.status(500).json({ error: "Erro ao restaurar backup: " + (e?.message ?? "") }); }
});

export default router;
