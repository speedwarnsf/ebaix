import { createClient } from "@supabase/supabase-js";

// Clean environment variables to remove newlines/whitespace
const rawUrl = process.env.REACT_APP_SUPABASE_URL;
const rawKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabaseUrl = rawUrl ? rawUrl.replace(/[\r\n\t]/g, '').trim() : '';
const supabaseAnonKey = rawKey ? rawKey.replace(/[\r\n\t\s]/g, '') : '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
