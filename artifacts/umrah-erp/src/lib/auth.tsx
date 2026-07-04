import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useLocation } from "wouter";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  isActive: boolean;
  canIssueTickets: boolean;
  ticketingPin?: string | null;
  mustChangePassword?: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  setToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => {
    return localStorage.getItem("umrah_token");
  });
  const [user, setUserState] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem("umrah_user");
    if (stored) {
      try { return JSON.parse(stored); } catch { return null; }
    }
    return null;
  });
  const [, setLocation] = useLocation();

  const setToken = (newToken: string | null) => {
    if (newToken) {
      localStorage.setItem("umrah_token", newToken);
    } else {
      localStorage.removeItem("umrah_token");
    }
    setTokenState(newToken);
  };

  const setUser = (newUser: AuthUser | null) => {
    if (newUser) {
      localStorage.setItem("umrah_user", JSON.stringify(newUser));
    } else {
      localStorage.removeItem("umrah_user");
    }
    setUserState(newUser);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setLocation("/login");
  };

  useEffect(() => {
    if (token && !user) {
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data) setUser(data); })
        .catch(() => {});
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => {
          if (!r.ok) { setToken(null); setUser(null); setLocation("/login"); }
        })
        .catch(() => {});
    }, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setToken(null);
        setUser(null);
        setLocation("/login");
      }, 10 * 60 * 1000);
    };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, user, setToken, setUser, isAuthenticated: !!token, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
