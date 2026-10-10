import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../lib/auth';
import type { Role } from '../../lib/auth';
import { ROUTES } from '../../routes';
import { springIndicator } from '../../lib/motion';

interface NavProps {
  collapsed: boolean;
}

export function Nav({ collapsed }: NavProps) {
  const { user } = useAuth();
  if (!user) return null;

  const visibleRoutes = ROUTES.filter(
    (r) => r.nav && (r.roles === 'all' || r.roles.includes(user.role as Role))
  );

  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {visibleRoutes.map((route) => (
        <NavLink
          key={route.path}
          to={route.path}
          end={route.path === '/dashboard' || route.path === '/'}
          title={user.role === 'STAFF' && route.path === '/floor' ? 'My Machines' : route.label}
          className={({ isActive }) =>
            [
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150',
              'relative group',
              isActive
                ? 'bg-(--color-accent-light) text-(--color-accent) font-medium'
                : 'text-(--color-text-muted) hover:bg-(--color-surface-sunken) hover:text-(--color-text)',
              collapsed ? 'justify-center' : '',
            ].join(' ')
          }
        >
          {({ isActive }) => (
            <>
              {/* Active left border indicator - a single shared layoutId slides between nav items */}
              {isActive && (
                <motion.span
                  layoutId="nav-active-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-(--color-accent) rounded-r-full"
                  transition={springIndicator}
                />
              )}
              <route.icon
                className={[
                  'w-5 h-5 shrink-0',
                  isActive ? 'text-(--color-accent)' : 'text-(--color-text-muted) group-hover:text-(--color-text)',
                ].join(' ')}
              />
              {!collapsed && (
                <span className="truncate">
                  {user.role === 'STAFF' && route.path === '/floor' ? 'My Machines' : route.label}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
