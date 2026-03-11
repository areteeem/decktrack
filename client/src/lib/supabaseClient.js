import { createClient } from '@supabase/supabase-js';

// Singleton Supabase client — matches TutPro pattern.
// Uses REACT_APP_ prefix for create-react-app compatibility.

const SUPABASE_URL = (process.env.REACT_APP_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.REACT_APP_SUPABASE_ANON_KEY || '').trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[Flashy] Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY — auth will not work.'
  );
}

let _client = null;

export const getSupabase = () => {
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      storageKey: 'flashy_auth_v1',
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
};

export const supabase = getSupabase();
