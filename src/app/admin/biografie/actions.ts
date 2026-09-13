"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type BiographyModerationState = { message?: string; success?: boolean };

export async function moderateArtistBiographyAction(
  _state: BiographyModerationState,
  formData: FormData,
): Promise<BiographyModerationState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { message: "Brak uprawnień administratora." };

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

  revalidatePath("/admin/biografie");
  revalidatePath("/artist/[slug]", "page");
  revalidatePath("/profil");
  revalidatePath("/u/[username]", "page");
  return { success: true, message: decision === "approve" ? "Biografia została opublikowana." : "Biografia została odrzucona." };
}
