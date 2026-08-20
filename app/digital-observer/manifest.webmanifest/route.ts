import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    name: "תצפיתן דיגיטלי",
    short_name: "תצפיתן",
    description: "ניטור מצלמות ואירועים לבית ולעסק",
    lang: "he",
    dir: "rtl",
    start_url: "/digital-observer/dashboard",
    scope: "/digital-observer/",
    display: "standalone",
    background_color: "#f5f9fa",
    theme_color: "#061d3a",
    icons: [{ src: "/assets/digital-observer/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }]
  });
}
