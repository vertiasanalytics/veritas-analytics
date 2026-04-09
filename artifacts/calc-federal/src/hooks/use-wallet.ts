import { useCallback } from "react";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Debita créditos da carteira do usuário antes de uma operação.
 * Retorna `true` se pode prosseguir, `false` se bloqueado (saldo insuficiente ou erro).
 * Admins sempre retornam `true` sem débito.
 */
export function useDebitCredits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  return useCallback(
    async (amount: number, module: string): Promise<boolean> => {
      if (user?.role === "admin") return true;

      try {
        const res = await fetch(`${BASE}/api/wallet/debit`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ amount, module }),
        });

        if (res.status === 402) {
          toast({
            title: "Créditos insuficientes",
            description: `Esta operação requer ${amount} crédito${amount !== 1 ? "s" : ""}. Acesse "Meus Créditos" no menu para recarregar.`,
            variant: "destructive",
          });
          return false;
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Erro ao debitar créditos");
        }

        const data = await res.json();
        qc.invalidateQueries({ queryKey: ["wallet"] });
        qc.invalidateQueries({ queryKey: ["user-stats"] });
        toast({
          title: `${amount} crédito${amount !== 1 ? "s" : ""} debitado${amount !== 1 ? "s" : ""}`,
          description: `Módulo: ${module} · Saldo restante: ${data.novoSaldo} crédito${data.novoSaldo !== 1 ? "s" : ""}`,
        });
        return true;
      } catch (err: any) {
        toast({ title: "Erro ao debitar créditos", description: err.message, variant: "destructive" });
        return false;
      }
    },
    [user, toast, qc]
  );
}
