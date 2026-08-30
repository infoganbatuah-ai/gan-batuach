import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { KindergartenCreationWizard, InspectorCreationWizard } from "@/components/admin-user-creation-wizards";
import { requireRole } from "@/lib/auth";
import { isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";

export default async function NewInspectorPage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const configured = isAdminClientConfigured();
  const result = await safeAdminData("new inspector", async () => {
    const supabase = await createClient();
    const [leadRes, gardensRes] = await Promise.all([params.leadId ? supabase.from("leads" as any).select("*").eq("id", params.leadId).maybeSingle() : Promise.resolve({ data: null, error: null }), supabase.from("gardens" as any).select("id, name, city").eq("status", "active")]);
    logSupabaseError("new inspector lead", leadRes.error); logSupabaseError("new inspector gardens", gardensRes.error);
    return { lead: leadRes.data as any, gardens: (gardensRes.data ?? []) as any[], queryError: leadRes.error || gardensRes.error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { lead: null as any, gardens: [] as any[], queryError: null as string | null });
  return <DashboardShell role="admin" title="הוספת מפקח"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Create Inspector</p><h1>השלמת פרטים לפני יצירת פקח פעיל.</h1><p>לא נוצר Auth user עד שליחת הטופס הסופית.</p></div><span className={configured ? "pill good" : "pill bad"}>{configured ? "מוכן ליצירה" : "Service Role חסר"}</span></div>{!configured ? <div className="error-banner">SUPABASE_SERVICE_ROLE_KEY חסר. ניתן למלא את הטופס, אך יצירה סופית תיכשל עד שהמפתח יוגדר ב-Vercel.</div> : null}<AdminDataError message={result.error ?? result.data.queryError} /><InspectorCreationWizard lead={result.data.lead} gardens={result.data.gardens} /></DashboardShell>;
}
