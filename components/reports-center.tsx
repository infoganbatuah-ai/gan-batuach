import { FileBarChart2 } from "lucide-react";

const reportDefinitions = [
  ["child_attendance", "דוח נוכחות ילדים", "היעדרויות, איחורים ויציאות מוקדמות"],
  ["staff_hours", "דוח שעות צוות", "כניסה/יציאה, חוסרים ואיחורים"],
  ["inspections", "דוח פיקוח", "ציונים, ליקויים וחתימות"],
  ["incidents", "דוח אירועים", "פציעות, בטיחות, רפואה ותלונות"],
  ["complaints", "דוח תלונות", "SLA, חומרה וסטטוס טיפול"],
  ["camera_issues", "דוח מצלמות", "ניתוקים, תמונה שחורה וקפיאות"],
  ["task_completion", "דוח משימות", "צפייה, ביצוע ואיחורים"],
  ["monthly_summary", "סיכום חודשי לגן", "ניהול, ילדים, צוות, מסמכים ופיקוח"]
];

export function ReportsCenter({ exports }: { exports: any[] }) {
  return (
    <section className="grid cols-2 dashboard-panels">
      <article className="card action-panel">
        <div className="section-heading"><h2><FileBarChart2 size={20} /> דוחות זמינים</h2><p>מרכז ייצוא לדוחות ניהול ופיקוח. חלק מהייצואים מוכנים כשלד עד חיבור מחולל PDF מלא.</p></div>
        <div className="report-card-grid">{reportDefinitions.map(([type, title, text]) => <div className="report-card" key={type}><strong>{title}</strong><span>{text}</span><div className="actions"><a className="button secondary tiny" href={`/dashboard/admin/reports?type=${type}`}>תצוגה</a><a className="button tiny" href={`/dashboard/admin/reports?download=${type}`}>הכנת הורדה</a></div></div>)}</div>
      </article>
      <article className="card action-panel">
        <div className="section-heading"><h2>ייצואים אחרונים</h2><p>קבצים שנוצרו או הוכנו לייצוא.</p></div>
        {exports.length === 0 ? <div className="empty-state"><strong>אין ייצואים עדיין</strong><span>לאחר יצירת דוח, הסטטוס והפורמט יופיעו כאן.</span></div> : <div className="procedure-list">{exports.map((row) => <div className="list-item" key={row.id}><div><strong>{row.report_type}</strong><span>{row.format} · {row.created_at ? new Date(row.created_at).toLocaleString("he-IL") : ""}</span></div><span className="pill">{row.status}</span></div>)}</div>}
      </article>
    </section>
  );
}
