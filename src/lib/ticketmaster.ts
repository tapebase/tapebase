export type TicketmasterPrice = { min?: number; max?: number; currency?: string };
export type TicketmasterAttraction = { id?: string; name?: string };
export type TicketmasterVenue = {
  name?: string;
  city?: { name?: string };
  country?: { countryCode?: string };
  location?: { latitude?: string; longitude?: string };
  timezone?: string;
};
export type TicketmasterEvent = {
  id?: string;
  name?: string;
  url?: string;
  images?: { url?: string; ratio?: string; width?: number }[];
  dates?: { start?: { dateTime?: string; localDate?: string; localTime?: string }; end?: { dateTime?: string }; status?: { code?: string }; timezone?: string };
  priceRanges?: TicketmasterPrice[];
  _embedded?: { attractions?: TicketmasterAttraction[]; venues?: TicketmasterVenue[] };
};

export type TicketmasterConcert = {
  externalId: string;
  title: string;
  url: string;
  startsAt: string;
  startTimeKnown: boolean;
  endsAt: string | null;
  timezone: string | null;
  status: "scheduled" | "cancelled" | "postponed" | "rescheduled";
  offerStatus: "onsale" | "offsale" | "cancelled" | "postponed" | "rescheduled" | "unknown";
  rawStatus: string | null;
  venueName: string;
  city: string;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
  currency: string | null;
  attraction: { id: string; name: string };
};

export function normalizedArtistName(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pl")
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchesArtist(artistName: string, attractions: TicketmasterAttraction[] = [], expectedAttractionId?: string | null) {
  if (expectedAttractionId) {
    const mapped = attractions.find(item => item.id === expectedAttractionId && item.name);
    if (mapped) return mapped;
  }
  const expected = normalizedArtistName(artistName);
  return attractions.find(item => item.id && item.name && normalizedArtistName(item.name) === expected) ?? null;
}

function eventStatus(code?: string): TicketmasterConcert["status"] {
  if (code === "cancelled") return "cancelled";
  if (code === "postponed") return "postponed";
  if (code === "rescheduled") return "rescheduled";
  return "scheduled";
}

function offerStatus(code?: string): TicketmasterConcert["offerStatus"] {
  if (code === "onsale") return "onsale";
  if (code === "offsale") return "offsale";
  if (code === "cancelled" || code === "postponed" || code === "rescheduled") return code;
  return "unknown";
}

function finite(value?: string) {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function parseTicketmasterEvent(event: TicketmasterEvent, artistName: string, expectedAttractionId?: string | null): TicketmasterConcert | null {
  const attraction = matchesArtist(artistName, event._embedded?.attractions, expectedAttractionId);
  const venue = event._embedded?.venues?.[0];
  const start = event.dates?.start;
  const startTimeKnown = Boolean(start?.dateTime || start?.localTime);
  const startsAt = start?.dateTime ?? (start?.localDate ? `${start.localDate}T${start.localTime ?? "12:00:00"}Z` : null);
  if (!event.id || !event.name || !event.url?.startsWith("https://") || !startsAt || !venue?.name || !venue.city?.name || !attraction?.id || !attraction.name) return null;
  const parsedStart = new Date(startsAt);
  if (Number.isNaN(parsedStart.valueOf())) return null;
  const price = event.priceRanges?.find(item => Number.isFinite(item.min) || Number.isFinite(item.max));
  const image = [...(event.images ?? [])].filter(item => item.url?.startsWith("https://"))
    .sort((a, b) => Number(b.ratio === "16_9") - Number(a.ratio === "16_9") || (b.width ?? 0) - (a.width ?? 0))[0];
  const rawStatus = event.dates?.status?.code ?? null;
  return {
    externalId: event.id,
    title: event.name.trim(),
    url: event.url,
    startsAt: parsedStart.toISOString(),
    startTimeKnown,
    endsAt: event.dates?.end?.dateTime && !Number.isNaN(new Date(event.dates.end.dateTime).valueOf()) ? new Date(event.dates.end.dateTime).toISOString() : null,
    timezone: event.dates?.timezone ?? venue.timezone ?? null,
    status: eventStatus(rawStatus ?? undefined),
    offerStatus: offerStatus(rawStatus ?? undefined),
    rawStatus,
    venueName: venue.name.trim(),
    city: venue.city.name.trim(),
    countryCode: /^[A-Z]{2}$/.test(venue.country?.countryCode ?? "") ? venue.country!.countryCode! : "PL",
    latitude: finite(venue.location?.latitude),
    longitude: finite(venue.location?.longitude),
    imageUrl: image?.url ?? null,
    priceMin: Number.isFinite(price?.min) ? price!.min! : null,
    priceMax: Number.isFinite(price?.max) ? price!.max! : null,
    currency: /^[A-Z]{3}$/.test(price?.currency ?? "") ? price!.currency! : null,
    attraction: { id: attraction.id!, name: attraction.name! },
  };
}
