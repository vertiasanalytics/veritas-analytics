import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth-context";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const THROTTLE_MS = 10_000;

export function useTrackAccess() {
  const [location] = useLocation();
  const { user } = useAuth();
  const lastTracked = useRef<string>("");
  const lastTime = useRef<number>(0);

  useEffect(() => {
    const fullPath = location + window.location.search;
    const now = Date.now();
    const key = fullPath + "|" + (user?.id ?? "anon");

    if (key === lastTracked.current && now - lastTime.current < THROTTLE_MS) return;
    lastTracked.current = key;
    lastTime.current = now;

    const payload: Record<string, unknown> = { pagina: fullPath };
    if (user?.id) payload.userId = user.id;

    fetch(`${BASE}/api/access-logs/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }, [location, user?.id]);
}
