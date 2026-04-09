/**
 * migrate.ts — Migrações seguras via db.execute() no startup do servidor.
 *
 * Motivo: o script de build não tem acesso ao banco de dados (fase de compilação
 * do Replit não conecta ao DB). As migrações devem rodar na inicialização do
 * servidor (fase de runtime), quando o DATABASE_URL já está disponível.
 *
 * Cada migração usa "IF NOT EXISTS" / "IF EXISTS" para ser idempotente — pode
 * rodar quantas vezes for necessário sem efeitos colaterais.
 */

import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

interface Migration {
  name: string;
  up: () => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    name: "004_plans_subscriptions",
    async up() {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS plans (
          id                SERIAL PRIMARY KEY,
          name              TEXT          NOT NULL UNIQUE,
          slug              TEXT          NOT NULL UNIQUE,
          price_monthly     NUMERIC(10,2) NOT NULL,
          credits_monthly   INTEGER       NOT NULL,
          max_users         INTEGER       NOT NULL DEFAULT 1,
          description       TEXT,
          active            BOOLEAN       NOT NULL DEFAULT TRUE,
          display_order     INTEGER       NOT NULL DEFAULT 0,
          created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id                SERIAL PRIMARY KEY,
          user_id           INTEGER       NOT NULL REFERENCES users(id),
          plan_id           INTEGER       NOT NULL REFERENCES plans(id),
          amount            NUMERIC(10,2) NOT NULL,
          status            TEXT          NOT NULL DEFAULT 'active',
          starts_at         TIMESTAMPTZ,
          ends_at           TIMESTAMPTZ,
          created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
        )
      `);
    },
  },
  {
    name: "005_wallet_credit_types",
    async up() {
      await db.execute(sql`
        ALTER TABLE credit_wallets
          ADD COLUMN IF NOT EXISTS subscription_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS extra_balance        NUMERIC(14,2) NOT NULL DEFAULT 0
      `);
    },
  },
  {
    name: "006_users_account",
    async up() {
      await db.execute(sql`
        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS account_id   INTEGER,
          ADD COLUMN IF NOT EXISTS account_role TEXT NOT NULL DEFAULT 'master'
      `);
      await db.execute(sql`
        UPDATE users SET account_id = id WHERE account_id IS NULL
      `);
    },
  },
  {
    name: "007_pix_charges_plan_id",
    async up() {
      await db.execute(sql`
        ALTER TABLE pix_charges
          ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES plans(id)
      `);
    },
  },
  {
    name: "008_payment_method_and_prices",
    async up() {
      await db.execute(sql`
        ALTER TABLE pix_charges
          ADD COLUMN IF NOT EXISTS payment_method     VARCHAR(20) NOT NULL DEFAULT 'pix',
          ADD COLUMN IF NOT EXISTS mp_preference_id   VARCHAR(100)
      `);
      await db.execute(sql`
        UPDATE plans SET price_monthly = 154.70 WHERE slug = 'essencial'
      `);
      await db.execute(sql`
        UPDATE plans SET price_monthly = 259.95 WHERE slug = 'profissional'
      `);
      await db.execute(sql`
        UPDATE plans SET price_monthly = 470.43 WHERE slug = 'avancado'
      `);
    },
  },
  {
    name: "003_pdf_historical_indexes",
    async up() {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS pdf_historical_indexes (
          id           SERIAL PRIMARY KEY,
          periodo      VARCHAR(7)    NOT NULL,
          indice_tipo  VARCHAR(20)   NOT NULL,
          coef_em_real NUMERIC(24,10) NOT NULL,
          fonte_doc    VARCHAR(200)  NOT NULL DEFAULT 'TRF1 — Tabela de Índices Mensais (AesCveisemGeral)',
          arquivo_origem VARCHAR(200) NOT NULL DEFAULT 'tabela_indices_trf1.txt',
          imported_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          UNIQUE(periodo, indice_tipo)
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS pdf_hist_tipo_periodo_idx
          ON pdf_historical_indexes(indice_tipo, periodo)
      `);
    },
  },
  {
    name: "001_party_installments_currency_correction_factors",
    async up() {
      await db.execute(sql`
        ALTER TABLE party_installments
          ADD COLUMN IF NOT EXISTS currency_factor  NUMERIC(24, 12),
          ADD COLUMN IF NOT EXISTS correction_factor NUMERIC(18, 10)
      `);
    },
  },
  {
    name: "002_official_indexes_cache_source_metadata",
    async up() {
      await db.execute(sql`
        ALTER TABLE official_indexes_cache
          ADD COLUMN IF NOT EXISTS source_type TEXT,
          ADD COLUMN IF NOT EXISTS origin_url  TEXT
      `);
    },
  },
  {
    name: "010_salario_minimo_series",
    async up() {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS salario_minimo_series (
          id                  SERIAL PRIMARY KEY,
          client_id           TEXT          NOT NULL UNIQUE,
          competencia_inicio  TEXT          NOT NULL,
          competencia_fim     TEXT          NOT NULL,
          valor               NUMERIC(10,2) NOT NULL,
          ato_normativo       TEXT,
          observacoes         TEXT,
          ativo               BOOLEAN       NOT NULL DEFAULT TRUE,
          created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
          updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
        )
      `);
    },
  },
  {
    name: "012_controladoria",
    async up() {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ctrl_clientes (
          id             SERIAL PRIMARY KEY,
          user_id        INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          nome           TEXT          NOT NULL,
          cnpj_cpf       TEXT          NOT NULL DEFAULT '',
          tipo           VARCHAR(2)    NOT NULL DEFAULT 'PF',
          responsavel    TEXT          NOT NULL DEFAULT '',
          email          TEXT          NOT NULL DEFAULT '',
          telefone       TEXT          NOT NULL DEFAULT '',
          origem         TEXT          NOT NULL DEFAULT '',
          status         TEXT          NOT NULL DEFAULT 'Ativo',
          processos      INTEGER       NOT NULL DEFAULT 0,
          valor_carteira NUMERIC(14,2) NOT NULL DEFAULT 0,
          created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ctrl_fornecedores (
          id         SERIAL PRIMARY KEY,
          user_id    INTEGER    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          nome       TEXT       NOT NULL,
          cnpj_cpf   TEXT       NOT NULL DEFAULT '',
          tipo       VARCHAR(2) NOT NULL DEFAULT 'PF',
          email      TEXT       NOT NULL DEFAULT '',
          telefone   TEXT       NOT NULL DEFAULT '',
          categoria  TEXT       NOT NULL DEFAULT 'Outro',
          status     TEXT       NOT NULL DEFAULT 'Ativo',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ctrl_contratos (
          id                SERIAL PRIMARY KEY,
          user_id           INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          numero            TEXT          NOT NULL DEFAULT '',
          cliente           TEXT          NOT NULL DEFAULT '',
          tipo              TEXT          NOT NULL DEFAULT '',
          valor             NUMERIC(14,2) NOT NULL DEFAULT 0,
          periodicidade     TEXT          NOT NULL DEFAULT '',
          percentual_exito  NUMERIC(5,2)  NOT NULL DEFAULT 0,
          inicio            TEXT          NOT NULL DEFAULT '',
          fim               TEXT          NOT NULL DEFAULT '',
          status            TEXT          NOT NULL DEFAULT 'Vigente',
          created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ctrl_processos (
          id             SERIAL PRIMARY KEY,
          user_id        INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          numero         TEXT          NOT NULL DEFAULT '',
          cliente        TEXT          NOT NULL DEFAULT '',
          area           TEXT          NOT NULL DEFAULT '',
          responsavel    TEXT          NOT NULL DEFAULT '',
          valor_causa    NUMERIC(14,2) NOT NULL DEFAULT 0,
          receita_total  NUMERIC(14,2) NOT NULL DEFAULT 0,
          despesa_total  NUMERIC(14,2) NOT NULL DEFAULT 0,
          margem         NUMERIC(14,2) NOT NULL DEFAULT 0,
          status         TEXT          NOT NULL DEFAULT 'Ativo',
          created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ctrl_receivables (
          id         SERIAL PRIMARY KEY,
          user_id    INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          cliente    TEXT          NOT NULL DEFAULT '',
          processo   TEXT          NOT NULL DEFAULT '',
          contrato   TEXT          NOT NULL DEFAULT '',
          vencimento TEXT          NOT NULL DEFAULT '',
          valor      NUMERIC(14,2) NOT NULL DEFAULT 0,
          status     TEXT          NOT NULL DEFAULT 'Aberto',
          created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ctrl_payables (
          id         SERIAL PRIMARY KEY,
          user_id    INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          fornecedor TEXT          NOT NULL DEFAULT '',
          categoria  TEXT          NOT NULL DEFAULT '',
          processo   TEXT          NOT NULL DEFAULT '',
          vencimento TEXT          NOT NULL DEFAULT '',
          valor      NUMERIC(14,2) NOT NULL DEFAULT 0,
          status     TEXT          NOT NULL DEFAULT 'Aberto',
          created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ctrl_activities (
          id          SERIAL PRIMARY KEY,
          user_id     INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title       TEXT          NOT NULL,
          description TEXT          NOT NULL DEFAULT '',
          value       NUMERIC(14,2),
          time        TEXT          NOT NULL DEFAULT '',
          created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ctrl_alerts (
          id          SERIAL PRIMARY KEY,
          user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title       TEXT    NOT NULL,
          description TEXT    NOT NULL DEFAULT '',
          severity    TEXT    NOT NULL DEFAULT 'media',
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    },
  },
  {
    name: "011_educational_plan",
    async up() {
      // Adiciona colunas de controle de acúmulo e marca educacional nos planos
      await db.execute(sql`
        ALTER TABLE plans
          ADD COLUMN IF NOT EXISTS allow_accumulation    BOOLEAN NOT NULL DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS educational_watermark BOOLEAN NOT NULL DEFAULT FALSE
      `);

      // Adiciona controle de ciclo de reset mensal na carteira
      await db.execute(sql`
        ALTER TABLE credit_wallets
          ADD COLUMN IF NOT EXISTS last_reset_cycle TEXT
      `);

      // Insere o Plano Educacional (sem acúmulo, marca d'água, 20 cr/mês)
      await db.execute(sql`
        INSERT INTO plans
          (name, slug, price_monthly, credits_monthly, max_users, description,
           active, display_order, allow_accumulation, educational_watermark)
        VALUES
          ('Plano Educacional', 'educacional', 0.00, 20, 1,
           'Plano gratuito para estudantes e instituições de ensino. Inclui 20 créditos mensais renováveis sem acúmulo e marca d''água educacional nos relatórios.',
           TRUE, 0, FALSE, TRUE)
        ON CONFLICT (slug) DO UPDATE
          SET allow_accumulation    = FALSE,
              educational_watermark = TRUE,
              display_order         = 0
      `);
    },
  },
  {
    name: "013_update_plans_2026",
    async up() {
      // Educacional: novo preço e 10 créditos/mês (120/ano), até 3 usuários
      await db.execute(sql`
        UPDATE plans SET
          name            = 'Educacional',
          price_monthly   = 63.92,
          credits_monthly = 10,
          max_users       = 3,
          description     = 'Para universidades, IFES, laboratórios e projetos de extensão. 10 créditos mensais (120/ano), reset mensal sem acúmulo.',
          display_order   = 0
        WHERE slug = 'educacional'
      `);

      // Essencial: R$ 149,90/mês, 40 créditos
      await db.execute(sql`
        UPDATE plans SET
          price_monthly   = 149.90,
          credits_monthly = 40,
          max_users       = 1,
          display_order   = 1
        WHERE slug = 'essencial'
      `);

      // Profissional: R$ 249,90/mês, 100 créditos, até 3 usuários
      await db.execute(sql`
        UPDATE plans SET
          price_monthly   = 249.90,
          credits_monthly = 100,
          max_users       = 3,
          display_order   = 2
        WHERE slug = 'profissional'
      `);

      // Avançado: R$ 449,90/mês, 250 créditos, até 8 usuários
      await db.execute(sql`
        UPDATE plans SET
          price_monthly   = 449.90,
          credits_monthly = 250,
          max_users       = 8,
          display_order   = 3
        WHERE slug = 'avancado'
      `);

      // Premium → Corporativo / Institucional (sob consulta)
      await db.execute(sql`
        UPDATE plans SET
          name            = 'Corporativo / Institucional',
          slug            = 'corporativo',
          price_monthly   = 0.00,
          credits_monthly = 0,
          max_users       = 9999,
          description     = 'Plano empresarial e institucional sob medida. Escopo, usuários e créditos definidos em contrato.',
          display_order   = 4
        WHERE slug = 'premium'
      `);
    },
  },
  {
    name: "014_essencial_pricing",
    async up() {
      await db.execute(sql`
        UPDATE plans SET
          price_monthly = 67.26
        WHERE slug = 'essencial'
      `);
    },
  },
  {
    name: "015_fix_plan_prices",
    async up() {
      // Restaura Essencial ao valor original
      await db.execute(sql`
        UPDATE plans SET price_monthly = 149.90
        WHERE slug = 'essencial'
      `);
      // Atualiza Educacional para novo preço
      await db.execute(sql`
        UPDATE plans SET price_monthly = 67.27
        WHERE slug = 'educacional'
      `);
    },
  },
  {
    name: "016_convenios_institucionais",
    async up() {
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS convenios (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          codigo VARCHAR(30) UNIQUE NOT NULL,
          nome_convenio VARCHAR(200) NOT NULL,
          tipo_convenio VARCHAR(50) NOT NULL DEFAULT 'OAB',
          contratante_nome VARCHAR(200) NOT NULL,
          contratante_documento VARCHAR(30),
          email_financeiro VARCHAR(150),
          telefone_financeiro VARCHAR(30),
          responsavel_nome VARCHAR(150),
          responsavel_cargo VARCHAR(100),
          responsavel_email VARCHAR(150),
          data_inicio DATE NOT NULL,
          data_fim DATE NOT NULL,
          data_renovacao DATE,
          status VARCHAR(30) NOT NULL DEFAULT 'ativo',
          renovacao_automatica BOOLEAN NOT NULL DEFAULT FALSE,
          prazo_aviso_previos_dias INTEGER NOT NULL DEFAULT 30,
          valor_contratado NUMERIC(14,2) NOT NULL DEFAULT 0,
          valor_pago NUMERIC(14,2) NOT NULL DEFAULT 0,
          limite_creditos_mensal INTEGER NOT NULL DEFAULT 0,
          limite_usuarios INTEGER NOT NULL DEFAULT 0,
          observacoes TEXT,
          cancelado_em TIMESTAMP,
          cancelado_motivo TEXT,
          prorrogado_em TIMESTAMP,
          prorrogado_nova_data_fim DATE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMP
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenios_status ON convenios(status)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenios_nome ON convenios(nome_convenio)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenios_contratante ON convenios(contratante_nome)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenios_data_fim ON convenios(data_fim)`);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS convenio_faturas (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          convenio_id UUID NOT NULL REFERENCES convenios(id) ON DELETE CASCADE,
          descricao VARCHAR(200) NOT NULL,
          competencia VARCHAR(7),
          valor_faturado NUMERIC(14,2) NOT NULL DEFAULT 0,
          valor_recebido NUMERIC(14,2) NOT NULL DEFAULT 0,
          data_vencimento DATE,
          data_pagamento DATE,
          status VARCHAR(30) NOT NULL DEFAULT 'aberta',
          forma_pagamento VARCHAR(50),
          observacoes TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenio_faturas_convenio ON convenio_faturas(convenio_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenio_faturas_status ON convenio_faturas(status)`);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS convenio_usuarios (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          convenio_id UUID NOT NULL REFERENCES convenios(id) ON DELETE CASCADE,
          nome VARCHAR(200) NOT NULL,
          cpf VARCHAR(14),
          numero_oab VARCHAR(30) NOT NULL,
          uf_oab VARCHAR(2) NOT NULL,
          data_nascimento DATE,
          telefone VARCHAR(30),
          email VARCHAR(150) NOT NULL,
          cargo_profissional VARCHAR(100),
          especialidade VARCHAR(100),
          cidade VARCHAR(100),
          estado VARCHAR(2),
          endereco TEXT,
          status VARCHAR(30) NOT NULL DEFAULT 'ativo',
          creditos_iniciais INTEGER NOT NULL DEFAULT 0,
          creditos_disponiveis INTEGER NOT NULL DEFAULT 0,
          creditos_comprados_total INTEGER NOT NULL DEFAULT 0,
          creditos_utilizados_total INTEGER NOT NULL DEFAULT 0,
          ultimo_login_em TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMP,
          CONSTRAINT unq_oab_por_convenio UNIQUE (convenio_id, numero_oab, uf_oab),
          CONSTRAINT unq_email_por_convenio UNIQUE (convenio_id, email)
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenio_usuarios_convenio ON convenio_usuarios(convenio_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenio_usuarios_status ON convenio_usuarios(status)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenio_usuarios_nome ON convenio_usuarios(nome)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenio_usuarios_oab ON convenio_usuarios(numero_oab, uf_oab)`);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS convenio_sessoes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          convenio_id UUID NOT NULL REFERENCES convenios(id) ON DELETE CASCADE,
          usuario_id UUID NOT NULL REFERENCES convenio_usuarios(id) ON DELETE CASCADE,
          login_em TIMESTAMP NOT NULL,
          logout_em TIMESTAMP,
          duracao_segundos INTEGER NOT NULL DEFAULT 0,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenio_sessoes_convenio ON convenio_sessoes(convenio_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenio_sessoes_usuario ON convenio_sessoes(usuario_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenio_sessoes_login_em ON convenio_sessoes(login_em)`);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS convenio_uso_modulos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          convenio_id UUID NOT NULL REFERENCES convenios(id) ON DELETE CASCADE,
          usuario_id UUID NOT NULL REFERENCES convenio_usuarios(id) ON DELETE CASCADE,
          modulo VARCHAR(60) NOT NULL,
          data_uso TIMESTAMP NOT NULL DEFAULT NOW(),
          tempo_uso_segundos INTEGER NOT NULL DEFAULT 0,
          creditos_usados INTEGER NOT NULL DEFAULT 0,
          creditos_comprados INTEGER NOT NULL DEFAULT 0,
          referencia_documento VARCHAR(120),
          metadata JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenio_uso_modulos_convenio ON convenio_uso_modulos(convenio_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenio_uso_modulos_usuario ON convenio_uso_modulos(usuario_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenio_uso_modulos_data ON convenio_uso_modulos(data_uso)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenio_uso_modulos_modulo ON convenio_uso_modulos(modulo)`);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS convenio_creditos_mov (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          convenio_id UUID NOT NULL REFERENCES convenios(id) ON DELETE CASCADE,
          usuario_id UUID REFERENCES convenio_usuarios(id) ON DELETE SET NULL,
          tipo VARCHAR(30) NOT NULL,
          quantidade INTEGER NOT NULL,
          valor_financeiro NUMERIC(14,2) NOT NULL DEFAULT 0,
          descricao TEXT,
          data_mov TIMESTAMP NOT NULL DEFAULT NOW(),
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenio_creditos_mov_convenio ON convenio_creditos_mov(convenio_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenio_creditos_mov_usuario ON convenio_creditos_mov(usuario_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenio_creditos_mov_tipo ON convenio_creditos_mov(tipo)`);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS convenio_alertas (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          convenio_id UUID NOT NULL REFERENCES convenios(id) ON DELETE CASCADE,
          tipo VARCHAR(50) NOT NULL,
          severidade VARCHAR(20) NOT NULL DEFAULT 'media',
          titulo VARCHAR(200) NOT NULL,
          descricao TEXT,
          resolvido BOOLEAN NOT NULL DEFAULT FALSE,
          resolvido_em TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenio_alertas_convenio ON convenio_alertas(convenio_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenio_alertas_tipo ON convenio_alertas(tipo)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_convenio_alertas_resolvido ON convenio_alertas(resolvido)`);

      await db.execute(sql`
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);

      await db.execute(sql`DROP TRIGGER IF EXISTS trg_convenios_updated_at ON convenios`);
      await db.execute(sql`
        CREATE TRIGGER trg_convenios_updated_at
        BEFORE UPDATE ON convenios
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
      `);

      await db.execute(sql`DROP TRIGGER IF EXISTS trg_convenio_faturas_updated_at ON convenio_faturas`);
      await db.execute(sql`
        CREATE TRIGGER trg_convenio_faturas_updated_at
        BEFORE UPDATE ON convenio_faturas
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
      `);

      await db.execute(sql`DROP TRIGGER IF EXISTS trg_convenio_usuarios_updated_at ON convenio_usuarios`);
      await db.execute(sql`
        CREATE TRIGGER trg_convenio_usuarios_updated_at
        BEFORE UPDATE ON convenio_usuarios
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
      `);
    },
  },
  {
    name: "018_convenio_elegiveis",
    async up() {
      // Colunas de elegibilidade na tabela convenios
      await db.execute(sql`
        ALTER TABLE convenios
          ADD COLUMN IF NOT EXISTS criterio_validacao VARCHAR(50) NOT NULL DEFAULT 'oab_uf',
          ADD COLUMN IF NOT EXISTS exige_lista_elegiveis BOOLEAN NOT NULL DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS dominio_email_permitido VARCHAR(200),
          ADD COLUMN IF NOT EXISTS creditos_iniciais_usuario INTEGER NOT NULL DEFAULT 0
      `);

      // Origem do vínculo na tabela convenio_usuarios
      await db.execute(sql`
        ALTER TABLE convenio_usuarios
          ADD COLUMN IF NOT EXISTS origem_vinculo VARCHAR(50) NOT NULL DEFAULT 'admin_manual',
          ADD COLUMN IF NOT EXISTS vinculado_em TIMESTAMP
      `);

      // Tabela de lista branca de elegíveis
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS convenio_elegiveis (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          convenio_id UUID NOT NULL REFERENCES convenios(id) ON DELETE CASCADE,
          nome VARCHAR(200),
          cpf VARCHAR(14),
          email VARCHAR(150),
          numero_oab VARCHAR(30),
          uf_oab VARCHAR(2),
          matricula VARCHAR(60),
          status VARCHAR(30) NOT NULL DEFAULT 'ativo',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ce_convenio ON convenio_elegiveis(convenio_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ce_cpf ON convenio_elegiveis(cpf) WHERE cpf IS NOT NULL`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ce_email ON convenio_elegiveis(email) WHERE email IS NOT NULL`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ce_oab ON convenio_elegiveis(numero_oab, uf_oab) WHERE numero_oab IS NOT NULL`);

      await db.execute(sql`DROP TRIGGER IF EXISTS trg_ce_updated_at ON convenio_elegiveis`);
      await db.execute(sql`
        CREATE TRIGGER trg_ce_updated_at
        BEFORE UPDATE ON convenio_elegiveis
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
      `);
    },
  },
  {
    name: "017_convenio_usuarios_auth",
    async up() {
      await db.execute(sql`
        ALTER TABLE convenio_usuarios
          ADD COLUMN IF NOT EXISTS senha_hash VARCHAR(255) NOT NULL DEFAULT '',
          ADD COLUMN IF NOT EXISTS primeiro_acesso_pendente BOOLEAN NOT NULL DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS redefinir_senha_obrigatoria BOOLEAN NOT NULL DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS tentativas_login INTEGER NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS bloqueado_ate TIMESTAMP NULL
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_cu_email ON convenio_usuarios(email)
        WHERE deleted_at IS NULL
      `);
    },
  },
  {
    name: "019_convenio_contratante_nullable",
    async up() {
      await db.execute(sql`
        ALTER TABLE convenios
          ALTER COLUMN contratante_nome DROP NOT NULL
      `);
    },
  },
  {
    name: "020_convenio_usuarios_matricula_oab_nullable",
    async up() {
      // Adiciona coluna matricula se não existir
      await db.execute(sql`
        ALTER TABLE convenio_usuarios
          ADD COLUMN IF NOT EXISTS matricula VARCHAR(100)
      `);
      // Torna numero_oab e uf_oab anuláveis (nem todo convênio é OAB)
      await db.execute(sql`
        ALTER TABLE convenio_usuarios
          ALTER COLUMN numero_oab DROP NOT NULL,
          ALTER COLUMN uf_oab    DROP NOT NULL
      `);
    },
  },
  {
    name: "022_convenio_email_partial_unique",
    async up() {
      // Recria a constraint de email como índice parcial (só para registros não deletados)
      // A constraint original bloqueia re-cadastro de e-mails soft-deleted
      await db.execute(sql`
        ALTER TABLE convenio_usuarios
          DROP CONSTRAINT IF EXISTS unq_email_por_convenio
      `);
      await db.execute(sql`
        DROP INDEX IF EXISTS unq_email_por_convenio
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS unq_email_por_convenio_active
        ON convenio_usuarios (convenio_id, LOWER(email))
        WHERE deleted_at IS NULL
      `);
    },
  },
  {
    name: "023_access_logs",
    async up() {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS access_logs (
          id         BIGSERIAL PRIMARY KEY,
          ip         VARCHAR(50),
          pais       VARCHAR(5),
          uf         VARCHAR(2),
          estado     VARCHAR(100),
          cidade     VARCHAR(100),
          pagina     VARCHAR(200),
          tipo       VARCHAR(50),
          user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
          user_agent TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at DESC)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_access_logs_uf ON access_logs(uf)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_access_logs_tipo ON access_logs(tipo)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id)`);
    },
  },
  {
    name: "021_convenio_oab_partial_unique",
    async up() {
      // Recria a constraint de OAB como índice parcial (só quando OAB está preenchida)
      // A constraint original bloqueia inserções com OAB nulo múltiplo em certas versões do PG
      await db.execute(sql`
        ALTER TABLE convenio_usuarios
          DROP CONSTRAINT IF EXISTS unq_oab_por_convenio
      `);
      await db.execute(sql`
        DROP INDEX IF EXISTS unq_oab_por_convenio
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS unq_oab_por_convenio_partial
        ON convenio_usuarios (convenio_id, numero_oab, uf_oab)
        WHERE numero_oab IS NOT NULL AND uf_oab IS NOT NULL
      `);
    },
  },
];

/**
 * Cria a tabela de controle de migrações se não existir e executa
 * as migrações pendentes em ordem.
 */
export async function runMigrations(): Promise<void> {
  // Tabela de controle de migrações aplicadas
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const migration of MIGRATIONS) {
    const result = await db.execute(sql`
      SELECT name FROM _schema_migrations WHERE name = ${migration.name}
    `);

    if (result.rows.length > 0) {
      continue;
    }

    console.log(`[migrate] Aplicando: ${migration.name}`);
    try {
      await migration.up();
      await db.execute(sql`
        INSERT INTO _schema_migrations (name) VALUES (${migration.name})
        ON CONFLICT (name) DO NOTHING
      `);
      console.log(`[migrate] Concluída: ${migration.name}`);
    } catch (err) {
      console.error(`[migrate] Falha em ${migration.name}:`, err);
      throw err;
    }
  }

  console.log("[migrate] Todas as migrações aplicadas");
}
