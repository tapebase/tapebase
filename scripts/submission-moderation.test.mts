import test from "node:test";
import assert from "node:assert/strict";
import { albumEditionKey, isPossibleAlbumEdition } from "../src/lib/submission-moderation.ts";
import { reviewCatalogSubmission } from "../src/lib/catalog-auto-review.ts";

test("groups common editions of the same album", () => {
  assert.equal(albumEditionKey("Hotel Maffija 3 (Deluxe Edition)"), "hotel maffija 3");
  assert.equal(albumEditionKey("ROMANTIC PSYCHO - Edycja specjalna"), "romantic psycho");
  assert.equal(isPossibleAlbumEdition("Marmur [Remastered]", "Marmur"), true);
});

test("does not group unrelated albums", () => {
  assert.equal(isPossibleAlbumEdition("Marmur", "Trójkąt warszawski"), false);
  assert.equal(isPossibleAlbumEdition("A", "A"), false);
});

test("automatically approves a complete ordinary Spotify album", () => {
  const result = reviewCatalogSubmission({
    type: "album", title: "Nowy album", spotifyAlbumType: "album",
    totalTracks: 12, coverUrl: "https://i.scdn.co/image/test", releaseDateRaw: "2026-01-01",
  });
  assert.equal(result.autoApprove, true);
  assert.equal(result.riskScore, 0);
  assert.equal(result.releaseKind, "album");
});

test("sends singles and possible editions to moderation", () => {
  const single = reviewCatalogSubmission({
    type: "album", title: "Krótka rzecz", spotifyAlbumType: "single",
    totalTracks: 5, coverUrl: "https://i.scdn.co/image/test", releaseDateRaw: "2026",
  });
  assert.equal(single.autoApprove, false);
  assert.equal(single.releaseKind, "ep");

  const edition = reviewCatalogSubmission({
    type: "album", title: "Marmur (Deluxe Edition)", spotifyAlbumType: "album",
    totalTracks: 15, coverUrl: "https://i.scdn.co/image/test", releaseDateRaw: "2026",
  }, [{ spotifyId: "old", title: "Marmur" }], "new");
  assert.equal(edition.autoApprove, false);
  assert.match(edition.reasons.join(" "), /inna edycja/i);
});

test("automatically approves complete artists and holds suspicious profiles", () => {
  const complete = reviewCatalogSubmission({
    type: "artist", title: "Joy Division", coverUrl: "https://i.scdn.co/image/test",
    artistHasOwnRelease: true, artistNameConflict: false,
  });
  assert.equal(complete.autoApprove, true);
  assert.equal(complete.riskScore, 0);
  assert.equal(complete.releaseKind, null);

  const empty = reviewCatalogSubmission({
    type: "artist", title: "Podejrzany profil", artistHasOwnRelease: false,
  });
  assert.equal(empty.autoApprove, false);
  assert.match(empty.reasons.join(" "), /zdjęcia.*wydawnictwa/i);

  const conflict = reviewCatalogSubmission({
    type: "artist", title: "Taka sama nazwa", coverUrl: "https://i.scdn.co/image/test",
    artistHasOwnRelease: true, artistNameConflict: true,
  });
  assert.equal(conflict.autoApprove, false);
  assert.match(conflict.reasons.join(" "), /inny profil/i);
});
