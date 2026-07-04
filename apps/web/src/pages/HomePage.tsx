import { useQuery } from '@tanstack/react-query';
import { Wifi } from 'lucide-react';

interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  dependencies: Record<string, string>;
}

async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch('/health');
  if (!response.ok) throw new Error('No se pudo consultar el estado del sistema');
  return response.json() as Promise<HealthResponse>;
}

export default function HomePage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['health'], queryFn: fetchHealth });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <Wifi className="h-10 w-10 text-unitik-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Unitik-Cob</h1>
            <p className="text-sm text-slate-500">UNITIK Internet Sin Límite S.A.S.</p>
          </div>
        </div>

        <p className="mb-4 text-sm text-slate-600">
          Sistema integrador OSS/BSS — Gobernanza de TI ISO/IEC 38500. Fase 1 (Inicio) de OpenUP.
        </p>

        <div className="rounded-lg border border-slate-200 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Estado del sistema</h2>
          {isLoading && <p className="text-sm text-slate-400">Consultando…</p>}
          {isError && (
            <p className="text-sm text-red-600">API no disponible. Verifique que el backend esté en ejecución.</p>
          )}
          {data && (
            <ul className="space-y-1 text-sm">
              {Object.entries(data.dependencies).map(([name, status]) => (
                <li key={name} className="flex justify-between">
                  <span className="text-slate-600">{name}</span>
                  <span
                    className={
                      status === 'up'
                        ? 'font-medium text-green-600'
                        : status === 'down'
                          ? 'font-medium text-red-600'
                          : 'text-slate-400'
                    }
                  >
                    {status === 'up' ? 'En línea' : status === 'down' ? 'Caído' : 'Sin configurar'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
