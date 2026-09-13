import test from "node:test";
import assert from "node:assert/strict";
import { musicGenre, suggestMusicGenre } from "../../src/lib/genres.ts";

test("Spotify artist labels map to controlled TAPEBASE genres", () => {
  assert.equal(suggestMusicGenre(["polish hip hop", "trap"]), "rap");
  assert.equal(suggestMusicGenre(["indie rock"]), "rock");
  assert.equal(suggestMusicGenre(["dance pop"]), "pop");
  assert.equal(suggestMusicGenre(["house", "techno"]), "electronic");
  assert.equal(suggestMusicGenre([]), "other");
});

test("only controlled genre values are accepted", () => {
  assert.equal(musicGenre("rnb_soul"), "rnb_soul");
  assert.throws(() => musicGenre("hyperpop"), /gatunek/);
});
