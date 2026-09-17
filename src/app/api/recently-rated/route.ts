import { NextResponse } from "next/server";
import { mostRatedRecently } from "@/lib/catalog";

const PAGE_SIZE = 10;

export async function GET(request: Request) {
  const offsetValue = new URL(request.url).searchParams.get("offset") ?? "0";
  const offset = /^\d{1,6}$/.test(offsetValue) ? Number(offsetValue) : -1;
  if (offset < 0 || offset > 100_000) {
    return NextResponse.json({ error: "Nieprawidłowa pozycja rankingu." }, { status: 400 });
  }

  try {
    const rows = await mostRatedRecently(PAGE_SIZE + 1, offset);
    return NextResponse.json({
      items: rows.slice(0, PAGE_SIZE).map(album => ({
        id: album.id,
        title: album.title,
        slug: album.slug,
        cover_url: album.cover_url,
        average: album.average,
        recentRatingCount: album.recentRatingCount,
      })),
      hasMore: rows.length > PAGE_SIZE,
    });
  } catch {
    return NextResponse.json({ error: "Nie udało się pobrać kolejnych pozycji rankingu." }, { status: 500 });
  }
}
