"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationsRead() {
  const viewer = await getViewer();
  if (!viewer) return;
  const client = await createClient();
  const { error } = await client.from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", viewer.id).is("read_at", null);
  if (error) throw new Error("Nie udało się oznaczyć powiadomień jako przeczytane.");
  revalidatePath("/profil");
  revalidatePath("/powiadomienia");
  revalidatePath("/", "layout");
}

export async function markNotificationRead(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) return;
  const id = Number(formData.get("notificationId"));
  if (!Number.isSafeInteger(id) || id < 1) return;
  const client = await createClient();
  const { error } = await client.from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", viewer.id);
  if (error) throw new Error("Nie udało się oznaczyć powiadomienia jako przeczytane.");
  revalidatePath("/powiadomienia");
  revalidatePath("/", "layout");
}
