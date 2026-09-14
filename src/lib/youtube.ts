export type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelId?: string;
    channelTitle?: string;
    publishedAt?: string;
    liveBroadcastContent?: string;
    thumbnails?: Record<string, { url?: string; width?: number; height?: number }>;
  };
};

export type YouTubeVideoItem = {
  id?: string;
  snippet?: YouTubeSearchItem["snippet"];
  statistics?: { viewCount?: string };
  status?: { privacyStatus?: string; embeddable?: boolean };
  contentDetails?: { duration?: string };
};

export type YouTubeChannelItem = {
  id?: string;
  snippet?: {
    title?: string;
    customUrl?: string;
    thumbnails?: Record<string, { url?: string; width?: number; height?: number }>;
  };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
};

export type VideoCandidate = {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  channelId: string;
  channelTitle: string;
  publishedAt: string | null;
  viewCount: number;
  durationSeconds: number | null;
  embeddable: boolean;
  available: boolean;
  live: boolean;
};

export type TrackIdentity = { id: number; title: string };

export type VideoMatch = {
  rejected: boolean;
  autoApprove: boolean;
  isOfficial: boolean;
  confidence: number;
  matchedTrackId: number | null;
  evidence: Record<string, unknown>;
};

export type TrustedChannelCandidate = {
  channelId: string;
  channelTitle: string;
  confidence: number;
  evidence: Record<string, unknown>;
};

export class YouTubeApiError extends Error {
  readonly quotaExceeded: boolean;
  constructor(message: string, quotaExceeded = false) {
    super(message);
    this.name = "YouTubeApiError";
    this.quotaExceeded = quotaExceeded;
  }
}

function safeInteger(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

export function normalizeVideoText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pl-PL").replace(/&(?:amp;|quot;|#39);/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function artistAliases(value: string) {
  const normalized = normalizeVideoText(value);
  const aliases = new Set([normalized]);
  const withoutNumericSuffix = normalized.replace(/\s+\d{2,4}$/, "").trim();
  if (withoutNumericSuffix.length >= 4) aliases.add(withoutNumericSuffix);
  if (/^(?:[a-z]\s+){2,}[a-z]$/.test(normalized)) aliases.add(normalized.replace(/\s/g, ""));
  return [...aliases];
}

export function parseYouTubeDuration(value: string | undefined) {
  if (!value) return null;
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match) return null;
  return Number(match[1] ?? 0) * 86400 + Number(match[2] ?? 0) * 3600
    + Number(match[3] ?? 0) * 60 + Number(match[4] ?? 0);
}

function bestThumbnail(thumbnails: Record<string, { url?: string; width?: number; height?: number }> | undefined) {
  if (!thumbnails) return null;
  return Object.values(thumbnails).filter(item => item.url)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? null;
}

export function parseVideo(item: YouTubeVideoItem): VideoCandidate | null {
  const id = item.id, snippet = item.snippet;
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id) || !snippet?.title
    || !snippet.channelId || !/^UC[A-Za-z0-9_-]{22}$/.test(snippet.channelId)
    || !snippet.channelTitle) return null;
  return {
    videoId: id,
    title: snippet.title,
    thumbnailUrl: bestThumbnail(snippet.thumbnails),
    channelId: snippet.channelId,
    channelTitle: snippet.channelTitle,
    publishedAt: snippet.publishedAt ?? null,
    viewCount: safeInteger(item.statistics?.viewCount),
    durationSeconds: parseYouTubeDuration(item.contentDetails?.duration),
    embeddable: item.status?.embeddable === true,
    available: item.status?.privacyStatus === "public",
    live: Boolean(snippet.liveBroadcastContent && snippet.liveBroadcastContent !== "none"),
  };
}

const blockedPhrases = [
  "official audio", "audio official", "lyric video", "lyrics", "tekst", "visualizer",
  "live", "concert", "koncert", "festival", "festiwal", "interview", "wywiad",
  "reaction", "reakcja", "fan made", "fanmade", "reupload", "shorts", "behind the scenes",
];
const officialPhrases = ["official music video", "official video", "oficjalny teledysk", "music video"];

export function classifyChannel(title: string): "artist" | "label" | "vevo" | "publisher" | "unknown" {
  const normalized = normalizeVideoText(title);
  if (normalized.includes("vevo")) return "vevo";
  if (/\b(records|recordings|label)\b/.test(normalized)) return "label";
  if (/\b(music|entertainment|official)\b/.test(normalized)) return "publisher";
  return "unknown";
}

export function scoreVideoCandidate(input: {
  video: VideoCandidate;
  artistName: string;
  tracks: TrackIdentity[];
  verifiedChannel: boolean;
}): VideoMatch {
  const title = normalizeVideoText(input.video.title);
  const aliases = artistAliases(input.artistName);
  const channel = normalizeVideoText(input.video.channelTitle);
  const blocked = blockedPhrases.filter(phrase => title.includes(normalizeVideoText(phrase)));
  const officialMarker = officialPhrases.some(phrase => title.includes(normalizeVideoText(phrase)));
  const artistInTitle = aliases.some(artist => artist.length >= 2 && title.includes(artist));
  const artistInChannel = aliases.some(artist => artist.length >= 2 && channel.includes(artist));
  const matchedTrack = input.tracks
    .map(track => ({ ...track, normalized: normalizeVideoText(track.title) }))
    .filter(track => track.normalized.length >= 3 && title.includes(track.normalized))
    .sort((a, b) => b.normalized.length - a.normalized.length)[0] ?? null;
  const rejected = !input.video.available || !input.video.embeddable || input.video.live || blocked.length > 0;
  let confidence = 0;
  if (input.verifiedChannel) confidence += 0.5;
  if (matchedTrack) confidence += 0.3;
  if (artistInTitle) confidence += 0.1;
  if (artistInChannel) confidence += 0.05;
  if (officialMarker) confidence += 0.05;
  const channelType = classifyChannel(input.video.channelTitle);
  if (!input.verifiedChannel && ["label", "vevo", "publisher"].includes(channelType)) confidence += 0.1;
  confidence = Math.min(1, Math.round(confidence * 100) / 100);
  const isOfficial = input.verifiedChannel && Boolean(matchedTrack) && !rejected;
  return {
    rejected,
    autoApprove: isOfficial && (artistInTitle || artistInChannel) && confidence >= 0.85,
    isOfficial,
    confidence,
    matchedTrackId: matchedTrack?.id ?? null,
    evidence: {
      verifiedChannel: input.verifiedChannel,
      artistInTitle,
      artistInChannel,
      officialMarker,
      channelType,
      matchedTrackTitle: matchedTrack?.title ?? null,
      blockedPhrases: blocked,
    },
  };
}

export function inferTrustedChannels(
  videos: VideoCandidate[],
  artistName: string,
  tracks: TrackIdentity[],
): TrustedChannelCandidate[] {
  const artist = normalizeVideoText(artistName);
  const groups = new Map<string, {
    title: string; valid: number; tracks: Set<number>; artistTitles: number; officialMarkers: number;
  }>();
  for (const video of videos) {
    const match = scoreVideoCandidate({ video, artistName, tracks, verifiedChannel: false });
    if (match.rejected) continue;
    const group = groups.get(video.channelId) ?? {
      title: video.channelTitle, valid: 0, tracks: new Set<number>(), artistTitles: 0, officialMarkers: 0,
    };
    group.valid++;
    if (match.matchedTrackId) group.tracks.add(match.matchedTrackId);
    if (match.evidence.artistInTitle === true) group.artistTitles++;
    if (match.evidence.officialMarker === true) group.officialMarkers++;
    groups.set(video.channelId, group);
  }

  return [...groups.entries()].flatMap(([channelId, group]) => {
    const canonicalChannel = normalizeVideoText(group.title)
      .replace(/\b(official|youtube|channel|music|vevo|label)\b/g, " ")
      .replace(/\s+/g, " ").trim();
    const exactChannel = canonicalChannel === artist;
    const trackMatches = group.tracks.size;
    const repeatedEvidence = trackMatches >= 3 && group.artistTitles >= 3;
    const exactEvidence = exactChannel && trackMatches >= 2 && group.artistTitles >= 2;
    if (!repeatedEvidence && !exactEvidence) return [];
    return [{
      channelId,
      channelTitle: group.title,
      confidence: exactEvidence ? 0.95 : 0.9,
      evidence: {
        corroboratedSearch: true,
        exactChannelName: exactChannel,
        matchedTrackCount: trackMatches,
        artistTitleCount: group.artistTitles,
        officialMarkerCount: group.officialMarkers,
        validCandidateCount: group.valid,
      },
    }];
  });
}

export function parseYouTubeVideoId(value: string) {
  const trimmed = value.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname === "youtu.be") return /^[A-Za-z0-9_-]{11}$/.test(url.pathname.slice(1)) ? url.pathname.slice(1) : null;
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
      const id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/)?.[1];
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
  } catch { return null; }
  return null;
}

export function parseYouTubeChannelId(value: string) {
  const trimmed = value.trim();
  if (/^UC[A-Za-z0-9_-]{22}$/.test(trimmed)) return trimmed;
  try {
    const id = new URL(trimmed).pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})\/?$/)?.[1];
    return id ?? null;
  } catch { return null; }
}

async function youtubeRequest<T>(path: string, params: URLSearchParams, apiKey: string, fetcher: typeof fetch) {
  params.set("key", apiKey);
  const response = await fetcher(`https://www.googleapis.com/youtube/v3/${path}?${params}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => null) as { error?: { message?: string; errors?: { reason?: string }[] } } | null;
  if (!response.ok) {
    const reason = body?.error?.errors?.[0]?.reason ?? "";
    const quota = response.status === 403 && ["quotaExceeded", "dailyLimitExceeded"].includes(reason);
    throw new YouTubeApiError(quota ? "Wyczerpano dzienny limit YouTube API." : `YouTube API zwróciło HTTP ${response.status}.`, quota);
  }
  return body as T;
}

export async function searchArtistVideos(apiKey: string, artistName: string, fetcher: typeof fetch = fetch) {
  const params = new URLSearchParams({
    part: "snippet", q: `${artistName} official music video`, type: "video",
    videoCategoryId: "10", videoEmbeddable: "true", videoSyndicated: "true",
    order: "viewCount", maxResults: "25",
  });
  const body = await youtubeRequest<{ items?: YouTubeSearchItem[] }>("search", params, apiKey, fetcher);
  return (body.items ?? []).flatMap(item => item.id?.videoId ? [item.id.videoId] : []);
}

export async function getYouTubeVideos(apiKey: string, ids: string[], fetcher: typeof fetch = fetch) {
  if (!ids.length) return [];
  const params = new URLSearchParams({ part: "snippet,statistics,status,contentDetails", id: ids.slice(0, 50).join(",") });
  const body = await youtubeRequest<{ items?: YouTubeVideoItem[] }>("videos", params, apiKey, fetcher);
  return (body.items ?? []).flatMap(item => {
    const parsed = parseVideo(item);
    return parsed ? [parsed] : [];
  });
}

export async function getYouTubeChannel(apiKey: string, channelId: string, fetcher: typeof fetch = fetch) {
  const params = new URLSearchParams({ part: "snippet,contentDetails", id: channelId });
  const body = await youtubeRequest<{ items?: YouTubeChannelItem[] }>("channels", params, apiKey, fetcher);
  return body.items?.[0] ?? null;
}

export async function wikidataYouTubeChannel(qid: string, fetcher: typeof fetch = fetch) {
  if (!/^Q\d+$/.test(qid)) return null;
  const response = await fetcher(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, {
    headers: { "user-agent": "TAPEBASE/0.1 artist-video-enrichment" },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  const body = await response.json() as { entities?: Record<string, { claims?: { P2397?: { mainsnak?: { datavalue?: { value?: unknown } } }[] } }> };
  const value = body.entities?.[qid]?.claims?.P2397?.[0]?.mainsnak?.datavalue?.value;
  return typeof value === "string" && /^UC[A-Za-z0-9_-]{22}$/.test(value) ? value : null;
}
