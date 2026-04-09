import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { getAuthHeaders } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useDemoGuard } from "@/hooks/use-demo-guard";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function CasesNew() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const isDemo = useDemoGuard("/");

  useEffect(() => {
    if (isDemo) return;
    const create = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/cases`, {
          method: "POST",
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error("Erro ao criar processo");
        const data = await res.json();
        navigate(`/cases/${data.case.id}`, { replace: true });
      } catch (err: any) {
        setError(err.message ?? "Erro inesperado");
        toast({ title: "Erro", description: err.message, variant: "destructive" });
      }
    };
    create();
  }, [navigate, toast, isDemo]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-destructive">
        <p className="font-semibold text-lg">Não foi possível criar o processo</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-muted-foreground">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm">Criando processo de Atualização Financeira…</p>
    </div>
  );
}
