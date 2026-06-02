import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ObserverPackagesAdmin } from "@/components/observer-packages-admin";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminObserverPackagesPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("observer packages", async () => {
    const supabase = await createClient();
    const [packages, sites, subscriptions, usage] = await Promise.all([
      supabase.from("observer_monitoring_packages" as any).select("*").order("sort_order", { ascending: true }),
      supabase.from("observer_sites" as any).select("id, name, site_type, active, observer_package_id, observer_subscription_status").order("name", { ascending: true }).limit(500),
      supabase.from("observer_site_subscriptions" as any).select("*, observer_sites(name, site_type), observer_monitoring_packages(name, package_type)").order("created_at", { ascending: false }).limit(300),
      supabase.from("observer_site_usage_snapshots" as any).select("*, observer_sites(name, site_type)").order("period_start", { ascending: false }).limit(300)
    ]);
    [packages, sites, subscriptions, usage].forEach((query, index) => logSupabaseError("observer packages query " + index, query.error));
    return {
      packages: packages.data ?? [],
      sites: sites.data ?? [],
      subscriptions: subscriptions.data ?? [],
      usage: usage.data ?? [],
      queryError: packages.error ? "לא ניתן לטעון חבילות Digital Observer כרגע" : null
    };
  }, { packages: [] as any[], sites: [] as any[], subscriptions: [] as any[], usage: [] as any[], queryError: null as string | null });

  return (
    <DashboardShell role="admin" title="Observer Packages">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Future standalone product</p>
          <h1>חבילות Digital Observer למוצר העצמאי העתידי.</h1>
          <p>גן בטוח נשאר במחיר קבוע של 700 ש״ח לחודש לגן, כולל תצפיתן דיגיטלי. החבילות כאן מיועדות לבתים, עסקים, משרדים, מחסנים וחניונים בעתיד.</p>
        </div>
        <span className="pill warn">לא מיועד ל-upsell בגני ילדים</span>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />
      <ObserverPackagesAdmin
        packages={result.data.packages}
        sites={result.data.sites}
        subscriptions={result.data.subscriptions}
        usage={result.data.usage}
      />
    </DashboardShell>
  );
}
