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
  metadataBase: new URL("https://ganbatuach.com"),
  title: {
    default: "גן בטוח | תקן הבטיחות, הפיקוח והשקיפות החדש לגני ילדים",
    template: "%s | גן בטוח"
  },
  description: "גן בטוח היא מערכת לניהול גני ילדים וסטנדרט פרטי לבקרה ופיקוח: הורים, צוות, מפקחים ומנהלים במקום אחד.",
  applicationName: "גן בטוח",
  keywords: ["גן בטוח", "תו תקן לגני ילדים פרטיים", "בקרה ופיקוח לגני ילדים", "מערכת לניהול גני ילדים", "ניהול גן ילדים", "בחירת גן ילדים"],
  openGraph: {
    type: "website",
    locale: "he_IL",
    url: "https://ganbatuach.com",
    siteName: "גן בטוח",
    title: "גן בטוח – תו תקן פרטי ומערכת לניהול גני ילדים",
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
  initialScale: 1
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
