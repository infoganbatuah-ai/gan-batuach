import Link from "next/link";
import { Calculator, Clock, FileCheck2, HeartHandshake, TrendingUp } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { MarketingCard, MarketingHero, MarketingSection } from "@/components/public-marketing";

export const metadata = {
  title: "מחשבון ROI לגנים | גן בטוח",
  description: "הערכת חיסכון תפעולי, מוכנות פיקוח ואמון הורים באמצעות גן בטוח."
};

export default function RoiCalculatorPage() {
  return (
    <>
      <BrandHeader />
      <main>
        <MarketingHero eyebrow="ROI" title="כמה זמן וכאב ראש גן בטוח יכולה לחסוך?" subtitle="מחשבון ראשוני שמציג את ערך התפעול, הפיקוח והאמון. המספרים הם הערכה, לא התחייבות כספית." primaryHref="/book-demo" primaryLabel="בדיקת ROI לגן">
          <div className="roi-card">
            <Calculator size={34} />
            <strong>הערכת חיסכון חודשית</strong>
            <span>שעות ניהול + מסמכים + פיקוח + תקשורת הורים</span>
          </div>
        </MarketingHero>
        <MarketingSection eyebrow="Value areas" title="איפה נוצר הערך">
          <div className="grid cols-4 feature-grid">
            <MarketingCard icon={Clock} title="חיסכון תפעולי" text="פחות רדיפה אחרי הודעות, מסמכים, משימות ועדכונים." />
            <MarketingCard icon={FileCheck2} title="מוכנות פיקוח" text="פחות הפתעות לפני ביקורת ויותר תיקונים מתועדים." />
            <MarketingCard icon={HeartHandshake} title="אמון הורים" text="שקיפות יומית מצמצמת חוסר ודאות ופניות חוזרות." />
            <MarketingCard icon={TrendingUp} title="יתרון מסחרי" text="גן שמראה סטנדרט בטיחות יכול להבדיל את עצמו." />
          </div>
        </MarketingSection>
        <section className="marketing-section">
          <div className="roi-estimator">
            {[
              ["10 שעות", "ניהול הורים ועדכונים"],
              ["6 שעות", "מסמכים, אישורים ותזכורות"],
              ["4 שעות", "מוכנות לפיקוח ותיקונים"],
              ["ערך גבוה", "אמון ושימור הורים"]
            ].map(([value, label]) => <article key={label}><strong>{value}</strong><span>{label}</span></article>)}
          </div>
          <div className="actions"><Link className="button primary large" href="/book-demo">קבעו שיחת ROI</Link></div>
        </section>
      </main>
    </>
  );
}
