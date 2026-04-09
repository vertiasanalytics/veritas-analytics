import { useEffect, lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/auth-context";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/app-layout";
import { Loader2 } from "lucide-react";

// Pages
import Dashboard from "@/pages/dashboard";
import RecuperarChave from "@/pages/recuperar";
import Wizard from "@/pages/wizard";
import Indices from "@/pages/indices";
import Previdenciario from "@/pages/previdenciario";
import Login from "@/pages/login";
import Perfil from "@/pages/perfil";
import AdminUsuarios from "@/pages/admin-usuarios";
import Creditos from "@/pages/creditos";
import AdminFinanceiro from "@/pages/admin-financeiro";
import CasesNew from "@/pages/cases-new";
import ValorCausa from "@/pages/valor-causa";
import Planos from "@/pages/planos";
import Equipe from "@/pages/equipe";
import JurosAmortizacao from "@/pages/juros-amortizacao";
import LucroCessanteDCF from "@/pages/lucro-cessante-dcf";
import HonorariosPericiais from "@/pages/honorarios-periciais";
import HonorariosJuridicos from "@/pages/honorarios-juridicos";
import LancamentoControladora from "@/pages/lancamento-controladora";
import FamiliaRevisaoPensao from "@/pages/familia-revisao-pensao";
import DanosEmergentes from "@/pages/danos-emergentes";
import LiquidacaoEstadual from "@/pages/liquidacao-estadual";
import TjmgIndice from "@/pages/tjmg-indice";
const AnaliseBalanco = lazy(() => import("@/pages/analise-balanco"));
const ContrachequeSimape = lazy(() => import("@/pages/contracheque-siape"));
import ControladoriaJuridica from "@/pages/controladoria-juridica";
import Backup from "@/pages/backup";
import Trabalhista from "@/pages/trabalhista";
import Manual from "@/pages/manual";
import AdminTabelasFiscais from "@/pages/admin-tabelas-fiscais";
import Suporte from "@/pages/suporte";
import PeritoAssistente from "@/pages/perito-assistente";
import AdminSuporte from "@/pages/admin-suporte";
import SalarioMinimo from "@/pages/salario-minimo";
import AdminEducacional from "@/pages/admin-educacional";
import AdminConvenios from "@/pages/admin-convenios";
import AdminCupons from "@/pages/admin-cupons";
import AdminAcessos from "@/pages/admin-acessos";
import PainelEducacional from "@/pages/painel-educacional";
import { useTrackAccess } from "@/hooks/use-track-access";
import ConvenioLogin from "@/pages/convenio-login";
import ConvenioPrimeiroAcesso from "@/pages/convenio-primeiro-acesso";
import ConvenioPainel from "@/pages/convenio-painel";
import ConvenioSignup from "@/pages/convenio-signup";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRouter() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/recuperar" component={RecuperarChave} />
        <Route path="/indices" component={Indices} />
        <Route path="/previdenciario" component={Previdenciario} />
        <Route path="/cases/new" component={CasesNew} />
        <Route path="/cases/:id" component={Wizard} />
        <Route path="/valor-causa" component={ValorCausa} />
        <Route path="/perfil" component={Perfil} />
        <Route path="/creditos" component={Creditos} />
        <Route path="/planos" component={Planos} />
        <Route path="/equipe" component={Equipe} />
        <Route path="/pericial/juros-amortizacao" component={JurosAmortizacao} />
        <Route path="/pericial/lucro-cessante-dcf" component={LucroCessanteDCF} />
        <Route path="/pericial/honorarios-periciais" component={HonorariosPericiais} />
        <Route path="/pericial/analise-balanco">
          <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
            <AnaliseBalanco />
          </Suspense>
        </Route>
        <Route path="/pericial/contracheque-siape">
          <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
            <ContrachequeSimape />
          </Suspense>
        </Route>
        <Route path="/controladoria-juridica" component={ControladoriaJuridica} />
        <Route path="/admin/usuarios" component={AdminUsuarios} />
        <Route path="/admin/financeiro" component={AdminFinanceiro} />
        <Route path="/admin/tabelas-fiscais" component={AdminTabelasFiscais} />
        <Route path="/admin/suporte" component={AdminSuporte} />
        <Route path="/admin/salario-minimo" component={SalarioMinimo} />
        <Route path="/admin/educacional" component={AdminEducacional} />
        <Route path="/admin/convenios" component={AdminConvenios} />
        <Route path="/admin/cupons" component={AdminCupons} />
        <Route path="/admin/acessos" component={AdminAcessos} />
        <Route path="/educacional" component={PainelEducacional} />
        <Route path="/suporte" component={Suporte} />
        <Route path="/perito-assistente" component={PeritoAssistente} />
        <Route path="/backup" component={Backup} />
        <Route path="/trabalhista" component={Trabalhista} />
        <Route path="/juridico/honorarios-juridicos" component={HonorariosJuridicos} />
        <Route path="/juridico/lancamento-controladora" component={LancamentoControladora} />
        <Route path="/familia/revisao-pensao" component={FamiliaRevisaoPensao} />
        <Route path="/civel/danos-emergentes" component={DanosEmergentes} />
        <Route path="/estadual/liquidacao-sentenca" component={LiquidacaoEstadual} />
        <Route path="/indicadores/tjmg" component={TjmgIndice} />
        <Route path="/manual" component={Manual} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function TrackingLayer() {
  useTrackAccess();
  return null;
}

function Router() {
  return (
    <>
      <TrackingLayer />
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/convenio/login" component={ConvenioLogin} />
        <Route path="/convenio/signup" component={ConvenioSignup} />
        <Route path="/convenio/primeiro-acesso" component={ConvenioPrimeiroAcesso} />
        <Route path="/convenio/painel" component={ConvenioPainel} />
        <Route component={ProtectedRouter} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
