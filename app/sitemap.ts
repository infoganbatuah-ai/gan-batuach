import type { MetadataRoute } from "next";
import { getPublishedArticles } from "@/lib/editorial/store";
import { SITE_URL } from "@/lib/editorial/articles";
import { getInlineImages } from "@/lib/editorial/article-content";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL;
  const routes = [
    "",
    "/why-gan-batuach",
    "/kindergarten-management",
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
    "/digital-observer/guides",
    "/digital-observer/home",
    "/digital-observer/business",
    "/digital-observer/video-investigation",
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
  const [ganArticles, observerArticles] = await Promise.all([getPublishedArticles(), getPublishedArticles("observer")]);
  return [...pages, ...ganArticles.map((article) => ({
    url: `${base}/articles/${article.slug}`, lastModified: new Date(article.updated_at ?? article.published_at),
    images: [article.image_url, ...getInlineImages(article.body).map((item) => item.src)].map((path) => new URL(path, base).href),
    changeFrequency: "monthly" as const, priority: 0.7
  })), ...observerArticles.map((article) => ({
    url: `${base}/digital-observer/guides/${article.slug}`, lastModified: new Date(article.updated_at ?? article.published_at),
    images: [article.image_url, ...getInlineImages(article.body).map((item) => item.src)].map((path) => new URL(path, base).href), changeFrequency: "monthly" as const, priority: 0.7
  }))];
}
