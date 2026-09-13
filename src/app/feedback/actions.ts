"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FeedbackState = { success?: boolean; message?: string };

export async function submitFeedback(_state: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const client = await createClient();
  const { data: claims } = await client.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return { message: "Zaloguj się, aby przesłać uwagę." };
  const category = String(formData.get("category") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  const source = String(formData.get("pageUrl") ?? "").trim();
  const pageUrl = source.startsWith("/") && !source.startsWith("//") ? source.slice(0, 2000) : null;
  if (!["bug", "idea", "other"].includes(category) || message.length < 5 || message.length > 3000) {
    return { message: "Opis musi mieć od 5 do 3000 znaków." };
  }
  const { error } = await client.from("user_feedback").insert({ user_id: userId, category, message, page_url: pageUrl });
  if (error) return { message: "Nie udało się zapisać uwagi." };
  revalidatePath("/admin/feedback");
  return { success: true, message: "Dziękujemy — uwaga trafiła do administratorów." };
}
