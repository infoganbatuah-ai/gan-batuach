import { revalidatePath } from "next/cache";
import { Archive, FilePenLine, FileText, ShieldCheck, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { requireUser } from "@/lib/auth";
import { isRole } from "@/lib/roles";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
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
  received: "התקבלה",
  submitted: "הוגשה",
  validating: "באימות",
  under_review: "בבדיקה",
  waiting_approval: "ממתינה לאישור",
  approved: "אושרה",
  processing: "בטיפול",
  completed: "הושלמה",
  rejected: "נדחתה",
  cancelled: "בוטלה",
  blocked_by_legal_hold: "חסומה בשל חובה משפטית"
};

function tone(status: string): "good" | "warn" | "bad" {
  if (status === "completed" || status === "approved") return "good";
  if (status === "rejected" || status === "blocked_by_legal_hold") return "bad";
  return "warn";
}

async function submitPrivacyRequest(formData: FormData) {
  "use server";
  const { profile } = await requireUser();
  const supabase = await createClient();
  const requestType = String(formData.get("request_type") ?? "access");
  const subjectMode = String(formData.get("subject_mode") ?? "self");
  const childId = String(formData.get("child_id") ?? "") || null;
  const requestReason = String(formData.get("request_reason") ?? "").slice(0, 1200);
  const requestKey = `privacy:${profile.id}:${requestType}:${Date.now()}`;
  const subjectType = subjectMode === "child" ? "child" : subjectMode === "garden" ? "garden" : String(profile.role ?? "parent");
  const dataSubjectId = subjectMode === "child" ? childId : profile.id;
  const dueAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const insert = await supabase.from("privacy_rights_requests" as any).insert({
    request_key: requestKey,
    requester_profile_id: profile.id,
    requested_by: profile.id,
    subject_user_id: subjectMode === "self" ? profile.id : null,
    garden_id: profile.garden_id ?? null,
    child_id: subjectMode === "child" ? childId : null,
    request_type: requestType,
    data_subject_type: subjectType,
    data_subject_id: dataSubjectId,
    subject_type: subjectType,
    status: "submitted",
    due_at: dueAt,
    request_reason: requestReason || null,
    response_summary: "הבקשה התקבלה ותועבר לבדיקה ידנית.",
    metadata: { source: "dashboard_privacy_portal", parent_visible: true }
  }).select("id").single();
  if (!insert.error) {
    await writeAuditEvent({
      eventType: "privacy_request_submitted",
      eventCategory: "regulatory",
      actorProfileId: profile.id,
      actorRole: profile.role,
      targetType: "privacy_request",
      targetId: insert.data?.id ?? null,
      gardenId: profile.garden_id ?? null,
      childId,
      metadata: { request_type: requestType, subject_mode: subjectMode },
      riskLevel: requestType === "deletion" || requestType === "anonymization" ? "high" : "medium"
    });
  }
  revalidatePath("/dashboard/privacy");
}

export default async function PrivacyPortalPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();
  const role = isRole(profile.role) ? profile.role : "parent";
  const family = role === "parent" ? await getParentFamilyContext(supabase as any, profile).catch(() => ({ children: [] })) : { children: [] as any[] };
  const requestsRes = await supabase
    .from("privacy_rights_requests" as any)
    .select("*")
    .or(`requester_profile_id.eq.${profile.id},requested_by.eq.${profile.id},subject_user_id.eq.${profile.id}`)
    .order("created_at", { ascending: false })
    .limit(50);
  const requests = (requestsRes.data ?? []) as any[];
  const open = requests.filter((request) => !["completed", "rejected", "cancelled"].includes(String(request.status))).length;
  const completed = requests.filter((request) => request.status === "completed").length;
  const sensitive = requests.filter((request) => ["deletion", "anonymization", "export"].includes(String(request.request_type))).length;

  return (
    <DashboardShell role={role} title="Privacy Rights">
      <div className="dashboard-hero-card">
        <div>
          <p className="eyebrow">זכויות פרטיות</p>
          <h1>בקשות מידע, תיקון, ייצוא ומחיקה.</h1>
          <p>כל בקשה עוברת בדיקה ידנית. מחיקה או אנונימיזציה לא מתבצעות אם קיימת חובה משפטית, חקירה, פיקוח, תשלום או ראיית בטיחות שצריך לשמר.</p>
        </div>
        <span className="pill warn">בדיקה אנושית חובה</span>
      </div>

      <section className="grid cols-4 dashboard-kpis">
        <StatCard label="בקשות פתוחות" value={open} tone={open ? "warn" : "good"} />
        <StatCard label="הושלמו" value={completed} tone="good" />
        <StatCard label="בקשות רגישות" value={sensitive} tone={sensitive ? "warn" : "good"} />
        <StatCard label="SLA" value="30 ימים" tone="good" />
      </section>

      <section className="grid cols-2 dashboard-panels">
        <form className="card form wizard-form" action={submitPrivacyRequest}>
          <div className="section-heading"><h2><ShieldCheck size={20} /> בקשה חדשה</h2><p>בחרו את סוג הבקשה והמידע הרלוונטי.</p></div>
          <div className="form-grid">
            <label>סוג בקשה
              <select name="request_type">
                <option value="access">גישה למידע</option>
                <option value="correction">תיקון מידע</option>
                <option value="export">ייצוא מידע</option>
                <option value="deletion">מחיקה</option>
                <option value="restriction">הגבלת עיבוד</option>
                <option value="anonymization">אנונימיזציה</option>
              </select>
            </label>
            <label>נושא הבקשה
              <select name="subject_mode">
                <option value="self">המידע שלי</option>
                {role === "parent" ? <option value="child">מידע של ילד/ה שלי</option> : null}
                {["manager", "owner"].includes(role) ? <option value="garden">מידע תפעולי של הגן</option> : null}
              </select>
            </label>
            {role === "parent" && (family.children as any[]).length ? <label>ילד/ה
              <select name="child_id">
                <option value="">ללא בחירה</option>
                {(family.children as any[]).map((child) => <option key={child.id} value={child.id}>{child.full_name}</option>)}
              </select>
            </label> : null}
            <label className="wide">פירוט קצר
              <textarea name="request_reason" rows={5} placeholder="כתבו מה תרצו לקבל, לתקן, לייצא או למחוק." />
            </label>
          </div>
          <button className="button primary">שליחת בקשה לבדיקה</button>
        </form>

        <article className="card action-panel">
          <div className="section-heading"><h2><Archive size={20} /> מה חשוב לדעת?</h2><p>שקיפות בלי מחיקה מסוכנת.</p></div>
          <div className="procedure-list compact-list">
            <div className="mini-row"><FileText size={18} /><span>ייצוא מידע</span><small>לא כולל ילדים אחרים, AI raw, חקירות פנימיות או וידאו גולמי.</small></div>
            <div className="mini-row"><Trash2 size={18} /><span>מחיקה</span><small>נבדקת מול חובות שימור, תשלומים, אירועים ו-legal hold.</small></div>
            <div className="mini-row"><FilePenLine size={18} /><span>תיקון</span><small>כל תיקון נרשם ביומן ביקורת.</small></div>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>הבקשות שלי</h2><p>סטטוס טיפול ובדיקות אדמין.</p></div>
        {requests.length === 0 ? <div className="empty-state"><strong>אין בקשות פרטיות</strong><span>בקשות שתשלחו יופיעו כאן.</span></div> : <div className="procedure-list">
          {requests.map((request) => (
            <article className="card procedure-card" key={request.id}>
              <div>
                <span className={`pill ${tone(request.status)}`}>{statusLabels[request.status] ?? request.status}</span>
                <h3>{requestLabels[request.request_type] ?? request.request_type}</h3>
                <p>{request.response_summary ?? request.request_reason ?? "הבקשה התקבלה."}</p>
                <small>{request.created_at ? new Date(request.created_at).toLocaleString("he-IL") : ""} · יעד טיפול {request.due_at ? new Date(request.due_at).toLocaleDateString("he-IL") : "לא נקבע"}</small>
              </div>
            </article>
          ))}
        </div>}
      </section>
    </DashboardShell>
  );
}
