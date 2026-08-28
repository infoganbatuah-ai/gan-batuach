import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, Eye, FileText, Headphones, LockKeyhole, ShieldCheck, Trash2, UserCheck } from "lucide-react";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";

export const metadata: Metadata = {
  title: { absolute: "פרטיות, אמון ותמיכה | תצפיתן דיגיטלי" },
  description: "כללי הגישה למצלמות, שמירת אירועים, AI, מחיקת מידע ותמיכת התצפיתן הדיגיטלי."
};

export default function DigitalObserverTrustPage() {
  return (
    <main className="do-public do-trust-page" dir="rtl">
      <header className="do-public-header">
        <Link className="do-auth-brand dark" href="/digital-observer"><ObserverMark /><span><b>תצפיתן דיגיטלי</b><small>פרטיות, שליטה ואחריות</small></span></Link>
        <nav><Link href="#privacy">פרטיות</Link><Link href="#terms">תנאי שימוש</Link><Link href="#support">תמיכה</Link></nav>
        <div><Link className="do-button secondary" href="/digital-observer/login">התחברות</Link><Link className="do-button primary" href="/digital-observer/register">יצירת חשבון</Link></div>
      </header>

      <section className="do-pricing-head">
        <span className="do-badge info">שליטה לפני אוטומציה</span>
        <h1>המצלמות והמידע נשארים בשליטת המשתמש</h1>
        <p>התצפיתן מציג זיהויים כהערכות לבדיקה. הוא אינו מבטיח מניעת אירועים, אינו מוקד חירום ואינו מפעיל יכולות רגישות בלי הגדרה והסכמה מתאימות.</p>
      </section>

      <section className="do-public-use" id="privacy">
        <div><LockKeyhole /><span>גישה מאובטחת</span><h2>סודות אינם מגיעים לדפדפן</h2><p>כתובות RTSP, סיסמאות מצלמה ומפתחות ספק נשמרים בשכבת שרת מאובטחת. צפייה עתידית תשתמש באסימון קצר-חיים ובתיעוד גישה.</p><ul><li><ShieldCheck /> הפרדת משתמשים ואתרים ב-RLS</li><li><Eye /> הרשאה לפי אתר ותפקיד</li><li><FileText /> audit לפעולות רגישות</li></ul></div>
        <div><UserCheck /><span>AI אחראי</span><h2>זיהוי אינו קביעה מוחלטת</h2><p>אירוע כולל רמת ביטחון ודורש בדיקה אנושית כאשר הוא רגיש. זיהוי פנים מחייב הסכמה ואינו משותף בין לקוחות.</p><ul><li><BellRing /> אין האשמה אוטומטית</li><li><UserCheck /> אנשים מוכרים רק בהסכמה</li><li><Trash2 /> מחיקה ושמירה לפי מדיניות</li></ul></div>
      </section>

      <section className="do-panel do-trust-panel" id="terms">
        <div className="do-section-head"><div><h2>כללי שימוש ושמירת מידע</h2><p>המסמכים המלאים עדיין דורשים סקירה משפטית חיצונית לפני הפעלה ציבורית.</p></div><span className="do-badge warn">טיוטה לבדיקה משפטית</span></div>
        <div className="do-trust-grid">
          <article><strong>שמירת אירועים</strong><p>מקטעים נשמרים לפי החבילה ועד 48 שעות במוצר זה. עותק שהורד למכשיר נשאר באחריות המשתמש.</p></article>
          <article><strong>מחיקת חשבון</strong><p>בקשת מחיקה, ייצוא או הגבלת עיבוד זמינה מתוך ההגדרות ונבדקת בתהליך מבוקר ומתועד.</p></article>
          <article><strong>התראות</strong><p>Push, Email, SMS, WhatsApp ושיחות מופעלים רק דרך ספק מאושר והסכמה מתאימה. בדמו אין שליחה אמיתית.</p></article>
          <article><strong>חירום</strong><p>התצפיתן הדיגיטלי אינו מוקד חירום. במקרה חירום יש לפנות מיד לגורמי החירום הרלוונטיים.</p></article>
        </div>
      </section>

      <section className="do-public-trust" id="support">
        <Headphones />
        <div><h2>עזרה ותמיכה</h2><p>לפני חיבור מצלמה אמיתית יש לתאם סביבת Sandbox, בעל תפקיד לתמיכה ובעל תפקיד לאירועי פרטיות ואבטחה. אין להעלות סיסמה או כתובת מצלמה בטופס ציבורי.</p></div>
        <Link className="do-button secondary light" href="/digital-observer/dashboard">פתיחת מרכז המוצר</Link>
      </section>

      <footer className="do-public-footer"><ObserverMark compact /><strong>תצפיתן דיגיטלי</strong><span>מוצר עצמאי לבית ולעסק</span><nav><Link href="/digital-observer">בית</Link><Link href="/digital-observer/pricing">חבילות</Link><Link href="/digital-observer/login">התחברות</Link></nav></footer>
    </main>
  );
}
