import { Smartphone, CheckCircle2, AlertTriangle } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

const checks = [
  ["Parent mobile", "דשבורד הורה מציג ילד, גן, עדכונים ופעולות מהירות לפני ווידג׳טים משניים.", "working"],
  ["Garden mobile", "דשבורד מנהלת מתעדף זהות גן, מה דורש טיפול עכשיו, Live Day Flow ופעולות מהירות.", "working"],
  ["Staff one-hand", "ניווט תחתון ו־FAB מובילים ליומן ילד, אירוע ומשימות. כפתורים הוגדלו ל־44px ומעלה.", "working"],
  ["Inspector mobile", "ניווט תחתון ממוקד: בית, ביקורות, גנים, חריגות ועוד.", "working"],
  ["Cards over tables", "טבלאות נשברות לכרטיסים במובייל; רשימות ילדים/הורים/כספים/לידים משתמשות בכרטיסים.", "working"],
  ["Bottom nav", "הניווט התחתון מותאם לפי תפקיד ולא מציג תפריט עמוס.", "working"],
  ["Sticky actions", "כפתורי שליחה/שמירה מרכזיים בטפסים נשארים נגישים מעל הניווט התחתון.", "working"],
  ["No overflow", "נוספו כללי max-width/min-width ו־overflow למניעת גלילה אופקית.", "working"],
  ["Notifications", "פעמון התראות במובייל נפתח כגיליון תחתון רחב ונוח ללחיצה.", "working"],
  ["Camera view", "כרטיסי מצלמה ונגני וידאו מוגבלים לרוחב המסך עם יחס 16:9.", "working"],
  ["Manual device QA", "עדיין מומלץ לבדוק פיזית ב־360/390/414/768px עם משתמשים אמיתיים.", "needs_test"]
] as const;

export default async function MobileAuditPage() {
  await requireRole(["admin"]);
  const done = checks.filter(([, , status]) => status === "working").length;
  return (
    <DashboardShell role="admin" title="Mobile Audit">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Mobile First QA</p>
          <h1>בדיקת חוויית מובייל.</h1>
          <p>צ׳קליסט פנימי לוודא שהורה, מנהלת, צוות ומפקח מקבלים חוויה מהירה, ברורה ונוחה ביד אחת.</p>
        </div>
        <span className="pill good"><Smartphone size={16} /> {done}/{checks.length} מוכנים</span>
      </div>
      <section className="dashboard-section">
        <div className="people-card-grid">
          {checks.map(([title, text, status]) => (
            <article className="card action-panel mobile-audit-card" key={title}>
              <span className={status === "working" ? "pill good" : "pill warn"}>{status === "working" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {status === "working" ? "עובד" : "דורש בדיקה ידנית"}</span>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
