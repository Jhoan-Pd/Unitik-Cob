import { Wifi } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

/** Staff landing (admin/técnico/cajero) — real panels arrive in iterations 4-6. */
export default function PanelPlaceholderPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-lg">
        <Wifi className="mx-auto mb-3 h-10 w-10 text-unitik-600" />
        <h1 className="text-lg font-bold text-slate-900">
          Hola, {user?.firstName} ({user?.role})
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          El panel administrativo se construye en las Iteraciones 4–6: facturación, validación de
          pagos, dispositivos de red, auditoría y reportes.
        </p>
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="mt-6 rounded-lg bg-unitik-600 px-4 py-2 text-sm font-semibold text-white hover:bg-unitik-700"
        >
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}
