import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch, setOnUnauthorized } from './api';
import { saveSession, loadSession, clearSession, type StoredSession } from './session';
import type { LoginResponse, UserProfile } from '../types/api';

interface AuthContextValue {
  session: StoredSession | null;
  isLoading: boolean;
  accessToken: string | null;
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persist = useCallback(async (s: StoredSession | null) => {
    setSession(s);
    if (s) {
      await saveSession(s);
    } else {
      await clearSession();
    }
  }, []);

  const logout = useCallback(async () => {
    await persist(null);
  }, [persist]);

  // Bootstrap: load stored session and validate with /auth/me
  useEffect(() => {
    void (async () => {
      try {
        const stored = await loadSession();
        if (!stored) return;
        // Validate the stored token before trusting it
        const user = await apiFetch<UserProfile>('/auth/me', {
          token: stored.accessToken,
        });
        setSession({ ...stored, user });
      } catch {
        await clearSession();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      void logout();
    });
  }, [logout]);

  const login = useCallback(
    async (email: string, password: string, tenantSlug: string) => {
      const res = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, tenantSlug }),
      });
      const newSession: StoredSession = {
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
      };
      await persist(newSession);
    },
    [persist],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
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
