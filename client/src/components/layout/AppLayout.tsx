import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Nav } from './Nav';
import { useAuth } from '../../lib/auth';
import {
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

interface AppLayoutProps {
  children: ReactNode;
  pageTitle?: string;
}

export function AppLayout({ children, pageTitle }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-(--color-bg)">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/35 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'flex-shrink-0 flex flex-col border-r border-(--color-border) bg-white overflow-hidden',
          'fixed inset-y-0 left-0 z-40 transition-transform duration-200 lg:relative lg:z-auto lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{
          width: collapsed ? 'var(--sidebar-w-mini)' : 'var(--sidebar-w)',
          transition: 'width 200ms ease, transform 200ms ease',
        }}
      >
        {/* Brand */}
        <div
          className="flex items-center gap-3 px-4 border-b border-(--color-border)"
          style={{ height: 'var(--topbar-h)', minHeight: 'var(--topbar-h)' }}
        >
          <Link
            to="/dashboard"
            onClick={() => setMobileOpen(false)}
            aria-label="MillTrace dashboard"
            className="flex min-w-0 items-center"
          >
            <img
              src="/logo.png"
              alt="MillTrace"
              className={`flex-shrink-0 object-contain ${collapsed ? 'w-8 h-8' : 'w-36 h-12'}`}
            />
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto lg:hidden text-(--color-text-muted) hover:text-(--color-text) p-1 rounded-md"
            aria-label="Close menu"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-3">
          <Nav collapsed={collapsed} />
        </div>

        {/* User info + collapse toggle */}
        <div className="border-t border-(--color-border) p-3 flex flex-col gap-2">
          {/* User */}
          <div
            className={[
              'flex items-center gap-2 rounded-lg px-2 py-1.5',
              collapsed ? 'justify-center' : '',
            ].join(' ')}
          >
            <UserCircleIcon className="w-5 h-5 text-(--color-text-muted) shrink-0" />
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-xs font-medium text-(--color-text) truncate">{user?.name}</p>
                <p className="text-xs text-(--color-text-muted) truncate capitalize">{user?.role?.toLowerCase()}</p>
              </div>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            title="Sign out"
            className={[
              'flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-(--color-text-muted)',
              'hover:bg-(--color-danger-light) hover:text-(--color-danger) transition-colors duration-150',
              collapsed ? 'justify-center' : '',
            ].join(' ')}
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>

          {/* Collapse toggle - desktop only, the mobile sidebar is a full-width drawer */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={[
              'hidden lg:flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-(--color-text-muted)',
              'hover:bg-(--color-surface-sunken) hover:text-(--color-text) transition-colors duration-150',
              collapsed ? 'justify-center' : '',
            ].join(' ')}
          >
            <Bars3Icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header
          className="flex-shrink-0 flex items-center gap-3 px-4 lg:px-6 border-b border-(--color-border) bg-white"
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
