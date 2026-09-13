import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { TuitionLedgerPanel, type Enrollment, type Period } from "@/components/tuition-ledger-panel";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { projectTuitionPeriod, type TuitionPeriod } from "@/lib/domain/tuition-ledger";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function GardenTuitionLedgerPage() {
  const access = await getManagementGardenContext();
  if (!access.allowed) return <main className="card">אין הרשאה לצפות בספר החיובים. <Link href="/dashboard/garden/finance">חזרה לכספים</Link></main>;
  const supabase = await createClient();
  const [periods, enrollments, garden] = await Promise.all([
    supabase.from("tuition_billing_periods" as never)
      .select("id,garden_id,enrollment_id,child_id,period_start,period_end,due_at,base_amount,adjustment_total,settled_total,unapplied_credit_total,status,reconciliation_reason" as never)
      .eq("garden_id", access.gardenId).order("period_start", { ascending: false }).limit(200),
    supabase.from("child_kindergarten_enrollments" as never)
      .select("id,child_id,garden_id,children(full_name)" as never).eq("garden_id", access.gardenId).eq("status", "active").limit(200),
    supabase.from("gardens" as never).select("tuition_due_day" as never).eq("id", access.gardenId).maybeSingle()
  ]);
  const role = access.session.profile.role === "owner" ? "owner" : "manager";
  if (periods.error || enrollments.error || garden.error) return <DashboardShell role={role} title="ספר חיובים"><p>ספר החיובים אינו זמין כרגע.</p></DashboardShell>;
  const initialPeriods = ((periods.data ?? []) as unknown as TuitionPeriod[]).map(period => projectTuitionPeriod(period)) as Period[];
  const initialEnrollments = (enrollments.data ?? []) as unknown as Enrollment[];
  return <DashboardShell role={role} title="ספר חיובים" appHome>
    <Link className="button secondary" href="/dashboard/garden/finance">חזרה למרכז כספים</Link>
    <TuitionLedgerPanel initialPeriods={initialPeriods} initialEnrollments={initialEnrollments} initialDueDay={(garden.data as { tuition_due_day?: number | null } | null)?.tuition_due_day ?? null} />
  </DashboardShell>;
}
