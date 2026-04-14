import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, type AuthUser } from "@/lib/api";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (name: string, email: string, phone: string, password: string, language: string, role: string) => Promise<AuthUser>;
  logout: () => void;
  isUser: boolean;
  isCHW: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (api.getToken()) {
      api.getMe().then(setUser).catch(() => {
        api.setToken(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password });
    api.setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (name: string, email: string, phone: string, password: string, language: string, role: string) => {
    const res = await api.register({ name, email, phone, password, language, role });
    api.setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    api.setToken(null);
    setUser(null);
  }, []);

  const isUser = user?.role === "mental_health_user";
  const isCHW = user?.role === "community_health_worker";

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isUser, isCHW }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
