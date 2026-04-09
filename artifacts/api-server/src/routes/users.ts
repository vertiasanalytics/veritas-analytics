import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";

const router = Router();

router.get("/", requireAdmin, async (_req: Request, res: Response) => {
  const list = await db.select({
    id: users.id,
    nome: users.nome,
    email: users.email,
    role: users.role,
    tipoPessoa: users.tipoPessoa,
    cpfCnpj: users.cpfCnpj,
    profissao: users.profissao,
    telefone: users.telefone,
    razaoSocial: users.razaoSocial,
    inscricaoEstadual: users.inscricaoEstadual,
    dataNascimento: users.dataNascimento,
    ativo: users.ativo,
    createdAt: users.createdAt,
  }).from(users).orderBy(users.nome);
  res.json(list);
});

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (req.user!.role !== "admin" && req.user!.userId !== id) {
    res.status(403).json({ error: "Sem permissão" });
    return;
  }
  const [user] = await db.select({
    id: users.id,
    nome: users.nome,
    email: users.email,
    role: users.role,
    tipoPessoa: users.tipoPessoa,
    cpfCnpj: users.cpfCnpj,
    profissao: users.profissao,
    telefone: users.telefone,
    razaoSocial: users.razaoSocial,
    inscricaoEstadual: users.inscricaoEstadual,
    dataNascimento: users.dataNascimento,
    ativo: users.ativo,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.id, id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  res.json(user);
});

router.post("/", requireAdmin, async (req: Request, res: Response) => {
  const { nome, email, senha, role, tipoPessoa, cpfCnpj, profissao, telefone, razaoSocial, inscricaoEstadual, dataNascimento } = req.body;
  if (!nome || !email || !senha) {
    res.status(400).json({ error: "Nome, email e senha são obrigatórios" });
    return;
  }
  if (senha.length < 6) {
    res.status(400).json({ error: "Senha deve ter ao menos 6 caracteres" });
    return;
  }
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Email já cadastrado" });
    return;
  }
  const hash = await bcrypt.hash(senha, 10);
  const [created] = await db.insert(users).values({
    nome: nome.trim(),
    email: email.toLowerCase().trim(),
    senhaHash: hash,
    role: role || "user",
    tipoPessoa: tipoPessoa || "PF",
    cpfCnpj,
    profissao,
    telefone,
    razaoSocial,
    inscricaoEstadual,
    dataNascimento,
  }).returning({ id: users.id, nome: users.nome, email: users.email, role: users.role });
  res.status(201).json(created);
});

router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (req.user!.role !== "admin" && req.user!.userId !== id) {
    res.status(403).json({ error: "Sem permissão" });
    return;
  }
  const { nome, email, role, tipoPessoa, cpfCnpj, profissao, telefone, razaoSocial, inscricaoEstadual, dataNascimento, ativo } = req.body;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (nome) updateData.nome = nome.trim();
  if (email) updateData.email = email.toLowerCase().trim();
  if (tipoPessoa) updateData.tipoPessoa = tipoPessoa;
  if (cpfCnpj !== undefined) updateData.cpfCnpj = cpfCnpj;
  if (profissao !== undefined) updateData.profissao = profissao;
  if (telefone !== undefined) updateData.telefone = telefone;
  if (razaoSocial !== undefined) updateData.razaoSocial = razaoSocial;
  if (inscricaoEstadual !== undefined) updateData.inscricaoEstadual = inscricaoEstadual;
  if (dataNascimento !== undefined) updateData.dataNascimento = dataNascimento;
  if (req.user!.role === "admin") {
    if (role) updateData.role = role;
    if (ativo !== undefined) updateData.ativo = ativo;
  }
  await db.update(users).set(updateData as any).where(eq(users.id, id));
  res.json({ message: "Usuário atualizado" });
});

router.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (id === req.user!.userId) {
    res.status(400).json({ error: "Não é possível desativar sua própria conta" });
    return;
  }
  await db.update(users).set({ ativo: false, updatedAt: new Date() }).where(eq(users.id, id));
  res.json({ message: "Usuário desativado" });
});

// ─── DELETE permanente ────────────────────────────────────────────────────────
router.delete("/:id/permanent", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  if (id === req.user!.userId) {
    res.status(400).json({ error: "Não é possível excluir sua própria conta" });
    return;
  }

  // Confirma que o usuário existe
  const target = await db.select({ id: users.id, nome: users.nome, role: users.role })
    .from(users).where(eq(users.id, id)).limit(1);
  if (target.length === 0) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  if (target[0].role === "admin") {
    res.status(403).json({ error: "Administradores não podem ser excluídos permanentemente. Desative primeiro e solicite exclusão manual." });
    return;
  }

  try {
    // Ordem correta: eliminar dependências NO ACTION antes do registro pai (users)
    // As tabelas ctrl_* possuem CASCADE, então são removidas automaticamente
    await db.execute(sql`DELETE FROM pix_charges          WHERE user_id = ${id}`);
    await db.execute(sql`DELETE FROM credit_transactions  WHERE user_id = ${id}`);
    await db.execute(sql`DELETE FROM credit_wallets       WHERE user_id = ${id}`);
    await db.execute(sql`DELETE FROM subscriptions        WHERE user_id = ${id}`);
    await db.execute(sql`DELETE FROM password_resets      WHERE user_id = ${id}`);
    await db.execute(sql`DELETE FROM backups              WHERE user_id = ${id}`);
    await db.execute(sql`DELETE FROM users WHERE id = ${id}`);
    res.json({ message: `Usuário "${target[0].nome}" excluído permanentemente.` });
  } catch (err: unknown) {
    console.error("[users] DELETE permanent", err);
    res.status(500).json({ error: "Erro inesperado ao excluir o usuário. Verifique os logs do servidor." });
  }
});

export default router;
