import { CheckCircle2, ClipboardCheck, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import { ConversionBand, MarketingCard, MarketingHero, MarketingSection } from "@/components/public-marketing";
import { publicMetadata } from "@/lib/seo/public-metadata";

export const metadata = publicMetadata("/safety-standard", "תו התקן הפרטי של גן בטוח לגני ילדים", "איך פועלים בקרה ופיקוח לגני ילדים במסגרת תו התקן הפרטי של גן בטוח, ומה ההבדל בינו לבין רישוי ממשלתי.");

export default function SafetyStandardPage() {
  return (
    <>
      <BrandHeader />
      <main>
        <MarketingHero eyebrow="תו תקן פרטי" title="תו התקן של גן בטוח: ניהול, פיקוח ושיפור מתמשך" subtitle="סטנדרט פרטי לגני ילדים שבוחרים בניהול, בקרה ופיקוח. זה אינו רישיון ממשלתי, תעודה של מכון התקנים או תחליף לחובות הגן לפי דין." />
        <MarketingSection eyebrow="Standard model" title="הסטנדרט בנוי מארבע שכבות">
          <div className="grid cols-4 feature-grid">
            <MarketingCard icon={ClipboardCheck} title="ביקורת" text="תהליך בדיקה מסודר עם שאלות, ניקוד ותיעוד." />
            <MarketingCard icon={FileText} title="ציות" text="מסמכים, נהלים, תוקף ותיקונים." />
            <MarketingCard icon={ShieldCheck} title="שקיפות" text="מה מותר להורים לראות, בלי חשיפת מידע פנימי רגיש." />
            <MarketingCard icon={CheckCircle2} title="שיפור" text="ממצא הופך למשימה, ומשימה נסגרת רק אחרי בדיקה." />
          </div>
        </MarketingSection>
        <MarketingSection eyebrow="איך זה עובד" title="מהביקור ועד לתיקון המאומת" subtitle="לכל גן ניתן לשייך מפקח ייעודי ולתכנן ביקורות חודשיות וקשר שוטף. כל טענה על ביקורת בגן מסוים צריכה להיתמך ברשומה מעודכנת.">
          <div className="grid cols-4 feature-grid">
            <MarketingCard icon={ClipboardCheck} title="בדיקה מתועדת" text="שאלות, ממצאים ותאריך ביקור — לא רק ציון כללי." />
            <MarketingCard icon={FileText} title="מסמכי צוות" text="מעקב אחר תוקף מסמכים, הכשרות והשתלמויות; אימות רשמי נעשה רק בערוץ המוסמך." />
            <MarketingCard icon={ShieldCheck} title="תיקון ובקרה" text="ממצא משויך לאחראי ונבדק שוב לפני סגירה." />
            <MarketingCard icon={CheckCircle2} title="שקיפות להורים" text="מידע ציבורי שאושר לפרסום, תוך הבחנה בין ביקורת פרטית לרישוי מדינתי." />
          </div>
          <p>מערכת הניהול מרכזת את המידע התפעולי הדרוש לבקרה — רישום, כרטיסי ילדים, נוכחות, משימות ומסמכי צוות — בהתאם להרשאות ולצורך. המפקח בוחן ממצאים מתועדים, משוחח עם הגן ועוקב אחר תיקון. כלי המצלמות והתצפיתן הדיגיטלי נמצאים בשלבי פיתוח ובדיקה מבוקרים להתאמה לגנים; הם נועדו לספק אינדיקציות לבדיקה אנושית, לא לקבוע בעצמם אם אירעה פגיעה או אם גן עומד בתקן.</p>
          <p>שיבוץ מפקח, ביקורת חודשית וציון איכות הם חלק ממודל השירות, אך אינם מוצגים כהישג של גן מסוים ללא שיבוץ, ביקורת ונתונים מאומתים בפועל. <Link href="/why-gan-batuach">איך חלקי המערכת מתחברים</Link>.</p>
          <p>למידע נוסף: <Link href="/articles/private-kindergarten-inspections">מדריך לבקרה ופיקוח</Link> · <Link href="/articles/how-to-choose-safe-kindergarten">איך לבחור גן בטוח</Link> · <a href="https://parents.education.gov.il/gov-education/daycare-home">פורטל המעונות בפיקוח משרד החינוך</a>.</p>
        </MarketingSection>
        <ConversionBand title="הגן שלכם יכול להתחיל במדידה כבר עכשיו" text="נזהה יחד מה חסר כדי להתקרב לסטנדרט גן בטוח." />
      </main>
    </>
  );
}
