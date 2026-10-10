import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
  WrenchScrewdriverIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../lib/auth';
import { ApiError } from '../../lib/api';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

const DEMO_ACCOUNTS = [
  { label: 'Admin / Owner', email: 'owner@everest.com', icon: ShieldCheckIcon },
  { label: 'Office Staff', email: 'office@everest.com', icon: ClipboardDocumentListIcon },
  { label: 'Supervisor', email: 'supervisor@everest.com', icon: WrenchScrewdriverIcon },
  { label: 'Staff', email: 'staff1@everest.com', icon: UserGroupIcon },
];

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Automatically forward already authenticated users
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  function fillDemoAccount(demoEmail: string) {
    setEmail(demoEmail);
    setPassword('password');
    setError('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
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
    <div className="relative min-h-screen flex items-center justify-center bg-(--color-bg) px-4 py-12 overflow-hidden textile-dots">
      <ThemeToggle className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6" />
      {/* Soft brand glow, echoing the Landing hero without competing with the form */}
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[640px] h-[320px] rounded-full bg-(--color-accent)/10 blur-3xl pointer-events-none"
        aria-hidden
      />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[460px]"
      >
        {/* Brand */}
        <div className="text-center mb-8">
          <Link to="/dashboard" aria-label="MillTrace dashboard" className="inline-block">
            <img src="/logo.png" alt="MillTrace" className="w-56 h-28 object-contain mx-auto" />
          </Link>
          <p className="mt-1.5 text-sm text-(--color-text-muted) font-normal">
            Everest Textile Mills — Staff Portal
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-(--color-border) rounded-3xl shadow-xl p-8 sm:p-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-(--color-text)">Sign in to continue</h2>
            <button
              type="button"
              onClick={() => fillDemoAccount('owner@everest.com')}
              className="text-xs font-medium text-(--color-accent) bg-(--color-accent-light) border border-(--color-accent)/20 hover:bg-[#FFEDD5] px-2.5 py-1 rounded-md transition-colors"
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
              <div className="rounded-lg bg-(--color-danger-light) border border-(--color-danger-border) px-4 py-3">
                <p className="text-sm text-(--color-danger)">{error}</p>
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
          <div className="mt-6 pt-5 border-t border-(--color-border)/70">
            <p className="text-xs font-medium text-(--color-text-muted) mb-2.5">Demo Accounts (Click to fill):</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map(({ label, email: demoEmail, icon: Icon }) => (
                <button
                  key={demoEmail}
                  type="button"
                  onClick={() => fillDemoAccount(demoEmail)}
                  className="flex items-center gap-2.5 text-left px-2.5 py-2 rounded-lg border border-(--color-border) hover:border-(--color-accent)/40 hover:bg-(--color-accent-light)/50 transition-colors"
                >
                  <span className="flex items-center justify-center w-7 h-7 rounded-md bg-(--color-accent-light) text-(--color-accent) shrink-0">
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <p className="text-xs font-semibold text-(--color-text) truncate">{label}</p>
                    <p className="text-[11px] text-(--color-text-muted) truncate">{demoEmail}</p>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-(--color-text-subtle) mt-6">
          Internal staff access only. Contact your manager for credentials.
        </p>
      </motion.div>
    </div>
  );
}
