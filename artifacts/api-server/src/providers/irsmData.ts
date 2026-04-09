/**
 * irsmData.ts — Dados históricos do IRSM (IBGE)
 *
 * Fonte: IBGE, Diretoria de Pesquisas, Departamento de Índices de Preços,
 *        Sistema Nacional de Índices de Preços ao Consumidor.
 *
 * Coluna "coefEmReal" = Número Índice (base: DEZ/1993 = 100) conforme tabela IBGE.
 *
 * Meses sem publicação direta (arbitração governamental):
 *   Jun/92, Jul/92, Ago/92 → 23,27%, 21,01%, 23,14% (Portaria 478/1992).
 *   Mai/93, Jun/93          → 28,39%, 30,34% (arbitrados).
 *   Set/92 e Jul/93 são os meses residuais calculados por subtração.
 *
 * Período de vigência judicial: fev/1992 a jan/1993 (Manual CJF 2025).
 * Tabela cobre dez/1991 a jun/1994 para referência completa.
 */

export interface IrsmRecord {
  periodo:    string;   // YYYY-MM
  coefEmReal: number;   // Número Índice IBGE (dez/93 = 100)
  fonteDoc:   string;
  nota?:      string;
}

const FONTE = "IBGE — IRSM Série Histórica (dez/93=100)";

export const IRSM_RECORDS: IrsmRecord[] = [
  // ── 1991 ─────────────────────────────────────────────────────────────────
  { periodo: "1991-12", coefEmReal: 0.308196, fonteDoc: FONTE },

  // ── 1992 ─────────────────────────────────────────────────────────────────
  { periodo: "1992-01", coefEmReal: 0.388080, fonteDoc: FONTE },
  { periodo: "1992-02", coefEmReal: 0.494285, fonteDoc: FONTE },
  { periodo: "1992-03", coefEmReal: 0.610783, fonteDoc: FONTE },
  { periodo: "1992-04", coefEmReal: 0.736897, fonteDoc: FONTE },
  { periodo: "1992-05", coefEmReal: 0.906959, fonteDoc: FONTE },
  {
    periodo: "1992-06", coefEmReal: +(0.906959 * 1.2327).toFixed(6), fonteDoc: FONTE,
    nota: "Variação de 23,27% arbitrada pelo governo (Portaria 478/1992)",
  },
  {
    periodo: "1992-07", coefEmReal: +(0.906959 * 1.2327 * 1.2101).toFixed(6), fonteDoc: FONTE,
    nota: "Variação de 21,01% arbitrada pelo governo (Portaria 478/1992)",
  },
  {
    periodo: "1992-08", coefEmReal: +(0.906959 * 1.2327 * 1.2101 * 1.2314).toFixed(6), fonteDoc: FONTE,
    nota: "Variação de 23,14% arbitrada pelo governo (Portaria 478/1992)",
  },
  {
    periodo: "1992-09", coefEmReal: 2.034248, fonteDoc: FONTE,
    nota: "IRSM residual: 22,10% — IBGE apurou 124,29% acumulado mai-set; deduzidos os arbitrados (83,69%)",
  },
  { periodo: "1992-10", coefEmReal: 2.564376, fonteDoc: FONTE },
  { periodo: "1992-11", coefEmReal: 3.200092, fonteDoc: FONTE },
  { periodo: "1992-12", coefEmReal: 3.949563, fonteDoc: FONTE },

  // ── 1993 ─────────────────────────────────────────────────────────────────
  { periodo: "1993-01", coefEmReal: 5.051888, fonteDoc: FONTE },
  { periodo: "1993-02", coefEmReal: 6.359810, fonteDoc: FONTE },
  { periodo: "1993-03", coefEmReal: 8.068696, fonteDoc: FONTE },
  { periodo: "1993-04", coefEmReal: 10.348114, fonteDoc: FONTE },
  {
    periodo: "1993-05", coefEmReal: +(10.348114 * 1.2839).toFixed(6), fonteDoc: FONTE,
    nota: "Variação de 28,39% arbitrada pelo governo",
  },
  {
    periodo: "1993-06", coefEmReal: +(10.348114 * 1.2839 * 1.3034).toFixed(6), fonteDoc: FONTE,
    nota: "Variação de 30,34% arbitrada pelo governo",
  },
  {
    periodo: "1993-07", coefEmReal: 22.384001, fonteDoc: FONTE,
    nota: "IRSM residual: 29,26% — IBGE apurou 116,31% acumulado mai-jul; deduzidos os arbitrados (67,34%)",
  },
  { periodo: "1993-08", coefEmReal: 29.596128, fonteDoc: FONTE },
  { periodo: "1993-09", coefEmReal: 40.005079, fonteDoc: FONTE },
  { periodo: "1993-10", coefEmReal: 53.974866, fonteDoc: FONTE },
  { periodo: "1993-11", coefEmReal: 72.806692, fonteDoc: FONTE },
  { periodo: "1993-12", coefEmReal: 100.000000, fonteDoc: FONTE },

  // ── 1994 ─────────────────────────────────────────────────────────────────
  { periodo: "1994-01", coefEmReal: 140.250000, fonteDoc: FONTE },
  { periodo: "1994-02", coefEmReal: 195.890000, fonteDoc: FONTE },
  { periodo: "1994-03", coefEmReal: 287.510000, fonteDoc: FONTE },
  { periodo: "1994-04", coefEmReal: 403.780000, fonteDoc: FONTE },
  { periodo: "1994-05", coefEmReal: 576.400000, fonteDoc: FONTE },
  { periodo: "1994-06", coefEmReal: 829.040000, fonteDoc: FONTE },
];
