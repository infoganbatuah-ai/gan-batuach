import type { Metadata } from "next";
import { digitalObserverShareImage, SITE_ORIGIN } from "@/lib/seo/brand-assets";

export function digitalObserverMetadata(path: string, title: string, description: string): Metadata {
  const url = `${SITE_ORIGIN}${path}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "he_IL",
      siteName: "תצפיתן דיגיטלי",
      url,
      title,
      description,
      images: [digitalObserverShareImage],
    },
    twitter: { card: "summary_large_image", title, description, images: [digitalObserverShareImage.url] },
  };
}
