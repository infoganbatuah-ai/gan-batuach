import { CalendarCheck, ClipboardCheck, FileCheck2, MapPin } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { ConversionBand, MarketingCard, MarketingHero, MarketingSection } from "@/components/public-marketing";

export const metadata = { title: "פלטפורמת פיקוח לגני ילדים | גן בטוח", description: "מערכת פיקוח חודשית, ממצאים, תיקונים ודוחות לגני ילדים." };

export default function InspectionPlatformPage() {
  return (
    <>
      <BrandHeader />
      <main>
        <MarketingHero eyebrow="Inspection Platform" title="פיקוח שלא מסתיים בדוח – הוא מייצר תיקון" subtitle="פקחים, מנהלים ואדמין עובדים על אותו תהליך: ביקורת, ממצא, משימה, הוכחת תיקון וסגירה." />
        <MarketingSection eyebrow="Inspection workflow" title="פיקוח תפעולי מקצה לקצה">
          <div className="grid cols-4 feature-grid">
            <MarketingCard icon={CalendarCheck} title="תכנון ביקורות" text="חודשי, פתע, מעקב ותלונות." />
            <MarketingCard icon={MapPin} title="GPS וחתימה" text="תיעוד ביקור אמין בשטח." />
            <MarketingCard icon={ClipboardCheck} title="טפסים ודירוג" text="שאלות, תמונות, ניקוד וממצאים." />
            <MarketingCard icon={FileCheck2} title="תיקון וסגירה" text="ליקוי הופך למשימת תיקון עם הוכחה." />
          </div>
        </MarketingSection>
        <ConversionBand title="פיקוח טוב הוא תהליך חוזר" text="גן בטוח עוזרת להפוך פיקוח להרגל תפעולי." />
      </main>
    </>
  );
}
