import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/editorial/articles";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private HTML routes render explicit noindex directives. Keep them
      // crawlable so engines can see those directives; API/media endpoints are
      // not search documents and remain excluded here.
      disallow: ["/api/"]
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
