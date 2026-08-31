import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { recordHomeActivityMetrics } from "./home-learning-sampler";

export const GUARD_QA_BRANCH = "codex/digital-guard-engine-eeb919c";
export const GUARD_QA_PROJECT_URL = "https://kuaywzvucllxjsxarogb.supabase.co";
export const GUARD_QA_EMAIL = "qa.digital.observer.home@demo.ganbatuach.com";

export function guardQaEnvironmentAllowed(env: Record<string, string | undefined>) {
  return env.VERCEL_ENV === "preview" && env.VERCEL_GIT_COMMIT_REF === GUARD_QA_BRANCH
    && env.NEXT_PUBLIC_SUPABASE_URL === GUARD_QA_PROJECT_URL;
}

export function guardQaUserAllowed(session: { user: { id: string; email?: string; email_confirmed_at?: string }; profile: { id: string; garden_id?: string | null } }) {
  return session.user.email?.toLowerCase() === GUARD_QA_EMAIL && Boolean(session.user.email_confirmed_at)
    && session.profile.id === session.user.id && !session.profile.garden_id;
}

type DatabaseClient = any;
type FixtureReport = {
  passed: boolean; checks: string[]; failed_step: string | null;
  cleanup: "complete" | "not_created" | "failed";
  fixture_site_id: string;
};

/** No camera I/O. All mutations are confined to one server-generated synthetic site.
 * The stable site PK is also a cross-worker lease: a concurrent run cannot insert it.
 * Cleanup additionally requires this invocation's random marker and exact owner.
 */
export async function runGuardLearningFixture(admin: DatabaseClient, owner: DatabaseClient, ownerId: string): Promise<FixtureReport> {
  const digest = createHash("sha256").update(`guard-qa-v1:${ownerId}`).digest("hex");
  const siteId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  const cameras = [randomUUID(), randomUUID()];
  const marker = `guard-learning-fixture-${randomUUID()}`;
  const report: FixtureReport = { passed: false, checks: [], failed_step: null, cleanup: "not_created", fixture_site_id: siteId };
  let step = "create_site";
  function checked(result: any) {
    if (result.error) throw new Error("QA_DATABASE_OPERATION_FAILED");
    return result.data;
  }
  function verify(condition: unknown, name: string) {
    step = name;
    if (!condition) throw new Error("QA_ASSERTION_FAILED");
    report.checks.push(name);
  }
  try {
    checked(await admin.from("observer_sites").insert({
      id: siteId, name: marker, site_type: "home", owner_profile_id: ownerId,
      garden_id: null, active: false, monitoring_enabled: true, timezone: "UTC", ai_features: {},
      metadata: { qa_demo: true, fixture_marker: marker, observer_monitoring_consent: true, no_real_camera: true }
    }));
    step = "create_demo_cameras";
    checked(await admin.from("digital_observer_camera_sources").insert(cameras.map((id, index) => ({
      id, observer_site_id: siteId, display_name: `בדיקת למידה ${index + 1}`, location_label: `אזור בדיקה ${index + 1}`,
      connector_type: "demo", source_mode: "sandbox", status: "ready_to_test", health_status: "unknown", capabilities: {},
      metadata: { gateway_stream_id: `${marker}-${index}`, fixture_marker: marker, no_real_camera: true }
    }))));
    const time = Date.now();
    const samples = Array.from({ length: 24 }, (_, index) => [0, 1].map((camera) => ({
      stream_id: `${marker}-${camera}`, sampled_at: new Date(time - (24 - index) * 1_000).toISOString(),
      motion_score: camera === 0 ? 0.1 : 0.8, luminance_score: 0.5
    }))).flat();
    step = "learn_baseline";
    verify((await recordHomeActivityMetrics(admin, siteId, samples)).sampled === 48, "48_samples_saved");
    const anomaly = [{ stream_id: `${marker}-0`, sampled_at: new Date(time).toISOString(), motion_score: 0.95, luminance_score: 0.5 }];
    step = "learn_anomaly";
    verify((await recordHomeActivityMetrics(admin, siteId, anomaly)).sampled === 1, "anomaly_sample_saved");
    step = "replay_sample";
    verify((await recordHomeActivityMetrics(admin, siteId, anomaly)).sampled === 0, "replay_not_counted");
    step = "read_persisted_baseline";
    const baseline = checked(await admin.from("site_behavior_baselines").select("baseline_value").eq("observer_site_id", siteId).single())?.baseline_value;
    verify(baseline?.camera_baselines?.[cameras[0]]?.samples === 25 && baseline?.camera_baselines?.[cameras[1]]?.samples === 24, "camera_counts_isolated");
    verify(Math.abs(baseline.camera_baselines[cameras[1]].averageMotionLevel - 0.8) < 1e-9, "camera_means_isolated");
    verify(baseline.pending_learning_events.length === 0, "outbox_drained");
    step = "read_journal_with_owner_rls";
    const events = checked(await owner.from("observer_intelligence_signals").select("id,metadata,human_review_required").eq("observer_site_id", siteId));
    const anomalies = events.filter((event: any) => event.metadata?.event_type === "home_activity_change");
    verify(anomalies.length === 1, "owner_rls_reads_one_anomaly");
    verify(anomalies[0].metadata.camera_source_id === cameras[0] && anomalies[0].human_review_required === true
      && anomalies[0].metadata.no_automatic_physical_action === true, "precise_camera_review_only_event");
    report.passed = true;
  } catch {
    // Never return raw provider errors, requests, tokens or connection strings.
    report.failed_step = step;
  } finally {
    try {
      const site = checked(await admin.from("observer_sites").select("id,metadata,owner_profile_id").eq("id", siteId).maybeSingle());
      if (site?.metadata?.fixture_marker === marker && site.owner_profile_id === ownerId) {
        checked(await admin.from("observer_sites").update({ monitoring_enabled: false }).eq("id", siteId).eq("owner_profile_id", ownerId));
        const tables = ["observer_intelligence_signals", "site_behavior_baselines", "observer_site_learning_profiles", "digital_observer_camera_sources"];
        for (const table of tables) checked(await admin.from(table).delete().eq("observer_site_id", siteId));
        checked(await admin.from("observer_sites").delete().eq("id", siteId).eq("owner_profile_id", ownerId));
        const remaining = checked(await admin.from("observer_sites").select("id").eq("id", siteId).maybeSingle());
        if (remaining) throw new Error("QA_CLEANUP_INCOMPLETE");
        for (const table of tables) {
          if (checked(await admin.from(table).select("id").eq("observer_site_id", siteId)).length) throw new Error("QA_CLEANUP_INCOMPLETE");
        }
        report.cleanup = "complete";
      }
    } catch {
      report.cleanup = "failed";
      report.passed = false;
      report.failed_step ??= "cleanup";
    }
  }
  if (report.passed && report.cleanup !== "complete") {
    report.passed = false;
    report.failed_step = "cleanup_scope_changed";
  }
  return report;
}
