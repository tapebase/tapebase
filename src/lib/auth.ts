import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Viewer = {
  id: string;
  email: string | null;
  username: string;
  avatar_url: string | null;
  role: string;
};

export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const id = typeof claims?.sub === "string" ? claims.sub : null;
  if (error || !id) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("username,avatar_url,role,suspended_at")
    .eq("id", id)
    .maybeSingle();

  if (!profile || profile.suspended_at) return null;
  return {
    id,
    email: typeof claims?.email === "string" ? claims.email : null,
    username: profile.username,
    avatar_url: profile.avatar_url,
    role: profile.role,
  };
}
