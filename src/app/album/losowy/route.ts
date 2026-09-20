import { NextResponse } from "next/server";
import { catalogClient } from "@/lib/supabase";

function albumCatalogUrl(request: Request) {
  return new URL("/album?losowy=blad", request.url);
}

export async function GET(request: Request) {
  const client = catalogClient();
  const countResult = await client.from("albums").select("id", { count: "exact", head: true });
  const count = countResult.count ?? 0;

  if (countResult.error || count < 1) {
    return NextResponse.redirect(albumCatalogUrl(request));
  }

  const offset = Math.floor(Math.random() * count);
  const albumResult = await client.from("albums").select("slug").order("id").range(offset, offset).maybeSingle<{ slug: string }>();

  if (albumResult.error || !albumResult.data?.slug) {
    return NextResponse.redirect(albumCatalogUrl(request));
  }

  return NextResponse.redirect(new URL(`/album/${encodeURIComponent(albumResult.data.slug)}`, request.url));
}
