import Link from "next/link";
import { Bell, Camera, ShieldCheck, UserRound } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DigitalObserverOwnerDashboardPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();
  const [ownedSites, memberships] = await Promise.all([
    supabase.from("observer_sites" as any).select("id, name, site_type, active, monitoring_enabled, observer_subscription_status").eq("owner_profile_id", profile.id).neq("site_type", "kindergarten").limit(50),
    supabase.from("observer_site_memberships" as any).select("observer_site_id, member_role, observer_sites(id, name, site_type, active, monitoring_enabled, observer_subscription_status)").eq("profile_id", profile.id).eq("active", true).limit(50)
  ]);
  const directSites = ownedSites.data ?? [];
  const memberSites = (memberships.data ?? []).map((membership: any) => membership.observer_sites).filter(Boolean);
  const siteMap = new Map<string, any>();
  [...directSites, ...memberSites].forEach((site: any) => {
    if (site?.id && site.site_type !== "kindergarten") siteMap.set(site.id, site);
  });
  const sites = Array.from(siteMap.values());

  return (
    <>
      <BrandHeader />
      <main className="public-page">
        <section className="dashboard-hero-card">
          <div>
            <p className="eyebrow">Future site owner dashboard</p>
            <h1>שלום {profile.full_name ?? "בעל אתר"}.</h1>
            <p>אזור עתידי לניהול אתרי Digital Observer עצמאיים. גני ילדים מנוהלים דרך Gan Batuach ולא דרך המסך הזה.</p>
          </div>
          <span className="pill warn">Mock readiness</span>
        </section>

        <section className="grid cols-4 dashboard-panels">
          <article className="metric-card"><UserRound /><strong>{sites.length}</strong><span>אתרים</span></article>
          <article className="metric-card"><Camera /><strong>0</strong><span>מצלמות פעילות</span></article>
          <article className="metric-card"><Bell /><strong>0</strong><span>התראות פתוחות</span></article>
          <article className="metric-card"><ShieldCheck /><strong>review</strong><span>Human review</span></article>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>האתרים שלי</h2>
            <p>יוצגו כאן בתים, עסקים, משרדים, מחסנים וחניונים עתידיים.</p>
            <Link className="button secondary" href="/digital-observer/onboarding">יצירת אתר עתידי</Link>
          </div>
          {sites.length === 0 ? (
            <div className="empty-state">
              <strong>אין עדיין אתרי Digital Observer עצמאיים</strong>
              <span>זה תקין בשלב readiness. אפשר לצפות במסלול ההצטרפות העתידי.</span>
            </div>
          ) : (
            <div className="procedure-list">
              {sites.map((site: any) => (
                <article className="card procedure-card" key={site.id}>
                  <div>
                    <span className={site.active ? "pill good" : "pill bad"}>{site.active ? "active" : "inactive"}</span>
                    <span className="pill">{site.site_type}</span>
                    <h3>{site.name}</h3>
                    <p>סטטוס מנוי: {site.observer_subscription_status ?? "trial"}</p>
                  </div>
                  <div className="procedure-meta">
                    <span>{site.monitoring_enabled ? "ניטור פעיל" : "ניטור ממתין"}</span>
                    <span>מצלמות: ייטען בעתיד</span>
                    <span>אירועים: ייטען בעתיד</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel"><h2>Event feed readiness</h2><p>בעתיד יוצגו אירועים שנבדקו, התראות פעילות והתראות שנפתרו. אירועי AI גולמיים לא יוצגו ללא review.</p></article>
          <article className="card action-panel"><h2>Notifications readiness</h2><p>המודל מוכן ל-SMS, WhatsApp, Push ואימייל דרך תשתית התקשורת הקיימת.</p></article>
        </section>
      </main>
    </>
  );
}
