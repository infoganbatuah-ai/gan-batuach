import { Building2, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireRole } from "@/lib/auth";
import { observerStatusLabel } from "@/lib/domain/digital-observer/runtime";
import { createClient } from "@/lib/supabase/server";

export default async function DigitalObserverAdminAccessPage() {
  const { profile } = await requireRole(["admin"], "/digital-observer/login?next=/digital-observer/admin/access", "/digital-observer/dashboard");
  const supabase = await createClient();
  const [sites, memberships, organizations] = await Promise.all([
    supabase.from("observer_sites" as any).select("id,name,site_type,active,owner_profile_id,created_at").neq("site_type", "kindergarten").order("created_at", { ascending: false }).limit(300),
    supabase.from("observer_site_memberships" as any).select("id,observer_site_id,profile_id,member_role,active,created_at,observer_sites(name,site_type)").order("created_at", { ascending: false }).limit(500),
    supabase.from("digital_observer_organizations" as any).select("id,name,organization_type,owner_profile_id,status,created_at").order("created_at", { ascending: false }).limit(300)
  ]);
  return <ObserverAppShell profile={profile} mode="business" activeHref="/digital-observer/admin/access" title="לקוחות והרשאות" statusLabel="Multi-tenant">
    <div className="do-page-stack">
      <section className="do-business-summary"><article className="do-metric"><Building2 /><strong>{sites.data?.length ?? 0}</strong><span>אתרים עצמאיים</span></article><article className="do-metric"><UsersRound /><strong>{memberships.data?.length ?? 0}</strong><span>חברויות</span></article><article className="do-metric"><ShieldCheck /><strong>{organizations.data?.length ?? 0}</strong><span>ארגונים</span></article></section>
      <div className="do-notice info"><ShieldCheck /><span>האדמין רואה מטא-דאטה של שיוך בלבד. מסך זה אינו מבצע התחזות, אינו מציג סיסמאות ואינו עוקף RLS.</span></div>
      <section className="do-grid cols-2"><article className="do-panel"><h2>אתרים</h2>{(sites.data ?? []).length ? <div className="do-row-list">{(sites.data ?? []).map((item: any) => <div className="do-row" key={item.id}><Building2 /><span className="do-row-main"><strong>{item.name}</strong><small>{observerStatusLabel(item.site_type)}</small></span><span className="do-row-meta"><b>{item.active === false ? "מושבת" : "פעיל"}</b><small>גישה לפי חברות</small></span></div>)}</div> : <div className="do-empty"><Building2 /><strong>אין אתרים</strong></div>}</article><article className="do-panel"><h2>חברויות והרשאות</h2>{(memberships.data ?? []).length ? <div className="do-row-list">{(memberships.data ?? []).map((item: any) => <div className="do-row" key={item.id}><UserRound /><span className="do-row-main"><strong>{item.observer_sites?.name ?? "אתר"}</strong><small>{observerStatusLabel(item.member_role)}</small></span><span className="do-row-meta"><b>{item.active === false ? "מושבת" : "פעיל"}</b><small>מזהה משתמש מוסתר</small></span></div>)}</div> : <div className="do-empty"><UsersRound /><strong>אין חברויות</strong><span>הוספת משתמש תבוצע לאחר הגדרת תהליך הזמנה מאובטח.</span></div>}</article></section>
    </div>
  </ObserverAppShell>;
}
