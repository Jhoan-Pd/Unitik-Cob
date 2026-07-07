import { beforeEach, describe, expect, it } from 'vitest';
import { formatCop } from '@unitik/shared-types';
import { useAuthStore } from './auth';

describe('auth store', () => {
  beforeEach(() => useAuthStore.getState().logout());

  it('stores the session and clears it on logout', () => {
    useAuthStore
      .getState()
      .setSession(
        {
          id: 'u1',
          documentId: '1085123456',
          firstName: 'Rosa',
          lastName: 'Delgado',
          email: 'rosa@correo.com',
          role: 'CLIENT',
        },
        'access',
        'refresh',
      );

    expect(useAuthStore.getState().user?.role).toBe('CLIENT');
    expect(useAuthStore.getState().accessToken).toBe('access');

    useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

describe('formatCop (regla de oro #9)', () => {
  it('formats COP without decimals: $ 1.234.567', () => {
    expect(formatCop(1234567)).toBe('$ 1.234.567');
    expect(formatCop(50000)).toBe('$ 50.000');
  });
});
