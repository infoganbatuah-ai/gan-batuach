import Link from "next/link";
import { BrainCircuit, Building2, Camera, CheckCircle2, ClipboardCheck, HeartHandshake, MapPin, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { createAdminClient } from "@/lib/supabase/admin";

const audiences = [
  { icon: HeartHandshake, title: "להורים", text: "שקיפות על סטטוס הגן, ביקורות, נוכחות, הודעות, מסמכים, מצלמות מורשות וערוץ פנייה ברור." },
  { icon: Building2, title: "לגנים פרטיים", text: "מערכת אחת לניהול ילדים, הורים, צוות, מסמכים, נוכחות, משימות, פיקוח, לידים ותפעול יומי." },
  { icon: ClipboardCheck, title: "לפקחים", text: "ביקורות חודשיות עם GPS, טפסים דינמיים, ניקוד משוקלל, ליקויים, הוכחות תיקון וציר זמן." },
  { icon: ShieldCheck, title: "לאדמין", text: "מרכז שליטה שמציג גנים בסיכון, תלונות, חריגים, תקלות מצלמה, אירועי AI ומשימות ארציות." }
];

const supervisionSteps = [
  "הגן מצטרף ומעלה פרטים, מסמכים ותהליכי עבודה.",
  "האדמין מאשר ומקצה פקח לפי עיר ואזור אחריות.",
  "המערכת מייצרת משימת ביקורת חודשית אוטומטית.",
  "הפקח ממלא טופס דינמי במקום, עם GPS, תמונות ומסמכים.",
  "ציון נמוך או שאלה קריטית יוצרים ליקוי, משימת תיקון והסלמה.",
  "הורים ומנהלים רואים תמונת מצב ברורה לפי הרשאות."
];

const trustPillars = [
  { icon: Camera, title: "מצלמות בלי חשיפת DVR", text: "הורים מקבלים Token זמני בלבד. כתובות RTSP וסיסמאות נשארות מאחורי שכבת שרת מאובטחת." },
  { icon: BrainCircuit, title: "תצפיתן AI", text: "עוזר בטיחות דיגיטלי שמתריע על אירועים כמו ילד לבד, אזור אסור, נפילה, בכי, צפיפות או מצלמה מכוסה." },
  { icon: ClipboardCheck, title: "ציות תפעולי", text: "מבנה עבודה סביב בטיחות, כוח אדם, תברואה, מטבח, פרטיות, אישורים, תלונות, מסמכים ונוהלי חירום." }
];

async function getHomeGardens() {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("gardens").select("id, name, city, address, owner_name, framework_type, children_capacity, current_children_count, safe_status, last_inspection_score, last_inspection_at, next_inspection_at, manager:profiles!gardens_manager_id_fkey(full_name)").eq("public_profile_enabled", true).limit(6);
    return data ?? [];
  } catch { return []; }
}

export default async function HomePage() {
  const homeGardens = await getHomeGardens();
  return (
    <>
      <BrandHeader />
      <main>
        <section className="hero product-hero">
          <div className="hero-content stack-xl">
            <div className="hero-badge"><Sparkles size={18} /> פלטפורמת ניהול ופיקוח לגנים פרטיים בישראל</div>
            <h1>גנים פרטיים ראויים למסגרת ניהול ופיקוח מקצועית.</h1>
            <p>
              גן בטוח מחברת בין הורים, גננות, צוות, פקחים ואדמין מרכזי כדי ליצור סטנדרט חדש של שקיפות,
              תפעול, בקרה ובטיחות בגני ילדים פרטיים. המערכת אינה מחליפה ייעוץ משפטי או רישוי ממשלתי,
              אלא מסדרת את העבודה היומיומית סביב דרישות תפעול ורגולציה מקובלות.
            </p>
            <div className="actions hero-actions">
              <Link className="button primary large" href="/gardens">חיפוש גנים</Link>
              <Link className="button secondary large" href="/join-kindergarten">הצטרפות גן</Link>
              <Link className="button large" href="/login">כניסת הורים</Link>
              <Link className="button large" href="/dashboard/admin">כניסת אדמין</Link>
            </div>
          </div>
          <aside className="hero-control-card" aria-label="תמונת מצב מערכתית">
            <div className="control-card-header">
              <span className="pulse" />
              <strong>מרכז שליטה חי</strong>
            </div>
            <div className="control-metrics">
              <span><b>פיקוח</b> חודשי</span>
              <span><b>RLS</b> פעיל</span>
              <span><b>AI</b> תצפיתן</span>
              <span><b>DVR</b> מוגן</span>
            </div>
            <div className="risk-strip">
              <span className="risk good">תקין</span>
              <span className="risk warn">דורש תיקון</span>
              <span className="risk bad">חריג קריטי</span>
            </div>
          </aside>
        </section>

        <section className="section compact-section">
          <p className="eyebrow">למי זה מיועד</p>
          <h2>מערכת אחת שמדברת בשפה של כל הצדדים</h2>
          <div className="grid cols-4 feature-grid">
            {audiences.map((item) => (
              <article className="card feature-card" key={item.title}>
                <item.icon className="feature-icon" />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section split-section">
          <div>
            <p className="eyebrow">סטטוס גן בטוח</p>
            <h2>מה המשמעות של גן בטוח?</h2>
            <p>
              סטטוס גן בטוח ניתן רק לאחר הצטרפות, השלמת פרטים, מסמכי בסיס, ביקורת פקח, ציון 8 ומעלה
              וללא ליקויים קריטיים פתוחים. אם הציון יורד או ליקוי קריטי נשאר פתוח, הסטטוס משתנה אוטומטית.
            </p>
          </div>
          <div className="status-ladder">
            <div><CheckCircle2 /> pending_review <span>ממתין לבדיקה</span></div>
            <div><ShieldCheck /> safe <span>עומד בסטנדרט</span></div>
            <div><ClipboardCheck /> requires_fix <span>דורש תיקון</span></div>
          </div>
        </section>

        <section className="section supervision-band">
          <p className="eyebrow">איך הפיקוח עובד</p>
          <h2>ביקורת חודשית שמייצרת פעולה, לא רק דוח</h2>
          <div className="timeline-grid">
            {supervisionSteps.map((step, index) => (
              <article className="timeline-card" key={step}>
                <span>{index + 1}</span>
                <p>{step}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section compact-section">
          <p className="eyebrow">שקיפות עם פרטיות</p>
          <h2>מצלמות, AI ותיעוד מלא בלי לחשוף מידע רגיש</h2>
          <div className="grid cols-3 feature-grid">
            {trustPillars.map((item) => (
              <article className="card feature-card" key={item.title}>
                <item.icon className="feature-icon" />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section compact-section">
          <p className="eyebrow">גנים במערכת</p>
          <h2>גנים פרטיים שמנהלים שקיפות ופיקוח דרך גן בטוח</h2>
          {homeGardens.length === 0 ? <div className="empty-state"><strong>אין עדיין גנים ציבוריים להצגה</strong><span>כאשר אדמין יפעיל פרופיל ציבורי לגן, הוא יוצג כאן.</span></div> : <div className="garden-card-grid">{homeGardens.map((garden: any) => <article className="public-garden-card" key={garden.id}><div className="garden-image-placeholder">{garden.name}</div><div className="garden-card-top"><span className={garden.safe_status === "safe" ? "pill good" : "pill warn"}>{garden.safe_status ?? "pending_review"}</span><span><MapPin size={16} /> {garden.city}</span></div><h3>{garden.name}</h3><p>{garden.address ?? "כתובת תוצג לפי הרשאת הגן"} · מנהלת: {garden.manager?.full_name ?? garden.owner_name ?? "לא צוין"}</p><div className="garden-facts"><span>גילאים: {garden.framework_type ?? "מעורב"}</span><span>ילדים: {garden.current_children_count ?? 0}/{garden.children_capacity ?? 0}</span><span>ציון ביקורת: {garden.last_inspection_score ?? "טרם"}</span><span>ביקורת הבאה: {garden.next_inspection_at ? new Date(garden.next_inspection_at).toLocaleDateString("he-IL") : "טרם נקבע"}</span></div><div className="actions"><Link className="button primary" href={`/gardens/${garden.id}`}>צפייה בגן</Link><Link className="button secondary" href="/login">כניסת הורים</Link><Link className="button" href="/login">כניסת צוות</Link></div></article>)}</div>}
        </section>

        <section className="section cta-section">
          <div>
            <p className="eyebrow">אמון שנבנה מתפעול נכון</p>
            <h2>המערכת עוזרת לגן פרטי לעבוד כמו מסגרת מפוקחת, מתועדת ושקופה.</h2>
          </div>
          <div className="actions">
            <Link className="button primary large" href="/gardens">התחילו מחיפוש גן</Link>
            <Link className="button secondary large" href="/join-kindergarten">גן רוצה להצטרף</Link>
          </div>
        </section>
      </main>
    </>
  );
}
