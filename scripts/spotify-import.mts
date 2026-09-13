import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { prepareImport } from "./spotify/payload.mts";
import { importClient, writeImport } from "./spotify/writer.mts";

try {
  const { values, positionals } = parseArgs({ allowPositionals: true,
    options: { help: { type: "boolean" }, write: { type: "boolean", default: false } } });
  if (values.help) {
    console.log(`npm run spotify:import -- <plik-podgladu.json> [--write]
Bez --write: tylko walidacja pliku i podsumowanie, bez sieci.
Z --write: zapis zatwierdzonego planu w jednej transakcji Supabase.
Wymaga migracji importu v1 i sekretnego klucza backendu w .env.local.`);
  } else {
    if (positionals.length !== 1) throw new Error("Podaj plik JSON podglądu. Pomoc: npm run spotify:import -- --help");
    const content = await readFile(positionals[0], "utf8");
    if (Buffer.byteLength(content) > 10_000_000) throw new Error("Plik podglądu przekracza 10 MB.");
    const payload = prepareImport(JSON.parse(content.replace(/^\uFEFF/, "")));
    if (values.write) {
      console.log(JSON.stringify({ mode: "written", result: await writeImport(payload, importClient()) }, null, 2));
    } else {
      console.log(JSON.stringify({ mode: "validated-only", artists: payload.artists.length,
        albums: payload.albums.map((item) => ({ spotify_id: item.spotify_id, title: item.title, tracks: item.tracks.length })),
        tracks: payload.albums.reduce((count, item) => count + item.tracks.length, 0) }, null, 2));
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Import nie powiódł się.");
  process.exitCode = 1;
}
