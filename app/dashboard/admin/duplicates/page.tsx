import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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

export default async function AdminDuplicatesPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const [parents, children, staff, profiles] = await Promise.all([
    supabase.from("parents" as any).select("id, full_name, identity_number, phone, email").limit(2000),
    supabase.from("children" as any).select("id, full_name, identity_number, garden_id").limit(2000),
    supabase.from("staff" as any).select("id, full_name, identity_number, garden_id, role_title").limit(2000),
    supabase.from("profiles" as any).select("id, full_name, email, role, identity_number").in("role", ["manager", "owner"]).limit(2000)
  ]);
  const warnings = [parents, children, staff, profiles].filter((result) => result.error).map((result) => result.error?.message).filter(Boolean);
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
        <span className={duplicateGroups.length ? "pill bad" : "pill good"}>{duplicateGroups.length} קבוצות כפולות</span>
      </div>
      {warnings.length ? <div className="warning-banner">חלק מהבדיקות לא נטענו: {warnings.join(" · ")}</div> : null}
      <section className="dashboard-section">
        {duplicateGroups.length === 0 ? <div className="empty-state"><strong>לא נמצאו כפילויות לפי תעודת זהות</strong><span>ניתן להריץ את מיגרציית הייחודיות בבטחה יחסית. אם יתווספו כפילויות בעתיד, הדוח יציף אותן כאן.</span></div> : <div className="procedure-list">{duplicateGroups.map((group) => <article className="card procedure-card" key={`${group.type}-${group.identity_number}`}><div><span className="pill bad">{group.type}</span><h3>תעודת זהות {group.identity_number}</h3><p>{group.count} רשומות: {group.names.join(", ")}</p></div></article>)}</div>}
      </section>
    </DashboardShell>
  );
}
