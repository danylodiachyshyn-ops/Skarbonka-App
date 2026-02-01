import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/src/lib/supabase';
import { useBoxStore } from '@/src/hooks/useBoxStore';
import { getSessionParamsFromUrl } from '@/src/lib/oauth';

interface AuthUser {
  id: string;
  email: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  requiresEmailConfirmation: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string, confirmPassword: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
  setSession: (session: Session | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  session: null,
  loading: false,
  error: null,
  requiresEmailConfirmation: false,

  signIn: async (email: string, password: string) => {
    set({ loading: true, error: null, requiresEmailConfirmation: false });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    const user = data.session?.user
      ? { id: data.session.user.id, email: data.session.user.email ?? '' }
      : null;
    
    set({
      session: data.session ?? null,
      isAuthenticated: !!data.session,
      user,
      requiresEmailConfirmation: false,
      loading: false,
    });

    // Завантажуємо дані користувача після успішного входу
    if (data.session && user) {
      useBoxStore.getState().fetchUserBoxes();
    }
  },

  signUp: async (email: string, password: string, username: string, confirmPassword: string) => {
    set({ loading: true, error: null, requiresEmailConfirmation: false });

    // Validation: Check if passwords match
    if (password !== confirmPassword) {
      set({ loading: false, error: 'Passwords do not match.' });
      return;
    }

    // Validation: Check if username is not empty
    if (!username.trim()) {
      set({ loading: false, error: 'Username is required.' });
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: username.trim(),
        },
      },
    });

    if (error) {
      set({ loading: false, error: error.message });
      return;
    }

    // Оновлюємо full_name в profiles лише коли є сесія (RLS дозволяє тільки своєму профілю).
    // Якщо потрібне підтвердження email, full_name вже зберігається тригером handle_new_user з user_metadata.
    if (data.session && data.user) {
      const updateData = { full_name: username.trim() };
      const { error: profileError } = await (supabase
        .from('profiles')
        // @ts-ignore - Supabase types inference issue, but runtime is correct
        .update(updateData)
        .eq('id', data.user.id));

      if (profileError) {
        console.warn('Failed to update profile:', profileError);
      }
    }

    const needsConfirmation = !data.session;
    const user = data.session?.user
      ? { id: data.session.user.id, email: data.session.user.email ?? '' }
      : null;
    
    set({
      session: data.session ?? null,
      isAuthenticated: !!data.session,
      user,
      requiresEmailConfirmation: needsConfirmation,
      loading: false,
    });

    // Завантажуємо дані користувача після реєстрації (якщо не потрібне підтвердження email)
    if (data.session && user) {
      useBoxStore.getState().fetchUserBoxes();
    }
  },

  signInWithGoogle: async () => {
    set({ loading: true, error: null });

    try {
      // Must match Supabase Redirect URL: skarbonka-app://--/auth/callback
      const redirectTo = makeRedirectUri({
        scheme: 'skarbonka-app',
        path: 'auth/callback',
      });
      
      if (__DEV__) {
        console.log('[OAuth] Redirect URL:', redirectTo);
        if (redirectTo.startsWith('exp://')) {
          console.log('[OAuth] Expo Go: add the URL above to Supabase → Auth → URL Configuration → Redirect URLs');
          console.warn('[OAuth] Note: IP changes when you switch networks; for stable OAuth use a dev build (scheme skarbonka-app)');
        } else {
          console.log('[OAuth] Add this URL in Supabase → Auth → URL Configuration → Redirect URLs');
        }
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
        const supabaseCallback = supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/auth/v1/callback` : '';
        if (supabaseCallback) {
          console.log('[OAuth] Google Cloud → Credentials → Authorized redirect URIs:', supabaseCallback);
        }
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        set({ loading: false, error: error.message });
        return;
      }

      if (!data?.url) {
        set({ loading: false, error: 'No auth URL returned' });
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type !== 'success' || !result.url) {
        set({ loading: false });
        if (result.type === 'cancel') return;
        set({ error: 'Sign in was cancelled or failed' });
        return;
      }

      // Close the browser tab and return to the app
      WebBrowser.maybeCompleteAuthSession();

      const { access_token, refresh_token, error: paramsError, error_description } = getSessionParamsFromUrl(result.url);

      if (paramsError) {
        set({ loading: false, error: error_description ?? paramsError });
        return;
      }

      if (!access_token || !refresh_token) {
        set({ loading: false, error: 'No session tokens in redirect URL' });
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (sessionError) {
        set({ loading: false, error: sessionError.message });
        return;
      }

      const user = sessionData.session?.user
        ? { id: sessionData.session.user.id, email: sessionData.session.user.email ?? '' }
        : null;

      set({
        session: sessionData.session ?? null,
        isAuthenticated: !!sessionData.session,
        user,
        requiresEmailConfirmation: false,
        loading: false,
      });

      if (sessionData.session && user) {
        useBoxStore.getState().fetchUserBoxes();
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      set({ loading: false, error: err.message ?? 'Google sign-in failed' });
    }
  },

  resendConfirmation: async (email: string) => {
    set({ loading: true, error: null });
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    set({ loading: false, error: null });
  },

  updatePassword: async (currentPassword: string, newPassword: string) => {
    set({ loading: true, error: null });
    const { user } = get();
    if (!user?.email) {
      set({ loading: false, error: 'Not signed in' });
      throw new Error('Not signed in');
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signInError) {
      set({ loading: false, error: 'Current password is incorrect' });
      throw new Error('Current password is incorrect');
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      set({ loading: false, error: error.message });
      throw error;
    }
    set({ loading: false, error: null });
  },

  resetPasswordForEmail: async (email: string) => {
    set({ loading: true, error: null });
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) {
      set({ loading: false, error: error.message });
      throw error;
    }
    set({ loading: false, error: null });
  },

  signOut: async () => {
    set({ loading: true, error: null });
    const { error } = await supabase.auth.signOut();
    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    // CRITICAL: wipe cached per-user data immediately
    useBoxStore.getState().reset();
    set({ isAuthenticated: false, user: null, session: null, loading: false });
  },

  checkSession: async () => {
    set({ loading: true, error: null });
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    const session = data.session ?? null;
    const user = session?.user ? { id: session.user.id, email: session.user.email ?? '' } : null;
    
    set({
      session,
      isAuthenticated: !!session,
      user,
      requiresEmailConfirmation: false,
      loading: false,
    });

    // Завантажуємо дані користувача після встановлення сесії
    if (session && user) {
      useBoxStore.getState().fetchUserBoxes();
    }
  },

  setSession: (session: Session | null) => {
    const prevUserId = get().user?.id;
    const nextUserId = session?.user?.id ?? null;

    // CRITICAL: if user changed OR signed out, wipe cached data
    if (!nextUserId || (prevUserId && prevUserId !== nextUserId)) {
      useBoxStore.getState().reset();
    }

    set({
      session,
      isAuthenticated: !!session,
      user: session?.user ? { id: session.user.id, email: session.user.email ?? '' } : null,
      requiresEmailConfirmation: false,
    });
  },

  clearError: () => set({ error: null }),
}));
