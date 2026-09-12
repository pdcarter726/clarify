"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  authApi,
  clearToken,
  getToken,
  setToken,
  usersApi,
  type User,
} from "./api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Owns the current user's session: holds the fetched `User` (via `/users/me`)
 * and a `loading` flag while that initial check runs, and exposes
 * login/signup/logout/refreshUser which read/write the access token in
 * `localStorage` (through lib/api.ts) and re-fetch the user accordingly.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      const me = await usersApi.me();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Only async work runs synchronously here; setState calls happen after
    // an await, so this isn't the cascading-render pattern the rule guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken } = await authApi.login(email, password);
    setToken(accessToken);
    await refreshUser();
  }, [refreshUser]);

  const signup = useCallback(async (email: string, password: string) => {
    const { accessToken } = await authApi.signup(email, password);
    setToken(accessToken);
    await refreshUser();
  }, [refreshUser]);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Accesses the current `AuthContextValue`; throws if called outside `AuthProvider`. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
