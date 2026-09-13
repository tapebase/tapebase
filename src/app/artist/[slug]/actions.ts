"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BiographyActionState = { message?: string; success?: boolean };

export async function submitArtistBiography(
  artistId: number,
  _state: BiographyActionState,
  formData: FormData,
): Promise<BiographyActionState> {
  if (!Number.isSafeInteger(artistId) || artistId < 1) return { message: "Nieprawidłowy artysta." };
  const biography = String(formData.get("biography") ?? "").trim();
  if (biography.length < 80 || biography.length > 5000) {
    return { message: "Biografia musi mieć od 80 do 5000 znaków." };
  }

  const client = await createClient();
  const { data: claims } = await client.auth.getClaims();
  if (typeof claims?.claims?.sub !== "string") return { message: "Zaloguj się, aby zgłosić biografię." };

  const { error } = await client.rpc("submit_artist_biography", {
    target_artist_id: artistId,
    biography,
  });
  if (error) {
    if (error.message.includes("Daily biography submission limit")) {
      return { message: "Osiągnięto limit 5 nowych biografii na 24 godziny." };
    }
    return { message: "Nie udało się wysłać biografii do akceptacji." };
  }

  revalidatePath("/admin/artysci");
  revalidatePath("/artist/[slug]", "page");
  return { success: true, message: "Biografia została wysłana do akceptacji administratora." };
}
