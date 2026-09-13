import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseTicketmasterEvent, type TicketmasterEvent } from "@/lib/ticketmaster";

const SOURCE = "ticketmaster";

type ArtistRow = { id: number; name: string };
type SyncResult = {
  artistsChecked: number;
  eventsFound: number;
  eventsSaved: number;
  artistsFailed: number;
  cycleComplete: boolean;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Brakuje konfiguracji Supabase po stronie serwera.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(15000) }) },
  });
}

function requiredTicketmasterKey() {
  const key = process.env.TICKETMASTER_API_KEY?.trim();
  if (!key) throw new Error("Dodaj TICKETMASTER_API_KEY do .env.local, aby uruchomić synchronizację.");
  return key;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Nieznany błąd synchronizacji koncertów.";
}

function assertDatabase(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(`${fallback}: ${error.message}`);
}

async function ticketmasterEvents(artist: ArtistRow, attractionId: string | null) {
  const params = new URLSearchParams({
    apikey: requiredTicketmasterKey(),
    countryCode: "PL",
    classificationName: "music",
    startDateTime: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    size: "50",
    sort: "date,asc",
  });
  if (attractionId) params.set("attractionId", attractionId);
  else params.set("keyword", artist.name);
  const response = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 429) {
    const retry = response.headers.get("retry-after");
    throw new Error(`Ticketmaster ograniczył liczbę zapytań${retry ? `; ponów za ${retry} s` : ". Spróbuj ponownie później"}.`);
  }
  if (response.status === 401 || response.status === 403) throw new Error("Ticketmaster odrzucił klucz API. Sprawdź TICKETMASTER_API_KEY.");
  if (!response.ok) throw new Error(`Ticketmaster zwrócił HTTP ${response.status}.`);
  const body = await response.json() as { _embedded?: { events?: TicketmasterEvent[] } };
  return body._embedded?.events ?? [];
}

async function saveConcert(client: SupabaseClient, artist: ArtistRow, event: ReturnType<typeof parseTicketmasterEvent>) {
  if (!event) return false;
  const { data: existing, error: sourceError } = await client.from("concert_sources")
    .select("concert_id").eq("source", SOURCE).eq("external_id", event.externalId).maybeSingle();
  assertDatabase(sourceError, "Nie udało się sprawdzić wydarzenia");

  const concertData = {
    title: event.title,
    starts_at: event.startsAt,
    start_time_known: event.startTimeKnown,
    ends_at: event.endsAt,
    timezone: event.timezone,
    status: event.status,
    venue_name: event.venueName,
    city: event.city,
    country_code: event.countryCode,
    latitude: event.latitude,
    longitude: event.longitude,
    image_url: event.imageUrl,
  };
  let concertId = existing?.concert_id as number | undefined;
  if (concertId) {
    const { error } = await client.from("concerts").update(concertData).eq("id", concertId);
    assertDatabase(error, "Nie udało się zaktualizować koncertu");
  } else {
    const { data, error } = await client.from("concerts").insert(concertData).select("id").single();
    assertDatabase(error, "Nie udało się zapisać koncertu");
    concertId = data!.id as number;
  }

  const now = new Date().toISOString();
  const { error: mappingError } = await client.from("artist_event_sources").upsert({
    artist_id: artist.id, source: SOURCE, external_artist_id: event.attraction.id,
    matched_name: event.attraction.name, updated_at: now,
  }, { onConflict: "artist_id,source" });
  assertDatabase(mappingError, `Nie udało się zapisać mapowania artysty ${artist.name}`);
  const writes = await Promise.all([
    client.from("concert_sources").upsert({
      concert_id: concertId, source: SOURCE, external_id: event.externalId,
      source_url: event.url, last_seen_at: now, raw_status: event.rawStatus,
    }, { onConflict: "source,external_id" }),
    client.from("concert_artists").upsert({ concert_id: concertId, artist_id: artist.id, position: 0 }, { onConflict: "concert_id,artist_id" }),
    client.from("ticket_offers").upsert({
      concert_id: concertId, provider: SOURCE, external_id: event.externalId,
      url: event.url, status: event.offerStatus, price_min: event.priceMin,
      price_max: event.priceMax, currency: event.currency, last_checked_at: now,
    }, { onConflict: "provider,external_id" }),
  ]);
  for (const result of writes) assertDatabase(result.error, "Nie udało się zapisać powiązania wydarzenia");
  return true;
}

export async function syncTicketmasterConcerts(options: { startedBy?: string | null; batchSize?: number } = {}): Promise<SyncResult> {
  requiredTicketmasterKey();
  const client = adminClient();
  const batchSize = Math.min(50, Math.max(1, options.batchSize ?? 20));
  const staleBefore = new Date(Date.now() - 15 * 60_000).toISOString();
  await client.from("concert_sync_runs").update({
    status: "failed", error_message: "Synchronizacja przerwana lub serwer został uruchomiony ponownie.", finished_at: new Date().toISOString(),
  }).eq("status", "running").lt("started_at", staleBefore);

  const { data: run, error: runError } = await client.from("concert_sync_runs")
    .insert({ started_by: options.startedBy ?? null }).select("id").single();
  if (runError) {
    if (runError.code === "23505") throw new Error("Inna synchronizacja koncertów już trwa.");
    throw new Error(`Nie udało się uruchomić synchronizacji: ${runError.message}`);
  }

  const runId = run.id as number;
  let artistsChecked = 0, eventsFound = 0, eventsSaved = 0;
  const artistErrors: string[] = [];
  try {
    const { data: state, error: stateError } = await client.from("concert_sync_state").select("last_artist_id").eq("id", true).single();
    assertDatabase(stateError, "Nie udało się odczytać postępu synchronizacji");
    if (!state) throw new Error("Brakuje stanu synchronizacji koncertów w bazie.");
    const { data: artists, error: artistsError } = await client.from("artists").select("id,name")
      .eq("catalog_visible", true).gt("id", state.last_artist_id).order("id").limit(batchSize + 1);
    assertDatabase(artistsError, "Nie udało się pobrać artystów");
    const rows = (artists ?? []) as ArtistRow[];
    const hasMore = rows.length > batchSize;
    const selected = rows.slice(0, batchSize);

    for (const artist of selected) {
      try {
        const { data: mapping, error: mappingError } = await client.from("artist_event_sources")
          .select("external_artist_id").eq("artist_id", artist.id).eq("source", SOURCE).maybeSingle();
        assertDatabase(mappingError, `Nie udało się odczytać mapowania artysty ${artist.name}`);
        const attractionId = (mapping?.external_artist_id as string | null) ?? null;
        const events = await ticketmasterEvents(artist, attractionId);
        for (const raw of events) {
          const parsed = parseTicketmasterEvent(raw, artist.name, attractionId);
          if (!parsed) continue;
          eventsFound++;
          if (await saveConcert(client, artist, parsed)) eventsSaved++;
        }
      } catch (error) {
        const message = errorMessage(error);
        if (message.startsWith("Ticketmaster ")) throw error;
        artistErrors.push(`${artist.name}: ${message}`);
      } finally {
        artistsChecked++;
      }
    }

    const cycleComplete = !hasMore;
    const now = new Date().toISOString();
    const lastArtistId = cycleComplete ? 0 : selected.at(-1)?.id ?? state.last_artist_id;
    const { error: progressError } = await client.from("concert_sync_state").update({
      last_artist_id: lastArtistId, last_completed_at: cycleComplete ? now : undefined,
      last_error: artistErrors.length ? artistErrors.slice(0, 5).join(" | ").slice(0, 1000) : null, updated_at: now,
    }).eq("id", true);
    assertDatabase(progressError, "Nie udało się zapisać postępu synchronizacji");
    await client.from("concert_sync_runs").update({
      status: "completed", artists_checked: artistsChecked, events_found: eventsFound,
      events_saved: eventsSaved, error_message: artistErrors.length ? artistErrors.slice(0, 5).join(" | ").slice(0, 1000) : null, finished_at: now,
    }).eq("id", runId);
    return { artistsChecked, eventsFound, eventsSaved, artistsFailed: artistErrors.length, cycleComplete };
  } catch (error) {
    const message = errorMessage(error).slice(0, 1000);
    const now = new Date().toISOString();
    await Promise.all([
      client.from("concert_sync_runs").update({
        status: "failed", artists_checked: artistsChecked, events_found: eventsFound,
        events_saved: eventsSaved, error_message: message, finished_at: now,
      }).eq("id", runId),
      client.from("concert_sync_state").update({ last_error: message, updated_at: now }).eq("id", true),
    ]);
    throw new Error(message);
  }
}
