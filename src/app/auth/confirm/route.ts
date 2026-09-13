import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth-validation";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(request.nextUrl.searchParams.get("next"), "/profil");
  const destination = request.nextUrl.clone();

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      const { data: claims } = await supabase.auth.getClaims();
      const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : "";
      const { data: profile } = await supabase.from("users").select("suspended_at,onboarding_completed_at").eq("id", userId).maybeSingle();
      if (profile?.suspended_at) {
        await supabase.auth.signOut();
        destination.pathname = "/login";
        destination.search = "?blocked=1";
        return NextResponse.redirect(destination);
      }
      destination.search = "";
      if (profile && !profile.onboarding_completed_at) {
        destination.pathname = "/witaj";
        destination.searchParams.set("next", next);
      } else destination.pathname = next;
      return NextResponse.redirect(destination);
    }
  }

  destination.pathname = "/auth/error";
  destination.search = "";
  return NextResponse.redirect(destination);
}
