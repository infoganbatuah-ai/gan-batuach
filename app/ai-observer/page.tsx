import { Bot, Camera, Eye, ShieldAlert } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { ConversionBand, MarketingCard, MarketingHero, MarketingSection } from "@/components/public-marketing";

export const metadata = { title: "תצפיתן דיגיטלי | גן בטוח", description: "תצפיתן דיגיטלי לזיהוי חריגים והמלצות לבדיקה אנושית בגני ילדים." };

export default function AiObserverMarketingPage() {
  return (
    <>
      <BrandHeader />
      <main>
        <MarketingHero eyebrow="Digital Observer" title="תצפיתן דיגיטלי שעוזר לראות מוקדם יותר" subtitle="המערכת יכולה לסמן חריגים לבדיקה אנושית: נפילה, אזור אסור, מצלמה לא זמינה, צפיפות או אירוע שחוזר על עצמו. אין החלטות אוטומטיות." />
        <MarketingSection eyebrow="Responsible AI" title="מה התצפיתן עושה ומה הוא לא עושה">
          <div className="grid cols-4 feature-grid">
            <MarketingCard icon={Eye} title="מסמן לבדיקה" text="אירוע הופך להמלצה לבדיקה, לא למסקנה." />
            <MarketingCard icon={Camera} title="מחובר למצלמות" text="תשתית מצלמות מוגנת, בלי חשיפת RTSP להורים." />
            <MarketingCard icon={ShieldAlert} title="מזהה דפוסים" text="חזרות, חריגות ותקלות שנדרש לבדוק." />
            <MarketingCard icon={Bot} title="גבולות ברורים" text="בלי האשמות, בלי ענישה, בלי הודעות פאניקה להורים." />
          </div>
        </MarketingSection>
        <ConversionBand title="רוצים להבין אם מצלמות הגן מוכנות?" text="בדיקת התאמה תראה מה נדרש לחיבור בטוח ומבוקר." />
      </main>
    </>
  );
}
