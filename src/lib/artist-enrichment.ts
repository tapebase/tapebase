import "server-only";
import { importClient } from "../../scripts/spotify/writer.mts";
import {
  findArtistEnrichment,
  getWikidataByQid,
  type EnrichmentCandidate,
} from "@/lib/artist-enrichment-provider";

type ArtistRow = {
  id: number;
  name: string | null;
  spotify_id: string | null;
  description: string | null;
  real_name: string | null;
  birth_date: string | null;
  birth_date_precision: string | null;
  birth_place: string | null;
  country_code: string | null;
  enrichment_status: string;
  enrichment_field_sources: Record<string, unknown> | null;
};

export type ArtistEnrichmentResult = {
  artistId: number;
  artistName: string;
  status: "enriched" | "review" | "not_found" | "failed" | "skipped";
  message: string;
};

function candidateData(candidate: EnrichmentCandidate) {
  return {
    name: candidate.name,
    real_name: candidate.realName,
    birth_date: candidate.birthDate,
    birth_date_precision: candidate.birthDatePrecision,
    birth_place: candidate.birthPlace,
    country_code: candidate.countryCode,
    description: candidate.description,
  };
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : "Nieznany błąd enrichmentu.").slice(0, 1000);
}

async function saveCandidate(artistId: number, candidate: EnrichmentCandidate, status: "pending" | "applied") {
  const database = importClient();
  const { error } = await database.from("artist_enrichment_candidates").upsert({
    artist_id: artistId,
    source: candidate.source,
    source_id: candidate.sourceId,
    source_url: candidate.sourceUrl,
    candidate_data: candidateData(candidate),
    match_evidence: candidate.evidence,
    confidence: candidate.confidence,
    status,
    updated_at: new Date().toISOString(),
  }, { onConflict: "artist_id,source,source_id" });
  if (error) throw new Error("Nie udało się zapisać kandydata enrichmentu.");
}

async function applyCandidate(artist: ArtistRow, candidate: EnrichmentCandidate) {
  const database = importClient();
  const source = { source: candidate.source, id: candidate.sourceId, updated_at: new Date().toISOString() };
  const fieldSources = { ...(artist.enrichment_field_sources ?? {}) };
  const patch: Record<string, unknown> = {
    enrichment_status: "enriched",
    enrichment_source: candidate.source,
    enrichment_source_id: candidate.sourceId,
    enrichment_source_url: candidate.sourceUrl,
    enrichment_confidence: candidate.confidence,
    enrichment_checked_at: new Date().toISOString(),
    enrichment_error: null,
  };
  const values: Array<[keyof ArtistRow, unknown]> = [
    ["real_name", candidate.realName],
    ["birth_date", candidate.birthDate],
    ["birth_date_precision", candidate.birthDatePrecision],
    ["birth_place", candidate.birthPlace],
    ["country_code", candidate.countryCode],
    ["description", candidate.description],
  ];
  for (const [field, value] of values) {
    if ((artist[field] === null || artist[field] === "") && value !== null && value !== "") {
      patch[field] = value;
      fieldSources[field] = source;
    }
  }
  patch.enrichment_field_sources = fieldSources;
  const { error } = await database.from("artists").update(patch).eq("id", artist.id);
  if (error) throw new Error("Nie udało się zapisać danych artysty.");
  await saveCandidate(artist.id, candidate, "applied");
}

async function loadArtistBySpotifyId(spotifyId: string) {
  const database = importClient();
  const { data, error } = await database.from("artists").select(
    "id,name,spotify_id,description,real_name,birth_date,birth_date_precision,birth_place,country_code,enrichment_status,enrichment_field_sources",
  ).eq("spotify_id", spotifyId).maybeSingle<ArtistRow>();
  if (error) throw new Error("Nie udało się odczytać artysty do enrichmentu.");
  return data;
}

export async function enrichArtistBySpotifyId(spotifyId: string, force = false): Promise<ArtistEnrichmentResult> {
  const database = importClient();
  let artist: ArtistRow | null = null;
  try {
    artist = await loadArtistBySpotifyId(spotifyId);
    if (!artist?.name || !artist.spotify_id) throw new Error("Artysta nie ma kompletnej tożsamości Spotify.");
    if (!force && ["enriched", "review", "not_found", "failed", "running"].includes(artist.enrichment_status)) {
      return { artistId: artist.id, artistName: artist.name, status: "skipped", message: "Artysta był już sprawdzony." };
    }
    await database.from("artists").update({ enrichment_status: "running", enrichment_error: null }).eq("id", artist.id);
    const found = await findArtistEnrichment({ name: artist.name, spotifyId: artist.spotify_id });
    if (found.exact) {
      await applyCandidate(artist, found.exact);
      return { artistId: artist.id, artistName: artist.name, status: "enriched", message: `Dopasowano przez ${found.exact.source}.` };
    }
    for (const candidate of found.candidates) await saveCandidate(artist.id, candidate, "pending");
    const status = found.candidates.length ? "review" : "not_found";
    const { error } = await database.from("artists").update({
      enrichment_status: status,
      enrichment_checked_at: new Date().toISOString(),
      enrichment_error: null,
    }).eq("id", artist.id);
    if (error) throw new Error("Nie udało się zapisać wyniku enrichmentu.");
    return {
      artistId: artist.id, artistName: artist.name, status,
      message: found.candidates.length ? `Znaleziono ${found.candidates.length} kandydatów do weryfikacji.` : "Nie znaleziono bezpiecznego dopasowania.",
    };
  } catch (error) {
    if (artist) await database.from("artists").update({
      enrichment_status: "failed", enrichment_checked_at: new Date().toISOString(), enrichment_error: safeError(error),
    }).eq("id", artist.id);
    return { artistId: artist?.id ?? 0, artistName: artist?.name ?? spotifyId, status: "failed", message: safeError(error) };
  }
}

export async function runArtistEnrichmentBatch(limit = 5) {
  const database = importClient();
  const safeLimit = Math.max(1, Math.min(10, Math.trunc(limit)));
  const { data, error } = await database.from("artists").select("spotify_id,enrichment_status")
    .eq("catalog_visible", true).not("spotify_id", "is", null)
    .in("enrichment_status", ["pending", "failed"]).order("id").limit(safeLimit);
  if (error) throw new Error("Nie udało się pobrać kolejki enrichmentu.");
  const results: ArtistEnrichmentResult[] = [];
  for (const row of data ?? []) if (row.spotify_id) results.push(await enrichArtistBySpotifyId(row.spotify_id, row.enrichment_status === "failed"));
  return results;
}

export async function reviewArtistEnrichment(candidateId: number, action: "approve" | "reject", adminId: string) {
  const database = importClient();
  const { data: candidate, error } = await database.from("artist_enrichment_candidates")
    .select("id,artist_id,source,source_id,source_url,candidate_data,match_evidence,confidence,status")
    .eq("id", candidateId).eq("status", "pending").maybeSingle();
  if (error || !candidate) throw new Error("Kandydat nie istnieje albo został już rozpatrzony.");
  if (action === "reject") {
    await database.from("artist_enrichment_candidates").update({ status: "rejected", reviewed_by: adminId, reviewed_at: new Date().toISOString() }).eq("id", candidateId);
    const { count } = await database.from("artist_enrichment_candidates").select("id", { count: "exact", head: true }).eq("artist_id", candidate.artist_id).eq("status", "pending");
    if (!count) await database.from("artists").update({ enrichment_status: "not_found" }).eq("id", candidate.artist_id);
    return;
  }
  const { data: artist, error: artistError } = await database.from("artists").select(
    "id,name,spotify_id,description,real_name,birth_date,birth_date_precision,birth_place,country_code,enrichment_status,enrichment_field_sources",
  ).eq("id", candidate.artist_id).single<ArtistRow>();
  if (artistError || !artist) throw new Error("Nie udało się odczytać artysty.");
  const stored = candidate.candidate_data as Record<string, unknown>;
  let selected: EnrichmentCandidate = {
    source: candidate.source, sourceId: candidate.source_id, sourceUrl: candidate.source_url,
    confidence: Number(candidate.confidence), evidence: candidate.match_evidence as Record<string, unknown>,
    name: String(stored.name ?? artist.name ?? ""), realName: typeof stored.real_name === "string" ? stored.real_name : null,
    birthDate: typeof stored.birth_date === "string" ? stored.birth_date : null,
    birthDatePrecision: ["day", "month", "year"].includes(String(stored.birth_date_precision)) ? stored.birth_date_precision as EnrichmentCandidate["birthDatePrecision"] : null,
    birthPlace: typeof stored.birth_place === "string" ? stored.birth_place : null,
    countryCode: typeof stored.country_code === "string" ? stored.country_code : null,
    description: typeof stored.description === "string" ? stored.description : null,
  };
  if (selected.source === "wikidata" && selected.evidence.searchOnly) {
    const detailed = await getWikidataByQid(selected.sourceId);
    if (detailed) selected = { ...detailed, confidence: selected.confidence, evidence: { ...selected.evidence, adminApproved: true } };
  }
  await applyCandidate(artist, selected);
  await database.from("artist_enrichment_candidates").update({ status: "applied", reviewed_by: adminId, reviewed_at: new Date().toISOString() }).eq("id", candidateId);
  await database.from("artist_enrichment_candidates").update({ status: "rejected", reviewed_by: adminId, reviewed_at: new Date().toISOString() })
    .eq("artist_id", artist.id).eq("status", "pending").neq("id", candidateId);
}
