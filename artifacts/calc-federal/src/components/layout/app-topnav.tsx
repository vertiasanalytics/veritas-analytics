import { Link, useLocation } from "wouter";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Scale, TrendingUp, TrendingDown,
  Users, LogOut, Coins, DollarSign, RefreshCw, Gavel, Calculator,
  Search, Crown, ShieldCheck, Lock, HardDriveDownload,
  ChevronDown, ChevronRight, BarChart3, Settings, User, FileBarChart2, Table2,
  Sparkles, Landmark, BookOpen, Microscope, GraduationCap, Info,
  Building2, FileText, LifeBuoy, Banknote, HardHat, Clock3,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import { hasAccess, isEducationalPlan, type PlanSlug } from "@/lib/plan-access";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/context/auth-context";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function useWalletBalance() {
  return useQuery<{ balance: number }>({
    queryKey: ["wallet-balance-nav"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/wallet`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      return res.json();
    },
    refetchInterval: 30_000,
  });
}

function useSupportCount(isAdmin: boolean) {
  return useQuery<{ ok: boolean; openCount: number; criticalCount: number; newCount: number }>({
    queryKey: ["support-count-nav"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/support/count`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: isAdmin,
    refetchInterval: 20_000,
    staleTime: 15_000,
  });
}

// ─── Click-outside dropdown hook ──────────────────────────────────────────────

function useClickDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return { open, toggle, close, ref };
}

// ─── Shared panel wrapper ──────────────────────────────────────────────────────

const PANEL_STYLE: React.CSSProperties = {
  background: "hsl(216,70%,9%)",
  border: "1px solid rgba(255,255,255,0.09)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
};

function Panel({
  children,
  className = "",
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`absolute z-50 rounded-xl overflow-visible ${className}`}
      style={{ ...PANEL_STYLE, ...style }}
    >
      {children}
    </div>
  );
}

// ─── Cascade menu item (with optional flyout) ─────────────────────────────────

interface CascadeChild {
  href: string;
  label: string;
  sub?: string;
  icon: React.ElementType;
  locked?: boolean;
  disabled?: boolean;
  badge?: string;
}

function CascadeItem({
  icon: Icon,
  label,
  sub,
  children,
  customFlyout,
  href,
  active = false,
  locked = false,
  disabled = false,
  badge,
  onNavigate,
}: {
  icon: React.ElementType;
  label: string;
  sub?: string;
  children?: CascadeChild[];
  customFlyout?: React.ReactNode;
  href?: string;
  active?: boolean;
  locked?: boolean;
  disabled?: boolean;
  badge?: string;
  onNavigate?: () => void;
}) {
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const keepOpen = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setFlyoutOpen(true);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setFlyoutOpen(false), 100);
  };

  const hasChildren = (children && children.length > 0) || !!customFlyout;

  const baseClass = `flex items-center gap-3 px-4 py-2.5 w-full text-left text-sm transition-colors duration-100 select-none
    ${active ? "bg-blue-500/12 text-blue-300" : disabled || locked ? "opacity-40 cursor-not-allowed text-white/40" : "text-white/70 hover:text-white hover:bg-white/[0.07] cursor-pointer"}`;

  const inner = (
    <>
      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-blue-400" : "text-white/35"}`} />
      <div className="flex-1 min-w-0">
        <span className="font-medium block leading-tight">{label}</span>
        {sub && <span className="text-[11px] text-white/30 block mt-0.5 leading-tight">{sub}</span>}
      </div>
      {badge && (
        <span className="text-[9px] bg-white/8 text-white/40 border border-white/10 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide">
          {badge}
        </span>
      )}
      {locked && <Lock className="w-3 h-3 text-amber-400/50 flex-shrink-0" />}
      {hasChildren && !disabled && !locked && (
        <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 text-white/30 transition-transform duration-150 ${flyoutOpen ? "translate-x-0.5" : ""}`} />
      )}
    </>
  );

  if (hasChildren) {
    return (
      <div
        ref={itemRef}
        className="relative"
        onMouseEnter={keepOpen}
        onMouseLeave={scheduleClose}
      >
        <div className={baseClass}>{inner}</div>

        {flyoutOpen && (
          <div
            ref={flyoutRef}
            className="absolute top-0 left-full pl-1.5 z-50"
            onMouseEnter={keepOpen}
            onMouseLeave={scheduleClose}
          >
            <Panel className="min-w-[240px] py-1.5">
              {customFlyout}
              {children && children.map((child, i) => {
                const childLocked = child.locked ?? false;
                const childDisabled = child.disabled ?? false;
                const cls = `flex items-center gap-3 px-4 py-2.5 w-full text-left text-sm transition-colors duration-100 select-none
                  ${childDisabled || childLocked
                    ? "opacity-40 cursor-not-allowed text-white/40"
                    : "text-white/70 hover:text-white hover:bg-white/[0.07] cursor-pointer"}`;
                if (childLocked) {
                  return (
                    <Link key={i} href="/planos" onClick={onNavigate} className={cls}>
                      <child.icon className="w-4 h-4 flex-shrink-0 text-white/35" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium block leading-tight">{child.label}</span>
                        {child.sub && <span className="text-[11px] text-white/30 block mt-0.5 leading-tight">{child.sub}</span>}
                      </div>
                      <Lock className="w-3 h-3 text-amber-400/50 flex-shrink-0" />
                    </Link>
                  );
                }
                if (childDisabled) {
                  return (
                    <div key={i} className={cls}>
                      <child.icon className="w-4 h-4 flex-shrink-0 text-white/35" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium block leading-tight">{child.label}</span>
                        {child.sub && <span className="text-[11px] text-white/30 block mt-0.5 leading-tight">{child.sub}</span>}
                      </div>
                      {child.badge && (
                        <span className="text-[9px] bg-white/8 text-white/40 border border-white/10 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide">{child.badge}</span>
                      )}
                    </div>
                  );
                }
                return (
                  <Link key={i} href={child.href} onClick={onNavigate} className={cls}>
                    <child.icon className="w-4 h-4 flex-shrink-0 text-white/35" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium block leading-tight">{child.label}</span>
                      {child.sub && <span className="text-[11px] text-white/30 block mt-0.5 leading-tight">{child.sub}</span>}
                    </div>
                  </Link>
                );
              })}
            </Panel>
          </div>
        )}
      </div>
    );
  }

  if (locked) return <Link href="/planos" onClick={onNavigate} className={baseClass}>{inner}</Link>;
  if (disabled) return <div className={baseClass}>{inner}</div>;
  return <Link href={href!} onClick={onNavigate} className={baseClass}>{inner}</Link>;
}

function MenuDivider() {
  return <div className="h-px bg-white/[0.07] my-1" />;
}

// ─── NavLink ──────────────────────────────────────────────────────────────────

function NavLink({
  href,
  active,
  children,
  onClick,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap select-none
        ${active
          ? "bg-blue-500/15 text-blue-300"
          : "text-white/60 hover:text-white/90 hover:bg-white/5"
        }`}
    >
      {children}
      {active && (
        <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-blue-400/70" />
      )}
    </Link>
  );
}

// ─── Main TopNav ───────────────────────────────────────────────────────────────

export function AppTopNav() {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { data: subData } = useSubscription();
  const { data: walletData } = useWalletBalance();
  const [chaveInput, setChaveInput] = useState("");

  const planSlug = (subData?.planSlug ?? null) as PlanSlug | null;
  const isAdmin = user?.role === "admin";
  const balance = walletData?.balance ?? 0;
  const { data: supportCount } = useSupportCount(isAdmin);

  const calculo = useClickDropdown();
  const ferramentas = useClickDropdown();
  const sobreMenu = useClickDropdown();
  const adminMenu = useClickDropdown();
  const userMenu = useClickDropdown();

  const isActive = (path: string) =>
    location === path || location.startsWith(path + "/");

  const closeAll = () => {
    calculo.close();
    ferramentas.close();
    sobreMenu.close();
    adminMenu.close();
    userMenu.close();
  };

  const userInitials = user?.nome
    ? user.nome.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : (user?.email?.[0] ?? "U").toUpperCase();

  const calcAtivo =
    isActive("/cases") || isActive("/previdenciario") || isActive("/valor-causa") ||
    isActive("/pericial") || isActive("/trabalhista");

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center h-16 px-4 lg:px-6 print:hidden"
      style={{
        background: "linear-gradient(180deg, hsl(216,70%,8%) 0%, hsl(216,65%,11%) 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
      }}
    >
      {/* Logo */}
      <Link href="/" onClick={closeAll} className="flex items-center flex-shrink-0 mr-5">
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="Veritas Analytics"
          className="h-8 w-auto object-contain"
        />
      </Link>

      <div className="w-px h-6 bg-white/10 mr-4 flex-shrink-0" />

      {/* Center Nav */}
      <nav className="flex items-center gap-0.5 flex-1 min-w-0">

        <NavLink href="/" active={location === "/"} onClick={closeAll}>
          <LayoutDashboard className="w-3.5 h-3.5" />
          Dashboard
        </NavLink>

        {hasAccess(planSlug, "mod:controladoria", isAdmin) ? (
          <NavLink href="/controladoria-juridica" active={isActive("/controladoria-juridica")} onClick={closeAll}>
            <ShieldCheck className="w-3.5 h-3.5" />
            Controladoria
          </NavLink>
        ) : (
          <Link href="/planos" onClick={closeAll}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white/35 hover:text-amber-400/70 transition-colors whitespace-nowrap">
            <ShieldCheck className="w-3.5 h-3.5" />
            Controladoria
            <Lock className="w-3 h-3 text-amber-400/40" />
          </Link>
        )}

        {/* ── Cálculos ──────────────────────────────────────────────────── */}
        <div className="relative" ref={calculo.ref}>
          <button
            onClick={calculo.toggle}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap select-none
              ${calcAtivo || calculo.open
                ? "bg-blue-500/15 text-blue-300"
                : "text-white/60 hover:text-white/90 hover:bg-white/5"}`}
          >
            <Calculator className="w-3.5 h-3.5" />
            Cálculos
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${calculo.open ? "rotate-180" : ""}`} />
          </button>

          {calculo.open && (
            <Panel className="top-full mt-2 left-0 min-w-[220px] py-1.5" style={{ overflow: "visible" }}>
              {/* Previdenciário with flyout */}
              <CascadeItem
                icon={Landmark}
                label="Previdenciário"
                sub="Benefícios e liquidação INSS"
                onNavigate={calculo.close}
                children={[
                  {
                    href: "/cases/new",
                    icon: RefreshCw,
                    label: "Atualização Financeira",
                    sub: "Correção monetária e juros",
                    locked: !hasAccess(planSlug, "mod:previdenciario", isAdmin),
                  },
                  {
                    href: "/previdenciario",
                    icon: Gavel,
                    label: "Liquidação de Sentença",
                    sub: "Cálculo completo em 8 etapas",
                    locked: !hasAccess(planSlug, "mod:previdenciario", isAdmin),
                  },
                  {
                    href: "/valor-causa",
                    icon: Calculator,
                    label: "Valor da Causa",
                    sub: "Atualização para protocolo",
                    locked: !hasAccess(planSlug, "mod:valor-causa", isAdmin),
                  },
                ]}
              />

              <MenuDivider />

              {/* Pericial with flyout */}
              <CascadeItem
                icon={Microscope}
                label="Pericial"
                sub="Cálculos periciais e financeiros"
                onNavigate={calculo.close}
                children={[
                  {
                    href: "/pericial/juros-amortizacao",
                    icon: BarChart3,
                    label: "Revisão de Juros",
                    sub: "Amortização Price / SAC",
                    locked: !hasAccess(planSlug, "mod:juros-amortizacao", isAdmin),
                  },
                  {
                    href: "/pericial/lucro-cessante-dcf",
                    icon: TrendingDown,
                    label: "Lucro Cessante (DCF)",
                    sub: "Fluxo de caixa descontado",
                    locked: !hasAccess(planSlug, "mod:dcf", isAdmin),
                  },
                  {
                    href: "/pericial/analise-balanco",
                    icon: BarChart3,
                    label: "Análise de Balanços",
                    sub: "SPED Contábil + índices",
                    locked: !hasAccess(planSlug, "mod:analise-balanco", isAdmin),
                  },
                  {
                    href: "/pericial/contracheque-siape",
                    icon: FileText,
                    label: "Contracheque SIAPE",
                    sub: "Extração de rubricas e verbas",
                    locked: !hasAccess(planSlug, "mod:contracheque-siape", isAdmin),
                  },
                ]}
              />

              <MenuDivider />

              <CascadeItem
                icon={Scale}
                label="Trabalhista"
                sub="Rescisão, insalubridade e horas extras"
                onNavigate={calculo.close}
                children={[
                  {
                    href: "/trabalhista",
                    icon: Scale,
                    label: "Cálculo Trabalhista (PJe-Calc)",
                    sub: "Rescisão, FGTS, verbas — CLT 2025",
                    locked: !hasAccess(planSlug, "mod:trabalhista", isAdmin),
                  },
                  {
                    href: "/trabalhista?tab=insalubridade",
                    icon: HardHat,
                    label: "Insalubridade & Periculosidade",
                    sub: "Art. 192 CLT · Súmula 228/289 TST",
                    locked: !hasAccess(planSlug, "mod:trabalhista", isAdmin),
                  },
                  {
                    href: "/trabalhista?tab=horas-extras",
                    icon: Clock3,
                    label: "Horas Extras & Reflexos",
                    sub: "DSR, férias, 13º, FGTS e Multa 40%",
                    locked: !hasAccess(planSlug, "mod:trabalhista", isAdmin),
                  },
                ]}
              />

              <MenuDivider />

              {/* Honorários */}
              <CascadeItem
                icon={Coins}
                label="Honorários"
                sub="Periciais e advocatícios"
                onNavigate={calculo.close}
                children={[
                  {
                    href: "/pericial/honorarios-periciais",
                    icon: Microscope,
                    label: "Honorários Periciais",
                    sub: "Art. 465 CPC — tabelas do Conselho",
                  },
                  {
                    href: "/juridico/honorarios-juridicos",
                    icon: Gavel,
                    label: "Honorários Advocatícios",
                    sub: "Art. 85 CPC — § 2.º e § 8.º",
                  },
                ]}
              />

              <MenuDivider />

              {/* Família */}
              <CascadeItem
                icon={Users}
                label="Família"
                sub="Alimentos e revisão de pensão"
                onNavigate={calculo.close}
                children={[
                  {
                    href: "/familia/revisao-pensao",
                    icon: RefreshCw,
                    label: "Revisão de Pensão Alimentícia",
                    sub: "Atualização e adequação de alimentos",
                  },
                ]}
              />

              <MenuDivider />

              {/* Cível */}
              <CascadeItem
                icon={Scale}
                label="Cível"
                sub="Danos materiais e emergentes"
                onNavigate={calculo.close}
                children={[
                  {
                    href: "/civel/danos-emergentes",
                    icon: TrendingDown,
                    label: "Cálculo de Danos Materiais",
                    sub: "Danos emergentes e lucros cessantes",
                  },
                ]}
              />

              <MenuDivider />

              {/* Estadual */}
              <CascadeItem
                icon={Building2}
                label="Estadual"
                sub="Liquidação estadual e índices TJMG"
                onNavigate={calculo.close}
                children={[
                  {
                    href: "/estadual/liquidacao-sentenca",
                    icon: FileText,
                    label: "Liquidação de Sentença Estadual",
                    sub: "Correção monetária pelo TJMG/TJSP",
                  },
                  {
                    href: "/indicadores/tjmg",
                    icon: BarChart3,
                    label: "Índice TJMG (ICGJ)",
                    sub: "Fator de atualização monetária TJMG",
                  },
                ]}
              />
            </Panel>
          )}
        </div>

        {/* ── Ferramentas ────────────────────────────────────────────────── */}
        <div className="relative" ref={ferramentas.ref}>
          <button
            onClick={ferramentas.toggle}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap select-none
              ${isActive("/indices") || isActive("/backup") || isActive("/suporte") || isActive("/admin/tabelas-fiscais") || isActive("/admin/salario-minimo") || isActive("/admin/educacional") || isActive("/admin/convenios") || isActive("/educacional") || ferramentas.open
                ? "bg-blue-500/15 text-blue-300"
                : "text-white/60 hover:text-white/90 hover:bg-white/5"}`}
          >
            <Settings className="w-3.5 h-3.5" />
            Ferramentas
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${ferramentas.open ? "rotate-180" : ""}`} />
          </button>

          {ferramentas.open && (
            <Panel className="top-full mt-2 left-0 min-w-[240px] py-1.5">
              <CascadeItem
                href="/indices"
                icon={TrendingUp}
                label="Índices Econômicos"
                sub="SELIC, IPCA, TR, IGP-M, TRF1"
                active={isActive("/indices")}
                onNavigate={ferramentas.close}
              />
              <CascadeItem
                href="/backup"
                icon={HardDriveDownload}
                label="Backup e Restauração"
                sub="Exportar e importar dados"
                active={isActive("/backup")}
                onNavigate={ferramentas.close}
              />
              <CascadeItem
                href="/admin/tabelas-fiscais"
                icon={Table2}
                label="Tabelas Fiscais"
                sub="Atualizar INSS / IRRF"
                active={isActive("/admin/tabelas-fiscais")}
                onNavigate={ferramentas.close}
              />
              {isAdmin && (
                <CascadeItem
                  href="/admin/salario-minimo"
                  icon={Banknote}
                  label="Salário Mínimo"
                  sub="Série histórica de competências"
                  active={isActive("/admin/salario-minimo")}
                  onNavigate={ferramentas.close}
                />
              )}
              {isAdmin && (
                <CascadeItem
                  href="/admin/educacional"
                  icon={GraduationCap}
                  label="Plano Educacional"
                  sub="Gestão de assinantes educacionais"
                  active={isActive("/admin/educacional")}
                  onNavigate={ferramentas.close}
                />
              )}
              {isAdmin && (
                <CascadeItem
                  href="/admin/convenios"
                  icon={Building2}
                  label="Convênios Institucionais"
                  sub="Parcerias, usuários e relatórios"
                  active={isActive("/admin/convenios")}
                  onNavigate={ferramentas.close}
                />
              )}
              {!isAdmin && isEducationalPlan(planSlug) && (
                <CascadeItem
                  href="/educacional"
                  icon={GraduationCap}
                  label="Painel Educacional"
                  sub="Créditos e histórico do plano IFES"
                  active={isActive("/educacional")}
                  onNavigate={ferramentas.close}
                />
              )}

              <MenuDivider />

              <CascadeItem
                href="/suporte"
                icon={LifeBuoy}
                label="Suporte Técnico"
                sub="Relatar problema ao suporte"
                active={isActive("/suporte")}
                onNavigate={ferramentas.close}
              />

              <MenuDivider />

              {/* Recuperar Cálculo — flyout with key input */}
              <CascadeItem
                icon={Search}
                label="Recuperar Cálculo"
                sub="Buscar por chave pública"
                customFlyout={
                  <div className="px-4 py-3">
                    <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-2">
                      Chave do Cálculo
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const key = chaveInput.trim().toUpperCase();
                        if (key) {
                          navigate(`/recuperar?key=${key}`);
                          setChaveInput("");
                          ferramentas.close();
                        }
                      }}
                      className="flex gap-2"
                    >
                      <input
                        value={chaveInput}
                        onChange={(e) => setChaveInput(e.target.value.toUpperCase())}
                        placeholder="XXXX-XXXX-XXXX-XXXX"
                        autoFocus
                        className="flex-1 h-8 px-2.5 rounded-lg bg-white/5 border border-white/12 text-[11px] font-mono text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60 tracking-wider min-w-0"
                      />
                      <button
                        type="submit"
                        className="h-8 w-8 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors flex-shrink-0"
                      >
                        <Search className="w-3.5 h-3.5" />
                      </button>
                    </form>
                    <p className="text-[10px] text-white/20 mt-2 leading-relaxed">
                      Cole a chave pública de um cálculo salvo para recuperá-lo
                    </p>
                  </div>
                }
              />
            </Panel>
          )}
        </div>

        {/* ── Sobre ──────────────────────────────────────────────────── */}
        <div className="relative" ref={sobreMenu.ref}>
          <button
            onClick={sobreMenu.toggle}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap select-none
              ${isActive("/manual") || sobreMenu.open
                ? "bg-blue-500/15 text-blue-300"
                : "text-white/60 hover:text-white/90 hover:bg-white/5"}`}
          >
            <Info className="w-3.5 h-3.5" />
            Sobre
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${sobreMenu.open ? "rotate-180" : ""}`} />
          </button>

          {sobreMenu.open && (
            <Panel className="top-full mt-2 left-0 min-w-[260px] py-1.5">
              {/* Autoria */}
              <div className="px-4 py-3 mb-1">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300 font-black text-sm flex-shrink-0">
                    VW
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-white/90 leading-tight">Dr. Vasconcelos R. Wakim</p>
                    <p className="text-[10px] text-white/40 leading-tight">Perito Contador · Professor UFVJM</p>
                  </div>
                </div>
              </div>
              <MenuDivider />
              <CascadeItem
                href="/manual"
                icon={BookOpen}
                label="Manual do Sistema"
                sub="Guia completo de utilização"
                active={isActive("/manual")}
                onNavigate={sobreMenu.close}
              />
              <CascadeItem
                href="/manual"
                icon={GraduationCap}
                label="Autoria e Créditos"
                sub="Dr. Vasconcelos R. Wakim · UFVJM"
                onNavigate={() => { sobreMenu.close(); }}
              />
              <MenuDivider />
              <div className="px-4 py-3">
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-1.5">Sistema</p>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Veritas Analytics — Plataforma de Cálculos Judiciais Federais
                </p>
                <p className="text-[10px] text-white/25 mt-1.5">
                  Baseado no Manual CJF 2025 e metodologia PJe-Calc/TST
                </p>
              </div>
            </Panel>
          )}
        </div>

        <NavLink href="/creditos" active={isActive("/creditos")} onClick={closeAll}>
          <Coins className="w-3.5 h-3.5" />
          Créditos
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none
            ${balance > 0 ? "bg-blue-500/20 text-blue-300" : "bg-red-500/20 text-red-400"}`}>
            {balance.toLocaleString("pt-BR")}
          </span>
        </NavLink>

        <NavLink href="/planos" active={isActive("/planos")} onClick={closeAll}>
          <Crown className="w-3.5 h-3.5" />
          Planos
        </NavLink>

        <NavLink href="/equipe" active={isActive("/equipe")} onClick={closeAll}>
          <Users className="w-3.5 h-3.5" />
          Equipe
        </NavLink>
      </nav>

      {/* Right Side */}
      <div className="flex items-center gap-1 flex-shrink-0 ml-3">

        <div className="hidden xl:flex items-center gap-1.5 px-3 mr-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-medium text-white/25 tracking-wide uppercase">Online</span>
        </div>

        {/* ── Sino de notificação de chamados (admin only) ─────────────── */}
        {isAdmin && (
          <Link href="/admin/suporte" onClick={closeAll}>
            <button
              title={
                supportCount?.criticalCount
                  ? `${supportCount.criticalCount} chamado(s) crítico(s) aberto(s)!`
                  : supportCount?.openCount
                    ? `${supportCount.openCount} chamado(s) aberto(s)`
                    : "Sem chamados novos"
              }
              className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 select-none
                ${supportCount?.criticalCount
                  ? "text-red-400 hover:bg-red-500/15 hover:text-red-300"
                  : supportCount?.openCount
                    ? "text-amber-400 hover:bg-amber-500/15 hover:text-amber-300"
                    : "text-white/30 hover:bg-white/5 hover:text-white/50"
                }`}
            >
              <LifeBuoy className={`w-4 h-4 ${supportCount?.criticalCount ? "animate-pulse" : ""}`} />
              {(supportCount?.openCount ?? 0) > 0 && (
                <span className={`absolute -top-1 -right-1 flex items-center justify-center
                  text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full leading-none
                  ${supportCount?.criticalCount
                    ? "bg-red-500 text-white"
                    : "bg-amber-500 text-white"
                  }`}>
                  {(supportCount?.openCount ?? 0) > 99 ? "99+" : supportCount?.openCount}
                </span>
              )}
            </button>
          </Link>
        )}

        {isAdmin && (
          <div className="relative" ref={adminMenu.ref}>
            <button
              onClick={adminMenu.toggle}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-150 select-none
                ${isActive("/admin") || adminMenu.open
                  ? "bg-amber-500/15 text-amber-300"
                  : "text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10"}`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Admin
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${adminMenu.open ? "rotate-180" : ""}`} />
            </button>

            {adminMenu.open && (
              <Panel className="top-full mt-2 right-0 left-auto min-w-[210px] py-1.5">
                <CascadeItem
                  href="/admin/financeiro"
                  icon={DollarSign}
                  label="Controle Financeiro"
                  sub="Pagamentos e receitas"
                  active={isActive("/admin/financeiro")}
                  onNavigate={adminMenu.close}
                />
                <CascadeItem
                  href="/admin/usuarios"
                  icon={Users}
                  label="Usuários"
                  sub="Gestão de contas"
                  active={isActive("/admin/usuarios")}
                  onNavigate={adminMenu.close}
                />
                <CascadeItem
                  href="/admin/tabelas-fiscais"
                  icon={Table2}
                  label="Tabelas Fiscais"
                  sub="INSS / IRRF trabalhista"
                  active={isActive("/admin/tabelas-fiscais")}
                  onNavigate={adminMenu.close}
                />
                <CascadeItem
                  href="/admin/suporte"
                  icon={LifeBuoy}
                  label="Chamados de Suporte"
                  sub="Gerenciar tickets técnicos"
                  active={isActive("/admin/suporte")}
                  onNavigate={adminMenu.close}
                />
                <CascadeItem
                  href="/admin/educacional"
                  icon={GraduationCap}
                  label="Plano Educacional"
                  sub="Gestão de assinantes IFES"
                  active={isActive("/admin/educacional")}
                  onNavigate={adminMenu.close}
                />
              </Panel>
            )}
          </div>
        )}

        <div className="w-px h-6 bg-white/10 mx-1" />

        {/* User menu */}
        <div className="relative" ref={userMenu.ref}>
          <button
            onClick={userMenu.toggle}
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl hover:bg-white/5 transition-all duration-150 select-none"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-blue-300">{userInitials}</span>
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-[11px] font-semibold text-white/80 leading-tight max-w-[110px] truncate">
                {user?.nome ?? user?.email}
              </p>
              <p className="text-[9px] text-white/30 leading-tight">
                {isAdmin ? "Administrador" : "Usuário"}
              </p>
            </div>
            <ChevronDown className={`w-3 h-3 text-white/30 transition-transform duration-200 ${userMenu.open ? "rotate-180" : ""}`} />
          </button>

          {userMenu.open && (
            <Panel className="top-full mt-2 right-0 left-auto min-w-[210px]">
              <div className="px-4 py-3 border-b border-white/[0.07]">
                <p className="text-sm font-semibold text-white/85 truncate">{user?.nome ?? "Usuário"}</p>
                <p className="text-[11px] text-white/35 truncate mt-0.5">{user?.email}</p>
                <span className={`inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full font-semibold
                  ${isAdmin ? "bg-amber-500/20 text-amber-300" : "bg-blue-500/15 text-blue-300"}`}>
                  {isAdmin ? "Administrador" : (planSlug ?? "Free")}
                </span>
              </div>
              <div className="py-1.5">
                <CascadeItem href="/perfil" icon={User} label="Meu Perfil" onNavigate={userMenu.close} />
                <CascadeItem href="/planos" icon={Crown} label="Planos" onNavigate={userMenu.close} />
                <CascadeItem href="/equipe" icon={Users} label="Minha Equipe" onNavigate={userMenu.close} />
                <CascadeItem href="/creditos" icon={Coins} label="Meus Créditos" onNavigate={userMenu.close} />
              </div>
              <div className="border-t border-white/[0.07] py-1.5">
                <button
                  onClick={() => { userMenu.close(); logout(); }}
                  className="flex items-center gap-3 px-4 py-2.5 w-full text-left text-sm text-white/60 hover:text-red-400 hover:bg-red-500/8 transition-colors duration-100 select-none"
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium">Sair da conta</span>
                </button>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </header>
  );
}
