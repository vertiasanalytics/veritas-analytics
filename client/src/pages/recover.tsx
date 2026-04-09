import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { KeyRound, Search } from "lucide-react";
import { useRecoverCase } from "@/hooks/use-api";

export default function Recover() {
  const [, setLocation] = useLocation();
  const [key, setKey] = useState("");
  const [searchKey, setSearchKey] = useState("");

  const { data, isError, isLoading, error } = useRecoverCase(searchKey);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim()) setSearchKey(key.trim());
  };

  if (data) {
    setLocation(`/cases/${data.case.id}`);
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto mt-12">
        <Card className="overflow-hidden border-0 shadow-2xl">
          <div className="bg-primary p-8 text-center text-white">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
              <KeyRound className="w-8 h-8 text-accent" />
            </div>
            <h1 className="text-3xl font-display font-bold mb-2">Recuperar Cálculo</h1>
            <p className="text-primary-foreground/80">Insira a chave pública gerada para acessar os autos.</p>
          </div>
          
          <CardContent className="p-8">
            <form onSubmit={handleSearch} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground/80">Chave Pública</label>
                <Input 
                  value={key} 
                  onChange={(e) => setKey(e.target.value)} 
                  placeholder="Ex: ABCD-1234-WXYZ" 
                  className="text-lg text-center tracking-widest font-mono uppercase h-14"
                />
              </div>

              {isError && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center font-medium">
                  {error?.message || "Cálculo não encontrado. Verifique a chave."}
                </div>
              )}

              <Button type="submit" className="w-full h-14 text-lg" isLoading={isLoading}>
                <Search className="w-5 h-5 mr-2" /> Buscar Processo
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
