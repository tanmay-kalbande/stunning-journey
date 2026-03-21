// src/lib/supabaseClient.ts
// Supabase client initialization

import { createClient } from '@supabase/supabase-js';
import config from '../config';

// Debug logging removed for production

if (!config.isSupabaseConfigured) {
  console.warn(
    '⚠️ Supabase credentials not found. Auth features will be disabled.',
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = config.isSupabaseConfigured
  ? createClient(config.supabase.url, config.supabase.anonKey, {
    auth: {
      persistSession: true, // Persist session to localStorage
      autoRefreshToken: true, // Auto refresh expired tokens
      detectSessionInUrl: true, // Handle OAuth redirects
      storageKey: 'kitaab-auth', // Unique storage key for this app
    }
  })
  : null;

export const isSupabaseConfigured = (): boolean => config.isSupabaseConfigured;
