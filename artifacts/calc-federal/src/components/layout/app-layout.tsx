import { AppTopNav } from "./app-topnav";
import { DemoBanner } from "@/components/ui/demo-banner";
import { useAuth } from "@/context/auth-context";
import { useLocation } from "wouter";

const FULLSCREEN_ROUTES = ["/controladoria-juridica"];
const DEMO_BANNER_HEIGHT = 40;
const NAV_HEIGHT = 64;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isDemo } = useAuth();
  const isFullscreen = FULLSCREEN_ROUTES.some(
    (r) => location === r || location.startsWith(r + "/"),
  );

  const topPad = isDemo ? NAV_HEIGHT + DEMO_BANNER_HEIGHT : NAV_HEIGHT;

  return (
    <div className="flex flex-col min-h-screen w-full bg-background font-sans selection:bg-primary/30 text-foreground">
      {/* Fixed top navigation */}
      <AppTopNav />

      {/* Demo banner — shown just below the nav when in demo mode */}
      <DemoBanner />

      {/* Content area — padded below nav (+ demo banner when active) */}
      {isFullscreen ? (
        /* Fullscreen mode — Controladoria fills entire remaining height */
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ paddingTop: `${topPad}px` }}>
          {children}
        </main>
      ) : (
        /* Normal mode — padded content with background pattern */
        <main className="flex-1 overflow-y-auto relative" style={{ paddingTop: `${topPad}px` }}>
          <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8 lg:px-8">
            {children}
          </div>
        </main>
      )}
    </div>
  );
}
