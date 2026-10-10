import { Bot, Camera, ClipboardCheck, FileCheck2, HeartHandshake, UsersRound } from "lucide-react";
import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import { ConversionBand, MarketingCard, MarketingHero, MarketingSection } from "@/components/public-marketing";
import { publicMetadata } from "@/lib/seo/public-metadata";

export const metadata = publicMetadata("/why-gan-batuach", "איך גן בטוח מביאה בקרה ופיקוח לגני ילדים?", "מערכת ניהול, מפקח ייעודי, ביקורות, תיעוד ותצפיתן דיגיטלי בבדיקות מבוקרות — כך עובד מודל הבקרה של גן בטוח.");

export default function WhyGanBatuachPage() {
  return (
    <>
      <BrandHeader />
      <main>
        <MarketingHero eyebrow="למה גן בטוח" title="איך גן בטוח מחברת בין ניהול, בקרה ופיקוח?" subtitle="המערכת מרכזת את עבודת הגן, מודל הפיקוח מוסיף מפקח וביקורות מתועדות, וכלי התצפית מיועדים לסייע בבדיקה אנושית. כך נוצר בסיס לאמון ולשקיפות, בלי להציג תכנון כאילו כבר בוצע בכל גן." />
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
        <MarketingSection eyebrow="שרשרת הבקרה" title="מידע, בדיקה, תיקון ואימות" subtitle="הערך אינו בכלי בודד: מידע תפעולי מסייע לזהות פער, מפקח בודק אותו, הגן מטפל, והתיקון מאומת ומתועד.">
          <p>לגן המשתתף בתהליך ניתן לשבץ מפקח ייעודי ולתכנן קשר רציף וביקורות חודשיות. נתוני מערכת הניהול וכרטיסי הילדים זמינים לבעלי הרשאה בלבד. התצפיתן הדיגיטלי נמצא בבדיקות מבוקרות לקראת התאמה לגנים; אות ממנו אינו מחליף ביקור, שיחה או החלטה של אדם מוסמך.</p>
          <p>להסבר על הביקורות, המסמכים והשקיפות להורים ראו <Link href="/safety-standard">תו התקן הפרטי של גן בטוח</Link>. הסטטוס של כל גן צריך להסתמך על ביקורת ונתונים שנרשמו בפועל, ולא על הצטרפות למערכת בלבד.</p>
        </MarketingSection>
        <ConversionBand title="רוצים לראות איך זה עובד על הגן שלכם?" text="הדגמה קצרה תראה את הפערים, ההזדמנויות והדרך לפיילוט." />
      </main>
    </>
  );
}
