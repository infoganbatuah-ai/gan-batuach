import Link from "next/link";
import { CalendarDays, CheckCircle2, MapPin, ShieldAlert, ShieldCheck, UsersRound } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { createParentLead } from "@/app/actions";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PublicGarden = {
  id: string;
  name: string;
  city: string;
  framework_type?: string | null;
  safe_status?: string | null;
  last_inspection_score?: number | null;
  last_inspection_at?: string | null;
  next_inspection_at?: string | null;
  public_profile_enabled?: boolean | null;
};

async function getPublicGardens() {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("gardens")
      .select("id, name, city, framework_type, safe_status, last_inspection_score, last_inspection_at, next_inspection_at, public_profile_enabled")
      .eq("public_profile_enabled", true)
      .limit(24);
    return (data ?? []) as PublicGarden[];
  } catch {
    return [] as PublicGarden[];
  }
}

function formatDate(date?: string | null) {
  return date ? new Date(date).toLocaleDateString("he-IL") : "טרם נקבע";
}

function safeStatus(status?: string | null) {
  if (status === "safe") return { label: "גן בטוח", className: "good", icon: ShieldCheck };
  if (status === "requires_fix") return { label: "דורש תיקון", className: "warn", icon: ShieldAlert };
  if (status === "not_compliant") return { label: "לא עומד בסטנדרט", className: "bad", icon: ShieldAlert };
  return { label: "ממתין לבדיקה", className: "", icon: CheckCircle2 };
}

export default async function GardensPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const gardens = await getPublicGardens();
  const params = await searchParams;

  return (
    <>
      <BrandHeader />
      <main>
        <section className="page-hero slim-hero">
          <p className="eyebrow">רשימת גנים</p>
          <h1>מצאו גן פרטי עם שקיפות, סטטוס פיקוח ותהליך רישום ברור.</h1>
          <p>הכרטיסים מציגים את הנתונים שהגן בחר לפרסם ואת סטטוס הבקרה במערכת גן בטוח.</p>
          {params.lead === "sent" ? <div className="success-banner">הפנייה התקבלה ותופיע למנהלת הגן ולאדמין.</div> : null}
        </section>

        <section className="section compact-section">
          <div className="filter-bar">
            <label>שם גן<input placeholder="לדוגמה: גן הפרחים" /></label>
            <label>עיר<input placeholder="תל אביב, ראשון לציון..." /></label>
            <label>סטטוס<select defaultValue=""><option value="">כל הסטטוסים</option><option>גן בטוח</option><option>דורש תיקון</option></select></label>
            <button className="button primary" type="button">סינון</button>
          </div>

          {gardens.length === 0 ? (
            <div className="empty-state">
              <ShieldCheck size={34} />
              <h2>עדיין אין גנים ציבוריים להצגה</h2>
              <p>כאשר אדמין יפעיל פרופיל ציבורי לגן, הוא יופיע כאן עם סטטוס, ציון ביקורת ותאריכי פיקוח.</p>
              <Link className="button primary" href="/join-kindergarten">הצטרפות גן למערכת</Link>
            </div>
          ) : (
            <div className="garden-card-grid">
              {gardens.map((garden) => {
                const status = safeStatus(garden.safe_status);
                const StatusIcon = status.icon;
                return (
                  <article className="public-garden-card" key={garden.id}>
                    <div className="garden-card-top">
                      <span className={`pill ${status.className}`}><StatusIcon size={15} /> {status.label}</span>
                      <span><MapPin size={16} /> {garden.city}</span>
                    </div>
                    <h2>{garden.name}</h2>
                    <p>גן פרטי המנוהל במערכת גן בטוח עם תיעוד, שקיפות, פיקוח ומשימות תיקון לפי הרשאות.</p>
                    <div className="garden-facts">
                      <span><UsersRound size={16} /> גילאים: {garden.framework_type || "לא צוין"}</span>
                      <span><ShieldCheck size={16} /> ציון אחרון: {garden.last_inspection_score ?? "טרם בוצעה ביקורת"}</span>
                      <span><CalendarDays size={16} /> ביקורת אחרונה: {formatDate(garden.last_inspection_at)}</span>
                      <span><CalendarDays size={16} /> ביקורת הבאה: {formatDate(garden.next_inspection_at)}</span>
                    </div>
                    <details className="lead-details">
                      <summary className="button secondary">הורים - בדיקת זמינות / הצטרפות</summary>
                      <form action={createParentLead} className="form guided-form">
                        <input type="hidden" name="garden_id" value={garden.id} />
                        <label>שם הורה מלא<input name="parent_name" required placeholder="שם פרטי ומשפחה" /></label>
                        <label>טלפון<input name="phone" required placeholder="050-0000000" /></label>
                        <label>מייל<input name="email" type="email" placeholder="name@example.com" /></label>
                        <label>שם הילד/ים אם ידוע<input name="children_names" placeholder="לדוגמה: נועה, איתי" /></label>
                        <label>גיל הילד<input name="child_age" placeholder="לדוגמה: שנתיים וחצי" /></label>
                        <label>תאריך כניסה רצוי<input name="desired_enrollment_date" type="date" /></label>
                        <label className="wide">הערות<textarea name="notes" rows={3} placeholder="כל דבר שחשוב שהגן ידע לפני יצירת קשר" /></label>
                        <button className="button primary" type="submit">שליחת פנייה לגן</button>
                      </form>
                    </details>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
