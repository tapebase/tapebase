"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { sendNewFollowerEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

type RelationshipOperation = "follow_user" | "unfollow_user" | "block_user" | "unblock_user";

async function updateRelationship(operation: RelationshipOperation, targetUserId: string, username: string) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/u/${username}`)}`);
  if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) throw new Error("Nieprawidłowy użytkownik.");

  const client = await createClient();
  const { data, error } = await client.rpc(operation, { target_user_id: targetUserId });
  if (error) throw new Error("Nie udało się zmienić relacji z użytkownikiem.");

  if (operation === "follow_user" && data === true) {
    try {
      await sendNewFollowerEmail({ recipientUserId: targetUserId, actorUsername: viewer.username });
    } catch (emailError) {
      console.error("Nie udało się wysłać e-maila o nowym obserwującym.", emailError);
    }
  }

  revalidatePath(`/u/${username}`);
  revalidatePath("/profil");
}

export async function followUserAction(targetUserId: string, username: string) {
  await updateRelationship("follow_user", targetUserId, username);
}

export async function unfollowUserAction(targetUserId: string, username: string) {
  await updateRelationship("unfollow_user", targetUserId, username);
}

export async function blockUserAction(targetUserId: string, username: string) {
  await updateRelationship("block_user", targetUserId, username);
}

export async function unblockUserAction(targetUserId: string, username: string) {
  await updateRelationship("unblock_user", targetUserId, username);
}
