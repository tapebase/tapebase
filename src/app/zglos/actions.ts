"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseSpotifySubmission } from "@/lib/catalog-submission-validation";
import { submissionCountryCode } from "@/lib/countries";
import { musicGenre } from "@/lib/genres";
import { automaticReviewNote, inspectCatalogSubmission } from "@/lib/catalog-submission-review";
import { executeAdminAlbumImport } from "@/lib/spotify-admin";
import { runImportQueueBatch } from "@/lib/import-queue";
import { importClient } from "../../../scripts/spotify/writer.mts";

export type SubmissionActionState = { message?: string; success?: boolean };

export async function submitSpotifyLink(
  _state: SubmissionActionState,
  formData: FormData,
): Promise<SubmissionActionState> {
  const client = await createClient();
  const { data: claims } = await client.auth.getClaims();
  const viewerId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!viewerId) return { message: "Zaloguj się, aby wysłać zgłoszenie." };

  let item: ReturnType<typeof parseSpotifySubmission>;
  try {
    item = parseSpotifySubmission(String(formData.get("spotifyUrl") ?? ""));
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Nieprawidłowy link Spotify." };
  }
  try {
    const countryCode = submissionCountryCode(formData.get("country"));
    const genre = musicGenre(formData.get("genre"));
    const database = importClient();
    const { data: existingSubmission, error: existingError } = await database.from("catalog_submissions")
      .select("id,status").eq("spotify_type", item.type).eq("spotify_id", item.id).maybeSingle();
    if (existingError) return { message: "Nie udało się sprawdzić wcześniejszych zgłoszeń." };
    let alreadySupported = false;
    if (existingSubmission) {
      const { data: existingSupport, error: supportError } = await database.from("catalog_submission_supporters")
        .select("submission_id").eq("submission_id", existingSubmission.id).eq("user_id", viewerId).maybeSingle();
      if (supportError) return { message: "Nie udało się sprawdzić wcześniejszych zgłoszeń." };
      alreadySupported = Boolean(existingSupport);
      if (existingSupport && existingSubmission.status !== "pending") {
        return { success: true, message: "To zgłoszenie już jest na Twojej liście." };
      }
      if (existingSubmission.status === "imported") return { message: "Ta pozycja jest już w katalogu TAPEBASE." };
    }
    if (!alreadySupported) {
      const { count: recentCount, error: limitError } = await database.from("catalog_submission_supporters")
        .select("submission_id", { count: "exact", head: true }).eq("user_id", viewerId)
        .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
      if (limitError) return { message: "Nie udało się sprawdzić limitu zgłoszeń." };
      if ((recentCount ?? 0) >= 10) return { message: "Osiągnięto limit 10 nowych zgłoszeń na 24 godziny." };
    }
    const inspection = await inspectCatalogSubmission(item.type, item.id);

    const { data, error } = await client.rpc("submit_spotify_catalog_item", {
      item_type: item.type,
      item_id: item.id,
      item_title: inspection.title,
      item_thumbnail_url: inspection.thumbnailUrl,
      item_country_code: countryCode,
      item_genre: genre,
    });
    if (error) {
      if (error.message.includes("already exists")) return { message: "Ta pozycja jest już w katalogu TAPEBASE." };
      if (error.message.includes("Daily submission limit")) return { message: "Osiągnięto limit 10 nowych zgłoszeń na 24 godziny." };
      return { message: "Nie udało się zapisać zgłoszenia." };
    }
    const submissionId = Number(data?.id);
    if (!Number.isSafeInteger(submissionId) || submissionId < 1) {
      return { message: "Nie udało się potwierdzić zapisu zgłoszenia." };
    }
    const update = await database.from("catalog_submissions").update({
      moderator_note: automaticReviewNote(inspection.review),
      release_kind: inspection.review.releaseKind,
      ...(inspection.review.autoApprove ? { status: "approved", moderated_at: new Date().toISOString() } : {}),
    }).eq("id", submissionId).eq("status", "pending").select("id").maybeSingle();
    if (update.error) return { message: "Zgłoszenie zapisano, ale automatyczna kontrola nie została ukończona." };

    let imported = false;
    if (inspection.review.autoApprove && update.data && item.type === "album") {
      try {
        await executeAdminAlbumImport(item.id, "album", "PL", countryCode, genre);
        if (inspection.primaryArtistSpotifyId) {
          const artistUpdate = inspection.primaryArtistImageUrl
            ? { image_url: inspection.primaryArtistImageUrl, catalog_visible: true }
            : { catalog_visible: true };
          const artistResult = await database.from("artists").update(artistUpdate)
            .eq("spotify_id", inspection.primaryArtistSpotifyId);
          if (artistResult.error) throw new Error("Nie udało się uzupełnić profilu wykonawcy.");
        }
        const result = await database.from("catalog_submissions").update({ status: "imported" })
          .eq("id", submissionId).eq("status", "approved");
        imported = !result.error;
      } catch {
        // Approval already created a durable import job. It can safely resume
        // after a transient Spotify or network failure.
      }
    }
    if (inspection.review.autoApprove && update.data) {
      after(async () => {
        try {
          for (let batch = 0; batch < 10; batch++) {
            const result = await runImportQueueBatch(3);
            if (!result.hasMore || result.waitingQuota) break;
          }
        } catch {
          // The durable queue preserves the job for the next automatic or admin run.
        }
      });
    }
    revalidatePath("/zglos");
    revalidatePath("/admin/zgloszenia");
    revalidatePath("/");
    revalidatePath("/album");
    revalidatePath("/artist");
    revalidatePath("/rankingi");
    return {
      success: true,
      message: imported
          ? "Album został sprawdzony i automatycznie dodany do katalogu."
          : inspection.review.autoApprove && item.type === "artist"
            ? "Artysta został automatycznie zaakceptowany. Import dyskografii rozpoczął się w tle."
          : inspection.review.autoApprove
            ? "Album został zaakceptowany i dodany do bezpiecznej kolejki importu."
            : data?.already_supported && !alreadySupported
              ? "To zgłoszenie już jest na Twojej liście."
            : "Zgłoszenie wymaga sprawdzenia przez administratora. Powód znajdziesz poniżej.",
    };
  } catch {
    return { message: "Nie udało się potwierdzić tej pozycji w Spotify. Sprawdź link lub spróbuj później." };
  }
}
