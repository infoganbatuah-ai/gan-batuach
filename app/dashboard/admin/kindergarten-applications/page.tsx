import Link from "next/link";
import { ClipboardCheck, CreditCard, FileText, ShieldCheck } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { AdminAppFrame } from "@/components/admin-app-ui";
import { KindergartenApplicationAdminActions } from "@/components/kindergarten-application-admin-actions";
import { DashboardGrid, EmptyState, MetricCard, PremiumCard, SectionHeader, StatusChip } from "@/components/gan-batuach-design-system";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(value: unknown) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function dateText(value: unknown) {
  if (!value) return "-";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString("he-IL");
}

function formatApprovalStatus(status?: string | null) {
  const map: Record<string, string> = {
    activation_in_progress: "בתהליך הקמה",
    onboarding_submitted: "הוגש לאדמין",
    pending_final_approval: "ממתין לאישור סופי",
    correction_required: "נדרש תיקון",
    payment_pending: "ממתין למנוי",
    active: "פעיל",
    approved: "מאושר",
    suspended: "מושהה",
    archived: "הוצא מהמערכת",
    draft: "טיוטה",
    submitted: "נשלח"
  };
  return map[status ?? ""] ?? status ?? "-";
}

function approvalTone(status?: string | null): "success" | "warning" | "danger" | "primary" | "muted" {
  const value = String(status ?? "");
  if (["active", "approved"].includes(value)) return "success";
  if (["rejected", "suspended", "archived"].includes(value)) return "danger";
  if (["correction_required", "payment_pending", "pending_final_approval", "onboarding_submitted"].includes(value)) return "warning";
  return "primary";
}

function progressTone(value: number): "success" | "warning" | "danger" | "primary" {
  if (value >= 80) return "success";
  if (value >= 45) return "warning";
  if (value > 0) return "primary";
  return "danger";
}

export default async function AdminKindergartenApplicationsPage() {
  const { profile } = await requireRole(["admin"]);
  const result = await safeAdminData("kindergarten applications", async () => {
    const supabase = await createClient();
    async function settle<T>(label: string, query: () => PromiseLike<{ data: T | null; error: unknown }>) {
      const settled = await safeAdminData(label, async () => {
        const response = await query();
        logSupabaseError(label, response.error);
        return { data: response.error ? null : response.data, available: !response.error };
      }, { data: null, available: false });
      return settled.data;
    }
    const [gardensRes, onboardingRes, feeGroupsRes, ageSetupsRes, documentsRes, profilesRes, subscriptionsRes] = await Promise.all([
      settle("kindergarten applications gardens", () => supabase.from("gardens" as any).select("id,name,city,address,phone,email,owner_name,status,approval_flow_status,final_approval_status,manager_id,public_profile_enabled,admin_correction_note,created_at").in("approval_flow_status", ["activation_in_progress", "onboarding_submitted", "pending_final_approval", "correction_required", "payment_pending", "active", "suspended", "archived"]).order("created_at", { ascending: false }).limit(250)),
      settle("kindergarten applications onboarding", () => supabase.from("kindergarten_onboarding_records" as any).select("*").order("updated_at", { ascending: false }).limit(250)),
      settle("kindergarten applications fees", () => supabase.from("kindergarten_fee_groups" as any).select("id,garden_id,group_name,age_range,monthly_fee,show_price_public,capacity,active").order("group_name").limit(1000)),
      settle("kindergarten applications ages", () => supabase.from("kindergarten_age_group_setups" as any).select("garden_id,age_group,children_count,monthly_child_price,annual_child_price,billing_cycle").limit(1000)),
      settle("kindergarten applications documents", () => supabase.from("documents" as any).select("id,garden_id,name,document_type,status").limit(1000)),
      settle("kindergarten applications profiles", () => supabase.from("profiles" as any).select("id,full_name,phone,email,self_service_role,self_service_status,active").limit(1000)),
      settle("kindergarten applications subscriptions", () => supabase.from("kindergarten_subscriptions" as any).select("id,garden_id,status,billing_status,metadata,created_at").limit(500))
    ]);
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
      available: { gardens: gardensRes.available, onboarding: onboardingRes.available, fees: feeGroupsRes.available, ages: ageSetupsRes.available, documents: documentsRes.available, profiles: profilesRes.available, subscriptions: subscriptionsRes.available },
      queryError: [gardensRes, onboardingRes, feeGroupsRes, ageSetupsRes, documentsRes, profilesRes, subscriptionsRes].some((source) => !source.available) ? "חלק מנתוני בקשות הגנים לא נטענו" : null
    };
  }, { rows: [] as any[], available: { gardens: false, onboarding: false, fees: false, ages: false, documents: false, profiles: false, subscriptions: false }, queryError: null as string | null });

  const rows = result.data.rows;
  const available = result.data.available;
  const progressAvailable = available.gardens && available.onboarding;
  const pendingReview = rows.filter((row) => ["onboarding_submitted", "pending_final_approval"].includes(String(row.approval_flow_status))).length;
  const paymentPending = rows.filter((row) => row.approval_flow_status === "payment_pending").length;
  const active = rows.filter((row) => row.approval_flow_status === "active").length;
  const avgProgress = rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.onboarding?.progress_percent ?? 0), 0) / rows.length) : 0;

  return (
    <AdminAppFrame profile={profile} activeHref="/dashboard/admin/kindergarten-applications" title="קליטת גנים ומעקב ניסיון" subtitle="מעקב תפעולי אחר הקמה, מסמכים, מחירי הורים ותקופת ניסיון — ללא שער אישור אדמין ברישום." badge="קליטה">
      <div className="commercial-dashboard">
        <PremiumCard size="lg" className="admin-section-card">
          <SectionHeader
            eyebrow="בקשות גנים"
            title="הקמת גנים, תקופת ניסיון ומוכנות תפעולית"
            subtitle="המנהלת משלימה רישום רציף ומתחילה 14 ימי ניסיון. האדמין מנטר, מסייע ויכול לחסום במקרה חריג — אינו שער חובה להפעלה."
            icon={ClipboardCheck}
            action={<><Link className="admin-link-button" href="/dashboard/admin/kindergarten-activation">מרכז הפעלה</Link><Link className="admin-link-button" href="/dashboard/admin/billing">חיוב</Link></>}
          />
          <StatusChip tone={progressAvailable ? progressTone(avgProgress) : "muted"}>{progressAvailable ? `${avgProgress}% התקדמות ממוצעת` : "התקדמות ממוצעת לא זמינה"}</StatusChip>
        </PremiumCard>
        <AdminDataError message={result.error ?? result.data.queryError} />

        <DashboardGrid columns={4}>
          <MetricCard label="רישומים ישנים לבדיקה" value={available.gardens ? pendingReview : "לא זמין"} hint="Legacy בלבד; לא שער בזרימה החדשה" tone={available.gardens ? pendingReview ? "warning" : "success" : "muted"} icon={ClipboardCheck} />
          <MetricCard label="לקראת הסדרת מנוי" value={available.gardens ? paymentPending : "לא זמין"} hint="Trial / ספק תשלום" tone={available.gardens ? paymentPending ? "warning" : "success" : "muted"} icon={CreditCard} />
          <MetricCard label="פעילות או בניסיון" value={available.gardens ? active : "לא זמין"} hint="סטטוס הגן פעיל" tone={available.gardens ? "success" : "muted"} icon={ShieldCheck} />
          <MetricCard label="התקדמות ממוצעת" value={progressAvailable ? `${avgProgress}%` : "לא זמין"} hint="אשף מנהלת" tone={progressAvailable ? progressTone(avgProgress) : "muted"} icon={ClipboardCheck} />
        </DashboardGrid>

        <PremiumCard className="admin-section-card" size="lg">
          <SectionHeader title="גנים בתהליך קליטה" subtitle="הורים רואים רק גנים פעילים שהמנהלת בחרה לפרסם. סטטוס ניסיון אינו נספר כהכנסה פעילה." icon={ClipboardCheck} />
          {!available.gardens ? <p className="empty-state">נתוני בקשות הגנים אינם זמינים כרגע.</p> : rows.length === 0 ? <EmptyState title="אין בקשות גנים" text="בקשות מרישום עצמי או המרת ליד יופיעו כאן." /> : (
            <div className="procedure-list">
              {rows.map((row) => {
                const visiblePrices = row.feeGroups.filter((group: any) => group.show_price_public && group.active);
                const groupsAvailable = available.ages && (row.ageSetups.length > 0 || available.fees);
                const amountAvailable = available.onboarding && (row.onboarding?.subscription_monthly_amount != null || available.subscriptions);
                return (
                  <article className="card procedure-card" key={row.id}>
                    <div>
                      <StatusChip tone={approvalTone(row.approval_flow_status)}>{formatApprovalStatus(row.approval_flow_status)}</StatusChip>
                      <h3>{row.name}</h3>
                      <p>{row.city ?? "עיר לא צוינה"} · {row.address ?? "כתובת לא צוינה"} · נוצר {dateText(row.created_at)}</p>
                      <div className="lead-conversion-meta">
                        <span>מנהלת: {available.profiles ? row.manager?.full_name ?? row.owner_name ?? "לא צוינה" : "לא זמין"}</span>
                        <span>חשבון מנהלת: {available.profiles ? row.manager?.active ? "פעיל" : "דורש טיפול" : "לא זמין"}</span>
                      <span>מסמכים: {available.documents ? row.documents.length : "לא זמין"}</span>
                        <span>מנוי: {available.subscriptions ? formatApprovalStatus(row.subscription?.status) ?? "לא נוצר" : "לא זמין"}</span>
                        <span>מחיר גן בטוח לאחר ניסיון: {amountAvailable ? `${money(row.onboarding?.subscription_monthly_amount ?? row.subscription?.metadata?.monthly_amount_nis ?? 700)}/חודש` : "לא זמין"}</span>
                      </div>
                      <div className="grid cols-2 dashboard-panels">
                        <article className="card action-panel">
                          <h4><ClipboardCheck size={16} /> קבוצות וכיתות</h4>
                          {groupsAvailable ? (row.ageSetups.length ? row.ageSetups : row.feeGroups).slice(0, 6).map((item: any) => (
                            <p key={`${item.age_group ?? item.group_name}-${item.id ?? ""}`}>{item.age_group ?? item.group_name} · קיבולת {item.children_count ?? item.capacity ?? 0} · {money(item.monthly_child_price ?? item.monthly_fee ?? 0)}</p>
                          )) : <p>נתוני קבוצות אינם זמינים כרגע.</p>}
                          {groupsAvailable && !row.ageSetups.length && !row.feeGroups.length ? <p>טרם הוגדרו קבוצות.</p> : null}
                        </article>
                        <article className="card action-panel">
                          <h4><CreditCard size={16} /> מחירים להורים</h4>
                          {!available.fees ? <p>מחירי הורים אינם זמינים כרגע.</p> : visiblePrices.length ? visiblePrices.map((group: any) => <p key={group.id}>{group.group_name}: {money(group.monthly_fee)}/חודש</p>) : <p>אין מחירים שפורסמו להורים.</p>}
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
        </PremiumCard>

        <section className="quick-actions-grid">
          <Link className="card action-card" href="/dashboard/admin/document-center"><FileText /><strong>מסמכים</strong><span>בדיקת מסמכי גנים פרטיים</span></Link>
          <Link className="card action-card" href="/dashboard/admin/billing"><CreditCard /><strong>חיוב</strong><span>מנוי גן בטוח, לא תשלומי הורים</span></Link>
          <Link className="card action-card" href="/dashboard/admin/security-center"><ShieldCheck /><strong>אבטחה</strong><span>בדיקת הרשאות לפני הפעלה</span></Link>
        </section>
      </div>
    </AdminAppFrame>
  );
}
