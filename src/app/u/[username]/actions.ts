"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type RelationshipOperation = "follow_user" | "unfollow_user" | "block_user" | "unblock_user";

async function updateRelationship(operation: RelationshipOperation, targetUserId: string, username: string) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/u/${username}`)}`);
  if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) throw new Error("Nieprawidłowy użytkownik.");

  const client = await createClient();
  const { error } = await client.rpc(operation, { target_user_id: targetUserId });
  if (error) throw new Error("Nie udało się zmienić relacji z użytkownikiem.");

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
