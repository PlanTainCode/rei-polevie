import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserInfo } from '@polevie/shared';
import { authApi } from '@/api/auth';

interface AuthState {
  user: UserInfo | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: UserInfo) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (email, password) => {
        const response = await authApi.login({ email, password });
        set({
          user: response.user,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      register: async (data) => {
        const response = await authApi.register(data);
        set({
          user: response.user,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      refreshProfile: async () => {
        try {
          const user = await authApi.getProfile();
          set({ user, isLoading: false });
        } catch {
          get().logout();
        }
      },

      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken, isAuthenticated: true });
      },

      setUser: (user) => {
        set({ user });
      },
    }),
    {
      name: 'polevie-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = false;
          // Если есть токен - обновляем профиль
          if (state.accessToken) {
            state.refreshProfile();
          }
        }
      },
    },
  ),
);

