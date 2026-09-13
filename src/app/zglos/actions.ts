"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseSpotifySubmission } from "@/lib/catalog-submission-validation";
import { submissionCountryCode } from "@/lib/countries";
import { musicGenre } from "@/lib/genres";

export type SubmissionActionState = { message?: string; success?: boolean };

function safeOEmbedImage(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "i.scdn.co" ? url.href : null;
  } catch { return null; }
}

export async function submitSpotifyLink(
  _state: SubmissionActionState,
  formData: FormData,
): Promise<SubmissionActionState> {
  const client = await createClient();
  const { data: claims } = await client.auth.getClaims();
  if (typeof claims?.claims?.sub !== "string") return { message: "Zaloguj się, aby wysłać zgłoszenie." };

  try {
    const item = parseSpotifySubmission(String(formData.get("spotifyUrl") ?? ""));
    const countryCode = submissionCountryCode(formData.get("country"));
    const genre = musicGenre(formData.get("genre"));
    const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(item.url)}`, {
      signal: AbortSignal.timeout(10000), cache: "no-store",
    });
    if (!response.ok) return { message: "Spotify nie rozpoznało tego linku." };
    const preview = await response.json() as { title?: unknown; thumbnail_url?: unknown };
    const title = typeof preview.title === "string" ? preview.title.trim().slice(0, 300) : "";
    if (!title) return { message: "Spotify nie zwróciło nazwy tej pozycji." };

    const { data, error } = await client.rpc("submit_spotify_catalog_item", {
      item_type: item.type,
      item_id: item.id,
      item_title: title,
      item_thumbnail_url: safeOEmbedImage(preview.thumbnail_url),
      item_country_code: countryCode,
      item_genre: genre,
    });
    if (error) {
      if (error.message.includes("already exists")) return { message: "Ta pozycja jest już w katalogu TAPEBASE." };
      if (error.message.includes("Daily submission limit")) return { message: "Osiągnięto limit 10 nowych zgłoszeń na 24 godziny." };
      return { message: "Nie udało się zapisać zgłoszenia." };
    }
    revalidatePath("/zglos");
    revalidatePath("/admin/zgloszenia");
    return {
      success: true,
      message: data?.already_supported
        ? "To zgłoszenie już jest na Twojej liście."
        : "Zgłoszenie zapisane. Możesz śledzić jego status poniżej.",
    };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Nie udało się sprawdzić linku." };
  }
}
