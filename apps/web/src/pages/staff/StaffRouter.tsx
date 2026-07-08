import { useAuthStore } from '../../stores/auth';
import AdminPanelPage from './AdminPanelPage';
import CashierPage from './CashierPage';
import TechnicianPage from './TechnicianPage';

/** /panel resolves to the panel matching the authenticated staff role. */
export default function StaffRouter() {
  const role = useAuthStore((state) => state.user?.role);
  if (role === 'ADMIN') return <AdminPanelPage />;
  if (role === 'CASHIER') return <CashierPage />;
  return <TechnicianPage />;
}
