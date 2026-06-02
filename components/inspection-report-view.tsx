import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { createClient } from "@/lib/supabase/server";

type ReportRole = "admin" | "garden" | "parent";

function dateText(value?: string | null) {
  return value ? new Date(value).toLocaleString("he-IL") : "לא צוין";
}

export async function InspectionReportView({ id, role, backHref }: { id: string; role: ReportRole; backHref: string }) {
  const supabase = await createClient();
  const [inspectionRes, answersRes, signatureRes] = await Promise.all([
    supabase.from("inspections" as any).select("*, gardens(name,city,address), inspectors:inspector_id(full_name, phone)").eq("id", id).maybeSingle(),
    supabase.from("inspection_answers" as any).select("*, inspection_form_questions(question_text, category, weight, critical)").eq("inspection_id", id),
    supabase.from("inspection_signatures" as any).select("*").eq("inspection_id", id).order("signed_at", { ascending: false }).limit(1).maybeSingle()
  ]);

  if (inspectionRes.error) console.error("Inspection report load failed", inspectionRes.error);
  if (answersRes.error) console.error("Inspection report answers failed", answersRes.error);
  if (signatureRes.error) console.error("Inspection report signature failed", signatureRes.error);

  const inspection = inspectionRes.data as any;
  const answers = (answersRes.data ?? []) as any[];
  const signature = signatureRes.data as any;

  if (!inspection) {
    return <section className="dashboard-section"><div className="empty-state"><strong>לא ניתן לטעון את דוח הפיקוח</strong><span>ייתכן שהדוח לא קיים או שאין הרשאה לצפות בו.</span><Link className="button secondary" href={backHref}>חזרה</Link></div></section>;
  }

  const exceptions = answers.filter((answer) => Number(answer.score ?? 10) <= 4 || answer.inspection_form_questions?.critical);

  return (
    <section className="dashboard-section printable-report">
      <div className={`${role === "admin" ? "admin-hero-card" : role === "parent" ? "parent-hero-card" : "garden-hero-card"} dashboard-hero-card`}>
        <div>
          <p className="eyebrow">דוח ביקורת מאושר</p>
          <h1>{inspection.gardens?.name ?? "גן ילדים"}</h1>
          <p>{inspection.gardens?.city ?? ""} · {inspection.gardens?.address ?? "כתובת לפי הרשאה"} · פקח: {inspection.inspectors?.full_name ?? "לא צוין"}</p>
        </div>
        <span className={Number(inspection.weighted_score ?? 0) >= 8 ? "pill good" : "pill bad"}>ציון {inspection.weighted_score ?? "-"}</span>
      </div>

      <div className="actions"><Link className="button" href={backHref}>חזרה לרשימה</Link><PrintButton /><a className="button secondary" href={`/api/inspections/${id}/report?download=1`}>הורדת קובץ דוח</a></div>

      <div className="grid cols-4 dashboard-kpis">
        <div className="card stat-card">תאריך ביצוע <b>{dateText(inspection.completed_at)}</b></div>
        <div className="card stat-card">ליקויים <b>{inspection.violation_count ?? exceptions.length}</b></div>
        <div className="card stat-card">כשלים קריטיים <b>{inspection.critical_failures ?? exceptions.filter((item) => item.inspection_form_questions?.critical).length}</b></div>
        <div className="card stat-card">סטטוס <b>{inspection.status ?? "לא צוין"}</b></div>
      </div>

      <article className="card action-panel">
        <h2>חריגים אדומים</h2>
        {exceptions.length === 0 ? <div className="empty-mini">לא נמצאו חריגים בציון 1-4 או שאלות קריטיות שנכשלו.</div> : <div className="procedure-list">{exceptions.map((answer) => <div className="list-item" key={answer.id}><div><strong>{answer.inspection_form_questions?.question_text ?? "שאלה"}</strong><span>{answer.inspection_form_questions?.category ?? "קטגוריה"} · ציון {answer.score ?? "-"}</span></div><span className="pill bad">דורש תיקון</span></div>)}</div>}
      </article>

      <article className="card action-panel">
        <h2>שאלות ותשובות</h2>
        {answers.length === 0 ? <div className="empty-mini">אין תשובות שמורות לדוח זה.</div> : <div className="report-answer-list">{answers.map((answer) => <div className="inspection-answer-card" key={answer.id}><div><span className={Number(answer.score ?? 10) <= 4 ? "pill bad" : "pill good"}>{answer.score ?? answer.boolean_value ?? "טקסט"}</span><strong>{answer.inspection_form_questions?.question_text ?? "שאלה"}</strong><small>{answer.inspection_form_questions?.category ?? ""} · משקל {answer.inspection_form_questions?.weight ?? 1}</small></div>{answer.note ? <p>{answer.note}</p> : null}<div className="actions">{answer.photo_url ? <a className="button tiny secondary" href={answer.photo_url}>צילום</a> : null}{answer.document_url ? <a className="button tiny secondary" href={answer.document_url}>מסמך</a> : null}</div></div>)}</div>}
      </article>

      <article className="card action-panel">
        <h2>חתימה ו-GPS</h2>
        {signature?.signature_image ? <img className="signature-preview" src={signature.signature_image} alt="חתימת פקח" /> : inspection.signature_image ? <img className="signature-preview" src={inspection.signature_image} alt="חתימת פקח" /> : <div className="empty-mini">לא נשמרה חתימה לדוח זה.</div>}
        <p>נחתם: {dateText(signature?.signed_at ?? inspection.signed_at)} · GPS: {signature?.gps_lat ?? "-"}, {signature?.gps_lng ?? "-"} · מרחק: {signature?.gps_distance_meters ?? "-"} מטר</p>
      </article>
    </section>
  );
}
