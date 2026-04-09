import { FlaskConical, X } from "lucide-react";
import { useAuth } from "@/context/auth-context";

export function DemoBanner() {
  const { isDemo, logout } = useAuth();
  if (!isDemo) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[40] flex items-center justify-between gap-2 px-4 py-2 text-sm font-semibold"
      style={{
        top: "64px",
        background: "linear-gradient(90deg, #7c3aed, #2563eb)",
        color: "#fff",
        minHeight: "40px",
      }}
    >
      <div className="flex items-center gap-2">
        <FlaskConical size={16} className="shrink-0 opacity-90" />
        <span className="tracking-wide uppercase text-xs font-bold opacity-90">
          Modo Demonstração
        </span>
        <span className="hidden sm:inline text-white/70 text-xs font-normal normal-case">
          — Navegação livre, sem salvar dados reais
        </span>
      </div>

      <button
        type="button"
        onClick={logout}
        className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-white/15 hover:bg-white/30 transition-colors"
        title="Sair da demonstração"
      >
        <X size={12} />
        Sair da demonstração
      </button>
    </div>
  );
}
