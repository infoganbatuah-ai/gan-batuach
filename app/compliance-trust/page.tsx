import { FileText, LockKeyhole, Scale, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { ConversionBand, MarketingCard, MarketingHero, MarketingSection } from "@/components/public-marketing";

export const metadata = { title: "אמון, פרטיות וציות | גן בטוח", description: "אבטחה, פרטיות, ציות ומוכנות ISO עתידית בגני ילדים." };

export default function ComplianceTrustPage() {
  return (
    <>
      <BrandHeader />
      <main>
        <MarketingHero eyebrow="Trust & Compliance" title="שקיפות בלי לוותר על פרטיות" subtitle="גן בטוח בנויה סביב הרשאות, הפרדת גנים, audit, גבולות מצלמות, והצגת מידע מאושר בלבד." />
        <MarketingSection eyebrow="Trust layer" title="מה שומר על המידע">
          <div className="grid cols-4 feature-grid">
            <MarketingCard icon={LockKeyhole} title="הרשאות" text="הורה רואה רק את ילדיו. צוות רואה רק מה שהוגדר לו." />
            <MarketingCard icon={ShieldCheck} title="Audit" text="פעולות רגישות נשמרות לבדיקה." />
            <MarketingCard icon={FileText} title="מסמכים" text="תוקף, אישורים ושמירה מסודרת." />
            <MarketingCard icon={Scale} title="מוכנות ציות" text="תשתית לנהלים, פרטיות ו־ISO בעתיד." />
          </div>
        </MarketingSection>
        <ConversionBand title="אמון מתחיל במבנה נכון" text="נראה איך הגן שלכם יכול להציג שקיפות בלי לחשוף מידע רגיש." />
      </main>
    </>
  );
}
