import test from "node:test";
import assert from "node:assert/strict";
import {
  findArtistEnrichment,
  findExactMusicBrainz,
  findExactWikidata,
  wikidataNameCandidates,
} from "../src/lib/artist-enrichment-provider.ts";

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

test("Wikidata exact Spotify ID is safe for automatic enrichment", async () => {
  const fetcher = async () => json({ results: { bindings: [{
    item: { value: "https://www.wikidata.org/entity/Q123" },
    itemLabel: { value: "Artysta" }, itemDescription: { value: "polski raper" },
    birthDate: { value: "+1990-02-03T00:00:00Z" }, birthPlaceLabel: { value: "Warszawa" },
    birthName: { value: "Jan Kowalski" }, countryCode: { value: "PL" },
  }] } });
  const result = await findExactWikidata("1234567890123456789012", fetcher as typeof fetch);
  assert.equal(result?.sourceId, "Q123");
  assert.equal(result?.confidence, 1);
  assert.equal(result?.birthDate, "1990-02-03");
  assert.match(result?.description ?? "", /Naprawdę nazywa się Jan Kowalski/);
});

test("name-only Wikidata results remain manual candidates and obvious noise is removed", async () => {
  const fetcher = async () => json({ search: [
    { id: "Q44", label: "Ten Sam Artysta", description: "polski muzyk" },
    { id: "Q45", label: "Ten Sam Artysta", description: "nazwisko" },
  ] });
  const candidates = await wikidataNameCandidates("Ten Sam Artysta", fetcher as typeof fetch);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].confidence, 0.65);
  assert.equal(candidates[0].evidence.searchOnly, true);
});

test("MusicBrainz Spotify URL relation is treated as exact fallback", async () => {
  let call = 0;
  const fetcher = async () => {
    call++;
    if (call === 1) return json({ relations: [{ artist: { id: "c0b2500e-0cef-4130-869d-732b23ed9df5", name: "Artysta" } }] });
    return json({ id: "c0b2500e-0cef-4130-869d-732b23ed9df5", name: "Artysta", country: "PL", type: "Person", "life-span": { begin: "1988" }, "begin-area": { name: "Gdańsk" } });
  };
  const result = await findExactMusicBrainz("1234567890123456789012", fetcher as typeof fetch);
  assert.equal(result?.source, "musicbrainz");
  assert.equal(result?.birthDate, "1988-01-01");
  assert.equal(result?.birthDatePrecision, "year");
  assert.equal(result?.countryCode, "PL");
});

test("orchestrator never auto-applies a name-only match", async () => {
  let call = 0;
  const fetcher = async () => {
    call++;
    if (call === 1) return json({ results: { bindings: [] } });
    if (call === 2) return json({}, 404);
    return json({ search: [{ id: "Q77", label: "Podobny", description: "raper" }] });
  };
  const result = await findArtistEnrichment({ name: "Podobny", spotifyId: "1234567890123456789012" }, fetcher as typeof fetch);
  assert.equal(result.exact, null);
  assert.equal(result.candidates.length, 1);
});
