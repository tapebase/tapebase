import { parseArgs } from "node:util";
import { SpotifyClient } from "./spotify/client.mts";
import { spotifyId } from "./spotify/model.mts";
import { preview } from "./spotify/preview.mts";

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true, strict: true,
    options: { help: { type: "boolean" }, market: { type: "string", default: "PL" },
      "max-albums": { type: "string", default: "5" }, ep: { type: "string", multiple: true } },
  });
  if (values.help) {
    console.log(`Podgląd importu TAPEBASE — bez zapisu do bazy.

npm run spotify:preview -- <link lub ID artysty> [--market PL] [--max-albums 5] [--ep <ID albumu>]

Domyślnie pobiera szczegóły maksymalnie 5 albumów; zakres: 1–100.
--ep można powtarzać; oznacza ręczne potwierdzenie EP z dyskografii artysty.
Wydawnictwa single bez --ep pozostają tylko na liście review.
Wynik JSON trafia na stdout, błędy na stderr. Nie ma opcji zapisu do Supabase.
Wymagane: Node.js 24, SPOTIFY_CLIENT_ID i SPOTIFY_CLIENT_SECRET w .env.local.`);
  } else {
    if (positionals.length !== 1) throw new Error("Podaj jeden link lub ID artysty. Pomoc: npm run spotify:preview -- --help");
    const artistId = spotifyId(positionals[0]);
    const market = values.market.toUpperCase();
    const maxAlbums = Number(values["max-albums"]);
    if (!/^[A-Z]{2}$/.test(market)) throw new Error("Rynek musi być dwuliterowym kodem, np. PL.");
    if (!/^\d+$/.test(values["max-albums"]) || !Number.isInteger(maxAlbums) || maxAlbums < 1 || maxAlbums > 100) {
      throw new Error("--max-albums musi być liczbą całkowitą od 1 do 100.");
    }
    const epIds = new Set((values.ep ?? []).map((value) => spotifyId(value, "album")));
    const client = new SpotifyClient({ clientId: process.env.SPOTIFY_CLIENT_ID ?? "", clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "" });
    const result = await preview(client, { artistId, market, maxAlbums, epIds });
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Nie udało się przygotować podglądu.");
  process.exitCode = 1;
}
