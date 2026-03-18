import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

// Replace these with your actual Supabase project URL and anon key
// You can find these in your Supabase project settings
const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

const supabaseUrlIsValid = /^https?:\/\//.test(supabaseUrl);
const anonKeyLooksJwt = /^eyJ/.test(supabaseAnonKey);
const anonKeyLength = supabaseAnonKey.length;

// #region agent log
fetch('http://127.0.0.1:7486/ingest/234a9c32-f928-49a1-9752-227f085fcbe7', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Debug-Session-Id': '85dad0',
  },
  body: JSON.stringify({
    sessionId: '85dad0',
    runId: 'signup-debug',
    hypothesisId: 'H1',
    location: 'src/lib/supabase.ts:config',
    message: 'Supabase env seen by client',
    data: {
      supabaseUrlIsValid,
      supabaseUrlLength: supabaseUrl.length,
      anonKeyLooksJwt,
      anonKeyLength,
    },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

console.log('[SupabaseConfigDebug]', {
  supabaseUrlIsValid,
  supabaseUrlLength: supabaseUrl.length,
  anonKeyLooksJwt,
  anonKeyLength,
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase environment variables. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
