import { notFound } from "next/navigation";
import { AlertTriangle, FileCheck2, FileImage, History, ShieldCheck, Wrench } from "lucide-react";
import { ViolationStatusActions } from "@/components/violation-status-actions";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";
import { InspectorAppFrame, InspectorHero, InspectorSection, InspectorStatus, InspectorTimeline } from "@/components/inspector-app-ui";

const actionLabel: Record<string, string> = { acknowledge: "הגן אישר קבלה", progress: "נשמרה התקדמות", submit: "נשלח לבדיקה", accept: "אושר ונסגר", reject: "הוחזר לתיקון", reopen: "נפתח מחדש", extend: "הוארך המועד" };
type InspectorPhoto = { profile_photo_url?: string | null };
type CorrectiveActionDetail = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  severity: string;
  score?: number | null;
  status: string;
  correction_due_at?: string | null;
  correction_note?: string | null;
  correction_files?: string[] | null;
  review_note?: string | null;
  created_at: string;
  gardens?: { name?: string | null; city?: string | null } | null;
};
type CorrectiveActionEvent = { action: string; from_status?: string | null; to_status: string; note?: string | null; created_at: string };

export default async function InspectorCorrectiveActionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireOperationalRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, violationRes] = await Promise.all([
    supabase.from("inspectors").select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("violations").select("id,garden_id,inspection_id,title,description,category,severity,score,status,correction_due_at,correction_note,correction_files,review_note,created_at,submitted_at,approved_at,gardens!inner(name,city,inspector_id)").eq("id", id).eq("gardens.inspector_id", profile.id).maybeSingle()
  ]);
  const violation = violationRes.data as unknown as CorrectiveActionDetail | null;
  if (!violation) notFound();
  const eventsRes = await supabase.from("corrective_action_events" as never).select("id,action,from_status,to_status,note,evidence_paths,due_at,created_at").eq("violation_id", id).order("created_at");
  const events = (eventsRes.data ?? []) as unknown as CorrectiveActionEvent[];
  const evidence = Array.isArray(violation.correction_files) ? violation.correction_files : [];
  const profileForUi = { ...profile, profile_image_url: (inspectorRes.data as unknown as InspectorPhoto | null)?.profile_photo_url ?? profile.profile_image_url };
  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/corrective-actions" title="בדיקת תיקון" subtitle={violation.gardens?.name ?? "גן משויך"} badge="החלטת מפקח" backHref="/dashboard/inspector/corrective-actions">
      <InspectorHero eyebrow={violation.category ?? "ממצא ביקורת"} title={violation.title} subtitle={violation.description ?? "לא צורף תיאור נוסף"} artwork={<Wrench />} meta={<><InspectorStatus tone={["critical", "high"].includes(violation.severity) ? "danger" : "warning"}>{violation.severity}</InspectorStatus><InspectorStatus tone={violation.status === "done" ? "success" : "primary"}>{violation.status}</InspectorStatus></>} />
      <div className="inspector-detail-grid">
        <InspectorSection title="הממצא והתגובה" subtitle="המקור נשמר לצד ראיות התיקון" icon={AlertTriangle}>
          <div className="inspector-fact-grid">
            <div className="inspector-fact"><small>ציון סעיף</small><strong>{violation.score ?? "—"}</strong></div>
            <div className="inspector-fact"><small>תאריך יעד</small><strong>{violation.correction_due_at ? new Date(violation.correction_due_at).toLocaleDateString("he-IL") : "לא הוגדר"}</strong></div>
            <div className="inspector-fact"><small>תגובת הגן</small><strong>{violation.correction_note ?? "טרם התקבלה"}</strong></div>
            <div className="inspector-fact"><small>הערת פקח</small><strong>{violation.review_note ?? "אין הערה"}</strong></div>
          </div>
          <ViolationStatusActions id={violation.id} initialStatus={violation.status ?? "open"} />
        </InspectorSection>
        <InspectorSection title="ציר טיפול" subtitle="כל שינוי סטטוס נשמר ביומן" icon={History}>
          {events.length ? <InspectorTimeline items={events.map((event) => ({ title: actionLabel[event.action] ?? event.action, text: event.note ?? `${event.from_status ?? "—"} ← ${event.to_status}`, date: new Date(event.created_at).toLocaleString("he-IL"), tone: event.to_status === "done" ? "success" : event.to_status === "rejected" ? "danger" : "primary" }))} /> : <InspectorTimeline items={[{ title: "הממצא נפתח", text: "ממתין לפעולת הגן", date: new Date(violation.created_at).toLocaleString("he-IL"), tone: "warning" }]} />}
        </InspectorSection>
      </div>
      <InspectorSection title="ראיות תיקון" subtitle="קבצים פרטיים נפתחים דרך כתובת חתומה ומוגבלת" icon={FileImage}>
        {evidence.length ? <div className="inspector-evidence-grid">{evidence.map((path: string) => <article className="inspector-evidence-card" key={path}><FileCheck2 /><strong>ראיית תיקון</strong><span>{path.split("/").pop()}</span><a href={`/api/violations/${id}/evidence?path=${encodeURIComponent(path)}`}>פתיחת קובץ מאובטחת</a></article>)}</div> : <div className="inspector-evidence-card"><ShieldCheck /><strong>טרם צורפה ראיה</strong><span>הגן יצרף מסמך או תמונה לפני שליחה לאישור.</span></div>}
      </InspectorSection>
    </InspectorAppFrame>
  );
}
