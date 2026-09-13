import type { Metadata } from "next";

const origin = "https://ganbatuach.com";

export function publicMetadata(path: string, title: string, description: string): Metadata {
  const url = `${origin}${path}`;
  const fullTitle = `${title} | גן בטוח`;
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", locale: "he_IL", siteName: "גן בטוח", url, title: fullTitle, description, images: [{ url: `${origin}/assets/hero-control-center.png`, alt: "חלל גן ילדים ומערכת ניהול גן בטוח" }] },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [`${origin}/assets/hero-control-center.png`] }
  };
}
