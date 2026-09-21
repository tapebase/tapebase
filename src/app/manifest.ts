import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} – społecznościowa baza muzyki`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    lang: "pl",
    icons: [
      { src: "/favicon-t-light-64.png", sizes: "64x64", type: "image/png" },
    ],
  };
}
