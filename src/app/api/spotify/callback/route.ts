import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { exchangeSpotifyCode, saveSpotifyConnection, spotifyRedirectUri } from "@/lib/spotify-user";

function destination(request: NextRequest, listId: string | undefined) {
  return new URL(/^\d{1,19}$/.test(listId ?? "") ? `/lista/${listId}` : "/listy", request.url);
}

export async function GET(request: NextRequest) {
  const expectedState = request.cookies.get("tapebase_spotify_state")?.value;
  const listId = request.cookies.get("tapebase_spotify_list")?.value;
  const target = destination(request, listId);
  const response = (status: "connected" | "denied" | "error") => {
    target.searchParams.set("spotify", status);
    const result = NextResponse.redirect(target);
    result.cookies.delete("tapebase_spotify_state");
    result.cookies.delete("tapebase_spotify_list");
    return result;
  };
  const viewer = await getViewer();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!viewer || !expectedState || state !== expectedState) return response("error");
  if (request.nextUrl.searchParams.get("error") || !code) return response("denied");
  try {
    const token = await exchangeSpotifyCode(code, spotifyRedirectUri(request.nextUrl.origin));
    await saveSpotifyConnection(viewer.id, token);
    return response("connected");
  } catch {
    return response("error");
  }
}
