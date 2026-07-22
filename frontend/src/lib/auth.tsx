import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setAccessToken, setUnauthenticatedHandler } from "./api";

export type Role = "ADMIN" | "OPERADOR" | "VENDEDOR";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, senha: string) => Promise<AuthUser>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("wpp_refresh_token");
    }
    setAccessToken(null);
    setUser(null);
    // Force navigation to login — used both by explicit logout and expired session
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  useEffect(() => {
    setUnauthenticatedHandler(logout);
  }, []);

  // Restore session on page load using the stored refreshToken
  useEffect(() => {
    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    const refreshToken = localStorage.getItem("wpp_refresh_token");
    if (!refreshToken) {
      setIsLoading(false);
      return;
    }

    fetch("http://localhost:3000/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("refresh_failed"))))
      .then(async (raw) => {
        // Unwrap envelope if present
        const at: string = raw?.data?.accessToken ?? raw?.accessToken;
        if (!at) throw new Error("no_token");
        setAccessToken(at);
        // Fetch current user
        const me = await api<AuthUser>("/auth/me");
        setUser(me);
      })
      .catch(() => {
        localStorage.removeItem("wpp_refresh_token");
        setAccessToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, senha: string): Promise<AuthUser> => {
    const resp = await api<{ accessToken: string; refreshToken: string; user: AuthUser }>(
      "/auth/login",
      { method: "POST", body: { email, senha } }
    );

    localStorage.setItem("wpp_refresh_token", resp.refreshToken);
    setAccessToken(resp.accessToken);
    setUser(resp.user);
    return resp.user;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Kept for the login page UI hint section
export const DEMO_CREDENTIALS = [
  { label: "Admin", email: "admin@wpp-autoflow.com", senha: "admin123" },
  { label: "Operador", email: "op@wpp.io", senha: "op" },
  { label: "Vendedor", email: "vendedor@wpp.io", senha: "vendedor" },
];
