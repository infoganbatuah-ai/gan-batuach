import type { MetadataRoute } from "next";
import { getPublishedArticles } from "@/lib/editorial/store";
import { SITE_URL } from "@/lib/editorial/articles";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL;
  const routes = [
    "",
    "/why-gan-batuach",
    "/articles",
    "/safety-standard",
    "/parents-demand",
    "/parents-demand-safety",
    "/parent-portal",
    "/ai-observer",
    "/inspection-platform",
    "/compliance-trust",
    "/case-studies",
    "/roi-calculator",
    "/book-demo",
    "/join-kindergarten",
    "/join-parent",
    "/gardens",
    "/trust",
    "/digital-observer",
    "/digital-observer/home",
    "/digital-observer/business",
    "/digital-observer/office",
    "/digital-observer/warehouse",
    "/digital-observer/store",
    "/digital-observer/parking",
    "/digital-observer/pricing",
    "/digital-observer/request-demo",
    "/digital-observer/start",
    "/digital-observer/trust"
  ];
  const pages: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${base}${route}`,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/book-demo" ? 0.95 : 0.8
  }));
  const articles = await getPublishedArticles();
  return [...pages, ...articles.map((article) => ({ url: `${base}/articles/${article.slug}`, lastModified: new Date(article.published_at), changeFrequency: "monthly" as const, priority: 0.7 }))];
}
