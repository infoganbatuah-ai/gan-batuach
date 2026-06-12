import { Bot, Camera, ClipboardCheck, FileCheck2, HeartHandshake, UsersRound } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { ConversionBand, MarketingCard, MarketingHero, MarketingSection } from "@/components/public-marketing";

export const metadata = { title: "למה גן בטוח?", description: "למה גנים והורים בוחרים בגן בטוח כמערכת אמון, פיקוח ותפעול." };

export default function WhyGanBatuachPage() {
  return (
    <>
      <BrandHeader />
      <main>
        <MarketingHero eyebrow="Why Gan Batuach" title="גן בטוח מחברת בין תפעול, פיקוח ואמון" subtitle="במקום עוד מערכת ניהול, גן בטוח יוצרת סטנדרט עבודה שמרגישים הורים, צוות, פקחים ומנהלים." />
        <MarketingSection eyebrow="Platform" title="מה כלול">
          <div className="grid cols-3 feature-grid">
            <MarketingCard icon={ClipboardCheck} title="פיקוח" text="ביקורות, GPS, חתימה, ממצאים ותיקונים." />
            <MarketingCard icon={Bot} title="תצפיתן דיגיטלי" text="המלצות זהירות לבדיקה אנושית בלבד." />
            <MarketingCard icon={HeartHandshake} title="שקיפות הורים" text="עדכונים, מסמכים, התראות ותקשורת." />
            <MarketingCard icon={FileCheck2} title="ציות ומסמכים" text="תוקף, חוסרים, אישורים ותזכורות." />
            <MarketingCard icon={UsersRound} title="צוות וילדים" text="נוכחות, משימות, עדכונים ומעקב יומי." />
            <MarketingCard icon={Camera} title="מצלמות" text="גישה מורשית, audit ופרטיות." />
          </div>
        </MarketingSection>
        <ConversionBand title="רוצים לראות איך זה עובד על הגן שלכם?" text="הדגמה קצרה תראה את הפערים, ההזדמנויות והדרך לפיילוט." />
      </main>
    </>
  );
}
