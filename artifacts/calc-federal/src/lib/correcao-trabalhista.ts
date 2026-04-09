/**
 * Motor compartilhado de atualização monetária trabalhista
 * ─────────────────────────────────────────────────────────
 * Regra EC 113/2021 / ADC 58 STF (Trabalhista pós-2021):
 *   Fase 1 → IPCA-E acumulado: do dia de vencimento até o dia do ajuizamento
 *   Fase 2 → SELIC acumulada : do ajuizamento até a liquidação/pagamento
 *   (SELIC substitui correção + juros; não há juros autônomos na Fase 2)
 *
 * Fontes:
 *   IPCA-E: IBGE/BCB  — variação mensal (%)
 *   SELIC:  BCB SGS    — taxa acumulada mensal (%)
 */

// ─── Tabela IPCA-E mensal (% a.m.) ──────────────────────────────────────────

export const TABELA_IPCAE: Readonly<Record<string, number>> = {
  "2013-01":0.86,"2013-02":0.60,"2013-03":0.47,"2013-04":0.55,"2013-05":0.37,"2013-06":0.44,
  "2013-07":0.03,"2013-08":0.24,"2013-09":0.62,"2013-10":0.54,"2013-11":0.54,"2013-12":0.78,
  "2014-01":0.78,"2014-02":0.69,"2014-03":0.92,"2014-04":0.67,"2014-05":0.41,"2014-06":0.40,
  "2014-07":0.21,"2014-08":0.25,"2014-09":0.43,"2014-10":0.48,"2014-11":0.49,"2014-12":0.78,
  "2015-01":0.82,"2015-02":1.22,"2015-03":1.32,"2015-04":0.99,"2015-05":0.59,"2015-06":0.68,
  "2015-07":0.59,"2015-08":0.45,"2015-09":0.54,"2015-10":0.82,"2015-11":1.01,"2015-12":0.96,
  "2016-01":1.12,"2016-02":1.20,"2016-03":0.97,"2016-04":0.62,"2016-05":0.78,"2016-06":0.35,
  "2016-07":0.46,"2016-08":0.44,"2016-09":0.08,"2016-10":0.26,"2016-11":0.14,"2016-12":0.21,
  "2017-01":0.24,"2017-02":0.36,"2017-03":0.39,"2017-04":0.14,"2017-05":-0.04,"2017-06":-0.20,
  "2017-07":-0.26,"2017-08":0.19,"2017-09":0.17,"2017-10":0.23,"2017-11":0.28,"2017-12":0.54,
  "2018-01":0.32,"2018-02":0.07,"2018-03":0.18,"2018-04":0.22,"2018-05":0.55,"2018-06":1.32,
  "2018-07":0.16,"2018-08":-0.06,"2018-09":0.48,"2018-10":0.45,"2018-11":-0.21,"2018-12":0.29,
  "2019-01":0.36,"2019-02":0.43,"2019-03":0.75,"2019-04":0.57,"2019-05":0.35,"2019-06":0.01,
  "2019-07":0.19,"2019-08":0.11,"2019-09":0.19,"2019-10":0.24,"2019-11":0.17,"2019-12":1.22,
  "2020-01":0.71,"2020-02":0.28,"2020-03":0.07,"2020-04":-0.51,"2020-05":-0.38,"2020-06":0.02,
  "2020-07":0.36,"2020-08":0.30,"2020-09":0.94,"2020-10":0.86,"2020-11":0.89,"2020-12":1.35,
  "2021-01":0.78,"2021-02":0.97,"2021-03":0.93,"2021-04":1.19,"2021-05":0.44,"2021-06":1.02,
  "2021-07":0.96,"2021-08":1.07,"2021-09":1.17,"2021-10":1.20,"2021-11":0.95,"2021-12":0.86,
  "2022-01":0.54,"2022-02":1.06,"2022-03":1.62,"2022-04":1.06,"2022-05":0.69,"2022-06":1.38,
  "2022-07":0.13,"2022-08":-0.61,"2022-09":0.41,"2022-10":0.59,"2022-11":0.45,"2022-12":0.54,
  "2023-01":0.53,"2023-02":0.99,"2023-03":0.71,"2023-04":0.57,"2023-05":0.51,"2023-06":-0.08,
  "2023-07":0.28,"2023-08":0.12,"2023-09":0.26,"2023-10":0.24,"2023-11":0.33,"2023-12":0.56,
  "2024-01":0.42,"2024-02":0.83,"2024-03":0.43,"2024-04":0.44,"2024-05":0.46,"2024-06":0.39,
  "2024-07":0.30,"2024-08":0.44,"2024-09":0.44,"2024-10":0.56,"2024-11":0.39,"2024-12":0.34,
  "2025-01":0.16,"2025-02":1.31,"2025-03":0.43,"2025-04":0.22,"2025-05":0.30,
};

// ─── Tabela SELIC acumulada mensal (% a.m.) — BCB SGS ────────────────────────

export const TABELA_SELIC: Readonly<Record<string, number>> = {
  "2013-01":0.60,"2013-02":0.49,"2013-03":0.55,"2013-04":0.60,"2013-05":0.60,"2013-06":0.61,
  "2013-07":0.72,"2013-08":0.71,"2013-09":0.70,"2013-10":0.81,"2013-11":0.72,"2013-12":0.79,
  "2014-01":0.85,"2014-02":0.82,"2014-03":0.78,"2014-04":0.82,"2014-05":0.87,"2014-06":0.82,
  "2014-07":0.95,"2014-08":0.87,"2014-09":0.91,"2014-10":0.95,"2014-11":0.84,"2014-12":0.96,
  "2015-01":0.93,"2015-02":0.83,"2015-03":1.04,"2015-04":0.95,"2015-05":0.99,"2015-06":1.07,
  "2015-07":1.18,"2015-08":1.11,"2015-09":1.11,"2015-10":1.11,"2015-11":1.06,"2015-12":1.16,
  "2016-01":1.06,"2016-02":1.00,"2016-03":1.16,"2016-04":1.06,"2016-05":1.11,"2016-06":1.16,
  "2016-07":1.11,"2016-08":1.22,"2016-09":1.11,"2016-10":1.05,"2016-11":1.04,"2016-12":1.12,
  "2017-01":1.09,"2017-02":0.87,"2017-03":1.05,"2017-04":0.79,"2017-05":0.93,"2017-06":0.81,
  "2017-07":0.80,"2017-08":0.74,"2017-09":0.64,"2017-10":0.64,"2017-11":0.57,"2017-12":0.54,
  "2018-01":0.58,"2018-02":0.47,"2018-03":0.53,"2018-04":0.52,"2018-05":0.52,"2018-06":0.52,
  "2018-07":0.53,"2018-08":0.57,"2018-09":0.47,"2018-10":0.54,"2018-11":0.49,"2018-12":0.49,
  "2019-01":0.54,"2019-02":0.49,"2019-03":0.47,"2019-04":0.52,"2019-05":0.54,"2019-06":0.47,
  "2019-07":0.57,"2019-08":0.50,"2019-09":0.48,"2019-10":0.54,"2019-11":0.38,"2019-12":0.37,
  "2020-01":0.38,"2020-02":0.29,"2020-03":0.34,"2020-04":0.28,"2020-05":0.24,"2020-06":0.21,
  "2020-07":0.19,"2020-08":0.16,"2020-09":0.16,"2020-10":0.16,"2020-11":0.15,"2020-12":0.16,
  "2021-01":0.15,"2021-02":0.15,"2021-03":0.20,"2021-04":0.21,"2021-05":0.27,"2021-06":0.29,
  "2021-07":0.35,"2021-08":0.43,"2021-09":0.44,"2021-10":0.48,"2021-11":0.59,"2021-12":0.73,
  "2022-01":0.73,"2022-02":0.76,"2022-03":0.92,"2022-04":0.83,"2022-05":1.03,"2022-06":1.18,
  "2022-07":1.17,"2022-08":1.21,"2022-09":1.07,"2022-10":0.77,"2022-11":1.02,"2022-12":1.12,
  "2023-01":1.12,"2023-02":0.94,"2023-03":1.11,"2023-04":0.96,"2023-05":1.00,"2023-06":1.00,
  "2023-07":0.87,"2023-08":1.11,"2023-09":0.99,"2023-10":0.92,"2023-11":0.92,"2023-12":0.90,
  "2024-01":0.97,"2024-02":0.80,"2024-03":1.09,"2024-04":0.89,"2024-05":0.83,"2024-06":1.07,
  "2024-07":1.07,"2024-08":1.00,"2024-09":0.96,"2024-10":0.91,"2024-11":1.27,"2024-12":1.20,
  "2025-01":1.17,"2025-02":1.14,"2025-03":1.16,"2025-04":1.12,"2025-05":1.21,
};

// ─── Fallback para meses sem dado (estimativa conservadora) ──────────────────

const IPCAE_FALLBACK = 0.35;
const SELIC_FALLBACK = 1.00;

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export interface VerbaInput {
  id: string;
  descricao: string;
  valorNominal: number;
  /** "YYYY-MM" — competência/mês de vencimento da verba */
  competencia: string;
  /** "YYYY-MM-DD" — data exata de vencimento (usada para determinar o YM de início) */
  dataVencimento: string;
}

export interface MesMemoria {
  ym: string;
  taxaPct: number;
  fatorParcial: number;
  fatorAcumulado: number;
}

export interface FaseResult {
  deYM: string;
  ateYM: string;
  meses: number;
  fator: number;
  taxaAcumuladaPct: number;
  memoria: MesMemoria[];
}

export interface VerbaCorrecaoResult {
  id: string;
  descricao: string;
  competencia: string;
  dataVencimento: string;
  valorNominal: number;
  faseIpcaE: FaseResult;
  faseSelic: FaseResult;
  fatorTotal: number;
  valorAtualizado: number;
  acrescimo: number;
  percentualAcrescimo: number;
}

export interface TotaisCorrecao {
  valorNominalTotal: number;
  valorAtualizadoTotal: number;
  acrescimoTotal: number;
  percentualMedioAcrescimo: number;
  fatorMedioIPCAE: number;
  fatorMedioSELIC: number;
}

export interface CorrecaoResult {
  verbas: VerbaCorrecaoResult[];
  totais: TotaisCorrecao;
  dataAjuizamento: string;
  dataFinalLiquidacao: string;
}

// ─── Utilitários internos ────────────────────────────────────────────────────

function r6(n: number) { return Math.round(n * 1_000_000) / 1_000_000; }
function r2(n: number) { return Math.round(n * 100) / 100; }

/** Converte "YYYY-MM-DD" → "YYYY-MM" */
function toYM(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** Próximo mês no formato "YYYY-MM" */
function proxMes(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * Monta memória mês a mês entre [fromYM, toYM[ usando a tabela fornecida.
 * Aplica produto encadeado e retorna o fator acumulado final.
 */
function acumularFase(
  fromYM: string,
  toYM: string,
  tabela: Readonly<Record<string, number>>,
  fallback: number,
): FaseResult {
  const memoria: MesMemoria[] = [];
  let fator = 1;
  let cur = fromYM;

  while (cur < toYM) {
    const taxaPct = tabela[cur] ?? fallback;
    const fatorParcial = 1 + taxaPct / 100;
    fator = r6(fator * fatorParcial);
    memoria.push({ ym: cur, taxaPct, fatorParcial, fatorAcumulado: fator });
    cur = proxMes(cur);
  }

  const meses = memoria.length;
  const taxaAcumuladaPct = r6((fator - 1) * 100);

  return { deYM: fromYM, ateYM: toYM, meses, fator: r6(fator), taxaAcumuladaPct, memoria };
}

// ─── Função principal exportada ───────────────────────────────────────────────

/**
 * Calcula a atualização monetária trabalhista (EC 113/2021) para uma lista de verbas.
 *
 * @param verbas               Lista de verbas com competência e valor nominal
 * @param dataAjuizamento      Data de ajuizamento (petição inicial) — "YYYY-MM-DD"
 * @param dataFinalLiquidacao  Data de referência do pagamento/liquidação — "YYYY-MM-DD"
 */
export function calcularCorrecaoTrabalhista(
  verbas: VerbaInput[],
  dataAjuizamento: string,
  dataFinalLiquidacao: string,
): CorrecaoResult {
  const ymAjuizamento = toYM(dataAjuizamento);
  const ymLiquidacao = toYM(dataFinalLiquidacao);

  const resultVerbas: VerbaCorrecaoResult[] = verbas.map((v) => {
    const ymVenc = toYM(v.dataVencimento || `${v.competencia}-01`);

    // Fase 1: IPCA-E do vencimento até o ajuizamento
    const ymIpcaFim = ymVenc < ymAjuizamento ? ymAjuizamento : ymVenc;
    const faseIpcaE = ymVenc < ymAjuizamento
      ? acumularFase(ymVenc, ymAjuizamento, TABELA_IPCAE, IPCAE_FALLBACK)
      : { deYM: ymVenc, ateYM: ymVenc, meses: 0, fator: 1, taxaAcumuladaPct: 0, memoria: [] };

    // Valor já corrigido pelo IPCA-E
    const valorAposIpcaE = r6(v.valorNominal * faseIpcaE.fator);

    // Fase 2: SELIC do ajuizamento até a liquidação
    const ymSelicInicio = ymAjuizamento > ymVenc ? ymAjuizamento : ymVenc;
    const faseSelic = ymSelicInicio < ymLiquidacao
      ? acumularFase(ymSelicInicio, ymLiquidacao, TABELA_SELIC, SELIC_FALLBACK)
      : { deYM: ymSelicInicio, ateYM: ymSelicInicio, meses: 0, fator: 1, taxaAcumuladaPct: 0, memoria: [] };

    const valorAtualizado = r2(valorAposIpcaE * faseSelic.fator);
    const fatorTotal = r6(faseIpcaE.fator * faseSelic.fator);
    const acrescimo = r2(valorAtualizado - v.valorNominal);
    const percentualAcrescimo = v.valorNominal > 0
      ? r2((fatorTotal - 1) * 100)
      : 0;

    return {
      id: v.id,
      descricao: v.descricao,
      competencia: v.competencia,
      dataVencimento: v.dataVencimento || `${v.competencia}-01`,
      valorNominal: v.valorNominal,
      faseIpcaE,
      faseSelic,
      fatorTotal,
      valorAtualizado,
      acrescimo,
      percentualAcrescimo,
    };
  });

  // Totais
  const valorNominalTotal = r2(resultVerbas.reduce((s, v) => s + v.valorNominal, 0));
  const valorAtualizadoTotal = r2(resultVerbas.reduce((s, v) => s + v.valorAtualizado, 0));
  const acrescimoTotal = r2(valorAtualizadoTotal - valorNominalTotal);
  const percentualMedioAcrescimo = valorNominalTotal > 0
    ? r2((acrescimoTotal / valorNominalTotal) * 100)
    : 0;
  const fatorMedioIPCAE = resultVerbas.length > 0
    ? r6(resultVerbas.reduce((s, v) => s + v.faseIpcaE.fator, 0) / resultVerbas.length)
    : 1;
  const fatorMedioSELIC = resultVerbas.length > 0
    ? r6(resultVerbas.reduce((s, v) => s + v.faseSelic.fator, 0) / resultVerbas.length)
    : 1;

  return {
    verbas: resultVerbas,
    totais: {
      valorNominalTotal,
      valorAtualizadoTotal,
      acrescimoTotal,
      percentualMedioAcrescimo,
      fatorMedioIPCAE,
      fatorMedioSELIC,
    },
    dataAjuizamento,
    dataFinalLiquidacao,
  };
}

// ─── Helpers utilitários ──────────────────────────────────────────────────────

/** Formata número como moeda BRL */
export function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Formata fator como "1,XXXXXX" */
export function fmtFator(f: number) {
  return f.toLocaleString("pt-BR", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
}

/** Formata percentual */
export function fmtPct(p: number) {
  return `${p.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
}

/** Formata YYYY-MM como "mmm/AAAA" */
export function fmtYM(ym: string) {
  if (!ym || ym.length < 7) return ym;
  const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  const m = parseInt(ym.slice(5, 7)) - 1;
  return `${meses[m] ?? ym.slice(5, 7)}/${ym.slice(0, 4)}`;
}
