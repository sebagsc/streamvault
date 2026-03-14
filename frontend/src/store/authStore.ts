import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { auth as authApi } from '../lib/api';
import type { UserProfile } from '../lib/api';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: UserProfile | null) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: false,
      initialized: false,

      setUser: (user) => set({ user }),

      logout: async () => {
        await authApi.logout().catch(() => {});
        set({ user: null });
      },

      refreshUser: async () => {
        set({ loading: true });
        try {
          const user = await authApi.me();
          set({ user, initialized: true });
        } catch {
          set({ user: null, initialized: true });
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
