import { CheckCircle2, Route, ShieldAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

const journeys = [
  {
    role: "Parent",
    items: [
      ["הרשמה מכרטיס גן ציבורי", "/join-parent", "נוצר ליד לגן", "בינוני"],
      ["השלמת פרטי ילד", "/parent-onboarding", "התראה למנהלת", "נמוך"],
      ["צפייה בילד פעיל", "/dashboard/parent", "כרטיס ילד וגן", "נמוך"],
      ["פנייה לגן", "/dashboard/parent/messages", "ניתוב לפי נמען", "בינוני"],
      ["מצלמות", "/dashboard/parent/cameras", "הרשאה לפי גן", "נמוך"],
      ["העברה/רישום לגן נוסף", "/dashboard/parent#add-child-request", "בקשת מעבר/קליטה", "בינוני"]
    ]
  },
  {
    role: "Manager / Owner",
    items: [
      ["אישור לידים", "/dashboard/garden/leads", "יוצר הורה פעיל וילד להשלמה", "נמוך"],
      ["אישור ילדים", "/dashboard/garden/children?status=pending", "ילד הופך פעיל", "נמוך"],
      ["הורים פעילים", "/dashboard/garden/parents", "פרטי כניסה וילדים", "נמוך"],
      ["כספים", "/dashboard/garden/finance", "מסנני overdue/failed", "בינוני"],
      ["מצלמות", "/dashboard/garden/cameras", "Gateway או pending", "בינוני"],
      ["סגירת יום", "/dashboard/garden", "צ׳קליסט יומי", "בינוני"]
    ]
  },
  {
    role: "Staff",
    items: [
      ["כניסה ראשונה והשלמת פרופיל", "/dashboard/staff/settings", "פרטים ותמונה", "נמוך"],
      ["עדכון יומי לילד", "/dashboard/staff/child-journal", "פעולות מהירות", "בינוני"],
      ["דיווח אירוע", "/dashboard/staff/tasks", "משימות/אירועים", "בינוני"],
      ["מסמכים", "/dashboard/staff/documents", "העלאה וסטטוס", "נמוך"]
    ]
  },
  {
    role: "Inspector",
    items: [
      ["גנים משויכים", "/dashboard/inspector", "רק לפי שיוך", "נמוך"],
      ["פיקוחים", "/dashboard/inspector/inspections", "היסטוריה וביצוע", "בינוני"],
      ["מצלמות", "/dashboard/inspector/cameras", "רק גנים משויכים", "נמוך"],
      ["ליקויים", "/dashboard/inspector/violations", "טיפול ומעקב", "בינוני"]
    ]
  },
  {
    role: "Admin",
    items: [
      ["ניהול משתמשים", "/dashboard/admin/users", "עריכה, איפוס, סטטוס", "נמוך"],
      ["גנים", "/dashboard/admin/kindergartens", "ספרייה ופעולות", "נמוך"],
      ["בריאות מערכת", "/dashboard/admin/system-health", "חוסרים וסיכונים", "בינוני"],
      ["Audit logs", "/dashboard/admin/audit-logs", "מעקב פעולות", "נמוך"],
      ["התראות", "/dashboard/admin/notifications", "מרכז כללי", "נמוך"]
    ]
  }
];

export default async function UserJourneyAuditPage() {
  await requireRole(["admin"]);
  return (
    <DashboardShell role="admin" title="User Journey Audit">
      <div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Internal QA</p><h1>בדיקת מסעות משתמש מרכזיים.</h1><p>רשימת בקרת מוצר: route קיים, פעולה ראשית, next action, התראה ורמת סיכון.</p></div><span className="pill warn"><ShieldAlert size={15} /> QA פנימי</span></div>
      <section className="dashboard-section">
        <div className="journey-audit-grid">
          {journeys.map((group) => (
            <article className="card action-panel" key={group.role}>
              <h2>{group.role}</h2>
              <div className="procedure-list">
                {group.items.map(([title, href, next, risk]) => (
                  <div className="list-item" key={title}>
                    <div><strong><Route size={15} /> {title}</strong><span>{href} · Next: {next}</span></div>
                    <span className={risk === "נמוך" ? "pill good" : "pill warn"}><CheckCircle2 size={14} /> {risk}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
