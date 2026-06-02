import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { KindergartenCreationWizard, InspectorCreationWizard } from "@/components/admin-user-creation-wizards";
import { requireRole } from "@/lib/auth";
import { isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";

export default async function NewKindergartenPage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const configured = isAdminClientConfigured();
  const result = await safeAdminData("new kindergarten", async () => {
    const supabase = await createClient();
    const [leadRes, inspectorsRes] = await Promise.all([params.leadId ? supabase.from("leads" as any).select("*").eq("id", params.leadId).maybeSingle() : Promise.resolve({ data: null, error: null }), supabase.from("profiles" as any).select("id, full_name").eq("role", "inspector")]);
    logSupabaseError("new kindergarten lead", leadRes.error); logSupabaseError("new kindergarten inspectors", inspectorsRes.error);
    return { lead: leadRes.data as any, inspectors: (inspectorsRes.data ?? []) as any[], queryError: leadRes.error || inspectorsRes.error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { lead: null as any, inspectors: [] as any[], queryError: null as string | null });
  return <DashboardShell role="admin" title="הוספת גן ילדים"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Create Kindergarten</p><h1>השלמת פרטים לפני המרה לגן פעיל.</h1><p>לא נוצרים משתמשים עד שליחת הטופס הסופית.</p></div><span className={configured ? "pill good" : "pill bad"}>{configured ? "מוכן ליצירה" : "Service Role חסר"}</span></div>{!configured ? <div className="error-banner">SUPABASE_SERVICE_ROLE_KEY חסר. ניתן למלא את הטופס, אך יצירה סופית תיכשל עד שהמפתח יוגדר ב-Vercel.</div> : null}<AdminDataError message={result.error ?? result.data.queryError} /><KindergartenCreationWizard lead={result.data.lead} inspectors={result.data.inspectors} /></DashboardShell>;
}
