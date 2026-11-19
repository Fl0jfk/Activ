import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/site-media/"],
      disallow: ["/api/", "/espace", "/admin", "/piece-jointe"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
