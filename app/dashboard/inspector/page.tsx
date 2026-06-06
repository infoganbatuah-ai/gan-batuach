import { Camera, ClipboardCheck, FileText, ShieldAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { Avatar } from "@/components/avatar";
import { ActionCard, CleanSection, PremiumDashboardHero, RoleMetricCard } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function InspectorDashboard() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, gardensRes, inspectionsRes, requiredRes] = await Promise.all([
    supabase.from("inspectors" as any).select("id, service_cities, certification_notes, profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("gardens" as any).select("id, name, city, address, logo_url, safe_status, last_inspection_score, next_inspection_at").eq("inspector_id", profile.id).order("name"),
    supabase
    .from("inspections")
    .select("id, status, weighted_score, completed_at, violation_count, gardens(id, name, city, logo_url, safe_status)")
    .eq("inspector_id", profile.id)
    .limit(20),
    supabase
    .from("required_inspections" as any)
    .select("id, due_at, status, gardens(id, name, city, logo_url, safe_status)")
    .eq("inspector_id", profile.id)
    .neq("status", "done")
    .order("due_at", { ascending: true })
    .limit(12)
  ]);
  const inspector = inspectorRes.data as any;
  const gardens = (gardensRes.data ?? []) as any[];
  const inspections = inspectionsRes.data ?? [];
  const required = requiredRes.data ?? [];
  const now = Date.now();

  return (
    <DashboardShell role="inspector" title="דשבורד פקח">
      <div className="commercial-dashboard">
      <PremiumDashboardHero
        eyebrow="פיקוח היום"
        title={`שלום, ${profile.full_name ?? "המפקח"}`}
        subtitle={`${gardens.length} גנים משויכים. ביקורות, ליקויים ודוחות במסך אחד ברור.`}
        badge={gardens.length ? "משויך לגנים" : "אין שיוך"}
        badgeTone={gardens.length ? "good" : "warn"}
      >
        <Avatar name={profile.full_name} src={inspector?.profile_photo_url ?? profile.profile_image_url} size="lg" />
      </PremiumDashboardHero>
      <div className="premium-metric-grid">
        <RoleMetricCard label="גנים" value={gardens.length} hint="באחריותך" tone={gardens.length ? "good" : "warn"} />
        <RoleMetricCard label="ממתינות" value={(required ?? []).length} hint="ביקורות לביצוע" tone={(required ?? []).length ? "warn" : "good"} href="/dashboard/inspector/inspections/due" />
        <RoleMetricCard label="בוצעו" value={(inspections ?? []).filter((item) => item.status === "done").length} hint="ביקורות אחרונות" tone="good" />
        <RoleMetricCard label="ציון אחרון" value={String((inspections ?? [])[0]?.weighted_score ?? "-")} hint="מהביקורת האחרונה" />
      </div>
      <CleanSection title="פעולות פיקוח" subtitle="פתיחה מהירה למסלולים המרכזיים.">
        <div className="premium-action-grid">
          <ActionCard title="ביקורת חדשה" text="גנים שממתינים לך" href="/dashboard/inspector/inspections/due" icon={ClipboardCheck} tone="warn" />
          <ActionCard title="ליקויים" text="מעקב תיקונים" href="/dashboard/inspector/violations" icon={ShieldAlert} />
          <ActionCard title="דוחות" text="סיכומים והיסטוריה" href="/dashboard/inspector/reports" icon={FileText} />
          <ActionCard title="מצלמות" text="רק בגנים משויכים" href="/dashboard/inspector/cameras" icon={Camera} />
        </div>
      </CleanSection>
      <div className="dashboard-hero-card inspector-hero-card premium-identity-hero">
        <div>
          <p className="eyebrow">מרחב פיקוח מקצועי</p>
          <h1>שלום, {profile.full_name ?? "המפקח"}</h1>
          <p>גנים משויכים: {gardens.length}. אזורי אחריות: {Array.isArray(inspector?.service_cities) && inspector.service_cities.length ? inspector.service_cities.join(", ") : "לא הוגדרו"}.</p>
        </div>
        <Avatar name={profile.full_name} src={inspector?.profile_photo_url ?? profile.profile_image_url} size="lg" />
        <span className={gardens.length ? "pill good" : "pill warn"}>{gardens.length ? "משויך לגנים" : "אין שיוך גנים"}</span>
      </div>
      {(!profile.profile_image_url && !inspector?.profile_photo_url) || gardens.length === 0 ? <section className="staff-operating-center"><div><p className="eyebrow">פעולה נדרשת</p><h2>השלמת פרטים</h2><p>{gardens.length === 0 ? "עדיין לא הוקצו גנים למפקח. אדמין צריך לשייך גנים כדי להתחיל פיקוח." : "יש להשלים תמונת פרופיל ופרטי התקשרות."}</p></div><a className="button primary" href="/dashboard/inspector/settings">השלמת פרטים</a></section> : null}
      <div className="grid cols-3">
        <StatCard label="ביקורות פתוחות" value={(inspections ?? []).filter((item) => item.status !== "done").length} />
        <StatCard label="ביקורות שבוצעו" value={(inspections ?? []).filter((item) => item.status === "done").length} tone="good" />
        <StatCard label="ממוצע אחרון" value={String((inspections ?? [])[0]?.weighted_score ?? "-")} />
      </div>
      <section className="dashboard-section role-priority-section">
        <div className="section-heading"><h2>פעולות פיקוח מהירות</h2><p>המסלולים המרכזיים לפקח: פתיחת ביקורת, בדיקת ליקויים ודוחות.</p></div>
        <div className="quick-actions-grid role-action-grid"><a className="quick-action" href="/dashboard/inspector/inspections/due">בדיקה חדשה<span>ביקורות שממתינות לטיפול</span></a><a className="quick-action" href="/dashboard/inspector/violations">ליקויים פתוחים<span>מעקב אחר תיקונים</span></a><a className="quick-action" href="/dashboard/inspector/reports">דוחות<span>סיכומים והיסטוריה</span></a><a className="quick-action" href="/dashboard/inspector/cameras">מצלמות<span>רק בגנים משויכים</span></a></div>
      </section>
      <section className="dashboard-section people-directory">
        <div className="section-heading"><h2>גנים משויכים</h2><p>מפקח רואה רק גנים שהוקצו אליו, עם מצב אחרון וקישור לפיקוח.</p></div>
        {gardens.length === 0 ? <div className="empty-state"><strong>לא הוקצו גנים למפקח</strong><span>אדמין יכול לשייך גנים מתוך ניהול גנים או יצירת מפקח.</span></div> : <div className="people-card-grid inspector-garden-grid">{gardens.map((garden: any) => <article className="person-card inspector-garden-card" key={garden.id}><div className="person-card-top"><Avatar name={garden.name} src={garden.logo_url} size="lg" /><div><span className={garden.safe_status === "safe" ? "pill good" : "pill warn"}>{garden.safe_status ?? "בבדיקה"}</span><h3>{garden.name}</h3><p>{garden.city ?? ""} · {garden.address ?? ""}</p></div></div><div className="mini-kpi-row"><span>ציון אחרון <b>{garden.last_inspection_score ?? "-"}</b></span><span>פיקוח הבא <b>{garden.next_inspection_at ? new Date(garden.next_inspection_at).toLocaleDateString("he-IL") : "-"}</b></span></div><div className="profile-actions"><a className="button secondary tiny" href="/dashboard/inspector/inspections">פתיחת ביקורת</a><a className="button tiny" href="/dashboard/inspector/cameras">מצלמות</a></div></article>)}</div>}
      </section>
      <section className="dashboard-section people-directory">
        <div className="section-heading"><h2>גנים שממתינים לפיקוח</h2><p>כל כרטיס מציג גן משויך בלבד, תאריך יעד, סטטוס סיכון ופעולת מילוי טופס.</p></div>
        {(required ?? []).length === 0 ? <div className="empty-state"><strong>אין ביקורות ממתינות</strong><span>כאשר תיפתח משימת פיקוח חודשית היא תופיע כאן עם תאריך יעד ברור.</span></div> : <div className="people-card-grid inspector-garden-grid">{(required ?? []).map((item: any) => {
          const dueAt = item.due_at ? new Date(item.due_at) : null;
          const days = dueAt ? Math.ceil((dueAt.getTime() - now) / 86400000) : null;
          return <article className="person-card inspector-garden-card" key={item.id}>
            <div className="person-card-top"><Avatar name={item.gardens?.name} src={item.gardens?.logo_url} size="lg" /><div><span className={days !== null && days < 0 ? "pill bad" : "pill warn"}>{days !== null && days < 0 ? `${Math.abs(days)} ימים באיחור` : `${days ?? "-"} ימים נותרו`}</span><h3>{item.gardens?.name ?? "גן משויך"}</h3><p>{item.gardens?.city ?? "עיר לא צוינה"} · {item.gardens?.safe_status ?? "סטטוס בבדיקה"}</p></div></div>
            <div className="mini-kpi-row"><span>יעד <b>{dueAt ? dueAt.toLocaleDateString("he-IL") : "-"}</b></span><span>סטטוס <b>{item.status}</b></span><span>GPS <b>נדרש</b></span></div>
            <div className="profile-actions"><a className="button primary tiny" href={`/dashboard/inspector/inspections?required=${item.id}`}>מילוי טופס פיקוח</a><a className="button secondary tiny" href="/dashboard/inspector/inspections/due">כל הביקורות</a></div>
          </article>;
        })}</div>}
      </section>
      <section className="dashboard-section people-directory">
        <div className="section-heading"><h2>היסטוריית ביקורות אחרונות</h2><p>ציון, ליקויים וסטטוס לכל גן שבוצע בו פיקוח על ידך.</p></div>
        {(inspections ?? []).length === 0 ? <div className="empty-state"><strong>אין היסטוריית ביקורות</strong><span>לאחר הגשת ביקורת חתומה, הדוח יופיע כאן.</span></div> : <div className="people-card-grid inspector-garden-grid">{(inspections ?? []).map((inspection: any) => <article className="person-card inspector-garden-card" key={inspection.id}>
          <div className="person-card-top"><Avatar name={inspection.gardens?.name} src={inspection.gardens?.logo_url} size="lg" /><div><span className={inspection.weighted_score >= 8 ? "pill good" : "pill bad"}>ציון {inspection.weighted_score ?? "-"}</span><h3>{inspection.gardens?.name ?? "גן"}</h3><p>{inspection.gardens?.city ?? "-"} · {inspection.completed_at ? new Date(inspection.completed_at).toLocaleDateString("he-IL") : "טיוטה"}</p></div></div>
          <div className="mini-kpi-row"><span>סטטוס <b>{inspection.status}</b></span><span>ליקויים <b>{inspection.violation_count ?? 0}</b></span><span>תקן <b>{inspection.weighted_score >= 8 ? "עומד" : "דורש תיקון"}</b></span></div>
          <div className="profile-actions"><a className="button secondary tiny" href={`/dashboard/inspector/inspections/history?inspection=${inspection.id}`}>צפייה בדוח</a><a className="button tiny" href="/dashboard/inspector/violations">ליקויים</a></div>
        </article>)}</div>}
      </section>
      </div>
    </DashboardShell>
  );
}
