import Link from "next/link";
import { ClipboardCheck, CreditCard, FileText, ShieldCheck } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { KindergartenApplicationAdminActions } from "@/components/kindergarten-application-admin-actions";
import { CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { scoreTone, statusTone } from "@/lib/domain/observer-calibration";

export const dynamic = "force-dynamic";

function money(value: unknown) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function dateText(value: unknown) {
  if (!value) return "-";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString("he-IL");
}

export default async function AdminKindergartenApplicationsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("kindergarten applications", async () => {
    const supabase = await createClient();
    const [gardensRes, onboardingRes, feeGroupsRes, ageSetupsRes, documentsRes, profilesRes, subscriptionsRes] = await Promise.all([
      supabase.from("gardens" as any).select("id,name,city,address,phone,email,owner_name,status,approval_flow_status,final_approval_status,manager_id,public_profile_enabled,admin_correction_note,created_at").in("approval_flow_status", ["activation_in_progress", "onboarding_submitted", "pending_final_approval", "correction_required", "payment_pending", "active", "suspended", "archived"]).order("created_at", { ascending: false }).limit(250),
      supabase.from("kindergarten_onboarding_records" as any).select("*").order("updated_at", { ascending: false }).limit(250),
      supabase.from("kindergarten_fee_groups" as any).select("id,garden_id,group_name,age_range,monthly_fee,show_price_public,capacity,active").order("group_name").limit(1000),
      supabase.from("kindergarten_age_group_setups" as any).select("garden_id,age_group,children_count,monthly_child_price,annual_child_price,billing_cycle").limit(1000),
      supabase.from("documents" as any).select("id,garden_id,name,document_type,status").limit(1000),
      supabase.from("profiles" as any).select("id,full_name,phone,email,self_service_role,self_service_status,active").limit(1000),
      supabase.from("kindergarten_subscriptions" as any).select("id,garden_id,status,billing_status,metadata,created_at").limit(500)
    ]);
    [gardensRes, onboardingRes, feeGroupsRes, ageSetupsRes, documentsRes, profilesRes, subscriptionsRes].forEach((query, index) => logSupabaseError(`kindergarten applications ${index}`, (query as any).error));
    const onboardingByGarden = new Map((onboardingRes.data ?? []).map((item: any) => [item.garden_id, item]));
    const profilesById = new Map((profilesRes.data ?? []).map((item: any) => [item.id, item]));
    const subscriptionsByGarden = new Map((subscriptionsRes.data ?? []).map((item: any) => [item.garden_id, item]));
    const feeGroupsByGarden = new Map<string, any[]>();
    for (const group of (feeGroupsRes.data ?? []) as any[]) {
      feeGroupsByGarden.set(group.garden_id, [...(feeGroupsByGarden.get(group.garden_id) ?? []), group]);
    }
    const ageSetupsByGarden = new Map<string, any[]>();
    for (const setup of (ageSetupsRes.data ?? []) as any[]) {
      ageSetupsByGarden.set(setup.garden_id, [...(ageSetupsByGarden.get(setup.garden_id) ?? []), setup]);
    }
    const documentsByGarden = new Map<string, any[]>();
    for (const doc of (documentsRes.data ?? []) as any[]) {
      documentsByGarden.set(doc.garden_id, [...(documentsByGarden.get(doc.garden_id) ?? []), doc]);
    }
    const rows = ((gardensRes.data ?? []) as any[]).map((garden) => ({
      ...garden,
      onboarding: onboardingByGarden.get(garden.id) ?? null,
      manager: profilesById.get(garden.manager_id) ?? null,
      subscription: subscriptionsByGarden.get(garden.id) ?? null,
      feeGroups: feeGroupsByGarden.get(garden.id) ?? [],
      ageSetups: ageSetupsByGarden.get(garden.id) ?? [],
      documents: documentsByGarden.get(garden.id) ?? []
    }));
    return {
      rows,
      queryError: [gardensRes.error, onboardingRes.error, feeGroupsRes.error, ageSetupsRes.error, documentsRes.error, profilesRes.error, subscriptionsRes.error].some(Boolean) ? "חלק מנתוני בקשות הגנים לא נטענו" : null
    };
  }, { rows: [] as any[], queryError: null as string | null });

  const rows = result.data.rows;
  const pendingReview = rows.filter((row) => ["onboarding_submitted", "pending_final_approval"].includes(String(row.approval_flow_status))).length;
  const paymentPending = rows.filter((row) => row.approval_flow_status === "payment_pending").length;
  const active = rows.filter((row) => row.approval_flow_status === "active").length;
  const avgProgress = rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.onboarding?.progress_percent ?? 0), 0) / rows.length) : 0;

  return (
    <DashboardShell role="admin" title="בקשות גנים">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Kindergarten Applications"
          title="אישור מנהלות, פרופיל גן ומנוי הפעלה"
          subtitle="מסלול רישום עצמי מוגבל: טיוטה, אשף, אישור אדמין, מנוי גן בטוח ואז הפעלה מלאה."
          badge={`${avgProgress}%`}
          badgeTone={scoreTone(avgProgress)}
          actions={<><Link className="button secondary" href="/dashboard/admin/kindergarten-activation">מרכז הפעלה</Link><Link className="button secondary" href="/dashboard/admin/billing">חיוב</Link></>}
        />
        <AdminDataError message={result.error ?? result.data.queryError} />

        <div className="premium-metric-grid">
          <RoleMetricCard label="ממתינות לאישור" value={pendingReview} hint="פרופיל נשלח לאדמין" tone={pendingReview ? "warn" : "good"} />
          <RoleMetricCard label="ממתינות למנוי" value={paymentPending} hint="אושרו אך לא פעילות" tone={paymentPending ? "warn" : "good"} />
          <RoleMetricCard label="פעילות" value={active} hint="תשלום/override תועד" tone="good" />
          <RoleMetricCard label="התקדמות ממוצעת" value={`${avgProgress}%`} hint="אשף מנהלת" tone={scoreTone(avgProgress)} />
        </div>

        <CleanSection title="בקשות גן" subtitle="מנהלת pending אינה מקבלת גישה מלאה. הורים רואים רק גנים פעילים ו-public-safe.">
          {rows.length === 0 ? <EmptyState title="אין בקשות גנים" text="בקשות מרישום עצמי או המרת ליד יופיעו כאן." /> : (
            <div className="procedure-list">
              {rows.map((row) => {
                const visiblePrices = row.feeGroups.filter((group: any) => group.show_price_public && group.active);
                return (
                  <article className="card procedure-card" key={row.id}>
                    <div>
                      <StatusBadge tone={statusTone(row.approval_flow_status)}>{row.approval_flow_status}</StatusBadge>
                      <h3>{row.name}</h3>
                      <p>{row.city ?? "עיר לא צוינה"} · {row.address ?? "כתובת לא צוינה"} · נוצר {dateText(row.created_at)}</p>
                      <div className="lead-conversion-meta">
                        <span>מנהלת: {row.manager?.full_name ?? row.owner_name ?? "לא צוינה"}</span>
                        <span>חשבון מנהלת: {row.manager?.active ? "פעיל" : "מוגבל/ממתין"}</span>
                        <span>מסמכים: {row.documents.length}</span>
                        <span>מנוי: {row.subscription?.status ?? "לא נוצר"}</span>
                        <span>מחיר גן בטוח: {money(row.onboarding?.subscription_monthly_amount ?? row.subscription?.metadata?.monthly_amount_nis ?? 800)}/חודש</span>
                      </div>
                      <div className="grid cols-2 dashboard-panels">
                        <article className="card action-panel">
                          <h4><ClipboardCheck size={16} /> קבוצות וכיתות</h4>
                          {(row.ageSetups.length ? row.ageSetups : row.feeGroups).slice(0, 6).map((item: any) => (
                            <p key={`${item.age_group ?? item.group_name}-${item.id ?? ""}`}>{item.age_group ?? item.group_name} · קיבולת {item.children_count ?? item.capacity ?? 0} · {money(item.monthly_child_price ?? item.monthly_fee ?? 0)}</p>
                          ))}
                          {!row.ageSetups.length && !row.feeGroups.length ? <p>טרם הוגדרו קבוצות.</p> : null}
                        </article>
                        <article className="card action-panel">
                          <h4><CreditCard size={16} /> מחירים להורים</h4>
                          {visiblePrices.length ? visiblePrices.map((group: any) => <p key={group.id}>{group.group_name}: {money(group.monthly_fee)}/חודש</p>) : <p>אין מחירים שפורסמו להורים.</p>}
                          <small>זהו שכר לימוד הורה לגן, לא מנוי Gan Batuach.</small>
                        </article>
                      </div>
                      {row.admin_correction_note ? <div className="warning-banner">{row.admin_correction_note}</div> : null}
                    </div>
                    <KindergartenApplicationAdminActions gardenId={row.id} status={row.approval_flow_status} />
                  </article>
                );
              })}
            </div>
          )}
        </CleanSection>

        <section className="quick-actions-grid">
          <Link className="card action-card" href="/dashboard/admin/document-center"><FileText /><strong>מסמכים</strong><span>בדיקת מסמכי גנים פרטיים</span></Link>
          <Link className="card action-card" href="/dashboard/admin/billing"><CreditCard /><strong>חיוב</strong><span>מנוי גן בטוח, לא תשלומי הורים</span></Link>
          <Link className="card action-card" href="/dashboard/admin/security-center"><ShieldCheck /><strong>אבטחה</strong><span>בדיקת הרשאות לפני הפעלה</span></Link>
        </section>
      </div>
    </DashboardShell>
  );
}
