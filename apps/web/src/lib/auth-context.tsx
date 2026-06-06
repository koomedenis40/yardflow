'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { AuthMeResponse, AuthTokens } from '@yardflow/types';
import { apiFetch, setOnUnauthorized } from './api';
import type { SessionState } from './types';

const STORAGE_KEY = 'yardflow.session';

interface AuthContextValue {
  session: SessionState | null;
  isLoading: boolean;
  isAuthReady: boolean;
  accessToken: string | null;
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  logout: () => void;
  hasPermission: (perm: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const readStored = (): SessionState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SessionState) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persist = useCallback((s: SessionState | null) => {
    setSession(s);
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const logout = useCallback(() => {
    persist(null);
    router.replace('/login');
  }, [persist, router]);

  useEffect(() => {
    const stored = readStored();
    if (!stored?.accessToken) {
      setIsLoading(false);
      return;
    }
    apiFetch<AuthMeResponse>('/auth/me', { token: stored.accessToken })
      .then((user) => {
        persist({ ...stored, user });
      })
      .catch(() => {
        persist(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [persist]);

  useEffect(() => {
    setOnUnauthorized(logout);
  }, [logout]);

  const login = useCallback(
    async (email: string, password: string, tenantSlug: string) => {
      const res = await apiFetch<AuthTokens & { user: AuthMeResponse }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, tenantSlug }),
      });
      persist({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
      });
      router.replace(`/${tenantSlug}/dashboard`);
    },
    [persist, router],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      isAuthReady: !isLoading && !!session?.accessToken,
      accessToken: session?.accessToken ?? null,
      login,
      logout,
      hasPermission: (perm) => session?.user.permissions.includes(perm) ?? false,
    }),
    [session, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth requires AuthProvider');
  return ctx;
};
