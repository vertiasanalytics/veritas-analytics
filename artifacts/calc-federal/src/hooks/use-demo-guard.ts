import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";

export function useDemoGuard(redirectTo = "/") {
  const { isDemo } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (isDemo) {
      toast({
        title: "Funcionalidade bloqueada no modo demonstração",
        description: "Crie uma conta gratuita para acessar esta funcionalidade.",
        variant: "destructive",
      });
      navigate(redirectTo, { replace: true });
    }
  }, [isDemo, navigate, redirectTo, toast]);

  return isDemo;
}
