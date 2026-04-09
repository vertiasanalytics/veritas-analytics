import React, { useEffect, useMemo, useState } from "react";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useDebitCredits } from "@/hooks/use-wallet";
import { isEducationalPlan } from "@/lib/plan-access";
import { useQuery } from "@tanstack/react-query";
import { Upload, PenLine } from "lucide-react";

const API_BASE = "";

/* ============================================================
 * TIPOS
 * ============================================================ */

type ContaGrupo = "ATIVO" | "PASSIVO" | "PL" | "RESULTADO" | "OUTROS";

interface ParsedConta {
  codigo?: string;
  descricao: string;
  saldoInicial?: number | null;
  saldoFinal: number;
  nivel?: number;
  grupo: ContaGrupo;
}

interface ConsolidatedStructure {
  ativoCirculante: number;
  ativoNaoCirculante: number;
  realizavelLongoPrazo: number;
  imobilizado: number;
  intangivel: number;
  passivoCirculante: number;
  passivoNaoCirculante: number;
  patrimonioLiquido: number;
  disponivel: number;
  clientes: number;
  estoques: number;
  fornecedores: number;
  lucroLiquido: number;
  receitaLiquida: number;
  custoMercadorias: number;
}

interface FinancialIndicators {
  liquidezCorrente: number | null;
  liquidezSeca: number | null;
  liquidezImediata: number | null;
  liquidezGeral: number | null;
  endividamentoGeral: number | null;
  composicaoEndividamento: number | null;
  participacaoCapitalTerceiros: number | null;
  imobilizacaoPL: number | null;
  imobilizacaoRecursosNaoCorrente: number | null;
  grauAlavancagem: number | null;
  roaRetornoAtivo: number | null;
  roeRetornoPL: number | null;
  margemLiquida: number | null;
  margemBruta: number | null;
  giroAtivo: number | null;
  prazoMedioRecebimento: number | null;
  prazoMedioPagamento: number | null;
  prazoMedioEstoques: number | null;
}

type IndicatorKey = keyof FinancialIndicators;

interface IndicatorMeta {
  key: IndicatorKey;
  label: string;
  formula: string;
  category: "liquidez" | "endividamento" | "rentabilidade" | "atividade";
  isPercent?: boolean;
  isDays?: boolean;
}

interface IndicatorRow {
  key: IndicatorKey;
  nome: string;
  formula: string;
  valor: number | null;
  interpretacao: string;
  classificacao: string;
  isPercent?: boolean;
  isDays?: boolean;
}

interface EntityInfo {
  entidade: string;
  cnpj: string;
  periodoEscrituracao: string;
  periodoSelecionado: string;
  numeroLivro: string;
  chaveRelatorio: string;
  usuario: string;
  referenciaNormativa: string;
  arquivoOrigem: string;
  dataEmissao: string;
}

type ProcessStatus = "idle" | "processing" | "success" | "error";

/* ============================================================
 * CATÁLOGO COMPLETO DE ÍNDICES
 * ============================================================ */

const INDICATOR_CATALOG: IndicatorMeta[] = [
  // ── LIQUIDEZ ─────────────────────────────────────────────
  {
    key: "liquidezCorrente",
    label: "Liquidez Corrente",
    formula: "Ativo Circulante / Passivo Circulante",
    category: "liquidez",
  },
  {
    key: "liquidezSeca",
    label: "Liquidez Seca",
    formula: "(Ativo Circulante − Estoques) / Passivo Circulante",
    category: "liquidez",
  },
  {
    key: "liquidezImediata",
    label: "Liquidez Imediata",
    formula: "Disponível / Passivo Circulante",
    category: "liquidez",
  },
  {
    key: "liquidezGeral",
    label: "Liquidez Geral",
    formula: "(AC + RLP) / (PC + PNC)",
    category: "liquidez",
  },
  // ── ENDIVIDAMENTO E ESTRUTURA ─────────────────────────────
  {
    key: "endividamentoGeral",
    label: "Endividamento Geral",
    formula: "(PC + PNC) / Ativo Total",
    category: "endividamento",
    isPercent: true,
  },
  {
    key: "composicaoEndividamento",
    label: "Composição do Endividamento",
    formula: "Passivo Circulante / Passivo Total",
    category: "endividamento",
    isPercent: true,
  },
  {
    key: "participacaoCapitalTerceiros",
    label: "Participação de Capital de Terceiros",
    formula: "Passivo Total / Patrimônio Líquido",
    category: "endividamento",
  },
  {
    key: "imobilizacaoPL",
    label: "Imobilização do Patrimônio Líquido",
    formula: "(Imobilizado + Intangível) / Patrimônio Líquido",
    category: "endividamento",
    isPercent: true,
  },
  {
    key: "imobilizacaoRecursosNaoCorrente",
    label: "Imobilização dos Recursos Não Correntes",
    formula: "(Imobilizado + Intangível) / (PL + PNC)",
    category: "endividamento",
    isPercent: true,
  },
  {
    key: "grauAlavancagem",
    label: "Grau de Alavancagem Financeira",
    formula: "Ativo Total / Patrimônio Líquido",
    category: "endividamento",
  },
  // ── RENTABILIDADE ─────────────────────────────────────────
  {
    key: "roaRetornoAtivo",
    label: "ROA — Retorno sobre o Ativo",
    formula: "Lucro Líquido / Ativo Total",
    category: "rentabilidade",
    isPercent: true,
  },
  {
    key: "roeRetornoPL",
    label: "ROE — Retorno sobre o Patrimônio Líquido",
    formula: "Lucro Líquido / Patrimônio Líquido",
    category: "rentabilidade",
    isPercent: true,
  },
  {
    key: "margemLiquida",
    label: "Margem Líquida",
    formula: "Lucro Líquido / Receita Líquida",
    category: "rentabilidade",
    isPercent: true,
  },
  {
    key: "margemBruta",
    label: "Margem Bruta",
    formula: "(Receita Líquida − CMV) / Receita Líquida",
    category: "rentabilidade",
    isPercent: true,
  },
  // ── ATIVIDADE / GIRO ──────────────────────────────────────
  {
    key: "giroAtivo",
    label: "Giro do Ativo",
    formula: "Receita Líquida / Ativo Total",
    category: "atividade",
  },
  {
    key: "prazoMedioRecebimento",
    label: "Prazo Médio de Recebimento",
    formula: "(Clientes / Receita Líquida) × 360",
    category: "atividade",
    isDays: true,
  },
  {
    key: "prazoMedioPagamento",
    label: "Prazo Médio de Pagamento",
    formula: "(Fornecedores / CMV) × 360",
    category: "atividade",
    isDays: true,
  },
  {
    key: "prazoMedioEstoques",
    label: "Prazo Médio de Estoques",
    formula: "(Estoques / CMV) × 360",
    category: "atividade",
    isDays: true,
  },
];

const CATEGORIES: Array<{
  key: "liquidez" | "endividamento" | "rentabilidade" | "atividade";
  label: string;
  description: string;
}> = [
  {
    key: "liquidez",
    label: "Liquidez",
    description: "Capacidade de pagamento das obrigações de curto e longo prazo",
  },
  {
    key: "endividamento",
    label: "Endividamento e Estrutura de Capital",
    description: "Composição e alavancagem da estrutura financeira",
  },
  {
    key: "rentabilidade",
    label: "Rentabilidade",
    description: "Eficiência econômica — requer dados da DRE (Resultado do Exercício)",
  },
  {
    key: "atividade",
    label: "Atividade / Giro",
    description: "Ciclo operacional e eficiência na gestão de ativos — requer DRE",
  },
];

const ALL_INDICATOR_KEYS = new Set<IndicatorKey>(
  INDICATOR_CATALOG.map((m) => m.key)
);

/* ============================================================
 * HELPERS
 * ============================================================ */

function generateKey(): string {
  const ADJETIVOS = ["FEDERAL","JUDICIAL","LEGAL","OFICIAL","FORMAL","CERTO","FIRME","CLARO","JUSTO","BREVE","FORTE","PURO","NOBRE","LEAL","REAL"];
  const SUBSTANTIVOS = ["CALCULO","PROCESSO","ACAO","VALOR","CREDITO","DEBITO","PARCELA","INDICE","FATOR","SALDO","CONTA","BALANCO","ORDEM","TITULO","LAUDO"];
  const adj  = ADJETIVOS[Math.floor(Math.random() * ADJETIVOS.length)];
  const noun = SUBSTANTIVOS[Math.floor(Math.random() * SUBSTANTIVOS.length)];
  const hex  = () => Math.floor(Math.random() * 65536).toString(16).toUpperCase().padStart(4, "0");
  return `${adj}-${noun}-${hex()}-${hex()}`;
}

function nowBR(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date());
}

function formatBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatNumber(value: number | null | undefined, decimals = 4): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${formatNumber(value * 100, 2)}%`;
}

function formatDays(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${formatNumber(value, 1)} dias`;
}

function safeDivide(a: number, b: number): number | null {
  if (!b || Number.isNaN(a) || Number.isNaN(b)) return null;
  return a / b;
}

function parseBrazilianMoney(raw: string): number {
  const cleaned = raw.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".").replace("(", "-").replace(")", "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

function inferNivel(codigo?: string): number | undefined {
  if (!codigo) return undefined;
  return codigo.split(".").length;
}

function inferGrupoByCodigo(codigo?: string): ContaGrupo {
  if (!codigo) return "OUTROS";
  if (codigo.startsWith("1")) return "ATIVO";
  if (codigo.startsWith("2")) return "PASSIVO";
  if (codigo.startsWith("3")) return "PL";
  if (codigo.startsWith("4") || codigo.startsWith("5")) return "RESULTADO";
  return "OUTROS";
}

function inferGrupoByDescricao(descricao: string): ContaGrupo {
  const d = descricao.toLowerCase();
  if (d.includes("ativo") || d.includes("dispon") || d.includes("clientes") || d.includes("estoque") || d.includes("imobilizado") || d.includes("intang")) return "ATIVO";
  if (d.includes("passivo") || d.includes("fornecedores") || d.includes("obrigações") || d.includes("tributos") || d.includes("empréstimos") || d.includes("parcelamentos")) return "PASSIVO";
  if (d.includes("patrimonio líquido") || d.includes("patrimônio líquido") || d.includes("capital social") || d.includes("reservas") || d.includes("lucros") || d.includes("prejuízos")) return "PL";
  return "OUTROS";
}

/* ============================================================
 * EXTRAÇÃO PDF
 * ============================================================ */

async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).href;
  }
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  let fullText = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const lineMap = new Map<number, Array<{ x: number; str: string }>>();
    for (const item of content.items as any[]) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push({ x: item.transform[4], str: item.str });
    }
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const items = lineMap.get(y)!.sort((a, b) => a.x - b.x);
      let line = items.map((i) => i.str).join(" ");
      line = line.replace(/\(\s*([\d\.,]+)\s*\)/g, "($1)");
      line = line.replace(/R\s+\$/g, "R$");
      line = line.replace(/\s{2,}/g, " ").trim();
      if (line) fullText += `${line}\n`;
    }
  }
  return fullText;
}

function extractEntityInfo(text: string, fileName: string): Partial<EntityInfo> {
  const n = text.replace(/\s+/g, " ");

  const entidade =
    n.match(/Entidade:\s*([A-Z0-9ÇÃÉÍÓÚÂÊÔ\s\.\-&]+?)\s+Período da Escrituração:/i)?.[1]?.trim() || "";

  const periodoEscrituracao =
    n.match(/Período da Escrituração:\s*([0-9\/]+\s*a\s*[0-9\/]+)/i)?.[1]?.trim() || "";

  // CNPJ may be split across two PDF text items (e.g. "09.556.447/0001-" + " 16").
  // Allow up to one embedded space then strip it.
  const rawCnpj =
    n.match(/CNPJ:\s*([\d\.\/-]+(?:\s?\d{1,2})?)/i)?.[1]?.trim().replace(/\s/g, "") || "";
  const cnpj = rawCnpj;

  // Período Selecionado uses several date patterns in SPED:
  // "DD de Mês de YYYY a DD de Mês de YYYY" or "DD/MM/YYYY a DD/MM/YYYY"
  // We stop greedily at the first non-date word to prevent leaking raw PDF text.
  const periodoSelecionado =
    n.match(
      /Período Selecionado:\s*(\d{1,2}\s+de\s+[A-Za-záéíóúâêôãõ]+\s+de\s+\d{4}\s+a\s+\d{1,2}\s+de\s+[A-Za-záéíóúâêôãõ]+\s+de\s+\d{4})/i
    )?.[1]?.trim() ||
    n.match(/Período Selecionado:\s*(\d{2}\/\d{2}\/\d{4}\s*a\s*\d{2}\/\d{2}\/\d{4})/i)?.[1]?.trim() ||
    n.match(/Período Selecionado:\s*(\d{4}-\d{2}-\d{2}\s*a\s*\d{4}-\d{2}-\d{2})/i)?.[1]?.trim() ||
    "";

  const numeroLivro =
    n.match(/Número de Ordem do Livro:\s*(\d+)/i)?.[1]?.trim() || "";

  return { entidade, periodoEscrituracao, cnpj, periodoSelecionado, numeroLivro, arquivoOrigem: fileName };
}

/* ============================================================
 * PARSER CONTÁBIL PDF SPED
 * ============================================================ */

function parseSpedBalanceFromText(text: string): ParsedConta[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const contas: ParsedConta[] = [];
  const fullPattern = /^([0-9][0-9.\-]*)?\s*([A-ZÀ-ÝÇÕÃÉÍÓÚÂÊÔa-zà-ÿ0-9\s\-\(\)\/\.]+?)\s+R\$\s*([\(\)\d\.\,\-]+)\s+R\$\s*([\(\)\d\.\,\-]+)$/;
  const partialPattern = /^([0-9][0-9.\-]*)?\s*([A-ZÀ-ÝÇÕÃÉÍÓÚÂÊÔa-zà-ÿ0-9\s\-\(\)\/\.]+?)\s+R\$\s*([\(\)\d\.\,\-]+)$/;
  for (const line of lines) {
    if (/BALANÇO PATRIMONIAL|Descrição|Saldo Inicial|Saldo Final|Sistema Público de Escrituração Digital|Visualizador|Página/i.test(line)) continue;
    const fullMatch = line.match(fullPattern);
    if (fullMatch) {
      const codigo = fullMatch[1]?.trim() || undefined;
      const descricao = fullMatch[2].trim().replace(/\s+/g, " ");
      const saldoInicial = parseBrazilianMoney(fullMatch[3]);
      const saldoFinal = parseBrazilianMoney(fullMatch[4]);
      contas.push({ codigo, descricao, saldoInicial, saldoFinal, nivel: inferNivel(codigo), grupo: codigo ? inferGrupoByCodigo(codigo) : inferGrupoByDescricao(descricao) });
      continue;
    }
    const partialMatch = line.match(partialPattern);
    if (partialMatch) {
      const codigo = partialMatch[1]?.trim() || undefined;
      const descricao = partialMatch[2].trim().replace(/\s+/g, " ");
      const saldoFinal = parseBrazilianMoney(partialMatch[3]);
      contas.push({ codigo, descricao, saldoFinal, nivel: inferNivel(codigo), grupo: codigo ? inferGrupoByCodigo(codigo) : inferGrupoByDescricao(descricao) });
    }
  }
  return contas;
}

/* ============================================================
 * CONSOLIDAÇÃO CONTÁBIL
 * ============================================================ */

function sumByKeywords(contas: ParsedConta[], keywords: string[]): number {
  return contas
    .filter((c) => { const d = c.descricao.toLowerCase(); return keywords.some((k) => d.includes(k)); })
    .reduce((acc, item) => acc + item.saldoFinal, 0);
}

function findHeadlineValue(contas: ParsedConta[], exactDescriptions: string[]): number {
  for (const candidate of exactDescriptions) {
    const found = contas.find(
      (c) => c.descricao.trim().toLowerCase() === candidate.trim().toLowerCase()
    );
    if (found) return found.saldoFinal;
  }
  return 0;
}

/**
 * Consolidação com cadeia de prioridade em 3 níveis para cada rubrica:
 *
 * Prioridade 1 — Código exato da conta no plano SPED (mais confiável)
 *   Suporta variações "1.1" e "1.01" comuns em diferentes planos de contas.
 *
 * Prioridade 2 — Descrição exata na linha de totalização (headline)
 *   Busca o total do grupo pelo nome exato, sem risco de capturar sub-contas.
 *
 * Prioridade 3 — Soma restrita a contas FOLHA (nível ≥ 3 ou sem código)
 *   Evita dupla contagem: contas de nível 1 e 2 são totais de grupo e já
 *   englobam seus filhos. Somá-las junto com os filhos inflaria o resultado.
 *   Para os TOTAIS de grupo (AC, ANC, PC, PNC, PL) NUNCA usamos soma por
 *   palavras-chave — se não encontramos pelo código ou headline, retornamos 0.
 */
function consolidateStructure(contas: ParsedConta[]): ConsolidatedStructure {

  // ── 1. Lookup por código exato ────────────────────────────────────────────
  const byCode = (codes: string[]): number => {
    for (const code of codes) {
      const found = contas.find((c) => c.codigo === code);
      if (found) return found.saldoFinal;
    }
    return 0;
  };

  // ── 2. Lookup por descrição exata (headline) ──────────────────────────────
  const headline = (descs: string[]): number => findHeadlineValue(contas, descs);

  // ── 3. Soma somente de contas FOLHA (nível ≥ 3 OU sem código) ─────────────
  // Contas de nível 1 ou 2 são totalizadoras; incluí-las causaria dupla contagem.
  const leafContas = contas.filter(
    (c) => !c.codigo || c.nivel === undefined || c.nivel >= 3
  );
  const leafSum = (kws: string[]): number => sumByKeywords(leafContas, kws);

  // ═══════════════════════════════════════════════════════════════════════════
  // ATIVO
  // Totais de grupo: usamos SOMENTE código ou headline (nunca soma por palavra)
  // ═══════════════════════════════════════════════════════════════════════════

  const ativoCirculante =
    byCode(["1.1", "1.01"]) ||
    headline(["ATIVO CIRCULANTE"]) ||
    0;

  const realizavelLongoPrazo =
    byCode(["1.2.1", "1.2.01", "1.02.1", "1.02.01"]) ||
    headline(["ATIVO REALIZÁVEL A LONGO PRAZO", "REALIZÁVEL A LONGO PRAZO",
              "REALIZAVEL A LONGO PRAZO", "REALIZÁVEL LP"]) ||
    0;

  // Imobilizado: byCode com variantes comuns de plano de contas
  // NÃO adicionamos depreciação separada — ela já é negativa dentro do total
  const imobilizado =
    byCode(["1.2.3", "1.2.03", "1.2.2", "1.2.02",
            "1.02.3", "1.02.03", "1.02.2", "1.02.02"]) ||
    headline(["ATIVO IMOBILIZADO", "IMOBILIZADO"]) ||
    0;

  const intangivel =
    byCode(["1.2.4", "1.2.04", "1.2.5", "1.2.05",
            "1.02.4", "1.02.04", "1.02.5", "1.02.05"]) ||
    headline(["ATIVO INTANGÍVEL", "INTANGÍVEL", "ATIVO INTANGIVEL", "INTANGIVEL"]) ||
    0;

  // ANC: tenta o total consolidado; cai para soma dos sub-grupos se necessário
  const ativoNaoCirculante =
    byCode(["1.2", "1.02"]) ||
    headline(["ATIVO NÃO CIRCULANTE", "ATIVO NAO CIRCULANTE"]) ||
    (realizavelLongoPrazo + imobilizado + intangivel) ||
    0;

  // ═══════════════════════════════════════════════════════════════════════════
  // PASSIVO E PL
  // ═══════════════════════════════════════════════════════════════════════════

  const passivoCirculante =
    byCode(["2.1", "2.01"]) ||
    headline(["PASSIVO CIRCULANTE"]) ||
    0;

  const passivoNaoCirculante =
    byCode(["2.2", "2.02"]) ||
    headline(["PASSIVO NÃO-CIRCULANTE", "PASSIVO NÃO CIRCULANTE",
              "PASSIVO NAO CIRCULANTE", "EXIGÍVEL A LONGO PRAZO", "EXIGIVEL A LONGO PRAZO"]) ||
    0;

  // PL: pode ter código 3 (separado) ou 2.3 / 2.03 (dentro do passivo)
  const patrimonioLiquido =
    byCode(["3", "2.3", "2.03", "2.4", "2.04"]) ||
    headline(["PATRIMÔNIO LÍQUIDO", "PATRIMÔNIO LIQUIDO",
              "PATRIMONIO LÍQUIDO", "PATRIMONIO LIQUIDO",
              "PATRIMÔNIO LÍQUIDO CONSOLIDADO", "PATRIMÔNIO LÍQUIDO DOS CONTROLADORES"]) ||
    0;

  // ═══════════════════════════════════════════════════════════════════════════
  // SUB-ITENS (contas detalhe — permite soma folha como último recurso)
  // ═══════════════════════════════════════════════════════════════════════════

  const disponivel =
    byCode(["1.1.1", "1.1.01", "1.01.1", "1.01.01"]) ||
    headline(["DISPONÍVEL", "DISPONIVEL",
              "CAIXA E EQUIVALENTES DE CAIXA", "CAIXA E EQUIVALENTES"]) ||
    leafSum(["caixa e equival", "disponibilidades"]);

  const clientes =
    byCode(["1.1.2", "1.1.02", "1.01.2", "1.01.02"]) ||
    headline(["CLIENTES", "CONTAS A RECEBER", "CRÉDITOS A RECEBER",
              "CREDITOS A RECEBER", "DUPLICATAS A RECEBER"]) ||
    leafSum(["clientes", "contas a receber", "duplicatas a receber",
             "administradoras de cartão"]);

  const estoques =
    byCode(["1.1.3", "1.1.03", "1.01.3", "1.01.03"]) ||
    headline(["ESTOQUE", "ESTOQUES", "ESTOQUE DE MERCADORIAS",
              "MERCADORIAS PARA REVENDA", "PRODUTOS ACABADOS"]) ||
    leafSum(["estoque de mercadorias", "mercadorias para revenda", "produtos acabados"]);

  const fornecedores =
    byCode(["2.1.1", "2.1.01", "2.01.1", "2.01.01"]) ||
    headline(["FORNECEDORES", "FORNECEDORES NACIONAIS", "FORNECEDORES A PAGAR"]) ||
    leafSum(["fornecedores"]);

  // ═══════════════════════════════════════════════════════════════════════════
  // DRE — Demonstração do Resultado do Exercício (opcional)
  // Linhas totalizadoras da DRE: headline tem prioridade; soma folha como fallback
  // ═══════════════════════════════════════════════════════════════════════════

  const lucroLiquido =
    headline(["RESULTADO DO EXERCÍCIO", "RESULTADO DO EXERCICIO",
              "LUCRO LÍQUIDO", "LUCRO LIQUIDO",
              "PREJUÍZO DO EXERCÍCIO", "PREJUIZO DO EXERCICIO",
              "LUCRO/PREJUÍZO DO EXERCÍCIO", "LUCRO/PREJUIZO DO EXERCICIO",
              "RESULTADO LÍQUIDO DO EXERCÍCIO"]) ||
    leafSum(["resultado do exerc", "lucro líquido do exerc"]);

  const receitaLiquida =
    headline(["RECEITA OPERACIONAL LÍQUIDA", "RECEITA OPERACIONAL LIQUIDA",
              "RECEITA LÍQUIDA", "RECEITA LIQUIDA",
              "RECEITA BRUTA DE VENDAS E SERVIÇOS", "RECEITA BRUTA DE VENDAS",
              "RECEITA BRUTA"]) ||
    leafSum(["receita operacional líquida", "receita líquida de vendas"]);

  const custoMercadorias =
    headline(["CUSTO DAS MERCADORIAS VENDIDAS", "CUSTO DOS PRODUTOS VENDIDOS",
              "CUSTO DOS SERVIÇOS PRESTADOS", "CUSTO DE VENDAS", "CMV", "CPV", "CSP"]) ||
    leafSum(["custo das mercadorias vendidas", "custo dos produtos vendidos",
             "custo dos serviços prestados"]);

  return {
    ativoCirculante, ativoNaoCirculante, realizavelLongoPrazo, imobilizado, intangivel,
    passivoCirculante, passivoNaoCirculante, patrimonioLiquido, disponivel, clientes,
    estoques, fornecedores, lucroLiquido, receitaLiquida, custoMercadorias,
  };
}

/* ============================================================
 * VALIDAÇÃO DA EQUAÇÃO PATRIMONIAL
 * Ativo Total = Passivo Circulante + Passivo Não Circulante + Patrimônio Líquido
 * ============================================================ */

interface BalanceCheck {
  ativoTotal: number;
  passivoMaisPL: number;
  diffAbs: number;
  diffPct: number;
  balanced: boolean;
}

function validateBalance(s: ConsolidatedStructure): BalanceCheck {
  const ativoTotal   = s.ativoCirculante + s.ativoNaoCirculante;
  const passivoMaisPL = s.passivoCirculante + s.passivoNaoCirculante + s.patrimonioLiquido;
  const diffAbs = Math.abs(ativoTotal - passivoMaisPL);
  const diffPct = ativoTotal > 0 ? (diffAbs / ativoTotal) * 100 : 100;
  return { ativoTotal, passivoMaisPL, diffAbs, diffPct, balanced: diffPct < 0.5 };
}

/* ============================================================
 * ÍNDICES ECONÔMICO-FINANCEIROS
 * ============================================================ */

function calculateIndicators(s: ConsolidatedStructure): FinancialIndicators {
  const totalPassivo = s.passivoCirculante + s.passivoNaoCirculante;
  const totalAtivo = s.ativoCirculante + s.ativoNaoCirculante;
  return {
    liquidezCorrente: safeDivide(s.ativoCirculante, s.passivoCirculante),
    liquidezSeca: safeDivide(s.ativoCirculante - s.estoques, s.passivoCirculante),
    liquidezImediata: safeDivide(s.disponivel, s.passivoCirculante),
    liquidezGeral: safeDivide(s.ativoCirculante + s.realizavelLongoPrazo, s.passivoCirculante + s.passivoNaoCirculante),
    endividamentoGeral: safeDivide(totalPassivo, totalAtivo),
    composicaoEndividamento: safeDivide(s.passivoCirculante, totalPassivo),
    participacaoCapitalTerceiros: safeDivide(totalPassivo, s.patrimonioLiquido),
    imobilizacaoPL: safeDivide(s.imobilizado + s.intangivel, s.patrimonioLiquido),
    imobilizacaoRecursosNaoCorrente: safeDivide(s.imobilizado + s.intangivel, s.patrimonioLiquido + s.passivoNaoCirculante),
    grauAlavancagem: safeDivide(totalAtivo, s.patrimonioLiquido),
    roaRetornoAtivo: safeDivide(s.lucroLiquido, totalAtivo),
    roeRetornoPL: safeDivide(s.lucroLiquido, s.patrimonioLiquido),
    margemLiquida: safeDivide(s.lucroLiquido, s.receitaLiquida),
    margemBruta: s.receitaLiquida ? safeDivide(s.receitaLiquida - s.custoMercadorias, s.receitaLiquida) : null,
    giroAtivo: safeDivide(s.receitaLiquida, totalAtivo),
    prazoMedioRecebimento: s.receitaLiquida ? safeDivide(s.clientes * 360, s.receitaLiquida) : null,
    prazoMedioPagamento: s.custoMercadorias ? safeDivide(s.fornecedores * 360, s.custoMercadorias) : null,
    prazoMedioEstoques: s.custoMercadorias ? safeDivide(s.estoques * 360, s.custoMercadorias) : null,
  };
}

function classifyIndicator(key: IndicatorKey, valor: number | null): { interpretacao: string; classificacao: string } {
  if (valor == null) return { interpretacao: "Índice não calculável com os dados disponíveis (verifique se o arquivo contém DRE).", classificacao: "Indeterminado" };
  switch (key) {
    case "liquidezCorrente":
      if (valor < 1) return { interpretacao: "Insuficiência de ativos circulantes para cobertura do passivo de curto prazo.", classificacao: "Crítico" };
      if (valor < 1.2) return { interpretacao: "Liquidez corrente apenas marginalmente adequada.", classificacao: "Atenção" };
      return { interpretacao: "Capacidade de cobertura das obrigações de curto prazo em patamar adequado.", classificacao: "Adequado" };
    case "liquidezSeca":
      if (valor < 0.7) return { interpretacao: "Dependência relevante de estoques para solvência no curto prazo.", classificacao: "Crítico" };
      if (valor < 1) return { interpretacao: "Liquidez seca moderada.", classificacao: "Atenção" };
      return { interpretacao: "Boa capacidade de liquidez sem dependência integral dos estoques.", classificacao: "Adequado" };
    case "liquidezImediata":
      if (valor < 0.1) return { interpretacao: "Baixa cobertura imediata de exigibilidades com disponibilidades.", classificacao: "Atenção" };
      return { interpretacao: "Disponibilidades em patamar compatível para liquidez imediata.", classificacao: "Adequado" };
    case "liquidezGeral":
      if (valor < 1) return { interpretacao: "Estrutura patrimonial insuficiente para cobertura das obrigações totais.", classificacao: "Crítico" };
      return { interpretacao: "Equilíbrio financeiro global em patamar aceitável.", classificacao: "Adequado" };
    case "endividamentoGeral":
      if (valor > 0.8) return { interpretacao: "Estrutura altamente alavancada, com expressiva participação de capital de terceiros.", classificacao: "Crítico" };
      if (valor > 0.6) return { interpretacao: "Endividamento relevante, exigindo análise cautelosa.", classificacao: "Atenção" };
      return { interpretacao: "Nível de endividamento administrável.", classificacao: "Adequado" };
    case "composicaoEndividamento":
      if (valor > 0.7) return { interpretacao: "Concentração da dívida no curto prazo.", classificacao: "Crítico" };
      if (valor > 0.5) return { interpretacao: "Parcela importante da dívida exigível no curto prazo.", classificacao: "Atenção" };
      return { interpretacao: "Distribuição do endividamento com menor pressão no curto prazo.", classificacao: "Adequado" };
    case "participacaoCapitalTerceiros":
      if (valor > 2) return { interpretacao: "Forte dependência de capitais de terceiros em relação ao capital próprio.", classificacao: "Crítico" };
      if (valor > 1) return { interpretacao: "Capital de terceiros supera o patrimônio líquido.", classificacao: "Atenção" };
      return { interpretacao: "Estrutura de capital com dependência moderada de recursos de terceiros.", classificacao: "Adequado" };
    case "imobilizacaoPL":
      if (valor > 1) return { interpretacao: "Patrimônio líquido insuficiente para suportar integralmente os ativos permanentes.", classificacao: "Atenção" };
      return { interpretacao: "Imobilização do patrimônio líquido em patamar compatível.", classificacao: "Adequado" };
    case "imobilizacaoRecursosNaoCorrente":
      if (valor > 1) return { interpretacao: "Recursos de longo prazo insuficientes para financiar integralmente os ativos permanentes.", classificacao: "Atenção" };
      return { interpretacao: "Recursos não correntes suficientes para financiar os ativos permanentes.", classificacao: "Adequado" };
    case "grauAlavancagem":
      if (valor > 3) return { interpretacao: "Elevado grau de alavancagem financeira — risco significativo em relação ao capital próprio.", classificacao: "Crítico" };
      if (valor > 2) return { interpretacao: "Alavancagem relevante, demandando análise de sustentabilidade financeira.", classificacao: "Atenção" };
      return { interpretacao: "Grau de alavancagem financeira moderado.", classificacao: "Adequado" };
    case "roaRetornoAtivo":
      if (valor < 0) return { interpretacao: "Retorno negativo sobre o ativo total — resultado deficitário no período.", classificacao: "Crítico" };
      if (valor < 0.03) return { interpretacao: "Retorno sobre o ativo abaixo de 3% — eficiência econômica reduzida.", classificacao: "Atenção" };
      return { interpretacao: "Retorno sobre o ativo em patamar satisfatório.", classificacao: "Adequado" };
    case "roeRetornoPL":
      if (valor < 0) return { interpretacao: "Retorno negativo sobre o patrimônio líquido — destruição de valor no período.", classificacao: "Crítico" };
      if (valor < 0.05) return { interpretacao: "Retorno sobre o patrimônio líquido abaixo de 5%.", classificacao: "Atenção" };
      return { interpretacao: "Retorno sobre o patrimônio líquido em patamar satisfatório.", classificacao: "Adequado" };
    case "margemLiquida":
      if (valor < 0) return { interpretacao: "Margem líquida negativa — resultado abaixo do ponto de equilíbrio.", classificacao: "Crítico" };
      if (valor < 0.03) return { interpretacao: "Margem líquida estreita — baixa rentabilidade sobre a receita.", classificacao: "Atenção" };
      return { interpretacao: "Margem líquida em patamar aceitável.", classificacao: "Adequado" };
    case "margemBruta":
      if (valor < 0) return { interpretacao: "Margem bruta negativa — custo das vendas supera a receita.", classificacao: "Crítico" };
      if (valor < 0.15) return { interpretacao: "Margem bruta estreita — baixa cobertura para despesas operacionais.", classificacao: "Atenção" };
      return { interpretacao: "Margem bruta em patamar compatível com a cobertura das despesas operacionais.", classificacao: "Adequado" };
    case "giroAtivo":
      if (valor < 0.3) return { interpretacao: "Baixo giro do ativo — ineficiência na utilização dos ativos para geração de receita.", classificacao: "Atenção" };
      return { interpretacao: "Giro do ativo em nível satisfatório.", classificacao: "Adequado" };
    case "prazoMedioRecebimento":
      if (valor > 90) return { interpretacao: "Prazo médio de recebimento elevado — risco de comprometimento do caixa.", classificacao: "Atenção" };
      return { interpretacao: "Prazo médio de recebimento compatível com a atividade.", classificacao: "Adequado" };
    case "prazoMedioPagamento":
      if (valor < 15) return { interpretacao: "Prazo médio de pagamento curto — menor poder de negociação com fornecedores.", classificacao: "Atenção" };
      return { interpretacao: "Prazo médio de pagamento satisfatório.", classificacao: "Adequado" };
    case "prazoMedioEstoques":
      if (valor > 90) return { interpretacao: "Prazo médio de estoques elevado — risco de obsolescência e imobilização de recursos.", classificacao: "Atenção" };
      return { interpretacao: "Prazo médio de estoques em patamar adequado.", classificacao: "Adequado" };
    default:
      return { interpretacao: "Interpretação não disponível.", classificacao: "Indeterminado" };
  }
}

function buildIndicatorRows(indicators: FinancialIndicators, selectedKeys: Set<IndicatorKey>): IndicatorRow[] {
  return INDICATOR_CATALOG
    .filter((meta) => selectedKeys.has(meta.key))
    .map((meta) => {
      const valor = indicators[meta.key];
      const { interpretacao, classificacao } = classifyIndicator(meta.key, valor);
      return { key: meta.key, nome: meta.label, formula: meta.formula, valor, interpretacao, classificacao, isPercent: meta.isPercent, isDays: meta.isDays };
    });
}

/* ============================================================
 * ANÁLISE TÉCNICA AUTOMÁTICA — cobre TODOS os índices selecionados
 * Organizada por categoria (Liquidez → Endividamento → Rentabilidade → Atividade).
 * Cada índice calculado gera uma frase de interpretação pericial.
 * Índices com valor null (dados DRE ausentes) são omitidos silenciosamente.
 * ============================================================ */
function defaultTechnicalAnalysis(_structure: ConsolidatedStructure, indicatorRows: IndicatorRow[]): string {
  if (indicatorRows.length === 0) return "";

  const byCategory = CATEGORIES.map((cat) => ({
    cat,
    rows: indicatorRows.filter((r) => {
      const meta = INDICATOR_CATALOG.find((m) => m.key === r.key);
      return meta?.category === cat.key && r.valor !== null;
    }),
  })).filter(({ rows }) => rows.length > 0);

  const paragraphs: string[] = [];

  for (const { cat, rows } of byCategory) {
    const sentences = rows.map((r) => {
      const { interpretacao } = classifyIndicator(r.key, r.valor);
      const meta = INDICATOR_CATALOG.find((m) => m.key === r.key)!;
      const fmtVal = r.isPercent
        ? formatPercent(r.valor!)
        : r.isDays
        ? `${formatNumber(r.valor!, 1)} dias`
        : formatNumber(r.valor!, 2);
      return `${meta.nome} apurado em ${fmtVal}: ${interpretacao}`;
    });

    paragraphs.push(
      `${cat.label.toUpperCase()}: ${sentences.join(" ")}`
    );
  }

  const conclusao =
    "Do ponto de vista pericial, a análise deve considerar que a consolidação decorre de estrutura patrimonial extraída de arquivo no padrão SPED Contábil, com classificação por grupos patrimoniais e interpretação voltada ao exame da saúde econômico-financeira da entidade no período selecionado.";

  return paragraphs.join("\n\n") + "\n\n" + conclusao;
}

/* ============================================================
 * COMPONENTES DE RELATÓRIO — LAYOUT PADRONIZADO VERITAS
 * ============================================================ */

/* ── VERITAS REPORT PRIMITIVES ─────────────────────────────
   All classes follow the "vr-*" convention.
   Dark-navy table headers match the laudo previdenciário master
   layout so both documents share an identical visual identity.
   ─────────────────────────────────────────────────────────── */

function ReportShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="veritas-report-document mx-auto max-w-[1100px] bg-white text-slate-800 shadow-sm print:shadow-none print:max-w-full">
      {/* ── Barra de identidade institucional — navy Veritas ──── */}
      <div
        className="flex items-center justify-between px-8 py-3"
        style={{
          background: "linear-gradient(90deg, #0f2744 0%, #1e3a5f 100%)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z" fill="#60a5fa" />
              <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="text-[13px] font-extrabold uppercase tracking-widest text-white">
              VERITAS ANALYTICS
            </div>
            <div className="text-[9px] font-medium uppercase tracking-wider" style={{ color: "#93c5fd" }}>
              Sistema de Cálculos Judiciais Federais
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "#93c5fd" }}>
            Módulo Pericial
          </div>
          <div className="text-[11px] font-bold text-white">
            Análise de Balanços — SPED Contábil
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

function RomanSection({
  numeral,
  title,
  children,
  long = false,
}: {
  numeral: string;
  title: string;
  children: React.ReactNode;
  long?: boolean;
}) {
  return (
    <section className={`px-8 py-5 ${long ? "vr-section-long" : "vr-section"}`}>
      <div className="border-b-2 border-[#1e3a5f] pb-1.5 mb-4">
        <h2 className="text-[13px] font-bold tracking-widest text-[#1e3a5f] uppercase">
          {numeral} — {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function DataGrid({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-hidden border border-slate-300">
      <table className="min-w-full border-collapse text-[12px]">
        <thead className="vr-table-head">
          <tr style={{ backgroundColor: "#1e3a5f" }}>
            {headers.map((h) => (
              <th
                key={h}
                style={{ backgroundColor: "#1e3a5f", color: "#ffffff" }}
                className="border border-[#16304f] px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="bg-white">
              {row.map((cell, j) => (
                <td key={j} className="border border-slate-200 px-3 py-2 align-top text-[12px] text-slate-800 leading-[1.45]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportFooter({ dataEmissao }: { dataEmissao: string }) {
  return (
    <div className="vr-footer border-t-2 border-[#1e3a5f] px-8 py-3 text-[10px] text-slate-500 mt-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">
          Veritas Analytics — Plataforma de Cálculos Judiciais Federais · CJF 2025
        </span>
        <span>Documento gerado automaticamente em {dataEmissao}</span>
      </div>
      <div className="mt-0.5 text-center text-[10px] text-slate-400">
        Não dispensa análise profissional.
      </div>
    </div>
  );
}

function ReportHeader({
  info,
  structure,
  indicatorRows,
}: {
  info: EntityInfo;
  structure: ConsolidatedStructure;
  indicatorRows: IndicatorRow[];
}) {
  const { diag, diagBg, diagBorder, diagTxt } = useMemo(() => {
    const criticals = indicatorRows.filter((r) => r.classificacao === "Crítico").length;
    const warnings = indicatorRows.filter((r) => r.classificacao === "Atenção").length;
    const d =
      criticals >= 2
        ? "Situação crítica"
        : criticals >= 1 || warnings >= 2
        ? "Situação de atenção"
        : "Situação adequada";
    const bg   = d === "Situação adequada" ? "#f0fdf4" : d === "Situação crítica" ? "#fef2f2" : "#fffbeb";
    const bdr  = d === "Situação adequada" ? "#86efac" : d === "Situação crítica" ? "#fca5a5" : "#fcd34d";
    const txt  = d === "Situação adequada" ? "#15803d" : d === "Situação crítica" ? "#b91c1c" : "#b45309";
    return { diag: d, diagBg: bg, diagBorder: bdr, diagTxt: txt };
  }, [indicatorRows]);

  const ativoTotal   = structure.ativoCirculante + structure.ativoNaoCirculante;
  const passivoTotal = structure.passivoCirculante + structure.passivoNaoCirculante;

  return (
    <div className="vr-section px-8 pt-7 pb-6" style={{ borderBottom: "2px solid #1e3a5f" }}>

      {/* ── Linha institucional superior ─────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <div
            className="text-[14px] font-extrabold tracking-[0.18em] uppercase"
            style={{ color: "#1e3a5f" }}
          >
            VERITAS ANALYTICS
          </div>
          <div className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Plataforma de Cálculos Judiciais Federais
          </div>
        </div>
        <div className="text-right text-[11px] leading-[1.7] text-slate-600">
          <div>
            Emitido em:{" "}
            <strong className="text-slate-800">{info.dataEmissao}</strong>
          </div>
          <div>
            Usuário:{" "}
            <strong className="text-slate-800">{info.usuario || "—"}</strong>
          </div>
          <div className="mt-0.5 font-bold" style={{ color: "#1e3a5f" }}>
            CJF — Manual 2025
          </div>
        </div>
      </div>

      {/* ── Divisória ──────────────────────────────────────── */}
      <div className="my-4" style={{ height: "1px", backgroundColor: "#cbd5e1" }} />

      {/* ── Título + Chave ─────────────────────────────────── */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-[18px] font-extrabold leading-tight text-slate-900">
            Laudo de Análise Econômico-Financeira
          </div>
          <div className="mt-1 text-[13px] font-semibold text-slate-500">
            Módulo Pericial — SPED Contábil
          </div>
        </div>
        <div className="shrink-0 pt-1 text-right text-[11px] text-slate-500">
          <span className="font-semibold">Chave: </span>
          <span className="font-mono font-bold text-slate-800">{info.chaveRelatorio}</span>
        </div>
      </div>

      {/* ── Bloco identificador da entidade ─────────────────── */}
      {info.entidade && (
        <div
          className="mt-4 rounded px-4 py-3 text-[12px] leading-5"
          style={{ background: "#f8fafc", border: "1px solid #cbd5e1" }}
        >
          <span className="font-bold text-slate-700">Entidade analisada: </span>
          <span className="text-slate-800">{info.entidade}</span>
          {info.cnpj && (
            <span className="ml-4 text-slate-500">
              <span className="font-semibold">CNPJ:</span> {info.cnpj}
            </span>
          )}
          {info.periodoEscrituracao && (
            <span className="ml-4 text-slate-500">
              <span className="font-semibold">Período:</span> {info.periodoEscrituracao}
            </span>
          )}
        </div>
      )}

      {/* ── Cards síntese — 4 blocos padronizados ─────────── */}
      {/*
       * Layout rules (senior typography):
       * - All 4 cards share the same column width (grid-cols-4)
       * - Label area has a fixed min-height so cards align even when
       *   a label wraps (e.g. "PATRIMÔNIO LÍQUIDO" vs "ATIVO TOTAL")
       * - tracking-wide (not tracking-widest) keeps label from wrapping
       * - Value is always flush with the bottom of the label area
       */}
      <div className="mt-5 grid grid-cols-4 gap-3">
        {[
          { label: "ATIVO TOTAL",     val: formatBRL(ativoTotal),                  bg: "#f8fafc", border: "#dde3ea", txt: "#1e293b" },
          { label: "PASSIVO TOTAL",   val: formatBRL(passivoTotal),                bg: "#f8fafc", border: "#dde3ea", txt: "#1e293b" },
          { label: "PATRIM. LÍQUIDO", val: formatBRL(structure.patrimonioLiquido), bg: "#f8fafc", border: "#dde3ea", txt: "#1e293b" },
          { label: "DIAGNÓSTICO",     val: diag,                                   bg: diagBg,    border: diagBorder, txt: diagTxt  },
        ].map(({ label, val, bg, border, txt }) => (
          <div
            key={label}
            className="flex flex-col rounded px-4 py-3"
            style={{ background: bg, border: `1px solid ${border}`, minHeight: "68px" }}
          >
            <div
              className="text-[9px] font-bold uppercase tracking-wide"
              style={{ color: "#64748b", minHeight: "22px" }}
            >
              {label}
            </div>
            <div
              className="mt-auto text-[13px] font-extrabold leading-snug"
              style={{ color: txt }}
            >
              {val}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
 * COMPONENTE PRINCIPAL
 * ============================================================ */

export default function AnaliseBalanco() {
  const { user } = useAuth();
  const debitCredits = useDebitCredits();

  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/plans`, { headers: getAuthHeaders() });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
  });

  const planSlug: string | null = (plansData?.currentSubscription as any)?.slug ?? null;
  const eduPlan = isEducationalPlan(planSlug) && user?.role !== "admin";

  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [rawText, setRawText] = useState("");
  const [parsedContas, setParsedContas] = useState<ParsedConta[]>([]);
  const [entityInfo, setEntityInfo] = useState<EntityInfo>({
    entidade: "",
    cnpj: "",
    periodoEscrituracao: "",
    periodoSelecionado: "",
    numeroLivro: "",
    chaveRelatorio: generateKey(),
    usuario: user?.email ?? "",
    referenciaNormativa: "SPED Contábil / Estrutura patrimonial / Normas contábeis aplicáveis",
    arquivoOrigem: "",
    dataEmissao: nowBR(),
  });
  const [structure, setStructure] = useState<ConsolidatedStructure | null>(null);
  const [indicators, setIndicators] = useState<FinancialIndicators | null>(null);
  const [selectedIndicators, setSelectedIndicators] = useState<Set<IndicatorKey>>(
    new Set(ALL_INDICATOR_KEYS)
  );
  const [technicalAnalysis, setTechnicalAnalysis] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [balanceCheck, setBalanceCheck] = useState<BalanceCheck | null>(null);

  // ── Modo de entrada ──────────────────────────────────────────────────────────
  const [inputMode, setInputMode] = useState<"sped" | "manual">("sped");
  const [manualStructure, setManualStructure] = useState<ConsolidatedStructure>({
    ativoCirculante: 0, ativoNaoCirculante: 0, realizavelLongoPrazo: 0,
    imobilizado: 0, intangivel: 0, passivoCirculante: 0, passivoNaoCirculante: 0,
    patrimonioLiquido: 0, disponivel: 0, clientes: 0, estoques: 0, fornecedores: 0,
    lucroLiquido: 0, receitaLiquida: 0, custoMercadorias: 0,
  });
  const [manualEntityExtra, setManualEntityExtra] = useState({
    entidade: "", cnpj: "", periodo: "",
  });

  const indicatorRows = useMemo(
    () => (indicators ? buildIndicatorRows(indicators, selectedIndicators) : []),
    [indicators, selectedIndicators]
  );

  /* Auto-regenerate the technical analysis whenever the user changes
   * the indicator selection AFTER a file has already been processed.
   * This keeps Section V ("Análise Técnica") in sync with Section IV. */
  useEffect(() => {
    if (structure && indicatorRows.length > 0) {
      setTechnicalAnalysis(defaultTechnicalAnalysis(structure, indicatorRows));
    }
  }, [indicatorRows]);

  function toggleIndicator(key: IndicatorKey) {
    setSelectedIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleCategory(cat: typeof CATEGORIES[0]["key"]) {
    const catKeys = INDICATOR_CATALOG.filter((m) => m.category === cat).map((m) => m.key);
    const allSelected = catKeys.every((k) => selectedIndicators.has(k));
    setSelectedIndicators((prev) => {
      const next = new Set(prev);
      catKeys.forEach((k) => (allSelected ? next.delete(k) : next.add(k)));
      return next;
    });
  }

  async function handleProcessFile() {
    if (!file) return;
    const ok = await debitCredits(5, "Análise de Balanços");
    if (!ok) return;
    try {
      setStatus("processing");
      setErrorMessage("");
      const text = await extractTextFromPDF(file);
      const meta = extractEntityInfo(text, file.name);
      const contas = parseSpedBalanceFromText(text);
      const estrutura = consolidateStructure(contas);
      const inds = calculateIndicators(estrutura);
      setRawText(text);
      setParsedContas(contas);
      setStructure(estrutura);
      setIndicators(inds);
      setEntityInfo((prev) => ({
        ...prev,
        ...meta,
        usuario: prev.usuario || user?.email || "",
        chaveRelatorio: generateKey(),
        dataEmissao: nowBR(),
      }));
      const rows = buildIndicatorRows(inds, selectedIndicators);
      setTechnicalAnalysis(defaultTechnicalAnalysis(estrutura, rows));
      setBalanceCheck(validateBalance(estrutura));
      setStatus("success");
    } catch (error: any) {
      setStatus("error");
      setErrorMessage(error?.message || "Falha ao processar o arquivo. Verifique se é um PDF no padrão SPED Contábil.");
    }
  }

  async function handleManualCalculate() {
    const ok = await debitCredits(5, "Análise de Balanços (Manual)");
    if (!ok) return;
    try {
      setStatus("processing");
      setErrorMessage("");
      const estrutura: ConsolidatedStructure = {
        ...manualStructure,
        ativoNaoCirculante:
          manualStructure.realizavelLongoPrazo +
          manualStructure.imobilizado +
          manualStructure.intangivel,
      };
      const inds = calculateIndicators(estrutura);
      setStructure(estrutura);
      setIndicators(inds);
      const rows = buildIndicatorRows(inds, selectedIndicators);
      setTechnicalAnalysis(defaultTechnicalAnalysis(estrutura, rows));
      setBalanceCheck(validateBalance(estrutura));
      setEntityInfo((prev) => ({
        ...prev,
        entidade: manualEntityExtra.entidade || prev.entidade,
        cnpj: manualEntityExtra.cnpj || prev.cnpj,
        periodoEscrituracao: manualEntityExtra.periodo || prev.periodoEscrituracao,
        periodoSelecionado: manualEntityExtra.periodo || prev.periodoSelecionado,
        arquivoOrigem: "Entrada manual de dados",
        chaveRelatorio: generateKey(),
        dataEmissao: nowBR(),
        usuario: prev.usuario || user?.email || "",
      }));
      setStatus("success");
    } catch (error: any) {
      setStatus("error");
      setErrorMessage(error?.message || "Falha ao calcular os índices. Verifique os valores informados.");
    }
  }

  const reportReady = structure && indicators;

  function classBadge(cls: string) {
    return cls === "Crítico"
      ? "bg-red-100 text-red-700"
      : cls === "Atenção"
      ? "bg-amber-100 text-amber-800"
      : cls === "Adequado"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-slate-100 text-slate-600";
  }

  function formatIndicatorValue(row: IndicatorRow) {
    if (row.isDays) return formatDays(row.valor);
    if (row.isPercent) return formatPercent(row.valor);
    return formatNumber(row.valor, 4);
  }

  const emptyStructure: ConsolidatedStructure = {
    ativoCirculante: 0, ativoNaoCirculante: 0, realizavelLongoPrazo: 0, imobilizado: 0, intangivel: 0,
    passivoCirculante: 0, passivoNaoCirculante: 0, patrimonioLiquido: 0, disponivel: 0, clientes: 0,
    estoques: 0, fornecedores: 0, lucroLiquido: 0, receitaLiquida: 0, custoMercadorias: 0,
  };

  return (
    <div className="min-h-screen bg-slate-100 pt-16 print:pt-0 print:bg-white">
      <div className="mx-auto max-w-[1220px] space-y-6 px-4 py-8 print:max-w-full print:p-0">

        {/* ── PAINEL OPERACIONAL ─────────────────────────────── */}
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 print:hidden">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Análise de Balanços — SPED Contábil</h1>
              <p className="mt-1 text-sm text-slate-600">
                Importação de PDF SPED, consolidação patrimonial, 18 índices econômico-financeiros e laudo pericial padronizado CJF 2025.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-sm">
                <span className="font-semibold text-amber-800">5 créditos</span>
                <span className="text-amber-600"> por análise</span>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
                Status:{" "}
                <span className="font-semibold text-slate-900">
                  {status === "idle"
                  ? inputMode === "sped" ? "Aguardando arquivo" : "Preencha os campos"
                  : status === "processing" ? "Processando..." : status === "success" ? "Processado ✓" : "Erro"}
                </span>
              </div>
            </div>
          </div>

          {eduPlan && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <strong>Plano Educacional:</strong> relatórios gerados incluem marca d'água educacional. Créditos resetam mensalmente.
            </div>
          )}

          {/* ── VALIDAÇÃO DA EQUAÇÃO PATRIMONIAL ── */}
          {balanceCheck && status === "success" && (
            <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              balanceCheck.balanced
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-300 bg-amber-50 text-amber-800"
            }`}>
              <div className="flex flex-wrap items-start gap-x-6 gap-y-1">
                <div className="font-semibold">
                  {balanceCheck.balanced
                    ? "✓ Equação patrimonial verificada"
                    : "⚠ Desequilíbrio patrimonial detectado"}
                </div>
                <div className="text-xs mt-0.5 space-x-4">
                  <span>Ativo Total: <strong>{formatBRL(balanceCheck.ativoTotal)}</strong></span>
                  <span>Passivo + PL: <strong>{formatBRL(balanceCheck.passivoMaisPL)}</strong></span>
                  <span>Diferença: <strong>{formatBRL(balanceCheck.diffAbs)}</strong>
                    {" "}(<strong>{balanceCheck.diffPct.toFixed(2)}%</strong>)</span>
                </div>
              </div>
              {!balanceCheck.balanced && (
                <p className="mt-2 text-xs leading-relaxed">
                  A extração do SPED pode não ter capturado todas as rubricas do balanço. Verifique
                  se o PDF está no padrão SPED Contábil (com códigos de conta visíveis) ou utilize
                  o modo <strong>Digitar manualmente</strong> para inserir os saldos corretos.
                </p>
              )}
            </div>
          )}

          {/* ── TOGGLE DE MODO ── */}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => { setInputMode("sped"); setStatus("idle"); setErrorMessage(""); setBalanceCheck(null); }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                inputMode === "sped"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Upload className="h-4 w-4" />
              Importar SPED PDF
            </button>
            <button
              type="button"
              onClick={() => { setInputMode("manual"); setStatus("idle"); setErrorMessage(""); setBalanceCheck(null); }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                inputMode === "manual"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <PenLine className="h-4 w-4" />
              Digitar manualmente
            </button>
          </div>

          {/* ── MODO SPED: upload + campos comuns ── */}
          {inputMode === "sped" && (
            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-700">Arquivo PDF (SPED Contábil)</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Usuário responsável</label>
                <input
                  value={entityInfo.usuario}
                  onChange={(e) => setEntityInfo((prev) => ({ ...prev, usuario: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Referência normativa</label>
                <input
                  value={entityInfo.referenciaNormativa}
                  onChange={(e) => setEntityInfo((prev) => ({ ...prev, referenciaNormativa: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                />
              </div>
            </div>
          )}

          {/* ── MODO MANUAL: formulário completo ── */}
          {inputMode === "manual" && (
            <div className="mt-5 space-y-6">
              {/* Dados da entidade */}
              <div>
                <p className="mb-3 text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-1">Dados da Entidade</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="lg:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Razão Social / Entidade</label>
                    <input value={manualEntityExtra.entidade} onChange={(e) => setManualEntityExtra((p) => ({ ...p, entidade: e.target.value }))} placeholder="Nome da empresa ou entidade" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">CNPJ</label>
                    <input value={manualEntityExtra.cnpj} onChange={(e) => setManualEntityExtra((p) => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Período de referência</label>
                    <input value={manualEntityExtra.periodo} onChange={(e) => setManualEntityExtra((p) => ({ ...p, periodo: e.target.value }))} placeholder="01/01/2024 a 31/12/2024" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Responsável técnico</label>
                    <input value={entityInfo.usuario} onChange={(e) => setEntityInfo((prev) => ({ ...prev, usuario: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div className="lg:col-span-3">
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Referência normativa</label>
                    <input value={entityInfo.referenciaNormativa} onChange={(e) => setEntityInfo((prev) => ({ ...prev, referenciaNormativa: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              {/* Balanço Patrimonial */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Ativo */}
                <div>
                  <p className="mb-3 text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-1">Ativo</p>
                  <div className="space-y-2">
                    {([
                      ["ativoCirculante",         "Ativo Circulante (total)", false],
                      ["disponivel",              "↳ Disponível",            true],
                      ["clientes",                "↳ Clientes / Créditos",   true],
                      ["estoques",                "↳ Estoques",              true],
                      ["realizavelLongoPrazo",    "Realizável a LP",         false],
                      ["imobilizado",             "Imobilizado",             false],
                      ["intangivel",              "Intangível",              false],
                    ] as [keyof ConsolidatedStructure, string, boolean][]).map(([key, label, indented]) => (
                      <div key={key} className={`flex items-center gap-3 ${indented ? "pl-4" : ""}`}>
                        <label className={`w-48 shrink-0 text-xs ${indented ? "text-slate-500" : "font-semibold text-slate-700"}`}>{label}</label>
                        <input
                          type="number"
                          step="0.01"
                          value={manualStructure[key] || ""}
                          onChange={(e) => setManualStructure((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                          placeholder="0,00"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-right font-mono"
                        />
                      </div>
                    ))}
                    <div className="flex items-center gap-3 border-t border-slate-200 pt-2">
                      <span className="w-48 shrink-0 text-xs font-bold text-slate-800">ANC computado</span>
                      <span className="w-full px-3 py-2 text-sm text-right font-mono font-semibold text-slate-600 bg-slate-50 rounded-xl border border-slate-200">
                        {(manualStructure.realizavelLongoPrazo + manualStructure.imobilizado + manualStructure.intangivel).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Passivo e PL */}
                <div>
                  <p className="mb-3 text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-1">Passivo e PL</p>
                  <div className="space-y-2">
                    {([
                      ["passivoCirculante",       "Passivo Circulante (total)", false],
                      ["fornecedores",            "↳ Fornecedores",            true],
                      ["passivoNaoCirculante",    "Passivo Não Circulante",    false],
                      ["patrimonioLiquido",       "Patrimônio Líquido",        false],
                    ] as [keyof ConsolidatedStructure, string, boolean][]).map(([key, label, indented]) => (
                      <div key={key} className={`flex items-center gap-3 ${indented ? "pl-4" : ""}`}>
                        <label className={`w-48 shrink-0 text-xs ${indented ? "text-slate-500" : "font-semibold text-slate-700"}`}>{label}</label>
                        <input
                          type="number"
                          step="0.01"
                          value={manualStructure[key] || ""}
                          onChange={(e) => setManualStructure((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                          placeholder="0,00"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-right font-mono"
                        />
                      </div>
                    ))}
                  </div>

                  {/* DRE */}
                  <p className="mt-5 mb-3 text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-1">DRE — Demonstração do Resultado <span className="text-xs font-normal text-slate-400 normal-case">(opcional — para índices de rentabilidade)</span></p>
                  <div className="space-y-2">
                    {([
                      ["receitaLiquida",          "Receita Líquida"],
                      ["custoMercadorias",        "CMV / CPV / CSP"],
                      ["lucroLiquido",            "Resultado do Exercício"],
                    ] as [keyof ConsolidatedStructure, string][]).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-3">
                        <label className="w-48 shrink-0 text-xs font-semibold text-slate-700">{label}</label>
                        <input
                          type="number"
                          step="0.01"
                          value={manualStructure[key] || ""}
                          onChange={(e) => setManualStructure((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                          placeholder="0,00"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-right font-mono"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── BOTÕES DE AÇÃO ── */}
          <div className="mt-6 flex flex-wrap gap-3">
            {inputMode === "sped" ? (
              <button
                onClick={handleProcessFile}
                disabled={!file || status === "processing"}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {status === "processing" ? "Processando..." : "Processar SPED (5 créditos)"}
              </button>
            ) : (
              <button
                onClick={handleManualCalculate}
                disabled={status === "processing"}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {status === "processing" ? "Calculando..." : "Calcular índices (5 créditos)"}
              </button>
            )}
            <button
              onClick={() => window.print()}
              disabled={!reportReady}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Imprimir / Salvar PDF
            </button>
            {reportReady && inputMode === "sped" && (
              <button
                onClick={() => setShowRaw(!showRaw)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                {showRaw ? "Ocultar dados brutos" : "Ver dados extraídos"}
              </button>
            )}
          </div>

          {errorMessage && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}
        </div>

        {/* ── SELEÇÃO DE ÍNDICES (checkboxes) ───────────────── */}
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 print:hidden">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Índices a calcular</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Selecione os índices econômico-financeiros que devem ser incluídos no relatório.{" "}
                <span className="font-semibold text-slate-700">{selectedIndicators.size} de {INDICATOR_CATALOG.length} selecionados.</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedIndicators(new Set(ALL_INDICATOR_KEYS))}
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Marcar todos
              </button>
              <button
                type="button"
                onClick={() => setSelectedIndicators(new Set())}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
              >
                Desmarcar todos
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {CATEGORIES.map((cat) => {
              const catItems = INDICATOR_CATALOG.filter((m) => m.category === cat.key);
              const allSel = catItems.every((m) => selectedIndicators.has(m.key));
              const someSel = catItems.some((m) => selectedIndicators.has(m.key));
              return (
                <div key={cat.key} className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-slate-800">{cat.label}</div>
                      <div className="mt-0.5 text-[11px] leading-4 text-slate-500">{cat.description}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat.key)}
                      className={`mt-0.5 shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold ${
                        allSel
                          ? "bg-slate-900 text-white"
                          : someSel
                          ? "bg-slate-200 text-slate-700"
                          : "border border-slate-200 text-slate-500"
                      }`}
                    >
                      {allSel ? "Todos ✓" : someSel ? "Parcial" : "Nenhum"}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {catItems.map((meta) => (
                      <label
                        key={meta.key}
                        className="flex cursor-pointer items-start gap-2.5 rounded-xl px-2 py-1.5 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIndicators.has(meta.key)}
                          onChange={() => toggleIndicator(meta.key)}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-slate-900"
                        />
                        <span className="leading-tight">
                          <span className="block text-[12px] font-semibold text-slate-800">{meta.label}</span>
                          <span className="block text-[11px] text-slate-400">{meta.formula}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── EDIÇÃO DA ANÁLISE TÉCNICA ─────────────────────── */}
        {reportReady && (
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 print:hidden">
            <h3 className="text-base font-bold text-slate-900 mb-1">Análise Técnico-Contábil</h3>
            <p className="text-xs text-slate-500 mb-3">Texto gerado automaticamente. Edite conforme necessário antes de imprimir.</p>
            <textarea
              value={technicalAnalysis}
              onChange={(e) => setTechnicalAnalysis(e.target.value)}
              rows={6}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 leading-7 resize-y"
            />
          </div>
        )}

        {/* ── DADOS EXTRAÍDOS (debug) ────────────────────────── */}
        {showRaw && reportReady && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 print:hidden">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-base font-bold text-slate-900">Contas extraídas ({parsedContas.length})</h3>
              <div className="mt-4 max-h-[360px] overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-[12px]">
                  <thead className="sticky top-0 bg-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Descrição</th>
                      <th className="px-3 py-2 text-left">Grupo</th>
                      <th className="px-3 py-2 text-right">Saldo Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedContas.map((c, i) => (
                      <tr key={i} className="border-t border-slate-200">
                        <td className="px-3 py-2">{c.descricao}</td>
                        <td className="px-3 py-2">{c.grupo}</td>
                        <td className="px-3 py-2 text-right">{formatBRL(c.saldoFinal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-base font-bold text-slate-900">Texto bruto extraído</h3>
              <p className="mt-1 text-xs text-slate-500">Para depuração e homologação do parser.</p>
              <textarea value={rawText} readOnly className="mt-4 h-[320px] w-full rounded-xl border border-slate-300 p-3 text-[11px] text-slate-700" />
            </div>
          </div>
        )}

        {/* ── RELATÓRIO PERICIAL ─────────────────────────────── */}
        <ReportShell>
          {eduPlan && (
            <div className="border-b-4 border-blue-400 bg-blue-50 px-8 py-3 text-center text-xs font-bold uppercase tracking-widest text-blue-700 print:block">
              DOCUMENTO EDUCACIONAL — VERITAS ANALYTICS — USO EXCLUSIVO ACADÊMICO
            </div>
          )}

          <ReportHeader
            info={entityInfo}
            structure={structure || emptyStructure}
            indicatorRows={indicatorRows}
          />

          {/* I — Identificação */}
          <RomanSection numeral="I" title="Identificação da Análise">
            <DataGrid
              headers={["Campo", "Informação"]}
              rows={[
                ["Entidade", entityInfo.entidade || "—"],
                ["CNPJ", entityInfo.cnpj || "—"],
                ["Período da escrituração", entityInfo.periodoEscrituracao || "—"],
                ["Período selecionado", entityInfo.periodoSelecionado || "—"],
                ["Número do livro", entityInfo.numeroLivro || "—"],
                ["Arquivo importado", entityInfo.arquivoOrigem || "—"],
                ["Responsável pela análise", entityInfo.usuario || "—"],
                ["Referência normativa", entityInfo.referenciaNormativa || "—"],
                ["Chave do relatório", entityInfo.chaveRelatorio || "—"],
              ]}
            />
          </RomanSection>

          {/* II — Base e Metodologia */}
          <RomanSection numeral="II" title="Base Contábil e Metodologia">
            <div className="space-y-3 text-[12px] leading-6 text-slate-700">
              <p>
                A presente análise foi elaborada a partir de arquivo importado em formato PDF no padrão do{" "}
                <strong>SPED Contábil</strong>, com leitura automatizada da estrutura do balanço patrimonial, identificação das contas
                relevantes e consolidação dos principais grupos patrimoniais.
              </p>
              <p>
                A classificação observou a arquitetura contábil do demonstrativo, com destaque para{" "}
                <strong>ativo circulante</strong>, <strong>ativo não circulante</strong>, <strong>passivo circulante</strong>,{" "}
                <strong>passivo não circulante</strong> e <strong>patrimônio líquido</strong>. Quando disponível, os dados da{" "}
                <strong>demonstração do resultado do exercício (DRE)</strong> foram utilizados para cálculo dos índices de
                rentabilidade e atividade.
              </p>
              <p>
                Para os {selectedIndicators.size} índices selecionados, foram utilizadas fórmulas clássicas de análise
                econômico-financeira, com interpretação orientada a contexto pericial. A automação não substitui a validação técnica
                do perito, especialmente em situações com rubricas atípicas, saldos negativos ou necessidade de reconciliação com
                notas explicativas.
              </p>
            </div>
          </RomanSection>

          {/* III — Estrutura Patrimonial */}
          <RomanSection numeral="III" title="Estrutura Patrimonial Consolidada">
            <DataGrid
              headers={["Grupo patrimonial", "Valor consolidado"]}
              rows={[
                ["Ativo Circulante", formatBRL(structure?.ativoCirculante)],
                ["Ativo Não Circulante", formatBRL(structure?.ativoNaoCirculante)],
                [<span className="ml-4 text-slate-500">↳ Realizável a Longo Prazo</span>, formatBRL(structure?.realizavelLongoPrazo)],
                [<span className="ml-4 text-slate-500">↳ Imobilizado</span>, formatBRL(structure?.imobilizado)],
                [<span className="ml-4 text-slate-500">↳ Intangível</span>, formatBRL(structure?.intangivel)],
                [<strong>Ativo Total</strong>, <strong>{formatBRL((structure?.ativoCirculante ?? 0) + (structure?.ativoNaoCirculante ?? 0))}</strong>],
                ["", ""],
                ["Passivo Circulante", formatBRL(structure?.passivoCirculante)],
                ["Passivo Não Circulante", formatBRL(structure?.passivoNaoCirculante)],
                [<strong>Passivo Total</strong>, <strong>{formatBRL((structure?.passivoCirculante ?? 0) + (structure?.passivoNaoCirculante ?? 0))}</strong>],
                ["", ""],
                [<strong>Patrimônio Líquido</strong>, <strong>{formatBRL(structure?.patrimonioLiquido)}</strong>],
                ["", ""],
                ["Disponível", formatBRL(structure?.disponivel)],
                ["Clientes / Créditos a Receber", formatBRL(structure?.clientes)],
                ["Estoques", formatBRL(structure?.estoques)],
                ["Fornecedores", formatBRL(structure?.fornecedores)],
                ...((structure?.receitaLiquida ?? 0) > 0
                  ? [
                      ["Receita Líquida (DRE)", formatBRL(structure?.receitaLiquida)],
                      ["Custo das Mercadorias / Serviços (DRE)", formatBRL(structure?.custoMercadorias)],
                      ["Resultado do Exercício (DRE)", formatBRL(structure?.lucroLiquido)],
                    ]
                  : [["Dados de DRE", "Não identificados no arquivo"]]),
              ]}
            />
          </RomanSection>

          {/* IV — Índices */}
          <RomanSection long numeral="IV" title={`Índices Econômico-Financeiros Apurados (${indicatorRows.length} índice${indicatorRows.length !== 1 ? "s" : ""})`}>
            {indicatorRows.length === 0 ? (
              <div className="rounded border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Nenhum índice selecionado. Marque ao menos um índice no painel de seleção.
              </div>
            ) : (
              <>
                {CATEGORIES.map((cat) => {
                  const catRows = indicatorRows.filter((r) =>
                    INDICATOR_CATALOG.find((m) => m.key === r.key)?.category === cat.key
                  );
                  if (!catRows.length) return null;
                  return (
                    <div key={cat.key} className="mb-6 vr-section">
                      <div
                        className="mb-2 px-1 py-0.5 text-[10.5px] font-bold uppercase tracking-widest"
                        style={{ color: "#1e3a5f", borderLeft: "3px solid #1e3a5f", paddingLeft: "8px" }}
                      >
                        {cat.label}
                      </div>
                      <DataGrid
                        headers={["Índice", "Fórmula", "Valor apurado", "Interpretação pericial", "Classificação"]}
                        rows={catRows.map((row) => [
                          <span className="font-semibold text-slate-900">{row.nome}</span>,
                          <span className="text-slate-500 text-[11px]">{row.formula}</span>,
                          <span className="font-mono font-bold text-slate-900">{formatIndicatorValue(row)}</span>,
                          <span className="text-[12px]">{row.interpretacao}</span>,
                          <span
                            key={row.key}
                            className="inline-flex rounded px-2 py-0.5 text-[10.5px] font-bold"
                            style={
                              row.classificacao === "Crítico"
                                ? { background: "#fee2e2", color: "#b91c1c" }
                                : row.classificacao === "Atenção"
                                ? { background: "#fef3c7", color: "#92400e" }
                                : row.classificacao === "Adequado"
                                ? { background: "#dcfce7", color: "#15803d" }
                                : { background: "#f1f5f9", color: "#475569" }
                            }
                          >
                            {row.classificacao}
                          </span>,
                        ])}
                      />
                    </div>
                  );
                })}
              </>
            )}
          </RomanSection>

          {/* V — Análise técnica */}
          <RomanSection numeral="V" title="Análise Técnico-Contábil">
            <div className="rounded border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="whitespace-pre-wrap text-[12px] leading-7 text-slate-700">
                {technicalAnalysis || "A análise técnica será gerada automaticamente após processar o arquivo."}
              </p>
            </div>
          </RomanSection>

          {/* VI — Conclusão */}
          <RomanSection numeral="VI" title="Conclusão Pericial / Diagnóstico">
            <div className="space-y-3 text-[12px] leading-6 text-slate-700">
              <p>
                Com base na estrutura patrimonial consolidada e nos {indicatorRows.length} índices apurados, conclui-se que o
                diagnóstico econômico-financeiro da entidade deve ser lido em conjunto com a natureza das rubricas, a qualidade dos
                registros importados e a finalidade da perícia.
              </p>
              <p>
                Os indicadores de liquidez e endividamento constituem sinais objetivos relevantes, mas não esgotam a análise.
                Recomenda-se, quando necessário, confronto com demonstração do resultado, fluxo de caixa, notas explicativas e
                documentação auxiliar.
              </p>
            </div>
          </RomanSection>

          {/* VII — Obs. Técnicas */}
          <RomanSection numeral="VII" title="Observações Técnicas">
            <div className="rounded border border-slate-200 bg-slate-50 px-4 py-4 text-[12px] leading-6 text-slate-600">
              <p>
                Relatório gerado pela Plataforma Veritas Analytics em conformidade com o Manual de Orientação de Procedimentos para
                os Cálculos na Justiça Federal (CJF, 2025).
              </p>
              <p className="mt-2">
                Metodologia: extração automatizada do PDF, parser contábil estruturado, consolidação de grupos patrimoniais, cálculo
                de {INDICATOR_CATALOG.length} índices econômico-financeiros disponíveis e análise técnico-contábil. Foram incluídos
                no presente relatório {indicatorRows.length} índice(s) selecionado(s) pelo usuário.
              </p>
              <p className="mt-2">
                A automação auxilia a leitura e a organização dos dados, mas não dispensa a validação profissional do perito,
                especialmente em casos com contas atípicas, compensações, saldos invertidos ou necessidade de reclassificação
                técnica.
              </p>
              <p className="mt-2">Emitido em {entityInfo.dataEmissao}. Não dispensa análise profissional.</p>
            </div>
          </RomanSection>

          <ReportFooter dataEmissao={entityInfo.dataEmissao} />
        </ReportShell>
      </div>
    </div>
  );
}
