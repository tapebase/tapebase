import test from "node:test";
import assert from "node:assert/strict";
import { parseSpotifySubmission } from "../src/lib/catalog-submission-validation.ts";

test("accepts canonical Spotify artist and album links", () => {
  assert.deepEqual(parseSpotifySubmission("https://open.spotify.com/artist/1fxbULcd6ryMNc1usHoP0R?si=test"), {
    type: "artist", id: "1fxbULcd6ryMNc1usHoP0R", url: "https://open.spotify.com/artist/1fxbULcd6ryMNc1usHoP0R",
  });
  assert.deepEqual(parseSpotifySubmission("https://open.spotify.com/intl-pl/album/1234567890123456789012/"), {
    type: "album", id: "1234567890123456789012", url: "https://open.spotify.com/album/1234567890123456789012",
  });
});

test("rejects search, track and foreign links", () => {
  for (const value of [
    "https://open.spotify.com/search/test",
    "https://open.spotify.com/track/1234567890123456789012",
    "https://example.com/album/1234567890123456789012",
  ]) assert.throws(() => parseSpotifySubmission(value));
});
