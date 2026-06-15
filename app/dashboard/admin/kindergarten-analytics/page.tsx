import Link from "next/link";
import { Building2, MapPinned, ShieldCheck } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { operationalDistrictForCity } from "@/lib/domain/kindergarten-onboarding";
import { createClient } from "@/lib/supabase/server";
import { statusTone } from "@/lib/domain/observer-calibration";

type CityRow = {
  city: string;
  district: string;
  total: number;
  active: number;
  pending: number;
  paymentPending: number;
  demoActive: number;
  frozen: number;
  rejected: number;
};

function statusLabel(status?: string | null) {
  const map: Record<string, string> = {
    activation_in_progress: "בהקמה",
    onboarding_submitted: "הוגש לאישור",
    pending_final_approval: "ממתין לאישור",
    payment_pending: "ממתין למנוי",
    demo_active: "דמו פעיל",
    active: "פעיל",
    frozen: "מוקפא",
    suspended: "מושהה",
    rejected: "נדחה",
    archived: "ארכיון"
  };
  return map[status ?? ""] ?? status ?? "לא צוין";
}

function buildCityRows(gardens: any[]) {
  const map = new Map<string, CityRow>();
  for (const garden of gardens) {
    const city = String(garden.city ?? "").trim() || "לא ידוע";
    const district = operationalDistrictForCity(city);
    const key = `${district}:${city}`;
    const row = map.get(key) ?? { city, district, total: 0, active: 0, pending: 0, paymentPending: 0, demoActive: 0, frozen: 0, rejected: 0 };
    const status = String(garden.approval_flow_status ?? garden.status ?? "");
    row.total += 1;
    if (status === "active") row.active += 1;
    if (["activation_in_progress", "onboarding_submitted", "pending_final_approval", "registration_pending", "pending"].includes(status)) row.pending += 1;
    if (status === "payment_pending") row.paymentPending += 1;
    if (status === "demo_active") row.demoActive += 1;
    if (["frozen", "suspended"].includes(status)) row.frozen += 1;
    if (status === "rejected") row.rejected += 1;
    map.set(key, row);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total || a.city.localeCompare(b.city, "he"));
}

export default async function AdminKindergartenAnalyticsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("kindergarten city analytics", async () => {
    const supabase = await createClient();
    const gardensRes = await supabase
      .from("gardens" as any)
      .select("id,name,city,address,approval_flow_status,status,public_profile_enabled,created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    logSupabaseError("kindergarten city analytics", gardensRes.error);
    const gardens = (gardensRes.data ?? []) as any[];
    return { gardens, rows: buildCityRows(gardens), queryError: gardensRes.error ? "חלק מנתוני הגנים לא נטענו" : null };
  }, { gardens: [] as any[], rows: [] as CityRow[], queryError: null as string | null });

  const rows = result.data.rows;
  const gardens = result.data.gardens;
  const total = gardens.length;
  const active = gardens.filter((garden: any) => garden.approval_flow_status === "active").length;
  const pending = gardens.filter((garden: any) => ["activation_in_progress", "onboarding_submitted", "pending_final_approval"].includes(String(garden.approval_flow_status))).length;
  const paymentPending = gardens.filter((garden: any) => garden.approval_flow_status === "payment_pending").length;

  return (
    <DashboardShell role="admin" title="אנליטיקת גנים">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="City & District Readiness"
          title="גנים לפי עיר ומחוז תפעולי"
          subtitle="מבט אדמין על פריסת גנים, סטטוס הפעלה ומוכנות אזורית. המחוז נגזר מהעיר ומשמש לתפעול פנימי בלבד."
          badge={`${rows.length} ערים`}
          badgeTone={rows.length ? "good" : "warn"}
          actions={<><Link className="button secondary" href="/dashboard/admin/kindergarten-applications">בקשות גנים</Link><Link className="button secondary" href="/dashboard/admin/kindergarten-activation">הפעלת גנים</Link></>}
        />
        <AdminDataError message={result.error ?? result.data.queryError} />
        <div className="premium-metric-grid">
          <RoleMetricCard label="סה״כ גנים" value={total} />
          <RoleMetricCard label="פעילים" value={active} tone={active ? "good" : "warn"} />
          <RoleMetricCard label="ממתינים לאישור" value={pending} tone={pending ? "warn" : "good"} />
          <RoleMetricCard label="ממתינים למנוי" value={paymentPending} tone={paymentPending ? "bad" : "good"} />
        </div>

        <CleanSection title="פריסה לפי עיר" subtitle="הכתובת הציבורית נשארת לפי כללי public-safe. כאן מוצגת תמונת תפעול לאדמין בלבד.">
          {rows.length === 0 ? <EmptyState title="אין נתוני גנים" text="לאחר פתיחת בקשות גן, הן יופיעו כאן לפי עיר ומחוז." /> : (
            <div className="analytics-region-grid kindergarten-city-analytics">
              {rows.map((row) => (
                <article key={`${row.district}-${row.city}`}>
                  <MapPinned />
                  <strong>{row.city}</strong>
                  <span>{row.district}</span>
                  <div className="lead-conversion-meta">
                    <small>סה״כ: {row.total}</small>
                    <small>פעילים: {row.active}</small>
                    <small>ממתינים: {row.pending}</small>
                    <small>מנוי: {row.paymentPending}</small>
                    <small>דמו: {row.demoActive}</small>
                    <small>מוקפאים/מושהים: {row.frozen}</small>
                    <small>נדחו: {row.rejected}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <CleanSection title="גנים אחרונים" subtitle="בדיקת סטטוס מהירה לפי רשומות קיימות.">
          <div className="procedure-list">
            {gardens.slice(0, 20).map((garden: any) => (
              <article className="card procedure-card" key={garden.id}>
                <div>
                  <StatusBadge tone={statusTone(garden.approval_flow_status)}>{statusLabel(garden.approval_flow_status)}</StatusBadge>
                  <h3>{garden.name}</h3>
                  <p>{garden.city ?? "עיר לא צוינה"} · {operationalDistrictForCity(garden.city)}</p>
                </div>
                <div className="procedure-meta">
                  <Building2 />
                  <span>{garden.public_profile_enabled ? "פרופיל ציבורי" : "לא ציבורי"}</span>
                </div>
              </article>
            ))}
          </div>
        </CleanSection>

        <section className="warning-banner"><ShieldCheck /> נתוני עיר/מחוז הם תפעוליים. פרסום כתובת לציבור נשאר תלוי באישור public-safe בלבד.</section>
      </div>
    </DashboardShell>
  );
}
