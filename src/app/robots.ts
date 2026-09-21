import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/", "/api/", "/auth/", "/login", "/profil", "/powiadomienia",
        "/reset-hasla", "/ustaw-haslo", "/witaj", "/utwory", "/listy", "/zglos",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
