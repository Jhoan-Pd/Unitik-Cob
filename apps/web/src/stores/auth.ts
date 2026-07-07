import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role } from '@unitik/shared-types';

export interface SessionUser {
  id: string;
  documentId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
}

interface AuthState {
  user: SessionUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (user: SessionUser, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'unitik-auth' },
  ),
);
