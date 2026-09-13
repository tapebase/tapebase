import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { prepareImport } from "./payload.mts";
import { importClient, writeImport } from "./writer.mts";

// Real catalog metadata captured from the successful Spotify preview. All SQL
// executes in disposable WASM memory; these tests cannot connect to Supabase.
const fixture = JSON.parse(await readFile(new URL("./fixtures/dla-fanek-euforii.json", import.meta.url), "utf8"));
const migration = await readFile(new URL("../../supabase/migrations/202609080001_spotify_catalog.sql", import.meta.url), "utf8");
const basePayload = prepareImport(fixture);
const existingSchema = await readFile(new URL("./fixtures/existing-catalog.sql", import.meta.url), "utf8");

test("reviewed plans reject broken references and incomplete or unapproved releases", () => {
  for (const mutate of [
    (value: typeof fixture) => value.plan.tracks.pop(),
    (value: typeof fixture) => value.plan.artists.pop(),
    (value: typeof fixture) => value.plan.album_artists.push(value.plan.album_artists[0]),
    (value: typeof fixture) => { value.plan.albums[0].spotify_album_type = "single"; },
    (value: typeof fixture) => { value.plan.albums[0].release_date = "1900-01-01"; },
  ]) {
    const value = structuredClone(fixture);
    mutate(value);
    assert.throws(() => prepareImport(value));
  }
  assert.equal(basePayload.albums[0].tracks.length, 7);
  assert.ok(basePayload.artists.length > 1);
});

test("import client requires a backend key and verifies schema before writing", async () => {
  assert.throws(() => importClient({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" }), /wymaga/);
  assert.throws(() => importClient({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "sb_publishable_wrong" }), /backendu/);
  const urls: string[] = [];
  const client = importClient({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_local_fixture" }, async (url) => {
    urls.push(String(url));
    return new Response(JSON.stringify({ version: 999 }), { headers: { "Content-Type": "application/json" } });
  });
  await assert.rejects(writeImport(basePayload, client), /nie jest gotowa/);
  assert.equal(urls.length, 1);
  assert.ok(urls[0].includes("spotify_import_status"));
});

for (const schema of ["empty", "existing"] as const) test(`transactional SQL import (${schema} schema)`, async (t) => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon, authenticated, service_role;");
    if (schema === "existing") await db.exec(existingSchema);
    await db.exec(migration);
    await db.exec(migration); // Installation can be repeated without dropping data.
    async function run(payload = basePayload) {
      return db.query<{ result: { version: number; artists: number; albums: number; tracks: number } }>(
        "select public.import_spotify_catalog($1::jsonb) as result", [JSON.stringify(payload)]);
    }
    async function snapshot() {
      const tables = ["artists", "albums", "tracks", "album_artists", "spotify_track_artists"];
      const result: Record<string, unknown> = {};
      for (const table of tables) {
        const rows = await db.query(`select to_jsonb(t) - 'updated_at' as value from public.${table} t order by to_jsonb(t)::text`);
        result[table] = rows.rows;
      }
      return result;
    }

    await t.test("public roles cannot call importer; service role can; repeated import preserves IDs", async () => {
      for (const role of ["anon", "authenticated"]) {
        await db.exec(`set role ${role}`);
        await assert.rejects(run(), /permission denied/);
        await db.exec("reset role");
      }
      await db.exec("set role service_role");
      const first = await run();
      assert.deepEqual(first.rows[0].result, { version: 1, artists: basePayload.artists.length, albums: 1, tracks: 7 });
      const before = await snapshot();
      await run();
      assert.deepEqual(await snapshot(), before);
      await db.exec("reset role");
    });

    await t.test("editorial descriptions, slugs and existing un-fetched images survive reimport", async () => {
      const guest = basePayload.artists.find((item) => !Object.hasOwn(item, "image_url"))!;
      await db.query("update public.artists set description='Opis redakcyjny', slug='redakcyjny-artysta', image_url='https://example.com/editorial.jpg' where spotify_id=$1", [guest.spotify_id]);
      await db.exec("update public.albums set description='Opis albumu', slug='redakcyjny-album'");
      await run();
      const artist = await db.query("select description,slug,image_url from public.artists where spotify_id=$1", [guest.spotify_id]);
      assert.deepEqual(artist.rows[0], { description: "Opis redakcyjny", slug: "redakcyjny-artysta", image_url: "https://example.com/editorial.jpg" });
      const album = await db.query("select description,slug from public.albums");
      assert.deepEqual(album.rows[0], { description: "Opis albumu", slug: "redakcyjny-album" });
    });

    await t.test("late track errors roll back every change, including earlier artist updates", async () => {
      const before = await snapshot();
      const broken = structuredClone(basePayload);
      broken.artists[0].name += " (temporary assertion)";
      broken.albums[0].tracks.at(-1)!.duration_ms = -1;
      await assert.rejects(run(broken), /Invalid track/);
      assert.deepEqual(await snapshot(), before);
    });

    if (schema === "existing") await t.test("existing editorial roles and verification survive source-credit changes", async () => {
      await db.exec("update public.artists set is_verified=true; update public.albums set is_verified=true");
      await db.exec(`insert into public.track_artists (track_id,artist_id,role)
        select track_id,artist_id,'feature' from public.spotify_track_artists limit 1`);
      const before = await db.query("select * from public.track_artists order by id");
      const changed = structuredClone(basePayload);
      changed.albums[0].tracks[0].artists.reverse();
      await run(changed);
      await run();
      assert.deepEqual((await db.query("select * from public.track_artists order by id")).rows, before.rows);
      assert.equal((await db.query("select * from public.artists where is_verified is distinct from true")).rows.length, 0);
      assert.equal((await db.query("select * from public.albums where is_verified is distinct from true")).rows.length, 0);
      const constraints = await db.query<{ definition: string }>("select pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.track_artists'::regclass and contype='c'");
      assert.match(String(constraints.rows[0].definition), /main.*feature/);
    });

    await t.test("missing positions, duplicate credits and invalid dates roll back", async () => {
      const before = await snapshot();
      for (const mutate of [
        (value: typeof basePayload) => { value.albums[0].tracks.pop(); value.albums[0].total_tracks--; },
        (value: typeof basePayload) => { value.albums[0].artists.push(value.albums[0].artists[0]); },
        (value: typeof basePayload) => { value.albums[0].release_date_raw = "2025-02-30"; },
        (value: typeof basePayload) => { value.albums[0].tracks[0].artists = []; },
        (value: typeof basePayload) => { value.albums[0].tracks[0].spotify_id = value.albums[0].tracks[1].spotify_id; },
      ]) {
        const broken = structuredClone(basePayload); mutate(broken);
        await assert.rejects(run(broken));
        assert.deepEqual(await snapshot(), before);
      }
    });

    await t.test("year precision stays null in date column and stores the original year", async () => {
      const changed = structuredClone(basePayload);
      changed.albums[0].release_date_raw = "2015";
      changed.albums[0].release_date_precision = "year";
      changed.albums[0].release_date = null;
      await run(changed);
      const rows = await db.query("select release_date,release_date_raw,release_date_precision from public.albums");
      assert.deepEqual(rows.rows[0], { release_date: null, release_date_raw: "2015", release_date_precision: "year" });
    });

    await t.test("a second disc may reuse a Spotify track ID without replacing disc one", async () => {
      const changed = structuredClone(basePayload);
      changed.albums[0].tracks.push({ ...changed.albums[0].tracks[0], disc_number: 2 });
      changed.albums[0].total_tracks++;
      await run(changed);
      await run(changed);
      const rows = await db.query("select disc_number,track_number from public.tracks where spotify_id=$1 order by disc_number", [changed.albums[0].tracks[0].spotify_id]);
      assert.deepEqual(rows.rows, [{ disc_number: 1, track_number: 1 }, { disc_number: 2, track_number: 1 }]);
    });

    await t.test("catalog is readable but not writable by anonymous visitors", async () => {
      await db.exec("set role anon");
      assert.equal((await db.query("select * from public.albums")).rows.length, 1);
      if (schema === "existing") {
        assert.equal((await db.query("update public.albums set title='Unauthorized' returning id")).rows.length, 0);
        await assert.rejects(db.exec("insert into public.albums (title,slug,album_type) values ('Unauthorized','unauthorized','album')"), /row-level security/);
        assert.equal((await db.query("select * from public.track_artists")).rows.length, 0);
      } else {
        await assert.rejects(db.exec("update public.albums set title='Unauthorized'"), /permission denied/);
      }
      await db.exec("reset role");
    });
  } finally { await db.close(); }
});
