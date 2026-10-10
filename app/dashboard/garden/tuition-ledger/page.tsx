import Link from "next/link";
import { PermissionDeniedState } from "@/components/global-state-system";
import { WalletCards } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { FinanceFrame } from "@/components/finance-platform-frame";
import { FinanceHero } from "@/components/finance-platform-ui";
import { TuitionLedgerPanel, type Enrollment, type Period, type TuitionEntry } from "@/components/tuition-ledger-panel";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { projectTuitionPeriod, type TuitionPeriod } from "@/lib/domain/tuition-ledger";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function GardenTuitionLedgerPage() {
  const access = await getManagementGardenContext();
  if (!access.allowed) return <PermissionDeniedState backHref="/dashboard/garden/finance" description="ספר החיובים זמין רק לבעלי תפקיד מורשים בגן הפעיל." />;
  const supabase = await createClient();
  const [periods, enrollments, garden, entries] = await Promise.all([
    supabase.from("tuition_billing_periods" as never)
      .select("id,garden_id,enrollment_id,child_id,period_start,period_end,due_at,base_amount,adjustment_total,settled_total,unapplied_credit_total,status,reconciliation_reason" as never)
      .eq("garden_id", access.gardenId).order("period_start", { ascending: false }).limit(200),
    supabase.from("child_kindergarten_enrollments" as never)
      .select("id,child_id,garden_id,children(full_name)" as never).eq("garden_id", access.gardenId).eq("status", "active").limit(200),
    supabase.from("gardens" as never).select("tuition_due_day,name" as never).eq("id", access.gardenId).maybeSingle(),
    supabase.from("tuition_ledger_entries" as never).select("id,period_id,entry_kind,amount,method,reason,created_at" as never).eq("garden_id", access.gardenId).order("created_at", { ascending: false }).limit(40)
  ]);
  const role = access.session.profile.role === "owner" ? "owner" : "manager";
  if (periods.error || enrollments.error || garden.error || entries.error) return <DashboardShell role={role} title="ספר חיובים"><p>ספר החיובים אינו זמין כרגע.</p></DashboardShell>;
  const initialPeriods = ((periods.data ?? []) as unknown as TuitionPeriod[]).map(period => projectTuitionPeriod(period)) as Period[];
  const initialEnrollments = (enrollments.data ?? []) as unknown as Enrollment[];
  const gardenData = garden.data as { tuition_due_day?: number | null; name?: string | null } | null;
  return <DashboardShell role={role} title="ספר חיובים" appHome>
    <FinanceFrame role={role} name={access.session.profile.full_name} avatarUrl={(access.session.profile as { profile_image_url?: string | null }).profile_image_url} activeHref="/dashboard/garden/finance" title="ספר שכר לימוד" subtitle="הורה ← גן · חיובים, תשלומים והתאמות">
      <FinanceHero eyebrow={gardenData?.name ?? "הגן הפעיל"} title="ספר שכר לימוד" text="ניהול תקופות חיוב, תשלומים חלקיים, הסדרים ידניים, זיכויים והתאמות מתוך מקור אמת אחד." action={<Link className="button secondary" href="/dashboard/garden/finance"><WalletCards size={18} /> חזרה למרכז הכספים</Link>} />
      <TuitionLedgerPanel initialPeriods={initialPeriods} initialEnrollments={initialEnrollments} initialEntries={(entries.data ?? []) as unknown as TuitionEntry[]} initialDueDay={gardenData?.tuition_due_day ?? null} />
    </FinanceFrame>
  </DashboardShell>;
}
