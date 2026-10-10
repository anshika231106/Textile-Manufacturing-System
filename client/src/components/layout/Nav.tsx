import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../lib/auth';
import type { Role } from '../../lib/auth';
import { ROUTES } from '../../routes';
import type { RouteConfig } from '../../routes';
import { springIndicator } from '../../lib/motion';

interface NavProps {
  collapsed: boolean;
}

// Sidebar sections, in display order. Routes not listed here fall into "More".
const NAV_SECTIONS: { label: string; paths: string[] }[] = [
  { label: 'Overview', paths: ['/dashboard'] },
  { label: 'Inventory', paths: ['/stock', '/masters'] },
  { label: 'Production', paths: ['/orders', '/floor', '/qc'] },
  { label: 'Fulfilment', paths: ['/dispatch', '/invoices'] },
  { label: 'People', paths: ['/staff', '/attendance'] },
  { label: 'Reports', paths: ['/reports/month-end'] },
];

export function Nav({ collapsed }: NavProps) {
  const { user } = useAuth();
  if (!user) return null;

  const visibleRoutes = ROUTES.filter(
    (r) => r.nav && (r.roles === 'all' || r.roles.includes(user.role as Role))
  );

  const sectioned = new Set(NAV_SECTIONS.flatMap((s) => s.paths));
  const groups = [
    ...NAV_SECTIONS.map((section) => ({
      label: section.label,
      routes: visibleRoutes.filter((r) => section.paths.includes(r.path)),
    })),
    { label: 'More', routes: visibleRoutes.filter((r) => !sectioned.has(r.path)) },
  ].filter((group) => group.routes.length > 0);

  const labelFor = (route: RouteConfig) =>
    user.role === 'STAFF' && route.path === '/floor' ? 'My Machines' : route.label;

  return (
    <nav className="flex flex-col px-2.5">
      {groups.map((group, groupIndex) => (
        <div key={group.label} className={groupIndex > 0 ? 'mt-4' : ''}>
          {collapsed ? (
            groupIndex > 0 && <div className="mx-auto mb-3 h-px w-6 bg-(--color-border)" aria-hidden />
          ) : (
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-(--color-text-subtle)">
              {group.label}
            </p>
          )}

          <div className="flex flex-col gap-0.5">
            {group.routes.map((route) => (
              <NavLink
                key={route.path}
                to={route.path}
                end={route.path === '/dashboard' || route.path === '/'}
                title={labelFor(route)}
                className={({ isActive }) =>
                  [
                    'relative group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors duration-150',
                    isActive
                      ? 'text-(--color-accent) font-semibold'
                      : 'text-(--color-text-muted) hover:bg-(--color-surface-sunken) hover:text-(--color-text)',
                    collapsed ? 'justify-center px-0' : '',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active pill - a single shared layoutId slides between nav items */}
                    {isActive && (
                      <motion.span
                        layoutId="nav-active-pill"
                        className="absolute inset-0 rounded-xl bg-(--color-accent-light) ring-1 ring-(--color-accent)/20 shadow-xs"
                        transition={springIndicator}
                      />
                    )}
                    <route.icon
                      className={[
                        'relative z-10 w-5 h-5 shrink-0 transition-transform duration-200',
                        isActive
                          ? 'text-(--color-accent)'
                          : 'text-(--color-text-muted) group-hover:text-(--color-text) group-hover:scale-110',
                      ].join(' ')}
                    />
                    {!collapsed && <span className="relative z-10 truncate">{labelFor(route)}</span>}
                    {!collapsed && isActive && (
                      <span className="relative z-10 ml-auto h-1.5 w-1.5 rounded-full bg-(--color-accent)" aria-hidden />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
