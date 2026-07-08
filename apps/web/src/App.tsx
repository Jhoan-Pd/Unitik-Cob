import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import PortalPage from './pages/client/PortalPage';
import StaffRouter from './pages/staff/StaffRouter';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/estado" element={<HomePage />} />

      <Route element={<ProtectedRoute roles={['CLIENT']} />}>
        <Route path="/portal" element={<PortalPage />} />
      </Route>

      <Route element={<ProtectedRoute roles={['ADMIN', 'TECHNICIAN', 'CASHIER']} />}>
        <Route path="/panel" element={<StaffRouter />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
