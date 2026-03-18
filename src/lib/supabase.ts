import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import * as SecureStore from 'expo-secure-store';

// Replace these with your actual Supabase project URL and anon key
// You can find these in your Supabase project settings
const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase environment variables. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
  );
}

const AUTH_STORAGE_PREFIX = 'skarbonka_auth_';

const supabaseSecureStorage = {
  async getItem(key: string) {
    return (await SecureStore.getItemAsync(`${AUTH_STORAGE_PREFIX}${key}`)) ?? null;
  },
  async setItem(key: string, value: string) {
    await SecureStore.setItemAsync(`${AUTH_STORAGE_PREFIX}${key}`, value);
  },
  async removeItem(key: string) {
    await SecureStore.deleteItemAsync(`${AUTH_STORAGE_PREFIX}${key}`);
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: supabaseSecureStorage,
  },
});
