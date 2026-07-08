import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, Wifi, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/http';
import { useAuthStore } from '../../stores/auth';

interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: string;
  category: string;
  createdAt: string;
}

const STATUS_ES: Record<Ticket['status'], string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En progreso',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
};

const NEXT_STATUS: Partial<Record<Ticket['status'], Ticket['status']>> = {
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'RESOLVED',
  RESOLVED: 'CLOSED',
};

const PRIORITY_CLASSES: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-800',
  HIGH: 'bg-amber-100 text-amber-800',
  MEDIUM: 'bg-blue-100 text-blue-800',
  LOW: 'bg-slate-100 text-slate-600',
};

export default function TechnicianPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout } = useAuthStore();

  const tickets = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => api<Ticket[]>('/tickets'),
  });

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Ticket['status'] }) =>
      api<Ticket>(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-tickets'] }),
  });

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="h-7 w-7 text-unitik-600" />
            <h1 className="text-lg font-bold text-slate-900">
              Técnico — {user?.firstName}
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

        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Wrench className="h-4 w-4" /> Mis tickets asignados
          </h2>
          {tickets.data?.length === 0 && (
            <p className="text-sm text-slate-400">No tiene tickets asignados actualmente.</p>
          )}
          <ul className="space-y-3">
            {tickets.data?.map((ticket) => {
              const next = NEXT_STATUS[ticket.status];
              return (
                <li key={ticket.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        <span className="font-mono text-xs text-slate-400">{ticket.ticketNumber}</span>{' '}
                        {ticket.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{ticket.description}</p>
                      <div className="mt-2 flex gap-2 text-xs">
                        <span className={`rounded-full px-2 py-0.5 font-medium ${PRIORITY_CLASSES[ticket.priority] ?? ''}`}>
                          {ticket.priority}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">{ticket.category}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">
                          {STATUS_ES[ticket.status]}
                        </span>
                      </div>
                    </div>
                    {next && (
                      <button
                        onClick={() => advance.mutate({ id: ticket.id, status: next })}
                        disabled={advance.isPending}
                        className="shrink-0 rounded bg-unitik-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-unitik-700 disabled:opacity-50"
                      >
                        → {STATUS_ES[next]}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}
