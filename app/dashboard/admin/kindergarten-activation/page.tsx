import Link from "next/link";
import { CheckCircle2, CreditCard, FileText, ShieldCheck, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { scoreTone, statusTone } from "@/lib/domain/observer-calibration";

function money(value: unknown) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

export default async function AdminKindergartenActivationPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("kindergarten activation", async () => {
    const supabase = await createClient();
    const [onboardingRes, gardensRes, subscriptionsRes] = await Promise.all([
      supabase.from("kindergarten_onboarding_records" as any).select("*").order("updated_at", { ascending: false }).limit(200),
      supabase.from("gardens" as any).select("id,name,city,phone,email,approval_flow_status,final_approval_status,status,manager_id,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("kindergarten_subscriptions" as any).select("*").order("created_at", { ascending: false }).limit(200)
    ]);
    [onboardingRes, gardensRes, subscriptionsRes].forEach((query, index) => logSupabaseError(`kindergarten activation ${index}`, (query as any).error));
    const gardens = (gardensRes.data ?? []) as any[];
    const subscriptionsByGarden = new Map((subscriptionsRes.data ?? []).map((subscription: any) => [subscription.garden_id, subscription]));
    const onboardingByGarden = new Map((onboardingRes.data ?? []).map((record: any) => [record.garden_id, record]));
    const rows = gardens.map((garden) => ({
      ...garden,
      onboarding: onboardingByGarden.get(garden.id) ?? null,
      subscription: subscriptionsByGarden.get(garden.id) ?? null
    }));
    return {
      rows,
      queryError: [onboardingRes.error, gardensRes.error, subscriptionsRes.error].some(Boolean) ? "חלק מנתוני ההפעלה לא נטענו" : null
    };
  }, { rows: [] as any[], queryError: null as string | null });

  const rows = result.data.rows;
  const pending = rows.filter((row) => ["registration_pending", "admin_approved", "activation_in_progress", "payment_pending"].includes(String(row.approval_flow_status))).length;
  const active = rows.filter((row) => row.approval_flow_status === "active").length;
  const paymentPending = rows.filter((row) => row.approval_flow_status === "payment_pending" || row.subscription?.status === "pending_payment").length;
  const averageProgress = rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.onboarding?.progress_percent ?? 0), 0) / rows.length) : 0;

  return (
    <DashboardShell role="admin" title="הפעלת גנים">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Kindergarten Activation"
          title="אישור, אונבורדינג ותשלום עד הפעלה מלאה"
          subtitle="תצוגת אדמין לכל גן: רישום, פרטי מנהלת, התקדמות אשף, מסמכים, תשלום, חוב וסטטוס פתיחה."
          badge={`${averageProgress}%`}
          badgeTone={scoreTone(averageProgress)}
          actions={<><Link className="button primary" href="/dashboard/admin/leads">לידים</Link><Link className="button secondary" href="/dashboard/admin/billing">חיוב</Link></>}
        />
        <AdminDataError message={result.error ?? result.data.queryError} />
        <div className="premium-metric-grid">
          <RoleMetricCard label="בתהליך" value={pending} hint="לא פעילים עדיין" tone={pending ? "warn" : "good"} />
          <RoleMetricCard label="ממתינים לתשלום" value={paymentPending} hint="נדרש מנוי שנתי" tone={paymentPending ? "bad" : "good"} />
          <RoleMetricCard label="פעילים" value={active} hint="עברו הפעלה מלאה" tone="good" />
          <RoleMetricCard label="התקדמות ממוצעת" value={`${averageProgress}%`} hint="אשף הפעלה" tone={scoreTone(averageProgress)} />
        </div>

        <CleanSection title="גנים בתהליך" subtitle="גן אינו פעיל עד אישור, אשף, צוות, ילדים, הורים, מסמכים ותשלום.">
          {rows.length === 0 ? <EmptyState title="אין גנים להצגה" text="לאחר רישום ציבורי או המרת ליד יופיעו כאן גנים." /> : (
            <div className="procedure-list">
              {rows.map((row) => {
                const profileData = row.onboarding?.profile_data ?? {};
                return (
                  <article className="card procedure-card" key={row.id}>
                    <div>
                      <StatusBadge tone={statusTone(row.approval_flow_status)}>{row.approval_flow_status ?? row.status}</StatusBadge>
                      <h3>{row.name}</h3>
                      <p>{row.city || "עיר לא צוינה"} · {row.email || row.phone || "אין קשר"}</p>
                      <div className="lead-conversion-meta">
                        <span>צוות: {profileData.current_staff ?? 0}/{profileData.required_staff ?? 0}</span>
                        <span>מסמכים: {Array.isArray(profileData.uploaded_document_categories) ? profileData.uploaded_document_categories.length : 0}</span>
                        <span>תשלום: {row.onboarding?.payment_status ?? row.subscription?.status ?? "לא התחיל"}</span>
                        <span>מנוי: {money(row.onboarding?.subscription_monthly_amount ?? 0)}/חודש</span>
                      </div>
                    </div>
                    <div className="procedure-meta">
                      <strong>{row.onboarding?.progress_percent ?? 0}%</strong>
                      <span>{row.final_approval_status ?? "-"}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="לידים לאישור" text="אישור או בקשת מידע נוסף" href="/dashboard/admin/leads" icon={UsersRound} />
          <ActionCard title="מסמכים" text="בדיקה, אישור והחלפה" href="/dashboard/admin/document-center" icon={FileText} />
          <ActionCard title="חיוב" text="מנוי שנתי ותשלומים" href="/dashboard/admin/billing" icon={CreditCard} />
          <ActionCard title="בדיקות הפעלה" text="מה חסר לפני פעילות" href="/dashboard/admin/launch-readiness" icon={CheckCircle2} />
          <ActionCard title="אמנת שירות" text="אחריות ורגולציה" href="/service-charter" icon={ShieldCheck} />
        </section>
      </div>
    </DashboardShell>
  );
}
