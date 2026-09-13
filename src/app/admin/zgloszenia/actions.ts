"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { executeAdminAlbumImport } from "@/lib/spotify-admin";
import { submissionCountryCode } from "@/lib/countries";
import { musicGenre } from "@/lib/genres";

export type ModerationState = { message?: string; success?: boolean };

export async function moderateCatalogSubmissions(
  _state: ModerationState,
  formData: FormData,
): Promise<ModerationState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { message: "Brak uprawnień administratora." };
  const ids = [...new Set(formData.getAll("submissionIds").map(Number))]
    .filter(value => Number.isSafeInteger(value) && value > 0);
  if (!ids.length) return { message: "Zaznacz co najmniej jedno zgłoszenie." };
  if (ids.length > 100) return { message: "Jednorazowo można moderować najwyżej 100 zgłoszeń." };
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "approved" && decision !== "rejected") return { message: "Nieprawidłowa decyzja." };
  const note = String(formData.get("moderatorNote") ?? "").trim();
  if (note.length > 1000) return { message: "Notatka może mieć najwyżej 1000 znaków." };
  const rejectionReason = String(formData.get("rejectionReason") ?? "").trim();
  if (decision === "rejected" && !rejectionReason) return { message: "Podaj powód odrzucenia." };
  if (rejectionReason.length > 1000) return { message: "Powód odrzucenia może mieć najwyżej 1000 znaków." };

  const client = await createClient();
  const moderatedAt = new Date().toISOString();
  const results = await Promise.all(ids.map(id => {
    const requestedKind = String(formData.get(`releaseKind-${id}`) ?? "album");
    const releaseKind = requestedKind === "ep" ? "ep" : "album";
    const spotifyType = String(formData.get(`spotifyType-${id}`));
    const countryCode = submissionCountryCode(formData.get(`country-${id}`));
    const genre = musicGenre(formData.get(`genre-${id}`));
    return client.from("catalog_submissions").update({
      status: decision,
      moderator_id: viewer.id,
      moderated_at: moderatedAt,
      moderator_note: note || null,
      rejection_reason: decision === "rejected" ? rejectionReason : null,
      release_kind: spotifyType === "artist" ? null : releaseKind,
      country_code: countryCode,
      genre,
    }).eq("id", id);
  }));
  if (results.some(result => result.error)) return { message: "Nie udało się zapisać wszystkich decyzji." };
  revalidatePath("/admin/zgloszenia");
  revalidatePath("/admin/import");
  revalidatePath("/zglos");
  revalidatePath("/powiadomienia");
  revalidatePath("/", "layout");
  return { success: true, message: `${decision === "approved" ? "Zaakceptowano" : "Odrzucono"} ${ids.length} zgłoszeń.` };
}

export async function importApprovedAlbum(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") redirect("/login?next=%2Fadmin%2Fzgloszenia");
  const id = Number(formData.get("importSubmissionId"));
  const albumType = String(formData.get(`albumType-${id}`));
  let message = "Nie udało się zaimportować albumu.";
  let success = false;
  if (Number.isSafeInteger(id) && id > 0 && (albumType === "album" || albumType === "ep")) {
    const client = await createClient();
    const { data } = await client.from("catalog_submissions")
      .select("spotify_id,title,country_code,genre").eq("id", id).eq("spotify_type", "album").eq("status", "approved").maybeSingle();
    if (data) {
      try {
        const result = await executeAdminAlbumImport(data.spotify_id, albumType, "PL", data.country_code, data.genre);
        const { error } = await client.from("catalog_submissions").update({
          status: "imported", moderator_id: viewer.id, moderated_at: new Date().toISOString(),
        }).eq("id", id);
        if (error) message = "Album dodano, ale nie udało się zaktualizować statusu zgłoszenia.";
        else {
          success = true;
          message = `${data.title}: dodano ${result.albums} album i ${result.tracks} utworów.`;
        }
      } catch (error) {
        message = error instanceof Error ? error.message : message;
      }
    }
  }
  revalidatePath("/");
  revalidatePath("/album");
  revalidatePath("/artist");
  revalidatePath("/rankingi");
  revalidatePath("/admin/zgloszenia");
  redirect(`/admin/zgloszenia?${new URLSearchParams({ success: success ? "1" : "0", message }).toString()}`);
}
