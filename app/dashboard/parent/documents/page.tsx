import Link from "next/link";
import { CheckCircle2, Clock, FileText, ShieldCheck, TriangleAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { EmptyState, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createClient } from "@/lib/supabase/server";

function docStatusLabel(status?: string | null) {
  if (status === "approved" || status === "signed") return "מאושר";
  if (status === "pending" || status === "review") return "ממתין לבדיקה";
  if (status === "missing") return "חסר";
  if (status === "expired") return "פג תוקף";
  if (status === "rejected") return "צריך תיקון";
  return "חדש";
}

function docTone(status?: string | null) {
  if (status === "approved" || status === "signed") return "good" as const;
  if (status === "missing" || status === "expired" || status === "rejected") return "warn" as const;
  return "default" as const;
}

function dateText(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("he-IL") : "";
}

export default async function ParentDocumentsPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase as any, profile);
  const childIds = Array.from(new Set([
    ...(family.children as any[]).map((child) => child.id),
    ...(family.enrollments as any[]).map((enrollment) => enrollment.child_id)
  ].filter(Boolean)));
  const filters = [
    childIds.length ? `child_id.in.(${childIds.join(",")})` : "",
    `uploaded_by.eq.${profile.id}`
  ].filter(Boolean);
  const docsRes = filters.length
    ? await supabase.from("documents" as any).select("id, name, document_type, status, expires_at, created_at, child_id, garden_id, file_url").or(filters.join(",")).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (docsRes.error) console.error("[parent-documents] query failed", { profile_id: profile.id, error: docsRes.error.message });
  const rows = (docsRes.data ?? []) as any[];
  const needsAction = rows.filter((row) => ["missing", "rejected", "expired"].includes(String(row.status)));
  const signed = rows.filter((row) => ["approved", "signed"].includes(String(row.status)));
  const newDocs = rows.filter((row) => !["missing", "rejected", "expired", "approved", "signed"].includes(String(row.status)));

  return (
    <DashboardShell role="parent" title="מסמכים">
      <div className="parent-experience-shell">
        <div className="parent-page-head">
          <div>
            <p className="eyebrow">מסמכים ואישורים</p>
            <h1>כל מה שצריך לאשר או לשמור.</h1>
            <p>מסמכי בריאות, פרטיות, צילום ואישורי גן מסודרים לפי מה שדורש פעולה.</p>
          </div>
          <span className={needsAction.length ? "pill warn" : "pill good"}><FileText size={15} /> {needsAction.length ? "צריך פעולה" : "מסודר"}</span>
        </div>

        <section className="parent-metric-strip">
          <RoleMetricCard label="צריך פעולה" value={needsAction.length} tone={needsAction.length ? "warn" : "good"} />
          <RoleMetricCard label="חדשים" value={newDocs.length} tone={newDocs.length ? "default" : "good"} />
          <RoleMetricCard label="חתומים" value={signed.length} tone="good" />
          <RoleMetricCard label="סה״כ" value={rows.length} tone="default" />
        </section>

        <section className="dashboard-section">
          {rows.length === 0 ? <EmptyState title="אין מסמכים נדרשים כרגע" text="אם הגן יבקש אישור או ישתף מסמך, הוא יופיע כאן עם פעולה ברורה." /> : (
            <div className="parent-document-list">
              {rows.map((row) => (
                <article className="parent-document-card" key={row.id}>
                  <div>
                    <StatusBadge tone={docTone(row.status)}>{docStatusLabel(row.status)}</StatusBadge>
                    <h3>{row.name ?? row.document_type ?? "מסמך"}</h3>
                    <p>{row.document_type ?? "אישור משפחתי"}</p>
                    <small>{row.expires_at ? `בתוקף עד ${dateText(row.expires_at)}` : row.created_at ? `נוסף ${dateText(row.created_at)}` : ""}</small>
                  </div>
                  {row.file_url ? <Link className="button secondary" href={row.file_url}>פתיחה</Link> : <span className="pill">ממתין לקובץ</span>}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="parent-camera-promise">
          <article><TriangleAlert /><h2>צריך פעולה</h2><p>מסמך חסר, פג תוקף או דורש תיקון מופיע ראשון במדדים.</p></article>
          <article><Clock /><h2>ממתין לבדיקה</h2><p>מסמך שנשלח לגן נשאר במעקב עד אישור.</p></article>
          <article><CheckCircle2 /><h2>מאושר</h2><p>מסמכים חתומים ושמורים נשארים זמינים למשפחה.</p></article>
        </section>

        <section className="parent-trust-card">
          <ShieldCheck />
          <h2>פרטיות</h2>
          <p>הורה רואה רק מסמכים של הילדים שלו או מסמכים שהוא העלה. מסמכים פנימיים של הגן לא מוצגים כאן.</p>
        </section>
      </div>
    </DashboardShell>
  );
}
