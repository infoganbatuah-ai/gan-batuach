import { AlertTriangle, CheckCircle2, ClipboardList, MessageSquareText, Rocket, TrendingUp, Users } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const readinessCards = [
  { key: "onboarding", title: "מוכנות קליטה", description: "כמה משתמשים השלימו צעדי התחלה.", score: 76 },
  { key: "usability", title: "מוכנות שימוש", description: "כמה משובים חיוביים מול מבלבלים.", score: 72 },
  { key: "mobile", title: "מוכנות מובייל", description: "בדיקה ידנית ב־360/390/414px.", score: 84 },
  { key: "observer", title: "מוכנות תצפיתן", description: "מצלמות, אירועים לבדיקה ושפה רגועה.", score: 68 },
  { key: "operations", title: "מוכנות תפעולית", description: "ילדים, צוות, כספים ופיקוח.", score: 79 }
];

const frictionPoints = [
  "קליטה שלא הושלמה אחרי כניסה ראשונה",
  "מסכים שנפתחו כמה פעמים ללא פעולה",
  "מצלמות שאושרו אבל עדיין ממתינות לחיבור",
  "טפסים ארוכים שהמשתמש עזב באמצע",
  "פיצ׳רים חשובים שלא נפתחו בשבוע הראשון"
];

function tone(score: number): "good" | "warn" | "bad" {
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  return "bad";
}

export default async function PilotReadinessPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const [feedbackRes, openFeedbackRes, onboardingRes, activeUsersRes] = await Promise.all([
    supabase.from("pilot_feedback" as any).select("id, user_role, category, sentiment, rating, status, severity, comment, page_path, created_at").order("created_at", { ascending: false }).limit(40),
    supabase.from("pilot_feedback" as any).select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    supabase.from("onboarding_progress" as any).select("id, setup_completed, progress_percent", { count: "exact" }),
    supabase.from("profiles" as any).select("id", { count: "exact", head: true }).eq("active", true)
  ]);

  const feedbackRows = (feedbackRes.data ?? []) as any[];
  const categoryCounts = feedbackRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.category] = (acc[row.category] ?? 0) + 1;
    return acc;
  }, {});
  const easyCount = feedbackRows.filter((row) => row.sentiment === "easy").length;
  const confusingCount = feedbackRows.filter((row) => row.sentiment === "confusing").length;
  const completedOnboarding = ((onboardingRes.data ?? []) as any[]).filter((row) => row.setup_completed || Number(row.progress_percent ?? 0) >= 100).length;
  const onboardingTotal = onboardingRes.count ?? ((onboardingRes.data ?? []) as any[]).length;
  const onboardingPercent = onboardingTotal ? Math.round((completedOnboarding / onboardingTotal) * 100) : 0;
  const averageReadiness = Math.round(readinessCards.reduce((sum, item) => sum + item.score, 0) / readinessCards.length);

  return (
    <DashboardShell role="admin" title="מוכנות פיילוט">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">מוכנות פיילוט</p>
          <h1>מוכנות לפיילוט אמיתי.</h1>
          <p>מעקב פנימי אחרי קליטה, שימוש, משוב, חסמים וחוויית מובייל לפני פתיחה רחבה יותר.</p>
        </div>
        <span className={averageReadiness >= 80 ? "pill good" : "pill warn"}><Rocket size={16} /> ציון מוכנות {averageReadiness}%</span>
      </div>

      <div className="grid cols-4 dashboard-kpis">
        <StatCard label="משתמשים פעילים" value={activeUsersRes.count ?? 0} tone="good" />
        <StatCard label="השלמת קליטה" value={`${onboardingPercent}%`} tone={onboardingPercent >= 70 ? "good" : "warn"} />
        <StatCard label="משובים פתוחים" value={openFeedbackRes.count ?? 0} tone={(openFeedbackRes.count ?? 0) ? "warn" : "good"} />
        <StatCard label="קל מול מבלבל" value={`${easyCount}/${confusingCount}`} tone={confusingCount > easyCount ? "warn" : "good"} />
      </div>

      <section className="dashboard-section">
        <div className="section-heading"><h2>מדדי מוכנות פנימיים</h2><p>ציונים ראשוניים לפיילוט. חלק מהמדדים הם בסיס ראשוני עד חיבור אנליטיקה פנימית מלאה.</p></div>
        <div className="grid cols-5 pilot-readiness-grid">
          {readinessCards.map((item) => (
            <article className={`card pilot-score-card ${tone(item.score)}`} key={item.key}>
              <strong>{item.score}%</strong>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <i><b style={{ width: `${item.score}%` }} /></i>
            </article>
          ))}
        </div>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><MessageSquareText size={20} /> קטגוריות משוב נפוצות</h2><p>מה משתמשי הפיילוט מסמנים כקל, מבלבל או חסר.</p></div>
          {Object.keys(categoryCounts).length === 0 ? <div className="empty-state"><strong>עדיין אין משוב פיילוט</strong><span>כאשר משתמשים ישלחו משוב מהדשבורד, הקטגוריות יופיעו כאן.</span></div> : <div className="risk-list">{Object.entries(categoryCounts).map(([category, count]) => <div key={category}><ClipboardList /> {category}<b>{count}</b></div>)}</div>}
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><AlertTriangle size={20} /> נקודות חיכוך למעקב</h2><p>רשימת בדיקה לפיילוט, בלי ספקי מעקב חיצוניים.</p></div>
          <div className="procedure-list">{frictionPoints.map((item) => <div className="list-item" key={item}><span>{item}</span><span className="pill warn">לבדיקה</span></div>)}</div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2><Users size={20} /> משובים אחרונים</h2><p>פתוחים, בטיפול ופתורים. קריטי/גדול/קטן משמשים כחסמי השקה פנימיים.</p></div>
        {feedbackRows.length === 0 ? <div className="empty-state"><strong>אין משובים להצגה</strong><span>כפתור המשוב בדשבורדים יאסוף משובים מהורים, מנהלות, צוות ומפקחים.</span></div> : <div className="procedure-list">{feedbackRows.map((item) => (
          <article className="card procedure-card" key={item.id}>
            <div>
              <span className={item.severity === "critical" ? "pill bad" : item.severity === "major" ? "pill warn" : "pill good"}>{item.severity === "critical" ? "קריטי" : item.severity === "major" ? "גדול" : "קטן"}</span>
              <h3>{item.user_role} · {item.category}</h3>
              <p>{item.comment || (item.sentiment === "easy" ? "סומן כקל לשימוש" : item.sentiment === "confusing" ? "סומן כמבלבל" : "משוב ללא פירוט")}</p>
            </div>
            <div className="procedure-meta">
              <span className={item.status === "resolved" ? "pill good" : "pill warn"}>{item.status}</span>
              <span>{item.page_path ?? "ללא מסך"}</span>
              <span>{item.created_at ? new Date(item.created_at).toLocaleDateString("he-IL") : ""}</span>
            </div>
          </article>
        ))}</div>}
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel"><CheckCircle2 /><h2>קריטריון השקה</h2><p>אין חסמים קריטיים פתוחים, רוב המשתמשים השלימו קליטה, ומובייל נבדק ידנית.</p></article>
        <article className="card action-panel"><TrendingUp /><h2>אימוץ שימוש</h2><p>המעקב יתמקד בכניסה ראשונה, פעולות יומיות, מצלמות, הודעות וקליטת ילדים.</p></article>
        <article className="card action-panel"><MessageSquareText /><h2>משוב איכותני</h2><p>כל תפקיד יכול לשלוח משוב קצר בלי לצאת מהמסך.</p></article>
      </section>
    </DashboardShell>
  );
}
