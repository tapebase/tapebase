import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { syncArtistYouTubeVideos } from "@/lib/youtube-sync";

export const runtime = "nodejs";

function matchesSecret(request: Request, secret: string) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = Buffer.from(secret), received = Buffer.from(supplied);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  const secret = process.env.YOUTUBE_SYNC_SECRET;
  if (!secret) return NextResponse.json({ error: "Synchronizacja YouTube nie jest skonfigurowana." }, { status: 503 });
  if (!matchesSecret(request, secret)) return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  try {
    const configured = Number(process.env.YOUTUBE_SYNC_BATCH_SIZE ?? 10);
    const result = await syncArtistYouTubeVideos({ batchSize: Number.isInteger(configured) ? configured : 10 });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Synchronizacja nie powiodła się.";
    return NextResponse.json({ error: message }, { status: message.includes("już w trakcie") ? 409 : 500 });
  }
}
