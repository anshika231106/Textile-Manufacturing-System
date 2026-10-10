import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, DEMO_USERS } from '../../lib/auth';
import { ApiError } from '../../lib/api';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

const ROLE_HOME: Record<string, string> = {
  OWNER:       '/',
  OFFICE:      '/orders',
  SUPERVISOR:  '/floor',
  STOREKEEPER: '/stock',
};

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      const normalizedEmail = email.toLowerCase().trim();
      const role = DEMO_USERS[normalizedEmail]?.role ?? 'OWNER';
      navigate(ROLE_HOME[role] ?? '/');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_CREDENTIALS') {
          setError('Incorrect email or password. Please try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Unable to connect. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8] px-4 py-12">
      <div className="w-full max-w-[460px]">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#EA580C] mb-4 shadow-md shadow-[#EA580C]/20">
            <span className="text-white text-xl font-bold tracking-tight">MT</span>
          </div>
          <h1 className="text-3xl font-bold text-[#1A1714] tracking-tight">MillTrace</h1>
          <p className="mt-1.5 text-sm text-[#78716C] font-normal">
            Everest Textile Mills — Staff Portal
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E8E4DF] rounded-2xl shadow-sm p-8 sm:p-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-[#1A1714]">Sign in to continue</h2>
            <button
              type="button"
              onClick={() => {
                setEmail('owner@everest.com');
                setPassword('password');
                setError('');
              }}
              className="text-xs font-medium text-[#EA580C] bg-[#FFF7ED] border border-[#EA580C]/20 hover:bg-[#FFEDD5] px-2.5 py-1 rounded-md transition-colors"
            >
              Fill Admin
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <Input
              id="login-email"
              label="Email address"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              placeholder="you@example.com"
            />
            <Input
              id="login-password"
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="••••••••"
            />

            {error && (
              <div className="rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] px-4 py-3">
                <p className="text-sm text-[#DC2626]">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              disabled={!email || !password}
              className="w-full mt-2 py-3 text-base font-semibold"
            >
              Sign in
            </Button>
          </form>

          {/* Quick Demo Selector */}
          <div className="mt-6 pt-5 border-t border-[#E8E4DF]/70">
            <p className="text-xs font-medium text-[#78716C] mb-2.5">Demo Accounts (Click to fill):</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail('owner@everest.com');
                  setPassword('password');
                  setError('');
                }}
                className="text-left px-2.5 py-1.5 rounded-lg border border-[#E8E4DF] hover:border-[#EA580C]/40 hover:bg-[#FFF7ED]/50 transition-colors"
              >
                <p className="text-xs font-semibold text-[#1A1714]">👑 Admin / Owner</p>
                <p className="text-[11px] text-[#78716C] truncate">owner@everest.com</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('office@everest.com');
                  setPassword('password');
                  setError('');
                }}
                className="text-left px-2.5 py-1.5 rounded-lg border border-[#E8E4DF] hover:border-[#EA580C]/40 hover:bg-[#FFF7ED]/50 transition-colors"
              >
                <p className="text-xs font-semibold text-[#1A1714]">📋 Office Staff</p>
                <p className="text-[11px] text-[#78716C] truncate">office@everest.com</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('supervisor@everest.com');
                  setPassword('password');
                  setError('');
                }}
                className="text-left px-2.5 py-1.5 rounded-lg border border-[#E8E4DF] hover:border-[#EA580C]/40 hover:bg-[#FFF7ED]/50 transition-colors"
              >
                <p className="text-xs font-semibold text-[#1A1714]">🏭 Supervisor</p>
                <p className="text-[11px] text-[#78716C] truncate">supervisor@everest.com</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('store@everest.com');
                  setPassword('password');
                  setError('');
                }}
                className="text-left px-2.5 py-1.5 rounded-lg border border-[#E8E4DF] hover:border-[#EA580C]/40 hover:bg-[#FFF7ED]/50 transition-colors"
              >
                <p className="text-xs font-semibold text-[#1A1714]">📦 Storekeeper</p>
                <p className="text-[11px] text-[#78716C] truncate">store@everest.com</p>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-[#A8A29E] mt-6">
          Internal staff access only. Contact your manager for credentials.
        </p>
      </div>
    </div>
  );
}
