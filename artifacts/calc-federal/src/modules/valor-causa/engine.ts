/**
 * engine.ts — Motor de cálculo do Valor da Causa Previdenciária
 *
 * Módulo: Cálculo do Valor da Causa (art. 292 CPC + Lei 8.213/91)
 * Metodologia: CJF 2025 — Manual de Cálculos da Justiça Federal
 *
 * ⚠ FUNÇÕES PURAS — zero dependências de React, DOM ou chamadas à API.
 *   Todos os dados externos (taxas, índices) devem ser passados como argumentos.
 *
 * Migração incremental: estas funções foram extraídas de pages/valor-causa.tsx.
 * A página importa daqui e continua funcionando como camada de orquestração visual.
 */

import {
  toYM, nextYM, prevYM, addMonthsD, monthStart, monthLabel, monthsBetweenInclusive,
  parseIso, fatorAcumulado, getSalarioMinimo, r2, fmtR,
} from "@/lib/engines/dateUtils";

import type {
  Contribuicao, EvolucaoMes, ParcelaVencida, DecimoMainItem,
  SB80Result, ResolveCtx, ResolveResult, ItemCalculo, ResultadoCalculo,
  FormState,
} from "./types";

import type { DcCompetencia, DcLinhaResultado, DcDecimoItem } from "./utils";

// Helpers de data/formatação re-exportados via utils.ts (não duplicar aqui)

// ─────────────────────────────────────────────────────────────────────────────
// Evolução mensal do benefício com reajuste anual (art. 41-A Lei 8.213/91)
//
// Regra: no mês aniversário da DIB de cada ano subsequente, o valor base é
// reajustado pelo INPC acumulado dos 12 meses anteriores ao mês-aniversário.
// ─────────────────────────────────────────────────────────────────────────────

export function buildBenefitEvolution(
  rmi: number,
  dib: Date,
  ajuiz: Date,
  corrMap: Map<string, number>,
  origemInicial = "RMI inicial",
): EvolucaoMes[] {
  const ajuizYM  = toYM(ajuiz);
  const dibMes   = dib.getMonth() + 1;
  const dibAno   = dib.getFullYear();
  const result: EvolucaoMes[] = [];
  let valorBase  = rmi;
  let origemAtual = origemInicial;

  let cur = dib;
  while (toYM(cur) <= ajuizYM) {
    const ym   = toYM(cur);
    const moCur = cur.getMonth() + 1;
    const yrCur = cur.getFullYear();
    let reajPct = "—";

    if (moCur === dibMes && yrCur > dibAno && corrMap.size > 0) {
      const fromAcum  = prevYM(ym, 13);
      const endAcum   = prevYM(ym, 1);
      const fatorAnual = fatorAcumulado(corrMap, fromAcum, endAcum);
      valorBase = r2(valorBase * fatorAnual);
      const pct = ((fatorAnual - 1) * 100).toFixed(2).replace(".", ",");
      reajPct = `+${pct}%`;
      origemAtual = `Reajuste anual ${yrCur} (+${pct}%)`;
    }

    result.push({ ym, valorBase, origemValorBase: origemAtual, reajustePct: reajPct });
    cur = addMonthsD(cur, 1);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Regra dos 80% melhores salários de contribuição (art. 29, Lei 8.213/91)
// ─────────────────────────────────────────────────────────────────────────────

export function calcSB80(contribuicoes: Contribuicao[]): SB80Result {
  const validas    = contribuicoes.filter((c) => c.valor > 0);
  if (validas.length === 0) {
    return { validas, ordenadas: [], melhores80: [], excluidas20: [], nManter: 0, nExcluir: 0, sbEstimado: 0 };
  }
  const ordenadas   = [...validas].sort((a, b) => b.valor - a.valor);
  const nExcluir    = Math.floor(validas.length * 0.20);
  const nManter     = validas.length - nExcluir;
  const melhores80  = ordenadas.slice(0, nManter);
  const excluidas20 = ordenadas.slice(nManter);
  const soma        = melhores80.reduce((s, c) => s + c.valor, 0);
  const sbEstimado  = r2(soma / melhores80.length);
  return { validas, ordenadas, melhores80, excluidas20, nManter, nExcluir, sbEstimado };
}

// ─────────────────────────────────────────────────────────────────────────────
// Motor principal: resolve a evolução do valor base conforme natureza/situação
// ─────────────────────────────────────────────────────────────────────────────

export function resolveBaseEvolution(ctx: ResolveCtx): ResolveResult {
  const ajuizYM = toYM(ctx.ajuiz);

  // ── RURAL: piso legal = salário mínimo vigente ────────────────────────────
  if (ctx.natureza === "rural") {
    const evolucao: EvolucaoMes[] = [];
    let cur     = ctx.dib;
    let lastSM  = 0;
    while (toYM(cur) <= ajuizYM) {
      const ym  = toYM(cur);
      const sm  = getSalarioMinimo(ym);
      const mudou = sm !== lastSM;
      const origem = mudou && lastSM > 0
        ? `Salário mínimo da competência (reaj. ${fmtR(sm)})`
        : "Salário mínimo da competência";
      lastSM = sm;
      evolucao.push({
        ym, valorBase: sm, origemValorBase: origem,
        reajustePct: mudou && lastSM > 0 ? "reaj. SM" : "—",
      });
      cur = addMonthsD(cur, 1);
    }
    return {
      evolucao,
      badgeBase: "Base rural — piso legal",
      metodologiaBase: "Para segurado rural, foi utilizado o salário mínimo vigente em cada competência (piso legal rural), conforme tabela histórica de vigências.",
      temAlertaSubsidiario: false,
    };
  }

  // ── URBANO — benefício concedido: RMI + reajuste anual ───────────────────
  if (ctx.situacao === "concedido") {
    const evolucao = buildBenefitEvolution(ctx.rmi, ctx.dib, ctx.ajuiz, ctx.inpcMap, "RMI inicial");
    return {
      evolucao,
      badgeBase: "Base urbana — RMI do benefício",
      metodologiaBase: "Para segurado urbano com benefício já concedido, foi utilizada a RMI informada como valor base inicial, com aplicação dos reajustes anuais previdenciários (INPC acumulado 12 meses antes do mês-aniversário da DIB), conforme art. 41-A da Lei 8.213/91.",
      temAlertaSubsidiario: false,
    };
  }

  // ── URBANO — concessão + contribuições → regra dos 80% ───────────────────
  if (ctx.situacao === "concessao" && ctx.origemBase === "contribuicoes") {
    const sb80 = calcSB80(ctx.contribuicoes);
    if (sb80.validas.length > 0) {
      const { sbEstimado, nManter, nExcluir, validas } = sb80;
      const rmiEstimada  = r2(sbEstimado * ctx.coeficiente);
      const evolucaoBase = buildBenefitEvolution(rmiEstimada, ctx.dib, ctx.ajuiz, ctx.inpcMap, "RMI estimada por contribuições");
      const evolucao = evolucaoBase.map((e) => ({
        ...e,
        origemValorBase: e.origemValorBase === "RMI inicial" ? "RMI estimada por contribuições" : e.origemValorBase,
      }));
      const descExcl = nExcluir > 0
        ? ` Foram descartados os ${nExcluir} menor${nExcluir > 1 ? "es" : ""} salário${nExcluir > 1 ? "s" : ""} (${Math.round(nExcluir / validas.length * 100)}%).`
        : " Todos os salários foram aproveitados (n < 5 — regra mínima).";
      return {
        evolucao,
        badgeBase: "Base urbana — RMI estimada (80% melhores)",
        metodologiaBase: `Para segurado urbano em ação de concessão, foi calculada a RMI estimada com base nos ${nManter} maiores salários de contribuição (regra dos 80% — art. 29, Lei 8.213/91), de um total de ${validas.length} informados.${descExcl} SB estimado = ${fmtR(sbEstimado)}, coeficiente ${(ctx.coeficiente * 100).toFixed(0)}%, RMI estimada = ${fmtR(rmiEstimada)}. O valor base foi propagado com reajustes anuais previdenciários.`,
        temAlertaSubsidiario: false,
        rmiEstimada,
        sbEstimado,
      };
    }
    // Sem contribuições válidas → subsidiário automático
    return resolveSubsidiario(ctx.dib, ajuizYM, "Salário mínimo subsidiário por ausência de prova contributiva",
      "Não foram informados salários de contribuição válidos. Adotado subsidiariamente o salário mínimo vigente em cada competência como critério de base de cálculo, conforme regra de subsidiariedade.");
  }

  // ── URBANO — concessão + subsidiário (opção explícita) ───────────────────
  if (ctx.situacao === "concessao" && ctx.origemBase === "subsidiario") {
    return resolveSubsidiario(ctx.dib, ajuizYM, "Salário mínimo subsidiário por ausência de prova contributiva",
      "Adotado subsidiariamente o salário mínimo vigente em cada competência, por ausência de histórico contributivo mínimo ou por opção técnica fundamentada.");
  }

  // ── URBANO — concessão + RMI manual ──────────────────────────────────────
  const evolucao = buildBenefitEvolution(ctx.rmi, ctx.dib, ctx.ajuiz, ctx.inpcMap, "RMI estimada informada");
  return {
    evolucao,
    badgeBase: "Base urbana — RMI informada",
    metodologiaBase: "Para segurado urbano em ação de concessão, foi utilizada a RMI informada manualmente como estimativa do valor do benefício, com aplicação dos reajustes anuais previdenciários.",
    temAlertaSubsidiario: false,
  };
}

function resolveSubsidiario(dib: Date, ajuizYM: string, origem: string, metodologia: string): ResolveResult {
  const evolucao: EvolucaoMes[] = [];
  let cur = dib;
  while (toYM(cur) <= ajuizYM) {
    const ym = toYM(cur);
    evolucao.push({ ym, valorBase: getSalarioMinimo(ym), origemValorBase: origem, reajustePct: "—" });
    cur = addMonthsD(cur, 1);
  }
  return { evolucao, badgeBase: "Base subsidiária — salário mínimo", metodologiaBase: metodologia, temAlertaSubsidiario: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 13º salário integrado nas parcelas vencidas
//
// Regra da quinzena (art. 71 do Dec. 3.048/99):
//   DIB.dia ≤ 15 → primeiro mês conta integralmente
//   DIB.dia > 15 → proporcional (dias restantes / dias do mês)
// Para os demais anos, todos os meses do período são contados integralmente.
// ─────────────────────────────────────────────────────────────────────────────

export function calcDecimosMain(
  dib: Date,
  ajuiz: Date,
  evoMap: Map<string, EvolucaoMes>,
  corrMap: Map<string, number>,
  fallbackRmi: number,
): DecimoMainItem[] {
  const ajuizYM    = toYM(ajuiz);
  const anoInicio  = dib.getFullYear();
  const anoFim     = ajuiz.getFullYear();
  const dibDay     = dib.getDate();

  const fracaoPrimeiro = dibDay <= 15
    ? 1
    : Math.max(0, (new Date(dib.getFullYear(), dib.getMonth() + 1, 0).getDate() - dibDay + 1)
        / new Date(dib.getFullYear(), dib.getMonth() + 1, 0).getDate());

  const result: DecimoMainItem[] = [];

  for (let ano = anoInicio; ano <= anoFim; ano++) {
    const yearStartDate = ano === anoInicio ? monthStart(dib)       : new Date(ano, 0, 1);
    const yearEndDate   = ano === anoFim    ? monthStart(ajuiz)      : new Date(ano, 11, 1);

    if (yearEndDate < yearStartDate) continue;

    const meses = (yearEndDate.getFullYear() - yearStartDate.getFullYear()) * 12
      + yearEndDate.getMonth() - yearStartDate.getMonth() + 1;
    if (meses <= 0) continue;

    const mesesCons = ano === anoInicio ? (meses - 1) + fracaoPrimeiro : meses;
    if (mesesCons <= 0) continue;

    const decYM  = `${ano}-12`;
    const refYM  = decYM <= ajuizYM ? decYM : ajuizYM;
    const ev     = evoMap.get(refYM);
    const beneficioBase  = ev?.valorBase ?? fallbackRmi;
    const fatorCorrecao  = corrMap.size > 0
      ? r2(fatorAcumulado(corrMap, refYM, ajuizYM) * 1_000_000) / 1_000_000
      : 1;
    const valorBase      = r2((beneficioBase / 12) * mesesCons);
    const valorCorrigido = r2(valorBase * fatorCorrecao);

    result.push({ ano, refYM, beneficioBase, mesesConsiderados: r2(mesesCons), valorBase, fatorCorrecao, valorCorrigido });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parcelas de benefício recebido (para abatimento)
// ─────────────────────────────────────────────────────────────────────────────

export function calcParcelasRmiReal(
  rmi: number,
  dibAbatimento: Date,
  dataInicio: string,
  dataFim: string,
  ajuiz: Date,
  corrMap: Map<string, number>,
): ParcelaVencida[] {
  if (!rmi || !dataInicio || !dataFim) return [];
  const ini  = parseIso(dataInicio);
  const fim  = parseIso(dataFim);
  const qtd  = Math.max(monthsBetweenInclusive(ini, fim), 0);
  const ajuizYM = toYM(ajuiz);
  const evo  = buildBenefitEvolution(rmi, dibAbatimento, ajuiz, corrMap);
  const evoM = new Map(evo.map((e) => [e.ym, e]));
  const out: ParcelaVencida[] = [];

  for (let i = 0; i < qtd; i++) {
    const comp  = addMonthsD(monthStart(ini), i);
    const compYM = toYM(comp);
    const ev    = evoM.get(compYM);
    const valorBase      = ev?.valorBase ?? rmi;
    const origemValorBase = ev?.origemValorBase ?? "RMI inicial";
    const fator = corrMap.size > 0 ? r2(fatorAcumulado(corrMap, compYM, ajuizYM) * 1_000_000) / 1_000_000 : 1;
    out.push({
      competencia: monthLabel(comp), valorBase, origemValorBase,
      reajustePrevPct: ev?.reajustePct ?? "—",
      fatorCorrecao: fator, valorCorrigido: r2(valorBase * fator),
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Calcula valor total de um item de abatimento/crédito
// ─────────────────────────────────────────────────────────────────────────────

export function calcItem(
  item: ItemCalculo,
  ajuiz: Date,
  corrMap: Map<string, number>,
): number {
  if (item.tipo === "beneficio_recebido") {
    const dibAbt  = item.dataInicio ? parseIso(item.dataInicio) : ajuiz;
    const parcelas = calcParcelasRmiReal(item.rmi ?? 0, dibAbt, item.dataInicio ?? "", item.dataFim ?? "", ajuiz, corrMap);
    return r2(parcelas.reduce((s, p) => s + p.valorCorrigido, 0));
  }
  return r2((item.valor ?? 0) + (item.juros ?? 0) + (item.selic ?? 0));
}

// ─────────────────────────────────────────────────────────────────────────────
// Monta as parcelas vencidas completas (meses + 13ºs intercalados)
// ─────────────────────────────────────────────────────────────────────────────

export function buildParcelasComDecimos(
  evolucao: EvolucaoMes[],
  corrMap: Map<string, number>,
  dib: Date,
  ajuiz: Date,
  rmi: number,
  incluir13o: boolean,
): ParcelaVencida[] {
  const ajuizYM = toYM(ajuiz);
  const evoMap  = new Map(evolucao.map((e) => [e.ym, e]));

  // Parcelas mensais normais
  const mensais: ParcelaVencida[] = evolucao.map((ev) => {
    const fator = corrMap.size > 0
      ? r2(fatorAcumulado(corrMap, ev.ym, ajuizYM) * 1_000_000) / 1_000_000
      : 1;
    return {
      competencia: monthLabel(new Date(ev.ym + "-01")),
      valorBase: ev.valorBase,
      origemValorBase: ev.origemValorBase,
      reajustePrevPct: ev.reajustePct,
      fatorCorrecao: fator,
      valorCorrigido: r2(ev.valorBase * fator),
    };
  });

  if (!incluir13o) return mensais;

  // 13ºs intercalados após dezembro de cada ano
  const decimos = calcDecimosMain(dib, ajuiz, evoMap, corrMap, rmi);
  const decimoByAno = new Map(decimos.map((d) => [d.ano, d]));

  const result: ParcelaVencida[] = [];
  for (let i = 0; i < mensais.length; i++) {
    result.push(mensais[i]);
    const ev     = evolucao[i];
    const anoEv  = parseInt(ev.ym.slice(0, 4));
    const mesEv  = parseInt(ev.ym.slice(5, 7));
    const decimo = decimoByAno.get(anoEv);
    if (mesEv === 12 && decimo) {
      result.push({
        competencia: `13º/${anoEv}`,
        valorBase: decimo.valorBase,
        origemValorBase: `13º salário ${anoEv} — ${r2(decimo.mesesConsiderados)} avos`,
        reajustePrevPct: "—",
        fatorCorrecao: decimo.fatorCorrecao,
        valorCorrigido: decimo.valorCorrigido,
        is13o: true,
        detalhes13o: `Ref.: ${decimo.refYM} | Base: ${fmtR(decimo.beneficioBase)} | Avos: ${r2(decimo.mesesConsiderados)}/12`,
      });
    }
    // 13º do último ano (se não terminar em dezembro)
    if (i === mensais.length - 1 && mesEv !== 12 && decimo) {
      const jaInserido = result.some((p) => p.is13o && p.competencia === `13º/${anoEv}`);
      if (!jaInserido) {
        result.push({
          competencia: `13º/${anoEv}`,
          valorBase: decimo.valorBase,
          origemValorBase: `13º salário ${anoEv} (proporcional) — ${r2(decimo.mesesConsiderados)} avos`,
          reajustePrevPct: "—",
          fatorCorrecao: decimo.fatorCorrecao,
          valorCorrigido: decimo.valorCorrigido,
          is13o: true,
          detalhes13o: `Ref.: ${decimo.refYM} | Base: ${fmtR(decimo.beneficioBase)} | Avos: ${r2(decimo.mesesConsiderados)}/12`,
        });
      }
    }
  }
  return result;
}

// validateValorCausaInput foi movido para ./validators.ts

// ─────────────────────────────────────────────────────────────────────────────
// Painel 13º Salário — parsing e cálculo via CSV de competências
//
// Formato CSV: MM/AAAA;valorOriginal;abatimentos;fatorCorrecao
// Tipos: DcCompetencia | DcLinhaResultado | DcDecimoItem  (definidos em utils.ts)
// ─────────────────────────────────────────────────────────────────────────────

/** @internal Ordena competências MM/AAAA numericamente (jan-primeiro). */
function dcCompToNum(comp: string): number {
  const [m, y] = comp.trim().split("/");
  return Number(y) * 100 + Number(m);
}

/** @internal Parse de número BR com vírgula decimal. Lança se inválido. */
function dcParseBR(s: string, ctxLinha: number): number {
  const n = Number(s.trim().replace(/\./g, "").replace(",", "."));
  if (isNaN(n)) throw new Error(`Número inválido na linha ${ctxLinha}: ${s}`);
  return n;
}

/**
 * Faz o parse estrito de uma linha CSV de competência (lança mensagem amigável ao usuário).
 * Uso: `texto.split("\n").map((l, i) => dcParseLine(l, i))`
 */
export function dcParseLine(linha: string, idx: number): DcCompetencia {
  const p = linha.split(";").map((s) => s.trim());
  if (p.length < 4)
    throw new Error(`Linha ${idx + 1} inválida. Formato: MM/AAAA;valorOriginal;abatimentos;fatorCorrecao`);
  const [ms, ys] = p[0].split("/").map(Number);
  if (!ms || !ys || ms < 1 || ms > 12)
    throw new Error(`Competência inválida na linha ${idx + 1}: ${p[0]}`);
  return {
    competencia:   p[0],
    valorOriginal: dcParseBR(p[1], idx + 1),
    abatimentos:   dcParseBR(p[2], idx + 1),
    fatorCorrecao: dcParseBR(p[3], idx + 1),
  };
}

/**
 * Fração do primeiro mês de benefício conforme a regra da quinzena
 * (art. 71 Dec. 3.048/99): início ≤ dia 15 → integral; acima → proporcional.
 */
export function dcFracaoPrimeiroMes(dataInicio: string): number {
  if (!dataInicio) return 1;
  const dt = new Date(`${dataInicio}T00:00:00`);
  if (isNaN(dt.getTime())) throw new Error("Data de início inválida.");
  const dia = dt.getDate();
  if (dia <= 15) return 1;
  const ultimoDia = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  return Math.max(0, Math.min(1, (ultimoDia - dia + 1) / ultimoDia));
}

/** Quantos meses de um dado `ano` estão dentro do intervalo [dataInicio, dataFim]. */
export function dcMesesAnoNoPeriodo(ano: number, dataInicio: string, dataFim: string): number {
  const ini = new Date(`${dataInicio}T00:00:00`);
  const fim = new Date(`${dataFim}T00:00:00`);
  if (isNaN(ini.getTime()) || isNaN(fim.getTime())) return 0;
  const eIni = ini > new Date(ano, 0, 1)  ? ini : new Date(ano, 0, 1);
  const eFim = fim < new Date(ano, 11, 31) ? fim : new Date(ano, 11, 31);
  if (eFim < eIni) return 0;
  return eFim.getMonth() - eIni.getMonth() + 1;
}

/**
 * Calcula os 13ºs salários intercalados a partir de uma lista de competências CSV.
 * Aplica a regra da quinzena no ano inicial e avos proporcionais nos demais.
 */
export function dcCalcDecimos(
  comps: DcCompetencia[],
  dataInicio: string,
  dataFim: string,
): DcDecimoItem[] {
  if (!comps.length || !dataInicio || !dataFim) return [];
  const ini = new Date(`${dataInicio}T00:00:00`);
  const fim = new Date(`${dataFim}T00:00:00`);
  if (fim < ini) throw new Error("Data fim dos atrasados anterior à data de início.");
  const fracaoPrimeiro = dcFracaoPrimeiroMes(dataInicio);
  const anoInicio = ini.getFullYear();
  const sorted = [...comps].sort((a, b) => dcCompToNum(a.competencia) - dcCompToNum(b.competencia));
  const porAno = new Map<number, DcCompetencia[]>();
  for (const c of sorted) {
    const ano = Number(c.competencia.split("/")[1]);
    if (!porAno.has(ano)) porAno.set(ano, []);
    porAno.get(ano)!.push(c);
  }
  const result: DcDecimoItem[] = [];
  for (const ano of [...porAno.keys()].sort((a, b) => a - b)) {
    const items = porAno.get(ano)!;
    const ref   = items.find((c) => c.competencia.startsWith("12/")) ?? items[items.length - 1];
    const meses = dcMesesAnoNoPeriodo(ano, dataInicio, dataFim);
    if (meses <= 0) continue;
    const mesesCons = ano === anoInicio ? (meses - 1) + fracaoPrimeiro : meses;
    const base = ref.valorOriginal;
    const vo   = r2((base / 12) * mesesCons);
    const vc   = r2(vo * ref.fatorCorrecao);
    result.push({
      ano, valorOriginal: vo, abatimentos: 0,
      fatorCorrecao: ref.fatorCorrecao, valorCorrigido: vc,
      mesesConsiderados: r2(mesesCons), beneficioBase: base,
      referenciaCorrecao: ref.competencia,
    });
  }
  return result;
}

/** Intercala as linhas mensais com os 13ºs por ano, em ordem cronológica. */
export function dcMontarLinhas(
  comps: DcCompetencia[],
  decimos: DcDecimoItem[],
): DcLinhaResultado[] {
  const mensais: DcLinhaResultado[] = [
    ...comps,
  ].sort((a, b) => dcCompToNum(a.competencia) - dcCompToNum(b.competencia)).map((c) => ({
    tipo:           "mensal" as const,
    competencia:    c.competencia,
    valorOriginal:  c.valorOriginal,
    abatimentos:    c.abatimentos,
    fatorCorrecao:  c.fatorCorrecao,
    valorCorrigido: r2((c.valorOriginal - c.abatimentos) * c.fatorCorrecao),
    detalhes:       "Parcela mensal",
  }));
  const porAno = new Map<number, DcLinhaResultado[]>();
  for (const l of mensais) {
    const ano = Number(l.competencia.split("/")[1]);
    if (!porAno.has(ano)) porAno.set(ano, []);
    porAno.get(ano)!.push(l);
  }
  for (const d of decimos) {
    if (!porAno.has(d.ano)) porAno.set(d.ano, []);
    porAno.get(d.ano)!.push({
      tipo: "decimo", competencia: `13º/${d.ano}`,
      valorOriginal: d.valorOriginal, abatimentos: d.abatimentos,
      fatorCorrecao: d.fatorCorrecao, valorCorrigido: d.valorCorrigido,
      detalhes: `Base ${fmtR(d.beneficioBase)} · ${d.mesesConsiderados} meses · ref. ${d.referenciaCorrecao}`,
    });
  }
  return [...porAno.entries()].sort((a, b) => a[0] - b[0]).flatMap(([, ls]) => ls);
}

/** Serializa linhas do resultado para CSV com cabeçalho. */
export function dcToCsv(linhas: DcLinhaResultado[]): string {
  const h = "tipo;competencia;valor_original;abatimentos;fator_correcao;valor_corrigido;detalhes";
  return [
    h,
    ...linhas.map((l) => [
      l.tipo, l.competencia,
      l.valorOriginal.toFixed(2), l.abatimentos.toFixed(2),
      l.fatorCorrecao, l.valorCorrigido.toFixed(2),
      (l.detalhes ?? "").replace(/;/g, ","),
    ].join(";")),
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Orquestrador principal — Cálculo do Valor da Causa
//
// Recebe o FormState completo + mapas de índices já resolvidos pela UI
// e retorna o ResultadoCalculo completo, pronto para exibição e laudo.
//
// Lança Error com mensagem amigável para erros de validação de entrada.
// ─────────────────────────────────────────────────────────────────────────────

export function runCalculo(
  form: FormState,
  corrMap: Map<string, number>,
  inpcMap: Map<string, number>,
): ResultadoCalculo {
  // ── Validações de entrada ─────────────────────────────────────────────────
  if (!form.dib)             throw new Error("Informe a DIB do benefício.");
  if (!form.dataAjuizamento) throw new Error("Informe a data de ajuizamento.");
  if (form.naturezaSegurado === "urbano") {
    if (form.situacaoBeneficio === "concedido" && (!form.rmi || form.rmi <= 0))
      throw new Error("Para benefício concedido, informe a RMI.");
    if (form.situacaoBeneficio === "concessao" && form.origemBase === "rmi" && (!form.rmi || form.rmi <= 0))
      throw new Error("Origem da base 'RMI informada' requer que a RMI seja maior que zero.");
  }

  const dib   = parseIso(form.dib);
  const ajuiz = parseIso(form.dataAjuizamento);
  if (ajuiz < dib) throw new Error("Data de ajuizamento anterior à DIB.");
  const ajuizYM = toYM(ajuiz);

  // ── Resolve evolução do valor base ───────────────────────────────────────
  const {
    evolucao, badgeBase, metodologiaBase,
    temAlertaSubsidiario, rmiEstimada, sbEstimado,
  } = resolveBaseEvolution({
    natureza:      form.naturezaSegurado,
    situacao:      form.situacaoBeneficio,
    origemBase:    form.origemBase,
    rmi:           form.rmi,
    dib, ajuiz,
    contribuicoes: form.contribuicoes,
    coeficiente:   form.coeficiente,
    inpcMap,
  });
  const evoMap = new Map<string, EvolucaoMes>(evolucao.map((e) => [e.ym, e]));

  // ── Parcelas mensais vencidas ─────────────────────────────────────────────
  const qtdVencidas = monthsBetweenInclusive(dib, ajuiz);
  const parcelasVencidas: ParcelaVencida[] = [];
  let totalVencidasBase = 0;
  let totalVencidasCorrigidas = 0;

  for (let i = 0; i < qtdVencidas; i++) {
    const comp           = addMonthsD(monthStart(dib), i);
    const compYM         = toYM(comp);
    const ev             = evoMap.get(compYM);
    const valorBase      = ev?.valorBase        ?? (form.rmi || getSalarioMinimo(compYM));
    const origemValorBase = ev?.origemValorBase  ?? "Base apurada";
    const reajustePrevPct = ev?.reajustePct      ?? "—";
    const fator = corrMap.size > 0
      ? r2(fatorAcumulado(corrMap, compYM, ajuizYM) * 1_000_000) / 1_000_000
      : 1;
    const vc = r2(valorBase * fator);
    parcelasVencidas.push({ competencia: monthLabel(comp), valorBase, origemValorBase, reajustePrevPct, fatorCorrecao: fator, valorCorrigido: vc });
    totalVencidasBase       += valorBase;
    totalVencidasCorrigidas += vc;
  }
  totalVencidasBase       = r2(totalVencidasBase);
  totalVencidasCorrigidas = r2(totalVencidasCorrigidas);

  // ── 13º Salário intercalado (regra da quinzena) ────────────────────────
  if (form.incluir13o) {
    const decimos = calcDecimosMain(
      dib, ajuiz, evoMap, corrMap,
      form.rmi || getSalarioMinimo(toYM(dib)),
    );
    for (const d of decimos) {
      const refLabel  = new Date(Number(d.refYM.slice(0, 4)), Number(d.refYM.slice(5, 7)) - 1, 1);
      const compLabel = `13º/${d.ano}`;
      const detalhes  = `Base ${fmtR(d.beneficioBase)} × ${d.mesesConsiderados.toFixed(2)} avos (ref. ${d.refYM})`;
      const row13o: ParcelaVencida = {
        competencia:     compLabel,
        valorBase:       d.valorBase,
        origemValorBase: detalhes,
        reajustePrevPct: `${d.mesesConsiderados.toFixed(2)} avos`,
        fatorCorrecao:   d.fatorCorrecao,
        valorCorrigido:  d.valorCorrigido,
        is13o:           true,
        detalhes13o:     detalhes,
      };
      // Insere o 13º logo após a competência de dezembro do ano correspondente
      const refYMLabel  = monthLabel(refLabel);
      const insertIdx   = parcelasVencidas.findIndex((p) => !p.is13o && p.competencia === refYMLabel);
      if (insertIdx >= 0) {
        parcelasVencidas.splice(insertIdx + 1, 0, row13o);
      } else {
        parcelasVencidas.push(row13o);
      }
      totalVencidasBase       = r2(totalVencidasBase + d.valorBase);
      totalVencidasCorrigidas = r2(totalVencidasCorrigidas + d.valorCorrigido);
    }
  }

  // ── Parcelas vincendas ────────────────────────────────────────────────────
  const rmaFinal = evolucao.length > 0
    ? evolucao[evolucao.length - 1].valorBase
    : (form.rmi || getSalarioMinimo(ajuizYM));
  const rmaParaVincendas = form.rma > 0 ? form.rma : rmaFinal;
  const totalVincendas   = r2(rmaParaVincendas * form.parcelasVincendas);

  // ── Agrupamento de itens (abatimentos / créditos) ─────────────────────────
  let outrosCreditos       = 0;
  let beneficiosRecebidos  = 0;
  let outrosDescontos      = 0;
  for (const item of form.itens) {
    const val = calcItem(item, ajuiz, corrMap);
    if      (item.tipo === "outro_credito")     outrosCreditos      += val;
    else if (item.tipo === "beneficio_recebido") beneficiosRecebidos += val;
    else if (item.tipo === "outro_desconto")     outrosDescontos     += val;
  }
  outrosCreditos      = r2(outrosCreditos);
  beneficiosRecebidos = r2(beneficiosRecebidos);
  outrosDescontos     = r2(outrosDescontos);
  const totalAbatimentos = r2(beneficiosRecebidos + outrosDescontos);
  const valorCausaBruto  = r2(totalVencidasCorrigidas + totalVincendas + outrosCreditos - totalAbatimentos);
  const valorCausaFinal  = r2(valorCausaBruto * (form.percentualAcordo / 100));

  return {
    mesesVencidos:           qtdVencidas,
    parcelasVencidas,
    totalVencidasBase,
    totalVencidasCorrigidas,
    totalVincendas,
    rmaFinal:                rmaParaVincendas,
    outrosCreditos,
    beneficiosRecebidos,
    outrosDescontos,
    totalAbatimentos,
    valorCausaBruto,
    valorCausaFinal,
    badgeBase,
    metodologiaBase,
    temAlertaSubsidiario,
    rmiEstimada,
    sbEstimado,
  };
}
