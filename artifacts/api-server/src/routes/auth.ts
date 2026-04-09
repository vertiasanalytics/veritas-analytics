import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { db, pool } from "@workspace/db";
import { users, passwordResets } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { requireAuth, JWT_SECRET } from "../middlewares/auth.js";
import { getOrCreateWallet, creditWallet } from "./wallet.js";

const router = Router();

function generateTempPassword(len = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pass = "";
  for (let i = 0; i < len; i++) {
    pass += chars[Math.floor(Math.random() * chars.length)];
  }
  return pass;
}

async function sendEmail(to: string, subject: string, html: string) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log(`[VERITAS EMAIL] Para: ${to} | Assunto: ${subject}`);
    console.log(`[VERITAS EMAIL] ${html.replace(/<[^>]+>/g, "")}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || user,
    to,
    subject,
    html,
  });
}

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post("/register", async (req: Request, res: Response) => {
  const { nome, email, senha, tipoPessoa, profissao, telefone, cpfCnpj } = req.body;

  if (!nome?.trim() || !email?.trim() || !senha) {
    res.status(400).json({ error: "Nome, email e senha são obrigatórios" });
    return;
  }
  if (senha.length < 6) {
    res.status(400).json({ error: "A senha deve ter ao menos 6 caracteres" });
    return;
  }

  const emailNorm = email.toLowerCase().trim();
  const [existing] = await db.select().from(users).where(eq(users.email, emailNorm)).limit(1);
  if (existing) {
    res.status(409).json({ error: "Este email já está cadastrado. Faça login ou recupere sua senha." });
    return;
  }

  const hash = await bcrypt.hash(senha, 10);
  const [newUser] = await db
    .insert(users)
    .values({
      nome: nome.trim(),
      email: emailNorm,
      senhaHash: hash,
      role: "user",
      tipoPessoa: tipoPessoa === "PJ" ? "PJ" : "PF",
      profissao: profissao?.trim() || null,
      telefone: telefone?.trim() || null,
      cpfCnpj: cpfCnpj?.trim() || null,
      ativo: true,
    })
    .returning();

  // Configurar account_id = id (usuário é master da sua própria conta)
  const { sql: drizzleSql } = await import("drizzle-orm");
  await db.execute(drizzleSql`
    UPDATE users SET account_id = ${newUser.id}, account_role = 'master' WHERE id = ${newUser.id}
  `);

  // Criar carteira e creditar 10 créditos de boas-vindas
  await getOrCreateWallet(newUser.id);
  await creditWallet(
    newUser.id,
    10,
    "bonus",
    "Créditos de boas-vindas — Cadastro inicial",
    "registro"
  );

  const token = jwt.sign(
    { userId: newUser.id, email: newUser.email, role: newUser.role },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.status(201).json({
    token,
    user: {
      id: newUser.id,
      nome: newUser.nome,
      email: newUser.email,
      role: newUser.role,
      tipoPessoa: newUser.tipoPessoa,
      profissao: newUser.profissao,
    },
    creditosBonificados: 10,
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
// Verifica primeiro na tabela users (regular/admin); se não encontrar,
// verifica em convenio_usuarios — login unificado em um único endpoint.
router.post("/login", async (req: Request, res: Response) => {
  const { email, senha } = req.body;
  if (!email || !senha) {
    res.status(400).json({ error: "Email e senha são obrigatórios" });
    return;
  }
  const emailNorm = (email as string).toLowerCase().trim();

  // ── 1. Tenta usuário regular ──────────────────────────────────────────────
  const [user] = await db.select().from(users).where(eq(users.email, emailNorm)).limit(1);
  if (user) {
    if (!user.ativo) {
      res.status(401).json({ error: "Credenciais inválidas" });
      return;
    }
    const ok = await bcrypt.compare(senha, user.senhaHash);
    if (!ok) {
      res.status(401).json({ error: "Credenciais inválidas" });
      return;
    }
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "8h" });
    res.json({
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        tipoPessoa: user.tipoPessoa,
        profissao: user.profissao,
      },
    });
    return;
  }

  // ── 2. Tenta usuário conveniado ───────────────────────────────────────────
  const cuResult = await db.execute(sql`
    SELECT
      cu.id, cu.convenio_id, cu.nome, cu.email, cu.status,
      cu.senha_hash, cu.primeiro_acesso_pendente, cu.redefinir_senha_obrigatoria,
      cu.tentativas_login, cu.bloqueado_ate,
      cu.creditos_disponiveis, cu.creditos_utilizados_total,
      c.nome_convenio, c.status AS convenio_status,
      TO_CHAR(c.data_fim, 'YYYY-MM-DD') AS data_fim,
      TO_CHAR(c.prorrogado_nova_data_fim, 'YYYY-MM-DD') AS prorrogado_nova_data_fim
    FROM convenio_usuarios cu
    JOIN convenios c ON c.id = cu.convenio_id
    WHERE cu.email = ${emailNorm} AND cu.deleted_at IS NULL
    LIMIT 1
  `);

  if (!cuResult.rows.length) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }

  const u = cuResult.rows[0] as Record<string, unknown>;

  // Bloqueio por tentativas
  if (u.bloqueado_ate) {
    const blockedUntil = new Date(u.bloqueado_ate as string);
    if (blockedUntil > new Date()) {
      const minutos = Math.ceil((blockedUntil.getTime() - Date.now()) / 60000);
      res.status(403).json({ error: `Usuário bloqueado temporariamente. Tente novamente em ${minutos} minuto(s).` });
      return;
    }
  }

  if (u.status !== "ativo") {
    res.status(403).json({ error: "Conta suspensa. Entre em contato com o administrador do convênio." });
    return;
  }

  if (u.convenio_status !== "ativo") {
    res.status(403).json({ error: "O convênio institucional vinculado à sua conta está inativo." });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const vigenciaFim = (u.prorrogado_nova_data_fim as string) || (u.data_fim as string);
  if (vigenciaFim && vigenciaFim < today) {
    res.status(403).json({ error: "O convênio institucional vinculado à sua conta está encerrado." });
    return;
  }

  const senhaHash = u.senha_hash as string;
  if (!senhaHash) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }

  const okConvenio = await bcrypt.compare(senha, senhaHash);
  if (!okConvenio) {
    const tentativas = Number(u.tentativas_login || 0) + 1;
    if (tentativas >= 5) {
      const bloqueadoAte = new Date(Date.now() + 15 * 60 * 1000);
      await db.execute(sql`
        UPDATE convenio_usuarios
        SET tentativas_login = ${tentativas}, bloqueado_ate = ${bloqueadoAte.toISOString()}
        WHERE id = ${u.id as string}::uuid
      `);
      res.status(403).json({ error: "Usuário bloqueado por 15 minutos após múltiplas tentativas inválidas." });
    } else {
      await db.execute(sql`UPDATE convenio_usuarios SET tentativas_login = ${tentativas} WHERE id = ${u.id as string}::uuid`);
      res.status(401).json({ error: "Credenciais inválidas" });
    }
    return;
  }

  // Sucesso — limpa tentativas
  await db.execute(sql`
    UPDATE convenio_usuarios
    SET tentativas_login = 0, bloqueado_ate = NULL, ultimo_login_em = NOW()
    WHERE id = ${u.id as string}::uuid
  `);

  const tokenConvenio = jwt.sign(
    { userId: 0, email: emailNorm, role: "convenio", convenioUserId: u.id, convenioId: u.convenio_id },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({
    token: tokenConvenio,
    user: {
      id: 0,
      nome: u.nome,
      email: emailNorm,
      role: "convenio",
      convenioUserId: u.id,
      convenioId: u.convenio_id,
      convenioNome: u.nome_convenio,
      convenioStatus: u.convenio_status,
      convenioDataFim: vigenciaFim,
      creditosDisponiveis: Number(u.creditos_disponiveis || 0),
      creditosUtilizadosTotal: Number(u.creditos_utilizados_total || 0),
      primeiroAcessoPendente: Boolean(u.primeiro_acesso_pendente),
      redefinirSenhaObrigatoria: Boolean(u.redefinir_senha_obrigatoria),
    },
  });
});

// ─── POST /api/auth/demo ─────────────────────────────────────────────────────
router.post("/demo", async (req: Request, res: Response) => {
  const demoEmail = "demo@veritasanalytics.com.br";

  // Localiza ou cria o usuário demo no banco
  let [demoUser] = await db.select().from(users).where(eq(users.email, demoEmail)).limit(1);
  if (!demoUser) {
    const hash = await bcrypt.hash("demo_veritas_2026_readonly", 10);
    [demoUser] = await db.insert(users).values({
      nome: "Usuário Demonstração",
      email: demoEmail,
      senhaHash: hash,
      role: "demo",
      tipoPessoa: "PF",
      ativo: true,
    }).returning();
  }

  // JWT com role="demo" e expiração de 24h
  const token = jwt.sign(
    { userId: demoUser.id, email: demoUser.email, role: "demo" },
    JWT_SECRET,
    { expiresIn: "24h" }
  );

  res.json({
    token,
    user: {
      id: demoUser.id,
      nome: "Usuário Demonstração",
      email: demoUser.email,
      role: "demo",
    },
  });
});

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  // Usuário demo — retorna perfil sintético sem consulta real ao banco
  if (req.user!.role === "demo") {
    res.json({
      id: req.user!.userId,
      nome: "Usuário Demonstração",
      email: req.user!.email,
      role: "demo",
      ativo: true,
      tipoPessoa: "PF",
      profissao: "Demonstração",
    });
    return;
  }

  // Usuário conveniado — busca em convenio_usuarios
  if (req.user!.role === "convenio" && req.user!.convenioUserId) {
    const result = await db.execute(sql`
      SELECT
        cu.id, cu.convenio_id, cu.nome, cu.email, cu.status,
        cu.primeiro_acesso_pendente, cu.redefinir_senha_obrigatoria,
        cu.creditos_disponiveis, cu.creditos_utilizados_total,
        c.nome_convenio, c.status AS convenio_status,
        TO_CHAR(c.data_fim, 'YYYY-MM-DD') AS data_fim,
        TO_CHAR(c.prorrogado_nova_data_fim, 'YYYY-MM-DD') AS prorrogado_nova_data_fim
      FROM convenio_usuarios cu
      JOIN convenios c ON c.id = cu.convenio_id
      WHERE cu.id = ${req.user!.convenioUserId}::uuid
        AND cu.deleted_at IS NULL
    `);
    if (!result.rows.length) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }
    const u = result.rows[0] as Record<string, unknown>;
    const vigenciaFim = (u.prorrogado_nova_data_fim as string) || (u.data_fim as string);
    res.json({
      id: 0,
      nome: u.nome,
      email: u.email,
      role: "convenio",
      convenioUserId: u.id,
      convenioId: u.convenio_id,
      convenioNome: u.nome_convenio,
      convenioStatus: u.convenio_status,
      convenioDataFim: vigenciaFim,
      creditosDisponiveis: Number(u.creditos_disponiveis || 0),
      creditosUtilizadosTotal: Number(u.creditos_utilizados_total || 0),
      primeiroAcessoPendente: Boolean(u.primeiro_acesso_pendente),
      redefinirSenhaObrigatoria: Boolean(u.redefinir_senha_obrigatoria),
    });
    return;
  }

  const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  const { senhaHash: _, ...safe } = user;
  res.json(safe);
});

router.post("/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: "Email é obrigatório" });
    return;
  }
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
  if (!user || !user.ativo) {
    res.json({ message: "Se o email estiver cadastrado, você receberá a senha provisória." });
    return;
  }

  const tempPass = generateTempPassword();
  const hash = await bcrypt.hash(tempPass, 10);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.insert(passwordResets).values({ userId: user.id, tempPassword: hash, expiresAt, used: false });

  await db.update(users).set({ senhaHash: hash, updatedAt: new Date() }).where(eq(users.id, user.id));

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #1a3a5c;">Veritas Analytics — Senha Provisória</h2>
      <p>Olá, <strong>${user.nome}</strong>!</p>
      <p>Sua senha provisória é:</p>
      <div style="background: #f0f4ff; border-left: 4px solid #3b82f6; padding: 16px; font-size: 22px; font-weight: bold; letter-spacing: 4px; margin: 16px 0;">
        ${tempPass}
      </div>
      <p>Esta senha expira em <strong>24 horas</strong>. Acesse o sistema e altere sua senha imediatamente.</p>
      <p style="color: #888; font-size: 12px;">Veritas Analytics &copy; 2026</p>
    </div>
  `;

  await sendEmail(user.email, "Veritas Analytics — Sua senha provisória", html);

  res.json({ message: "Se o email estiver cadastrado, você receberá a senha provisória." });
});

router.put("/change-password", requireAuth, async (req: Request, res: Response) => {
  const { senhaAtual, novaSenha } = req.body;
  if (!senhaAtual || !novaSenha) {
    res.status(400).json({ error: "Senha atual e nova senha são obrigatórias" });
    return;
  }
  if (novaSenha.length < 6) {
    res.status(400).json({ error: "A nova senha deve ter ao menos 6 caracteres" });
    return;
  }
  const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  const ok = await bcrypt.compare(senhaAtual, user.senhaHash);
  if (!ok) {
    res.status(400).json({ error: "Senha atual incorreta" });
    return;
  }
  const hash = await bcrypt.hash(novaSenha, 10);
  await db.update(users).set({ senhaHash: hash, updatedAt: new Date() }).where(eq(users.id, user.id));
  res.json({ message: "Senha alterada com sucesso" });
});

// ─── POST /api/auth/login-convenio ───────────────────────────────────────────
router.post("/login-convenio", async (req: Request, res: Response) => {
  const { email, senha } = req.body as { email?: string; senha?: string };
  if (!email?.trim() || !senha) {
    res.status(400).json({ error: "E-mail e senha são obrigatórios" });
    return;
  }
  const emailNorm = email.toLowerCase().trim();

  // Find user in convenio_usuarios
  const userResult = await db.execute(sql`
    SELECT
      cu.id, cu.convenio_id, cu.nome, cu.email, cu.status,
      cu.senha_hash, cu.primeiro_acesso_pendente, cu.redefinir_senha_obrigatoria,
      cu.tentativas_login, cu.bloqueado_ate,
      cu.creditos_disponiveis, cu.creditos_utilizados_total,
      c.nome_convenio, c.status AS convenio_status,
      TO_CHAR(c.data_fim, 'YYYY-MM-DD') AS data_fim,
      TO_CHAR(c.prorrogado_nova_data_fim, 'YYYY-MM-DD') AS prorrogado_nova_data_fim
    FROM convenio_usuarios cu
    JOIN convenios c ON c.id = cu.convenio_id
    WHERE cu.email = ${emailNorm}
      AND cu.deleted_at IS NULL
    LIMIT 1
  `);

  if (!userResult.rows.length) {
    res.status(401).json({ error: "Senha inválida" });
    return;
  }

  const u = userResult.rows[0] as Record<string, unknown>;

  // Check if blocked
  if (u.bloqueado_ate) {
    const blockedUntil = new Date(u.bloqueado_ate as string);
    if (blockedUntil > new Date()) {
      const minutos = Math.ceil((blockedUntil.getTime() - Date.now()) / 60000);
      res.status(403).json({ error: `Usuário bloqueado temporariamente. Tente novamente em ${minutos} minuto(s).` });
      return;
    }
  }

  // Check user status
  if (u.status !== "ativo") {
    res.status(403).json({ error: "Usuário bloqueado temporariamente" });
    return;
  }

  // Check convenio status
  if (u.convenio_status !== "ativo") {
    res.status(403).json({ error: "Convênio inativo" });
    return;
  }

  // Check convenio validity
  const today = new Date().toISOString().slice(0, 10);
  const vigenciaFim = (u.prorrogado_nova_data_fim as string) || (u.data_fim as string);
  if (vigenciaFim < today) {
    res.status(403).json({ error: "Convênio inativo" });
    return;
  }

  // Check password (empty hash = first time, must reset)
  const senhaHash = u.senha_hash as string;
  if (!senhaHash) {
    res.status(401).json({ error: "Senha inválida" });
    return;
  }

  const ok = await bcrypt.compare(senha, senhaHash);
  if (!ok) {
    const tentativas = Number(u.tentativas_login || 0) + 1;
    if (tentativas >= 5) {
      const bloqueadoAte = new Date(Date.now() + 15 * 60 * 1000);
      await db.execute(sql`
        UPDATE convenio_usuarios
        SET tentativas_login = ${tentativas}, bloqueado_ate = ${bloqueadoAte.toISOString()}
        WHERE id = ${u.id as string}::uuid
      `);
      res.status(403).json({ error: "Usuário bloqueado temporariamente. Tente novamente em 15 minuto(s)." });
    } else {
      await db.execute(sql`
        UPDATE convenio_usuarios SET tentativas_login = ${tentativas}
        WHERE id = ${u.id as string}::uuid
      `);
      res.status(401).json({ error: "Senha inválida" });
    }
    return;
  }

  // Success — clear attempts, update last login
  await db.execute(sql`
    UPDATE convenio_usuarios
    SET tentativas_login = 0, bloqueado_ate = NULL, ultimo_login_em = NOW()
    WHERE id = ${u.id as string}::uuid
  `);

  const token = jwt.sign(
    {
      userId: 0,
      email: emailNorm,
      role: "convenio",
      convenioUserId: u.id,
      convenioId: u.convenio_id,
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({
    token,
    user: {
      id: 0,
      nome: u.nome,
      email: emailNorm,
      role: "convenio",
      convenioUserId: u.id,
      convenioId: u.convenio_id,
      convenioNome: u.nome_convenio,
      convenioStatus: u.convenio_status,
      convenioDataFim: vigenciaFim,
      creditosDisponiveis: Number(u.creditos_disponiveis || 0),
      creditosUtilizadosTotal: Number(u.creditos_utilizados_total || 0),
      primeiroAcessoPendente: Boolean(u.primeiro_acesso_pendente),
      redefinirSenhaObrigatoria: Boolean(u.redefinir_senha_obrigatoria),
    },
  });
});

// ─── POST /api/auth/signup-convenio ──────────────────────────────────────────
router.post("/signup-convenio", async (req: Request, res: Response) => {
  const {
    codigoConvenio,   // código do convênio (campo obrigatório agora)
    nome, email, senha, cpf, telefone,
    numeroOab, ufOab, matricula,
    dataNascimento, cidade, estado, especialidade,
  } = req.body;

  if (!codigoConvenio?.trim()) {
    res.status(400).json({ error: "Informe o código do convênio.", code: "codigo_obrigatorio" });
    return;
  }
  if (!nome?.trim() || !email?.trim() || !senha) {
    res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios" });
    return;
  }
  if (senha.length < 8) {
    res.status(400).json({ error: "A senha deve ter ao menos 8 caracteres" });
    return;
  }
  if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) {
    res.status(400).json({ error: "A senha deve conter ao menos 1 letra e 1 número" });
    return;
  }

  try {
    // ── 1. Busca o convênio pelo código ────────────────────────────────────────
    const convenioRow = (await db.execute(sql`
      SELECT
        id, codigo, nome_convenio, tipo_convenio,
        criterio_validacao, exige_lista_elegiveis, dominio_email_permitido,
        creditos_iniciais_usuario, limite_usuarios, status,
        TO_CHAR(data_fim, 'YYYY-MM-DD') AS data_fim,
        TO_CHAR(prorrogado_nova_data_fim, 'YYYY-MM-DD') AS prorrogado_nova_data_fim
      FROM convenios
      WHERE UPPER(TRIM(codigo)) = UPPER(TRIM(${codigoConvenio}))
        AND deleted_at IS NULL
      LIMIT 1
    `)).rows[0] as any;

    if (!convenioRow) {
      res.status(422).json({
        error: "Código de convênio inválido. Verifique o código informado pela sua instituição.",
        code: "codigo_invalido",
      });
      return;
    }

    if (convenioRow.status !== "ativo") {
      res.status(422).json({
        error: `O convênio "${convenioRow.nome_convenio}" está ${convenioRow.status === "cancelado" ? "cancelado" : "inativo"} e não aceita novos cadastros no momento.`,
        code: "convenio_inativo",
      });
      return;
    }

    // Verifica vigência
    const dataFimEfetiva = convenioRow.prorrogado_nova_data_fim ?? convenioRow.data_fim;
    if (dataFimEfetiva && new Date(dataFimEfetiva) < new Date()) {
      res.status(422).json({
        error: `O convênio "${convenioRow.nome_convenio}" está expirado desde ${new Date(dataFimEfetiva).toLocaleDateString("pt-BR")}.`,
        code: "convenio_expirado",
      });
      return;
    }

    // ── 2. Validação de critério ───────────────────────────────────────────────
    // O código do convênio já é o gate principal de acesso.
    // O critério serve apenas para validações inerentes (ex: domínio de e-mail)
    // ou para enriquecer o perfil do usuário — não bloqueia quem tem o código.
    // EXCEÇÃO: dominio_email exige que o e-mail do usuário pertença ao domínio
    // configurado no convênio (validação automática, sem pré-cadastro).
    const criterio: string = convenioRow.criterio_validacao ?? "oab_uf";

    if (criterio === "dominio_email") {
      // Normaliza: remove @ inicial caso o admin tenha digitado "@ufvjm.edu.br"
      const dominioRaw = (convenioRow.dominio_email_permitido as string | null)?.toLowerCase().trim() ?? "";
      const dominioPermitido = dominioRaw.replace(/^@+/, "");
      if (dominioPermitido) {
        const dominio = email?.split("@")[1]?.toLowerCase() ?? "";
        if (dominio !== dominioPermitido) {
          res.status(422).json({
            error: `Este convênio é exclusivo para e-mails com domínio "@${dominioPermitido}". O e-mail informado não pertence a esse domínio.`,
            code: "dominio_invalido",
          });
          return;
        }
      }
    }

    // Monta objeto de convenio compatível com o resto do código
    const convenio = {
      id: convenioRow.id,
      codigo: convenioRow.codigo,
      nomeConvenio: convenioRow.nome_convenio,
      tipoConvenio: convenioRow.tipo_convenio,
      creditosIniciaisUsuario: Number(convenioRow.creditos_iniciais_usuario ?? 0),
    };

    // Valida unicidade de e-mail no convênio
    const existeEmail = (await db.execute(sql`
      SELECT id FROM convenio_usuarios
      WHERE LOWER(email) = LOWER(${email}) AND convenio_id = ${convenio.id}::uuid AND deleted_at IS NULL
    `)).rows;
    if (existeEmail.length > 0) {
      res.status(409).json({ error: "Este e-mail já está cadastrado neste convênio.", code: "email_duplicado" });
      return;
    }

    // Verifica limite de usuários
    const convRow = (await db.execute(sql`
      SELECT limite_usuarios, (
        SELECT COUNT(*) FROM convenio_usuarios WHERE convenio_id = ${convenio.id}::uuid AND deleted_at IS NULL
      ) AS total_usuarios
      FROM convenios WHERE id = ${convenio.id}::uuid
    `)).rows[0] as any;
    if (convRow && Number(convRow.limite_usuarios) > 0 && Number(convRow.total_usuarios) >= Number(convRow.limite_usuarios)) {
      res.status(422).json({ error: "Este convênio atingiu o limite de usuários.", code: "limite_atingido" });
      return;
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const creditosIniciais = convenio.creditosIniciaisUsuario ?? 0;

    const insertResult = await pool.query(
      `INSERT INTO convenio_usuarios (
        convenio_id, nome, email, cpf, telefone,
        numero_oab, uf_oab, matricula,
        data_nascimento, cidade, estado, especialidade,
        senha_hash, creditos_iniciais, creditos_disponiveis,
        primeiro_acesso_pendente, redefinir_senha_obrigatoria,
        origem_vinculo, vinculado_em, status
      ) VALUES (
        $1::uuid, $2, $3,
        $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $14,
        FALSE, FALSE,
        'cadastro_via_convenio', NOW(), 'ativo'
      )
      RETURNING id, nome, email, convenio_id AS "convenioId"`,
      [
        convenio.id,
        nome.trim(),
        email.trim().toLowerCase(),
        cpf ?? null,
        telefone ?? null,
        numeroOab ?? null,
        ufOab ?? null,
        matricula ?? null,
        dataNascimento ?? null,
        cidade ?? null,
        estado ?? null,
        especialidade ?? null,
        senhaHash,
        creditosIniciais,
      ]
    );
    const novoUsuario = insertResult.rows[0] as any;

    // Busca nome do convênio para o token
    const convData = (await db.execute(sql`
      SELECT nome_convenio AS "nomeConvenio",
             TO_CHAR(COALESCE(prorrogado_nova_data_fim, data_fim), 'YYYY-MM-DD') AS "dataFim",
             status
      FROM convenios WHERE id = ${convenio.id}::uuid
    `)).rows[0] as any;

    const token = jwt.sign(
      {
        userId: null,
        email: novoUsuario.email,
        role: "convenio",
        convenioUserId: novoUsuario.id,
        convenioId: convenio.id,
        convenioNome: convData?.nomeConvenio,
        convenioStatus: convData?.status,
        convenioDataFim: convData?.dataFim,
        creditosDisponiveis: creditosIniciais,
        creditosUtilizadosTotal: 0,
        primeiroAcessoPendente: false,
        redefinirSenhaObrigatoria: false,
        nome: novoUsuario.nome,
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.status(201).json({
      message: "Seu cadastro conveniado foi concluído com sucesso.",
      token,
      convenio: { id: convenio.id, nomeConvenio: convData?.nomeConvenio },
    });
  } catch (err: any) {
    // 23505 = unique_violation: e-mail já cadastrado (mesmo que o check anterior não pegou)
    if (err?.code === "23505" && err?.constraint === "unq_email_por_convenio") {
      res.status(409).json({ error: "Este e-mail já está cadastrado neste convênio.", code: "email_duplicado" });
      return;
    }
    console.error("[signup-convenio] ERRO DETALHADO:", {
      name: err?.name,
      message: String(err?.message || "").slice(0, 400),
      code: err?.code,
      detail: err?.detail,
      constraint: err?.constraint,
      column: err?.column,
      table: err?.table,
      schema: err?.schema,
      hint: err?.hint,
      severity: err?.severity,
    });
    res.status(500).json({ error: "Erro ao processar o cadastro conveniado" });
  }
});

// ─── POST /api/auth/primeiro-acesso ──────────────────────────────────────────
router.post("/primeiro-acesso", requireAuth, async (req: Request, res: Response) => {
  if (req.user!.role !== "convenio" || !req.user!.convenioUserId) {
    res.status(403).json({ error: "Apenas usuários conveniados podem usar esta rota" });
    return;
  }

  const { novaSenha, confirmarSenha } = req.body as { novaSenha?: string; confirmarSenha?: string };

  if (!novaSenha || !confirmarSenha) {
    res.status(400).json({ error: "Nova senha e confirmação são obrigatórios" });
    return;
  }
  if (novaSenha.length < 8) {
    res.status(400).json({ error: "A senha deve ter ao menos 8 caracteres" });
    return;
  }
  if (!/[a-zA-Z]/.test(novaSenha) || !/[0-9]/.test(novaSenha)) {
    res.status(400).json({ error: "A senha deve conter ao menos 1 letra e 1 número" });
    return;
  }
  if (novaSenha !== confirmarSenha) {
    res.status(400).json({ error: "As senhas não coincidem" });
    return;
  }

  const hash = await bcrypt.hash(novaSenha, 10);
  await db.execute(sql`
    UPDATE convenio_usuarios
    SET senha_hash = ${hash},
        primeiro_acesso_pendente = FALSE,
        redefinir_senha_obrigatoria = FALSE,
        tentativas_login = 0,
        bloqueado_ate = NULL
    WHERE id = ${req.user!.convenioUserId}::uuid
  `);

  res.json({ message: "Senha definida com sucesso" });
});

export default router;
