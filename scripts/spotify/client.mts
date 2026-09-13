import { Buffer } from "node:buffer";
import { setTimeout as delay } from "node:timers/promises";

const API = "https://api.spotify.com/v1/";
const TOKEN = "https://accounts.spotify.com/api/token";

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Nieprawidłowy obiekt w odpowiedzi Spotify.");
  }
  return value as Record<string, unknown>;
}

export type ClientOptions = {
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<unknown>;
  now?: () => number;
  minIntervalMs?: number;
};

export class SpotifyLimitError extends Error {
  readonly reason: "RATE_LIMIT" | "QUOTA_EXCEEDED";
  readonly retryAfterSeconds: number | null;

  constructor(
    message: string,
    reason: "RATE_LIMIT" | "QUOTA_EXCEEDED",
    retryAfterSeconds: number | null,
  ) {
    super(message);
    this.name = "SpotifyLimitError";
    this.reason = reason;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Node-only transport. This module belongs to the local CLI, outside src/app.
export class SpotifyClient {
  private options: ClientOptions;
  private token: { value: string; expiresAt: number } | undefined;
  private fetcher: typeof fetch;
  private sleep: (ms: number) => Promise<unknown>;
  private now: () => number;
  private nextRequestAt = 0;

  constructor(options: ClientOptions) {
    if (!options.clientId.trim() || !options.clientSecret.trim()) {
      throw new Error("Uzupełnij SPOTIFY_CLIENT_ID i SPOTIFY_CLIENT_SECRET w .env.local.");
    }
    this.options = options;
    this.fetcher = options.fetch ?? fetch;
    this.sleep = options.sleep ?? delay;
    this.now = options.now ?? Date.now;
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const wait = this.nextRequestAt - this.now();
      if (wait > 0) await this.sleep(wait);
      this.nextRequestAt = this.now() + (this.options.minIntervalMs ?? 0);
      let response: Response;
      try {
        response = await this.fetcher(url, {
          ...init, signal: AbortSignal.timeout(15_000), redirect: "error", cache: "no-store",
        });
      } catch {
        throw new Error("Spotify: błąd sieci lub przekroczony czas oczekiwania (15 s).");
      }
      if (response.status === 429) {
        const header = response.headers.get("retry-after");
        const seconds = header && /^\d+(\.\d+)?$/.test(header) ? Number(header) : NaN;
        let reason = "";
        try {
          const body = record(await response.json());
          const nested = body.error && typeof body.error === "object" ? record(body.error) : body;
          reason = typeof nested.reason === "string" ? nested.reason : "";
        } catch { await response.body?.cancel(); }
        if (reason === "QUOTA_EXCEEDED") {
          throw new SpotifyLimitError(
            "Spotify zwróciło 429: wyczerpano pulę zapytań aplikacji w Development Mode. Poczekaj na odnowienie puli w Spotify i ponów podgląd.",
            "QUOTA_EXCEEDED",
            Number.isFinite(seconds) ? seconds : null,
          );
        }
        if (attempt >= 2 || !Number.isFinite(seconds) || seconds > 30) {
          const retry = Number.isFinite(seconds) ? ` Spróbuj ponownie za około ${Math.ceil(seconds)} s.` : " Spróbuj ponownie za kilka minut.";
          throw new SpotifyLimitError(
            `Spotify chwilowo ograniczyło szybkość zapytań (429).${retry}`,
            "RATE_LIMIT",
            Number.isFinite(seconds) ? seconds : null,
          );
        }
        await this.sleep(Math.max(1, seconds) * 1000);
      } else if (response.status >= 500 && attempt < 2) {
        await response.body?.cancel();
        await this.sleep(1000 * (attempt + 1));
      } else {
        return response;
      }
    }
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.now()) return this.token.value;
    const response = await this.request(TOKEN, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!response.ok) throw new Error(`Spotify: pobranie tokenu nie powiodło się (HTTP ${response.status}). Sprawdź konfigurację aplikacji.`);
    const data = record(await response.json());
    if (typeof data.access_token !== "string" || !data.access_token ||
        typeof data.expires_in !== "number" || !Number.isFinite(data.expires_in) || data.expires_in <= 0) {
      throw new Error("Spotify: nieprawidłowa odpowiedź serwera tokenów.");
    }
    this.token = { value: data.access_token, expiresAt: this.now() + Math.max(0, data.expires_in - 30) * 1000 };
    return this.token.value;
  }

  private apiUrl(path: string): URL {
    const url = new URL(path, API);
    if (url.origin !== new URL(API).origin || !url.pathname.startsWith("/v1/") || url.username || url.password || url.hash) {
      throw new Error("Odrzucono nieprawidłowy adres Spotify API.");
    }
    return url;
  }

  async get(path: string): Promise<unknown> {
    const url = this.apiUrl(path);
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await this.request(url.href, {
        headers: { Authorization: `Bearer ${await this.accessToken()}` },
      });
      if (response.status === 401 && attempt === 0) {
        await response.body?.cancel();
        this.token = undefined;
        continue;
      }
      if (!response.ok) {
        throw new Error(`Spotify: HTTP ${response.status} podczas odczytu katalogu. ${response.status === 403 ? "Sprawdź dostęp aplikacji do Web API." : "Sprawdź ID i dostępność wydawnictwa."}`);
      }
      return await response.json();
    }
    throw new Error("Spotify: autoryzacja nie powiodła się.");
  }

  async paginate(path: string, firstPage?: unknown): Promise<unknown[]> {
    let url = this.apiUrl(path);
    const pathname = url.pathname;
    const visited = new Set<string>();
    const items: unknown[] = [];
    let first = true;
    for (;;) {
      if (visited.has(url.href) || visited.size >= 1000 || url.pathname !== pathname) {
        throw new Error("Spotify: nieprawidłowa lub zbyt długa paginacja.");
      }
      visited.add(url.href);
      const page = record(first && firstPage !== undefined ? firstPage : await this.get(url.href));
      first = false;
      if (!Array.isArray(page.items) || (page.next !== null && typeof page.next !== "string")) {
        throw new Error("Spotify: nieprawidłowa strona wyników.");
      }
      items.push(...page.items);
      if (page.next === null) return items;
      url = this.apiUrl(page.next as string);
    }
  }
}
