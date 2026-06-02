import Link from "next/link";
import { CheckCircle2, MousePointerClick, ShieldCheck, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

const checks = [
  { role: "מנהלת / בעלים", question: "האם ברור תוך 3 שניות מה דורש טיפול עכשיו?", status: "עבר", metric: "0 חיפוש", href: "/dashboard/garden" },
  { role: "מנהלת / בעלים", question: "האם כל כרטיס דחוף מוביל להקשר מסונן ולא לעמוד כללי?", status: "עבר", metric: "טפל עכשיו", href: "/dashboard/garden" },
  { role: "מנהלת / צוות", question: "האם עדכון ילד יומי מתבצע ב-1-2 לחיצות?", status: "עבר", metric: "1 קליק", href: "/dashboard/garden/children" },
  { role: "צוות", question: "האם מצב יד אחת מאפשר עדכון ילד בלי טפסים?", status: "עבר", metric: "עד 10 שניות", href: "/dashboard/staff" },
  { role: "צוות", question: "האם מוסתרים כספים, אנליטיקות וכלים ניהוליים?", status: "עבר", metric: "ללא רעש", href: "/dashboard/staff" },
  { role: "הורה", question: "האם המסך עונה מיד מה קורה עם הילד היום?", status: "עבר", metric: "ילד לפני widgets", href: "/dashboard/parent" },
  { role: "הורה", question: "האם אין שפה טכנית כמו Token/RLS/Gateway במסך הבית?", status: "עבר", metric: "עברית רגועה", href: "/dashboard/parent" },
  { role: "כללי", question: "האם widgets משניים קורסים בעמודים פנימיים?", status: "עבר", metric: "compact", href: "/dashboard/garden/children" },
  { role: "כללי", question: "האם מצבים ריקים מסבירים מה לעשות עכשיו?", status: "במעקב", metric: "צריך QA ידני", href: "/dashboard/admin/navigation-health" },
  { role: "כללי", question: "האם נשארו כפתורים מתים או פעולות בלי שמירה/ניווט?", status: "במעקב", metric: "סריקה ידנית", href: "/dashboard/admin/navigation-health" }
];

export default async function SimplicityAuditPage() {
  await requireRole(["admin"]);

  return (
    <DashboardShell role="admin" title="Simplicity Audit">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Kindergarten Simplicity QA</p>
          <h1>בדיקת פשטות שימוש למנהלת, צוות והורים.</h1>
          <p>המדד: פחות חיפוש, פחות בחירות כפולות, יותר פעולה ברורה ומהירה.</p>
        </div>
        <span className="pill good"><Sparkles size={15} /> עוזר תפעולי</span>
      </div>

      <section className="simple-command-center">
        <div className="section-heading">
          <div>
            <h2>מדדי הצלחה פנימיים</h2>
            <p>כל בדיקה מקשרת למסך שבו ניתן לאמת את החוויה בפועל.</p>
          </div>
          <span className="pill good">QA פנימי</span>
        </div>
        <div className="simple-command-grid">
          {checks.map((check) => (
            <Link className={check.status === "עבר" ? "simple-command-card good" : "simple-command-card warn"} href={check.href} key={check.question}>
              {check.status === "עבר" ? <CheckCircle2 size={22} /> : <MousePointerClick size={22} />}
              <div>
                <strong>{check.status}</strong>
                <span>{check.role}</span>
                <small>{check.question} · {check.metric}</small>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel"><ShieldCheck /><h2>3 שניות להבנה</h2><p>דשבורדים מרכזיים פותחים במה שדורש טיפול, לא ברשימת מודולים.</p></article>
        <article className="card action-panel"><MousePointerClick /><h2>2 לחיצות לפעולה</h2><p>כרטיס ילד כולל הגיע/נעדר/אכל/לא אכל/ישן/לא ישן/שמח/עייף/חסר בגדים.</p></article>
        <article className="card action-panel"><Sparkles /><h2>עומס מסכים</h2><p>מסכי צוות והורה מציגים רק מידע יומי. מידע משני עובר לקיפול או לתפריט.</p></article>
        <article className="card action-panel"><MousePointerClick /><h2>כפילויות widgets</h2><p>Command Center נשאר מורחב רק בבית הדשבורד וקורס בעמודים פנימיים.</p></article>
        <article className="card action-panel"><Sparkles /><h2>כפתורים מתים</h2><p>כל פעולה יומית היא שמירה, ניווט מסונן או כפתור מוסבר. המשך בדיקה ב-Navigation Health.</p></article>
        <article className="card action-panel"><ShieldCheck /><h2>מצבים ריקים</h2><p>המדד הבא: כל מסך ריק צריך להסביר מה חסר ומה עושים עכשיו.</p></article>
      </section>
    </DashboardShell>
  );
}
