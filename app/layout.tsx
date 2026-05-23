import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "גן בטוח | מערכת ניהול ופיקוח לגני ילדים פרטיים",
  description: "מערכת ניהול, פיקוח, שקיפות ובקרה לגני ילדים פרטיים בישראל"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
