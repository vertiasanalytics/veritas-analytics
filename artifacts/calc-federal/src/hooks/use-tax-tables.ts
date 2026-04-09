/**
 * use-tax-tables.ts
 * Busca as tabelas fiscais ativas (INSS e IRRF) da API.
 * Fallback para tabelas hardcoded 2025 em caso de erro de rede.
 */

import { useQuery } from "@tanstack/react-query";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface InssGrade {
  limite: number;
  aliquota: number;
  descricao?: string;
}

export interface IrrfGrade {
  limite: number;
  aliquota: number;
  deducao: number;
  descricao?: string;
}

export interface TaxTable {
  id: number;
  type: "inss" | "irrf";
  vigencia: string;
  label: string;
  faixas: InssGrade[] | IrrfGrade[];
  ativo: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Fallback hardcoded (caso API falhe) ─────────────────────────────────────

const FALLBACK_INSS: InssGrade[] = [
  { limite: 1518.00, aliquota: 0.075, descricao: "Até R$ 1.518,00" },
  { limite: 2793.88, aliquota: 0.09,  descricao: "De R$ 1.518,01 a R$ 2.793,88" },
  { limite: 4190.83, aliquota: 0.12,  descricao: "De R$ 2.793,89 a R$ 4.190,83" },
  { limite: 8157.41, aliquota: 0.14,  descricao: "De R$ 4.190,84 a R$ 8.157,41" },
];

const FALLBACK_IRRF: IrrfGrade[] = [
  { limite: 2428.80,  aliquota: 0,     deducao: 0,      descricao: "Isento — até R$ 2.428,80" },
  { limite: 2826.65,  aliquota: 0.075, deducao: 182.16, descricao: "7,5%" },
  { limite: 3751.05,  aliquota: 0.15,  deducao: 394.16, descricao: "15%" },
  { limite: 4664.68,  aliquota: 0.225, deducao: 675.49, descricao: "22,5%" },
  { limite: 9999999,  aliquota: 0.275, deducao: 908.74, descricao: "27,5%" },
];

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTaxTables() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tax-tables"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/tax-tables`);
      if (!res.ok) throw new Error("Falha ao buscar tabelas fiscais");
      const json = await res.json();
      return json.data as TaxTable[];
    },
    staleTime: 1000 * 60 * 10,
    retry: 2,
  });

  const inssTable = data?.find((t) => t.type === "inss");
  const irrfTable = data?.find((t) => t.type === "irrf");

  const inssGrades: InssGrade[] = (inssTable?.faixas as InssGrade[]) ?? FALLBACK_INSS;
  const irrfGrades: IrrfGrade[] = (irrfTable?.faixas as IrrfGrade[]) ?? FALLBACK_IRRF;

  // ─── Cálculo INSS progressivo ───────────────────────────────────────────────
  function calcInss(salarioBruto: number): number {
    let total = 0;
    let base = Math.min(salarioBruto, inssGrades[inssGrades.length - 1].limite);
    let anterior = 0;
    for (const faixa of inssGrades) {
      const teto = faixa.limite;
      if (salarioBruto <= anterior) break;
      const faixaBase = Math.min(salarioBruto, teto) - anterior;
      total += faixaBase * faixa.aliquota;
      anterior = teto;
      if (salarioBruto <= teto) break;
    }
    void base;
    return parseFloat(total.toFixed(2));
  }

  // ─── Cálculo IRRF simplificado (sobre base = salário − INSS − dependentes) ─
  function calcIrrf(baseCalculo: number): number {
    for (const faixa of irrfGrades) {
      if (baseCalculo <= faixa.limite) {
        const irrf = baseCalculo * faixa.aliquota - faixa.deducao;
        return parseFloat(Math.max(0, irrf).toFixed(2));
      }
    }
    const ultima = irrfGrades[irrfGrades.length - 1] as IrrfGrade;
    const irrf = baseCalculo * ultima.aliquota - ultima.deducao;
    return parseFloat(Math.max(0, irrf).toFixed(2));
  }

  return {
    isLoading,
    isError,
    refetch,
    inssTable,
    irrfTable,
    inssGrades,
    irrfGrades,
    calcInss,
    calcIrrf,
  };
}
