import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Si faltan las llaves, la app sigue funcionando en modo local (localStorage).
export const hasSupabase = Boolean(url && anonKey);

export const supabase = hasSupabase
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
