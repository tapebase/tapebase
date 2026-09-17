import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { spotifyAuthorizeUrl, spotifyRedirectUri } from "@/lib/spotify-user";

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  const listId = Number(request.nextUrl.searchParams.get("listId"));
  if (!Number.isSafeInteger(listId) || listId < 1) return NextResponse.redirect(new URL("/listy", request.url));
  const client = await createClient();
  const { data: list } = await client.from("user_lists").select("id")
    .eq("id", listId).eq("user_id", viewer.id).eq("kind", "tracks").maybeSingle();
  if (!list) return NextResponse.redirect(new URL("/listy", request.url));

  const state = randomBytes(32).toString("base64url");
  const redirectUri = spotifyRedirectUri(request.nextUrl.origin);
  const response = NextResponse.redirect(spotifyAuthorizeUrl(state, redirectUri));
  const options = { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax" as const, path: "/", maxAge: 600 };
  response.cookies.set("tapebase_spotify_state", state, options);
  response.cookies.set("tapebase_spotify_list", String(listId), options);
  return response;
}
