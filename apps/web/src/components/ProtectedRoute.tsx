import { Navigate, Outlet } from 'react-router-dom';
import type { Role } from '@unitik/shared-types';
import { useAuthStore } from '../stores/auth';

/** Redirects to /login when unauthenticated, or home when the role mismatches. */
export default function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'CLIENT' ? '/portal' : '/panel'} replace />;
  }
  return <Outlet />;
}
