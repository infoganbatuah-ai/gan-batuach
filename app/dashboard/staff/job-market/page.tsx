import { BriefcaseBusiness, Building2 } from "lucide-react";
import { StaffApplicationForm } from "@/components/self-service-forms";
import { FormField, ListRowCard, SearchFilterBar, StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffEmpty, StaffPageHero, StaffSection } from "@/components/staff-app-ui";
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
    <StaffAppFrame active="more">
      <StaffPageHero eyebrow="מועמדות צוות" title="מצאו גן שמחפש עובדים" text="מוצגים רק פרטים ציבוריים של משרות. אין גישה למידע פנימי לפני אישור מנהלת." icon={BriefcaseBusiness} badge={<StatusChip tone="success">{filtered.length} משרות פתוחות</StatusChip>} />
      <form action="/dashboard/staff/job-market">
        <SearchFilterBar
          search={<FormField label="חיפוש" name="q" placeholder="תפקיד או שם גן" defaultValue={params?.q ?? ""} />}
          filters={<FormField label="עיר" name="city" placeholder="עיר" defaultValue={params?.city ?? ""} />}
          action={<button className="gb-primary-button" type="submit">סינון</button>}
        />
      </form>
      <StaffSection title="משרות פתוחות">
        {filtered.length === 0 ? (
          <StaffEmpty title="אין משרות פתוחות" text="כאשר גן יפרסם משרה, היא תופיע כאן." icon={BriefcaseBusiness} />
        ) : (
          <div className="staff-task-list-ref">
            {filtered.map((opening) => (
              <ListRowCard
                key={opening.id}
                title={opening.role_needed}
                subtitle={`${opening.gardens?.name ?? "גן"} · ${opening.gardens?.city ?? ""}`}
                meta={`${opening.age_group ?? "כל הגילאים"} · ${opening.employment_type ?? "סוג העסקה לא פורסם"}`}
                avatar={<Building2 size={22} />}
                status={<StatusChip tone="success">פתוח</StatusChip>}
                actions={<StaffApplicationForm opening={opening} />}
              />
            ))}
          </div>
        )}
      </StaffSection>
    </StaffAppFrame>
  );
}
