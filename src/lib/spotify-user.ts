import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site-url";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_URL = "https://api.spotify.com/v1";
export const SPOTIFY_USER_SCOPES = ["playlist-modify-public", "playlist-modify-private", "user-read-private"];

function credentials() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Integracja Spotify nie jest skonfigurowana.");
  return { clientId, clientSecret };
}

function encryptionKey() {
  const secret = process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error("Brakuje klucza szyfrowania połączeń Spotify.");
  return createHash("sha256").update(secret, "utf8").digest();
}

export function spotifyRedirectUri(requestOrigin?: string | null) {
  return new URL("/api/spotify/callback", siteUrl(requestOrigin)).toString();
}

export function spotifyAuthorizeUrl(state: string, redirectUri: string) {
  const { clientId } = credentials();
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    scope: SPOTIFY_USER_SCOPES.join(" "),
    show_dialog: "true",
  }).toString();
  return url;
}

function basicAuthorization() {
  const { clientId, clientSecret } = credentials();
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function tokenRequest(body: URLSearchParams) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basicAuthorization(), "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({})) as {
    access_token?: string; refresh_token?: string; scope?: string; error?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error === "invalid_grant" ? "Autoryzacja Spotify wygasła. Połącz konto ponownie." : "Spotify nie potwierdziło autoryzacji.");
  }
  return payload;
}

export function encryptSpotifyToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64url")).join(".");
}

function decryptSpotifyToken(value: string) {
  const parts = value.split(".").map(part => Buffer.from(part, "base64url"));
  if (parts.length !== 3 || parts[0].length !== 12 || parts[1].length !== 16) throw new Error("Zapisane połączenie Spotify jest nieprawidłowe.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), parts[0]);
  decipher.setAuthTag(parts[1]);
  return Buffer.concat([decipher.update(parts[2]), decipher.final()]).toString("utf8");
}

async function spotifyFetch<T>(path: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: { status?: number; message?: string } };
  if (!response.ok) {
    if (response.status === 429) throw new Error("Spotify ograniczyło liczbę operacji. Spróbuj ponownie później.");
    if (response.status === 401) throw new Error("Połączenie Spotify wygasło. Połącz konto ponownie.");
    throw new Error(payload.error?.message || "Spotify nie wykonało operacji.");
  }
  return payload;
}

export async function exchangeSpotifyCode(code: string, redirectUri: string) {
  return tokenRequest(new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }));
}

export async function saveSpotifyConnection(userId: string, token: Awaited<ReturnType<typeof exchangeSpotifyCode>>) {
  if (!token.refresh_token) throw new Error("Spotify nie zwróciło klucza odświeżania. Spróbuj połączyć konto ponownie.");
  const profile = await spotifyFetch<{ id: string }>("/me", token.access_token!);
  const database = createAdminClient();
  const { error } = await database.from("user_spotify_connections").upsert({
    user_id: userId,
    spotify_user_id: profile.id,
    refresh_token_encrypted: encryptSpotifyToken(token.refresh_token),
    scopes: (token.scope ?? "").split(" ").filter(Boolean),
    connected_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw new Error("Nie udało się zapisać połączenia Spotify.");
}

export async function spotifyConnectionStatus(userId: string) {
  const { data, error } = await createAdminClient().from("user_spotify_connections")
    .select("spotify_user_id,connected_at").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Nie udało się sprawdzić połączenia Spotify.");
  return data ? { connected: true as const, connectedAt: String(data.connected_at) } : { connected: false as const };
}

async function accessTokenForUser(userId: string) {
  const database = createAdminClient();
  const { data, error } = await database.from("user_spotify_connections")
    .select("refresh_token_encrypted").eq("user_id", userId).maybeSingle();
  if (error || !data) throw new Error("Najpierw połącz konto Spotify.");
  try {
    return (await tokenRequest(new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptSpotifyToken(String(data.refresh_token_encrypted)),
    }))).access_token!;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Połącz konto ponownie")) {
      await database.from("user_spotify_connections").delete().eq("user_id", userId);
    }
    throw error;
  }
}

export async function exportTrackListToSpotify(userId: string, list: {
  name: string; description: string | null; is_public: boolean;
  tracks: { spotify_id: string | null }[];
}) {
  const uris = list.tracks.flatMap(track => track.spotify_id ? [`spotify:track:${track.spotify_id}`] : []);
  if (!uris.length) throw new Error("Playlista nie ma utworów dostępnych w Spotify.");
  if (uris.length !== list.tracks.length) throw new Error("Nie wszystkie utwory mają identyfikator Spotify. Usuń je przed eksportem.");
  const accessToken = await accessTokenForUser(userId);
  const created = await spotifyFetch<{ id: string; external_urls?: { spotify?: string } }>("/me/playlists", accessToken, {
    method: "POST",
    body: JSON.stringify({
      name: list.name,
      description: list.description ? `${list.description}\n\nUtworzono w TAPEBASE` : "Utworzono w TAPEBASE",
      public: list.is_public,
    }),
  });
  for (let offset = 0; offset < uris.length; offset += 100) {
    await spotifyFetch(`/playlists/${encodeURIComponent(created.id)}/items`, accessToken, {
      method: "POST", body: JSON.stringify({ uris: uris.slice(offset, offset + 100) }),
    });
  }
  return {
    id: created.id,
    url: created.external_urls?.spotify ?? `https://open.spotify.com/playlist/${created.id}`,
  };
}

export async function disconnectSpotify(userId: string) {
  const { error } = await createAdminClient().from("user_spotify_connections").delete().eq("user_id", userId);
  if (error) throw new Error("Nie udało się odłączyć konta Spotify.");
}
