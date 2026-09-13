import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { syncTicketmasterConcerts } from "@/lib/concert-sync";

export const runtime = "nodejs";

function matchesSecret(request: Request, secret: string) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = Buffer.from(secret);
  const received = Buffer.from(supplied);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  const secret = process.env.CONCERT_SYNC_SECRET;
  if (!secret) return NextResponse.json({ error: "Synchronizacja okresowa nie jest skonfigurowana." }, { status: 503 });
  if (!matchesSecret(request, secret)) return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  try {
    const configuredSize = Number(process.env.CONCERT_SYNC_BATCH_SIZE ?? 20);
    const result = await syncTicketmasterConcerts({ batchSize: Number.isInteger(configuredSize) ? configuredSize : 20 });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Synchronizacja nie powiodła się.";
    return NextResponse.json({ error: message }, { status: message.includes("już trwa") ? 409 : 500 });
  }
}
