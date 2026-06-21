import { useState, useEffect, useCallback } from "react";

export interface PortalUser {
  id: number;
  type: "party" | "dc";
  status: string;
  fullName: string;
  email: string | null;
  phone: string;
}

const TOKEN_KEY = "portal_token";
const USER_KEY = "portal_user";

export function getPortalToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getPortalUser(): PortalUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function savePortalSession(token: string, user: PortalUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearPortalSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function usePortalAuth() {
  const [user, setUser] = useState<PortalUser | null>(getPortalUser);
  const [token, setToken] = useState<string | null>(getPortalToken);

  const login = useCallback((newToken: string, newUser: PortalUser) => {
    savePortalSession(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    const t = getPortalToken();
    if (t) {
      await fetch("/api/portal/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
      }).catch(() => {});
    }
    clearPortalSession();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const sync = () => {
      setToken(getPortalToken());
      setUser(getPortalUser());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  return { user, token, isAuthenticated: !!token && !!user, login, logout };
}
