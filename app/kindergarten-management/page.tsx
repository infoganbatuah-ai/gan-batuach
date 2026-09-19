import Link from "next/link";
import { ClipboardCheck, FileText, HeartHandshake, ShieldCheck, UsersRound } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { ConversionBand, MarketingCard, MarketingHero, MarketingSection } from "@/components/public-marketing";
import { publicMetadata } from "@/lib/seo/public-metadata";

export const metadata = publicMetadata(
  "/kindergarten-management",
  "מערכת לניהול גני ילדים מקצה לקצה",
  "מערכת ניהול גן ילדים של גן בטוח מרכזת רישום, כרטיסי ילדים, צוות, הורים, מסמכים, משימות ובקרה. הכירו את ההבדל בין ניהול שוטף, פיקוח וכלי מצלמות בפיתוח."
);

export default function KindergartenManagementPage() {
  return (
    <>
      <BrandHeader />
      <main>
        <MarketingHero
          eyebrow="מערכת ניהול גני ילדים"
          title="ניהול גן ילדים מקצה לקצה, עם בקרה שמתועדת לאורך הדרך"
          subtitle="גן בטוח מחברת את עבודת המנהלת, הצוות וההורים למערכת אחת: רישום, מידע חיוני על ילדים, משימות, מסמכים ותקשורת. תהליכי הפיקוח הפרטיים נשענים על מידע מאומת ועל בדיקה אנושית — לא על עצם ההצטרפות למערכת."
          primaryHref="/join-kindergarten"
          primaryLabel="הצטרפות גן ילדים"
          secondaryHref="/safety-standard"
          secondaryLabel="על תהליך הבקרה"
        />

        <MarketingSection eyebrow="היום־יום בגן" title="מה כוללת מערכת לניהול גן ילדים?" subtitle="המידע מוצג רק לבעלי הרשאה מתאימה; כל גן מפעיל את התהליכים המתאימים לו.">
          <div className="grid cols-3 feature-grid">
            <MarketingCard icon={ClipboardCheck} title="רישום וקליטת ילדים" text="פרטי הרשמה, קבוצות גיל, מסמכים והמשך תהליך ההצטרפות במקום אחד." />
            <MarketingCard icon={FileText} title="כרטיס ילד דיגיטלי" text="מידע חיוני כגון אלרגיות, רגישויות, אנשי קשר והערות צוות רלוונטיות, לפי תפקיד והרשאה." />
            <MarketingCard icon={UsersRound} title="צוות ותפעול" text="משימות, נוכחות, משמרות, מסמכים והכשרות כדי לצמצם חוסרים בעבודה השוטפת." />
            <MarketingCard icon={HeartHandshake} title="פלטפורמת הורים" text="עדכונים, הודעות ומסמכים בערוץ מסודר, בלי לחשוף מידע של משפחות אחרות." />
            <MarketingCard icon={ShieldCheck} title="ביקורת ומעקב תיקון" text="ממצא יכול להפוך למשימה עם אחראי, מועד ובדיקת תיקון; ביקורת מוצגת רק אם בוצעה ותועדה." />
          </div>
        </MarketingSection>

        <MarketingSection eyebrow="ניהול מול פיקוח" title="איך הכלים עוזרים לבקרה ופיקוח לגני ילדים?" subtitle="רישום מסודר אינו תו תקן בפני עצמו. הערך נוצר כשבודקים מידע, מזהים פערים, מטפלים בהם ומאמתים את התיקון.">
          <p>מנהלת הגן והצוות רואים את המידע הדרוש לעבודתם; מפקח ייעודי, כאשר שובץ לגן, יכול לבדוק ממצאים במסגרת הרשאותיו ולתעד ביקורת. המודל של גן בטוח כולל תכנון ביקורות חודשיות וקשר שוטף, אך אין להסיק שכל גן כבר נבדק או קיבל ציון איכות.</p>
          <p>ממשק המצלמות והחיבור האפשרי ל<Link href="/digital-observer">תצפיתן דיגיטלי</Link> הם מסלול נפרד של התאמה, בדיקות והרשאות. תצפיתן דיגיטלי הוא מוצר עצמאי לבית ולעסק; שילובו בגן אינו תנאי להתחלת ניהול הגן ואינו מחליף מפקח או אחריות אנושית.</p>
          <p>קראו על <Link href="/safety-standard">תו התקן הפרטי ותהליך הפיקוח</Link> ועל <Link href="/parent-portal">פורטל ההורים</Link>. התו הפרטי אינו רישוי ממשלתי או תעודה של מכון התקנים.</p>
        </MarketingSection>

        <MarketingSection eyebrow="שאלות נפוצות" title="מה כדאי לברר לפני שמצטרפים?">
          <div className="grid cols-2 feature-grid">
            <div><h3>האם חייבים מצלמות כדי לנהל את הגן?</h3><p>לא. רישום, כרטיסי ילדים, צוות, הורים ומסמכים הם תהליכים נפרדים. חיבור מצלמות מחייב בדיקות התאמה והרשאות.</p></div>
            <div><h3>האם כל גן במערכת הוא גן מפוקח?</h3><p>לא. יש לבדוק אם שובץ מפקח, מתי בוצעה ביקורת בפועל ומהו הסטטוס המאומת של הגן.</p></div>
          </div>
        </MarketingSection>

        <ConversionBand title="רוצים לראות את המערכת על תהליכי הגן שלכם?" text="אפשר להתחיל בהדגמה של ניהול הגן ולברר בנפרד התאמה למסלול הבקרה והפיקוח." href="/book-demo" label="קביעת הדגמה" />
      </main>
    </>
  );
}
