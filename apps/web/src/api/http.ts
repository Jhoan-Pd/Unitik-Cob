import { useAuthStore } from '../stores/auth';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Minimal API client. On 401 it tries one refresh with the stored refresh
 * token before logging the session out (Cumbitara-friendly: TanStack Query
 * retries around this add resilience to flaky connectivity).
 */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await withAuth(path, options);
  if (response.status === 401 && useAuthStore.getState().refreshToken) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const retried = await withAuth(path, options);
      return parse<T>(retried);
    }
    useAuthStore.getState().logout();
  }
  return parse<T>(response);
}

function withAuth(path: string, options: RequestInit): Promise<Response> {
  const token = useAuthStore.getState().accessToken;
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

async function tryRefresh(): Promise<boolean> {
  const { refreshToken, setSession } = useAuthStore.getState();
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) return false;
  const data = await response.json();
  setSession(data.user, data.accessToken, data.refreshToken);
  return true;
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = Array.isArray(body.message)
      ? body.message.join(' · ')
      : (body.message ?? `Error ${response.status}`);
    throw new ApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}
