import { Navigate, Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../lib/auth';
import type { Role } from '../../lib/auth';
import { Spinner } from '../ui/Spinner';

interface RequireRoleProps {
  roles?: Role[] | 'all';
  children?: ReactNode;
}

export function RequireRole({ roles = 'all', children }: RequireRoleProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles !== 'all' && !roles.includes(user.role)) {
    // Redirect to dashboard; the API is the real security boundary
    return <Navigate to="/" replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
