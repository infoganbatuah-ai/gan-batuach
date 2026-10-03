import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardCheck, Download, FileCheck2, FileText, MapPin, ShieldCheck, UserRound, Wrench } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createAdminClient } from "@/lib/supabase/admin";

type ReportRole = "admin" | "garden" | "parent" | "inspector";
type ParentInspectionSummary = { gardens?: { name?: string; city?: string } | null; completed_at?: string | null; weighted_score?: number | null; violation_count?: number | null };
type InspectionReportRecord = { id: string; status: string; completed_at?: string | null; weighted_score?: number | null; violation_count?: number | null; critical_failures?: number | null; signature_image?: string | null; signed_at?: string | null; gps_verified?: boolean | null; gardens?: { name?: string | null; city?: string | null; address?: string | null } | null; inspectors?: { full_name?: string | null } | null };
type InspectionAnswerRecord = { id: string; score?: number | null; boolean_value?: boolean | null; note?: string | null; photo_url?: string | null; document_url?: string | null; inspection_form_questions?: { question_text?: string | null; category?: string | null; weight?: number | null; critical?: boolean | null } | null };
type InspectionSignatureRecord = { signature_image?: string | null; signed_at?: string | null; gps_lat?: number | null; gps_lng?: number | null; gps_distance_meters?: number | null };
type InspectionViolationRecord = { id: string; title: string; description?: string | null; category?: string | null; status: string; correction_due_at?: string | null };

function dateText(value?: string | null) {
  return value ? new Date(value).toLocaleString("he-IL") : "לא צוין";
}

function evidenceHref(inspectionId: string, value: string) {
  return value.startsWith(`inspection-reports/inspections/${inspectionId}/`)
    ? `/api/inspections/${inspectionId}/evidence?path=${encodeURIComponent(value)}`
    : value;
}

export async function InspectionReportView({ id, role, backHref }: { id: string; role: ReportRole; backHref: string }) {
  const supabase = await createClient();
  if (role === "parent") {
    const { profile } = await getSessionProfile();
    if (!profile || profile.role !== "parent") return null;
    const family = await getParentFamilyContext(supabase as never, profile);
    const { data } = family.gardenIds.length
      ? await createAdminClient().from("inspections" as never).select("id,garden_id,completed_at,weighted_score,violation_count,status,gardens(name,city)").eq("id", id).in("garden_id", family.gardenIds).eq("status", "done").maybeSingle()
      : { data: null };
    const summary = data as ParentInspectionSummary | null;
    if (!summary) return <section className="dashboard-section">אין דוח פיקוח מאושר להצגה.</section>;
    return <section className="dashboard-section"><h1>סיכום פיקוח — {summary.gardens?.name ?? "גן"}</h1><p>{summary.gardens?.city ?? ""} · {dateText(summary.completed_at)}</p><p>ציון: {summary.weighted_score ?? "טרם חושב"} · ליקויים: {summary.violation_count ?? 0}</p><Link className="button" href={backHref}>חזרה לרשימה</Link></section>;
  }
  const [inspectionRes, answersRes, signatureRes, violationsRes, settingsRes] = await Promise.all([
    supabase.from("inspections" as never).select("*, gardens(name,city,address), inspectors:inspector_id(full_name, phone)").eq("id", id).maybeSingle(),
    supabase.from("inspection_answers" as never).select("*, inspection_form_questions(question_text, category, weight, critical)").eq("inspection_id", id),
    supabase.from("inspection_signatures" as never).select("*").eq("inspection_id", id).order("signed_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("violations" as never).select("id,title,description,category,severity,status,correction_due_at,correction_note,review_note,correction_files").eq("inspection_id", id).order("created_at"),
    supabase.from("inspection_product_settings" as never).select("attention_score_below").eq("id", true).maybeSingle()
  ]);

  if (inspectionRes.error) console.error("Inspection report load failed", inspectionRes.error);
  if (answersRes.error) console.error("Inspection report answers failed", answersRes.error);
  if (signatureRes.error) console.error("Inspection report signature failed", signatureRes.error);

  const inspection = inspectionRes.data as unknown as InspectionReportRecord | null;
  const answers = (answersRes.data ?? []) as unknown as InspectionAnswerRecord[];
  const signature = signatureRes.data as unknown as InspectionSignatureRecord | null;
  const violations = (violationsRes.data ?? []) as unknown as InspectionViolationRecord[];
  const attentionThreshold = Number((settingsRes.data as unknown as { attention_score_below?: number | null } | null)?.attention_score_below ?? 8);

  if (!inspection || inspection.status !== "done") {
    return <section className="dashboard-section"><div className="empty-state"><strong>לא ניתן לטעון את דוח הפיקוח</strong><span>ייתכן שהדוח לא קיים או שאין הרשאה לצפות בו.</span><Link className="button secondary" href={backHref}>חזרה</Link></div></section>;
  }

  const exceptions = answers.filter((answer) => Number(answer.score ?? 10) <= 4 || answer.inspection_form_questions?.critical);

  const grouped = [...new Set(answers.map((answer) => answer.inspection_form_questions?.category ?? "כללי"))];
  const showPrivateNotes = role === "inspector" || role === "admin";
  return <section className="inspection-report printable-report" aria-label="דוח ביקורת סופי">
    <header className="inspection-report-hero"><div><span><FileCheck2 /> דוח ביקורת מאושר</span><h1>{inspection.gardens?.name ?? "גן ילדים"}</h1><p><MapPin /> {inspection.gardens?.city ?? ""} · {inspection.gardens?.address ?? "כתובת לפי הרשאה"}</p><div><span><UserRound /> {inspection.inspectors?.full_name ?? "מפקח מוסמך"}</span><span><CalendarDays /> {dateText(inspection.completed_at)}</span></div></div><div className={Number(inspection.weighted_score ?? 0) >= attentionThreshold ? "inspection-report-score good" : "inspection-report-score attention"}><small>ציון סופי</small><strong>{inspection.weighted_score ?? "—"}</strong><span>מתוך 10</span></div></header>
    <div className="inspection-report-actions"><Link className="inspection-secondary-action" href={backHref}>חזרה לרשימה</Link><PrintButton /><a className="inspection-primary-action" href={`/api/inspections/${id}/report?download=1`}><Download /> הורדת דוח</a></div>
    <div className="inspection-report-metrics"><div><CalendarDays /><span><small>מועד ביצוע</small><strong>{dateText(inspection.completed_at)}</strong></span></div><div><AlertTriangle /><span><small>ממצאים</small><strong>{inspection.violation_count ?? violations.length}</strong></span></div><div><ShieldCheck /><span><small>כשלים קריטיים</small><strong>{inspection.critical_failures ?? exceptions.filter((item) => item.inspection_form_questions?.critical).length}</strong></span></div><div><CheckCircle2 /><span><small>סטטוס</small><strong>הוגש וננעל</strong></span></div></div>
    <div className="inspection-report-layout"><main>
      <article className="inspection-report-section"><header><div><ClipboardCheck /><span><h2>סיכום הצ׳ק ליסט</h2><p>התשובות והמשקלים כפי שננעלו במועד ההגשה</p></span></div><strong>{answers.length} סעיפים</strong></header>{answers.length === 0 ? <div className="inspection-report-empty">אין תשובות שמורות בדוח.</div> : grouped.map((category) => <section className="inspection-report-category" key={category}><h3>{category}</h3>{answers.filter((answer) => (answer.inspection_form_questions?.category ?? "כללי") === category).map((answer) => <div className="inspection-report-answer" key={answer.id}><span className={Number(answer.score ?? 10) <= 4 ? "attention" : "good"}>{answer.score ?? (answer.boolean_value === true ? "כן" : answer.boolean_value === false ? "לא" : "נרשם")}</span><div><strong>{answer.inspection_form_questions?.question_text ?? "סעיף ביקורת"}</strong>{showPrivateNotes && answer.note ? <small>הערת מפקח: {answer.note}</small> : null}</div><div>{answer.photo_url ? <a href={evidenceHref(id, answer.photo_url)} aria-label="פתיחת צילום ראיה"><FileText /> צילום</a> : null}{answer.document_url ? <a href={evidenceHref(id, answer.document_url)} aria-label="פתיחת מסמך ראיה"><FileText /> מסמך</a> : null}</div></div>)}</section>)}</article>
      <article className="inspection-report-section"><header><div><Wrench /><span><h2>ממצאים ופעולות תיקון</h2><p>קישור קנוני בין הממצא, הראיה וסטטוס התיקון</p></span></div><strong>{violations.length}</strong></header>{violations.length ? <div className="inspection-report-findings">{violations.map((violation) => <div key={violation.id}><span className={`inspection-finding-mark ${violation.status === "done" ? "good" : "attention"}`}><AlertTriangle /></span><div><strong>{violation.title}</strong><p>{violation.description ?? violation.category ?? "ממצא ביקורת"}</p><small>יעד: {violation.correction_due_at ? new Date(violation.correction_due_at).toLocaleDateString("he-IL") : "לא הוגדר"}</small></div><span className={`inspection-report-status ${violation.status === "done" ? "good" : "attention"}`}>{violation.status === "done" ? "אומת ונסגר" : "נדרש תיקון"}</span></div>)}</div> : <div className="inspection-report-empty success"><CheckCircle2 /> לא נפתחו פעולות תיקון לביקורת זו.</div>}</article>
    </main><aside><article className="inspection-report-aside"><FileText /><h2>פרטי הדוח</h2><dl><div><dt>מזהה ביקורת</dt><dd>{String(inspection.id).slice(0, 8)}</dd></div><div><dt>גרסת טופס</dt><dd>נעולה בהגשה</dd></div><div><dt>ראיות</dt><dd>{answers.reduce((sum, answer) => sum + (answer.photo_url ? 1 : 0) + (answer.document_url ? 1 : 0), 0)}</dd></div><div><dt>ציון</dt><dd>חישוב שרת</dd></div></dl></article><article className="inspection-report-aside"><ShieldCheck /><h2>חתימה ואימות</h2>{signature?.signature_image ? <img className="inspection-report-signature" src={signature.signature_image} alt="חתימת המפקח" /> : inspection.signature_image ? <img className="inspection-report-signature" src={inspection.signature_image} alt="חתימת המפקח" /> : <p>לא נשמרה חתימה.</p>}<small>נחתם: {dateText(signature?.signed_at ?? inspection.signed_at)}</small><small>GPS: {inspection.gps_verified ? "אומת" : "לפי הרשאת הדוח"}</small></article><div className="inspection-score-lock"><ShieldCheck /><span><strong>הציון ההיסטורי נעול</strong><small>סגירת פעולת תיקון אינה משנה את הציון המקורי.</small></span></div></aside></div>
  </section>;
}
