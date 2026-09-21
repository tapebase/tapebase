import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { catalogClient } from "@/lib/supabase";
import { SITE_URL } from "@/lib/seo";

const BATCH_SIZE = 1000;

async function loadSitemapData() {
  const client = catalogClient();
  const albums: { slug: string; updated_at: string }[] = [];
  const artists: { id: number; slug: string | null; updated_at: string }[] = [];
  const lists: { id: number; updated_at: string }[] = [];

  for (let offset = 0; ; offset += BATCH_SIZE) {
    const { data, error } = await client.from("albums").select("slug,updated_at")
      .order("id").range(offset, offset + BATCH_SIZE - 1);
    if (error) throw new Error("Nie udało się zbudować mapy albumów.");
    albums.push(...(data ?? []));
    if ((data ?? []).length < BATCH_SIZE) break;
  }
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const { data, error } = await client.from("artists").select("id,slug,updated_at")
      .eq("catalog_visible", true).order("id").range(offset, offset + BATCH_SIZE - 1);
    if (error) throw new Error("Nie udało się zbudować mapy artystów.");
    artists.push(...(data ?? []));
    if ((data ?? []).length < BATCH_SIZE) break;
  }
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const { data, error } = await client.from("user_lists").select("id,updated_at")
      .eq("is_public", true).order("id").range(offset, offset + BATCH_SIZE - 1);
    if (error) throw new Error("Nie udało się zbudować mapy publicznych list.");
    lists.push(...(data ?? []));
    if ((data ?? []).length < BATCH_SIZE) break;
  }
  return { albums, artists, lists };
}

const sitemapData = unstable_cache(loadSitemapData, ["seo-sitemap"], { revalidate: 3600, tags: ["catalog"] });

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { albums, artists, lists } = await sitemapData();
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/album`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/artist`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/rankingi`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/kontakt`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/regulamin`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/polityka-prywatnosci`, changeFrequency: "yearly", priority: 0.2 },
  ];
  return [
    ...staticPages,
    ...albums.map(album => ({
      url: `${SITE_URL}/album/${encodeURIComponent(album.slug)}`,
      lastModified: album.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...artists.map(artist => ({
      url: `${SITE_URL}/artist/${encodeURIComponent(artist.slug || String(artist.id))}`,
      lastModified: artist.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...lists.map(list => ({
      url: `${SITE_URL}/lista/${list.id}`,
      lastModified: list.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
