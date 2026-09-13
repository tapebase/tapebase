"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function adminClient() {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") throw new Error("Brak uprawnień administratora.");
  return { viewer, client: await createClient() };
}

export async function updateManagedUser(formData: FormData) {
  const { client } = await adminClient();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "user");
  const suspended = formData.get("suspended") === "on";
  const reason = String(formData.get("reason") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return;
  const { error } = await client.rpc("admin_update_user", { target_user_id: userId, requested_role: role, suspend_account: suspended, reason: reason || null });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/uzytkownicy"); revalidatePath("/", "layout");
}

export async function moderateCommentAction(formData: FormData) {
  const { client } = await adminClient();
  const commentId = Number(formData.get("commentId"));
  const action = String(formData.get("moderationAction") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!Number.isSafeInteger(commentId) || !["hide", "restore"].includes(action)) return;
  const { error } = await client.rpc("moderate_comment", { target_comment_id: commentId, moderation_action: action, reason: reason || null });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/komentarze"); revalidatePath("/"); revalidatePath("/album/[slug]", "page");
}

export async function dismissCommentReportAction(formData: FormData) {
  const { client } = await adminClient();
  const reportId = Number(formData.get("reportId"));
  if (!Number.isSafeInteger(reportId)) return;
  const { error } = await client.rpc("dismiss_comment_report", { target_report_id: reportId });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/komentarze");
}

export async function updateFeedbackAction(formData: FormData) {
  const { viewer, client } = await adminClient();
  const feedbackId = Number(formData.get("feedbackId"));
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!Number.isSafeInteger(feedbackId) || !["new", "reviewed", "resolved"].includes(status) || note.length > 2000) return;
  const { error } = await client.from("user_feedback").update({ status, admin_id: viewer.id, admin_note: note || null }).eq("id", feedbackId);
  if (error) throw new Error("Nie udało się zaktualizować uwagi.");
  revalidatePath("/admin/feedback");
}
