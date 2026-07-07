import { zodResolver } from '@hookform/resolvers/zod';
import { Wifi } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuthStore } from '../stores/auth';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Ingrese su correo o número de cédula'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (form: LoginForm) => {
    setServerError('');
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!response.ok) {
      setServerError(
        response.status === 401
          ? 'Credenciales incorrectas. Verifique su documento/correo y contraseña.'
          : 'No fue posible iniciar sesión. Intente de nuevo.',
      );
      return;
    }
    const data = await response.json();
    setSession(data.user, data.accessToken, data.refreshToken);
    navigate(data.user.role === 'CLIENT' ? '/portal' : '/panel');
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <Wifi className="h-9 w-9 text-unitik-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Unitik-Cob</h1>
            <p className="text-xs text-slate-500">UNITIK Internet Sin Límite</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="identifier" className="mb-1 block text-sm font-medium text-slate-700">
              Correo o cédula
            </label>
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-unitik-500 focus:outline-none"
              {...register('identifier')}
            />
            {errors.identifier && (
              <p className="mt-1 text-xs text-red-600">{errors.identifier.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-unitik-500 focus:outline-none"
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          {serverError && <p className="text-sm text-red-600">{serverError}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-unitik-600 py-2 text-sm font-semibold text-white transition hover:bg-unitik-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Clientes: ingresen con su cédula como usuario y contraseña inicial.
        </p>
      </div>
    </main>
  );
}
