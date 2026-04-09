import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/context/auth-context";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ActiveSubscription {
  id: number;
  plan_id: number;
  plan_name: string;
  slug?: string;
  status: string;
  starts_at: string;
  ends_at: string;
  credits_monthly: number;
  max_users: number;
  price_monthly: number;
}

interface SubscriptionData {
  currentSubscription: ActiveSubscription | null;
  planSlug: string | null;
}

/**
 * Retorna a assinatura ativa do usuário e o slug do plano atual.
 * Usa o mesmo endpoint /api/plans já existente.
 */
export function useSubscription() {
  return useQuery<SubscriptionData>({
    queryKey: ["subscription"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/plans`, { headers: getAuthHeaders() });
      if (!res.ok) return { currentSubscription: null, planSlug: null };
      const data = await res.json();
      const sub: ActiveSubscription | null = data.currentSubscription ?? null;
      const planSlug = sub?.slug ?? null;
      return { currentSubscription: sub, planSlug };
    },
    staleTime: 60_000,
  });
}
