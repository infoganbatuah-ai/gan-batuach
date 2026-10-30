/* eslint-disable @typescript-eslint/no-explicit-any -- organization rows precede generated types. */
import { Handshake } from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { PartnerIntegrationCenter } from "@/components/digital-observer/partner-integration-center";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { loadObserverRuntime, observerModeForSite, selectObserverSite } from "@/lib/domain/digital-observer/runtime";
import { createClient } from "@/lib/supabase/server";

export default async function PartnerPage({ searchParams }: { searchParams?: Promise<{ organization?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/partners");
  const runtime = await loadObserverRuntime(profile.id);
  const mode = observerModeForSite(selectObserverSite(runtime.sites, runtime.cameras));
  const supabase = await createClient();
  const result = await supabase.from("digital_observer_organizations" as any).select("id,name,organization_type,status")
    .in("organization_type", ["manufacturer","monitoring_center","security_company","oem_partner","white_label_partner","enterprise"]).eq("status", "active").order("name").limit(100);
  const organizations = (result.data ?? []) as Array<{ id: string; name: string }>;
  const selected = organizations.find((item) => item.id === params.organization) ?? organizations[0] ?? null;
  return <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/partners" title="שותפים והטמעה" statusLabel="Sandbox מאובטח">
    {selected ? <PartnerIntegrationCenter organizationId={selected.id} organizationName={selected.name} />
      : <section className="do-panel do-empty"><Handshake /><strong>אין ארגון שותף זמין</strong><span>יש להגדיר ארגון שותף מורשה לפני יצירת לקוחות או חוויה ממותגת.</span></section>}
  </ObserverAppShell>;
}
