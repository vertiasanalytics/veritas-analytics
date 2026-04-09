import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db/schema";

/**
 * Registra ações de auditoria no banco de dados.
 * PONTO DE HOMOLOGAÇÃO: Verificar retenção e acesso aos logs de auditoria.
 */
export async function logAudit(params: {
  action: string;
  entity: string;
  entityId?: number;
  indexType?: string;
  source?: string;
  details?: object;
}): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      indexType: params.indexType,
      source: params.source,
      details: params.details as Record<string, unknown>,
    });
  } catch (err) {
    console.error("[AUDIT] Failed to write audit log:", err);
  }
}
