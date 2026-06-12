import Link from "next/link";
import { BarChart3, Bot, CalendarCheck, Flame, Handshake, LineChart, Mail, MapPinned, Megaphone, MousePointerClick, Sparkles, Target, UsersRound } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

function pct(done: number, total: number) {
  return total ? Math.round((done / total) * 100) : 0;
}

function tone(value: number | string) {
  if (typeof value === "number") {
    if (value >= 75) return "good" as const;
    if (value >= 45) return "warn" as const;
    return "bad" as const;
  }
  if (["converted", "approved", "qualified", "sent", "completed"].includes(value)) return "good" as const;
  if (["new", "contacted", "open", "scheduled", "in_progress"].includes(value)) return "warn" as const;
  return "bad" as const;
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    new: "חדש",
    contacted: "נוצר קשר",
    qualified: "מתאים",
    approved: "אושר",
    converted: "הומר",
    rejected: "נדחה",
    open: "פתוח",
    in_progress: "בטיפול",
    completed: "הושלם",
    overdue: "באיחור"
  };
  return labels[status ?? "new"] ?? status ?? "חדש";
}

function sourceLabel(source?: string | null) {
  const labels: Record<string, string> = {
    demo_booking: "הדגמה",
    kindergarten_registration: "רישום גן",
    parent_request: "בקשת הורה",
    referral: "הפניה",
    campaign: "קמפיין"
  };
  return labels[source ?? "campaign"] ?? source ?? "קמפיין";
}

function date(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

export default async function GrowthCommandCenterPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("growth command center", async () => {
    const supabase = await createClient();
    const [
      growthLeadsRes,
      legacyLeadsRes,
      demandRes,
      campaignRes,
      followUpsRes,
      commsRes,
      eventsRes,
      referralsRes
    ] = await Promise.all([
      supabase.from("growth_leads" as any).select("*").order("created_at", { ascending: false }).limit(250),
      supabase.from("leads" as any).select("id, lead_type, source, status, garden_name, parent_name, city, campaign, lead_score, created_at").eq("lead_type", "garden").order("created_at", { ascending: false }).limit(250),
      supabase.from("growth_parent_demand_clusters" as any).select("*").order("request_count", { ascending: false }).limit(50),
      supabase.from("growth_campaign_metrics" as any).select("*").order("report_date", { ascending: false }).limit(50),
      supabase.from("growth_follow_up_tasks" as any).select("*, growth_leads(garden_name, lead_source, contact_name, city)").order("due_at", { ascending: true }).limit(80),
      supabase.from("growth_lead_communications" as any).select("*, growth_leads(garden_name, lead_source, contact_name)").order("created_at", { ascending: false }).limit(80),
      supabase.from("growth_conversion_events" as any).select("*").order("created_at", { ascending: false }).limit(120),
      supabase.from("growth_referrals" as any).select("*").order("created_at", { ascending: false }).limit(50)
    ]);
    [
      growthLeadsRes,
      legacyLeadsRes,
      demandRes,
      campaignRes,
      followUpsRes,
      commsRes,
      eventsRes,
      referralsRes
    ].forEach((query, index) => logSupabaseError(`growth query ${index}`, (query as any).error));

    return {
      growthLeads: (growthLeadsRes.data ?? []) as any[],
      legacyLeads: (legacyLeadsRes.data ?? []) as any[],
      demandClusters: (demandRes.data ?? []) as any[],
      campaignMetrics: (campaignRes.data ?? []) as any[],
      followUps: (followUpsRes.data ?? []) as any[],
      communications: (commsRes.data ?? []) as any[],
      events: (eventsRes.data ?? []) as any[],
      referrals: (referralsRes.data ?? []) as any[],
      queryError: [growthLeadsRes, legacyLeadsRes, demandRes, campaignRes, followUpsRes, commsRes, eventsRes, referralsRes].some((query: any) => query.error) ? "חלק מנתוני הצמיחה אינם זמינים. ודאו שמיגרציית Phase 143 רצה." : null
    };
  }, {
    growthLeads: [] as any[],
    legacyLeads: [] as any[],
    demandClusters: [] as any[],
    campaignMetrics: [] as any[],
    followUps: [] as any[],
    communications: [] as any[],
    events: [] as any[],
    referrals: [] as any[],
    queryError: null as string | null
  });

  const growthLeads = result.data.growthLeads.length ? result.data.growthLeads : result.data.legacyLeads.map((lead) => ({
    ...lead,
    lead_source: lead.source === "demo_booking" ? "demo_booking" : lead.source === "parent_request" ? "parent_request" : "kindergarten_registration",
    interest_score: lead.lead_score ?? 0,
    contact_name: lead.parent_name,
    status: ["approved", "converted", "rejected", "contacted"].includes(String(lead.status)) ? lead.status : "new"
  }));
  const total = growthLeads.length;
  const demos = growthLeads.filter((lead) => lead.lead_source === "demo_booking").length;
  const parentDemand = growthLeads.filter((lead) => lead.lead_source === "parent_request").length;
  const converted = growthLeads.filter((lead) => lead.status === "converted").length;
  const activePipeline = growthLeads.filter((lead) => ["new", "contacted", "qualified", "approved"].includes(String(lead.status))).length;
  const avgInterest = total ? Math.round(growthLeads.reduce((sum, lead) => sum + Number(lead.interest_score ?? 0), 0) / total) : 0;
  const highDemand = result.data.demandClusters.filter((cluster) => cluster.high_demand).length;
  const cityMap = new Map<string, number>();
  growthLeads.forEach((lead) => {
    const city = lead.city || "לא צוין";
    cityMap.set(city, (cityMap.get(city) ?? 0) + 1);
  });
  const topCities = [...cityMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const funnel = [
    { label: "ביקורים", value: result.data.events.filter((event) => event.event_type === "visit").length || total },
    { label: "לידים", value: total },
    { label: "הדגמות", value: demos },
    { label: "התאמה", value: growthLeads.filter((lead) => ["qualified", "approved", "converted"].includes(String(lead.status))).length },
    { label: "אישור", value: growthLeads.filter((lead) => ["approved", "converted"].includes(String(lead.status))).length },
    { label: "הפעלה", value: converted }
  ];

  return (
    <DashboardShell role="admin" title="Growth">
      <PremiumDashboardHero
        eyebrow="Growth Engine"
        title="צמיחה, ביקוש הורים והמרת גנים."
        subtitle="מרכז אחד שמאחד הדגמות, רישומי גנים, בקשות הורים, קמפיינים והפניות לצינור המרה מדיד."
        badge={`${pct(converted, total)}% המרה`}
        badgeTone={tone(pct(converted, total))}
        actions={<><Link className="button primary" href="/dashboard/admin/leads">מרכז לידים</Link><Link className="button secondary" href="/book-demo">קבע הדגמה</Link></>}
      >
        <div className="mini-list">
          <span><Flame size={16} /> {highDemand} גנים בביקוש גבוה</span>
          <span><Target size={16} /> {avgInterest}/100 עניין ממוצע</span>
        </div>
      </PremiumDashboardHero>
      <AdminDataError message={result.error ?? result.data.queryError} />

      <section className="role-grid">
        <RoleMetricCard label="לידים" value={total} hint="כל מקורות הצמיחה" tone="good" />
        <RoleMetricCard label="הדגמות" value={demos} hint="קבע הדגמה" tone="warn" />
        <RoleMetricCard label="בקשות הורים" value={parentDemand} hint="לחץ מהשטח" tone="good" />
        <RoleMetricCard label="צינור פעיל" value={activePipeline} hint="דורש מעקב" tone={activePipeline ? "warn" : "good"} />
        <RoleMetricCard label="המרות" value={converted} hint="גן שנכנס להפעלה" tone="good" />
        <RoleMetricCard label="ציון עניין" value={avgInterest} hint="0-100" tone={tone(avgInterest)} />
      </section>

      <CleanSection title="מרכז המרה" subtitle="הלידים החשובים ביותר לטיפול עכשיו." action={<Link className="button secondary" href="/dashboard/admin/leads">פתיחת ניהול לידים</Link>}>
        {growthLeads.length === 0 ? <EmptyState title="אין לידים להצגה" text="לידים מטפסי האתר יופיעו כאן אחרי שליחת טופס." /> : (
          <div className="procedure-list">
            {growthLeads.slice(0, 8).map((lead) => (
              <article className="card procedure-card" key={lead.id}>
                <div>
                  <StatusBadge tone={tone(String(lead.status))}>{statusLabel(lead.status)}</StatusBadge>
                  <h3>{lead.garden_name ?? lead.contact_name ?? "ליד ללא שם"}</h3>
                  <p>{sourceLabel(lead.lead_source)} · {lead.city ?? "עיר לא צוינה"} · {date(lead.created_at)}</p>
                  <small>{lead.contact_name ?? lead.parent_name ?? "איש קשר לא צוין"} · {lead.phone ?? lead.email ?? "אין פרטי קשר"}</small>
                </div>
                <div className="procedure-meta">
                  <strong>{Number(lead.interest_score ?? 0)}/100</strong>
                  <span>ציון עניין</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </CleanSection>

      <CleanSection title="Parent Demand" subtitle="איפה ההורים יוצרים ביקוש לגנים להצטרף." action={<Link className="button secondary" href="/parents-demand">טופס הורים</Link>}>
        {result.data.demandClusters.length === 0 ? <EmptyState title="אין עדיין אשכולות ביקוש" text="בקשות הורים ייצרו אשכול לפי שם גן, עיר וכתובת." /> : (
          <div className="mobile-card-list">
            {result.data.demandClusters.slice(0, 6).map((cluster) => (
              <article className="card" key={cluster.id}>
                <div className="section-heading">
                  <h3><MapPinned size={18} /> {cluster.garden_name}</h3>
                  <StatusBadge tone={cluster.high_demand ? "good" : "warn"}>{cluster.high_demand ? "ביקוש גבוה" : "מעקב"}</StatusBadge>
                </div>
                <p>{cluster.city ?? "עיר לא צוינה"} · {cluster.address ?? "כתובת לא צוינה"}</p>
                <div className="role-grid compact">
                  <RoleMetricCard label="בקשות" value={cluster.request_count ?? 0} />
                  <RoleMetricCard label="הורים זמינים" value={cluster.parent_contacts ?? 0} />
                  <RoleMetricCard label="פעולה" value={cluster.recommended_next_action === "contact_kindergarten" ? "פנייה לגן" : "פנייה להורה"} />
                </div>
              </article>
            ))}
          </div>
        )}
      </CleanSection>

      <CleanSection title="צינור המרה" subtitle="Visit → Lead → Demo → Qualification → Approval → Activation">
        <div className="role-grid">
          {funnel.map((step, index) => (
            <RoleMetricCard key={step.label} label={`${index + 1}. ${step.label}`} value={step.value} hint={index === 0 ? "תחילת מסע" : `${pct(step.value, total || step.value)}% מהלידים`} />
          ))}
        </div>
      </CleanSection>

      <CleanSection title="מעקב, תקשורת וקמפיינים" subtitle="מה צריך לקרות כדי לא לאבד ליד חם.">
        <div className="three-column-grid">
          <article className="card">
            <h3><CalendarCheck size={18} /> משימות מעקב</h3>
            {result.data.followUps.length === 0 ? <p>אין משימות פתוחות.</p> : result.data.followUps.slice(0, 5).map((task) => (
              <div className="mini-row" key={task.id}>
                <span>{task.title}</span>
                <StatusBadge tone={tone(task.status)}>{statusLabel(task.status)}</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card">
            <h3><Mail size={18} /> תקשורת לידים</h3>
            {result.data.communications.length === 0 ? <p>תבניות WhatsApp, SMS ומייל מוכנות במודל הנתונים.</p> : result.data.communications.slice(0, 5).map((item) => (
              <div className="mini-row" key={item.id}>
                <span>{item.template_key ?? item.channel}</span>
                <StatusBadge tone={tone(item.status)}>{statusLabel(item.status)}</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card">
            <h3><Megaphone size={18} /> קמפיינים והפניות</h3>
            {(result.data.campaignMetrics.length ? result.data.campaignMetrics : result.data.referrals).slice(0, 5).map((item) => (
              <div className="mini-row" key={item.id}>
                <span>{item.campaign_name ?? item.referred_garden_name ?? item.campaign_key ?? "קמפיין"}</span>
                <strong>{item.leads ?? item.status ?? 0}</strong>
              </div>
            ))}
            {result.data.campaignMetrics.length === 0 && result.data.referrals.length === 0 ? <p>אין עדיין נתוני קמפיין או הפניה.</p> : null}
          </article>
        </div>
      </CleanSection>

      <CleanSection title="Regional Growth" subtitle="איפה הצמיחה מרוכזת עכשיו.">
        <div className="role-grid">
          {topCities.length === 0 ? <RoleMetricCard label="ערים" value="-" hint="אין נתונים" /> : topCities.map(([city, count]) => (
            <RoleMetricCard key={city} label={city} value={count} hint="לידים" tone={count >= 3 ? "good" : "default"} />
          ))}
        </div>
      </CleanSection>

      <CleanSection title="AI Growth Assistant" subtitle="שאלות מוכנות לאדמין, בלי החלטות אוטומטיות.">
        <div className="action-grid">
          <ActionCard title="מי צריך מעקב היום?" text="לידים חדשים, הדגמות וביקושי הורים" href="/dashboard/admin/growth" icon={Bot} />
          <ActionCard title="איזו עיר מתחממת?" text="זיהוי ערים עם ביקוש מצטבר" href="/dashboard/admin/growth" icon={LineChart} />
          <ActionCard title="מי צפוי להמיר?" text="שילוב ציון עניין ומקור ליד" href="/dashboard/admin/growth" icon={Sparkles} />
          <ActionCard title="איזה קמפיין עובד?" text="מדידת מקור, המרה ו-ROI" href="/dashboard/admin/growth" icon={BarChart3} />
        </div>
      </CleanSection>

      <CleanSection title="זרימות כניסה" subtitle="כל מקורות הצמיחה נכנסים למודל אחד.">
        <div className="action-grid">
          <ActionCard title="קבע הדגמה" text="Demo Booking → Lead" href="/book-demo" icon={MousePointerClick} tone="good" />
          <ActionCard title="רישום גן ילדים" text="Kindergarten Registration → Lead" href="/join-kindergarten" icon={UsersRound} />
          <ActionCard title="הורים? לחצו כאן" text="Parent Request → Demand" href="/parents-demand" icon={Handshake} />
          <ActionCard title="מרכז לידים" text="הסמכה והמרה להפעלת גן" href="/dashboard/admin/leads" icon={Target} />
        </div>
      </CleanSection>
    </DashboardShell>
  );
}
