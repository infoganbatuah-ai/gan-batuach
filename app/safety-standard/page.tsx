import { CheckCircle2, ClipboardCheck, FileText, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { ConversionBand, MarketingCard, MarketingHero, MarketingSection } from "@/components/public-marketing";

export const metadata = { title: "תקן גן בטוח", description: "סטנדרט גן בטוח לפיקוח, ציות, שקיפות ובטיחות." };

export default function SafetyStandardPage() {
  return (
    <>
      <BrandHeader />
      <main>
        <MarketingHero eyebrow="Gan Batuach Standard" title="תקן גן בטוח: פיקוח, שקיפות ותיקון מתמשך" subtitle="הסטנדרט מגדיר איך גן מתעד בטיחות, איך מטפלים בליקויים, ואיך הורים מקבלים שקיפות מאושרת." />
        <MarketingSection eyebrow="Standard model" title="הסטנדרט בנוי מארבע שכבות">
          <div className="grid cols-4 feature-grid">
            <MarketingCard icon={ClipboardCheck} title="ביקורת" text="תהליך בדיקה מסודר עם שאלות, ניקוד ותיעוד." />
            <MarketingCard icon={FileText} title="ציות" text="מסמכים, נהלים, תוקף ותיקונים." />
            <MarketingCard icon={ShieldCheck} title="שקיפות" text="מה מותר להורים לראות, בלי חשיפת מידע פנימי רגיש." />
            <MarketingCard icon={CheckCircle2} title="שיפור" text="ממצא הופך למשימה, ומשימה נסגרת רק אחרי בדיקה." />
          </div>
        </MarketingSection>
        <ConversionBand title="הגן שלכם יכול להתחיל במדידה כבר עכשיו" text="נזהה יחד מה חסר כדי להתקרב לסטנדרט גן בטוח." />
      </main>
    </>
  );
}
