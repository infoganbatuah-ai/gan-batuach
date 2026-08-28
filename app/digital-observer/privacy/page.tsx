import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Archive, Download, Eye, ShieldCheck, Trash2 } from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { loadObserverRuntime, observerModeForSite, selectObserverSite } from "@/lib/domain/digital-observer/runtime";
import { createClient } from "@/lib/supabase/server";
import { writeAuditEvent } from "@/lib/security/audit-log-service";

const requestLabels: Record<string, string> = {
  access: "גישה למידע",
  correction: "תיקון מידע",
  export: "ייצוא מידע",
  deletion: "מחיקה",
  restriction: "הגבלת עיבוד",
  anonymization: "אנונימיזציה"
};

const statusLabels: Record<string, string> = {
  submitted: "התקבלה",
  under_review: "בבדיקה",
  approved: "אושרה",
  processing: "בטיפול",
  completed: "הושלמה",
  rejected: "נדחתה",
  cancelled: "בוטלה",
  blocked_by_legal_hold: "ממתינה לבדיקת חובת שימור"
};

async function submitObserverPrivacyRequest(formData: FormData) {
  "use server";
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/privacy");
  const supabase = await createClient();
  const observerSiteId = String(formData.get("observer_site_id") ?? "");
  const requestType = String(formData.get("request_type") ?? "access");
  const requestReason = String(formData.get("request_reason") ?? "").trim().slice(0, 1200);
  if (!/^[0-9a-f-]{36}$/i.test(observerSiteId) || !Object.hasOwn(requestLabels, requestType)) return;

  const site = await supabase.from("observer_sites" as any)
    .select("id,owner_profile_id,garden_id")
    .eq("id", observerSiteId)
    .is("garden_id", null)
    .maybeSingle();
  if (!site.data || (site.data.owner_profile_id !== profile.id && profile.role !== "admin")) return;

  const insert = await supabase.from("privacy_rights_requests" as any).insert({
    request_key: `digital-observer-privacy:${profile.id}:${requestType}:${Date.now()}`,
    requester_profile_id: profile.id,
    requested_by: profile.id,
    subject_user_id: profile.id,
    request_type: requestType,
    data_subject_type: "digital_observer_user",
    data_subject_id: profile.id,
    subject_type: "digital_observer_user",
    status: "submitted",
    due_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    request_reason: requestReason || null,
    response_summary: "הבקשה התקבלה ותיבדק מול הרשאות, מדיניות שמירה וחובות חוקיות.",
    metadata: { product: "digital_observer", observer_site_id: observerSiteId, source: "digital_observer_privacy_center" }
  }).select("id").single();
  if (!insert.error) {
    await writeAuditEvent({
      eventType: "privacy_request_submitted",
      eventCategory: "regulatory",
      actorProfileId: profile.id,
      actorRole: profile.role,
      targetType: "privacy_request",
      targetId: insert.data?.id ?? null,
      metadata: { product: "digital_observer", observer_site_id: observerSiteId, request_type: requestType },
      riskLevel: requestType === "deletion" || requestType === "anonymization" ? "high" : "medium"
    });
  }
  revalidatePath("/digital-observer/privacy");
}

export default async function DigitalObserverPrivacyPage() {
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/privacy");
  const runtime = await loadObserverRuntime(profile.id);
  const site = selectObserverSite(runtime.sites, runtime.cameras);
  const supabase = await createClient();
  const requests = (await supabase.from("privacy_rights_requests" as any)
    .select("id,request_type,status,request_reason,response_summary,created_at,due_at")
    .eq("requester_profile_id", profile.id)
    .contains("metadata", { product: "digital_observer" })
    .order("created_at", { ascending: false })
    .limit(50)).data ?? [];

  return <ObserverAppShell profile={profile} mode={observerModeForSite(site)} activeHref="/digital-observer/settings" title="פרטיות ושליטה במידע" statusLabel="בקשות מבוקרות">
    <div className="do-page-stack" id="privacy">
      <section className="do-page-heading"><div><span className="do-badge info">זכויות מידע</span><h1>גישה, ייצוא, הגבלה ומחיקה</h1><p>אירועים ומדיה נשמרים עד יומיים כברירת מחדל. כל בקשה עוברת בדיקה מול חובות שימור, אבטחה והרשאות לפני ביצוע.</p></div><Link className="do-button secondary" href="/digital-observer/trust">מדיניות ותנאי שימוש</Link></section>
      <section className="do-grid cols-2">
        <form className="do-panel do-form-section" action={submitObserverPrivacyRequest}>
          <div className="do-section-head"><div><h2>בקשת פרטיות חדשה</h2><p>הבקשה נרשמת רק לחשבון ולאתר שבחרתם.</p></div><ShieldCheck /></div>
          {site ? <input type="hidden" name="observer_site_id" value={site.id} /> : null}
          <div className="do-form-grid"><label className="do-field"><span>סוג בקשה</span><select name="request_type" disabled={!site}><option value="access">גישה למידע</option><option value="export">ייצוא מידע</option><option value="correction">תיקון מידע</option><option value="restriction">הגבלת עיבוד</option><option value="deletion">מחיקת חשבון ומידע</option><option value="anonymization">אנונימיזציה</option></select></label><label className="do-field full"><span>פירוט קצר</span><textarea name="request_reason" rows={5} maxLength={1200} placeholder="מה תרצו לקבל, לתקן, לייצא, להגביל או למחוק?" disabled={!site} /></label></div>
          <button className="do-button primary" type="submit" disabled={!site}><Archive /> שליחת בקשה לבדיקה</button>
          {!site ? <p className="do-notice warn">יש להשלים הקמת אתר לפני פתיחת בקשת פרטיות.</p> : null}
        </form>
        <aside className="do-panel do-form-section"><div className="do-section-head"><div><h2>מה נכלל</h2><p>המערכת לא מוחקת ראיות או מידע של משתמשים אחרים ללא בדיקה.</p></div><Eye /></div><div className="do-trust-grid"><article><Download /><strong>ייצוא</strong><p>מידע חשבון, הגדרות, הרשאות ואירועים שבבעלותכם.</p></article><article><Trash2 /><strong>מחיקה</strong><p>הרשאות, מקורות ומדיה ייבדקו מול תקופת השמירה והחזקת מידע חוקית.</p></article></div></aside>
      </section>
      <section className="do-panel"><div className="do-section-head"><div><h2>הבקשות שלי</h2><p>סטטוס ומועד יעד לטיפול.</p></div></div>{requests.length ? <div className="do-list">{requests.map((request: any) => <article className="do-list-item" key={request.id}><div><strong>{requestLabels[request.request_type] ?? request.request_type}</strong><p>{request.response_summary ?? request.request_reason ?? "הבקשה התקבלה."}</p><small>{new Date(request.created_at).toLocaleString("he-IL")} · יעד טיפול {request.due_at ? new Date(request.due_at).toLocaleDateString("he-IL") : "ייקבע"}</small></div><span className="do-badge info">{statusLabels[request.status] ?? request.status}</span></article>)}</div> : <div className="do-empty"><Archive /><strong>אין בקשות פתוחות</strong><span>בקשות שתשלחו יופיעו כאן עם סטטוס טיפול.</span></div>}</section>
    </div>
  </ObserverAppShell>;
}
