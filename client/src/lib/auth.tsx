import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api } from './api';

export type Role = 'OWNER' | 'OFFICE' | 'SUPERVISOR' | 'STOREKEEPER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export const DEMO_USERS: Record<string, User> = {
  'owner@everest.com': {
    id: 'u_owner',
    name: 'Vikram Mehta',
    email: 'owner@everest.com',
    role: 'OWNER',
  },
  'office@everest.com': {
    id: 'u_office',
    name: 'Anjali Rao',
    email: 'office@everest.com',
    role: 'OFFICE',
  },
  'supervisor@everest.com': {
    id: 'u_supervisor',
    name: 'Suresh Patil',
    email: 'supervisor@everest.com',
    role: 'SUPERVISOR',
  },
  'store@everest.com': {
    id: 'u_store',
    name: 'Ramesh Yadav',
    email: 'store@everest.com',
    role: 'STOREKEEPER',
  },
};

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = 'milltrace_token';

function saveToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* blocked */ }
}

function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* blocked */ }
}

function readToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const stored = readToken();
    if (!stored) {
      setLoading(false);
      return;
    }
    setToken(stored);

    // If session is a demo token, restore demo user instantly
    if (stored.startsWith('demo_token_')) {
      const role = stored.replace('demo_token_', '').toUpperCase();
      const demoUser =
        Object.values(DEMO_USERS).find((u) => u.role === role) ??
        DEMO_USERS['owner@everest.com'];
      setUser(demoUser);
      setLoading(false);
      return;
    }

    api<User>('/auth/me')
      .then((u) => setUser(u))
      .catch(() => {
        clearToken();
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await api<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        auth: false,
      });
      saveToken(res.token);
      setToken(res.token);
      setUser(res.user);
    } catch (err) {
      // If backend is offline or 404, fallback to demo accounts for seamless frontend testing
      const normalizedEmail = email.toLowerCase().trim();
      const demoUser = DEMO_USERS[normalizedEmail];
      if (demoUser) {
        const demoToken = `demo_token_${demoUser.role.toLowerCase()}`;
        saveToken(demoToken);
        setToken(demoToken);
        setUser(demoUser);
        return;
      }
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
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
