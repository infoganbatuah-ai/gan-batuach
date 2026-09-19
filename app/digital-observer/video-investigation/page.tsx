import Link from "next/link";
import { Clock3, FileSearch, LockKeyhole, Radar, ShieldCheck } from "lucide-react";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";
import { digitalObserverMetadata } from "@/lib/seo/digital-observer-metadata";

export const metadata = digitalObserverMetadata(
  "/digital-observer/video-investigation",
  "חקירת וידאו וניתוח אירועים | תצפיתן דיגיטלי",
  "מה כוללת חקירת וידאו אחראית? איתור חלון זמן, בדיקת מקור מצלמה, ניתוח אירועים, סקירה אנושית ותיעוד גישה — לבית פרטי ולעסק, בהתאם למוכנות החיבור."
);

export default function VideoInvestigationPage() {
  return (
    <main className="do-public" dir="rtl">
      <header className="do-public-header">
        <Link className="do-auth-brand dark" href="/digital-observer"><ObserverMark /><span><b>תצפיתן דיגיטלי</b><small>ניתוח וחקירת וידאו</small></span></Link>
        <nav aria-label="ניווט ראשי"><Link href="/digital-observer">המוצר</Link><Link href="/digital-observer/home">לבית</Link><Link href="/digital-observer/business">לעסקים</Link><Link href="/digital-observer/trust">פרטיות ואמון</Link></nav>
        <div><Link className="do-button secondary" href="/digital-observer/request-demo">בקשת הדגמה</Link></div>
      </header>

      <section className="do-pricing-head">
        <span className="do-badge info">מדריך מוצר</span>
        <h1>חקירת וידאו מתחילה בשאלה, לא במסקנה אוטומטית</h1>
        <p>כשצריך להבין מה קרה בבית או בעסק, צפייה ארוכה בכל ההקלטה אינה תמיד מועילה. תהליך מסודר מצמצם את חלון הזמן, בודק את מקור הווידאו ומבדיל בין אות ראשוני לבין אירוע שאומת בידי אדם מורשה.</p>
      </section>

      <section className="do-public-band">
        <header><span>מתצפית לבדיקה</span><h2>ארבעה צעדים לניתוח אירוע מצולם</h2></header>
        <div className="do-grid cols-4">
          <article><Clock3 /><h3>הגדרת זמן ומקור</h3><p>מזהים מצלמה, אתר וחלון זמן רלוונטי לפני חיפוש. אין להניח שכל מקור וידאו מחובר או זמין.</p></article>
          <article><Radar /><h3>סינון אותות</h3><p>כלל ניטור או כלי ניתוח וידאו עשויים להציע אירוע לבדיקה; רמת ביטחון אינה הוכחה.</p></article>
          <article><FileSearch /><h3>סקירה אנושית</h3><p>בודקים הקשר, רצף זמנים ומידע נוסף. במקרה רגיש אין להסיק מסקנה על אדם רק מזיהוי אוטומטי.</p></article>
          <article><LockKeyhole /><h3>תיעוד והרשאות</h3><p>גישה למדיה ולממצאים ניתנת לפי תפקיד וצורך. שמירה ושיתוף כפופים למדיניות האתר ולדין החל.</p></article>
        </div>
      </section>

      <section className="do-public-use">
        <div><ShieldCheck /><span>לבית פרטי</span><h2>לבדוק בלי להציף את המשפחה</h2><p>חיפוש סביב שעה, מצלמה או אזור עשוי לעזור להבין אירוע נקודתי. הגדרות פרטיות, הרשאות וגישה מרחוק חשובות לא פחות מן הזיהוי עצמו.</p><Link className="do-button secondary" href="/digital-observer/home">תצפיתן לבית פרטי</Link></div>
        <div><FileSearch /><span>לעסק</span><h2>תמונה תפעולית עם מסלול בדיקה</h2><p>מספר אתרים ומצלמות מחייבים הקשר ברור: מי פתח אירוע, מה נבדק, ומה עדיין דורש אימות. אין להציג התראה כהוכחה לעבירה או כפסק דין.</p><Link className="do-button secondary" href="/digital-observer/business">תצפיתן לעסקים</Link></div>
      </section>

      <section className="do-public-band">
        <header><span>מוכנות המוצר</span><h2>מה זמין ומה עדיין דורש חיבור ובדיקה?</h2><p>לתצפיתן הדיגיטלי יש ממשקי אירועים וחקירה, אך יכולות צפייה, ניתוח והתראות בפועל תלויות במצלמה, ב־Gateway או Connector, בהרשאות ובהשלמת בדיקות. מנועי AI מסוימים עדיין במצב צל או פיתוח; אין להבטיח זיהוי מדויק, מניעת פגיעה או פעולה אוטונומית.</p></header>
        <p>גן בטוח, מערכת ניהול הגנים של אותה יוזמה, היא מוצר נפרד. חיבור אפשרי של כלי תצפיתן למצלמות גן ייבחן בעתיד במסלול התאמה ופרטיות ייעודי; הוא אינו חלק אוטומטי מחשבון ביתי או עסקי. <Link href="/kindergarten-management">למידע על מערכת ניהול הגן</Link>.</p>
      </section>

      <section className="do-public-band">
        <header><span>שאלות נפוצות</span><h2>לפני שמסתמכים על אירוע וידאו</h2></header>
        <div className="do-grid cols-3">
          <article><h3>האם ניתוח וידאו מחליף בדיקה אנושית?</h3><p>לא. אות או התראה עוזרים לתעדף בדיקה; ההקשר וההחלטה דורשים אדם מורשה.</p></article>
          <article><h3>האם כל מצלמה נתמכת?</h3><p>לא. התאימות תלויה בדגם, בפרוטוקול, ברשת ובדרך החיבור המאושרת.</p></article>
          <article><h3>האם התצפיתן הוא מוקד חירום?</h3><p>לא. במקרה חירום פונים ישירות לגורמי החירום המתאימים.</p></article>
        </div>
      </section>

      <section className="do-public-trust"><ShieldCheck /><div><h2>בודקים התאמה לפני הפעלה</h2><p>הדגמה יכולה להראות את זרימת העבודה בלי להפעיל מצלמה אמיתית או לחייב חשבון.</p></div><Link className="do-button secondary light" href="/digital-observer/request-demo">בקשת הדגמה</Link></section>
    </main>
  );
}
