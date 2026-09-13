// Read-only inspection of metadata exposed to the configured role.
// This deliberately never reads table rows or calls write endpoints.
const tables = [
  "artists", "albums", "tracks", "album_artists", "track_artists",
  "concerts", "concert_artists", "concert_sources", "artist_event_sources",
  "ticket_offers", "concert_sync_state", "concert_sync_runs",
];

try {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = secret || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) throw new Error("Brak konfiguracji Supabase w .env.local.");
  const url = new URL("/rest/v1/", base);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("Supabase wymaga HTTPS poza środowiskiem lokalnym.");
  }
  const response = await fetch(url, {
    headers: { apikey: key, ...(!key.startsWith("sb_") ? { Authorization: `Bearer ${key}` } : {}), Accept: "application/openapi+json" },
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Odczyt metadanych Supabase: HTTP ${response.status}.`);
  const schema = await response.json();
  console.log(JSON.stringify({
    scope: `OpenAPI (${secret ? "backend" : "public"}); nie potwierdza RLS, wszystkich indeksów ani uprawnień zapisu`,
    tables: Object.fromEntries(tables.map((name) => [name, schema.definitions?.[name] ?? null])),
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Nie udało się odczytać schematu.");
  if (error instanceof Error && error.cause && typeof error.cause === "object" && "code" in error.cause) {
    console.error(`Kod błędu sieci: ${String(error.cause.code)}`);
  }
  process.exitCode = 1;
}

export {};
