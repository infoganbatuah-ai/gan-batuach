/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 41 rows precede generated Supabase types. */
import { Building2, ShieldCheck } from "lucide-react";
import { EnterpriseIdentityCenter } from "@/components/digital-observer/enterprise-identity-center";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { loadObserverRuntime, observerModeForSite, selectObserverSite } from "@/lib/domain/digital-observer/runtime";
import { createClient } from "@/lib/supabase/server";

export default async function DigitalObserverEnterprisePage({ searchParams }: { searchParams?: Promise<{ organization?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/enterprise");
  const runtime = await loadObserverRuntime(profile.id);
  const mode = observerModeForSite(selectObserverSite(runtime.sites, runtime.cameras));
  const supabase = await createClient();
  const result = await supabase.from("digital_observer_organizations" as any)
    .select("id,name,organization_type,status,default_timezone,support_tier").eq("status", "active").order("name").limit(100);
  const organizations = (result.data ?? []) as any[];
  const selected = organizations.some((item) => item.id === params.organization) ? params.organization! : organizations[0]?.id ?? null;
  return <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/enterprise" title="ארגון ואבטחה" statusLabel="Enterprise מוגן">
    <div className="do-page-stack">
      <div className="do-notice info"><ShieldCheck /><span>ניהול הארגון מופרד לפי ארגון ואתר. הרשאות חיוב אינן מעניקות גישה למצלמות או לחקירה.</span></div>
      {selected ? <EnterpriseIdentityCenter organizations={organizations} organizationId={selected} /> : <section className="do-panel do-empty">
        <Building2 /><strong>אין ארגון זמין לחשבון</strong><span>לקוחות פרטיים ממשיכים להשתמש במסלול הרגיל. הקמת ארגון Enterprise נעשית רק בתהליך מורשה.</span>
      </section>}
    </div>
  </ObserverAppShell>;
}
