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
    const errors = [onboardingRes, gardensRes, subscriptionsRes].map((query) => Boolean(query.error));
    const gardens = (gardensRes.error ? [] : gardensRes.data ?? []) as any[];
    const subscriptionsByGarden = new Map((subscriptionsRes.error ? [] : subscriptionsRes.data ?? []).map((subscription: any) => [subscription.garden_id, subscription]));
    const onboardingByGarden = new Map((onboardingRes.error ? [] : onboardingRes.data ?? []).map((record: any) => [record.garden_id, record]));
    const rows = gardens.map((garden) => ({
      ...garden,
      onboarding: onboardingByGarden.get(garden.id) ?? null,
      subscription: subscriptionsByGarden.get(garden.id) ?? null
    }));
    return {
      rows,
      errors,
      queryError: [onboardingRes.error, gardensRes.error, subscriptionsRes.error].some(Boolean) ? "חלק מנתוני ההפעלה לא נטענו" : null
    };
  }, { rows: [] as any[], errors: [true, true, true], queryError: null as string | null });

  const rows = result.data.rows;
  const [onboardingError, gardensError, subscriptionsError] = result.data.errors;
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
          badge={gardensError || onboardingError ? "לא זמין" : `${averageProgress}%`}
          badgeTone={gardensError || onboardingError ? "warn" : scoreTone(averageProgress)}
          actions={<><Link className="button primary" href="/dashboard/admin/leads">לידים</Link><Link className="button secondary" href="/dashboard/admin/billing">חיוב</Link></>}
        />
        <AdminDataError message={result.error ?? result.data.queryError} />
        <div className="premium-metric-grid">
          <RoleMetricCard label="בתהליך" value={gardensError ? "לא זמין" : pending} hint="לא פעילים עדיין" tone={gardensError || pending ? "warn" : "good"} />
          <RoleMetricCard label="ממתינים לתשלום" value={gardensError || subscriptionsError ? "לא זמין" : paymentPending} hint="נדרש מנוי שנתי" tone={gardensError || subscriptionsError ? "warn" : paymentPending ? "bad" : "good"} />
          <RoleMetricCard label="פעילים" value={gardensError ? "לא זמין" : active} hint="סטטוס שמור" tone={gardensError ? "warn" : "good"} />
          <RoleMetricCard label="התקדמות ממוצעת" value={gardensError || onboardingError ? "לא זמין" : `${averageProgress}%`} hint="אשף הפעלה" tone={gardensError || onboardingError ? "warn" : scoreTone(averageProgress)} />
        </div>

        <CleanSection title="גנים בתהליך" subtitle="גן אינו פעיל עד אישור, אשף, צוות, ילדים, הורים, מסמכים ותשלום.">
          {gardensError ? <div className="empty-mini">נתוני הגנים אינם זמינים.</div> : rows.length === 0 ? <EmptyState title="אין גנים להצגה" text="לאחר רישום ציבורי או המרת ליד יופיעו כאן גנים." /> : (
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
                        <span>צוות: {onboardingError ? "לא זמין" : `${profileData.current_staff ?? 0}/${profileData.required_staff ?? 0}`}</span>
                        <span>מסמכים: {onboardingError ? "לא זמין" : Array.isArray(profileData.uploaded_document_categories) ? profileData.uploaded_document_categories.length : 0}</span>
                        <span>תשלום: {onboardingError || (row.onboarding?.payment_status == null && subscriptionsError) ? "לא זמין" : row.onboarding?.payment_status ?? row.subscription?.status ?? "לא התחיל"}</span>
                        <span>מנוי: {onboardingError ? "לא זמין" : `${money(row.onboarding?.subscription_monthly_amount ?? 0)}/חודש`}</span>
                      </div>
                    </div>
                    <div className="procedure-meta">
                      <strong>{onboardingError ? "לא זמין" : `${row.onboarding?.progress_percent ?? 0}%`}</strong>
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
