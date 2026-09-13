import test from "node:test";
import assert from "node:assert/strict";
import { parseAdminBatchImportInput, parseBatchSelection } from "../../src/lib/spotify-admin-validation.ts";

const artistA = "1fxbULcd6ryMNc1usHoP0R";
const artistB = "0EPzUAW8kwuPedmmVP6n9S";
const album = "0q8uMpog7V0cZcLESRS6vQ";

test("admin queue accepts multiple artists, deduplicates them and validates limits", () => {
  const form = new FormData();
  form.set("artists", `https://open.spotify.com/artist/${artistA}\n${artistB}\n${artistA}`);
  form.set("market", "pl");
  form.set("maxAlbums", "25");
  form.set("epIds", `https://open.spotify.com/album/${album}`);
  assert.deepEqual(parseAdminBatchImportInput(form), {
    artistIds: [artistA, artistB],
    market: "PL",
    maxAlbums: 25,
    epIds: [album],
    countryCode: "PL",
    genre: "rap",
  });

  const tooMany = new FormData();
  tooMany.set("artists", Array.from({ length: 21 }, (_, index) => `${String(index).padStart(2, "0")}aaaaaaaaaaaaaaaaaaaa`).join("\n"));
  assert.throws(() => parseAdminBatchImportInput(tooMany), /najwyżej 20/);
});

test("admin import selection ignores malformed identifiers", () => {
  const form = new FormData();
  form.append("selectedArtists", artistA);
  form.append("selectedArtists", "nieprawidlowy");
  form.append("selectedAlbums", `${artistA}:${album}`);
  form.append("selectedAlbums", "bad");
  const result = parseBatchSelection(form);
  assert.deepEqual([...result.artists], [artistA]);
  assert.deepEqual([...result.albums], [`${artistA}:${album}`]);
});

test("admin queue accepts a foreign origin for the whole preview", () => {
  const form = new FormData();
  form.set("artists", artistA);
  form.set("countryCode", "ZZ");
  assert.equal(parseAdminBatchImportInput(form).countryCode, "ZZ");
});

test("admin queue validates the default genre", () => {
  const form = new FormData();
  form.set("artists", artistA);
  form.set("genre", "electronic");
  assert.equal(parseAdminBatchImportInput(form).genre, "electronic");
  form.set("genre", "bedroom-core");
  assert.throws(() => parseAdminBatchImportInput(form), /gatunek/);
});
