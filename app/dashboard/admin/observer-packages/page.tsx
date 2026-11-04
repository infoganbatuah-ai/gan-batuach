import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ObserverPackagesAdmin } from "@/components/observer-packages-admin";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function safeQuery<T>(run: () => PromiseLike<{ data: T[] | null; error: unknown }>) {
  try {
    const result = await run();
    return { rows: result.error ? [] : result.data ?? [], error: result.error, failed: Boolean(result.error) };
  } catch (error) {
    return { rows: [], error, failed: true };
  }
}

export default async function AdminObserverPackagesPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("observer packages", async () => {
    const supabase = await createClient();
    const [packages, sites, subscriptions, usage] = await Promise.all([
      safeQuery(() => supabase.from("observer_monitoring_packages" as any).select("*").order("sort_order", { ascending: true })),
      safeQuery(() => supabase.from("observer_sites" as any).select("id, name, site_type, active, observer_package_id, observer_subscription_status").order("name", { ascending: true }).limit(500)),
      safeQuery(() => supabase.from("observer_site_subscriptions" as any).select("*, observer_sites(name, site_type), observer_monitoring_packages(name, package_type)").order("created_at", { ascending: false }).limit(300)),
      safeQuery(() => supabase.from("observer_site_usage_snapshots" as any).select("*, observer_sites(name, site_type)").order("period_start", { ascending: false }).limit(300))
    ]);
    [packages, sites, subscriptions, usage].forEach((query, index) => logSupabaseError("observer packages query " + index, query.error));
    return {
      packages: packages.rows,
      sites: sites.rows,
      subscriptions: subscriptions.rows,
      usage: usage.rows,
      errors: [packages, sites, subscriptions, usage].map((query) => query.failed)
    };
  }, { packages: [] as any[], sites: [] as any[], subscriptions: [] as any[], usage: [] as any[], errors: [true, true, true, true] });

  return (
    <DashboardShell role="admin" title="חבילות התצפיתן">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">מוצר עצמאי</p>
          <h1>חבילות התצפיתן הדיגיטלי.</h1>
          <p>גן בטוח נשאר בזרם חיוב נפרד וכולל את מנוע התצפיתן לגן. החבילות כאן מיועדות רק ללקוחות הביתיים והעסקיים של התצפיתן העצמאי.</p>
        </div>
        <span className="pill warn">לא מיועד ל-upsell בגני ילדים</span>
      </div>
      <AdminDataError message={result.error ?? (result.data.errors.some(Boolean) ? "חלק מנתוני החבילות אינם זמינים כרגע" : null)} />
      <ObserverPackagesAdmin
        packages={result.data.packages}
        sites={result.data.sites}
        subscriptions={result.data.subscriptions}
        usage={result.data.usage}
        errors={result.data.errors}
      />
    </DashboardShell>
  );
}
