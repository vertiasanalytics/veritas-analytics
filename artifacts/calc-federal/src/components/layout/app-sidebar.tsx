import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  LayoutDashboard,
  Landmark,
  Scale,
  Briefcase,
  TrendingUp,
  TrendingDown,
  Users,
  UserCircle,
  LogOut,
  Coins,
  DollarSign,
  RefreshCw,
  Gavel,
  Calculator,
  ChevronDown,
  ChevronRight,
  HardHat,
  Clock3,
  KeyRound,
  Search,
  Crown,
  FileText,
  ShieldCheck,
  Lock,
  HardDriveDownload,
  Activity,
  Banknote,
  GraduationCap,
  TicketPercent,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import { hasAccess, isEducationalPlan, PLAN_LABEL, type PlanSlug } from "@/lib/plan-access";

const mainItems = [
  { title: "Dashboard",              url: "/",                       icon: LayoutDashboard, planKey: null               },
  { title: "Perito Assistente",      url: "/perito-assistente",      icon: Scale,           planKey: null               },
  { title: "Controladoria Jurídica", url: "/controladoria-juridica", icon: ShieldCheck,     planKey: "mod:controladoria" },
  { title: "Meus Créditos",          url: "/creditos",               icon: Coins,           planKey: null               },
  { title: "Planos",                 url: "/planos",                 icon: Crown,           planKey: null               },
  { title: "Minha Equipe",           url: "/equipe",                 icon: Users,           planKey: null               },
  { title: "Índices Econômicos",     url: "/indices",                icon: TrendingUp,           planKey: null               },
  { title: "Backup e Restauração",   url: "/backup",                 icon: HardDriveDownload,    planKey: null               },
];

type Sistema = {
  title: string;
  url: string;
  icon: React.ElementType;
  active: boolean;
  planKey: string | null;
};

const MODULES: { id: string; label: string; icon: React.ElementType; color: string; sistemas: Sistema[] }[] = [
  {
    id: "previdenciario",
    label: "Previdenciário",
    icon: Landmark,
    color: "blue",
    sistemas: [
      { title: "Atualização Financeira",    url: "/cases/new",      icon: RefreshCw,    active: true,  planKey: "mod:previdenciario"  },
      { title: "Liquidação de Sentença",    url: "/previdenciario", icon: Gavel,        active: true,  planKey: "mod:previdenciario"  },
      { title: "Cálculo do Valor da Causa", url: "/valor-causa",    icon: Calculator,   active: true,  planKey: "mod:valor-causa"     },
    ],
  },
  {
    id: "trabalhista",
    label: "Trabalhista",
    icon: Scale,
    color: "violet",
    sistemas: [
      { title: "Cálculo Trabalhista (PJe-Calc)",  url: "/trabalhista",                  icon: Scale,    active: true, planKey: "mod:trabalhista" },
      { title: "Insalubridade & Periculosidade",  url: "/trabalhista?tab=insalubridade", icon: HardHat,  active: true, planKey: "mod:trabalhista" },
      { title: "Horas Extras & Reflexos",         url: "/trabalhista?tab=horas-extras",  icon: Clock3,   active: true, planKey: "mod:trabalhista" },
    ],
  },
  {
    id: "pericial",
    label: "Pericial",
    icon: Briefcase,
    color: "amber",
    sistemas: [
      { title: "Revisão de Cálculo de Juros",    url: "/pericial/juros-amortizacao",       icon: Calculator,   active: true, planKey: "mod:juros-amortizacao" },
      { title: "Lucro Cessante (DCF)",           url: "/pericial/lucro-cessante-dcf",      icon: TrendingDown, active: true, planKey: "mod:dcf"               },
    ],
  },
  {
    id: "honorarios",
    label: "Proposição de Honorários",
    icon: DollarSign,
    color: "green",
    sistemas: [
      { title: "Honorários Periciais Contábeis", url: "/pericial/honorarios-periciais",    icon: FileText,     active: true, planKey: "mod:honorarios-periciais"    },
      { title: "Honorários Advocatícios",        url: "/juridico/honorarios-juridicos",    icon: Gavel,        active: true, planKey: "mod:honorarios-juridicos"    },
    ],
  },
  {
    id: "familia",
    label: "Família",
    icon: Users,
    color: "rose",
    sistemas: [
      { title: "Revisão de Pensão Alimentícia", url: "/familia/revisao-pensao", icon: Scale, active: true, planKey: "mod:familia" },
    ],
  },
  {
    id: "civel",
    label: "Cível",
    icon: Gavel,
    color: "orange",
    sistemas: [
      { title: "Cálculo de Danos Materiais", url: "/civel/danos-emergentes", icon: Calculator, active: true, planKey: "mod:danos-emergentes" },
    ],
  },
  {
    id: "estadual",
    label: "Estadual",
    icon: Scale,
    color: "violet",
    sistemas: [
      { title: "Liquidação de Sentença Estadual", url: "/estadual/liquidacao-sentenca", icon: Gavel, active: true, planKey: "mod:liquidacao-estadual" },
      { title: "Índice TJMG (ICGJ/TJMG)",         url: "/indicadores/tjmg",             icon: TrendingUp, active: true, planKey: null },
    ],
  },
];

const MODULE_COLORS: Record<string, string> = {
  blue:   "text-blue-600 bg-blue-50",
  violet: "text-violet-600 bg-violet-50",
  amber:  "text-amber-600 bg-amber-50",
  green:  "text-green-600 bg-green-50",
  rose:   "text-rose-600 bg-rose-50",
  orange: "text-orange-600 bg-orange-50",
};

function LockedItem({ title, icon: Icon, minPlan }: { title: string; icon: React.ElementType; minPlan: string }) {
  return (
    <Link href="/planos" className="flex items-center gap-2.5 px-2 py-1.5 rounded-md opacity-55 hover:opacity-80 cursor-pointer group transition-opacity">
      <Icon className="w-3.5 h-3.5 flex-shrink-0 text-sidebar-foreground/40" />
      <span className="text-[13px] truncate text-sidebar-foreground/40 flex-1">{title}</span>
      <Lock className="w-3 h-3 text-amber-400/70 flex-shrink-0" />
    </Link>
  );
}

function ModuleGroup({
  mod,
  currentLocation,
  planSlug,
  isAdmin,
}: {
  mod: typeof MODULES[0];
  currentLocation: string;
  planSlug: string | null;
  isAdmin: boolean;
}) {
  const isAnyActive = mod.sistemas.some((s) => s.active && currentLocation === s.url);
  const [open, setOpen] = useState(isAnyActive || mod.id === "previdenciario");

  const hasActive = mod.sistemas.some((s) => s.active);
  const colorClass = MODULE_COLORS[mod.color] ?? "text-slate-600 bg-slate-50";

  return (
    <SidebarGroup className="mt-2">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md hover:bg-sidebar-accent/40 transition-colors group"
      >
        <div className={`p-1 rounded ${colorClass}`}>
          <mod.icon className="w-3.5 h-3.5" />
        </div>
        <span className="flex-1 text-left text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
          {mod.label}
        </span>
        {!hasActive && (
          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 leading-none">breve</Badge>
        )}
        {open ? (
          <ChevronDown className="w-3 h-3 text-sidebar-foreground/40" />
        ) : (
          <ChevronRight className="w-3 h-3 text-sidebar-foreground/40" />
        )}
      </button>

      {open && (
        <SidebarGroupContent className="pl-2 mt-0.5">
          <SidebarMenu>
            {mod.sistemas.map((sistema) => {
              if (!sistema.active) {
                return (
                  <SidebarMenuItem key={sistema.title}>
                    <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md opacity-45 cursor-not-allowed">
                      <sistema.icon className="w-3.5 h-3.5 flex-shrink-0 text-sidebar-foreground/50" />
                      <span className="text-[13px] truncate text-sidebar-foreground/50 flex-1">{sistema.title}</span>
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 leading-none flex-shrink-0">breve</Badge>
                    </div>
                  </SidebarMenuItem>
                );
              }

              const allowed = sistema.planKey
                ? hasAccess(planSlug, sistema.planKey, isAdmin)
                : true;

              if (!allowed) {
                const minPlan = PLAN_LABEL[
                  { "mod:dcf": "profissional" }[sistema.planKey!] as PlanSlug ?? "profissional"
                ] ?? "Profissional";
                return (
                  <SidebarMenuItem key={sistema.title}>
                    <LockedItem title={sistema.title} icon={sistema.icon} minPlan={minPlan} />
                  </SidebarMenuItem>
                );
              }

              return (
                <SidebarMenuItem key={sistema.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={currentLocation === sistema.url}
                    className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-medium transition-all duration-200 h-8"
                  >
                    <Link href={sistema.url} className="flex items-center gap-2.5">
                      <sistema.icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="text-[13px] truncate">{sistema.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { data: subData } = useSubscription();
  const [chaveInput, setChaveInput] = useState("");

  const planSlug = subData?.planSlug ?? null;
  const isAdmin = user?.role === "admin";

  const fullLocation = location + (typeof window !== "undefined" ? window.location.search : "");

  return (
    <Sidebar variant="inset" className="border-r-0 shadow-lg">
      <SidebarHeader className="flex items-center justify-center py-5 px-4 border-b border-sidebar-border/30">
        <Link href="/" className="flex items-center justify-center w-full">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="Veritas Analytics"
            className="w-full max-w-[180px] h-auto object-contain drop-shadow-md"
          />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Principal */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-wider text-xs font-semibold">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
                const allowed = item.planKey
                  ? hasAccess(planSlug, item.planKey, isAdmin)
                  : true;

                if (!allowed) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <Link href="/planos" className="flex items-center gap-3 px-2 py-2 rounded-md opacity-55 hover:opacity-80 transition-opacity cursor-pointer">
                        <item.icon className="w-4 h-4 text-sidebar-foreground/40" />
                        <span className="flex-1 text-sm text-sidebar-foreground/40">{item.title}</span>
                        <Lock className="w-3.5 h-3.5 text-amber-400/70" />
                      </Link>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-medium transition-all duration-200"
                    >
                      <Link href={item.url} className="flex items-center gap-3">
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* Painel Educacional — visível apenas para plano educacional e admin */}
              {(isEducationalPlan(planSlug) || isAdmin) && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/educacional"}
                    className="data-[active=true]:bg-blue-50 data-[active=true]:text-blue-700 data-[active=true]:font-medium transition-all duration-200"
                  >
                    <Link href="/educacional" className="flex items-center gap-3">
                      <GraduationCap className="w-4 h-4" />
                      <span>Painel Educacional</span>
                      <Badge className="ml-auto text-[10px] px-1.5 py-0 h-4 bg-blue-100 text-blue-600 border-0 font-semibold">
                        IFES
                      </Badge>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Recuperar Cálculo */}
        <div className="px-3 pt-1 pb-2">
          <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest mb-1.5 flex items-center gap-1">
            <KeyRound className="w-3 h-3" />Recuperar Cálculo
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const key = chaveInput.trim().toUpperCase();
              if (key) { navigate(`/recuperar?key=${key}`); setChaveInput(""); }
            }}
            className="flex gap-1.5"
          >
            <input
              value={chaveInput}
              onChange={(e) => setChaveInput(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="flex-1 h-7 px-2 rounded-md bg-sidebar-accent/30 border border-sidebar-border/40 text-[10px] font-mono text-sidebar-foreground placeholder:text-sidebar-foreground/30 focus:outline-none focus:ring-1 focus:ring-blue-500/50 uppercase tracking-wider"
            />
            <button
              type="submit"
              className="h-7 w-7 flex items-center justify-center rounded-md bg-blue-600/80 hover:bg-blue-600 text-white transition-colors flex-shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Separador de módulos */}
        <div className="px-3 pt-1 pb-0.5">
          <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest">Módulos</p>
        </div>

        {/* Um grupo por módulo */}
        {MODULES.map((mod) => (
          <ModuleGroup key={mod.id} mod={mod} currentLocation={fullLocation} planSlug={planSlug} isAdmin={isAdmin} />
        ))}

        {/* Administração */}
        {user?.role === "admin" && (
          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-wider text-xs font-semibold">
              Administração
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {[
                  { title: "Controle Financeiro", url: "/admin/financeiro",       icon: DollarSign     },
                  { title: "Usuários",             url: "/admin/usuarios",         icon: Users          },
                  { title: "Convênios",            url: "/admin/convenios",        icon: Landmark       },
                  { title: "Cupons",               url: "/admin/cupons",           icon: TicketPercent  },
                  { title: "Salário Mínimo",       url: "/admin/salario-minimo",   icon: Banknote       },
                  { title: "Relatório de Acessos", url: "/admin/acessos",          icon: Activity       },
                ].map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-medium transition-all duration-200"
                    >
                      <Link href={item.url} className="flex items-center gap-3">
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border/30">
        {user && (
          <div className="mb-2 px-1">
            <Link href="/perfil" className="flex items-center gap-2 p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors group cursor-pointer">
              <div className="w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                <UserCircle className="w-4 h-4 text-blue-400" />
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-xs font-semibold text-sidebar-foreground/90 truncate">{user.nome}</p>
                <p className="text-[10px] text-sidebar-foreground/50 truncate">
                  {user.role === "admin" ? "Administrador" : "Usuário"}
                </p>
              </div>
            </Link>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-red-500/10 text-sidebar-foreground/50 hover:text-red-400 transition-colors text-xs mt-0.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        )}
        <div className="text-xs text-sidebar-foreground/30 font-medium text-center pt-1">
          Veritas Analytics &copy; 2026
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
