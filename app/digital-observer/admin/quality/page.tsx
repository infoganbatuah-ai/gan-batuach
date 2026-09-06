import Link from "next/link";
import { BarChart3, ClipboardCheck, Gauge, ShieldCheck } from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { createDigitalObserverAdminDataClient, requireDigitalObserverAdmin } from "@/lib/domain/digital-observer/admin-access";
import { buildFeedbackQualityMetrics, type ReviewedCalibrationSample } from "@/lib/domain/digital-observer/feedback-calibration";
import { formatObserverDate } from "@/lib/domain/digital-observer/runtime";

type Row = Record<string, unknown>;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

const labelName = (label: unknown) => ({
  TRUE_SECURITY_EVENT: "אירוע אמיתי ודורש תשומת לב",
  TRUE_EXPECTED_ACTIVITY: "פעילות אמיתית וצפויה",
  FALSE_DETECTION: "זיהוי שגוי",
  FALSE_CORRELATION: "קיבוץ תקרית שגוי",
  FALSE_SPATIAL_EVENT: "מעבר או אזור שגוי",
  UNCERTAIN: "לא בטוח",
  OTHER: "אחר"
}[String(label)] ?? String(label ?? "לא ידוע"));

const percentage = (value: number | null) => value == null ? "—" : `${Math.round(value * 100)}%`;

export default async function DigitalObserverAdminQualityPage() {
  const { profile } = await requireDigitalObserverAdmin("/digital-observer/admin/quality");
  const supabase = createDigitalObserverAdminDataClient();
  const [samplesResult, reviewsResult, feedbackResult, recommendationsResult, incidentsResult] = await Promise.all([
    supabase.from("digital_observer_calibration_samples" as never)
      .select("id,observer_site_id,camera_source_id,incident_id,ground_truth_review_id,canonical_label,environment,incident_provenance,decision_snapshot,verification_snapshot,version_snapshot,decision_quality,calibration_signal_type,dataset_version,training_eligible,raw_media_copied,created_at")
      .order("created_at", { ascending: false }).limit(1000),
    supabase.from("observer_ground_truth_reviews" as never)
      .select("id,feedback_revision_id,incident_id,canonical_label,review_state,review_number,review_version,reviewed_by,created_at")
      .not("canonical_label", "is", null).order("created_at", { ascending: false }).limit(1000),
    supabase.from("digital_observer_feedback_revisions" as never)
      .select("id,observer_site_id,incident_id,label,actor_role,revision_number,feedback_version,created_at")
      .order("created_at", { ascending: false }).limit(200),
    supabase.from("digital_observer_calibration_recommendations" as never)
      .select("id,observer_site_id,camera_source_id,ground_truth_review_id,scope_type,scope_id,recommendation_type,status,sample_size,recommendation_confidence,evidence_summary,affected_versions,recommendation_version,requires_human_approval,production_change_applied,created_at")
      .order("created_at", { ascending: false }).limit(200),
    supabase.from("observer_correlated_events" as never)
      .select("id,observer_site_id,title,primary_camera_source_id,provenance,current_feedback_label,current_ground_truth_label")
      .eq("correlation_version", "do-track-v1").order("last_activity_at", { ascending: false }).limit(300)
  ]);
  const failed = [samplesResult, reviewsResult, feedbackResult, recommendationsResult, incidentsResult].some((result) => result.error);
  const samples = (samplesResult.data ?? []) as Row[];
  const reviews = (reviewsResult.data ?? []) as Row[];
  const feedback = (feedbackResult.data ?? []) as Row[];
  const recommendations = (recommendationsResult.data ?? []) as Row[];
  const incidents = (incidentsResult.data ?? []) as Row[];
  const reviewState = new Map(reviews.map((review) => [String(review.id), String(review.review_state)]));
  const reviewedFeedback = new Set(reviews.map((review) => String(review.feedback_revision_id)));
  const incidentById = new Map(incidents.map((incident) => [String(incident.id), incident]));
  const mappedSamples: ReviewedCalibrationSample[] = samples.map((sample) => {
    const decision = objectValue(sample.decision_snapshot);
    const verification = objectValue(sample.verification_snapshot);
    return {
      id: String(sample.id),
      canonicalLabel: String(sample.canonical_label) as ReviewedCalibrationSample["canonicalLabel"],
      environment: String(sample.environment) as ReviewedCalibrationSample["environment"],
      incidentProvenance: String(sample.incident_provenance),
      reviewState: (reviewState.get(String(sample.ground_truth_review_id)) ?? "REVIEWED") as ReviewedCalibrationSample["reviewState"],
      observerSiteId: String(sample.observer_site_id),
      cameraSourceId: typeof sample.camera_source_id === "string" ? sample.camera_source_id : null,
      decision: typeof decision.decision === "string" ? decision.decision : null,
      verificationStatus: typeof verification.status === "string" ? verification.status : null,
      verificationClassification: typeof verification.classification === "string" ? verification.classification : null,
      versionSnapshot: objectValue(sample.version_snapshot)
    };
  });
  const metrics = buildFeedbackQualityMetrics(mappedSamples);
  const pending = feedback.filter((item) => !reviewedFeedback.has(String(item.id)));

  return <ObserverAppShell profile={profile} mode="admin" activeHref="/digital-observer/admin/quality" title="איכות וכיול" statusLabel="Ground Truth מבוקר בלבד">
    <div className="do-page-stack">
      {failed ? <div className="do-notice warn"><span>חלק מנתוני האיכות אינם זמינים. לא מוצגים מדדים חלופיים או אחוזי דיוק מומצאים.</span></div> : null}
      <section className="do-business-summary">
        <article className="do-metric"><ClipboardCheck /><strong>{metrics.reviewedIncidentCount}</strong><span>תקריות שנבדקו</span></article>
        <article className="do-metric"><BarChart3 /><strong>{metrics.labels.TRUE_EXPECTED_ACTIVITY}</strong><span>פעילות אמיתית וצפויה</span></article>
        <article className="do-metric alert"><ShieldCheck /><strong>{metrics.labels.FALSE_DETECTION}</strong><span>זיהויים שגויים</span></article>
        <article className="do-metric"><Gauge /><strong>{percentage(metrics.verificationAlignment.value)}</strong><span>התאמת אימות</span></article>
      </section>

      <section className="do-grid cols-2">
        <article className="do-panel">
          <div className="do-section-head"><div><h2>מדדי איכות מתויגים</h2><p>המדדים כוללים רק Ground Truth שנבדק, ממקור REAL_CAMERA_AI ובסביבת Production.</p></div><BarChart3 /></div>
          <div className="do-summary-list">
            <div><span>False Detection Rate</span><strong>{percentage(metrics.falseDetectionRate.value)} ({metrics.falseDetectionRate.numerator}/{metrics.falseDetectionRate.denominator})</strong></div>
            <div><span>Expected Activity Rate</span><strong>{percentage(metrics.expectedActivityRate.value)} ({metrics.expectedActivityRate.numerator}/{metrics.expectedActivityRate.denominator})</strong></div>
            <div><span>Reviewed detection precision</span><strong>{percentage(metrics.reviewedDetectionPrecision.value)} ({metrics.reviewedDetectionPrecision.numerator}/{metrics.reviewedDetectionPrecision.denominator})</strong></div>
            <div><span>Recall</span><strong>לא זמין</strong></div>
          </div>
          <div className="do-notice info"><ShieldCheck /><span><strong>גודל מדגם: {metrics.reviewedIncidentCount}</strong><small>אין להסיק דיוק גלובלי ממדגם קטן. Recall דורש גם אירועים אמיתיים שהמערכת פספסה.</small></span></div>
        </article>

        <article className="do-panel">
          <div className="do-section-head"><div><h2>התפלגות Ground Truth</h2><p>פעילות צפויה נשמרת בנפרד מזיהוי שגוי.</p></div><ClipboardCheck /></div>
          <div className="do-summary-list">{Object.entries(metrics.labels).map(([key, count]) => <div key={key}><span>{labelName(key)}</span><strong>{count}</strong></div>)}</div>
        </article>
      </section>

      <section className="do-panel">
        <div className="do-section-head"><div><h2>ממתין לביקורת</h2><p>משוב משתמש הוא USER_LABEL בלבד עד שבעל הרשאת review מאשר או מתקן אותו.</p></div><ClipboardCheck /></div>
        {pending.length ? <div className="do-row-list">{pending.slice(0, 20).map((item) => {
          const incident = incidentById.get(String(item.incident_id));
          return <div className="do-row" key={String(item.id)}><ClipboardCheck /><span className="do-row-main"><strong>{labelName(item.label)}</strong><small>{String(incident?.title ?? "תקרית מצלמה")} · תיקון #{String(item.revision_number)}</small></span><span className="do-row-meta"><time>{formatObserverDate(String(item.created_at))}</time><Link className="do-link" href={`/digital-observer/incidents?site=${String(item.observer_site_id)}&incident=${String(item.incident_id)}`}>פתיחה וביקורת</Link></span></div>;
        })}</div> : <div className="do-empty compact"><ClipboardCheck /><strong>אין משוב שממתין לביקורת</strong></div>}
      </section>

      <section className="do-grid cols-2">
        <article className="do-panel">
          <div className="do-section-head"><div><h2>דגימות כיול מבוקרות</h2><p>Metadata מובנה והפניות ראיה בלבד; וידאו אינו מועתק אוטומטית לדאטה־סט.</p></div><Gauge /></div>
          {samples.length ? <div className="do-row-list">{samples.slice(0, 12).map((sample) => <div className="do-row" key={String(sample.id)}><Gauge /><span className="do-row-main"><strong>{labelName(sample.canonical_label)}</strong><small>{String(sample.calibration_signal_type)} · {String(sample.decision_quality)}</small></span><span className="do-row-meta"><b>{String(sample.dataset_version)}</b><small>{formatObserverDate(String(sample.created_at))}</small></span></div>)}</div> : <div className="do-empty compact"><Gauge /><strong>אין עדיין דגימות מבוקרות</strong></div>}
        </article>

        <article className="do-panel">
          <div className="do-section-head"><div><h2>המלצות כיול</h2><p>המלצה אינה שינוי Production. כל קידום מחייב בדיקה, אישור וגרסה חדשה.</p></div><ShieldCheck /></div>
          {recommendations.length ? <div className="do-row-list">{recommendations.slice(0, 12).map((item) => <div className="do-row" key={String(item.id)}><ShieldCheck /><span className="do-row-main"><strong>{String(item.recommendation_type)}</strong><small>{String(item.scope_type)} · מדגם {String(item.sample_size)}</small></span><span className="do-row-meta"><b>{String(item.status)}</b><small>ביטחון {percentage(Number(item.recommendation_confidence))}</small></span></div>)}</div> : <div className="do-empty compact"><ShieldCheck /><strong>אין עדיין המלצות</strong></div>}
        </article>
      </section>

      <section className="do-panel">
        <div className="do-section-head"><div><h2>הפרדת גרסאות ושער למידה</h2><p>מדדים מופרדים לפי מודל, Risk, Verification, Decision, Baseline וכללים.</p></div><ShieldCheck /></div>
        <div className="do-summary-list"><div><span>קבוצות גרסה במדגם</span><strong>{metrics.versionGroups.length}</strong></div><div><span>שינוי אוטומטי ב‑Production</span><strong>חסום</strong></div><div><span>קידום מודל/סף/כלל</span><strong>אישור אנושי + גרסה חדשה</strong></div></div>
      </section>
    </div>
  </ObserverAppShell>;
}
