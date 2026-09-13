"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { reviewArtistEnrichment, runArtistEnrichmentBatch } from "@/lib/artist-enrichment";
import { createClient } from "@/lib/supabase/server";

export type BiographyModerationState = { message?: string; success?: boolean };

async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") throw new Error("Brak uprawnień administratora.");
  return viewer;
}

export async function runArtistEnrichmentAction(formData: FormData) {
  await requireAdmin();
  const limit = Number(formData.get("limit") ?? 5);
  await runArtistEnrichmentBatch(Number.isSafeInteger(limit) ? limit : 5);
  revalidatePath("/admin/artysci");
  revalidatePath("/artist/[slug]", "page");
}

export async function reviewArtistEnrichmentAction(formData: FormData) {
  const viewer = await requireAdmin();
  const candidateId = Number(formData.get("candidateId"));
  const action = String(formData.get("decision"));
  if (!Number.isSafeInteger(candidateId) || (action !== "approve" && action !== "reject")) {
    throw new Error("Nieprawidłowa decyzja enrichmentu.");
  }
  await reviewArtistEnrichment(candidateId, action, viewer.id);
  revalidatePath("/admin/artysci");
  revalidatePath("/artist/[slug]", "page");
}

export async function moderateArtistBiographyAction(
  _state: BiographyModerationState,
  formData: FormData,
): Promise<BiographyModerationState> {
  await requireAdmin();
  const submissionId = Number(formData.get("submissionId"));
  const decision = String(formData.get("decision") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!Number.isSafeInteger(submissionId) || submissionId < 1 || !["approve", "reject"].includes(decision)) {
    return { message: "Nieprawidłowa decyzja moderacji." };
  }
  if (decision === "reject" && !reason) return { message: "Podaj powód odrzucenia." };

  const client = await createClient();
  const { error } = await client.rpc("moderate_artist_biography", {
    target_submission_id: submissionId,
    decision,
    reason: reason || null,
  });
  if (error) return { message: "Nie udało się zapisać decyzji. Odśwież kolejkę i spróbuj ponownie." };

  revalidatePath("/admin/artysci");
  revalidatePath("/artist/[slug]", "page");
  revalidatePath("/profil");
  revalidatePath("/u/[username]", "page");
  return { success: true, message: decision === "approve" ? "Biografia została opublikowana." : "Biografia została odrzucona." };
}
