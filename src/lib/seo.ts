import type { Metadata } from "next";

export const SITE_NAME = "TAPEBASE";
export const SITE_URL = "https://tapebase.pl";
export const SITE_DESCRIPTION = "TAPEBASE to społecznościowa baza muzyki. Oceniaj albumy i artystów, pisz recenzje, twórz rankingi i playlisty oraz odkrywaj nowe wydawnictwa.";
export const DEFAULT_SOCIAL_IMAGE = "/opengraph-image";

export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString();
}

export function privatePageMetadata(title: string): Metadata {
  return {
    title,
    robots: { index: false, follow: false, noarchive: true },
  };
}

export function publicPageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
    siteName: SITE_NAME,
    locale: "pl_PL",
    type: "website",
    images: [{ url: DEFAULT_SOCIAL_IMAGE, width: 1200, height: 630, alt: "TAPEBASE – społecznościowa baza muzyki" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  };
}
