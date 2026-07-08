import { useQuery } from '@tanstack/react-query';
import { Activity, Download, FileText, LogOut, Users, Wallet, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { formatCop } from '@unitik/shared-types';
import { api } from '../../api/http';
import { useAuthStore } from '../../stores/auth';

interface Kpis {
  activeClients: number;
  suspendedClients: number;
  monthRevenue: number;
  overdueClients: number;
  overdueAmount: number;
  openTickets: number;
  devicesOnline: number;
  devicesTotal: number;
}

interface Portfolio {
  totalPending: number;
  totalOverdue: number;
  byClient: Array<{
    clientId: string;
    clientCode: string;
    clientName: string;
    overdueAmount: number;
    overdueCount: number;
  }>;
}

interface AuditRow {
  id: string;
  createdAt: string;
  action: string;
  entity: string;
  entityId?: string;
  policyRef?: string;
  user: { email: string } | null;
}

interface LiveEvent {
  message: string;
  at: string;
}

/** Descarga un CSV autenticado (el header Authorization no viaja en <a href>). */
async function downloadCsv(path: string, filename: string, token: string | null) {
  const response = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminPanelPage() {
  const navigate = useNavigate();
  const { user, accessToken, logout } = useAuthStore();
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);

  const kpis = useQuery({ queryKey: ['kpis'], queryFn: () => api<Kpis>('/dashboard/kpis') });
  const portfolio = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => api<Portfolio>('/invoices/portfolio'),
  });
  const audit = useQuery({
    queryKey: ['audit'],
    queryFn: () => api<AuditRow[]>('/audit?take=15'),
  });

  // Notificaciones en tiempo real (WebSocket autenticado)
  useEffect(() => {
    if (!accessToken) return;
    const socket = io('/ws', { auth: { token: accessToken } });
    socket.on('payment.validated', (payload: { message: string; at: string }) => {
      setLiveEvents((events) => [{ message: payload.message, at: payload.at }, ...events].slice(0, 8));
      void kpis.refetch();
      void portfolio.refetch();
    });
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const cards = kpis.data
    ? [
        { icon: Users, label: 'Clientes activos', value: String(kpis.data.activeClients) },
        { icon: Wallet, label: 'Ingresos del mes', value: formatCop(kpis.data.monthRevenue) },
        {
          icon: Activity,
          label: 'Morosos',
          value: `${kpis.data.overdueClients} (${formatCop(kpis.data.overdueAmount)})`,
        },
        { icon: FileText, label: 'Tickets abiertos', value: String(kpis.data.openTickets) },
        {
          icon: Wifi,
          label: 'Red',
          value: `${kpis.data.devicesOnline}/${kpis.data.devicesTotal} en línea`,
        },
      ]
    : [];

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="h-7 w-7 text-unitik-600" />
            <h1 className="text-lg font-bold text-slate-900">
              Panel Administrador — {user?.firstName}
            </h1>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200"
          >
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {cards.map((card) => (
            <div key={card.label} className="rounded-xl bg-white p-4 shadow">
              <card.icon className="mb-2 h-5 w-5 text-unitik-600" />
              <p className="text-xs text-slate-500">{card.label}</p>
              <p className="text-lg font-bold text-slate-900">{card.value}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Cartera */}
          <section className="rounded-xl bg-white p-6 shadow">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Cartera y morosidad</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadCsv('/reports/collections.csv', 'recaudo.csv', accessToken)}
                  className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
                >
                  <Download className="h-3 w-3" /> Recaudo
                </button>
                <button
                  onClick={() =>
                    downloadCsv('/reports/clients-by-plan.csv', 'clientes-por-plan.csv', accessToken)
                  }
                  className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
                >
                  <Download className="h-3 w-3" /> Por plan
                </button>
              </div>
            </div>
            {portfolio.data && (
              <>
                <p className="mb-2 text-sm text-slate-600">
                  Pendiente: <b>{formatCop(portfolio.data.totalPending)}</b> · Vencida:{' '}
                  <b className="text-red-600">{formatCop(portfolio.data.totalOverdue)}</b>
                </p>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-slate-400">
                      <th className="py-1">Cliente</th>
                      <th className="py-1 text-right">Facturas</th>
                      <th className="py-1 text-right">Deuda vencida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.data.byClient.slice(0, 8).map((row) => (
                      <tr key={row.clientId} className="border-b last:border-0">
                        <td className="py-1">
                          {row.clientName} <span className="text-xs text-slate-400">{row.clientCode}</span>
                        </td>
                        <td className="py-1 text-right">{row.overdueCount}</td>
                        <td className="py-1 text-right text-red-600">{formatCop(row.overdueAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>

          {/* Tiempo real */}
          <section className="rounded-xl bg-white p-6 shadow">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Eventos en tiempo real</h2>
            {liveEvents.length === 0 && (
              <p className="text-sm text-slate-400">
                Esperando eventos… (los pagos validados aparecen aquí al instante)
              </p>
            )}
            <ul className="space-y-2 text-sm">
              {liveEvents.map((event, index) => (
                <li key={index} className="rounded border-l-4 border-green-500 bg-green-50 px-3 py-2">
                  {event.message}
                  <span className="ml-2 text-xs text-slate-400">
                    {new Date(event.at).toLocaleTimeString('es-CO')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Auditoría */}
        <section className="rounded-xl bg-white p-6 shadow">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Auditoría ISO/IEC 38500 (últimos movimientos)
            </h2>
            <button
              onClick={() => downloadCsv('/audit/export.csv', 'auditoria.csv', accessToken)}
              className="flex items-center gap-1 rounded bg-unitik-600 px-3 py-1 text-xs font-semibold text-white hover:bg-unitik-700"
            >
              <Download className="h-3 w-3" /> Exportar CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b uppercase text-slate-400">
                  <th className="py-1">Fecha</th>
                  <th className="py-1">Usuario</th>
                  <th className="py-1">Acción</th>
                  <th className="py-1">Entidad</th>
                  <th className="py-1">Principio</th>
                </tr>
              </thead>
              <tbody>
                {audit.data?.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-1">{new Date(row.createdAt).toLocaleString('es-CO')}</td>
                    <td className="py-1">{row.user?.email ?? 'sistema'}</td>
                    <td className="py-1 font-mono">{row.action}</td>
                    <td className="py-1">{row.entity}</td>
                    <td className="py-1 text-slate-400">{row.policyRef ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
