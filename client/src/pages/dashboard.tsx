import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { FileText, Plus, ArrowRight, Clock } from "lucide-react";
import { useListCases, useCreateCase } from "@/hooks/use-api";
import { formatDate } from "@/lib/utils";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: cases, isLoading } = useListCases();
  const createMut = useCreateCase();

  const handleCreate = async () => {
    const res = await createMut.mutateAsync();
    setLocation(`/cases/${res.case.id}`);
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="relative rounded-3xl overflow-hidden bg-primary text-white shadow-2xl p-8 md:p-12">
          <div className="absolute inset-0 opacity-20">
            <img src={`${import.meta.env.BASE_URL}images/legal-bg.png`} alt="Background" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-transparent" />
          </div>
          <div className="relative z-10 max-w-2xl">
            <Badge className="bg-accent text-primary mb-6 border-none text-sm px-4 py-1">Sistema Homologado MVP</Badge>
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4 leading-tight">
              Excelência em <br/><span className="text-accent">Cálculos Judiciais</span>
            </h1>
            <p className="text-primary-foreground/80 text-lg md:text-xl mb-8 leading-relaxed max-w-xl">
              Plataforma profissional para apuração de correção monetária, juros e honorários em processos da Justiça Federal.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" className="bg-accent text-primary hover:bg-accent/90 border-none font-bold text-lg px-8" onClick={handleCreate} isLoading={createMut.isPending}>
                <Plus className="mr-2 w-5 h-5" /> Iniciar Novo Cálculo
              </Button>
              <Link href="/recover">
                <Button size="lg" variant="outline" className="text-white border-white/30 hover:bg-white/10 hover:border-white text-lg px-8">
                  Recuperar Caso
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Cases */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-display font-semibold text-primary">Cálculos Recentes</h2>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-2xl" />)}
            </div>
          ) : cases?.length === 0 ? (
            <Card className="bg-muted/50 border-dashed text-center py-16">
              <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground/70 mb-2">Nenhum cálculo encontrado</h3>
              <p className="text-muted-foreground mb-6">Inicie seu primeiro cálculo judicial agora.</p>
              <Button onClick={handleCreate} isLoading={createMut.isPending}>Criar Cálculo</Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cases?.map((c) => (
                <Card key={c.id} className="group hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 border-border/40">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="bg-primary/5 p-2 rounded-lg text-primary">
                        <FileText className="w-6 h-6" />
                      </div>
                      <Badge className={c.status === 'computed' ? 'bg-green-100 text-green-800 border-green-200' : ''}>
                        {c.status === 'computed' ? 'Calculado' : c.status}
                      </Badge>
                    </div>
                    <div className="space-y-1 mb-6">
                      <h3 className="font-semibold text-lg text-foreground line-clamp-1">{c.publicKey}</h3>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="w-3.5 h-3.5 mr-1.5" /> Atualizado em {formatDate(c.updatedAt)}
                      </div>
                    </div>
                    <Link href={`/cases/${c.id}`}>
                      <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-colors">
                        Abrir Cálculo <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
