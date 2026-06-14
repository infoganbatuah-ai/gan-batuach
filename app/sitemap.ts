import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://gan-batuach.vercel.app";
  const routes = [
    "",
    "/why-gan-batuach",
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
    "/kindergarten-directory",
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
  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/book-demo" ? 0.95 : 0.8
  }));
}
