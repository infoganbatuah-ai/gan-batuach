import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "גן בטוח - ניהול ופיקוח גנים",
    short_name: "גן בטוח",
    description: "מערכת ניהול, שקיפות, פיקוח, מצלמות ותצפיתן AI לגני ילדים פרטיים בישראל.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    orientation: "portrait-primary",
    dir: "rtl",
    lang: "he-IL",
    background_color: "#f6f9ff",
    theme_color: "#123b8f",
    categories: ["productivity", "education", "business"],
    icons: [
      { src: "/assets/company-symbol.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/assets/company-symbol.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ],
    screenshots: [
      { src: "/assets/hero-control-center.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "מרכז שליטה גן בטוח" },
      { src: "/assets/company-symbol.png", sizes: "512x512", type: "image/png", form_factor: "narrow", label: "גן בטוח מובייל" }
    ]
  };
}
