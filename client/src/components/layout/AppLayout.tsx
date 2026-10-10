import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Nav } from './Nav';
import { useAuth } from '../../lib/auth';
import { ThemeToggle } from '../ui/ThemeToggle';
import {
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
} from '@heroicons/react/24/outline';

interface AppLayoutProps {
  children: ReactNode;
  pageTitle?: string;
}

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function AppLayout({ children, pageTitle }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // The nav scrolls without a visible scrollbar; fade the edge(s) that have more content beyond them.
  const navScrollRef = useRef<HTMLDivElement>(null);
  const [navFade, setNavFade] = useState({ top: false, bottom: false });
  const updateNavFade = useCallback(() => {
    const el = navScrollRef.current;
    if (!el) return;
    const top = el.scrollTop > 2;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setNavFade((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
  }, []);

  useEffect(() => {
    const el = navScrollRef.current;
    if (!el) return;
    updateNavFade();
    const observer = new ResizeObserver(updateNavFade);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [updateNavFade, collapsed]);

  return (
    <div className="flex h-screen overflow-hidden bg-(--color-bg)">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/35 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar - a floating glass panel inset from the page edge */}
      <aside
        className={[
          'flex-shrink-0 flex flex-col p-3 lg:pr-0',
          'fixed inset-y-0 left-0 z-40 transition-transform duration-200 lg:relative lg:z-20 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{
          width: collapsed ? 'var(--sidebar-w-mini)' : 'var(--sidebar-w)',
          transition: 'width 200ms ease, transform 200ms ease',
        }}
      >
        <div className="app-sidebar-panel flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border border-(--color-border) bg-(--color-surface)/80 backdrop-blur-xl shadow-lg shadow-stone-900/5">
          {/* Brand */}
          <div className={['flex items-center gap-3 pt-4 pb-3', collapsed ? 'justify-center' : 'px-4'].join(' ')}>
            <Link
              to="/dashboard"
              onClick={() => setMobileOpen(false)}
              aria-label="MillTrace dashboard"
              className="flex min-w-0 items-center group"
            >
              <img
                src={collapsed ? '/fevicon.png' : '/logo.png'}
                alt="MillTrace"
                className={[
                  'flex-shrink-0 object-contain transition-transform duration-200 group-hover:scale-[1.03]',
                  collapsed ? 'w-8 h-8' : 'h-14 w-auto -my-2',
                ].join(' ')}
              />
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
              className="ml-auto lg:hidden text-(--color-text-muted) hover:text-(--color-text) p-1.5 rounded-full hover:bg-(--color-surface-sunken)"
              aria-label="Close menu"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <div
            ref={navScrollRef}
            onScroll={updateNavFade}
            className={[
              'sidebar-scroll flex-1 overflow-y-auto overflow-x-hidden py-2',
              navFade.top ? 'fade-top' : '',
              navFade.bottom ? 'fade-bottom' : '',
            ].join(' ')}
          >
            <Nav collapsed={collapsed} />
          </div>

          {/* User card */}
          <div className="p-2.5">
            <div
              className={[
                'flex items-center gap-2.5 rounded-xl bg-(--color-surface-sunken) p-2',
                collapsed ? 'flex-col' : '',
              ].join(' ')}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--color-accent) text-[11px] font-bold text-white shadow-sm ring-2 ring-(--color-surface)"
                title={collapsed ? `${user?.name ?? ''} (${user?.role?.toLowerCase() ?? ''})` : undefined}
              >
                {initials(user?.name)}
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-(--color-text) truncate">{user?.name}</p>
                  <span className="mt-0.5 inline-block rounded-full bg-(--color-accent-light) px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-(--color-accent)">
                    {user?.role?.toLowerCase()}
                  </span>
                </div>
              )}
              <button
                onClick={logout}
                title="Sign out"
                aria-label="Sign out"
                className="shrink-0 rounded-lg p-1.5 text-(--color-text-muted) transition-colors duration-150 hover:bg-(--color-danger-light) hover:text-(--color-danger)"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Collapse toggle - desktop only, sits on the panel's edge */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:flex absolute top-9 -right-3 h-6 w-6 items-center justify-center rounded-full border border-(--color-border) bg-(--color-surface) text-(--color-text-muted) shadow-sm transition-colors duration-150 hover:text-(--color-accent) hover:border-(--color-accent)/40"
        >
          <ChevronLeftIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header
          className="flex-shrink-0 flex items-center gap-3 px-4 lg:px-6 border-b border-(--color-border)/70"
          style={{ height: 'var(--topbar-h)' }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden -ml-1.5 p-1.5 rounded-md text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-sunken)"
            aria-label="Open menu"
          >
            <Bars3Icon className="w-5 h-5" />
          </button>
          {pageTitle && (
            <h1 className="text-sm font-semibold text-(--color-text)">{pageTitle}</h1>
          )}
          <ThemeToggle className="ml-auto" />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="max-w-7xl mx-auto px-6 py-8"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
