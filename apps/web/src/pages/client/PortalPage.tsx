import { useQuery } from '@tanstack/react-query';
import { Calendar, FileText, Gauge, LogOut, User, Wifi } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCop } from '@unitik/shared-types';
import { api } from '../../api/http';
import { useAuthStore } from '../../stores/auth';

interface ClientProfile {
  clientCode: string;
  address: string;
  neighborhood?: string;
  municipality: string;
  serviceType: 'FIBER' | 'RADIO';
  status: string;
  user: { firstName: string; lastName: string; documentId: string; email: string; phone: string };
}

interface MySubscription {
  status: string;
  cutOffDay: number;
  plan: { name: string; description: string; speedMbps: number; monthlyPrice: string; includesTv: boolean };
}

interface MyInvoice {
  id: string;
  invoiceNumber: string;
  period: string;
  dueDate: string;
  total: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'PROMISE_TO_PAY';
}

const INVOICE_STATUS_ES: Record<MyInvoice['status'], { label: string; classes: string }> = {
  PENDING: { label: 'Pendiente', classes: 'bg-amber-100 text-amber-800' },
  PAID: { label: 'Pagada', classes: 'bg-green-100 text-green-800' },
  OVERDUE: { label: 'Vencida', classes: 'bg-red-100 text-red-800' },
  CANCELLED: { label: 'Anulada', classes: 'bg-slate-100 text-slate-500' },
  PROMISE_TO_PAY: { label: 'Promesa de pago', classes: 'bg-blue-100 text-blue-800' },
};

const CLIENT_STATUS_ES: Record<string, string> = {
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
  CUT: 'Cortado',
  CANCELLED: 'Cancelado',
};

export default function PortalPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const profile = useQuery({ queryKey: ['me'], queryFn: () => api<ClientProfile>('/clients/me') });
  const subscription = useQuery({
    queryKey: ['my-subscription'],
    queryFn: () => api<MySubscription | null>('/subscriptions/my'),
  });
  const invoices = useQuery({
    queryKey: ['my-invoices'],
    queryFn: () => api<MyInvoice[]>('/invoices/my'),
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="h-7 w-7 text-unitik-600" />
            <h1 className="text-lg font-bold text-slate-900">Portal del Cliente</h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200"
          >
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </header>

        {/* Mi información */}
        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <User className="h-4 w-4" /> Mi información
          </h2>
          {profile.isLoading && <p className="text-sm text-slate-400">Cargando…</p>}
          {profile.data && (
            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <p>
                <span className="text-slate-500">Nombre: </span>
                {profile.data.user.firstName} {profile.data.user.lastName}
              </p>
              <p>
                <span className="text-slate-500">Código: </span>
                {profile.data.clientCode}
              </p>
              <p>
                <span className="text-slate-500">Dirección: </span>
                {profile.data.address}
                {profile.data.neighborhood ? `, ${profile.data.neighborhood}` : ''}
              </p>
              <p>
                <span className="text-slate-500">Estado: </span>
                <span
                  className={
                    profile.data.status === 'ACTIVE' ? 'font-medium text-green-600' : 'font-medium text-red-600'
                  }
                >
                  {CLIENT_STATUS_ES[profile.data.status] ?? profile.data.status}
                </span>
              </p>
            </div>
          )}
        </section>

        {/* Mi plan */}
        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Gauge className="h-4 w-4" /> Mi plan
          </h2>
          {subscription.isLoading && <p className="text-sm text-slate-400">Cargando…</p>}
          {subscription.data === null && (
            <p className="text-sm text-slate-500">Aún no tiene un plan asignado.</p>
          )}
          {subscription.data && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-900">{subscription.data.plan.name}</p>
                <p className="text-sm text-slate-500">{subscription.data.plan.description}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                  <Calendar className="h-3 w-3" /> Fecha de corte: día {subscription.data.cutOffDay}
                  {subscription.data.plan.includesTv && ' · Incluye TV'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-unitik-600">
                  {subscription.data.plan.speedMbps} <span className="text-sm">Megas</span>
                </p>
                <p className="text-sm text-slate-600">
                  {formatCop(Number(subscription.data.plan.monthlyPrice))}/mes
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Mis facturas */}
        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <FileText className="h-4 w-4" /> Mis facturas
          </h2>
          {invoices.isLoading && <p className="text-sm text-slate-400">Cargando…</p>}
          {invoices.data?.length === 0 && (
            <p className="text-sm text-slate-500">No tiene facturas registradas todavía.</p>
          )}
          {invoices.data && invoices.data.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-400">
                  <th className="py-2">Factura</th>
                  <th className="py-2">Mes</th>
                  <th className="py-2">Vence</th>
                  <th className="py-2 text-right">Total</th>
                  <th className="py-2 text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {invoices.data.map((invoice) => {
                  const status = INVOICE_STATUS_ES[invoice.status];
                  return (
                    <tr key={invoice.id} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{invoice.invoiceNumber}</td>
                      <td className="py-2">{invoice.period}</td>
                      <td className="py-2">{new Date(invoice.dueDate).toLocaleDateString('es-CO')}</td>
                      <td className="py-2 text-right">{formatCop(Number(invoice.total))}</td>
                      <td className="py-2 text-right">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.classes}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
