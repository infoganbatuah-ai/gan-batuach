import Link from "next/link";
import { Activity, AlertTriangle, BrainCircuit, Clock, Eye, GitBranch, MapPinned, ShieldCheck, UserCheck } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { temporalGraphReadiness } from "@/lib/domain/observer/skeleton-motion-engine";

type Row = Record<string, any>;
type Tone = "default" | "good" | "warn" | "bad";

function statusTone(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["enabled", "allowed", "approved", "approved_with_restrictions", "prepared", "confirmed", "resolved", "closed"].includes(value)) return "good";
  if (["pending_review", "detected", "reviewing", "needs_followup", "needs_review", "restricted", "legal_review_required", "testing"].includes(value)) return "warn";
  if (["disabled", "blocked", "rejected", "escalated", "critical"].includes(value)) return "bad";
  return "default";
}

function scoreTone(score: number): Tone {
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  return "bad";
}

function label(status?: string | null) {
  const labels: Record<string, string> = {
    enabled: "פעיל",
    disabled: "כבוי",
    allowed: "מותר",
    approved: "מאושר",
    approved_with_restrictions: "מאושר בהגבלות",
    prepared: "מוכן",
    testing: "בבדיקה",
    restricted: "מוגבל",
    legal_review_required: "בדיקה משפטית",
    detected: "זוהה",
    pending_review: "ממתין לבדיקה",
    reviewing: "בבדיקה",
    confirmed: "אושר",
    dismissed: "נדחה",
    needs_followup: "דורש המשך",
    escalated: "הוסלם",
    resolved: "טופל",
    closed: "נסגר",
    blocked: "חסום"
  };
  return labels[String(status ?? "")] ?? status ?? "לא ידוע";
}

function average(rows: Row[], field: string) {
  const values = rows.map((row) => Number(row[field] ?? 0)).filter((value) => Number.isFinite(value));
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

async function safeQuery<T>(label: string, run: () => any) {
  try {
    const result = await run() as { data: T[] | null; error: any };
    logSupabaseError(label, result.error);
    return result.error ? [] : result.data ?? [];
  } catch (error) {
    logSupabaseError(label, error);
    return [];
  }
}

export default async function SkeletonAnalyticsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("skeleton analytics", async () => {
    const supabase = await createClient();
    const [events, readiness, rules, capabilities, matrix, dpias, contexts, retention, signals] = await Promise.all([
      safeQuery<Row>("skeleton observer events", () => supabase.from("skeleton_observer_events" as any).select("*, camera_streams(name), camera_zones(name, zone_type, is_restricted), gardens(name, city)").order("event_timestamp", { ascending: false }).limit(180)),
      safeQuery<Row>("skeleton model readiness", () => supabase.from("skeleton_model_readiness_checks" as any).select("*").order("vertical_key").order("capability_key").limit(80)),
      safeQuery<Row>("skeleton motion rules", () => supabase.from("skeleton_motion_rules" as any).select("*").order("event_type").limit(80)),
      safeQuery<Row>("ai capabilities skeleton", () => supabase.from("ai_capabilities" as any).select("*").in("capability_key", ["pose_estimation", "skeleton_analytics", "motion_anomaly_detection", "fall_detection", "inactivity_detection", "crowding_detection", "contextual_child_association", "gait_recognition", "soft_biometric_matching", "audio_analytics", "face_recognition"]).order("capability_name").limit(120)),
      safeQuery<Row>("vertical capability matrix skeleton", () => supabase.from("vertical_capability_matrix" as any).select("*").in("capability_key", ["pose_estimation", "skeleton_tracking", "skeleton_analytics", "motion_analytics", "motion_anomaly_detection", "fall_detection", "inactivity_detection", "crowding_detection", "restricted_area_detection", "contextual_child_association", "audio_analytics", "face_recognition"]).order("vertical_key").order("capability_name").limit(200)),
      safeQuery<Row>("skeleton dpia", () => supabase.from("ai_dpia_assessments" as any).select("*").eq("ai_system_key", "skeleton_motion_engine").limit(20)),
      safeQuery<Row>("ephemeral context", () => supabase.from("observer_ephemeral_context" as any).select("*").order("expires_at", { ascending: true }).limit(80)),
      safeQuery<Row>("skeleton retention", () => supabase.from("skeleton_retention_controls" as any).select("*").order("data_type").limit(40)),
      safeQuery<Row>("skeleton observer signals", () => supabase.from("observer_intelligence_signals" as any).select("*").eq("source_type", "skeleton_motion").order("created_at", { ascending: false }).limit(120))
    ]);
    return { events, readiness, rules, capabilities, matrix, dpias, contexts, retention, signals };
  }, {
    events: [] as Row[],
    readiness: [] as Row[],
    rules: [] as Row[],
    capabilities: [] as Row[],
    matrix: [] as Row[],
    dpias: [] as Row[],
    contexts: [] as Row[],
    retention: [] as Row[],
    signals: [] as Row[]
  });

  const data = result.data;
  const readinessScore = average(data.readiness, "readiness_score");
  const enabledVerticals = new Set(data.matrix.filter((item) => item.capability_status === "enabled").map((item) => item.vertical_key)).size;
  const activeCapabilities = data.matrix.filter((item) => item.capability_status === "enabled").length;
  const restrictedCapabilities = data.matrix.filter((item) => ["restricted", "legal_review_required"].includes(String(item.capability_status))).length;
  const reviewQueue = data.events.filter((event) => ["detected", "pending_review", "reviewing", "needs_followup", "escalated"].includes(String(event.review_status)));
  const legalReview = data.capabilities.filter((item) => item.legal_status === "legal_review_required" || item.reviewer_approval_status === "pending").length;
  const blockedIdentity = data.capabilities.filter((item) => ["face_recognition", "audio_analytics", "contextual_child_association", "gait_recognition", "soft_biometric_matching"].includes(String(item.capability_key)));
  const ganBatuachAllowed = data.matrix.filter((item) => item.vertical_key === "gan_batuach" && item.capability_status === "enabled");
  const contextsActive = data.contexts.filter((context) => !context.deleted_at && new Date(context.expires_at).getTime() > Date.now()).length;

  return (
    <DashboardShell role="admin" title="Skeleton Analytics">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Anonymous Motion Intelligence"
          title="מרכז Skeleton Analytics ותנועת תצפיתן אנונימית"
          subtitle="שכבת AI חוקית ל־Gan Batuach: שלד, Pose ותנועה בלבד. בלי פנים, בלי שמע, בלי פרופיל ביומטרי, ועם בדיקה אנושית חובה."
          badge={`${readinessScore}/100`}
          badgeTone={scoreTone(readinessScore)}
          actions={<><Link className="button primary" href="/dashboard/admin/digital-observer-core">Observer Core</Link><Link className="button secondary" href="/dashboard/admin/ai-governance">AI Governance</Link></>}
        >
          <div className="setup-checklist">
            <span>No face recognition</span>
            <span>No audio processing</span>
            <span>Anonymous skeleton vectors only</span>
            <span>Human review mandatory</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="ורטיקלים פעילים" value={enabledVerticals} hint="לפי מטריצת יכולות" tone="good" />
          <RoleMetricCard label="יכולות פעילות" value={activeCapabilities} hint="Pose, Skeleton, Motion" tone="good" />
          <RoleMetricCard label="מוגבל/משפטי" value={restrictedCapabilities} hint="זהות, הקשר ושיוך" tone="warn" />
          <RoleMetricCard label="מוכנות מודלים" value={`${readinessScore}/100`} hint="YOLOv8, MediaPipe, ST-GCN" tone={scoreTone(readinessScore)} />
          <RoleMetricCard label="תור Review" value={reviewQueue.length} hint="ללא פעולה אוטומטית" tone={reviewQueue.length ? "warn" : "good"} />
          <RoleMetricCard label="בדיקה משפטית" value={legalReview} hint="יכולות לא מופעלות" tone={legalReview ? "warn" : "good"} />
          <RoleMetricCard label="Context זמני" value={contextsActive} hint="כבוי כברירת מחדל" tone={contextsActive ? "bad" : "good"} />
          <RoleMetricCard label="Signals" value={data.signals.length} hint="source_type=skeleton_motion" tone={data.signals.length ? "warn" : "default"} />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><ShieldCheck size={20} /> Gan Batuach Israel Mode</h2>
            <div className="setup-checklist">
              <span>מותר: pose estimation, skeleton analytics, motion analytics, fall, inactivity, crowding, restricted area.</span>
              <span>כבוי: face recognition, audio analytics, speech recognition, keyword detection, biometric face matching.</span>
              <span>בדיקה משפטית: gait recognition, persistent skeleton identity, contextual child matching, soft biometric matching.</span>
              <span>כל פלט הוא המלצה לבדיקה בלבד.</span>
            </div>
          </article>
          <article className="card action-panel">
            <h2><BrainCircuit size={20} /> ST-GCN / Temporal Readiness</h2>
            <div className="setup-checklist">
              <span>Input: {temporalGraphReadiness.expectedInput}</span>
              <span>Output: {temporalGraphReadiness.expectedOutput}</span>
              <span>Future: {temporalGraphReadiness.futureModels.join(", ")}</span>
              <span>{temporalGraphReadiness.restrictions.join(" · ")}</span>
            </div>
          </article>
        </section>

        <CleanSection title="Skeleton Events & Review Queue" subtitle="אירועים אנונימיים בלבד. הורה לא רואה raw skeleton או confidence פנימי.">
          {data.events.length === 0 ? <EmptyState title="אין אירועי Skeleton" text="כשתיווצר אינדיקציית תנועה אנונימית היא תופיע כאן לבדיקה אנושית." /> : (
            <div className="camera-infra-list">
              {data.events.map((event) => (
                <article className="camera-infra-row" key={event.id}>
                  <div>
                    <strong>{label(event.event_type)}</strong>
                    <span>{event.gardens?.name ?? "גן"} · {event.camera_zones?.name ?? "אזור"} · {new Date(event.event_timestamp).toLocaleString("he-IL")}</span>
                  </div>
                  <StatusBadge tone={statusTone(event.review_status)}>{label(event.review_status)}</StatusBadge>
                  <StatusBadge tone={statusTone(event.severity)}>{event.severity}</StatusBadge>
                  <StatusBadge tone={event.parent_visible ? "bad" : "good"}>{event.parent_visible ? "חשוף" : "פנימי"}</StatusBadge>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="camera-infra-grid">
          <CleanSection title="Model Readiness" subtitle="ארכיטקטורת provider מוכנה ל־YOLOv8-Pose, MediaPipe וניתוח Temporal עתידי.">
            <div className="camera-infra-list">
              {data.readiness.map((check) => (
                <article className="camera-infra-row" key={check.id}>
                  <div><strong>{check.model_provider} · {check.capability_key}</strong><span>{check.expected_input} → {check.expected_output}</span></div>
                  <StatusBadge tone={scoreTone(Number(check.readiness_score ?? 0))}>{check.readiness_score}/100</StatusBadge>
                  <StatusBadge tone={statusTone(check.legal_status)}>{label(check.legal_status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Motion Rules" subtitle="כללים זהירים שמייצרים אות לבדיקה, לא מסקנה.">
            <div className="camera-infra-list">
              {data.rules.map((rule) => (
                <article className="camera-infra-row" key={rule.id}>
                  <div><strong>{label(rule.event_type)}</strong><span>{rule.recommendation}</span></div>
                  <StatusBadge tone={rule.enabled ? "good" : "bad"}>{rule.enabled ? "פעיל" : "כבוי"}</StatusBadge>
                  <StatusBadge tone={statusTone(rule.severity)}>{rule.severity}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><GitBranch size={20} /> Capability Governance</h2>
            {data.capabilities.map((capability) => (
              <div className="list-item" key={capability.id}>
                <div><strong>{capability.capability_name}</strong><span>{capability.notes}</span></div>
                <StatusBadge tone={statusTone(capability.legal_status)}>{label(capability.legal_status)}</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><UserCheck size={20} /> Contextual Child Association</h2>
            <div className="setup-checklist">
              <span>סטטוס: legal_review_required.</span>
              <span>כבוי כברירת מחדל ב־Gan Batuach.</span>
              <span>אין פרופיל ביומטרי קבוע, אין זיהוי פנים, אין cross-day identity.</span>
              <span>context זמני פג תוקף יומי ולא חשוף להורים.</span>
            </div>
            {blockedIdentity.map((item) => (
              <div className="list-item" key={item.id}>
                <div><strong>{item.capability_name}</strong><span>{item.capability_key}</span></div>
                <StatusBadge tone={statusTone(item.legal_status)}>{label(item.legal_status)}</StatusBadge>
              </div>
            ))}
          </article>
        </section>

        <section className="camera-infra-grid">
          <CleanSection title="Gan Batuach Allowed Capabilities" subtitle="יכולות שלד ותנועה שמותרות במסלול ישראל, עם מגבלות.">
            <div className="premium-action-grid">
              {ganBatuachAllowed.map((item) => (
                <article className="premium-action-card" key={item.id}>
                  <Activity size={22} />
                  <strong>{item.capability_name}</strong>
                  <span>{item.restriction_summary}</span>
                  <StatusBadge tone="good">{label(item.capability_status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Retention & Privacy" subtitle="Raw skeleton קצר טווח, summary מאושר נשמר יותר, legal hold רק אם קשור לאירוע.">
            <div className="camera-infra-list">
              {data.retention.map((control) => (
                <article className="camera-infra-row" key={control.id}>
                  <div><strong>{control.data_type}</strong><span>{control.notes}</span></div>
                  <StatusBadge tone="warn">{control.default_retention_days} ימים</StatusBadge>
                  <StatusBadge tone={control.parent_visible_allowed ? "bad" : "good"}>{control.parent_visible_allowed ? "Parent" : "Internal"}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><MapPinned size={20} /> Zone-Based Safety</h2>
            <div className="setup-checklist">
              <span>classroom: crowding and supervision attention.</span>
              <span>playground: high velocity and fall suspected.</span>
              <span>sleeping_area: inactivity and person down suspected.</span>
              <span>restricted_area: presence signal only inside configured zone.</span>
            </div>
          </article>
          <article className="card action-panel">
            <h2><Clock size={20} /> Parent-Safe Boundary</h2>
            <div className="setup-checklist">
              <span>הורים לא רואים raw skeleton event.</span>
              <span>הורים לא רואים raw AI signal.</span>
              <span>הורים לא רואים confidence פנימי או anomaly שלא אושר.</span>
              <span>רק summary מאושר ובטוח יכול להפוך לגלוי.</span>
            </div>
          </article>
        </section>

        <section className="quick-actions-grid">
          <ActionCard title="Observer Core" text="מטריצת ורטיקלים וחבילות" href="/dashboard/admin/digital-observer-core" icon={GitBranch} />
          <ActionCard title="AI Governance" text="DPIA ויכולות AI" href="/dashboard/admin/ai-governance" icon={BrainCircuit} />
          <ActionCard title="Observer Network" text="אותות לבדיקה אנושית" href="/dashboard/admin/observer-network" icon={Eye} />
          <ActionCard title="Regulatory" text="מצב ישראל וגבולות חוקיים" href="/dashboard/admin/regulatory" icon={ShieldCheck} />
          <ActionCard title="Camera Zones" text="אזורים ומצלמות" href="/dashboard/admin/camera-infrastructure" icon={MapPinned} />
          <ActionCard title="Risk Intelligence" text="המלצות בלבד" href="/dashboard/admin/risk-intelligence" icon={AlertTriangle} />
        </section>
      </div>
    </DashboardShell>
  );
}
