import type { Metadata, Viewport } from "next";
import { AppMotionShell, MobilePublicTabs } from "@/components/app-motion-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "גן בטוח | מערכת ניהול ופיקוח לגני ילדים פרטיים",
  description: "מערכת ניהול, פיקוח, שקיפות ובקרה לגני ילדים פרטיים בישראל",
  applicationName: "גן בטוח",
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
    <html lang="he" dir="rtl">
      <body>
        <AppMotionShell>{children}</AppMotionShell>
        <MobilePublicTabs />
      </body>
    </html>
  );
}
