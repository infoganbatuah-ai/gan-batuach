import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { Award, BookOpenCheck, ClipboardCheck, FileText, MessageSquareWarning, ShieldCheck, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentActionTile, ParentAppFrame, ParentEmptyState, ParentHero, ParentMetricCard, ParentSection } from "@/components/parent-app-ui";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { complaintParentStatus, parentTrustTone, parentTrustVisibilityRules, trustBadgeLabel, trustFeedLabel, trustScoreWeights } from "@/lib/domain/parent-trust";
import { createClient } from "@/lib/supabase/server";

function parentTone(tone?: string | null) {
  if (tone === "good") return "green" as const;
  if (tone === "warn") return "orange" as const;
  if (tone === "bad") return "red" as const;
  return "purple" as const;
}

function StatusBadge({ tone, children }: { tone?: string | null; children: ReactNode }) {
  return <span className={`parent-status-chip ${parentTone(tone)}`}>{children}</span>;
}

function RoleMetricCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: string | null }) {
  return <ParentMetricCard title={label} value={value} hint={hint} icon={ShieldCheck} tone={parentTone(tone)} />;
}

function EmptyState({ title, text }: { title: string; text?: string }) {
  return <ParentEmptyState title={title} text={text} />;
}

function CleanSection({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <ParentSection title={title} subtitle={subtitle}>{children}</ParentSection>;
}

function ActionCard({ title, href, icon }: { title: string; text?: string; href: string; icon: ComponentType<any> }) {
  return <ParentActionTile title={title} href={href} icon={icon} tone="purple" />;
}

export default async function ParentTrustCenterPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase as any, profile);
  const gardenId = family.gardenIds[0] ?? profile.garden_id ?? "";
  const parentIds = family.parentIds;

  const [trustRes, badgeRes, feedRes, inspectionsRes, complaintsRes, educationRes] = await Promise.all([
    gardenId ? supabase.from("parent_trust_profiles" as any).select("*, gardens(name,city,safe_status)").eq("garden_id", gardenId).maybeSingle() : Promise.resolve({ data: null }),
    gardenId ? supabase.from("parent_trust_badges" as any).select("*").eq("garden_id", gardenId).eq("active", true).order("issued_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    gardenId ? supabase.from("parent_trust_feed" as any).select("*").eq("garden_id", gardenId).eq("approved_for_parents", true).order("occurred_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    gardenId ? supabase.from("inspections" as any).select("id,weighted_score,completed_at,violation_count,summary,status").eq("garden_id", gardenId).eq("status", "done").order("completed_at", { ascending: false }).limit(6) : Promise.resolve({ data: [] }),
    parentIds.length ? supabase.from("complaints" as any).select("id,subject,severity,status,created_at,closed_at").in("parent_id", parentIds).order("created_at", { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
    supabase.from("parent_trust_education_items" as any).select("*").eq("active", true).order("display_order", { ascending: true }).limit(12)
  ]);

  const trust = (trustRes.data ?? {}) as any;
  const badge = (badgeRes.data ?? {}) as any;
  const feed = (feedRes.data ?? []) as any[];
  const inspections = (inspectionsRes.data ?? []) as any[];
  const complaints = (complaintsRes.data ?? []) as any[];
  const education = (educationRes.data ?? []) as any[];
  const resolvedIssues = feed.filter((item) => ["resolved_finding", "compliance_improved"].includes(String(item.feed_type))).length;
  const latestInspection = inspections[0];

  return (
    <DashboardShell role="parent" title="מרכז אמון" appHome>
      <ParentAppFrame active="more" profileName={profile.full_name} avatarUrl={(profile as any).profile_image_url ?? null}>
      <div className="commercial-dashboard parent-trust-network-shell">
        <ParentHero title="מרכז האמון של הגן" subtitle="שקיפות פשוטה ובטוחה: ציון אמון, ביקורות, ציות, שיפורים ופניות שלך" />
        <ParentSection title="מידע מאושר להורים" subtitle={`${trust.trust_score ?? 0}/100`}>
          <div className="setup-checklist"><span>{trustBadgeLabel(trust.trust_badge_status ?? badge.badge_status)}</span><span>{trust.gardens?.name ?? "גן משויך"}</span><span>רק מידע מאושר</span></div>
          <div className="parent-status-row"><Link className="button primary" href="/dashboard/parent/complaints">פנייה לגן</Link><Link className="button secondary" href="/dashboard/parent/inspections">ביקורות</Link></div>
        </ParentSection>

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="ציון אמון" value={`${trust.trust_score ?? 0}/100`} tone={parentTrustTone(Number(trust.trust_score ?? 0))} />
          <RoleMetricCard label="ביקורת אחרונה" value={latestInspection?.weighted_score ?? "-"} hint={latestInspection?.completed_at ? new Date(latestInspection.completed_at).toLocaleDateString("he-IL") : "טרם פורסמה"} tone={latestInspection ? "good" : "warn"} />
          <RoleMetricCard label="ציות" value={`${trust.compliance_score ?? 0}/100`} tone={parentTrustTone(Number(trust.compliance_score ?? 0))} />
          <RoleMetricCard label="נושאים שטופלו" value={resolvedIssues} hint="שקיפות מאושרת" tone="good" />
          <RoleMetricCard label="תצפיתן" value={`${trust.observer_readiness_score ?? 0}/100`} hint="מוכנות בלבד" tone={parentTrustTone(Number(trust.observer_readiness_score ?? 0))} />
          <RoleMetricCard label="סגירת נושאים" value={`${trust.issue_resolution_score ?? 0}/100`} tone={parentTrustTone(Number(trust.issue_resolution_score ?? 0))} />
          <RoleMetricCard label="תגובה לפניות" value={`${trust.response_score ?? 0}/100`} tone={parentTrustTone(Number(trust.response_score ?? 0))} />
          <RoleMetricCard label="פניות שלך" value={complaints.length} tone={complaints.some((item) => item.status !== "closed") ? "warn" : "good"} />
        </section>

        <section className="parent-trust-score-grid">
          {trustScoreWeights.map((item) => <article key={item.label}><Award /><span>{item.label}</span><strong>{item.weight}%</strong></article>)}
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="parent-section-card"><h2><ShieldCheck size={20} /> תג אמון</h2><div className="parent-trust-badge-card"><strong>{badge.public_label ?? trustBadgeLabel(trust.trust_badge_status)}</strong><span>{badge.public_summary ?? trust.parent_summary ?? "הגן נמצא במעקב אמון פעיל."}</span></div></article>
          <article className="parent-section-card"><h2><Sparkles size={20} /> סיכום בטוח</h2><div className="parent-trust-list"><span>{trust.parent_summary ?? "נתוני אמון יופיעו לאחר חישוב הדירוג."}</span><span>{trust.latest_inspection_summary ?? "סיכום ביקורת מאושר יופיע כאן לאחר פרסום."}</span></div></article>
        </section>

        <CleanSection title="פיד שקיפות" subtitle="רק עדכונים שאושרו להצגה להורים.">
          {feed.length === 0 ? <EmptyState title="אין עדיין עדכוני שקיפות" text="ביקורות, שיפורי ציות וליקויים שטופלו יופיעו כאן לאחר אישור." /> : <div className="parent-trust-feed">{feed.map((item) => <article key={item.id}><StatusBadge tone="good">{trustFeedLabel(item.feed_type)}</StatusBadge><div><strong>{item.title}</strong><span>{item.summary}</span><small>{item.occurred_at ? new Date(item.occurred_at).toLocaleString("he-IL") : ""}</small></div></article>)}</div>}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="parent-section-card"><h2><ClipboardCheck size={20} /> היסטוריית ביקורות</h2>{inspections.length === 0 ? <div className="empty-mini">אין ביקורות מאושרות להצגה.</div> : inspections.map((inspection) => <div className="list-item" key={inspection.id}><div><strong>ציון {inspection.weighted_score ?? "-"}</strong><span>{inspection.completed_at ? new Date(inspection.completed_at).toLocaleDateString("he-IL") : ""} · {inspection.violation_count ?? 0} ליקויים</span></div><Link className="button secondary tiny" href={`/dashboard/parent/inspections/${inspection.id}/report`}>דוח</Link></div>)}</article>
          <article className="parent-section-card"><h2><MessageSquareWarning size={20} /> הפניות שלך</h2>{complaints.length === 0 ? <div className="empty-mini">אין פניות פתוחות.</div> : complaints.map((complaint) => <div className="list-item" key={complaint.id}><div><strong>{complaint.subject}</strong><span>{complaint.created_at ? new Date(complaint.created_at).toLocaleDateString("he-IL") : ""}</span></div><StatusBadge tone={parentTrustTone(complaint.status)}>{complaintParentStatus(complaint.status)}</StatusBadge></div>)}</article>
        </section>

        <CleanSection title="מה לא מוצג כאן" subtitle="גבולות שקיפות כדי לשמור על פרטיות ובטיחות.">
          <div className="parent-trust-rule-grid">{parentTrustVisibilityRules.map((rule) => <span key={rule}>{rule}</span>)}</div>
        </CleanSection>

        <CleanSection title="מרכז הסברה להורים" subtitle="איך להבין פיקוח, ציות ותצפיתן.">
          <div className="parent-trust-education-grid">{education.map((item) => <article key={item.id}><BookOpenCheck /><strong>{item.title}</strong><span>{item.summary}</span></article>)}</div>
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="פנייה חדשה" text="שליחה ומעקב" href="/dashboard/parent/complaints" icon={MessageSquareWarning} />
          <ActionCard title="ביקורות" text="דוחות מאושרים" href="/dashboard/parent/inspections" icon={ClipboardCheck} />
          <ActionCard title="מסמכים" text="קבצים ואישורים" href="/dashboard/parent/documents" icon={FileText} />
        </section>
      </div>
      </ParentAppFrame>
    </DashboardShell>
  );
}
