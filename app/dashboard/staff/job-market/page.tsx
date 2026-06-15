import { BriefcaseBusiness, Building2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StaffApplicationForm } from "@/components/self-service-forms";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffJobMarketPage({ searchParams }: { searchParams?: Promise<{ city?: string; q?: string }> }) {
  await requireRole(["staff"]);
  const params = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("kindergarten_staff_openings" as any)
    .select("*, gardens(name,city,address,public_profile_enabled)")
    .eq("active_status", "published")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = ((await query).data ?? []) as any[];
  const filtered = rows.filter((row) => {
    const cityOk = params?.city ? String(row.gardens?.city ?? "").includes(params.city) : true;
    const qOk = params?.q ? `${row.gardens?.name ?? ""} ${row.role_needed ?? ""}`.includes(params.q) : true;
    return cityOk && qOk;
  });

  return (
    <DashboardShell role="staff" title="שוק משרות">
      <section className="dashboard-hero-card">
        <div>
          <p className="eyebrow">מועמדות צוות</p>
          <h1>מצאו גן שמחפש עובדים והגישו מועמדות.</h1>
          <p>מוצגים רק פרטים ציבוריים של משרות. אין גישה לילדים, הורים, מסמכים או מידע פנימי לפני אישור מנהלת.</p>
        </div>
        <span className="pill good">{filtered.length} משרות פתוחות</span>
      </section>
      <form className="filter-bar" action="/dashboard/staff/job-market">
        <input name="q" placeholder="תפקיד או שם גן" defaultValue={params?.q ?? ""} />
        <input name="city" placeholder="עיר" defaultValue={params?.city ?? ""} />
        <button className="button secondary" type="submit">סינון</button>
      </form>
      <section className="procedure-list">
        {filtered.map((opening) => (
          <article className="card procedure-card" key={opening.id}>
            <div>
              <span className="pill good"><BriefcaseBusiness size={14} /> פתוח</span>
              <h3>{opening.role_needed}</h3>
              <p><Building2 size={14} /> {opening.gardens?.name ?? "גן"} · {opening.gardens?.city ?? ""}</p>
              <small>{opening.age_group ?? "כל הגילאים"} · {opening.employment_type ?? "סוג העסקה לא פורסם"}</small>
              <p>{opening.requirements ?? opening.description ?? "דרישות יפורסמו על ידי הגן."}</p>
            </div>
            <div className="procedure-meta"><StaffApplicationForm opening={opening} /></div>
          </article>
        ))}
        {filtered.length === 0 ? <div className="empty-state"><strong>אין משרות פתוחות</strong><span>כאשר גן יפרסם משרה, היא תופיע כאן.</span></div> : null}
      </section>
    </DashboardShell>
  );
}
