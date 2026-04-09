import { Switch, Route } from "wouter";
import Dashboard from "./pages/dashboard";
import Recover from "./pages/recover";
import Wizard from "./pages/wizard";

function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground flex-col">
      <h1 className="text-4xl font-bold font-display text-primary mb-4">404</h1>
      <p className="text-lg text-muted-foreground mb-8">A página solicitada não foi encontrada.</p>
      <a href="/" className="text-accent underline underline-offset-4 hover:text-accent/80 font-medium">Voltar ao início</a>
    </div>
  );
}

export default function App() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/recover" component={Recover} />
      <Route path="/cases/:id" component={Wizard} />
      <Route component={NotFound} />
    </Switch>
  );
}
