import type { Metadata } from "next";
import { ganBatuachShareImage, SITE_ORIGIN } from "@/lib/seo/brand-assets";

export function publicMetadata(path: string, title: string, description: string): Metadata {
  const url = `${SITE_ORIGIN}${path}`;
  const fullTitle = `${title} | גן בטוח`;
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", locale: "he_IL", siteName: "גן בטוח", url, title: fullTitle, description, images: [ganBatuachShareImage] },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [ganBatuachShareImage.url] }
  };
}
