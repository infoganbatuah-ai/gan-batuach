import { Bot, Camera, Eye, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import { ConversionBand, MarketingCard, MarketingHero, MarketingSection } from "@/components/public-marketing";
import { publicMetadata } from "@/lib/seo/public-metadata";

export const metadata = publicMetadata("/ai-observer", "מצלמות ובקרה דיגיטלית בגני ילדים", "כיצד גן בטוח מתכננת לשלב אינדיקציות ממצלמות בתהליך בקרה ופיקוח אנושי בגני ילדים, ומה עדיין בבדיקות לקראת התאמה לגן.");

export default function AiObserverMarketingPage() {
  return (
    <>
      <BrandHeader />
      <main>
        <MarketingHero eyebrow="גן בטוח · כלי מצלמות" title="תצפית דיגיטלית יכולה לתמוך בבקרה אנושית בגן" subtitle="ההתאמה של כלי המצלמות לגני ילדים נמצאת בפיתוח ובבדיקות מבוקרות. אינדיקציה אפשרית היא הזמנה לבדיקה אנושית מורשית, לא קביעה אוטומטית על ילד, איש צוות או מצב הגן." />
        <MarketingSection eyebrow="בקרה אחראית" title="איך תצפית דיגיטלית עשויה להשתלב בתהליך הגן?">
          <div className="grid cols-4 feature-grid">
            <MarketingCard icon={Eye} title="מסמן לבדיקה" text="אירוע הופך להמלצה לבדיקה, לא למסקנה." />
            <MarketingCard icon={Camera} title="חיבור מותנה" text="התאמה למצלמות ולמדיניות הגן תיבדק לפני הפעלה; אין חשיפת פרטי גישה להורים." />
            <MarketingCard icon={ShieldAlert} title="דפוסים לבדיקה" text="חזרות, חריגות או תקלות עשויות לעזור לתעדף בדיקה, לפי יכולות שאומתו בפועל." />
            <MarketingCard icon={Bot} title="גבולות ברורים" text="בלי האשמות, בלי ענישה, בלי הודעות פאניקה להורים." />
          </div>
          <p><Link href="/digital-observer">תצפיתן דיגיטלי</Link> הוא מוצר עצמאי לבית ולעסק. חיבור עתידי שלו ל<Link href="/kindergarten-management">מערכת ניהול הגן</Link> ידרוש התאמה ייעודית, הרשאות וסקירת פרטיות. הוא אינו מחליף את <Link href="/safety-standard">המפקח ותהליך הביקורת</Link>.</p>
        </MarketingSection>
        <ConversionBand title="רוצים להבין אם מצלמות הגן מוכנות?" text="בדיקת התאמה תראה מה נדרש לחיבור בטוח ומבוקר." />
      </main>
    </>
  );
}
