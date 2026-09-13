import test from "node:test";
import assert from "node:assert/strict";
import { albumEditionKey, isPossibleAlbumEdition } from "../src/lib/submission-moderation.ts";

test("groups common editions of the same album", () => {
  assert.equal(albumEditionKey("Hotel Maffija 3 (Deluxe Edition)"), "hotel maffija 3");
  assert.equal(albumEditionKey("ROMANTIC PSYCHO - Edycja specjalna"), "romantic psycho");
  assert.equal(isPossibleAlbumEdition("Marmur [Remastered]", "Marmur"), true);
});

test("does not group unrelated albums", () => {
  assert.equal(isPossibleAlbumEdition("Marmur", "Trójkąt warszawski"), false);
  assert.equal(isPossibleAlbumEdition("A", "A"), false);
});
