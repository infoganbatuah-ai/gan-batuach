import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api", "/app", "/login", "/register", "/onboarding"]
    },
    sitemap: "https://ganbatuach.com/sitemap.xml"
  };
}
