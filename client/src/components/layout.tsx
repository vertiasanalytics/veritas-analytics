import React from "react";
import { Link, useLocation } from "wouter";
import { Scale, LayoutDashboard, KeyRound, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/recover", label: "Recuperar Caso", icon: KeyRound },
  ];

  return (
    <div className="min-h-screen flex bg-background/50">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-primary text-primary-foreground border-r border-border/10 shadow-2xl z-10">
        <div className="p-8 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/20">
            <Scale className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl tracking-wide text-white">JurisCalc<span className="text-accent">Pro</span></h1>
            <p className="text-xs text-primary-foreground/60 uppercase tracking-widest mt-0.5">Federal</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex items-center gap-4 px-4 py-3.5 rounded-xl font-medium transition-all duration-200 group",
                location === item.href 
                  ? "bg-white/10 text-white shadow-inner" 
                  : "text-primary-foreground/70 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className={cn("w-5 h-5", location === item.href ? "text-accent" : "text-primary-foreground/50 group-hover:text-accent/70")} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-6">
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <h4 className="text-sm font-semibold text-white mb-2">Suporte Técnico</h4>
            <p className="text-xs text-primary-foreground/60 leading-relaxed">Dúvidas sobre critérios ou cálculos? Acesse o manual.</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-primary text-primary-foreground shadow-md">
          <div className="flex items-center gap-3">
            <Scale className="w-6 h-6 text-accent" />
            <span className="font-display font-bold text-lg">JurisCalc Pro</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
