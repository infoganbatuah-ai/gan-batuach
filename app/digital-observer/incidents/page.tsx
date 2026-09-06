import Link from "next/link";
import { CheckCircle2, Clock3, ListTree, Radar, Scale, ShieldAlert } from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { IncidentFeedbackPanel } from "@/components/digital-observer/incident-feedback-panel";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { createDigitalObserverAdminDataClient, hasObserverAdminClaim } from "@/lib/domain/digital-observer/admin-access";
import { formatObserverDate, loadObserverRuntime, observerModeForSite, selectObserverSite, type ObserverRow } from "@/lib/domain/digital-observer/runtime";
import { createClient } from "@/lib/supabase/server";

type PageProps = { searchParams?: Promise<{ site?: string; incident?: string }> };
type TimelineItem = { event_id: string; event_type: string; timestamp: string; confidence: number | null };
type IncidentRow = {
  id: string;
  status: string;
  title: string | null;
  summary: string | null;
  opened_at: string;
  last_activity_at: string;
  provenance: string | null;
  timeline_summary: TimelineItem[] | null;
  current_risk_score: number | null;
  peak_risk_score: number | null;
  current_risk_band: string | null;
  risk_evaluation_confidence: number | null;
  current_decision: string | null;
  risk_updated_at: string | null;
  current_verification_status: string | null;
  verification_classification: string | null;
  verification_confidence: number | null;
  final_decision: string | null;
  final_decision_confidence: number | null;
  verification_updated_at: string | null;
  current_feedback_label: string | null;
  latest_feedback_revision_id: string | null;
  feedback_updated_at: string | null;
  current_ground_truth_label: string | null;
  latest_ground_truth_review_id: string | null;
  ground_truth_reviewed_at: string | null;
  metadata: Record<string, unknown> | null;
};

type RiskEvaluationRow = {
  id: string;
  risk_score: number;
  risk_band: string;
  evaluation_confidence: number;
  contributing_factors: Array<{ key: string; label: string; delta: number }>;
  mitigating_factors: Array<{ key: string; label: string; delta: number }>;
  matched_rules: Array<{ id: string; title: string; version: string }>;
  baseline_context: { maturity?: string; version?: string | null };
  explanation: { headline?: string; uncertainty?: string[] };
  recommended_decision: string;
  risk_engine_version: string;
  factor_version: string;
  decision_version: string;
  evaluated_at: string;
};

type VerificationRow = {
  id: string;
  status: string;
  classification: string;
  verification_confidence: number;
  final_decision_confidence: number;
  confirmed_signals: Array<{ key: string; label: string }>;
  contradictory_signals: Array<{ key: string; label: string }>;
  verification_reasons: string[];
  required_followup: string;
  final_decision: string;
  fast_path: boolean;
  verification_version: string;
  final_decision_version: string;
  evaluated_at: string;
};

const statusLabel = (status: string) => ({
  open: "פתוחה", acknowledged: "נבדקת", resolved: "טופלה", closed: "נסגרה"
}[status] ?? status);

const riskBandLabel = (band?: string | null) => ({
  LOW: "נמוך", GUARDED: "שמור", ELEVATED: "דורש בדיקה", HIGH: "גבוה", CRITICAL: "קריטי"
}[String(band ?? "")] ?? "טרם הוערך");

const decisionLabel = (decision?: string | null) => ({
  IGNORE: "ללא פעולה", LOG_ONLY: "שמירה ביומן", PRESERVE_EVIDENCE: "שימור ראיה", VERIFY: "בדיקה מומלצת",
  NOTIFY_IN_APP: "עדכון באפליקציה", ESCALATION_CANDIDATE: "מועמד להסלמה לאחר בדיקה"
}[String(decision ?? "")] ?? "טרם התקבלה החלטה");

const verificationLabel = (status?: string | null) => ({
  UNVERIFIED: "טרם אומת", LIKELY: "סביר", CONFIRMED: "מאומת כאירוע אמיתי", UNCERTAIN: "נדרש אימות נוסף",
  REJECTED_FALSE_POSITIVE: "נדחה כזיהוי שווא", RESOLVED: "מאומת והסתיים"
}[String(status ?? "")] ?? "טרם אומת");

const classificationLabel = (classification?: string | null) => ({
  TRUE_SECURITY_EVENT: "אירוע אבטחה אמיתי", TRUE_EXPECTED_ACTIVITY: "פעילות אמיתית וצפויה",
  FALSE_DETECTION: "זיהוי שווא", FALSE_CORRELATION: "קישור אירועים שגוי", OTHER_UNKNOWN: "לא ידוע"
}[String(classification ?? "")] ?? "לא ידוע");

const followupLabel = (followup?: string | null) => ({
  NONE: "לא נדרש", VERIFY: "בדיקה נוספת", PRESERVE_EVIDENCE: "שימור ראיה", HUMAN_REVIEW: "בדיקה אנושית"
}[String(followup ?? "")] ?? "לא ידוע");

export default async function DigitalObserverIncidentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { profile, user } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/incidents");
  const runtime = await loadObserverRuntime(profile.id);
  const observerAdmin = profile.role === "admin" || hasObserverAdminClaim(user.app_metadata);
  const sessionSupabase = await createClient();
  const supabase = observerAdmin ? createDigitalObserverAdminDataClient() : sessionSupabase;
  let site: ObserverRow | null = selectObserverSite(runtime.sites, runtime.cameras, params?.site);
  if (!site && observerAdmin && params?.site) {
    const adminSite = await supabase.from("observer_sites" as never)
      .select("id,name,site_type,monitoring_enabled")
      .eq("id", params.site)
      .neq("site_type", "kindergarten")
      .maybeSingle();
    site = adminSite.data as ObserverRow | null;
  }
  const mode = observerModeForSite(site);
  const result = site ? await supabase.from("observer_correlated_events" as never)
    .select("id,observer_site_id,status,severity,confidence,title,summary,opened_at,last_activity_at,closed_at,primary_camera_source_id,involved_track_ids,related_event_ids,provenance,correlation_version,timeline_summary,current_risk_score,peak_risk_score,current_risk_band,risk_evaluation_confidence,current_decision,risk_updated_at,current_verification_status,verification_classification,verification_confidence,final_decision,final_decision_confidence,verification_updated_at,current_feedback_label,latest_feedback_revision_id,feedback_updated_at,current_ground_truth_label,latest_ground_truth_review_id,ground_truth_reviewed_at,metadata")
    .eq("observer_site_id", site.id).eq("correlation_version", "do-track-v1")
    .order("last_activity_at", { ascending: false }).limit(100) : { data: [], error: null };
  const incidents = (result.data ?? []) as unknown as IncidentRow[];
  const selected = incidents.find((incident) => incident.id === params?.incident) ?? null;
  const riskResult = selected ? await supabase.from("digital_observer_risk_evaluations" as never)
    .select("id,risk_score,risk_band,evaluation_confidence,contributing_factors,mitigating_factors,matched_rules,baseline_context,explanation,recommended_decision,risk_engine_version,factor_version,decision_version,evaluated_at")
    .eq("observer_site_id", site!.id).eq("incident_id", selected.id).order("evaluated_at", { ascending: false }).limit(20) : { data: [], error: null };
  const riskHistory = (riskResult.data ?? []) as unknown as RiskEvaluationRow[];
  const latestRisk = riskHistory[0] ?? null;
  const verificationResult = selected ? await supabase.from("digital_observer_incident_verifications" as never)
    .select("id,status,classification,verification_confidence,final_decision_confidence,confirmed_signals,contradictory_signals,verification_reasons,required_followup,final_decision,fast_path,verification_version,final_decision_version,evaluated_at")
    .eq("observer_site_id", site!.id).eq("incident_id", selected.id).order("evaluated_at", { ascending: false }).limit(20) : { data: [], error: null };
  const verificationHistory = (verificationResult.data ?? []) as unknown as VerificationRow[];
  const latestVerification = verificationHistory[0] ?? null;
  const feedbackResult = selected ? await supabase.from("digital_observer_feedback_revisions" as never)
    .select("id,label,revision_number,created_at")
    .eq("observer_site_id", site!.id).eq("incident_id", selected.id).order("revision_number", { ascending: false }).limit(1) : { data: [], error: null };
  const latestFeedback = ((feedbackResult.data ?? []) as unknown as Array<{ id: string; label: string }>)[0] ?? null;
  const canReview = observerAdmin;
  return <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/incidents" title={selected ? "פרטי תקרית" : "תקריות"} statusLabel="אירועים אמיתיים מקובצים לפי מצב">
    <div className="do-page-stack do-alert-center">
      {result.error ? <section className="do-panel"><strong>שכבת התקריות אינה זמינה כרגע</strong><p>האירועים המקוריים נשארים זמינים במרכז האירועים.</p></section> : null}
      {!selected ? <article className="do-panel do-alert-list-panel">
        <div className="do-section-head"><div><h2>תקריות</h2><p>כל תקרית מרכזת אירועי מצלמה עובדתיים מאותו אתר, מקור ו־Track ID.</p></div><span className="do-badge info">{incidents.length} תקריות</span></div>
        {incidents.length ? <div className="do-alert-list">{incidents.map((incident) => <Link className="do-alert-row" href={`/digital-observer/incidents?${new URLSearchParams({ site: site!.id, incident: incident.id })}`} key={incident.id}>
          <span className={`do-alert-symbol ${incident.status === "closed" ? "info" : "warn"}`}><ListTree /></span>
          <span className="do-row-main"><strong>{incident.title || "תקרית מצלמה"}</strong><small>{incident.summary || "ממתינה לבדיקה"}</small></span>
          <span className="do-row-meta"><b className={`do-badge ${incident.current_verification_status === "UNCERTAIN" ? "warn" : "info"}`}>{verificationLabel(incident.current_verification_status)}</b><small>{riskBandLabel(incident.current_risk_band)} · {statusLabel(incident.status)}</small><time>{formatObserverDate(incident.last_activity_at)}</time></span>
        </Link>)}</div> : <div className="do-empty"><CheckCircle2 /><strong>אין תקריות להצגה</strong><span>אירועים מרחביים קשורים יופיעו כאן כתקרית אחת.</span></div>}
        <div className="do-button-row"><Link className="do-button secondary" href="/digital-observer/alerts">צפייה בכל האירועים העובדתיים</Link></div>
      </article> : <section className="do-event-detail-grid">
        <article className="do-panel do-event-evidence"><span className={`do-badge ${selected.status === "closed" ? "info" : "warn"}`}>{statusLabel(selected.status)}</span><h1>{selected.title}</h1><p>{selected.summary}</p><dl><div><dt>נפתחה</dt><dd>{formatObserverDate(selected.opened_at)}</dd></div><div><dt>פעילות אחרונה</dt><dd>{formatObserverDate(selected.last_activity_at)}</dd></div><div><dt>מקור</dt><dd>{selected.provenance === "REAL_CAMERA_AI" ? "מצלמה אמיתית ו־AI מקומי" : "מקור לא מאומת"}</dd></div></dl></article>
        <article className="do-panel do-event-review-panel">
          <div className="do-section-head"><div><h2>הערכת מצב</h2><p>הערכה דטרמיניסטית ומוסברת ברמת התקרית; ביטחון הזיהוי אינו ציון הסיכון.</p></div><Scale /></div>
          {latestRisk ? <>
            <div className="do-notice info"><ShieldAlert /><span><strong>{latestRisk.risk_score}/100 · {riskBandLabel(latestRisk.risk_band)}</strong><small>{latestRisk.explanation?.headline}</small></span></div>
            <dl><div><dt>החלטה מומלצת</dt><dd>{decisionLabel(latestRisk.recommended_decision)}</dd></div><div><dt>ביטחון בהערכה</dt><dd>{Math.round(Number(latestRisk.evaluation_confidence) * 100)}%</dd></div><div><dt>בשלות קו בסיס</dt><dd>{latestRisk.baseline_context?.maturity ?? "לא ידועה"}</dd></div><div><dt>שיא היסטורי</dt><dd>{selected.peak_risk_score ?? latestRisk.risk_score}/100</dd></div></dl>
            {latestRisk.contributing_factors?.length ? <div><h3>מה העלה את תשומת הלב</h3>{latestRisk.contributing_factors.map((item) => <p key={item.key}>+{item.delta} · {item.label}</p>)}</div> : null}
            {latestRisk.mitigating_factors?.length ? <div><h3>מה הפחית את תשומת הלב</h3>{latestRisk.mitigating_factors.map((item) => <p key={item.key}>{item.delta} · {item.label}</p>)}</div> : null}
            {latestRisk.explanation?.uncertainty?.length ? <div className="do-notice warn"><span><strong>מגבלות ההערכה</strong>{latestRisk.explanation.uncertainty.map((item) => <small key={item}>{item}</small>)}</span></div> : null}
            <small>גרסאות: {latestRisk.risk_engine_version} · {latestRisk.factor_version} · {latestRisk.decision_version}</small>
          </> : <div className="do-empty compact"><Scale /><strong>טרם נוצרה הערכת Risk</strong><span>אין להסיק רמת סיכון מציון הביטחון של הגלאי.</span></div>}
        </article>
        <article className="do-panel do-event-review-panel">
          <div className="do-section-head"><div><h2>אימות האירוע</h2><p>אימות עובדתי נפרד מביטחון הזיהוי ומציון הסיכון.</p></div><CheckCircle2 /></div>
          {latestVerification ? <>
            <div className={`do-notice ${latestVerification.status === "UNCERTAIN" || latestVerification.status === "UNVERIFIED" ? "warn" : "info"}`}><Radar /><span><strong>{verificationLabel(latestVerification.status)}</strong><small>{classificationLabel(latestVerification.classification)}</small></span></div>
            <dl><div><dt>ביטחון באימות</dt><dd>{Math.round(Number(latestVerification.verification_confidence) * 100)}%</dd></div><div><dt>החלטה סופית</dt><dd>{decisionLabel(latestVerification.final_decision)}</dd></div><div><dt>ביטחון בהחלטה</dt><dd>{Math.round(Number(latestVerification.final_decision_confidence) * 100)}%</dd></div><div><dt>המשך נדרש</dt><dd>{followupLabel(latestVerification.required_followup)}</dd></div></dl>
            {latestVerification.confirmed_signals?.length ? <div><h3>מה אישר את האירוע</h3>{latestVerification.confirmed_signals.map((item) => <p key={item.key}>{item.label}</p>)}</div> : null}
            {latestVerification.contradictory_signals?.length ? <div className="do-notice warn"><span><strong>אותות סותרים או מגבלות</strong>{latestVerification.contradictory_signals.map((item) => <small key={item.key}>{item.label}</small>)}</span></div> : null}
            <small>גרסאות: {latestVerification.verification_version} · {latestVerification.final_decision_version}</small>
          </> : <div className="do-empty compact"><Radar /><strong>טרם נוצר אימות קנוני</strong><span>התקרית נשמרת, אך אין להציג אותה כמאומתת עד שהשכבה הדטרמיניסטית תרוץ.</span></div>}
        </article>
        <IncidentFeedbackPanel
          incidentId={selected.id}
          currentLabel={selected.current_feedback_label ?? latestFeedback?.label}
          currentFeedbackId={selected.latest_feedback_revision_id ?? latestFeedback?.id}
          groundTruthLabel={selected.current_ground_truth_label}
          canReview={canReview}
        />
        <aside className="do-panel do-event-review-panel"><h2>ציר זמן</h2>{Array.isArray(selected.timeline_summary) ? [...selected.timeline_summary].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).map((event) => <div className="do-notice info" key={event.event_id}><Radar /><span><strong>{event.event_type === "person_entered" ? "אדם נכנס" : event.event_type === "person_exited" ? "אדם יצא" : event.event_type}</strong><small>{formatObserverDate(event.timestamp)} · ביטחון {event.confidence == null ? "לא נמסר" : `${Math.round(Number(event.confidence) * 100)}%`}</small><Link href={`/digital-observer/alerts?event=${event.event_id}`}>צפייה באירוע המקורי</Link></span></div>) : null}</aside>
        <div className="do-button-row"><Link className="do-button secondary" href={`/digital-observer/incidents?site=${site?.id ?? ""}`}><Clock3 /> חזרה לתקריות</Link><Link className="do-button secondary" href="/digital-observer/alerts">כל האירועים</Link></div>
      </section>}
    </div>
  </ObserverAppShell>;
}
