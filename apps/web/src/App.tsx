import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import PanelPlaceholderPage from './pages/PanelPlaceholderPage';
import PortalPage from './pages/client/PortalPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/estado" element={<HomePage />} />

      <Route element={<ProtectedRoute roles={['CLIENT']} />}>
        <Route path="/portal" element={<PortalPage />} />
      </Route>

      <Route element={<ProtectedRoute roles={['ADMIN', 'TECHNICIAN', 'CASHIER']} />}>
        <Route path="/panel" element={<PanelPlaceholderPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
