import "server-only";
import { createClient } from "@supabase/supabase-js";

// Public catalog reads obey RLS. Import credentials are never used by pages.
export function catalogClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Katalog jest chwilowo niedostępny.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, {
      ...init, cache: "no-store", signal: AbortSignal.timeout(6000),
    }) },
  });
}
