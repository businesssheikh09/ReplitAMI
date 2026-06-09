import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useLocation } from "wouter";

interface AuthContextType {
  token: string | null;
  setToken: (token: string | null) => void;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => {
    return localStorage.getItem("umrah_token");
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

  const logout = () => {
    setToken(null);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ token, setToken, isAuthenticated: !!token, logout }}>
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
