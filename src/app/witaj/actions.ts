"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth-validation";
import { createClient } from "@/lib/supabase/server";

export async function completeOnboarding(formData: FormData) {
  const client = await createClient();
  const { data: claims } = await client.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) redirect("/login?next=%2Fwitaj");
  const { error } = await client.from("users").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", userId);
  if (error) throw new Error("Nie udało się zakończyć konfiguracji konta.");
  redirect(safeNextPath(formData.get("next"), "/profil"));
}
