import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api } from './api';

export type Role = 'OWNER' | 'OFFICE' | 'SUPERVISOR' | 'STAFF';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = 'milltrace_token';
const REFRESH_TOKEN_KEY = 'milltrace_refresh_token';

function saveTokens(accessToken: string, refreshToken?: string) {
  try {
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  } catch {
    /* blocked */
  }
}

function clearTokens() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    /* blocked */
  }
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function readRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const stored = readToken();
    const storedRefresh = readRefreshToken();

    if (!stored && !storedRefresh) {
      setLoading(false);
      return;
    }

    if (stored) {
      setToken(stored);
    }

    api<User>('/auth/me')
      .then((u) => setUser(u))
      .catch(() => {
        clearTokens();
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const res = await api<{
      token: string;
      accessToken?: string;
      refreshToken?: string;
      user: User;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      auth: false,
    });

    const accessToken = res.accessToken || res.token;
    saveTokens(accessToken, res.refreshToken);
    setToken(accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    const currentRefresh = readRefreshToken();
    if (currentRefresh) {
      api('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: currentRefresh }),
        auth: false,
      }).catch(() => {});
    }

    clearTokens();
    setToken(null);
    setUser(null);
  }, []);


  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
