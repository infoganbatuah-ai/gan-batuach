import Link from "next/link";
import { BellRing, Camera, FileText, HeartHandshake, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { ConversionBand, MarketingCard, MarketingHero, MarketingSection } from "@/components/public-marketing";

export const metadata = {
  title: "הגן שלכם עדיין לא בגן בטוח?",
  description: "עמוד להורים שרוצים לבקש מהגן שקיפות, בטיחות ופיקוח ברור."
};

export default function ParentsDemandSafetyPage() {
  return (
    <>
      <BrandHeader />
      <main>
        <MarketingHero
          eyebrow="להורים"
          title="גן הילדים שלכם עדיין לא בגן בטוח?"
          subtitle="בקשו מהגן שלכם שקיפות יומית, סטטוס בטיחות, עדכונים, מסמכים ופיקוח ברור. הורים לא צריכים לנחש."
          primaryHref="/join-parent"
          primaryLabel="חיפוש גן / רישום הורה"
          secondaryHref="/book-demo"
          secondaryLabel="שלחו לגן"
        >
          <div className="authority-panel">
            <div><ShieldCheck /><strong>שקיפות</strong><span>מה מותר לכם לראות</span></div>
            <div><BellRing /><strong>עדכונים</strong><span>מה דורש תשומת לב</span></div>
            <div><FileText /><strong>מסמכים</strong><span>אישורים במקום אחד</span></div>
          </div>
        </MarketingHero>
        <MarketingSection eyebrow="מה לבקש מהגן" title="ארבע שאלות שכל הורה יכול לשאול">
          <div className="grid cols-4 feature-grid">
            <MarketingCard icon={HeartHandshake} title="איך אתם מעדכנים הורים?" text="האם יש יומן יומי, הודעות מסודרות והתראות חשובות?" />
            <MarketingCard icon={ShieldCheck} title="איך מתועד פיקוח?" text="האם יש ביקורות, ליקויים, תיקונים ומעקב סגירה?" />
            <MarketingCard icon={Camera} title="איך מנוהלות מצלמות?" text="האם צפייה מוגבלת, מורשית ומתועדת?" />
            <MarketingCard icon={FileText} title="איפה המסמכים?" text="האם אישורים, נהלים וטפסים זמינים במקום אחד?" />
          </div>
        </MarketingSection>
        <section className="parent-pressure-band">
          <div><h2>נוסח קצר לשליחה לגן</h2><p>“היי, שמענו על גן בטוח. נשמח שהגן יבדוק הצטרפות כדי לקבל יותר שקיפות, עדכונים, פיקוח ותיעוד בטיחות.”</p></div>
          <Link className="button primary large" href="/book-demo">הפנו את הגן להדגמה</Link>
        </section>
        <ConversionBand title="רוצים לראות איך זה נראה להורים?" text="פורטל ההורים מציג עדכונים, מסמכים, מצלמות מורשות ושקיפות בטיחותית מאושרת." href="/parent-portal" label="פורטל ההורים" />
      </main>
    </>
  );
}
