"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { reviewArtistEnrichment, runArtistEnrichmentBatch } from "@/lib/artist-enrichment";

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
