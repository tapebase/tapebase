import test from "node:test";
import assert from "node:assert/strict";
import { matchesArtist, normalizedArtistName, parseTicketmasterEvent, type TicketmasterEvent } from "../src/lib/ticketmaster.ts";

const event: TicketmasterEvent = {
  id: "event-1", name: "O.S.T.R. — koncert", url: "https://www.ticketmaster.pl/event/event-1",
  dates: { start: { dateTime: "2026-12-10T19:00:00Z" }, status: { code: "onsale" }, timezone: "Europe/Warsaw" },
  priceRanges: [{ min: 99, max: 159, currency: "PLN" }],
  images: [{ url: "https://example.com/small.jpg", width: 400 }, { url: "https://example.com/wide.jpg", ratio: "16_9", width: 1200 }],
  _embedded: { attractions: [{ id: "artist-1", name: "O.S.T.R." }], venues: [{ name: "Klub", city: { name: "Warszawa" }, country: { countryCode: "PL" } }] },
};

test("normalizuje zapis nazwy bez znaków i interpunkcji", () => {
  assert.equal(normalizedArtistName("  Żabson & Co. "), "zabson and co");
  assert.equal(matchesArtist("O.S.T.R.", event._embedded?.attractions)?.id, "artist-1");
  assert.equal(matchesArtist("OSTRY", event._embedded?.attractions), null);
});

test("mapowanie attraction ID ma pierwszeństwo po zmianie nazwy", () => {
  assert.equal(matchesArtist("Stara nazwa", [{ id: "artist-1", name: "Nowa nazwa" }], "artist-1")?.name, "Nowa nazwa");
});

test("mapuje wydarzenie i ofertę", () => {
  const parsed = parseTicketmasterEvent(event, "O.S.T.R.");
  assert.ok(parsed);
  assert.equal(parsed.startTimeKnown, true);
  assert.equal(parsed.offerStatus, "onsale");
  assert.equal(parsed.priceMin, 99);
  assert.equal(parsed.imageUrl, "https://example.com/wide.jpg");
});

test("data bez godziny zachowuje informację o nieznanym czasie", () => {
  const parsed = parseTicketmasterEvent({ ...event, dates: { start: { localDate: "2026-12-10" } } }, "O.S.T.R.");
  assert.ok(parsed);
  assert.equal(parsed.startTimeKnown, false);
  assert.equal(parsed.startsAt, "2026-12-10T12:00:00.000Z");
});

test("odrzuca wydarzenie bez dokładnego dopasowania artysty", () => {
  assert.equal(parseTicketmasterEvent(event, "Inny artysta"), null);
});
