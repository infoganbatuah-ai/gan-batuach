import { BellRing, Camera, FileText, Image, MessageCircle, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { ConversionBand, MarketingCard, MarketingHero, MarketingSection } from "@/components/public-marketing";

export const metadata = { title: "פורטל הורים | גן בטוח", description: "פורטל הורים יומי לעדכוני ילד, הודעות, מסמכים, מצלמות ושקיפות." };

export default function ParentPortalPage() {
  return (
    <>
      <BrandHeader />
      <main>
        <MarketingHero eyebrow="Parent Portal" title="ההורים רואים את מה שחשוב, בלי לרדוף אחרי מידע" subtitle="עדכונים יומיים, הודעות, תמונות, מסמכים, איסוף, תשלומים ושקיפות בטיחותית במקום אחד." primaryHref="/parents-demand" primaryLabel="בקשו מהגן להצטרף" />
        <MarketingSection eyebrow="Daily experience" title="מה הורה מקבל כל יום">
          <div className="grid cols-3 feature-grid">
            <MarketingCard icon={BellRing} title="עדכונים" text="מה קרה היום ומה דורש תשומת לב." />
            <MarketingCard icon={Image} title="תמונות ופעילות" text="רגעים מאושרים מתוך היום של הילד." />
            <MarketingCard icon={MessageCircle} title="תקשורת" text="שיחה מסודרת עם הגן ולא פיזור בוואטסאפ." />
            <MarketingCard icon={Camera} title="מצלמות מורשות" text="רק אם הגן אישר ובשעות צפייה." />
            <MarketingCard icon={FileText} title="מסמכים" text="אישורים, טפסים וקבלות במקום אחד." />
            <MarketingCard icon={ShieldCheck} title="אמון" text="סטטוס פיקוח, תיקונים ושקיפות מאושרת." />
          </div>
        </MarketingSection>
        <ConversionBand title="הורים רוצים שקט וביטחון" text="גן בטוח עוזרת לגן לתת להורים תחושת נראות, סדר ואמון." />
      </main>
    </>
  );
}
