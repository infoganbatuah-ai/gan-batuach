import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DIGITAL_OBSERVER_CALIBRATION_DATASET_VERSION, type DigitalObserverFeedbackLabel } from "./feedback-calibration";
import { runQualityBenchmark, type BenchmarkDataset, type BenchmarkExample } from "./quality-benchmark";

type Row = Record<string, unknown>;
const objectValue = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown) => typeof value === "string" ? value : null;
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;

export async function loadCurrentQualityBenchmark(client: SupabaseClient, filters: { siteId?: string | null } = {}) {
  let samplesQuery = client.from("digital_observer_calibration_samples").select("id,observer_site_id,camera_source_id,canonical_label,environment,incident_provenance,event_types,model_provenance,detector_confidence,version_snapshot,verification_snapshot,risk_snapshot,decision_snapshot,ground_truth_review_id,created_at").eq("environment", "PRODUCTION").eq("incident_provenance", "REAL_CAMERA_AI").order("created_at", { ascending: true }).limit(5000);
  if (filters.siteId) samplesQuery = samplesQuery.eq("observer_site_id", filters.siteId);
  const [samplesResult, reviewsResult] = await Promise.all([
    samplesQuery,
    client.from("observer_ground_truth_reviews").select("id,review_state,created_at").in("review_state", ["REVIEWED", "CORRECTED"]).limit(5000)
  ]);
  if (samplesResult.error) throw new Error("QUALITY_SAMPLE_READ_FAILED");
  if (reviewsResult.error) throw new Error("QUALITY_REVIEW_READ_FAILED");
  const reviewById = new Map(((reviewsResult.data ?? []) as Row[]).map(item => [String(item.id), item]));
  const samples = ((samplesResult.data ?? []) as Row[]).filter(item => reviewById.has(String(item.ground_truth_review_id)));
  const examples: BenchmarkExample[] = samples.map(sample => {
    const versions = objectValue(sample.version_snapshot); const modelList = Array.isArray(sample.model_provenance) ? sample.model_provenance : [];
    const model = objectValue(modelList[0]); const verification = objectValue(sample.verification_snapshot); const risk = objectValue(sample.risk_snapshot);
    const eventTypes = Array.isArray(sample.event_types) ? sample.event_types.map(String) : [];
    const label = String(sample.canonical_label) as DigitalObserverFeedbackLabel;
    return { id: String(sample.id), tenantId: null, siteId: String(sample.observer_site_id), cameraId: text(sample.camera_source_id), eventType: eventTypes[0] ?? "person_event", datasetKind: "REVIEWED_REAL_PRODUCT", observedAt: String(sample.created_at), modelVersion: text(model.model_version) ?? text(model.model) ?? text(versions.detector) ?? "UNKNOWN_MODEL", modelConfidence: number(sample.detector_confidence), verificationConfidence: number(verification.confidence), riskScore: number(risk.risk_score), label, reviewState: String(reviewById.get(String(sample.ground_truth_review_id))?.review_state) as "REVIEWED" | "CORRECTED", falsePositiveCategory: label === "FALSE_DETECTION" ? "DETECTOR" : label === "FALSE_CORRELATION" ? "FALSE_INCIDENT" : label === "FALSE_SPATIAL_EVENT" ? "WRONG_DIRECTION" : null };
  });
  const modelVersion = examples[0]?.modelVersion ?? "NO_REVIEWED_MODEL";
  const selected = examples.filter(item => item.modelVersion === modelVersion);
  const createdAt = selected[0]?.observedAt ?? new Date(0).toISOString();
  const dataset: BenchmarkDataset = { id: "reviewed-real-product", version: DIGITAL_OBSERVER_CALIBRATION_DATASET_VERSION, kind: "REVIEWED_REAL_PRODUCT", tenantId: selected[0]?.tenantId ?? null, siteIds: [...new Set(selected.map(item => item.siteId))], provenance: "PUSH 11 reviewed Ground Truth; Production REAL_CAMERA_AI calibration samples only", eventTypes: [...new Set(selected.map(item => item.eventType))], cameraIds: [...new Set(selected.map(item => item.cameraId).filter((id): id is string => Boolean(id)))], sceneScopes: [], startsAt: selected[0]?.observedAt ?? null, endsAt: selected.at(-1)?.observedAt ?? null, sampleCount: selected.length, groundTruthStatus: selected.length ? "REVIEWED" : "NONE", inclusionPolicy: "Latest REVIEWED/CORRECTED Ground Truth linked to Production REAL_CAMERA_AI calibration samples", exclusionPolicy: "Unreviewed, superseded, mock, local_shadow, test and synthetic records", modelVersions: [...new Set(examples.map(item => item.modelVersion))], createdAt, reviewedAt: selected.at(-1)?.observedAt ?? null, sealed: true };
  const benchmark = dataset.groundTruthStatus === "NONE" ? null : runQualityBenchmark(dataset, examples, { datasetId: dataset.id, datasetVersion: dataset.version, modelVersion, falseNegativeCoverageComplete: false, siteIds: filters.siteId ? [filters.siteId] : undefined });
  return { dataset, benchmark };
}
