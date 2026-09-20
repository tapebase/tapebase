import assert from "node:assert/strict";

// Read-only HTTP checks against a running app and its existing real catalog.
// No writes, fixture seeding, or privileged credentials.
const origin = process.argv[2] || "http://127.0.0.1:3000";
async function page(path: string) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(30000) });
  const html = await response.text();
  assert.ok(response.ok || response.status === 404, `${path}: HTTP ${response.status}`);
  const digests = [...html.replaceAll('\\"', '"').matchAll(/"digest":"([^"]+)"/g)].map(match => match[1]);
  assert.ok(digests.every(digest => digest === "NEXT_HTTP_ERROR_FALLBACK;404"), `${path}: server rendering error`);
  assert.ok(!html.includes("Test połączenia z Supabase") && !html.includes("Album testowy"), "Debug/fixture UI leaked");
  return html;
}
const home = await page("/");
assert.ok(home.includes("Ostatnio dodane"));
assert.ok(home.includes("Ostatnie komentarze"));
assert.ok(!home.includes("/spotify-logo.svg"));
assert.ok(home.includes('href="/rankingi"') && home.includes('href="/rankingi?typ=artysci"') && home.includes('href="/rankingi?typ=albumy"') && home.includes('href="/rankingi?typ=uzytkownicy"'));
const rankings = await page("/rankingi");
assert.ok(rankings.includes('id="top-artysci"') && rankings.includes("TOP artyści"));
assert.ok(rankings.includes('id="top-albumy"') && rankings.includes("TOP albumy"));
assert.ok(rankings.includes("Dla fanek euforii") && rankings.includes("Ezoteryka"));
assert.ok(!rankings.includes("/spotify-logo.svg"));
const artistRanking = await page("/rankingi?typ=artysci");
assert.ok(artistRanking.includes('id="top-artysci"') && !artistRanking.includes('id="top-albumy"'));
const albumRanking = await page("/rankingi?typ=albumy");
assert.ok(albumRanking.includes('id="top-albumy"') && !albumRanking.includes('id="top-artysci"'));
assert.ok(albumRanking.includes("Dla fanek euforii") && albumRanking.includes("Ezoteryka"));
assert.ok(albumRanking.includes("Rok wydania") && albumRanking.includes("Rodzaj wydawnictwa") && albumRanking.includes("Gatunek"));
assert.ok(albumRanking.includes("<option>1970</option>"));
const filteredRanking = await page("/rankingi?typ=albumy&rok=2015&rodzaj=album&gatunek=rap");
assert.ok(filteredRanking.includes("Ezoteryka") && !filteredRanking.includes("Dla fanek euforii"));
const emptyGenreRanking = await page("/rankingi?typ=albumy&gatunek=rock");
assert.ok(emptyGenreRanking.includes("Brak ocenionych albumów dla wybranych filtrów."));
const userRanking = await page("/rankingi?typ=uzytkownicy&okres=30");
assert.ok(userRanking.includes('id="top-uzytkownicy"') && userRanking.includes("TOP użytkowników") && userRanking.includes("Cały czas"));
const albums = await page("/album");
const albumPaths = [...new Set([...albums.matchAll(/href="(\/album\/[^"?#]+)"/g)].map(match => match[1]))];
assert.ok(albumPaths.length > 0, "No real albums displayed");
for (const path of albumPaths) {
  const html = await page(path);
  assert.ok(html.includes("Tracklista") && /id="track-\d+"/.test(html), `${path}: missing tracks`);
  assert.ok(html.includes("https://open.spotify.com/album/"));
  assert.equal((html.match(/<img[^>]+spotify-logo\.svg/g) ?? []).length, 1, `${path}: Spotify logo should appear once`);
}
const firstArtists = await page("/artist");
assert.ok(!firstArtists.includes("/spotify-logo.svg"));
const secondArtists = await page("/artist?page=2");
const artistPaths = (html: string) => [...new Set([...html.matchAll(/href="(\/artist\/[^"?#]+)"/g)].map(match => match[1]))];
assert.ok(artistPaths(firstArtists).length > 0 && artistPaths(firstArtists).length <= 20);
assert.ok(artistPaths(secondArtists).length <= 20);
assert.ok(artistPaths(firstArtists).every(path => !artistPaths(secondArtists).includes(path)), "Artist pages overlap");
const artistSearch = await page("/?q=Quebonafide");
assert.ok(artistSearch.includes("quebonafide-1fxbULcd6ryMNc1usHoP0R"));
const albumSearch = await page("/album?q=ROMANTIC");
assert.ok(albumSearch.includes("ROMANTIC PSYCHO") && !albumSearch.includes("Ezoteryka"));
const artist = await page("/artist/quebonafide-1fxbULcd6ryMNc1usHoP0R?tracks=2");
assert.ok(artist.includes("Utwory z udziałem") && artist.includes("#track-21"));
assert.ok((await page("/artist/deemz-3gm9b6AeMf2eGQTLashkDt")).includes("Candy"));
const commentedAlbum = await page("/album/ezoteryka-0q8uMpog7V0cZcLESRS6vQ");
const publicProfilePath = commentedAlbum.match(/href="(\/u\/[A-Za-z0-9_]+)"/)?.[1];
assert.ok(publicProfilePath, "Comment author does not link to a public profile");
const publicProfile = await page(publicProfilePath);
assert.ok(publicProfile.includes("Profil użytkownika"));
assert.ok(publicProfile.includes("Oceny albumów") && publicProfile.includes("Oceny artystów"));
assert.ok(publicProfile.includes("Komentarze") && publicProfile.includes("Przesłuchane albumy"));
assert.ok((await page("/u/nieistniejacy_uzytkownik")).includes("Nie znaleziono strony"));
assert.ok((await page("/album?q=tapebase-no-results-8ba661")).includes("Nie znaleziono albumów"));
assert.ok((await page("/album?page=999")).includes("Brak albumów na tej stronie"));
assert.ok((await page("/album/nieistniejacy-album")).includes("Nie znaleziono strony"));
assert.ok((await page("/artist/nieistniejacy-artysta")).includes("Nie znaleziono strony"));
console.log(`Catalog checks passed: rankings, ${albumPaths.length} real album pages, artist links, search, pagination, empty results and 404.`);
