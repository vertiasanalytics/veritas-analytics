/**
 * Catálogo de índices históricos sem API governamental online estruturada.
 *
 * ORTN, OTN, BTN e IRSM são índices pré-Real amplamente utilizados em
 * cálculos judiciais (especialmente B_conv — fator de conversão de moedas
 * anteriores ao Real).  Embora os dados históricos existam em publicações
 * do BCB e do IBGE, não há endpoint de API online que exponha as variações
 * mensais percentuais em formato estruturado.
 *
 * Este módulo descreve o catálogo dessas séries (metadados, fundamentação
 * legal, links de fonte) sem inventar valores numéricos.
 *
 * Fonte primária de referência:
 *   Banco Central do Brasil — Circular nº 2.868/1999 (tabela de índices)
 *   Manual de Cálculos da Justiça Federal — CJF 1ª edição 2025
 */

export type SourceType =
  | "official_online"       // API oficial de órgão governamental disponível
  | "official_documental"   // Publicação oficial (circular, portaria) sem API
  | "no_official_api";      // Sem fonte governamental online estruturada

export interface HistoricalIndexCatalogue {
  key: string;
  name: string;
  fullName: string;
  description: string;
  sourceType: SourceType;
  source: string;
  sourceUrl: string | null;
  legislation: string;
  useCase: string;
  startPeriod: string;
  endPeriod: string;
  periodicidade: string;
  engineRole: string;
  observacao: string;
}

export const HISTORICAL_CATALOGUE: HistoricalIndexCatalogue[] = [
  {
    key: "ORTN",
    name: "ORTN",
    fullName: "Obrigações Reajustáveis do Tesouro Nacional",
    description:
      "Título público criado em 1964 e extinto em 1986 com a criação da OTN. " +
      "Sua variação mensal era definida pelo Governo Federal como indexador oficial da economia.",
    sourceType: "no_official_api",
    source: "Banco Central do Brasil — Tabela histórica / IpeaData",
    sourceUrl: "https://www.ipeadata.gov.br/ExibeSerie.aspx?serid=38389",
    legislation:
      "Lei 4.357/1964 · Decreto 57.820/1966 · Decreto-lei 2.284/1986 (extinção)",
    useCase:
      "Correção monetária em ações condenatórias com parcelas anteriores a março/1986 " +
      "(moedas Cr$ e NCr$). Corresponde ao fator B_conv no motor de cálculo.",
    startPeriod: "1964-03",
    endPeriod: "1986-02",
    periodicidade: "Mensal",
    engineRole:
      "B_conv (fator de conversão monetária de Cr$/NCr$ para BRL). " +
      "Os valores acumulados estão embarcados no motor via tabela de moedas.",
    observacao:
      "Série histórica disponível em IpeaData e publicações BCB — " +
      "sem endpoint de API online com variação mensal percentual estruturada. " +
      "Integração manual via base normativa validada internamente.",
  },
  {
    key: "OTN",
    name: "OTN",
    fullName: "Obrigações do Tesouro Nacional",
    description:
      "Substituiu a ORTN em março/1986 (Plano Cruzado). Extinta em janeiro/1989 com a criação do BTN.",
    sourceType: "no_official_api",
    source: "Banco Central do Brasil — Circular nº 2.868/1999",
    sourceUrl: "https://www.bcb.gov.br/pre/normativos/busca/normativo.asp?numero=2868&tipo=Circular&data=1999-12-21",
    legislation:
      "Decreto-lei 2.284/1986 (Plano Cruzado) · Decreto-lei 2.290/1986 · Lei 7.730/1989 (extinção)",
    useCase:
      "Correção monetária em ações condenatórias com parcelas de mar/1986 a jan/1989 " +
      "(moeda NCz$ — Cruzado). Corresponde ao fator B_conv no motor de cálculo.",
    startPeriod: "1986-03",
    endPeriod: "1989-01",
    periodicidade: "Mensal",
    engineRole:
      "B_conv (fator de conversão de NCz$ para BRL). " +
      "Valores acumulados embarcados no motor via tabela de moedas.",
    observacao:
      "Série documental oficial BCB (Circular 2.868/1999) — " +
      "sem endpoint de API online com variação mensal percentual. " +
      "Integração manual via base normativa validada internamente.",
  },
  {
    key: "BTN",
    name: "BTN",
    fullName: "Bônus do Tesouro Nacional",
    description:
      "Criado em fevereiro/1989 (Plano Verão) e extinto em março/1991 (Plano Collor). " +
      "Era o principal indexador de contratos e débitos judiciais nesse período.",
    sourceType: "no_official_api",
    source: "Banco Central do Brasil — SGS série 185 (valor nominal) / Circular nº 2.868/1999",
    sourceUrl: "https://www.bcb.gov.br/dados/serie/bcdata.sgs.185/dados",
    legislation:
      "Lei 7.730/1989 (Plano Verão) · MP 168/1990 (Plano Collor) · Lei 8.177/1991 (extinção e substituição pela TR)",
    useCase:
      "Correção monetária em ações condenatórias com parcelas de fev/1989 a fev/1991 " +
      "(moeda NCz$, depois Cr$). Corresponde ao fator B_conv no motor de cálculo.",
    startPeriod: "1989-02",
    endPeriod: "1991-02",
    periodicidade: "Mensal",
    engineRole:
      "B_conv (fator de conversão de Cr$ para BRL). " +
      "Valores acumulados embarcados no motor via tabela de moedas.",
    observacao:
      "BCB SGS série 185 retorna o valor NOMINAL do BTN (não a variação percentual mensal), " +
      "impossibilitando uso direto via API. Série histórica validada disponível na Circular BCB 2.868/1999.",
  },
  {
    key: "IRSM",
    name: "IRSM",
    fullName: "Índice de Reajuste do Salário Mínimo",
    description:
      "Índice criado para reajuste do salário mínimo. Utilizado como indexador de débitos judiciais " +
      "trabalhistas e previdenciários no período de fevereiro/1992 a janeiro/1993.",
    sourceType: "no_official_api",
    source: "IBGE / Dieese — publicação histórica",
    sourceUrl: "https://www.ibge.gov.br/estatisticas/economicas/precos-custos-e-indices-de-precos.html",
    legislation:
      "Lei 8.178/1991 · Lei 8.222/1991 · Lei 8.419/1992 · MP 342/1993 (extinção — substituído pela URV)",
    useCase:
      "Correção monetária em ações trabalhistas e previdenciárias com parcelas de fev/1992 a jan/1993 " +
      "(período de alta inflação — Cr$). Corresponde ao fator B_conv no motor de cálculo.",
    startPeriod: "1992-02",
    endPeriod: "1993-01",
    periodicidade: "Mensal",
    engineRole:
      "B_conv (fator de conversão de Cr$ para BRL). " +
      "Valores acumulados embarcados no motor via tabela de moedas.",
    observacao:
      "IBGE não disponibiliza a série IRSM em endpoint SIDRA acessível via API. " +
      "Dados históricos validados internamente conforme Manual de Cálculos CJF 2025.",
  },
];

/** Retorna o catálogo completo de índices históricos sem API online */
export function getHistoricalCatalogue(): HistoricalIndexCatalogue[] {
  return HISTORICAL_CATALOGUE;
}
