import type { Metadata, Viewport } from "next";
import { AppMotionShell, MobilePublicTabs } from "@/components/app-motion-shell";
import { DashboardLiveExperience } from "@/components/dashboard-live-experience";
import "./globals.css";
import "./styles/app-shell.css";
import "./styles/responsive-contract.css";
import "./styles/ux-ui-rescue.css";
import "./styles/dashboard-runtime.css";
import "./styles/live-experience.css";
import "./styles/manager-onboarding-live.css";
import "./styles/digital-observer-product.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://gan-batuach.vercel.app"),
  title: {
    default: "גן בטוח | תקן הבטיחות, הפיקוח והשקיפות החדש לגני ילדים",
    template: "%s | גן בטוח"
  },
  description: "גן בטוח היא פלטפורמת בטיחות, פיקוח, שקיפות וניהול לגני ילדים: הורים, צוות, פקחים ומנהלים במקום אחד.",
  applicationName: "גן בטוח",
  keywords: ["גן בטוח", "בטיחות בגני ילדים", "פיקוח גני ילדים", "שקיפות הורים", "ניהול גן ילדים", "תצפיתן דיגיטלי"],
  openGraph: {
    type: "website",
    locale: "he_IL",
    url: "https://gan-batuach.vercel.app",
    siteName: "גן בטוח",
    title: "גן בטוח – תקן הבטיחות, הפיקוח והשקיפות החדש לגני ילדים",
    description: "פלטפורמה לאמון הורים, פיקוח, תפעול גנים ושקיפות בטיחותית."
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "גן בטוח", statusBarStyle: "default" },
  icons: { icon: "/assets/company-symbol.png", apple: "/assets/company-symbol.png" },
  formatDetection: { telephone: false }
};

export const viewport: Viewport = {
  themeColor: "#123b8f",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" data-scroll-behavior="smooth">
      <body>
        <AppMotionShell>{children}</AppMotionShell>
        <DashboardLiveExperience />
        <MobilePublicTabs />
      </body>
    </html>
  );
}
