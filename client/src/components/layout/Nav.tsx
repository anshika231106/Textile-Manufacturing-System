import { NavLink } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import type { Role } from '../../lib/auth';
import { ROUTES } from '../../routes';

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
          end={route.path === '/'}
          title={route.label}
          className={({ isActive }) =>
            [
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150',
              'relative group',
              isActive
                ? 'bg-[#FFF7ED] text-[#EA580C] font-medium'
                : 'text-[#78716C] hover:bg-[#F5F4F2] hover:text-[#1A1714]',
              collapsed ? 'justify-center' : '',
            ].join(' ')
          }
        >
          {({ isActive }) => (
            <>
              {/* Active left border indicator */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#EA580C] rounded-r-full" />
              )}
              <route.icon
                className={[
                  'w-5 h-5 shrink-0',
                  isActive ? 'text-[#EA580C]' : 'text-[#78716C] group-hover:text-[#1A1714]',
                ].join(' ')}
              />
              {!collapsed && (
                <span className="truncate">{route.label}</span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
