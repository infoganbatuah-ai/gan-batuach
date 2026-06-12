import Link from "next/link";
import { BookOpen, Building2, Sparkles } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { MarketingHero, MarketingSection } from "@/components/public-marketing";

export const metadata = { title: "סיפורי פיילוט | גן בטוח", description: "תשתית לסיפורי הצלחה, פיילוטים ועדויות עתידיות של גן בטוח." };

export default function CaseStudiesPage() {
  return (
    <>
      <BrandHeader />
      <main>
        <MarketingHero eyebrow="Case studies" title="סיפורי הפיילוט של גן בטוח" subtitle="כאן יופיעו סיפורי הצלחה מאושרים לאחר פיילוטים אמיתיים, עם נתונים, תהליך ושיפור." primaryHref="/book-demo" primaryLabel="היו סיפור הפיילוט הראשון" />
        <MarketingSection eyebrow="Framework" title="איך ייראה סיפור הצלחה">
          <div className="case-study-grid">
            {[
              ["לפני", "ניהול מפוזר, מסמכים חסרים, הורים שואלים הרבה."],
              ["הטמעה", "צוות, הורים, פיקוח ומסמכים נכנסים למערכת."],
              ["אחרי", "פחות בלגן, יותר שקיפות, יותר שליטה ניהולית."]
            ].map(([title, text]) => <article className="marketing-card" key={title}><BookOpen /><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </MarketingSection>
        <section className="marketing-cta"><div><Sparkles /><h2>רוצים להיות פיילוט מתועד?</h2><p>נבנה יחד סיפור הצלחה אמיתי ומאושר לפרסום.</p></div><Link className="button primary large" href="/book-demo"><Building2 size={18} /> קביעת הדגמה</Link></section>
      </main>
    </>
  );
}
