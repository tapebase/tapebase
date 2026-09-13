export type SpotifySubmissionType = "artist" | "album";

export function parseSpotifySubmission(value: string) {
  const raw = value.trim();
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Wklej pełny link do artysty lub albumu ze Spotify."); }
  const match = url.pathname.match(/^\/(?:intl-[a-zA-Z-]+\/)?(artist|album)\/([A-Za-z0-9]{22})\/?$/);
  if (url.protocol !== "https:" || url.hostname !== "open.spotify.com" || url.port || url.username || url.password || !match) {
    throw new Error("Obsługiwane są wyłącznie linki Spotify do artysty albo albumu.");
  }
  const type = match[1] as SpotifySubmissionType;
  const id = match[2];
  return { type, id, url: `https://open.spotify.com/${type}/${id}` };
}
