<p align="center">
  <img src="https://img.shields.io/badge/Status-MVP%20Homologado-gold?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express" alt="Express" />
  <img src="https://img.shields.io/badge/Drizzle-ORM-C5F74F?style=for-the-badge" alt="Drizzle ORM" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
</p>

# ⚖️ Veritas Analytics — JurisCalc Pro

**Plataforma profissional de cálculos judiciais para a Justiça Federal brasileira.**

Sistema completo para apuração de correção monetária, juros moratórios, conversão de moedas históricas, honorários advocatícios e geração de relatórios periciais — com precisão técnica e conformidade legal.

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Arquitetura](#-arquitetura)
- [Tech Stack](#-tech-stack)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação e Configuração](#-instalação-e-configuração)
- [Executando o Projeto](#-executando-o-projeto)
- [API — Endpoints Principais](#-api--endpoints-principais)
- [Motor de Cálculo](#-motor-de-cálculo)
- [Banco de Dados](#-banco-de-dados)
- [Módulos do Sistema](#-módulos-do-sistema)
- [Licença](#-licença)

---

## 🎯 Visão Geral

O **Veritas Analytics (JurisCalc Pro)** é uma plataforma SaaS voltada para advogados, peritos judiciais e contadores que necessitam realizar cálculos de liquidação de sentença com rigor técnico e rastreabilidade.

O sistema opera em um fluxo de **wizard (assistente)** em 7 etapas que guia o usuário desde a entrada dos dados processuais até a geração do relatório final em HTML/PDF.

### Principais diferenciais:

- 🔄 **Conversão automática de moedas históricas** (Cruzeiro → Cruzado → Real)
- 📊 **Índices econômicos oficiais** sincronizados com IBGE e Banco Central
- 🧮 **Motor de cálculo parametrizável** com critérios monetários configuráveis
- 📑 **Geração de relatórios** com memória de cálculo detalhada
- 🔐 **Integridade via hash** — cada cálculo possui verificação de integridade
- 🏦 **Sistema de planos e carteira de créditos** com integração MercadoPago
- 👥 **Multi-partes** — suporte a múltiplas partes credoras com parcelas individuais

---

## ✨ Funcionalidades

### Cálculos Judiciais (Wizard de 7 Abas)
| Aba | Descrição |
|-----|-----------|
| **1. Dados do Processo** | Número do processo, partes, tipo (execução/requisição de pagamento) |
| **2. Correção Monetária** | Critério monetário parametrizado, data-base, SELIC a partir de citação |
| **3. Juros Moratórios** | Regra de juros (simples, compostos, SELIC, poupança, legal, histórico misto) |
| **4. Partes e Parcelas** | Cadastro de partes credoras, parcelas mensais, importação via planilha |
| **5. Honorários** | Honorários sucumbenciais e contratuais (percentual, fixo, escalonado) |
| **6. Outras Sucumbências** | Custas, multas do art. 523, honorários adicionais |
| **7. Dados Finais e Relatório** | Dados do perito/contador, geração e exportação do relatório |

### Módulos Adicionais
- 🏛️ **Liquidação Previdenciária** — Cálculo de benefícios previdenciários com RMI, DIB/DIP
- ⚖️ **Cálculos Cíveis/Estaduais** — Módulo para processos da Justiça Estadual (TJMG)
- 🔧 **Ferramentas** — Extrator Pericial de Itens (PDF → dados estruturados)
- 📊 **Controladoria** — Dashboard financeiro e gerenciamento de equipes
- 🎫 **Convênios e Cupons** — Sistema de descontos e parcerias
- 💳 **Carteira Digital (Wallet)** — Créditos para consumo de cálculos

### Administração
- 👤 Gestão de usuários com autenticação JWT
- 📋 Logs de acesso e auditoria
- 💰 Painel financeiro administrativo
- 🔄 Backup e restauração do banco de dados
- 📧 Suporte integrado via e-mail (Nodemailer)

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React 19)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  calc-federal │  │    client    │  │ mockup-sandbox   │  │
│  │  (Vite + TW)  │  │  (Wouter)   │  │   (Protótipos)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘  │
│         │                  │                                 │
│         ▼                  ▼                                 │
│  ┌──────────────────────────────────┐                       │
│  │     api-client-react (Orval)     │  ← Gerado via OpenAPI │
│  └──────────────┬───────────────────┘                       │
└─────────────────┼───────────────────────────────────────────┘
                  │ HTTP/REST
┌─────────────────┼───────────────────────────────────────────┐
│                 ▼        BACKEND (Express 5)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   api-server                          │   │
│  │  ┌─────────┐  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │ Routes  │  │    Engine     │  │  Middlewares   │  │   │
│  │  │ (25+)   │  │ (Calculadora)│  │  (Auth/CORS)   │  │   │
│  │  └────┬────┘  └──────┬───────┘  └────────────────┘  │   │
│  │       │              │                                │   │
│  │       ▼              ▼                                │   │
│  │  ┌──────────────────────────────────────────────┐    │   │
│  │  │  Motor de Cálculo                            │    │   │
│  │  │  • correctionEngine (Correção Monetária)     │    │   │
│  │  │  • interestEngine (Juros Moratórios)         │    │   │
│  │  │  • currencyConversionEngine (Moedas)         │    │   │
│  │  │  • feesEngine (Honorários)                   │    │   │
│  │  │  • reportGenerator (Relatórios HTML)         │    │   │
│  │  │  • historicalRates (Taxas Históricas)        │    │   │
│  │  └──────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────┬───────────────────────────────────────────┘
                  │ Drizzle ORM
┌─────────────────┼───────────────────────────────────────────┐
│                 ▼          DATABASE                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              PostgreSQL (Neon/Supabase)               │   │
│  │  • calculation_cases  • parties  • installments       │   │
│  │  • monetary_criteria  • interest_rules                │   │
│  │  • official_indexes_cache  • currency_transitions     │   │
│  │  • users  • wallets  • plans  • audit_logs           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| **React** | 19.1 | UI Framework |
| **TypeScript** | 5.9 | Tipagem estática |
| **Vite** | 7.3 | Build tool e dev server |
| **TailwindCSS** | 4.1 | Estilização utility-first |
| **Radix UI** | Latest | Componentes primitivos acessíveis |
| **Framer Motion** | 12.35 | Animações e transições |
| **Recharts** | 2.15 | Gráficos e visualizações |
| **Wouter** | 3.3 | Roteamento client-side |
| **TanStack Query** | 5.90 | Cache e estado do servidor |
| **React Hook Form** | 7.71 | Formulários com validação |
| **Lucide React** | 0.545 | Ícones |
| **jsPDF** | 4.2 | Geração de PDF no cliente |
| **Sonner** | 2.0 | Notificações toast |

### Backend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| **Express** | 5.x | HTTP Server |
| **Drizzle ORM** | 0.45 | ORM type-safe para PostgreSQL |
| **Zod** | 3.25 | Validação de schemas |
| **JWT** | 9.0 | Autenticação via tokens |
| **bcryptjs** | 3.0 | Hash de senhas |
| **MercadoPago SDK** | 2.12 | Integração de pagamentos |
| **Nodemailer** | 8.0 | Envio de e-mails |
| **pdf-parse** | 2.4 | Extração de dados de PDFs |
| **Orval** | — | Geração de client API via OpenAPI |

### Infra e Ferramentas
| Tecnologia | Uso |
|------------|-----|
| **pnpm** | Gerenciador de pacotes (workspace monorepo) |
| **ESBuild** | Build do servidor para produção |
| **PostgreSQL** | Banco de dados relacional |
| **OpenAPI 3.1** | Especificação da API REST |

---

## 📁 Estrutura do Projeto

```
veritas-analytics/
├── 📂 artifacts/                    # Artefatos deployáveis
│   ├── 📂 api-server/              # Servidor Express (Backend)
│   │   ├── 📂 src/
│   │   │   ├── 📂 engine/          # Motor de cálculo judicial
│   │   │   │   ├── calculator.ts           # Orquestrador principal
│   │   │   │   ├── correctionEngine.ts     # Correção monetária
│   │   │   │   ├── interestEngine.ts       # Juros moratórios
│   │   │   │   ├── currencyConversionEngine.ts  # Conversão de moedas
│   │   │   │   ├── feesEngine.ts           # Honorários advocatícios
│   │   │   │   ├── reportGenerator.ts      # Geração de relatórios
│   │   │   │   ├── caseReportEngine.ts     # Relatório completo do caso
│   │   │   │   ├── indexService.ts         # Serviço de índices econômicos
│   │   │   │   └── historicalRates.ts      # Taxas históricas (SELIC, IPCA...)
│   │   │   ├── 📂 routes/          # Endpoints da API (25+ arquivos)
│   │   │   │   ├── auth.ts                 # Autenticação e registro
│   │   │   │   ├── cases.ts                # CRUD de casos de cálculo
│   │   │   │   ├── calculations.ts         # Cálculos legados
│   │   │   │   ├── indexes.ts              # Sincronização de índices
│   │   │   │   ├── plans.ts                # Planos e assinaturas
│   │   │   │   ├── wallet.ts               # Carteira de créditos
│   │   │   │   ├── team.ts                 # Gestão de equipes
│   │   │   │   ├── controladoria.ts        # Dashboard financeiro
│   │   │   │   ├── convenios.ts            # Sistema de convênios
│   │   │   │   ├── backup.ts               # Backup e restauração
│   │   │   │   └── ...                     # + 15 módulos adicionais
│   │   │   ├── 📂 middlewares/     # Auth, rate limiting, etc.
│   │   │   ├── 📂 providers/       # Integrações externas
│   │   │   └── app.ts              # Configuração do Express
│   │   ├── build.ts                # Script de build (ESBuild)
│   │   └── package.json
│   │
│   ├── 📂 calc-federal/            # Frontend principal (Vite + React)
│   │   ├── 📂 src/
│   │   │   ├── 📂 components/      # Componentes UI (Radix + shadcn)
│   │   │   ├── 📂 modules/         # Módulos de negócio
│   │   │   ├── 📂 pages/           # Páginas da aplicação
│   │   │   ├── 📂 context/         # React Context providers
│   │   │   ├── 📂 hooks/           # Custom hooks
│   │   │   ├── 📂 data/            # Dados estáticos e constantes
│   │   │   ├── 📂 theme/           # Configuração de tema
│   │   │   └── App.tsx             # Componente raiz
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── 📂 mockup-sandbox/          # Protótipos e experimentos
│
├── 📂 client/                       # Client app secundário (Dashboard MVP)
│   ├── 📂 src/
│   │   ├── 📂 pages/
│   │   │   ├── dashboard.tsx        # Painel com casos recentes
│   │   │   ├── wizard.tsx           # Wizard de cálculo (7 abas)
│   │   │   └── recover.tsx          # Recuperação de caso por chave
│   │   ├── 📂 components/
│   │   │   ├── layout.tsx           # Layout principal
│   │   │   └── ui.tsx               # Componentes UI base
│   │   └── App.tsx                  # Roteamento (Wouter)
│   └── requirements.yaml
│
├── 📂 lib/                          # Bibliotecas compartilhadas
│   ├── 📂 api-spec/                # Especificação OpenAPI 3.1
│   │   ├── openapi.yaml            # Spec completa da API (1400+ linhas)
│   │   └── orval.config.ts         # Config de geração do client
│   ├── 📂 api-client-react/        # Client HTTP gerado (React Query)
│   ├── 📂 api-zod/                 # Schemas Zod gerados da spec
│   └── 📂 db/                      # Camada de banco de dados
│       ├── 📂 src/schema/          # Schemas Drizzle ORM
│       │   ├── calculations.ts      # Tabelas de cálculos (30+ tabelas)
│       │   ├── users.ts             # Tabelas de usuários
│       │   ├── tax-tables.ts        # Tabelas de impostos
│       │   ├── salario-minimo.ts    # Histórico do salário mínimo
│       │   ├── tjmg-factors.ts      # Fatores TJMG
│       │   └── backups.ts           # Tabela de backups
│       └── drizzle.config.ts
│
├── 📂 scripts/                      # Scripts utilitários
│   ├── 📂 src/
│   └── post-merge.sh               # Hook pós-merge
│
├── package.json                     # Workspace root
├── pnpm-workspace.yaml             # Configuração do monorepo
├── tsconfig.base.json              # Config TypeScript base
└── tsconfig.json                   # Config TypeScript raiz
```

---

## 📦 Pré-requisitos

- **Node.js** ≥ 20.x
- **pnpm** ≥ 9.x (`npm install -g pnpm`)
- **PostgreSQL** 15+ (ou serviço como Neon/Supabase)

---

## 🚀 Instalação e Configuração

### 1. Clone o repositório

```bash
git clone https://github.com/vertiasanalytics/veritas-analytics.git
cd veritas-analytics
```

### 2. Instale as dependências

```bash
pnpm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Banco de Dados
DATABASE_URL=postgresql://user:password@host:5432/veritas_db

# JWT
JWT_SECRET=sua_chave_secreta_jwt
JWT_EXPIRES_IN=7d

# MercadoPago (Pagamentos)
MP_ACCESS_TOKEN=seu_token_mercadopago
MP_WEBHOOK_SECRET=seu_webhook_secret

# E-mail (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu@email.com
SMTP_PASS=sua_senha_app

# Ambiente
NODE_ENV=development
PORT=3000
```

### 4. Execute as migrações do banco

```bash
pnpm --filter @workspace/db run push
```

---

## ▶️ Executando o Projeto

### Modo Desenvolvimento

```bash
# Backend (API Server)
pnpm --filter @workspace/api-server run dev

# Frontend (Calc Federal)
pnpm --filter @workspace/calc-federal run dev
```

### Build de Produção

```bash
# Build completo (typecheck + build de todos os pacotes)
pnpm run build
```

---

## 🔌 API — Endpoints Principais

A API segue a especificação **OpenAPI 3.1** e está documentada em [`lib/api-spec/openapi.yaml`](lib/api-spec/openapi.yaml).

### Casos de Cálculo
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/cases` | Criar novo caso |
| `GET` | `/api/cases` | Listar todos os casos |
| `GET` | `/api/cases/:id` | Obter caso completo |
| `GET` | `/api/cases/recover/:publicKey` | Recuperar caso por chave pública |
| `PUT` | `/api/cases/:id/process-data` | Salvar dados do processo (Aba 1) |
| `PUT` | `/api/cases/:id/monetary-config` | Salvar correção monetária (Aba 2) |
| `PUT` | `/api/cases/:id/interest-config` | Salvar juros moratórios (Aba 3) |
| `PUT` | `/api/cases/:id/fees` | Salvar honorários (Aba 5) |
| `PUT` | `/api/cases/:id/final-metadata` | Salvar dados finais (Aba 7) |
| `POST` | `/api/cases/:id/compute` | Executar cálculo completo |
| `POST` | `/api/cases/:id/report` | Gerar relatório HTML |

### Partes e Parcelas
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/cases/:id/parties` | Criar parte credora |
| `POST` | `/api/cases/:id/parties/:pid/installments` | Criar parcelas |
| `POST` | `/api/cases/:id/parties/:pid/installments/paste` | Importar parcelas de planilha |
| `POST` | `/api/cases/:id/parties/:pid/discounts` | Criar desconto |

### Índices Econômicos
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/indexes` | Listar índices em cache |
| `POST` | `/api/indexes/sync` | Sincronizar com IBGE/BCB |

### Critérios e Regras
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/criteria` | Listar critérios monetários |
| `GET` | `/api/criteria/interest-rules` | Listar regras de juros |
| `GET` | `/api/criteria/currencies` | Listar transições monetárias |

---

## 🧮 Motor de Cálculo

O motor de cálculo é composto por engines especializadas:

### `correctionEngine.ts` — Correção Monetária
- Aplica índices de correção (IPCA, IPCA-E, INPC, TR, SELIC)
- Respeita critérios parametrizados com períodos e índices diferentes
- Suporta deflação opcional
- Gera memória de cálculo mês a mês

### `currencyConversionEngine.ts` — Conversão de Moedas
- Converte automaticamente valores históricos entre:
  - Cruzeiro (Cr$) → Cruzeiro Novo (NCr$) → Cruzeiro (Cr$) → Cruzado (Cz$)
  - Cruzado Novo (NCz$) → Cruzeiro (Cr$) → Cruzeiro Real (CR$) → Real (R$)
- Aplica fatores de divisão conforme legislação

### `interestEngine.ts` — Juros Moratórios
- Juros simples (1% a.m., 0,5% a.m., taxa manual)
- Juros compostos (SELIC, 12% a.a.)
- Juros da poupança
- Regime misto histórico (pré e pós Código Civil 2002)

### `feesEngine.ts` — Honorários
- Cálculo por percentual sobre valor da condenação
- Valor fixo
- Escalonamento para Fazenda Pública (art. 85, §3º CPC)
- Limite de desconto configurável

### `reportGenerator.ts` — Relatórios
- Geração de relatório HTML completo
- Memória de cálculo detalhada por parcela
- QR Code com chave pública para verificação
- Logotipo e identidade visual customizável

---

## 🗄️ Banco de Dados

O sistema utiliza **PostgreSQL** com **Drizzle ORM**. As principais tabelas:

### Tabelas Principais (30+)
| Tabela | Descrição |
|--------|-----------|
| `calculation_cases` | Casos de cálculo (entidade principal) |
| `process_data` | Dados do processo (Aba 1) |
| `case_monetary_config` | Configuração de correção monetária (Aba 2) |
| `case_interest_config` | Configuração de juros (Aba 3) |
| `parties` | Partes credoras (Aba 4) |
| `party_installments` | Parcelas de cada parte |
| `party_discounts` | Descontos por parte |
| `succumbential_fees` | Honorários advocatícios (Aba 5) |
| `other_succumbencies` | Outras sucumbências (Aba 6) |
| `final_metadata` | Dados finais (Aba 7) |
| `monetary_criteria` | Critérios monetários parametrizados |
| `monetary_criteria_rules` | Regras por período de cada critério |
| `interest_rules` | Regras de juros moratórios |
| `currency_transitions` | Transições monetárias históricas |
| `official_indexes_cache` | Cache de índices econômicos oficiais |
| `case_reports` | Relatórios gerados |
| `case_audit_logs` | Logs de auditoria |
| `previdenciario_saves` | Salvamentos de cálculos previdenciários |
| `civil_saves` | Salvamentos de cálculos cíveis |

---

## 📐 Módulos do Sistema

### 🏛️ Cálculo Federal (Módulo Principal)
Wizard completo de 7 abas para liquidação de sentença na Justiça Federal. Suporta múltiplas partes, parcelas individuais, conversão automática de moedas históricas e geração de relatório pericial.

### 🏥 Liquidação Previdenciária
Cálculo de benefícios previdenciários com suporte a:
- RMI (Renda Mensal Inicial)
- DIB/DIP (Data de Início do Benefício / Pagamento)
- Correção por índices oficiais
- 13º salário proporcional

### ⚖️ Cálculos Cíveis/Estaduais
Módulo para processos da Justiça Estadual com:
- Fatores de correção do TJMG
- Tabelas de impostos específicas
- Critérios estaduais

### 💳 Sistema Financeiro
- Planos de assinatura com ciclos mensal/anual
- Carteira digital com créditos consumíveis
- Integração completa com MercadoPago (PIX, cartão, boleto)
- Webhooks para confirmação automática de pagamento

### 🔧 Ferramentas
- Extrator Pericial de Itens — análise de PDFs judiciais com `pdf-parse`
- Extração de dados do TRF1

---

## 📄 Licença

Este projeto está licenciado sob a **MIT License** — veja o arquivo [LICENSE](LICENSE) para detalhes.

---

<p align="center">
  <strong>Veritas Analytics</strong> — Excelência em Cálculos Judiciais<br/>
  <sub>Desenvolvido com ⚖️ por Veritas Contabilidade</sub>
</p>