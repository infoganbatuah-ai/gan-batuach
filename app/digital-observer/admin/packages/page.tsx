import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { ObserverPackagesAdmin } from "@/components/observer-packages-admin";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DigitalObserverAdminPackagesPage() {
  const { profile } = await requireRole(["admin"], "/digital-observer/login?next=/digital-observer/admin/packages", "/digital-observer/dashboard");
  const supabase = await createClient();
  const [packages, sites, subscriptions, usage] = await Promise.all([
    supabase.from("observer_monitoring_packages" as any).select("*").order("sort_order", { ascending: true }),
    supabase.from("observer_sites" as any).select("id,name,site_type,active,observer_package_id,observer_subscription_status").neq("site_type", "kindergarten").order("name").limit(500),
    supabase.from("observer_site_subscriptions" as any).select("*,observer_sites(name,site_type),observer_monitoring_packages(name,package_type)").order("created_at", { ascending: false }).limit(300),
    supabase.from("observer_site_usage_snapshots" as any).select("*,observer_sites(name,site_type)").order("period_start", { ascending: false }).limit(300)
  ]);

  return <ObserverAppShell profile={profile} mode="business" activeHref="/digital-observer/admin/packages" title="חבילות ותמחור" statusLabel="מקור אמת במסד">
    <div className="do-page-stack do-admin-tools">
      <div className="do-notice warn"><span>שמירת חבילה אינה מפעילה חיוב חי. הפעלה מסחרית חסומה בשרת עד אישור מפורש וחיבור ספק.</span></div>
      {packages.error ? <div className="do-notice bad" role="alert"><span>החבילות אינן זמינות עד החלת המיגרציה העדכנית.</span></div> : null}
      <ObserverPackagesAdmin packages={packages.data ?? []} sites={sites.data ?? []} subscriptions={subscriptions.data ?? []} usage={usage.data ?? []} />
    </div>
  </ObserverAppShell>;
}
