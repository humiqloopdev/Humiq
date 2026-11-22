// src/store/authStore.ts
import { create } from 'zustand';
import type { RegisterPayload, User } from '@/types';
import * as AuthAPI from '@/api/auth/authApi';
import { queryClient } from '@/lib/queryClient';

interface AuthState {
  user: User | null;
  loading: boolean;
  isCandidate: boolean;
  isEmployer: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

function deriveRoleFlags(user: User | null) {
  return {
    isCandidate: user?.role === 'candidate',
    isEmployer: user?.role === 'employer',
    isAdmin: user?.role === 'admin',
  };
}

export const useAuthStore = create<AuthState>((set) => {
  /** Stores a new session and makes sure no data cached for a previous user survives. */
  const begin = (session: AuthAPI.AuthSession) => {
    queryClient.clear();
    set({ user: session.user, loading: false, ...deriveRoleFlags(session.user) });
    return session.user;
  };

  const end = () => {
    queryClient.clear();
    set({ user: null, loading: false, ...deriveRoleFlags(null) });
  };

  return {
    user: null,
    loading: true,
    ...deriveRoleFlags(null),

    // On page load: ask the server who the session cookie belongs to (a 401 just means nobody is signed in).
    restoreSession: async () => {
      try {
        const user = (await AuthAPI.me()).data;
        set({ user, loading: false, ...deriveRoleFlags(user) });
      } catch {
        end();
      }
    },

    login: async (email, password) => begin((await AuthAPI.login(email, password)).data),

    register: async (payload) => begin((await AuthAPI.register(payload)).data),

    logout: async () => {
      try {
        await AuthAPI.logout(); // end the session on the server; sign out locally even if this fails
      } catch {
        /* ignore */
      }
      end();
    },

    logoutAll: async () => {
      try {
        await AuthAPI.logoutAll();
      } catch {
        /* ignore */
      }
      end();
    },
  };
});

// Kick off session restore once, at module load.
useAuthStore.getState().restoreSession();

/** Convenience hook mirroring the old useAuth() call signature. */
export const useAuth = useAuthStore;
