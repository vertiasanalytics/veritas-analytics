import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireAdmin } from "../middlewares/auth.js";
import multer from "multer";
import { parse as parseCsv } from "csv-parse/sync";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CONVENIO_COLS = sql`
  id, codigo,
  nome_convenio              AS "nomeConvenio",
  tipo_convenio              AS "tipoConvenio",
  contratante_nome           AS "contratanteNome",
  contratante_documento      AS "contratanteDocumento",
  email_financeiro           AS "emailFinanceiro",
  telefone_financeiro        AS "telefoneFinanceiro",
  responsavel_nome           AS "responsavelNome",
  responsavel_cargo          AS "responsavelCargo",
  responsavel_email          AS "responsavelEmail",
  TO_CHAR(data_inicio, 'YYYY-MM-DD')           AS "dataInicio",
  TO_CHAR(data_fim,    'YYYY-MM-DD')           AS "dataFim",
  TO_CHAR(data_renovacao, 'YYYY-MM-DD')        AS "dataRenovacao",
  status,
  renovacao_automatica       AS "renovacaoAutomatica",
  prazo_aviso_previos_dias   AS "prazoAvisoPrevioDias",
  CAST(valor_contratado AS FLOAT)              AS "valorContratado",
  CAST(valor_pago AS FLOAT)                   AS "valorPago",
  limite_creditos_mensal     AS "limiteCreditosMensal",
  limite_usuarios            AS "limiteUsuarios",
  observacoes,
  cancelado_em               AS "canceladoEm",
  cancelado_motivo           AS "canceladoMotivo",
  prorrogado_em              AS "prorrogadoEm",
  TO_CHAR(prorrogado_nova_data_fim, 'YYYY-MM-DD') AS "prorrogadoNovaDataFim",
  criterio_validacao          AS "criterioValidacao",
  exige_lista_elegiveis       AS "exigeListaElegiveis",
  dominio_email_permitido     AS "dominioEmailPermitido",
  creditos_iniciais_usuario   AS "creditosIniciaisUsuario"
`;

const ELEGIVEL_COLS = sql`
  id, convenio_id AS "convenioId",
  nome, cpf, email,
  numero_oab AS "numeroOab", uf_oab AS "ufOab",
  matricula, status,
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const USUARIO_COLS = sql`
  id,
  convenio_id                AS "convenioId",
  nome, cpf,
  numero_oab                 AS "numeroOab",
  uf_oab                     AS "ufOab",
  matricula,
  TO_CHAR(data_nascimento, 'YYYY-MM-DD') AS "dataNascimento",
  telefone, email,
  cargo_profissional         AS "cargoProfissional",
  especialidade, cidade, estado, endereco, status,
  creditos_iniciais          AS "creditosIniciais",
  creditos_disponiveis       AS "creditosDisponiveis",
  creditos_comprados_total   AS "creditosCompradosTotal",
  creditos_utilizados_total  AS "creditosUtilizadosTotal",
  ultimo_login_em            AS "ultimoLoginEm",
  primeiro_acesso_pendente   AS "primeiroAcessoPendente",
  redefinir_senha_obrigatoria AS "redefinirSenhaObrigatoria",
  origem_vinculo             AS "origemVinculo"
`;

// ─── CRUD Convênios ───────────────────────────────────────────────────────────

router.get("/", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT ${CONVENIO_COLS}
      FROM convenios
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("[convenios] GET /", err);
    res.status(500).json({ error: "Erro ao buscar convênios" });
  }
});

router.get("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.execute(sql`
      SELECT ${CONVENIO_COLS}
      FROM convenios
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `);
    if (!result.rows.length) { res.status(404).json({ error: "Não encontrado" }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[convenios] GET /:id", err);
    res.status(500).json({ error: "Erro ao buscar convênio" });
  }
});

/** Gera código único no padrão XXXX-XXXX (sem caracteres ambíguos). */
function generateConvenioCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${seg()}-${seg()}`;
}

router.post("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;

    // Gera código único se não fornecido
    let codigo = typeof b.codigo === "string" && b.codigo.trim() ? b.codigo.trim() : null;
    if (!codigo) {
      // Garante unicidade gerando até 5 tentativas
      for (let i = 0; i < 5; i++) {
        const candidate = generateConvenioCode();
        const exists = await db.execute(sql`SELECT 1 FROM convenios WHERE codigo = ${candidate} LIMIT 1`);
        if (exists.rows.length === 0) { codigo = candidate; break; }
      }
      if (!codigo) codigo = generateConvenioCode(); // fallback sem checar (extremamente improvável colisão)
    }

    const result = await db.execute(sql`
      INSERT INTO convenios (
        codigo, nome_convenio, tipo_convenio, contratante_nome, contratante_documento,
        email_financeiro, telefone_financeiro, responsavel_nome, responsavel_cargo, responsavel_email,
        data_inicio, data_fim, data_renovacao, status, renovacao_automatica, prazo_aviso_previos_dias,
        valor_contratado, valor_pago, limite_creditos_mensal, limite_usuarios, observacoes,
        criterio_validacao, exige_lista_elegiveis, dominio_email_permitido, creditos_iniciais_usuario
      ) VALUES (
        ${codigo}, ${b.nomeConvenio}, ${b.tipoConvenio ?? "OAB"}, ${b.contratanteNome ?? null},
        ${b.contratanteDocumento ?? null}, ${b.emailFinanceiro ?? null}, ${b.telefoneFinanceiro ?? null},
        ${b.responsavelNome ?? null}, ${b.responsavelCargo ?? null}, ${b.responsavelEmail ?? null},
        ${b.dataInicio}::date, ${b.dataFim}::date,
        ${b.dataRenovacao ? sql`${b.dataRenovacao}::date` : sql`NULL`},
        ${b.status ?? "ativo"}, ${b.renovacaoAutomatica ?? false},
        ${b.prazoAvisoPrevioDias ?? 30},
        ${b.valorContratado ?? 0}, ${b.valorPago ?? 0},
        ${b.limiteCreditosMensal ?? 0}, ${b.limiteUsuarios ?? 0},
        ${b.observacoes ?? null},
        ${b.criterioValidacao ?? "oab_uf"},
        ${b.exigeListaElegiveis ?? true},
        ${b.dominioEmailPermitido ?? null},
        ${b.creditosIniciaisUsuario ?? 0}
      )
      RETURNING ${CONVENIO_COLS}
    `);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("[convenios] POST /", err);
    res.status(500).json({ error: "Erro ao criar convênio" });
  }
});

router.put("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const b = req.body as Record<string, unknown>;
    const result = await db.execute(sql`
      UPDATE convenios SET
        codigo                 = ${b.codigo},
        nome_convenio          = ${b.nomeConvenio},
        tipo_convenio          = ${b.tipoConvenio ?? "OAB"},
        contratante_nome       = ${b.contratanteNome},
        contratante_documento  = ${b.contratanteDocumento ?? null},
        email_financeiro       = ${b.emailFinanceiro ?? null},
        telefone_financeiro    = ${b.telefoneFinanceiro ?? null},
        responsavel_nome       = ${b.responsavelNome ?? null},
        responsavel_cargo      = ${b.responsavelCargo ?? null},
        responsavel_email      = ${b.responsavelEmail ?? null},
        data_inicio            = ${b.dataInicio}::date,
        data_fim               = ${b.dataFim}::date,
        data_renovacao         = ${b.dataRenovacao ? sql`${b.dataRenovacao}::date` : sql`NULL`},
        status                 = ${b.status ?? "ativo"},
        renovacao_automatica   = ${b.renovacaoAutomatica ?? false},
        prazo_aviso_previos_dias = ${b.prazoAvisoPrevioDias ?? 30},
        valor_contratado       = ${b.valorContratado ?? 0},
        valor_pago             = ${b.valorPago ?? 0},
        limite_creditos_mensal = ${b.limiteCreditosMensal ?? 0},
        limite_usuarios        = ${b.limiteUsuarios ?? 0},
        observacoes            = ${b.observacoes ?? null}
      WHERE id = ${id}::uuid AND deleted_at IS NULL
      RETURNING ${CONVENIO_COLS}
    `);
    if (!result.rows.length) { res.status(404).json({ error: "Não encontrado" }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[convenios] PUT /:id", err);
    res.status(500).json({ error: "Erro ao atualizar convênio" });
  }
});

router.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.execute(sql`
      UPDATE convenios SET deleted_at = NOW() WHERE id = ${id}::uuid
    `);
    res.json({ ok: true });
  } catch (err) {
    console.error("[convenios] DELETE /:id", err);
    res.status(500).json({ error: "Erro ao excluir convênio" });
  }
});

// ─── Ações especiais ──────────────────────────────────────────────────────────

router.post("/:id/cancelar", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body as { motivo?: string };
    const result = await db.execute(sql`
      UPDATE convenios
      SET status = 'cancelado', cancelado_em = NOW(), cancelado_motivo = ${motivo ?? null}
      WHERE id = ${id}::uuid AND deleted_at IS NULL
      RETURNING ${CONVENIO_COLS}
    `);
    if (!result.rows.length) { res.status(404).json({ error: "Não encontrado" }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[convenios] POST /:id/cancelar", err);
    res.status(500).json({ error: "Erro ao cancelar convênio" });
  }
});

router.post("/:id/renovar", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { novaDataFim } = req.body as { novaDataFim: string };
    if (!novaDataFim) { res.status(400).json({ error: "novaDataFim obrigatório" }); return; }
    const result = await db.execute(sql`
      UPDATE convenios
      SET data_fim = ${novaDataFim}::date, data_renovacao = ${novaDataFim}::date, status = 'ativo'
      WHERE id = ${id}::uuid AND deleted_at IS NULL
      RETURNING ${CONVENIO_COLS}
    `);
    if (!result.rows.length) { res.status(404).json({ error: "Não encontrado" }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[convenios] POST /:id/renovar", err);
    res.status(500).json({ error: "Erro ao renovar convênio" });
  }
});

router.post("/:id/prorrogar", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { novaDataFim } = req.body as { novaDataFim: string };
    if (!novaDataFim) { res.status(400).json({ error: "novaDataFim obrigatório" }); return; }
    const result = await db.execute(sql`
      UPDATE convenios
      SET data_fim = ${novaDataFim}::date,
          prorrogado_em = NOW(),
          prorrogado_nova_data_fim = ${novaDataFim}::date
      WHERE id = ${id}::uuid AND deleted_at IS NULL
      RETURNING ${CONVENIO_COLS}
    `);
    if (!result.rows.length) { res.status(404).json({ error: "Não encontrado" }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[convenios] POST /:id/prorrogar", err);
    res.status(500).json({ error: "Erro ao prorrogar convênio" });
  }
});

// ─── Usuários do convênio ─────────────────────────────────────────────────────

router.get("/:id/usuarios", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.execute(sql`
      SELECT ${USUARIO_COLS}
      FROM convenio_usuarios
      WHERE convenio_id = ${id}::uuid AND deleted_at IS NULL
      ORDER BY nome
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("[convenios] GET /:id/usuarios", err);
    res.status(500).json({ error: "Erro ao buscar usuários" });
  }
});

router.post("/:id/usuarios", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const b = req.body as Record<string, unknown>;

    if (!b.senha || String(b.senha).length < 8) {
      res.status(400).json({ error: "Senha obrigatória e deve ter ao menos 8 caracteres" });
      return;
    }
    const senhaStr = String(b.senha);
    if (!/[a-zA-Z]/.test(senhaStr) || !/[0-9]/.test(senhaStr)) {
      res.status(400).json({ error: "A senha deve conter ao menos 1 letra e 1 número" });
      return;
    }
    const senhaHash = await bcrypt.hash(senhaStr, 10);
    const primeiroAcesso = b.exigirTrocaSenha !== false;

    const result = await db.execute(sql`
      INSERT INTO convenio_usuarios (
        convenio_id, nome, cpf, numero_oab, uf_oab, data_nascimento, telefone, email,
        cargo_profissional, especialidade, cidade, estado, endereco, status,
        creditos_iniciais, creditos_disponiveis, creditos_comprados_total, creditos_utilizados_total,
        senha_hash, primeiro_acesso_pendente, redefinir_senha_obrigatoria
      ) VALUES (
        ${id}::uuid,
        ${b.nome}, ${b.cpf ?? null}, ${b.numeroOab}, ${b.ufOab},
        ${b.dataNascimento ? sql`${b.dataNascimento}::date` : sql`NULL`},
        ${b.telefone ?? null}, ${b.email},
        ${b.cargoProfissional ?? null}, ${b.especialidade ?? null},
        ${b.cidade ?? null}, ${b.estado ?? null}, ${b.endereco ?? null},
        ${b.status ?? "ativo"},
        ${b.creditosIniciais ?? 0}, ${b.creditosDisponiveis ?? 0},
        ${b.creditosCompradosTotal ?? 0}, ${b.creditosUtilizadosTotal ?? 0},
        ${senhaHash}, ${primeiroAcesso}, ${primeiroAcesso}
      )
      RETURNING ${USUARIO_COLS}
    `);
    res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    console.error("[convenios] POST /:id/usuarios", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unq_oab_por_convenio")) {
      res.status(409).json({ error: "OAB já cadastrada neste convênio" });
    } else if (msg.includes("unq_email_por_convenio")) {
      res.status(409).json({ error: "E-mail já cadastrado neste convênio" });
    } else {
      res.status(500).json({ error: "Erro ao criar usuário" });
    }
  }
});

router.put("/:id/usuarios/:uid", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    const b = req.body as Record<string, unknown>;

    // Optionally update password
    let senhaClause = sql`senha_hash = senha_hash`; // noop
    const exigirTroca = Boolean(b.exigirTrocaSenha);
    if (b.senha) {
      const senhaStr = String(b.senha);
      if (senhaStr.length < 8) {
        res.status(400).json({ error: "A senha deve ter ao menos 8 caracteres" });
        return;
      }
      if (!/[a-zA-Z]/.test(senhaStr) || !/[0-9]/.test(senhaStr)) {
        res.status(400).json({ error: "A senha deve conter ao menos 1 letra e 1 número" });
        return;
      }
      const hash = await bcrypt.hash(senhaStr, 10);
      senhaClause = sql`senha_hash = ${hash}, primeiro_acesso_pendente = ${exigirTroca}, redefinir_senha_obrigatoria = ${exigirTroca}`;
    }

    const result = await db.execute(sql`
      UPDATE convenio_usuarios SET
        nome                    = ${b.nome},
        cpf                     = ${b.cpf ?? null},
        numero_oab              = ${b.numeroOab},
        uf_oab                  = ${b.ufOab},
        data_nascimento         = ${b.dataNascimento ? sql`${b.dataNascimento}::date` : sql`NULL`},
        telefone                = ${b.telefone ?? null},
        email                   = ${b.email},
        cargo_profissional      = ${b.cargoProfissional ?? null},
        especialidade           = ${b.especialidade ?? null},
        cidade                  = ${b.cidade ?? null},
        estado                  = ${b.estado ?? null},
        endereco                = ${b.endereco ?? null},
        status                  = ${b.status ?? "ativo"},
        creditos_iniciais       = ${b.creditosIniciais ?? 0},
        creditos_disponiveis    = ${b.creditosDisponiveis ?? 0},
        creditos_comprados_total = ${b.creditosCompradosTotal ?? 0},
        creditos_utilizados_total = ${b.creditosUtilizadosTotal ?? 0},
        ${senhaClause}
      WHERE id = ${uid}::uuid AND deleted_at IS NULL
      RETURNING ${USUARIO_COLS}
    `);
    if (!result.rows.length) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
    res.json(result.rows[0]);
  } catch (err: unknown) {
    console.error("[convenios] PUT /:id/usuarios/:uid", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unq_oab_por_convenio")) {
      res.status(409).json({ error: "OAB já cadastrada neste convênio" });
    } else if (msg.includes("unq_email_por_convenio")) {
      res.status(409).json({ error: "E-mail já cadastrado neste convênio" });
    } else {
      res.status(500).json({ error: "Erro ao atualizar usuário" });
    }
  }
});

router.delete("/:id/usuarios/:uid", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    await db.execute(sql`
      UPDATE convenio_usuarios SET deleted_at = NOW() WHERE id = ${uid}::uuid
    `);
    res.json({ ok: true });
  } catch (err) {
    console.error("[convenios] DELETE /:id/usuarios/:uid", err);
    res.status(500).json({ error: "Erro ao excluir usuário" });
  }
});

// ─── Uso / Stats ──────────────────────────────────────────────────────────────

router.get("/:id/uso", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.execute(sql`
      SELECT
        id,
        convenio_id AS "convenioId",
        usuario_id  AS "usuarioId",
        modulo,
        data_uso    AS "dataUso",
        tempo_uso_segundos   AS "tempoUsoSegundos",
        creditos_usados      AS "creditosUsados",
        creditos_comprados   AS "creditosComprados"
      FROM convenio_uso_modulos
      WHERE convenio_id = ${id}::uuid
      ORDER BY data_uso DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("[convenios] GET /:id/uso", err);
    res.status(500).json({ error: "Erro ao buscar uso" });
  }
});

router.get("/:id/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [statsRow] = (await db.execute(sql`
      SELECT
        COUNT(DISTINCT u.id) FILTER (WHERE u.deleted_at IS NULL)                     AS "totalUsuarios",
        COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'ativo' AND u.deleted_at IS NULL) AS "usuariosAtivos",
        COALESCE(SUM(m.creditos_usados), 0)                                           AS "totalCreditosUsados",
        COALESCE(SUM(m.creditos_comprados), 0)                                        AS "totalCreditosComprados",
        COALESCE(SUM(m.tempo_uso_segundos), 0)                                        AS "totalTempo"
      FROM convenios c
      LEFT JOIN convenio_usuarios u ON u.convenio_id = c.id
      LEFT JOIN convenio_uso_modulos m ON m.convenio_id = c.id
      WHERE c.id = ${id}::uuid
    `)).rows;

    const porUsuario = (await db.execute(sql`
      SELECT
        u.id AS "usuarioId",
        u.nome,
        COALESCE(SUM(m.tempo_uso_segundos), 0)  AS "tempo",
        COALESCE(SUM(m.creditos_usados), 0)     AS "creditosUsados",
        COALESCE(SUM(m.creditos_comprados), 0)  AS "creditosComprados",
        ARRAY_AGG(DISTINCT m.modulo) FILTER (WHERE m.modulo IS NOT NULL) AS "modulos"
      FROM convenio_usuarios u
      LEFT JOIN convenio_uso_modulos m ON m.usuario_id = u.id
      WHERE u.convenio_id = ${id}::uuid AND u.deleted_at IS NULL
      GROUP BY u.id, u.nome
      ORDER BY u.nome
    `)).rows;

    const porModulo = (await db.execute(sql`
      SELECT
        modulo,
        COALESCE(SUM(tempo_uso_segundos), 0)  AS "tempo",
        COALESCE(SUM(creditos_usados), 0)     AS "creditosUsados",
        COALESCE(SUM(creditos_comprados), 0)  AS "creditosComprados"
      FROM convenio_uso_modulos
      WHERE convenio_id = ${id}::uuid
      GROUP BY modulo
      ORDER BY modulo
    `)).rows;

    res.json({ summary: statsRow, porUsuario, porModulo });
  } catch (err) {
    console.error("[convenios] GET /:id/stats", err);
    res.status(500).json({ error: "Erro ao buscar estatísticas" });
  }
});

// ─── CRUD Elegíveis ───────────────────────────────────────────────────────────

// GET /api/convenios/:id/elegiveis
router.get("/:id/elegiveis", requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { search, status } = req.query as Record<string, string>;
  try {
    const rows = (await db.execute(sql`
      SELECT ${ELEGIVEL_COLS}
      FROM convenio_elegiveis
      WHERE convenio_id = ${id}::uuid
        ${status ? sql`AND status = ${status}` : sql``}
        ${search ? sql`AND (
          LOWER(nome) LIKE ${"%" + search.toLowerCase() + "%"}
          OR LOWER(email) LIKE ${"%" + search.toLowerCase() + "%"}
          OR LOWER(cpf) LIKE ${"%" + search.toLowerCase() + "%"}
          OR LOWER(numero_oab) LIKE ${"%" + search.toLowerCase() + "%"}
          OR LOWER(matricula) LIKE ${"%" + search.toLowerCase() + "%"}
        )` : sql``}
      ORDER BY nome ASC NULLS LAST, created_at DESC
    `)).rows;
    res.json(rows);
  } catch (err) {
    console.error("[convenios] GET /:id/elegiveis", err);
    res.status(500).json({ error: "Erro ao buscar elegíveis" });
  }
});

// POST /api/convenios/:id/elegiveis
router.post("/:id/elegiveis", requireAdmin, async (req: Request, res: Response) => {
  const { id: convenioId } = req.params;
  const { nome, cpf, email, numeroOab, ufOab, matricula, status = "ativo" } = req.body;
  try {
    const result = await db.execute(sql`
      INSERT INTO convenio_elegiveis
        (convenio_id, nome, cpf, email, numero_oab, uf_oab, matricula, status)
      VALUES
        (${convenioId}::uuid, ${nome ?? null}, ${cpf ?? null}, ${email ?? null},
         ${numeroOab ?? null}, ${ufOab ?? null}, ${matricula ?? null}, ${status})
      RETURNING ${ELEGIVEL_COLS}
    `);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error("[convenios] POST /:id/elegiveis", err);
    res.status(500).json({ error: "Erro ao cadastrar elegível" });
  }
});

// PUT /api/convenios/elegiveis/:elegivelId
router.put("/elegiveis/:elegivelId", requireAdmin, async (req: Request, res: Response) => {
  const { elegivelId } = req.params;
  const { nome, cpf, email, numeroOab, ufOab, matricula, status } = req.body;
  try {
    const result = await db.execute(sql`
      UPDATE convenio_elegiveis
      SET
        nome       = COALESCE(${nome ?? null}, nome),
        cpf        = COALESCE(${cpf ?? null}, cpf),
        email      = COALESCE(${email ?? null}, email),
        numero_oab = COALESCE(${numeroOab ?? null}, numero_oab),
        uf_oab     = COALESCE(${ufOab ?? null}, uf_oab),
        matricula  = COALESCE(${matricula ?? null}, matricula),
        status     = COALESCE(${status ?? null}, status)
      WHERE id = ${elegivelId}::uuid
      RETURNING ${ELEGIVEL_COLS}
    `);
    if (!result.rows.length) { res.status(404).json({ error: "Elegível não encontrado" }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[convenios] PUT /elegiveis/:id", err);
    res.status(500).json({ error: "Erro ao atualizar elegível" });
  }
});

// DELETE /api/convenios/elegiveis/:elegivelId
router.delete("/elegiveis/:elegivelId", requireAdmin, async (req: Request, res: Response) => {
  const { elegivelId } = req.params;
  try {
    await db.execute(sql`DELETE FROM convenio_elegiveis WHERE id = ${elegivelId}::uuid`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[convenios] DELETE /elegiveis/:id", err);
    res.status(500).json({ error: "Erro ao excluir elegível" });
  }
});

// POST /api/convenios/:id/elegiveis/import-csv
router.post("/:id/elegiveis/import-csv", requireAdmin, upload.single("csv"), async (req: Request, res: Response) => {
  const { id: convenioId } = req.params;
  if (!req.file) { res.status(400).json({ error: "Arquivo CSV não enviado" }); return; }

  try {
    const content = req.file.buffer.toString("utf-8");
    const records = parseCsv(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[];

    let inseridos = 0;
    let ignorados = 0;
    const erros: string[] = [];

    for (const row of records) {
      const nome     = row.nome || row.Nome || null;
      const cpf      = row.cpf || row.CPF || null;
      const email    = row.email || row.Email || null;
      const oab      = row.numero_oab || row.oab || row.OAB || null;
      const uf       = row.uf_oab || row.UF || row.uf || null;
      const matr     = row.matricula || row.Matricula || null;

      if (!nome && !cpf && !email && !oab) {
        ignorados++;
        continue;
      }

      try {
        await db.execute(sql`
          INSERT INTO convenio_elegiveis
            (convenio_id, nome, cpf, email, numero_oab, uf_oab, matricula)
          VALUES
            (${convenioId}::uuid, ${nome}, ${cpf}, ${email}, ${oab}, ${uf}, ${matr})
          ON CONFLICT DO NOTHING
        `);
        inseridos++;
      } catch (e: any) {
        erros.push(`Linha inválida: ${JSON.stringify(row)}`);
        ignorados++;
      }
    }

    res.json({ inseridos, ignorados, erros: erros.slice(0, 20) });
  } catch (err) {
    console.error("[convenios] POST /:id/elegiveis/import-csv", err);
    res.status(500).json({ error: "Erro ao processar CSV" });
  }
});

export default router;
