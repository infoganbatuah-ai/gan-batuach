import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { AdminDataError } from "@/components/admin-data-state";

type DuplicateGroup = { type: string; identity_number: string; count: number; names: string[] };

function collectDuplicates(type: string, rows: any[], nameKey = "full_name"): DuplicateGroup[] {
  const map = new Map<string, any[]>();
  for (const row of rows) {
    const id = String(row.identity_number ?? "").trim();
    if (!id) continue;
    map.set(id, [...(map.get(id) ?? []), row]);
  }
  return Array.from(map.entries())
    .filter(([, items]) => items.length > 1)
    .map(([identity_number, items]) => ({ type, identity_number, count: items.length, names: items.map((item) => item[nameKey] ?? item.email ?? item.id) }));
}

async function readSource<T extends { data: unknown[] | null; error: unknown }>(load: () => PromiseLike<T>) {
  try {
    const response = await load();
    return { data: response.error ? null : response.data, error: response.error, available: !response.error };
  } catch (error) {
    return { data: null, error: error || new Error("Source unavailable"), available: false };
  }
}

export default async function AdminDuplicatesPage() {
  await requireRole(["admin"]);
  const unavailable = { data: null, error: null, available: false };
  const result = await safeAdminData("admin duplicates", async () => {
    const supabase = await createClient();
    const [parents, children, staff, profiles] = await Promise.all([
      readSource(() => supabase.from("parents" as any).select("id, full_name, identity_number, phone, email").limit(2000)),
      readSource(() => supabase.from("children" as any).select("id, full_name, identity_number, garden_id").limit(2000)),
      readSource(() => supabase.from("staff" as any).select("id, full_name, identity_number, garden_id, role_title").limit(2000)),
      readSource(() => supabase.from("profiles" as any).select("id, full_name, email, role, identity_number").in("role", ["manager", "owner"]).limit(2000))
    ]);
    [parents, children, staff, profiles].forEach((source, index) => logSupabaseError(`admin duplicates ${index}`, source.error));
    return { parents, children, staff, profiles };
  }, { parents: unavailable, children: unavailable, staff: unavailable, profiles: unavailable });
  const { parents, children, staff, profiles } = result.data;
  const unavailableCategories = [["הורים", parents.available], ["ילדים", children.available], ["צוות", staff.available], ["מנהלת / בעלים", profiles.available]].filter(([, available]) => !available).map(([category]) => category);
  const allAvailable = unavailableCategories.length === 0;
  const duplicateGroups = [
    ...collectDuplicates("הורים", parents.data ?? []),
    ...collectDuplicates("ילדים", children.data ?? []),
    ...collectDuplicates("צוות", staff.data ?? []),
    ...collectDuplicates("מנהלת / בעלים", profiles.data ?? [])
  ];

  return (
    <DashboardShell role="admin" title="איתור כפילויות">
      <div className="dashboard-hero-card admin-hero-card">
        <div><p className="eyebrow">Identity QA</p><h1>איתור כפילויות לפי תעודת זהות.</h1><p>כלי פנימי לפני הפעלת אינדקסים ייחודיים מלאים. אם קיימות כפילויות, יש לאחד ידנית לפני נעילה קשיחה.</p></div>
        <span className={!allAvailable ? "pill" : duplicateGroups.length ? "pill bad" : "pill good"}>{allAvailable ? `${duplicateGroups.length} קבוצות כפולות` : "בדיקת הכפילויות אינה מלאה"}</span>
      </div>
      <AdminDataError message={result.error ?? (!allAvailable ? "חלק מבדיקות הכפילויות אינם זמינים כרגע" : null)} />
      {!allAvailable ? <div className="warning-banner">מקורות שאינם זמינים: {unavailableCategories.join(" · ")}</div> : null}
      <section className="dashboard-section">
        {duplicateGroups.length === 0 ? !allAvailable ? <div className="empty-state"><strong>בדיקת הכפילויות אינה מלאה</strong><span>לא ניתן לקבוע אם קיימות כפילויות בכל המקורות כרגע.</span></div> : <div className="empty-state"><strong>לא נמצאו כפילויות לפי תעודת זהות</strong><span>לא נמצאו כפילויות ברשומות שנטענו בלבד. תצוגה זו אינה מאשרת מיגרציה, מיזוג או מחיקה.</span></div> : <div className="procedure-list">{duplicateGroups.map((group) => <article className="card procedure-card" key={`${group.type}-${group.identity_number}`}><div><span className="pill bad">{group.type}</span><h3>תעודת זהות {group.identity_number}</h3><p>{group.count} רשומות: {group.names.join(", ")}</p></div></article>)}</div>}
      </section>
    </DashboardShell>
  );
}
