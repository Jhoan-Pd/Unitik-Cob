import { Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {/* Role-based panels are added in Phase 3 (Construction):
          /admin, /technician, /cashier, /client */}
    </Routes>
  );
}
