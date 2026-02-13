import { create } from 'zustand';

interface AuthState {
  token: string | null;
  user: { id: number; name: string; email: string; role: string } | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: any) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,

  setAuth: (token, user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_user', JSON.stringify(user));
    }
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
    }
    set({ token: null, user: null, isAuthenticated: false });
  },

  hydrate: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('admin_token');
      const userStr = localStorage.getItem('admin_user');
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          set({ token, user, isAuthenticated: true });
        } catch {
          set({ token: null, user: null, isAuthenticated: false });
        }
      }
    }
  },
}));
