import { useQueryClient } from "@tanstack/react-query";
import { 
  useCreateCalculation, 
  useComputeCalculation, 
  useGenerateReport,
  getGetCalculationQueryKey,
  getListCalculationsQueryKey
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export function useAppCreateCalculation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useCreateCalculation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCalculationsQueryKey() });
        toast({
          title: "Cálculo criado",
          description: "Os dados iniciais foram salvos com sucesso.",
        });
      },
      onError: (error: Error) => {
        toast({
          title: "Erro ao criar",
          description: error.message || "Verifique os dados informados.",
          variant: "destructive",
        });
      }
    }
  });
  return mutation;
}

export function useAppComputeCalculation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useComputeCalculation({
    mutation: {
      onSuccess: (_data: unknown, variables: { id: number }) => {
        queryClient.invalidateQueries({ queryKey: getGetCalculationQueryKey(variables.id) });
        queryClient.invalidateQueries({ queryKey: getListCalculationsQueryKey() });
        toast({
          title: "Cálculo realizado",
          description: "A atualização monetária foi computada com sucesso.",
        });
      },
      onError: (error: Error) => {
        toast({
          title: "Erro no cálculo",
          description: error.message || "Não foi possível processar a atualização.",
          variant: "destructive",
        });
      }
    }
  });
  return mutation;
}

export function useAppGenerateReport() {
  const { toast } = useToast();
  const mutation = useGenerateReport({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Relatório gerado",
          description: "O relatório foi gerado com sucesso.",
        });
      },
      onError: (error: Error) => {
        toast({
          title: "Erro",
          description: "Falha ao gerar o relatório.",
          variant: "destructive",
        });
      }
    }
  });
  return mutation;
}
