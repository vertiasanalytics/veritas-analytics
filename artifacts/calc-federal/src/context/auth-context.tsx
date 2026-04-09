import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface AuthUser {
  id: number;
  nome: string;
  email: string;
  role: "admin" | "user" | "demo" | "convenio";
  tipoPessoa?: string;
  profissao?: string;
  // Campos exclusivos de usuário conveniado
  convenioUserId?: string;
  convenioId?: string;
  convenioNome?: string;
  convenioStatus?: string;
  convenioDataFim?: string;
  creditosDisponiveis?: number;
  creditosUtilizadosTotal?: number;
  primeiroAcessoPendente?: boolean;
  redefinirSenhaObrigatoria?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isDemo: boolean;
  isConvenio: boolean;
  login: (email: string, senha: string) => Promise<AuthUser>;
  loginConvenio: (email: string, senha: string) => Promise<AuthUser>;
  loginDemo: () => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchMe(tk: string): Promise<AuthUser | null> {
    try {
      const res = await fetch(`${BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem("veritas_token");
    if (stored) {
      setToken(stored);
      fetchMe(stored).then((u) => {
        setUser(u);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email: string, senha: string): Promise<AuthUser> {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao fazer login");
    localStorage.setItem("veritas_token", data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user as AuthUser;
  }

  async function loginConvenio(email: string, senha: string): Promise<AuthUser> {
    const res = await fetch(`${BASE}/api/auth/login-convenio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao fazer login");
    localStorage.setItem("veritas_token", data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user as AuthUser;
  }

  async function loginDemo() {
    const res = await fetch(`${BASE}/api/auth/demo`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao entrar no modo demo");
    localStorage.setItem("veritas_token", data.token);
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem("veritas_token");
    setToken(null);
    setUser(null);
    window.location.href = `${BASE}/login`;
  }

  async function refreshUser() {
    const tk = localStorage.getItem("veritas_token");
    if (!tk) return;
    const u = await fetchMe(tk);
    setUser(u);
  }

  const isDemo = user?.role === "demo";
  const isConvenio = user?.role === "convenio";

  return (
    <AuthContext.Provider value={{ user, token, loading, isDemo, isConvenio, login, loginConvenio, loginDemo, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("veritas_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
