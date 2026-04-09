import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE_URL = "/api";

// --- Types ---
export interface CalculationCase {
  id: number;
  publicKey: string;
  status: string;
  updatedAt: string;
}

export interface CaseFull {
  case: CalculationCase;
  processData: any;
  monetaryConfig: any;
  interestConfig: any;
  parties: any[];
  fees: any[];
  succumbencies: any[];
  finalMeta: any;
}

// --- Fetch Helper ---
async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "An error occurred");
  }
  return res.json();
}

// --- Hooks ---

export function useListCases() {
  return useQuery({
    queryKey: ["cases"],
    queryFn: () => fetchApi("/cases").then((d) => d.cases as CalculationCase[]),
  });
}

export function useGetCase(id: number) {
  return useQuery({
    queryKey: ["case", id],
    queryFn: () => fetchApi(`/cases/${id}`).then((d) => d as CaseFull),
    enabled: !!id,
  });
}

export function useRecoverCase(publicKey: string) {
  return useQuery({
    queryKey: ["case", "recover", publicKey],
    queryFn: () => fetchApi(`/cases/recover/${publicKey}`).then((d) => d as CaseFull),
    enabled: !!publicKey,
    retry: false,
  });
}

export function useCreateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fetchApi("/cases", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cases"] }),
  });
}

// Step mutations
export function useUpdateProcessData(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi(`/cases/${id}/process-data`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case", id] }),
  });
}

export function useUpdateMonetaryConfig(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi(`/cases/${id}/monetary-config`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case", id] }),
  });
}

export function useUpdateInterestConfig(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi(`/cases/${id}/interest-config`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case", id] }),
  });
}

export function useUpdateFinalMetadata(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi(`/cases/${id}/final-metadata`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case", id] }),
  });
}

export function useUpdateFees(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi(`/cases/${id}/fees`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case", id] }),
  });
}

// Parties & Installments
export function useAddParty(caseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi(`/cases/${caseId}/parties`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case", caseId] }),
  });
}

export function useDeleteParty(caseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (partyId: number) => fetchApi(`/cases/${caseId}/parties/${partyId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case", caseId] }),
  });
}

export function useAddInstallment(caseId: number, partyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi(`/cases/${caseId}/parties/${partyId}/installments`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case", caseId] }),
  });
}

export function usePasteInstallments(caseId: number, partyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => fetchApi(`/cases/${caseId}/parties/${partyId}/installments/paste`, { method: "POST", body: JSON.stringify({ text }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case", caseId] }),
  });
}

// Compute & Report
export function useComputeCase(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fetchApi(`/cases/${id}/compute`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case", id] }),
  });
}

export function useGenerateReport(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fetchApi(`/cases/${id}/report`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case", id] }),
  });
}

// Reference Data
export function useCriteria() {
  return useQuery({
    queryKey: ["criteria"],
    queryFn: () => fetchApi("/criteria").then((d) => d.criteria),
  });
}

export function useInterestRules() {
  return useQuery({
    queryKey: ["interest-rules"],
    queryFn: () => fetchApi("/criteria/interest-rules").then((d) => d.rules),
  });
}
