import { createClient } from "@supabase/supabase-js";
import type { ImportPayload } from "./payload.mts";

export function importClient(env: Record<string, string | undefined> = process.env, fetcher: typeof fetch = fetch) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !key) {
    throw new Error("Zapis wymaga NEXT_PUBLIC_SUPABASE_URL oraz SUPABASE_SECRET_KEY (lub SUPABASE_SERVICE_ROLE_KEY) w .env.local.");
  }
  const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Nieprawidłowy adres projektu Supabase; wymagany główny adres HTTPS.");
  }
  let serviceRole = key.startsWith("sb_secret_");
  if (!serviceRole) {
    try {
      serviceRole = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "service_role";
    } catch { /* The API verifies the credential; this only rejects obvious public keys. */ }
  }
  if (!serviceRole) throw new Error("Importer wymaga sekretnego klucza backendu, nie klucza anon/publishable.");
  return createClient(url.href, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetcher(input, { ...init, signal: AbortSignal.timeout(60000), redirect: "error" }) },
  });
}

export async function writeImport(payload: ImportPayload, client: ReturnType<typeof importClient>) {
  const { data: status, error: statusError } = await client.rpc("spotify_import_status", {}, { get: true });
  if (statusError || status?.version !== 1) {
    throw new Error(`Baza nie jest gotowa do importu v1. Sprawdź połączenie, klucz i migrację${statusError?.code ? ` (${statusError.code})` : ""}.`);
  }
  const { data, error } = await client.rpc("import_spotify_catalog", { payload });
  if (error) {
    // Avoid echoing upstream details, headers or credentials. SQL rolls back on an
    // error; after a transport failure the commit outcome must be checked separately.
    throw new Error(`Import nie został potwierdzony${error.code ? ` (${error.code})` : ""}. Sprawdź stan bazy przed ponowieniem; import jest odporny na duplikaty.`);
  }
  if (data?.version !== 1 || data?.albums !== payload.albums.length ||
      data?.tracks !== payload.albums.reduce((count, item) => count + item.tracks.length, 0)) {
    throw new Error("Baza zwróciła nieoczekiwane potwierdzenie. Sprawdź stan importu.");
  }
  return data;
}
