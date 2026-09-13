"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateUsername } from "@/lib/auth-validation";

export type ProfileActionState = {
  success?: boolean;
  message?: string;
  errors?: { username?: string; avatar?: string };
};

const allowedAvatarTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxAvatarSize = 2 * 1024 * 1024;

export async function updateProfile(
  _state: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const client = await createClient();
  const { data: claimsData, error: claimsError } = await client.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (claimsError || !userId) return { message: "Zaloguj się ponownie, aby zmienić profil." };

  const username = validateUsername(formData.get("username"));
  if (!username) return { errors: { username: "Użyj 3–24 liter, cyfr lub znaku _." } };

  const { data: current, error: currentError } = await client
    .from("users")
    .select("username,avatar_url,suspended_at")
    .eq("id", userId)
    .single();
  if (currentError) return { message: "Nie udało się pobrać profilu." };
  if (current.suspended_at) return { message: "To konto jest zawieszone." };

  const avatarValue = formData.get("avatar");
  const avatar = avatarValue instanceof File && avatarValue.size > 0 ? avatarValue : null;
  if (avatar && (!allowedAvatarTypes.has(avatar.type) || avatar.size > maxAvatarSize)) {
    return { errors: { avatar: "Wybierz JPG, PNG, WebP lub GIF o rozmiarze do 2 MB." } };
  }

  let avatarUrl = current.avatar_url;
  if (avatar) {
    const { error: uploadError } = await client.storage.from("avatars").upload(
      `${userId}/avatar`,
      new Uint8Array(await avatar.arrayBuffer()),
      { contentType: avatar.type, cacheControl: "3600", upsert: true },
    );
    if (uploadError) return { errors: { avatar: "Nie udało się przesłać avatara." } };
    const { data } = client.storage.from("avatars").getPublicUrl(`${userId}/avatar`);
    avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
  }

  const { error } = await client.from("users")
    .update({ username, avatar_url: avatarUrl })
    .eq("id", userId);
  if (error?.code === "23505") return { errors: { username: "Ta nazwa użytkownika jest zajęta." } };
  if (error) return { message: "Nie udało się zapisać zmian profilu." };

  revalidatePath("/", "layout");
  revalidatePath("/profil");
  revalidatePath(`/u/${current.username}`);
  revalidatePath(`/u/${username}`);
  return { success: true, message: "Profil został zaktualizowany." };
}
