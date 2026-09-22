import { FileBarChart2 } from "lucide-react";
import type { ReportingRole } from "@/lib/management/reporting";

type Definition = { type: string; title: string; text: string; roles: ReportingRole[]; csv?: boolean };

const definitions: Definition[] = [
  { type: "dashboard", title: "תמונת מצב ניהולית", text: "נוכחות, משימות, תלונות, תשלומים ומסמכים", roles: ["owner", "manager"] },
  { type: "attendance", title: "נוכחות ילדים", text: "הגעה, יציאה, היעדרות ותיקונים לפי מקור הנוכחות", roles: ["owner", "manager", "parent"], csv: true },
  { type: "pickup", title: "שחרור ואיסוף", text: "אירועי שחרור והרשאה ללא חשיפת פרטי קשר מיותרים", roles: ["owner", "manager"], csv: true },
  { type: "staff_hours", title: "שעות צוות", text: "מתוכנן מול בפועל, תיקונים וחוסר ביציאה", roles: ["owner", "manager", "staff"], csv: true },
  { type: "tuition", title: "שכר לימוד", text: "חיוב, סילוק, יתרה והתאמה; נפרד ממנוי הפלטפורמה", roles: ["owner", "manager", "parent"], csv: true },
  { type: "subscription", title: "מנוי הפלטפורמה", text: "תכנית, תקופת חיוב ואמת ספק התשלום", roles: ["owner", "manager", "admin"], csv: true },
  { type: "inspections", title: "פיקוחים", text: "סטטוס, ציון היסטורי וממצאים", roles: ["owner", "manager", "inspector"], csv: true },
  { type: "corrective_actions", title: "פעולות מתקנות", text: "פתוח, הוגש, נדחה, נסגר ונפתח מחדש", roles: ["owner", "manager", "inspector"], csv: true },
  { type: "complaints", title: "תלונות", text: "מצב ו־SLA ללא הערות פנימיות או תוכן פרטי", roles: ["owner", "manager", "inspector"], csv: true },
  { type: "tasks", title: "משימות", text: "מצב, שיוך ומקור דומיין", roles: ["owner", "manager", "staff"], csv: true },
  { type: "documents", title: "מסמכים", text: "פעולות נדרשות, בדיקה ותוקף ללא נתיב אחסון", roles: ["owner", "manager", "parent", "inspector"], csv: true },
  { type: "enrollment", title: "משפך הרשמה", text: "בקשות, בדיקה, תשלום והפעלה", roles: ["owner", "manager"], csv: true },
  { type: "capacity", title: "קיבולת תפעולית", text: "תפוסה, שריון וזמינות לפי כיתה; אינה קביעה משפטית", roles: ["owner", "manager"], csv: true },
  { type: "network_summary", title: "סיכום רשת גנים", text: "איחוד רק של הגנים שבניהול המשתמש", roles: ["owner", "manager"] },
  { type: "parent_summary", title: "סיכום משפחתי", text: "נתוני הילדים המורשים בלבד", roles: ["parent"] },
  { type: "staff_summary", title: "סיכום צוות אישי", text: "משמרות ומשימות של המשתמש בלבד", roles: ["staff"] },
  { type: "inspector_portfolio", title: "תיק גנים למפקח", text: "גנים משויכים, פיקוחים ומעקב", roles: ["inspector"] },
  { type: "platform_summary", title: "סיכום פלטפורמה", text: "ספירות מצטברות ומוכנות ספקים ללא תוכן פרטי", roles: ["admin"] }
];

export function ReportsCenter({ role, gardenId }: { role: ReportingRole; gardenId?: string | null }) {
  const reports = definitions.filter(definition => definition.roles.includes(role));
  const scope = gardenId ? `&garden_id=${encodeURIComponent(gardenId)}` : "";
  return (
    <section className="card action-panel" aria-labelledby="available-reports-heading">
      <div className="section-heading">
        <h2 id="available-reports-heading"><FileBarChart2 size={20} /> דוחות זמינים</h2>
        <p>הדוחות מחושבים בעת הבקשה מנתוני המקור. ניתן לבחור טווח אחיד; קובצי CSV מוגבלים ומתועדים.</p>
      </div>
      <div className="report-card-grid">
        {reports.map(report => (
          <div className="report-card" key={report.type}>
            <strong>{report.title}</strong>
            <span>{report.text}</span>
            <div className="actions">
              <a className="button secondary tiny" href={`/api/reports?type=${report.type}&range=month${scope}`}>הצגת החודש</a>
              {report.csv ? <a className="button tiny" href={`/api/reports?type=${report.type}&range=month&format=csv${scope}`}>CSV מאובטח</a> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
