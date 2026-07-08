import { useMutation, useQuery } from '@tanstack/react-query';
import { Banknote, LogOut, Search, Wifi } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCop } from '@unitik/shared-types';
import { api, ApiError } from '../../api/http';
import { useAuthStore } from '../../stores/auth';

interface ClientRow {
  id: string;
  clientCode: string;
  status: string;
  user: { firstName: string; lastName: string; documentId: string };
}

interface AccountStatus {
  client: { clientCode: string; name: string; status: string };
  totalDue: number;
  openInvoices: Array<{ id: string; invoiceNumber: string; period: string; total: string; status: string }>;
}

interface Receipt {
  receiptNumber: string;
  invoiceNumber: string;
  clientName: string;
  payment: { amount: string };
}

interface DailyClose {
  date: string;
  totalReceived: number;
  paymentsCount: number;
  payments: Array<{ receiptTime: string; invoiceNumber: string; clientName: string; amount: number }>;
}

export default function CashierPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState('');

  const clients = useQuery({
    queryKey: ['clients-search', search],
    queryFn: () => api<ClientRow[]>(`/clients?search=${encodeURIComponent(search)}`),
    enabled: search.length >= 3,
  });

  const account = useQuery({
    queryKey: ['account', selectedClient?.id],
    queryFn: () => api<AccountStatus>(`/cashier/account-status/${selectedClient?.id}`),
    enabled: !!selectedClient,
  });

  const dailyClose = useQuery({
    queryKey: ['daily-close'],
    queryFn: () => api<DailyClose>('/cashier/daily-close'),
  });

  const payMutation = useMutation({
    mutationFn: (invoice: { id: string; total: string }) =>
      api<Receipt>('/cashier/payments', {
        method: 'POST',
        body: JSON.stringify({ invoiceId: invoice.id, amount: Math.round(Number(invoice.total)) }),
      }),
    onSuccess: (data) => {
      setReceipt(data);
      setError('');
      void account.refetch();
      void dailyClose.refetch();
    },
    onError: (mutationError) =>
      setError(mutationError instanceof ApiError ? mutationError.message : 'Error al registrar el pago'),
  });

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="h-7 w-7 text-unitik-600" />
            <h1 className="text-lg font-bold text-slate-900">Caja — {user?.firstName}</h1>
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

        {/* Buscar cliente */}
        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Search className="h-4 w-4" /> Estado de cuenta
          </h2>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedClient(null);
              setReceipt(null);
            }}
            placeholder="Buscar por nombre, apellido o cédula (mín. 3 caracteres)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-unitik-500 focus:outline-none"
          />
          {clients.data && !selectedClient && (
            <ul className="mt-2 divide-y rounded border">
              {clients.data.slice(0, 6).map((client) => (
                <li key={client.id}>
                  <button
                    onClick={() => setSelectedClient(client)}
                    className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span>
                      {client.user.firstName} {client.user.lastName}{' '}
                      <span className="text-xs text-slate-400">CC {client.user.documentId}</span>
                    </span>
                    <span className="text-xs text-slate-400">{client.clientCode}</span>
                  </button>
                </li>
              ))}
              {clients.data.length === 0 && (
                <li className="px-3 py-2 text-sm text-slate-400">Sin resultados</li>
              )}
            </ul>
          )}

          {account.data && (
            <div className="mt-4 rounded-lg border border-slate-200 p-4">
              <p className="text-sm">
                <b>{account.data.client.name}</b> · {account.data.client.clientCode} · Deuda total:{' '}
                <b className={account.data.totalDue > 0 ? 'text-red-600' : 'text-green-600'}>
                  {formatCop(account.data.totalDue)}
                </b>
              </p>
              {account.data.openInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="mt-2 flex items-center justify-between rounded bg-slate-50 px-3 py-2 text-sm"
                >
                  <span>
                    {invoice.invoiceNumber} · {invoice.period} · {formatCop(Number(invoice.total))}
                  </span>
                  <button
                    onClick={() => payMutation.mutate(invoice)}
                    disabled={payMutation.isPending}
                    className="flex items-center gap-1 rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    <Banknote className="h-3 w-3" /> Recibir efectivo
                  </button>
                </div>
              ))}
              {account.data.openInvoices.length === 0 && (
                <p className="mt-2 text-sm text-green-600">El cliente está al día. ✓</p>
              )}
            </div>
          )}

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {receipt && (
            <div className="mt-3 rounded-lg border-l-4 border-green-500 bg-green-50 p-4 text-sm">
              <p className="font-semibold">Recibo {receipt.receiptNumber}</p>
              <p>
                {receipt.clientName} · {receipt.invoiceNumber} ·{' '}
                <b>{formatCop(Number(receipt.payment.amount))}</b>
              </p>
              <p className="text-xs text-slate-500">
                Pago validado — si el cliente estaba suspendido, la reconexión ya quedó encolada.
              </p>
            </div>
          )}
        </section>

        {/* Cierre de caja */}
        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Cierre de caja de hoy</h2>
          {dailyClose.data && (
            <>
              <p className="mb-2 text-sm">
                {dailyClose.data.paymentsCount} pagos ·{' '}
                <b className="text-lg">{formatCop(dailyClose.data.totalReceived)}</b>
              </p>
              <table className="w-full text-left text-sm">
                <tbody>
                  {dailyClose.data.payments.map((payment, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="py-1 text-xs text-slate-400">
                        {new Date(payment.receiptTime).toLocaleTimeString('es-CO')}
                      </td>
                      <td className="py-1">{payment.clientName}</td>
                      <td className="py-1 font-mono text-xs">{payment.invoiceNumber}</td>
                      <td className="py-1 text-right">{formatCop(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
