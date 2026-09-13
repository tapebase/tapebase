export const MUSIC_GENRES = [
  { value: "rap", label: "Rap" },
  { value: "pop", label: "Pop" },
  { value: "rock", label: "Rock" },
  { value: "electronic", label: "Elektronika" },
  { value: "rnb_soul", label: "R&B / Soul" },
  { value: "metal", label: "Metal" },
  { value: "jazz", label: "Jazz" },
  { value: "reggae", label: "Reggae" },
  { value: "folk_country", label: "Folk / Country" },
  { value: "classical", label: "Muzyka klasyczna" },
  { value: "other", label: "Inne" },
] as const;

export type MusicGenre = (typeof MUSIC_GENRES)[number]["value"];

const values = new Set<string>(MUSIC_GENRES.map(item => item.value));

export function isMusicGenre(value: unknown): value is MusicGenre {
  return typeof value === "string" && values.has(value);
}

export function musicGenre(value: unknown): MusicGenre {
  const normalized = String(value ?? "").trim();
  if (!isMusicGenre(normalized)) throw new Error("Wybierz prawidłowy gatunek muzyczny.");
  return normalized as MusicGenre;
}

export function genreLabel(value: string | null | undefined) {
  return MUSIC_GENRES.find(item => item.value === value)?.label ?? "Inne";
}

const genreRules: Array<[MusicGenre, RegExp]> = [
  ["rap", /\b(hip[ -]?hop|rap|trap|drill|boom bap|grime)\b/i],
  ["metal", /\b(metal|metalcore|deathcore)\b/i],
  ["rock", /\b(rock|punk|grunge|shoegaze|emo)\b/i],
  ["rnb_soul", /\b(r&b|rnb|soul|neo soul|funk)\b/i],
  ["electronic", /\b(electronic|electronica|techno|house|edm|trance|dubstep|ambient|drum and bass|dnb)\b/i],
  ["jazz", /\b(jazz|bebop|swing)\b/i],
  ["reggae", /\b(reggae|dancehall|dub|ska)\b/i],
  ["folk_country", /\b(folk|country|bluegrass|americana)\b/i],
  ["classical", /\b(classical|opera|orchestra|baroque)\b/i],
  ["pop", /\b(pop|k-pop|dance pop|synthpop)\b/i],
];

export function suggestMusicGenre(spotifyGenres: string[]): MusicGenre {
  const joined = spotifyGenres.join(" ");
  return genreRules.find(([, pattern]) => pattern.test(joined))?.[0] ?? "other";
}
