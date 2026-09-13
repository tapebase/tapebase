import "server-only";
import { randomUUID } from "node:crypto";
import { SpotifyClient, SpotifyLimitError } from "../../scripts/spotify/client.mts";
import { discover, previewAlbum, reviewDiscovery } from "../../scripts/spotify/preview.mts";
import { slug } from "../../scripts/spotify/model.mts";
import { prepareImport } from "../../scripts/spotify/payload.mts";
import { importClient, writeImport } from "../../scripts/spotify/writer.mts";
import { enrichArtistBySpotifyId } from "@/lib/artist-enrichment";

type Job = {
  id: number; submission_id: number; spotify_type: "artist" | "album"; spotify_id: string;
  title: string; market: string; release_kind: "album" | "ep" | null; status: string;
  retry_at: string | null; worker_id: string | null; locked_until: string | null;
  genre: string;
};
type Item = {
  id: number; job_id: number; spotify_album_id: string; title: string;
  album_type: "album" | "ep"; status: string; attempt_count: number;
};

const runtime = globalThis as typeof globalThis & { __tapebaseQueueRun?: Promise<QueueBatchResult> };

function client() {
  return new SpotifyClient({
    clientId: process.env.SPOTIFY_CLIENT_ID ?? "",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
    minIntervalMs: 400,
  });
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "Import albumu nie powiódł się.";
}

function retryAt(error: SpotifyLimitError) {
  const fallback = error.reason === "QUOTA_EXCEEDED" ? 60 * 60 : 5 * 60;
  const seconds = error.retryAfterSeconds && error.retryAfterSeconds > 0
    ? Math.ceil(error.retryAfterSeconds) : fallback;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export type QueueBatchResult = {
  processed: number;
  completed: number;
  failed: number;
  waitingQuota: boolean;
  hasMore: boolean;
  message: string;
};

async function refreshJob(database: ReturnType<typeof importClient>, job: Job, workerId: string) {
  const { data: items, error } = await database.from("catalog_import_items")
    .select("status,title,error_message").eq("job_id", job.id);
  if (error) throw new Error("Nie udało się odczytać postępu zadania.");
  const completed = (items ?? []).filter(item => item.status === "completed").length;
  const failures = (items ?? []).filter(item => item.status === "failed");
  const pending = (items ?? []).length - completed - failures.length;
  const status = pending > 0 ? "queued" : completed > 0
    ? (failures.length > 0 ? "completed_with_errors" : "completed") : "failed";
  const details = failures.slice(0, 3).map(item => `${item.title}: ${item.error_message ?? "nieznany błąd"}`).join("; ");
  const suffix = failures.length > 3 ? `; +${failures.length - 3} kolejnych` : "";
  const { error: updateError } = await database.from("catalog_import_jobs").update({
    status, albums_total: (items ?? []).length, albums_completed: completed,
    completed_at: pending === 0 ? new Date().toISOString() : null,
    error_message: details ? `Nie udały się albumy: ${details}${suffix}` : null,
    worker_id: null, locked_until: null, retry_at: null,
  }).eq("id", job.id).eq("worker_id", workerId);
  if (updateError) throw new Error("Nie udało się zapisać stanu zadania.");
  if (pending === 0 && completed > 0) {
    if (job.spotify_type === "artist") {
      const { error: visibilityError } = await database.from("artists")
        .update({ catalog_visible: true }).eq("spotify_id", job.spotify_id);
      if (visibilityError) throw new Error("Nie udało się opublikować profilu artysty w katalogu.");
    }
    const { error: submissionError } = await database.from("catalog_submissions")
      .update({ status: "imported" }).eq("id", job.submission_id);
    if (submissionError) throw new Error("Nie udało się zakończyć zgłoszenia importu.");
  }
  return { completed, failed: failures.length, pending };
}

async function waitForSpotify(database: ReturnType<typeof importClient>, job: Job, workerId: string, cause: SpotifyLimitError, album?: Item) {
  const nextAttempt = retryAt(cause);
  if (album) {
    await database.from("catalog_import_items").update({
      status: "queued", retry_at: nextAttempt,
      error_message: `Wstrzymano po 429: ${cause.message}`,
    }).eq("id", album.id);
  }
  const context = album ? `albumie „${album.title}”` : `pobieraniu pozycji „${job.title}”`;
  await database.from("catalog_import_jobs").update({
    status: "waiting_quota", retry_at: nextAttempt,
    error_message: `Spotify 429 przy ${context}. Następna próba: ${new Date(nextAttempt).toLocaleString("pl-PL")}.`,
    worker_id: null, locked_until: null,
  }).eq("id", job.id).eq("worker_id", workerId);
  return nextAttempt;
}

async function prepareItems(database: ReturnType<typeof importClient>, spotify: SpotifyClient, job: Job, countryCode: string, genre: string) {
  const { count, error: countError } = await database.from("catalog_import_items")
    .select("id", { count: "exact", head: true }).eq("job_id", job.id);
  if (countError) throw new Error("Nie udało się sprawdzić elementów zadania.");
  if ((count ?? 0) > 0) return;

  if (job.spotify_type === "album") {
    const { error } = await database.from("catalog_import_items").insert({
      job_id: job.id, spotify_album_id: job.spotify_id, title: job.title,
      album_type: job.release_kind ?? "album",
    });
    if (error) throw new Error("Nie udało się przygotować albumu w kolejce.");
    await database.from("catalog_import_jobs").update({ albums_total: 1 }).eq("id", job.id);
    return;
  }

  const found = reviewDiscovery(await discover(spotify, job.spotify_id, job.market), new Set());
  const releases = found.eligible.slice(0, 100);
  const albums = releases.map(album => ({
    job_id: job.id, spotify_album_id: album.spotify_id, title: album.title,
    album_type: album.album_type,
  }));
  if (!albums.length) throw new Error("Spotify nie zwróciło albumów kwalifikujących się do importu.");
  const artists = new Map<string, { spotify_id: string; name: string; slug: string; spotify_url: string; image_url?: string | null }>();
  artists.set(found.artist.spotify_id, found.artist);
  for (const album of releases) {
    for (const artist of album.artists) {
      if (!artists.has(artist.spotify_id)) artists.set(artist.spotify_id, { ...artist, slug: slug(artist.name, artist.spotify_id) });
    }
  }
  const stubPayload = {
    version: 1,
    artists: [...artists.values()],
    albums: releases.map(album => ({
      spotify_id: album.spotify_id, title: album.title, slug: album.slug,
      cover_url: album.cover_url, release_date: album.release_date,
      release_date_raw: album.release_date_raw, release_date_precision: album.release_date_precision,
      album_type: album.album_type, artists: album.artists.map(artist => artist.spotify_id),
    })),
  };
  const { data: stubResult, error: stubError } = await database.rpc("import_spotify_catalog_stubs", { payload: stubPayload });
  if (stubError || stubResult?.version !== 1 || stubResult?.albums !== albums.length) {
    throw new Error("Nie udało się zapisać podstawowych danych albumów w katalogu.");
  }
  const { error: countryError } = await database.from("artists").update({ country_code: countryCode }).eq("spotify_id", found.artist.spotify_id);
  if (countryError) throw new Error("Nie udało się przypisać kraju artyście.");
  const { error: genreError } = await database.from("albums").update({ genre })
    .in("spotify_id", releases.map(album => album.spotify_id));
  if (genreError) throw new Error("Nie udało się przypisać gatunku albumom.");
  const { error } = await database.from("catalog_import_items").insert(albums);
  if (error) throw new Error("Nie udało się zapisać albumów w kolejce.");
  await database.from("catalog_import_jobs").update({ albums_total: albums.length }).eq("id", job.id);
}

async function claimJob(database: ReturnType<typeof importClient>, workerId: string) {
  const { data, error } = await database.rpc("claim_catalog_import_job", {
    claim_worker: workerId, lease_seconds: 300, max_parallel: 1,
  });
  if (error) throw new Error("Nie udało się bezpiecznie pobrać zadania z kolejki.");
  return (data as unknown as Job[] | null)?.[0] ?? null;
}

async function queueState(database: ReturnType<typeof importClient>) {
  const { data, error } = await database.from("catalog_import_jobs")
    .select("status,retry_at,locked_until").in("status", ["queued", "running", "waiting_quota"]);
  if (error) throw new Error("Nie udało się sprawdzić pozostałych zadań.");
  const now = Date.now();
  const due = (data ?? []).some(job => job.status === "queued"
    || (job.status === "waiting_quota" && (!job.retry_at || Date.parse(job.retry_at) <= now)));
  const waiting = (data ?? []).filter(job => job.status === "waiting_quota" && job.retry_at && Date.parse(job.retry_at) > now)
    .sort((a, b) => Date.parse(a.retry_at!) - Date.parse(b.retry_at!));
  const running = (data ?? []).some(job => job.status === "running" && job.locked_until && Date.parse(job.locked_until) > now);
  return { due, running, nextRetry: waiting[0]?.retry_at ?? null };
}

async function executeBatch(maxItems = 3): Promise<QueueBatchResult> {
  const database = importClient();
  const spotify = client();
  const workerId = randomUUID();
  let processed = 0, completed = 0, failed = 0;

  while (processed < maxItems) {
    const job = await claimJob(database, workerId);
    if (!job) break;
    const { data: submission, error: submissionError } = await database.from("catalog_submissions")
      .select("country_code,genre").eq("id", job.submission_id).single();
    if (submissionError || !submission?.country_code || !submission.genre) throw new Error("Nie udało się odczytać danych zgłoszenia.");
    const countryCode = submission.country_code as string;
    try {
      await prepareItems(database, spotify, job, countryCode, submission.genre);
    } catch (cause) {
      if (cause instanceof SpotifyLimitError) {
        const next = await waitForSpotify(database, job, workerId, cause);
        return { processed, completed, failed, waitingQuota: true, hasMore: false, message: `Kolejka czeka na Spotify. Następna próba po ${new Date(next).toLocaleString("pl-PL")}.` };
      }
      await database.from("catalog_import_jobs").update({
        status: "failed", error_message: `Nie udało się przygotować „${job.title}”: ${errorMessage(cause)}`,
        worker_id: null, locked_until: null,
      }).eq("id", job.id).eq("worker_id", workerId);
      failed++;
      continue;
    }

    const { data: items, error: itemError } = await database.from("catalog_import_items")
      .select("id,job_id,spotify_album_id,title,album_type,status,attempt_count")
      .eq("job_id", job.id).eq("status", "queued")
      .or(`retry_at.is.null,retry_at.lte.${new Date().toISOString()}`)
      .order("id").returns<Item[]>();
    if (itemError) throw new Error("Nie udało się pobrać albumów zadania.");

    for (const item of items ?? []) {
      if (processed >= maxItems) break;
      await database.from("catalog_import_jobs").update({ locked_until: new Date(Date.now() + 300_000).toISOString() })
        .eq("id", job.id).eq("worker_id", workerId);
      await database.from("catalog_import_items").update({
        status: "running", error_message: null, retry_at: null,
        attempt_count: item.attempt_count + 1, last_attempt_at: new Date().toISOString(),
      }).eq("id", item.id);
      try {
        const plan = await previewAlbum(spotify, item.spotify_album_id, job.market, item.album_type);
        const payload = prepareImport(plan);
        await writeImport(payload, database);
        const { error: genreError } = await database.from("albums").update({ genre: submission.genre })
          .eq("spotify_id", item.spotify_album_id);
        if (genreError) throw new Error("Nie udało się przypisać gatunku albumowi.");
        const primaryArtistId = job.spotify_type === "artist" ? job.spotify_id : payload.albums[0]?.artists[0];
        if (primaryArtistId) {
          const { error: countryError } = await database.from("artists").update({ country_code: countryCode }).eq("spotify_id", primaryArtistId);
          if (countryError) throw new Error("Nie udało się przypisać kraju głównemu artyście.");
          await enrichArtistBySpotifyId(primaryArtistId);
        }
        const { data: album } = await database.from("albums").select("id").eq("spotify_id", item.spotify_album_id).single();
        await database.from("catalog_import_items").update({
          status: "completed", album_id: album?.id ?? null, error_message: null, retry_at: null,
        }).eq("id", item.id);
        completed++;
      } catch (cause) {
        if (cause instanceof SpotifyLimitError) {
          const next = await waitForSpotify(database, job, workerId, cause, item);
          return { processed, completed, failed, waitingQuota: true, hasMore: false, message: `Wstrzymano na albumie „${item.title}”. Następna próba po ${new Date(next).toLocaleString("pl-PL")}.` };
        }
        await database.from("catalog_import_items").update({
          status: "failed", error_message: errorMessage(cause), retry_at: null,
        }).eq("id", item.id);
        failed++;
      }
      processed++;
    }
    await refreshJob(database, job, workerId);
  }

  const state = await queueState(database);
  const waitingMessage = state.nextRetry ? ` Najbliższa ponowna próba: ${new Date(state.nextRetry).toLocaleString("pl-PL")}.` : "";
  return {
    processed, completed, failed,
    waitingQuota: !state.due && Boolean(state.nextRetry),
    hasMore: state.due,
    message: processed ? `Przetworzono ${processed} albumów: ${completed} poprawnie, ${failed} błędów.${waitingMessage}`
      : state.running ? "Inny import jest już w trakcie. Równocześnie działa najwyżej jedno zadanie."
        : state.nextRetry ? `Kolejka czeka na Spotify. Następna próba po ${new Date(state.nextRetry).toLocaleString("pl-PL")}.`
          : "Kolejka nie ma pozycji gotowych do uruchomienia.",
  };
}

export function runImportQueueBatch(maxItems = 3) {
  if (runtime.__tapebaseQueueRun) return runtime.__tapebaseQueueRun;
  runtime.__tapebaseQueueRun = executeBatch(maxItems).finally(() => { runtime.__tapebaseQueueRun = undefined; });
  return runtime.__tapebaseQueueRun;
}

export async function resetImportJob(jobId: number, releaseKind?: "album" | "ep") {
  const database = importClient();
  if (releaseKind) await database.from("catalog_import_jobs").update({ release_kind: releaseKind }).eq("id", jobId).eq("spotify_type", "album");
  const itemUpdate = releaseKind
    ? { status: "queued", error_message: null, album_type: releaseKind, retry_at: null }
    : { status: "queued", error_message: null, retry_at: null };
  await database.from("catalog_import_items").update(itemUpdate).eq("job_id", jobId).in("status", ["failed", "running"]);
  await database.from("catalog_import_jobs").update({
    status: "queued", error_message: null, completed_at: null,
    retry_at: null, worker_id: null, locked_until: null,
  }).eq("id", jobId);
}
