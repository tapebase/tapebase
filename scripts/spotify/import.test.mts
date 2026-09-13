import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { SpotifyClient, SpotifyLimitError } from "./client.mts";
import { releaseDate, spotifyId, slug } from "./model.mts";
import { discover, preview, previewAlbum, reviewDiscovery } from "./preview.mts";

// In-memory HTTP fixtures only. No real credentials, network or database client.
const aid = "A".repeat(22), bid = "B".repeat(22), sid = "S".repeat(22), tid = "T".repeat(22), guestId = "G".repeat(22);
const ref = { id: aid, name: "Żółć" }, guest = { id: guestId, name: "Gość" };
const release = { id: bid, name: "Wydawnictwo", album_type: "album", images: [], artists: [ref, guest],
  release_date: "2000", release_date_precision: "year", total_tracks: 2 };
const song = { id: tid, name: "Utwór", artists: [ref, guest], disc_number: 1, track_number: 1, duration_ms: 120000 };
const page = (items: unknown[], next: string | null = null) => ({ items, next });
const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(value), { status, headers });
const token = () => json({ access_token: "local-token", expires_in: 3600 });
function client(handler: (url: string, init?: RequestInit) => Response | Promise<Response>, extra = {}) {
  return new SpotifyClient({ clientId: "local-client", clientSecret: "local-secret",
    fetch: async (url, init) => handler(String(url), init), sleep: async () => {}, ...extra });
}

test("CLI rejects writes and missing credentials with nonzero status and no JSON output", () => {
  const entry = fileURLToPath(new URL("../spotify-preview.mts", import.meta.url));
  for (const args of [[aid], [aid, "--write"], [aid, "--max-albums", "0"]]) {
    const result = spawnSync(process.execPath, [entry, ...args], {
      env: { ...process.env, SPOTIFY_CLIENT_ID: "", SPOTIFY_CLIENT_SECRET: "" },
      encoding: "utf8", timeout: 5000,
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.ok(result.stderr.length > 0);
  }
});

test("ID, URI and locale URLs accepted; unrelated hosts and wrong entity rejected", () => {
  for (const input of [aid, `spotify:artist:${aid}`, `https://open.spotify.com/intl-pl/artist/${aid}?si=abc`]) {
    assert.equal(spotifyId(input), aid);
  }
  for (const input of [`https://evil.test/artist/${aid}`, `https://open.spotify.com/album/${aid}`, "../token", `spotify:album:${aid}`]) {
    assert.throws(() => spotifyId(input));
  }
  assert.equal(slug("Żółć", aid), `zolc-${aid}`);
});

test("partial release dates stay partial; invalid calendar dates rejected", () => {
  assert.deepEqual(releaseDate("2000", "year"), { release_date: null, release_date_raw: "2000", release_date_precision: "year" });
  assert.equal(releaseDate("2000-02", "month").release_date, null);
  assert.equal(releaseDate("2000-02-29", "day").release_date, "2000-02-29");
  for (const input of ["2001-02-29", "2000-13-01", "2000-04-31"]) assert.throws(() => releaseDate(input, "day"));
  assert.throws(() => releaseDate("2000", "day"));
});

test("tokens are reused, renewed on expiry and retried once after 401", async () => {
  let now = 0, tokens = 0, gets = 0;
  const api = client((url) => {
    if (url.includes("/api/token")) { tokens++; return token(); }
    gets++;
    return gets === 3 ? json({}, 401) : json({ ok: true });
  }, { now: () => now });
  await api.get(`artists/${aid}`);
  await api.get(`artists/${aid}`);
  assert.equal(tokens, 1);
  now = 3600000;
  await api.get(`artists/${aid}`);
  assert.equal(tokens, 3);
  assert.equal(gets, 4);
});

test("persistent 401, quota, 403 and network failures terminate without secrets", async () => {
  for (const status of [401, 403, 429]) {
    let requests = 0;
    const api = client((url) => {
      requests++;
      return url.includes("/api/token") ? token() : json({ secret: "DO_NOT_PRINT" }, status);
    });
    await assert.rejects(api.get(`artists/${aid}`), (error: Error) => {
      assert.ok(!error.message.includes("DO_NOT_PRINT"));
      return true;
    });
    assert.ok(requests <= 4);
  }
  await assert.rejects(client(() => { throw new Error("DO_NOT_PRINT"); }).get(`artists/${aid}`), /błąd sieci/);
});

test("429 obeys Retry-After, long waits stop; 5xx retries are bounded", async () => {
  const sleeps: number[] = [];
  let calls = 0;
  const api = client((url) => url.includes("/api/token") ? token() : ++calls === 1
    ? json({}, 429, { "retry-after": "2" }) : json({ ok: true }), { sleep: async (ms: number) => { sleeps.push(ms); } });
  await api.get(`artists/${aid}`);
  assert.deepEqual(sleeps, [2000]);
  await assert.rejects(client(() => json({}, 429, { "retry-after": "60" })).get(`artists/${aid}`), /429/);
  await assert.rejects(
    client(() => json({ reason: "QUOTA_EXCEEDED" }, 429)).get(`artists/${aid}`),
    (error: unknown) => error instanceof SpotifyLimitError && error.reason === "QUOTA_EXCEEDED",
  );
  let failures = 0;
  await assert.rejects(client(() => { failures++; return json({}, 503); }).get(`artists/${aid}`), /503/);
  assert.equal(failures, 3);
});

test("pagination refuses external hosts and cycles before leaking credentials", async () => {
  for (const next of ["https://evil.test/steal", `https://api.spotify.com/v1/artists/${aid}/albums`]) {
    let calls = 0;
    const api = client((url) => {
      calls++;
      return url.includes("/api/token") ? token() : json(page([], next));
    });
    await assert.rejects(api.paginate(`artists/${aid}/albums`));
    assert.equal(calls, 2);
  }
});

test("admin discovery lists releases without downloading album details or tracklists", async () => {
  const requested: string[] = [];
  const api = client((url) => {
    requested.push(url);
    if (url.includes("/api/token")) return token();
    if (url.endsWith(`/artists/${aid}`)) return json({ ...ref, images: [] });
    if (url.includes(`/artists/${aid}/albums`)) return json(page([release]));
    throw new Error(`Unexpected detail request: ${url}`);
  });
  const found = await discover(api, aid, "PL");
  const reviewed = reviewDiscovery(found, new Set());
  assert.equal(reviewed.eligible.length, 1);
  assert.equal(reviewed.eligible[0].total_tracks, 2);
  assert.equal(requested.length, 3);
});

function catalog(options: { incomplete?: boolean; duplicatePosition?: boolean } = {}) {
  const requests: string[] = [];
  const api = client((url, init) => {
    requests.push(url);
    if (url.includes("/api/token")) {
      assert.equal(init?.method, "POST");
      return token();
    }
    assert.equal(init?.method ?? "GET", "GET");
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (path === `/v1/artists/${aid}`) return json({ ...ref, images: [] });
    if (path === `/v1/artists/${aid}/albums`) {
      if (parsed.searchParams.has("offset")) return json(page([release]));
      return json(page([release, { ...release, id: sid, album_type: "single" }],
        `https://api.spotify.com/v1/artists/${aid}/albums?offset=2&market=PL`));
    }
    if (path === `/v1/albums/${bid}` || path === `/v1/albums/${sid}`) {
      const isEp = path.endsWith(sid);
      return json({ ...release, id: isEp ? sid : bid, album_type: isEp ? "single" : "album",
        tracks: page([song], options.incomplete ? null : `https://api.spotify.com/v1/albums/${isEp ? sid : bid}/tracks?offset=1&market=PL`) });
    }
    if (path.endsWith("/tracks")) return json(page([{ ...song, disc_number: options.duplicatePosition ? 1 : 2 }]));
    throw new Error(`Unexpected test request: ${path}`);
  });
  return { api, requests };
}

test("preview deduplicates albums, keeps collaborators and all discs, excludes singles", async () => {
  const { api, requests } = catalog();
  const result = await preview(api, { artistId: aid, market: "PL", maxAlbums: 5, epIds: new Set() });
  assert.equal(result.mode, "preview-only");
  assert.equal(result.summary.releases_found, 2);
  assert.equal(result.plan.albums.length, 1);
  assert.equal(result.plan.albums[0].release_date, null);
  assert.equal(result.plan.tracks.length, 2);
  assert.deepEqual(result.plan.tracks.map((item) => item.disc_number), [1, 2]);
  assert.equal(result.plan.artists.length, 2);
  assert.equal(result.plan.album_artists.length, 2);
  assert.equal(result.plan.track_artists.length, 4);
  assert.equal(result.review[0].spotify_id, sid);
  assert.ok(!requests.some((url) => url.includes(`/albums/${sid}`)));
  assert.deepEqual(await preview(catalog().api, { artistId: aid, market: "PL", maxAlbums: 5, epIds: new Set() }), result);
});

test("single-album preview imports a submitted album without scanning its artist", async () => {
  const { api, requests } = catalog();
  const result = await previewAlbum(api, bid, "PL", "album");
  assert.equal(result.plan.albums.length, 1);
  assert.equal(result.plan.tracks.length, 2);
  assert.equal(result.plan.artists.length, 2);
  assert.ok(!requests.some(url => url.includes(`/artists/${aid}`)));
  await assert.rejects(previewAlbum(catalog().api, sid, "PL", "album"), /nie oznacza/);
  assert.equal((await previewAlbum(catalog().api, sid, "PL", "ep")).plan.albums[0].album_type, "ep");
});

test("explicit EPs are eligible, limits are visible and unknown EPs are rejected", async () => {
  const options = { artistId: aid, market: "PL", maxAlbums: 5, epIds: new Set([sid]) };
  const result = await preview(catalog().api, options);
  assert.equal(result.plan.albums.find((item) => item.spotify_id === sid)?.album_type, "ep");
  assert.equal(result.review.length, 0);
  const limited = await preview(catalog().api, { ...options, maxAlbums: 1 });
  assert.equal(limited.summary.complete_for_eligible_albums, false);
  assert.equal(limited.remaining_album_ids.length, 1);
  await assert.rejects(preview(catalog().api, { ...options, epIds: new Set([tid]) }), /nie występuje/);
});

test("incomplete or conflicting tracklists cannot produce an import plan", async () => {
  for (const options of [{ incomplete: true }, { duplicatePosition: true }]) {
    await assert.rejects(preview(catalog(options).api, { artistId: aid, market: "PL", maxAlbums: 5, epIds: new Set() }));
  }
});
