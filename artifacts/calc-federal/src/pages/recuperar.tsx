import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Search, FileText, KeyRound, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRecoverCase } from "@/hooks/use-cases-api";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CIVIL_MODULE_PATHS: Record<string, string> = {
  "familia-pensao":      "/familia/revisao-pensao",
  "trabalhista":         "/trabalhista",
  "danos-emergentes":    "/civel/danos-emergentes",
  "liquidacao-estadual": "/estadual/liquidacao-sentenca",
};

export default function RecuperarChave() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();

  const urlKey = new URLSearchParams(searchString).get("key")?.toUpperCase() ?? "";

  const [inputKey, setInputKey] = useState(urlKey);
  const [searchKey, setSearchKey] = useState(urlKey);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const { data, isLoading, isError } = useRecoverCase(searchKey);

  // Redireciona para o caso do wizard quando encontrado
  useEffect(() => {
    if (data?.case?.id && searchKey) {
      setLocation(`/cases/${data.case.id}`);
    }
  }, [data, searchKey, setLocation]);

  // Fallback: tenta previdenciário → civil quando o wizard não encontrou
  useEffect(() => {
    if (!searchKey || isLoading || !isError) return;

    setNotFound(false);
    setSearching(true);

    const tryPrevidenciario = () =>
      fetch(`${API_BASE}/api/previdenciario/recover/${searchKey}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          if (d?.publicKey) {
            setLocation(`/previdenciario?key=${d.publicKey}`);
            return true;
          }
          return false;
        })
        .catch(() => false);

    const tryCivil = () =>
      fetch(`${API_BASE}/api/civil/recover/${searchKey}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          const path = CIVIL_MODULE_PATHS[d?.modulo ?? ""];
          if (path) {
            setLocation(`${path}?key=${d.publicKey}`);
            return true;
          }
          return false;
        })
        .catch(() => false);

    tryPrevidenciario()
      .then((found) => (found ? null : tryCivil()))
      .then((found) => {
        if (!found) setNotFound(true);
      })
      .finally(() => setSearching(false));
  }, [isError, isLoading, searchKey]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputKey.trim().toUpperCase();
    if (!trimmed) return;
    setNotFound(false);
    setSearching(false);
    setSearchKey(trimmed);
  };

  const loading = isLoading || searching;
  const showNotFound = notFound && !loading && !!searchKey;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-display text-foreground">Recuperar Cálculo</h1>
        <p className="text-muted-foreground mt-1">
          Utilize a chave pública gerada para acessar um cálculo previamente salvo.
        </p>
      </div>

      <Card className="shadow-sm border-border/60">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Buscar por Chave Pública
          </CardTitle>
          <CardDescription>
            Insira o código no formato PALAVRA-PALAVRA-XXXX-XXXX fornecido no momento do cálculo.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <Input
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value.toUpperCase())}
              placeholder="Ex: CLARO-CONTA-B68A-9CED"
              className="flex-1 h-12 text-base font-mono tracking-widest uppercase"
              autoFocus
            />
            <Button type="submit" size="lg" className="h-12 min-w-[130px]" disabled={loading || !inputKey.trim()}>
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" /> Localizar
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading && (
        <Card className="animate-in fade-in border-border/40">
          <CardContent className="p-8 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm">Localizando cálculo...</p>
          </CardContent>
        </Card>
      )}

      {showNotFound && (
        <Card className="border-destructive/40 bg-destructive/5 animate-in fade-in">
          <CardContent className="p-8 flex flex-col items-center justify-center text-center">
            <FileText className="w-12 h-12 text-destructive/40 mb-3" />
            <h3 className="text-lg font-semibold text-destructive mb-1">Cálculo não encontrado</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Não foi possível localizar nenhum registro com a chave{" "}
              <span className="font-mono font-semibold">{searchKey}</span>. Verifique se digitou corretamente.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
