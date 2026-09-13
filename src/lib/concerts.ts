import "server-only";

import { catalogClient } from "@/lib/supabase";

export type ConcertOffer = {
  id: number;
  provider: string;
  url: string;
  status: string;
  price_min: number | null;
  price_max: number | null;
  currency: string | null;
};

export type ArtistConcert = {
  id: number;
  title: string;
  starts_at: string;
  start_time_known: boolean;
  timezone: string | null;
  status: string;
  venue_name: string;
  city: string;
  country_code: string;
  image_url: string | null;
  offers: ConcertOffer[];
};

export async function getArtistConcerts(artistId: number, limit = 8): Promise<ArtistConcert[]> {
  const client = catalogClient();
  const { data: links, error: linkError } = await client.from("concert_artists")
    .select("concert_id").eq("artist_id", artistId).limit(500);
  if (linkError) {
    if (linkError.code === "42P01" || linkError.code === "PGRST205") return [];
    throw new Error("Nie udało się pobrać koncertów artysty.");
  }
  const ids = [...new Set((links ?? []).map(item => item.concert_id as number))];
  if (!ids.length) return [];
  const { data, error } = await client.from("concerts")
    .select("id,title,starts_at,start_time_known,timezone,status,venue_name,city,country_code,image_url,offers:ticket_offers(id,provider,url,status,price_min,price_max,currency)")
    .in("id", ids).gte("starts_at", new Date().toISOString()).order("starts_at").limit(limit);
  if (error) throw new Error("Nie udało się pobrać koncertów artysty.");
  return (data ?? []) as ArtistConcert[];
}
