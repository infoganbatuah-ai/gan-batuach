import Link from "next/link";
import { ArrowLeft, Bell, BrainCircuit, Building2, Camera, Check, FileSearch, Home, LockKeyhole, Radar, ShieldCheck } from "lucide-react";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";
import { digitalObserverMetadata } from "@/lib/seo/digital-observer-metadata";

export const metadata = digitalObserverMetadata(
  "/digital-observer",
  "תצפיתן דיגיטלי | ניטור מצלמות לבית ולעסק",
  "תצפיתן דיגיטלי הוא מוצר עצמאי לניטור מצלמות לבית ולעסק: חיבור מקורות וידאו, אירועים לבדיקה, ניתוח וידאו מבוקר וחקירת אירועים בהרשאה."
);

const productSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "תצפיתן דיגיטלי",
  url: "https://ganbatuach.com/digital-observer",
  applicationCategory: "SecurityApplication",
  operatingSystem: "Web",
  description: "מוצר עצמאי לניטור מצלמות לבית ולעסק, ניהול אירועים וניתוח וידאו לבדיקה אנושית.",
  publisher: { "@type": "Organization", name: "גן בטוח", url: "https://ganbatuach.com" },
};

export default function DigitalObserverPublicPage() {
  return <main className="do-public" dir="rtl">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
    <header className="do-public-header"><Link className="do-auth-brand dark" href="/digital-observer"><ObserverMark /><span><b>תצפיתן דיגיטלי</b><small>מצלמות חכמות, החלטות אנושיות</small></span></Link><nav aria-label="ניווט ראשי"><Link href="#how">איך זה עובד</Link><Link href="#uses">לבית ולעסק</Link><Link href="/digital-observer/video-investigation">חקירת וידאו</Link><Link href="/digital-observer/guides">מדריכים</Link><Link href="/digital-observer/pricing">מחירים</Link><Link href="/digital-observer/trust">פרטיות ואמון</Link></nav><div><Link className="do-button secondary" href="/digital-observer/login">התחברות</Link><Link className="do-button primary" href="/digital-observer/register">יצירת חשבון</Link></div></header>
    <section className="do-public-hero">
      <div className="do-public-hero-copy"><span className="do-badge info">מוצר עצמאי לבית ולעסק</span><h1>התצפיתן הדיגיטלי</h1><h2>עוזר לכם להבין מה קורה, בלי לצפות כל הזמן בעצמכם.</h2><p>חברו מצלמות, הגדירו למה לשים לב וקבלו אירועים מדורגים לבדיקה. כל זיהוי הוא המלצה עם רמת ביטחון, לא קביעה מוחלטת.</p><div className="do-button-row"><Link className="do-button primary" href="/digital-observer/register?type=home">התחלה לבית <ArrowLeft /></Link><Link className="do-button secondary light" href="/digital-observer/register?type=business">התחלה לעסק</Link></div></div>
      <div className="do-public-status"><ShieldCheck /><div><strong>שליטה ופרטיות</strong><span>שער מצלמות מאובטח</span><span>ביקורת אנושית</span><span>שמירה עד 48 שעות</span></div></div>
    </section>
    <section className="do-public-band" id="how"><header><span>פשוט להתחיל</span><h2>שלושה צעדים ממקום למעקב חכם</h2></header><div className="do-grid cols-3"><article><b>1</b><Camera /><h3>חיבור מקור</h3><p>מצלמת IP, NVR/DVR, ONVIF, RTSP, ספק ענן או Edge Gateway.</p></article><article><b>2</b><Radar /><h3>הגדרת מה לנטר</h3><p>אדם, בעל חיים, כניסה, שעות פעילות, אזור מוגבל או כלל מותאם.</p></article><article><b>3</b><Bell /><h3>קבלת אירוע שימושי</h3><p>התראה מדורגת, snapshot או מקטע וידאו, וביקורת אנושית לפני פעולה.</p></article></div></section>
    <section className="do-public-use" id="uses"><div><Home /><span>לבית</span><h2>ממשק רגוע למשפחה</h2><p>כניסה, סלון, חצר, תינוק, ילדים ובעלי חיים. אפשר להגדיר שעות שקטות, אנשים מוכרים ושיתוף משפחתי מבוקר.</p><ul><li><Check /> התראות In-app ו-Push במוכנות</li><li><Check /> צפייה חיה רק דרך Gateway מאושר</li><li><Check /> אין מונחים טכניים עד בחירה בהגדרה מתקדמת</li></ul><Link className="do-button primary" href="/digital-observer/register?type=home">חשבון ביתי</Link></div><div><Building2 /><span>לעסק</span><h2>שליטה באתרים ובצוות</h2><p>מספר סניפים, שעות פעילות, אזורים רגישים, הרשאות, אירועים פתוחים ודוחות תפעוליים.</p><ul><li><Check /> הפרדה בין אתרים וארגונים</li><li><Check /> כללים לפי מצלמה, אזור ונמען</li><li><Check /> תמחור ומגבלות מנוהלים באדמין</li></ul><Link className="do-button primary" href="/digital-observer/register?type=business">חשבון עסקי</Link></div></section>
    <section className="do-public-band"><header><span>לכל צורך עמוד ברור</span><h2>תצפיתן לבית פרטי, תצפיתן לעסקים וחקירת וידאו</h2><p>כל מסלול מתחיל בשאלה אחרת: מה חשוב למשפחה, מה חשוב לתפעול עסק, ואיך בודקים אירוע מצולם באופן מדויק ומורשה. אלה עמודי מוצר נפרדים ממערכת הניהול של גן בטוח.</p></header><div className="do-grid cols-3"><article><Home /><h3>בית פרטי</h3><p>שליטה בהרשאות ובשעות ניטור, בלי להפוך כל תנועה לאזעקה.</p><Link href="/digital-observer/home">תצפיתן לבית פרטי</Link></article><article><Building2 /><h3>עסק ומספר אתרים</h3><p>בריאות מצלמות, כללים לפי אתר ובדיקת פעילות מחוץ לשעות.</p><Link href="/digital-observer/business">תצפיתן לעסקים</Link></article><article><Radar /><h3>בדיקת אירוע</h3><p>מסדרים את הזמן, מקור הווידאו והראיות לפני שמסיקים מסקנה.</p><Link href="/digital-observer/video-investigation">ניתוח וחקירת וידאו</Link></article></div></section>
    <section className="do-public-band"><header><span>לא עוד מסך מצלמות</span><h2>מנוע שמפריד בין קליטה, ניתוח, כללים והתראות</h2></header><div className="do-grid cols-4"><article><Camera /><h3>מחברי מצלמות</h3><p>שכבת התאמה לסוגי מצלמה ולספקים שונים.</p></article><article><BrainCircuit /><h3>AI במצב צל</h3><p>אובייקט, אדם, תנועה, התנהגות ושינוי מצב, עם רמת ביטחון.</p></article><article><Radar /><h3>מנוע כללים</h3><p>הפיכת “שים לב ל...” לכלל מובנה ובר-ביקורת.</p></article><article><Bell /><h3>מרכז התראות</h3><p>התראות באפליקציה, Push, דוא״ל וספקי חוץ דרך מחברים נפרדים.</p></article></div></section>
    <section className="do-public-trust"><LockKeyhole /><div><h2>הפרטיות אינה קישוט בממשק</h2><p>פרטי מצלמה אינם מגיעים לדפדפן; המדיה פרטית; אתרים מופרדים ב-RLS; ואין הפעלה של זיהוי פנים ללא הסכמה מפורשת.</p></div><Link className="do-button secondary light" href="/digital-observer/trust">מרכז פרטיות ואמון</Link></section>
    <section className="do-public-band"><header><span>ידע לפני החלטה</span><h2>מדריכים לתכנון מצלמות וניטור אחראי</h2><p>שאלות מעשיות לבית, לעסק ולמי שצריך לבדוק אירוע וידאו, עם מקורות רשמיים והבחנה בין יכולות פעילות לבין חזון המוצר.</p></header><div className="do-grid cols-3"><article><Home /><h3>מצלמות לבית</h3><p>מיקום, הרשאות, אבטחה ופרטיות המשפחה.</p><Link href="/digital-observer/guides/observer-home-cameras">למדריך הבית</Link></article><article><Building2 /><h3>ניטור בעסק</h3><p>התראות שימושיות לצד פרטיות עובדים.</p><Link href="/digital-observer/guides/observer-business-cameras">למדריך העסק</Link></article><article><FileSearch /><h3>חקירת וידאו</h3><p>מקור, רצף, תיעוד ומסקנות אחראיות.</p><Link href="/digital-observer/guides/observer-video-investigation">למדריך החקירה</Link></article></div></section>
    <footer className="do-public-footer"><ObserverMark compact /><strong>תצפיתן דיגיטלי</strong><span>מוצר עצמאי. חיבור עתידי לגן בטוח יבוצע דרך API מאובטח בלבד.</span><nav><Link href="/digital-observer/guides">מדריכים</Link><Link href="/digital-observer/trust#privacy">פרטיות</Link><Link href="/digital-observer/trust#terms">תנאים</Link><Link href="/digital-observer/trust#support">תמיכה</Link></nav></footer>
  </main>;
}
