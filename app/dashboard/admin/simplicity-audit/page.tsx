import Link from "next/link";
import { CheckCircle2, MousePointerClick, ShieldCheck, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

const checks = [
  { role: "מנהלת / בעלים", question: "האם ברור תוך 3 שניות מה דורש טיפול?", status: "עבר", href: "/dashboard/garden" },
  { role: "מנהלת / צוות", question: "האם עדכון ילד יומי מתבצע ב-1-2 לחיצות?", status: "עבר", href: "/dashboard/garden/children" },
  { role: "צוות", question: "האם מוסתרים כספים ואנליטיקות מורכבות?", status: "עבר", href: "/dashboard/staff" },
  { role: "הורה", question: "האם השפה רגועה ולא טכנית?", status: "עבר", href: "/dashboard/parent" },
  { role: "כללי", question: "האם מצבים ריקים מסבירים מה לעשות עכשיו?", status: "במעקב", href: "/dashboard/admin/navigation-health" },
  { role: "כללי", question: "האם פעולה מתוך הקשר לא מבקשת לבחור ילד/הורה שוב?", status: "במעקב", href: "/dashboard/garden/children" }
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
                <small>{check.question}</small>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel"><ShieldCheck /><h2>3 שניות להבנה</h2><p>דשבורדים מרכזיים מציגים Command Center לפני טבלאות וניתוחים.</p></article>
        <article className="card action-panel"><MousePointerClick /><h2>2 לחיצות לפעולה</h2><p>כרטיס ילד כולל צ׳יפים מהירים לנוכחות, אוכל, שינה, מצב רוח ובגדים.</p></article>
        <article className="card action-panel"><Sparkles /><h2>שפה רגועה להורים</h2><p>הורה רואה עדכונים, תמונות, מסמכים והודעות בלי מונחים טכניים.</p></article>
      </section>
    </DashboardShell>
  );
}
