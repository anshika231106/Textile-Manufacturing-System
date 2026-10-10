import { useState } from 'react';
import type { ReactNode } from 'react';
import { Nav } from './Nav';
import { useAuth } from '../../lib/auth';
import {
  Bars3Icon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

interface AppLayoutProps {
  children: ReactNode;
  pageTitle?: string;
}

export function AppLayout({ children, pageTitle }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAF8]">
      {/* Sidebar */}
      <aside
        className="flex-shrink-0 flex flex-col border-r border-[#E8E4DF] bg-white overflow-hidden"
        style={{
          width: collapsed ? '64px' : '240px',
          transition: 'width 200ms ease',
        }}
      >
        {/* Brand */}
        <div
          className="flex items-center gap-3 px-4 border-b border-[#E8E4DF]"
          style={{ height: '56px', minHeight: '56px' }}
        >
          <div className="flex-shrink-0 w-7 h-7 rounded-md bg-[#EA580C] flex items-center justify-center">
            <span className="text-white text-xs font-bold tracking-tight">MT</span>
          </div>
          {!collapsed && (
            <span className="text-sm font-bold text-[#1A1714] tracking-tight whitespace-nowrap overflow-hidden">
              MillTrace
            </span>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-3">
          <Nav collapsed={collapsed} />
        </div>

        {/* User info + collapse toggle */}
        <div className="border-t border-[#E8E4DF] p-3 flex flex-col gap-2">
          {/* User */}
          <div
            className={[
              'flex items-center gap-2 rounded-lg px-2 py-1.5',
              collapsed ? 'justify-center' : '',
            ].join(' ')}
          >
            <UserCircleIcon className="w-5 h-5 text-[#78716C] shrink-0" />
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#1A1714] truncate">{user?.name}</p>
                <p className="text-xs text-[#78716C] truncate capitalize">{user?.role?.toLowerCase()}</p>
              </div>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            title="Sign out"
            className={[
              'flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[#78716C]',
              'hover:bg-[#FEF2F2] hover:text-[#DC2626] transition-colors duration-150',
              collapsed ? 'justify-center' : '',
            ].join(' ')}
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={[
              'flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[#78716C]',
              'hover:bg-[#F5F4F2] hover:text-[#1A1714] transition-colors duration-150',
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
          className="flex-shrink-0 flex items-center px-6 border-b border-[#E8E4DF] bg-white"
          style={{ height: '56px' }}
        >
          {pageTitle && (
            <h1 className="text-sm font-semibold text-[#1A1714]">{pageTitle}</h1>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="page-content max-w-7xl mx-auto px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
