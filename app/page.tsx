import Image from "next/image";
import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import { StatCard } from "@/components/stat-card";

const modules = [
  ["ניהול גנים", "פתיחת גן, שיוך פקח, משתמש גננת, סטטוס ציבורי וסטטוס גן בטוח."],
  ["תלמידים והורים", "רישום הורה, השלמת כרטיס ילד, אישורים, מורשי איסוף ואישור גננת."],
  ["פיקוח", "טפסי פיקוח דינמיים, שאלות חובה, GPS, ניקוד, ליקויים ומשימות תיקון."],
  ["מצלמות ו-AI", "CameraStreams, Tokens, לוג צפייה, תקלות מצלמה ואירועי תצפיתן AI."],
  ["מסמכים ורגולציה", "תוקף מסמכים, בדיקות רקע, ביטוח, בטיחות, פרטיות והסכמות."],
  ["דוחות ואבטחה", "AuditLogs, RBAC, RLS, הפרדה בין גנים וייצוא ל-PDF/Excel."]
];

export default function HomePage() {
  return (
    <>
      <BrandHeader />
      <main>
        <section className="hero">
          <div className="hero-content">
            <Image className="hero-logo" src="/assets/company-symbol.png" alt="" width={88} height={88} priority />
            <p className="eyebrow">Production architecture | Next.js + Supabase</p>
            <h1>גן בטוח – מערכת אמיתית לניהול ופיקוח גני ילדים פרטיים</h1>
            <p>
              מערכת Production מלאה עם Authentication, RBAC, PostgreSQL,
              Supabase RLS, API routes, דשבורדים מוגנים והפרדה מלאה בין תפקידי משתמשים.
            </p>
            <div className="actions">
              <Link className="button primary" href="/login">
                כניסה למערכת
              </Link>
              <Link className="button secondary" href="/dashboard/admin">
                דשבורד אדמין
              </Link>
              <a className="button" href="/api/gardens">
                API גנים
              </a>
            </div>
          </div>
        </section>

        <section id="architecture" className="section">
          <p className="eyebrow">שכבות המוצר</p>
          <h2>מערכת עם מסד נתונים, הרשאות ו-API</h2>
          <div className="grid cols-4">
            <StatCard label="תפקידי משתמש" value="5" tone="good" />
            <StatCard label="ישויות DB" value="40+" tone="good" />
            <StatCard label="API Routes" value="50+" tone="good" />
            <StatCard label="RLS Policies" value="מופעל" tone="good" />
          </div>
        </section>

        <section id="public" className="section">
          <p className="eyebrow">מודולים</p>
          <h2>כל רכיב עסקי מחובר לישות במסד הנתונים</h2>
          <div className="grid cols-3">
            {modules.map(([title, body]) => (
              <article className="card" key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
