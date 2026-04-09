/**
 * Serviço de elegibilidade para convênios institucionais.
 * Responsável por descobrir e validar se um usuário pode ingressar em um convênio.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export interface ElegibilidadeInput {
  email: string;
  cpf?: string;
  numeroOab?: string;
  ufOab?: string;
  matricula?: string;
}

export interface ConvenioMatch {
  id: string;
  codigo: string;
  nomeConvenio: string;
  tipoConvenio: string;
  criterioValidacao: string;
  exigeListaElegiveis: boolean;
  creditosIniciaisUsuario: number;
  dataFim: string;
  prorrogadoNovaDataFim?: string;
  elegivelId?: string;
}

export interface ConvenioMatchResult {
  /** Convênios onde o usuário satisfaz critério e whitelist */
  matches: ConvenioMatch[];
  /**
   * Convênios onde o critério seria atendido, mas o usuário não está na lista
   * de elegíveis (whitelist habilitada). Permite mensagem específica no frontend.
   */
  nearMisses: Array<{ id: string; nomeConvenio: string; criterioValidacao: string }>;
}

/**
 * Normaliza CPF para somente números.
 */
function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

/**
 * Extrai o domínio do e-mail.
 */
function emailDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

/**
 * Verifica se a vigência do convênio está ativa no momento.
 */
function isConvenioVigente(row: {
  data_fim: string;
  prorrogado_nova_data_fim?: string | null;
}): boolean {
  const fim = row.prorrogado_nova_data_fim ?? row.data_fim;
  return new Date(fim) >= new Date();
}

/**
 * Verifica se os dados do input satisfazem o critério do convênio
 * (sem considerar a whitelist).
 */
function criterioPrimarioAtendido(
  criterio: string,
  dominioPermitido: string | null | undefined,
  input: ElegibilidadeInput & { cpfNorm?: string; dominio?: string }
): boolean {
  switch (criterio) {
    case "oab_uf":
      return !!(input.numeroOab && input.ufOab);
    case "cpf":
      return !!input.cpfNorm;
    case "email":
      return !!input.email;
    case "dominio_email": {
      const dp = dominioPermitido?.toLowerCase().trim();
      return !!(dp && input.dominio === dp);
    }
    case "matricula":
      return !!input.matricula;
    case "misto":
      return !!(input.cpfNorm || input.email || (input.numeroOab && input.ufOab) || input.matricula);
    default:
      return false;
  }
}

/**
 * Busca todos os convênios ativos com seus critérios de elegibilidade.
 * Retorna matches (aprovados) e nearMisses (critério ok mas não está na whitelist).
 */
export async function matchConvenioElegivel(
  input: ElegibilidadeInput
): Promise<ConvenioMatchResult> {
  const { email, cpf, numeroOab, ufOab, matricula } = input;
  const cpfNorm = cpf ? normalizeCpf(cpf) : undefined;
  const dominio = emailDomain(email);
  const enriched = { ...input, cpfNorm, dominio };

  // Busca todos os convênios ativos
  const { rows: convenios } = await db.execute(sql`
    SELECT
      id,
      codigo,
      nome_convenio               AS nome_convenio,
      tipo_convenio               AS tipo_convenio,
      criterio_validacao          AS criterio_validacao,
      exige_lista_elegiveis       AS exige_lista_elegiveis,
      creditos_iniciais_usuario   AS creditos_iniciais_usuario,
      dominio_email_permitido     AS dominio_email_permitido,
      TO_CHAR(data_fim, 'YYYY-MM-DD')                       AS data_fim,
      TO_CHAR(prorrogado_nova_data_fim, 'YYYY-MM-DD')       AS prorrogado_nova_data_fim,
      status
    FROM convenios
    WHERE status = 'ativo' AND deleted_at IS NULL
  `);

  const matches: ConvenioMatch[] = [];
  const nearMisses: ConvenioMatchResult["nearMisses"] = [];

  for (const c of convenios as any[]) {
    if (!isConvenioVigente(c)) continue;

    const criterio: string = c.criterio_validacao ?? "oab_uf";
    const exigeLista: boolean = c.exige_lista_elegiveis ?? true;
    const dominioPermitido: string | null = c.dominio_email_permitido ?? null;

    // Verifica se o critério primário é atendido
    const criterioOk = criterioPrimarioAtendido(criterio, dominioPermitido, enriched);
    if (!criterioOk) continue;

    // Se não exige lista, aprovado direto
    if (!exigeLista) {
      matches.push({
        id: c.id,
        codigo: c.codigo,
        nomeConvenio: c.nome_convenio,
        tipoConvenio: c.tipo_convenio,
        criterioValidacao: criterio,
        exigeListaElegiveis: false,
        creditosIniciaisUsuario: Number(c.creditos_iniciais_usuario ?? 0),
        dataFim: c.data_fim,
        prorrogadoNovaDataFim: c.prorrogado_nova_data_fim ?? undefined,
      });
      continue;
    }

    // Exige lista — verifica whitelist
    let elegivelId: string | undefined;

    if (criterio === "oab_uf" && numeroOab && ufOab) {
      const r = await db.execute(sql`
        SELECT id FROM convenio_elegiveis
        WHERE convenio_id = ${c.id}::uuid
          AND LOWER(TRIM(numero_oab)) = LOWER(TRIM(${numeroOab}))
          AND UPPER(TRIM(uf_oab)) = UPPER(TRIM(${ufOab}))
          AND status = 'ativo'
        LIMIT 1
      `);
      if (r.rows.length > 0) elegivelId = (r.rows[0] as any).id;

    } else if (criterio === "cpf" && cpfNorm) {
      const r = await db.execute(sql`
        SELECT id FROM convenio_elegiveis
        WHERE convenio_id = ${c.id}::uuid
          AND REGEXP_REPLACE(cpf, '[^0-9]', '', 'g') = ${cpfNorm}
          AND status = 'ativo'
        LIMIT 1
      `);
      if (r.rows.length > 0) elegivelId = (r.rows[0] as any).id;

    } else if (criterio === "email") {
      const r = await db.execute(sql`
        SELECT id FROM convenio_elegiveis
        WHERE convenio_id = ${c.id}::uuid
          AND LOWER(TRIM(email)) = LOWER(TRIM(${email}))
          AND status = 'ativo'
        LIMIT 1
      `);
      if (r.rows.length > 0) elegivelId = (r.rows[0] as any).id;

    } else if (criterio === "matricula" && matricula) {
      const r = await db.execute(sql`
        SELECT id FROM convenio_elegiveis
        WHERE convenio_id = ${c.id}::uuid
          AND LOWER(TRIM(matricula)) = LOWER(TRIM(${matricula}))
          AND status = 'ativo'
        LIMIT 1
      `);
      if (r.rows.length > 0) elegivelId = (r.rows[0] as any).id;

    } else if (criterio === "misto") {
      const filters: ReturnType<typeof sql>[] = [];
      if (cpfNorm) filters.push(sql`REGEXP_REPLACE(cpf, '[^0-9]', '', 'g') = ${cpfNorm}`);
      if (email) filters.push(sql`LOWER(TRIM(email)) = LOWER(TRIM(${email}))`);
      if (numeroOab && ufOab) {
        filters.push(sql`(LOWER(TRIM(numero_oab)) = LOWER(TRIM(${numeroOab})) AND UPPER(TRIM(uf_oab)) = UPPER(TRIM(${ufOab})))`);
      }
      if (matricula) filters.push(sql`LOWER(TRIM(matricula)) = LOWER(TRIM(${matricula}))`);

      if (filters.length > 0) {
        const r = await db.execute(sql`
          SELECT id FROM convenio_elegiveis
          WHERE convenio_id = ${c.id}::uuid AND status = 'ativo'
            AND (
              ${sql.join(filters, sql` OR `)}
            )
          LIMIT 1
        `);
        if (r.rows.length > 0) elegivelId = (r.rows[0] as any).id;
      }
    }

    if (elegivelId) {
      matches.push({
        id: c.id,
        codigo: c.codigo,
        nomeConvenio: c.nome_convenio,
        tipoConvenio: c.tipo_convenio,
        criterioValidacao: criterio,
        exigeListaElegiveis: true,
        creditosIniciaisUsuario: Number(c.creditos_iniciais_usuario ?? 0),
        dataFim: c.data_fim,
        prorrogadoNovaDataFim: c.prorrogado_nova_data_fim ?? undefined,
        elegivelId,
      });
    } else {
      // Critério atendido mas não está na whitelist — near-miss
      nearMisses.push({
        id: c.id,
        nomeConvenio: c.nome_convenio,
        criterioValidacao: criterio,
      });
    }
  }

  return { matches, nearMisses };
}
