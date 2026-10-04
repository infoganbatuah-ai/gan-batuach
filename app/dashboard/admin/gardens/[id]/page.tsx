import Link from "next/link";
import { Activity, Building2, ClipboardCheck, FileText, MessageSquareWarning, ShieldCheck, UsersRound, WalletCards } from "lucide-react";
import { AdminAppFrame } from "@/components/admin-app-ui";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardGrid, EmptyState, MetricCard, PremiumCard, SectionHeader, StatusChip } from "@/components/gan-batuach-design-system";
import { AdminSectionIntro, AdminTruthState } from "@/components/platform-admin-ui";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { createClient } from "@/lib/supabase/server";

type GardenRecord = { id: string; name?: string | null; city?: string | null; address?: string | null; status?: string | null; approval_flow_status?: string | null; final_approval_status?: string | null; owner_name?: string | null; owner?: { full_name?: string | null } | null; manager?: { full_name?: string | null } | null; inspector?: { full_name?: string | null } | null };
type StaffRecord = { approved_to_work?: boolean | null };
type StatusRecord = { status?: string | null };
type InspectionRecord = StatusRecord & { completed_at?: string | null; violation_count?: number | null; weighted_score?: number | null };
type SubscriptionRecord = StatusRecord & { billing_status?: string | null };
type AuditRecord = { id: string; action?: string | null; actor_role?: string | null; created_at?: string | null };

function tone(value?: string | null): "success" | "warning" | "danger" | "muted" {
  if (["active", "approved", "verified", "healthy", "done", "completed"].includes(String(value))) return "success";
  if (["suspended", "blocked", "rejected", "expired", "payment_failed"].includes(String(value))) return "danger";
  if (["pending", "preliminary", "replacement_required", "degraded"].includes(String(value))) return "warning";
  return "muted";
}

function label(value?: string | null) {
  const labels: Record<string, string> = { active: "פעיל", approved: "מאושר", pending: "ממתין", preliminary: "מקדים", suspended: "מושהה", blocked: "חסום", verified: "מאומת", rejected: "נדחה", expired: "פג תוקף", replacement_required: "נדרשת החלפה", healthy: "תקין", degraded: "מוגבל", unavailable: "לא זמין", manual: "ידני", payment_failed: "כשל תשלום" };
  return labels[String(value ?? "")] ?? "דורש בדיקה";
}

export default async function AdminGardenProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { profile } = await requireRole(["admin"]);
  const { id } = await params;
  const result = await safeAdminData("admin garden detail", async () => {
    const supabase = await createClient();
    const [gardenRes, childrenRes, parentsRes, staffRes, complaintsRes, docsRes, inspectionsRes, subscriptionRes, auditRes] = await Promise.all([
      supabase.from("gardens" as never).select("id,name,city,address,status,safe_status,approval_flow_status,final_approval_status,owner_name,manager_id,owner_profile_id,inspector_id,children_capacity,current_children_count,staff_count,public_profile_enabled,created_at,manager:manager_id(full_name),owner:owner_profile_id(full_name),inspector:inspector_id(full_name)" as never).eq("id" as never, id as never).maybeSingle(),
      supabase.from("children" as never).select("id" as never, { count: "exact", head: true }).eq("garden_id" as never, id as never),
      supabase.from("parents" as never).select("id" as never, { count: "exact", head: true }).eq("garden_id" as never, id as never),
      supabase.from("staff" as never).select("id,approved_to_work" as never, { count: "exact" }).eq("garden_id" as never, id as never).limit(500),
      supabase.from("complaints" as never).select("id,status,severity" as never).eq("garden_id" as never, id as never).limit(500),
      supabase.from("documents" as never).select("id,status,document_type" as never).eq("garden_id" as never, id as never).limit(500),
      supabase.from("inspections" as never).select("id,status,weighted_score,completed_at,violation_count" as never).eq("garden_id" as never, id as never).order("created_at" as never, { ascending: false }).limit(8),
      supabase.from("kindergarten_subscriptions" as never).select("id,status,billing_status,current_period_end,subscription_plans(name)" as never).eq("garden_id" as never, id as never).order("created_at" as never, { ascending: false }).limit(1).maybeSingle(),
      supabase.from("audit_logs" as never).select("id,action,actor_role,entity_type,created_at" as never).eq("entity_id" as never, id as never).order("created_at" as never, { ascending: false }).limit(8)
    ]);
    [gardenRes, childrenRes, parentsRes, staffRes, complaintsRes, docsRes, inspectionsRes, subscriptionRes, auditRes].forEach((item, index) => logSupabaseError(`admin garden detail ${index}`, item.error));
    return { garden: gardenRes.data as unknown as GardenRecord | null, children: childrenRes.count ?? 0, parents: parentsRes.count ?? 0, staff: (staffRes.data ?? []) as unknown as StaffRecord[], complaints: (complaintsRes.data ?? []) as unknown as StatusRecord[], documents: (docsRes.data ?? []) as unknown as StatusRecord[], inspections: (inspectionsRes.data ?? []) as unknown as InspectionRecord[], subscription: subscriptionRes.data as unknown as SubscriptionRecord | null, audit: (auditRes.data ?? []) as unknown as AuditRecord[], queryError: [gardenRes, childrenRes, parentsRes, staffRes, complaintsRes, docsRes, inspectionsRes, subscriptionRes, auditRes].some((item) => item.error) ? "חלק מנתוני הגן לא נטענו" : null };
  }, { garden: null as GardenRecord | null, children: 0, parents: 0, staff: [] as StaffRecord[], complaints: [] as StatusRecord[], documents: [] as StatusRecord[], inspections: [] as InspectionRecord[], subscription: null as SubscriptionRecord | null, audit: [] as AuditRecord[], queryError: null as string | null });

  const garden = result.data.garden;
  if (!garden) return <AdminAppFrame profile={profile} activeHref="/dashboard/admin/kindergartens" title="פרטי גן" subtitle="הגן המבוקש אינו זמין." backHref="/dashboard/admin/kindergartens"><EmptyState title="הגן לא נמצא" text="ייתכן שהוסר, הועבר או שאינו זמין להרשאתך." icon={Building2} /></AdminAppFrame>;
  const openComplaints = result.data.complaints.filter((item) => !["closed", "resolved", "dismissed"].includes(String(item.status))).length;
  const documentActions = result.data.documents.filter((item) => ["missing", "rejected", "expired", "replacement_required"].includes(String(item.status))).length;
  const approvedStaff = result.data.staff.filter((item) => item.approved_to_work).length;
  const latestInspection = result.data.inspections[0];
  const serviceState = garden.status === "active" && !documentActions ? "healthy" : garden.status === "suspended" ? "unavailable" : "degraded";

  return (
    <AdminAppFrame profile={profile} activeHref="/dashboard/admin/kindergartens" title="פרטי גן" subtitle="מידע תפעולי מצומצם והרשאות אדמין." backHref="/dashboard/admin/kindergartens" badge={label(garden.status)}>
      <div className="platform-admin">
        <AdminSectionIntro eyebrow="GARDEN DETAIL" title={cleanSyntheticLabel(garden.name, "גן")} text={`${garden.city ?? "עיר לא צוינה"} · ${garden.address ?? "כתובת לא הוזנה"}. מסך זה מציג מידע הנדרש לניהול הפלטפורמה ואינו פותח רשומות פרטיות של ילדים, משפחות, הודעות או מסמכים.`} actions={<><StatusChip tone={tone(garden.status)}>{label(garden.status)}</StatusChip><Link className="admin-primary-button" href={`/dashboard/admin/kindergarten-applications?garden=${id}`}>אישור ומוכנות</Link></>} />
        <AdminDataError message={result.error ?? result.data.queryError} />
        <DashboardGrid columns={4}>
          <MetricCard label="משתמשים מקושרים" value={result.data.children + result.data.parents + result.data.staff.length} hint="ספירה מצרפית בלבד" icon={UsersRound} tone="primary" />
          <MetricCard label="צוות מאושר" value={`${approvedStaff}/${result.data.staff.length}`} hint="לפי סמכות השרת" icon={ShieldCheck} tone={approvedStaff === result.data.staff.length ? "success" : "warning"} />
          <MetricCard label="פעולות מסמך" value={documentActions} hint="ללא חשיפת תוכן" icon={FileText} tone={documentActions ? "warning" : "success"} />
          <MetricCard label="תלונות פתוחות" value={openComplaints} hint="פרטים לפי צורך והרשאה" icon={MessageSquareWarning} tone={openComplaints ? "warning" : "success"} />
        </DashboardGrid>
        <section className="platform-admin-service-grid" aria-label="מוכנות הגן">
          <AdminTruthState title="מחזור חיי הגן" text={`סטטוס: ${label(garden.status)} · אישור: ${label(garden.final_approval_status ?? garden.approval_flow_status)}`} tone={tone(garden.status) === "success" ? "good" : tone(garden.status) === "danger" ? "danger" : "warning"} icon={Building2} />
          <AdminTruthState title="מנוי פלטפורמה" text={`${label(result.data.subscription?.status)} · חיוב ${label(result.data.subscription?.billing_status)}`} tone={tone(result.data.subscription?.status) === "success" ? "good" : "warning"} icon={WalletCards} action={<Link className="admin-link-button" href="/dashboard/admin/subscriptions">פתיחת מנויים</Link>} />
          <AdminTruthState title="מצב שירות" text={serviceState === "healthy" ? "השירותים התפעוליים נראים תקינים לפי הנתונים הזמינים." : "נדרשת בדיקה; אין הצגת מצב ירוק ללא מקור מאומת."} tone={serviceState === "healthy" ? "good" : serviceState === "unavailable" ? "danger" : "warning"} icon={Activity} />
        </section>
        <DashboardGrid columns={2}>
          <PremiumCard size="lg"><SectionHeader title="זהות ושיוכים" subtitle="המידע הדרוש לתפעול הפלטפורמה" icon={UsersRound} /><div className="platform-admin-list"><AdminTruthState title="בעלות" text={garden.owner?.full_name ?? garden.owner_name ?? "טרם שויכה"} /><AdminTruthState title="מנהלת" text={garden.manager?.full_name ?? "טרם שויכה"} /><AdminTruthState title="מפקח" text={garden.inspector?.full_name ?? "טרם שויך"} /></div></PremiumCard>
          <PremiumCard size="lg"><SectionHeader title="פיקוח ומוכנות" subtitle="ציון שהוגש נשאר סמכות השרת" icon={ClipboardCheck} />{latestInspection ? <><AdminTruthState title="ביקורת אחרונה" text={`${latestInspection.completed_at ? new Date(latestInspection.completed_at).toLocaleDateString("he-IL") : label(latestInspection.status)} · ${latestInspection.violation_count ?? 0} ממצאים`} tone={latestInspection.status === "completed" || latestInspection.status === "done" ? "good" : "warning"} /><div className="platform-admin-safe-meta"><span>ציון שרת: {latestInspection.weighted_score ?? "לא זמין"}</span><span>היסטוריה: {result.data.inspections.length} ביקורות</span></div></> : <EmptyState title="אין ביקורות להצגה" text="ביקורת שתוגש תופיע כאן ללא שינוי הציון ההיסטורי." icon={ClipboardCheck} />}</PremiumCard>
        </DashboardGrid>
        <PremiumCard size="lg"><SectionHeader title="פעילות אדמין אחרונה" subtitle="פעולות תפעוליות בלבד; ללא תוכן פרטי" icon={Activity} />{result.data.audit.length ? <div className="platform-admin-timeline">{result.data.audit.map((item) => <article key={item.id}><h3>{item.action}</h3><p>{item.actor_role ?? "system"} · {item.created_at ? new Date(item.created_at).toLocaleString("he-IL") : "זמן לא זמין"}</p></article>)}</div> : <EmptyState title="אין פעילות אדמין אחרונה" text="אישור, שינוי שיוך או שינוי מנוי יופיעו כאן לאחר רישום canonical audit." icon={Activity} />}</PremiumCard>
      </div>
    </AdminAppFrame>
  );
}
