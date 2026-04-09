import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

const BRT = "America/Sao_Paulo";

/** Normaliza strings de timestamp do banco (sem Z) para UTC antes de parsear */
function parseUTC(dateString: string): Date {
  if (!dateString) return new Date(NaN);
  // Se não tem Z nem +, o banco retornou sem fuso — trata como UTC
  const normalized = /[Z+]/.test(dateString)
    ? dateString
    : dateString.replace(" ", "T") + "Z";
  return new Date(normalized);
}

/** Formata apenas a data (dd/mm/aaaa) no fuso de Brasília */
export function formatDate(dateString: string) {
  if (!dateString) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRT,
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(parseUTC(dateString));
}

/** Formata data e hora (dd/mm/aa HH:mm) no fuso de Brasília */
export function formatDateTime(dateString: string, opts?: { seconds?: boolean }) {
  if (!dateString) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRT,
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
    ...(opts?.seconds ? { second: '2-digit' } : {}),
  }).format(parseUTC(dateString));
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(value); // Rate comes in as decimal e.g. 0.0021 for 0.21%
}
