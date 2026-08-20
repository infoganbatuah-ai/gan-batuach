import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: { absolute: "תצפיתן דיגיטלי" },
  description: "מערכת עצמאית לניטור מצלמות, אירועים, התראות וכללי בקרה לבית ולעסק.",
  applicationName: "תצפיתן דיגיטלי",
  manifest: "/digital-observer/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "he_IL",
    siteName: "תצפיתן דיגיטלי",
    title: "תצפיתן דיגיטלי",
    description: "חברו מצלמות, הגדירו למה לשים לב וקבלו אירועים שימושיים לבדיקה."
  }
};

export const viewport: Viewport = {
  themeColor: "#061d3a",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function DigitalObserverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
