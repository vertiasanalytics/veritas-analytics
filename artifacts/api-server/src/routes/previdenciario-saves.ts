import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { previdenciarioSavesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { generatePublicKey } from "../lib/publicKey.js";

const router: IRouter = Router();

// POST /api/previdenciario/save — Salvar estado do cálculo e retornar chave
router.post("/save", requireAuth, async (req, res) => {
  try {
    const { calcState } = req.body;
    if (!calcState || typeof calcState !== "object") {
      return res.status(400).json({ error: "Estado do cálculo inválido" });
    }

    const publicKey = generatePublicKey();
    const [saved] = await db
      .insert(previdenciarioSavesTable)
      .values({
        publicKey,
        calcState,
        userId: req.user?.userId ?? null,
      })
      .returning();

    return res.status(201).json({ publicKey: saved.publicKey });
  } catch (err) {
    console.error("[previdenciario/save]", err);
    return res.status(500).json({ error: "Erro ao salvar cálculo" });
  }
});

// GET /api/previdenciario/recover/:publicKey — Recuperar por chave pública
router.get("/recover/:publicKey", async (req, res) => {
  try {
    const { publicKey } = req.params;
    const [found] = await db
      .select()
      .from(previdenciarioSavesTable)
      .where(eq(previdenciarioSavesTable.publicKey, publicKey.toUpperCase()))
      .limit(1);

    if (!found) {
      return res.status(404).json({ error: "Cálculo não encontrado para essa chave" });
    }

    return res.json({
      publicKey: found.publicKey,
      calcState: found.calcState,
      createdAt: found.createdAt,
    });
  } catch (err) {
    console.error("[previdenciario/recover]", err);
    return res.status(500).json({ error: "Erro ao recuperar cálculo" });
  }
});

export default router;
