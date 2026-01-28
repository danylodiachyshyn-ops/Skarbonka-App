import { create } from 'zustand';

// Mock auth store - will be replaced with Supabase later
interface AuthState {
  isAuthenticated: boolean;
  user: { id: string; email: string } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
  setSession: (session: any) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  loading: false,

  signIn: async (email: string, password: string) => {
    set({ loading: true });
    // Mock authentication - replace with Supabase later
    await new Promise((resolve) => setTimeout(resolve, 500));
    set({
      isAuthenticated: true,
      user: { id: 'mock_user_1', email },
      loading: false,
    });
  },

  signUp: async (email: string, password: string) => {
    set({ loading: true });
    // Mock authentication - replace with Supabase later
    await new Promise((resolve) => setTimeout(resolve, 500));
    set({
      isAuthenticated: true,
      user: { id: 'mock_user_1', email },
      loading: false,
    });
  },

  signOut: async () => {
    set({ isAuthenticated: false, user: null });
  },

  checkSession: async () => {
    // Mock - check if user is logged in
    // In real app, this would check Supabase session
    set({ loading: false });
  },

  setSession: (session: any) => {
    if (session) {
      set({
        isAuthenticated: true,
        user: { id: session.user?.id || 'mock_user_1', email: session.user?.email || '' },
      });
    } else {
      set({ isAuthenticated: false, user: null });
    }
  },
}));
