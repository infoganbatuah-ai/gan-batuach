export type ObservationProvenance = "REAL_CAMERA_AI" | "CAMERA_NATIVE_EVENT" | "MANUAL_USER_EVENT" | "SIMULATION" | "SHADOW_AI";

type ObservationRow = { source_type?: unknown; camera_id?: unknown; metadata?: Record<string, unknown> | null };

function hasCameraReference(row: ObservationRow) {
  return Boolean(row.camera_id || row.metadata?.camera_source_id || row.metadata?.camera_id);
}

/**
 * Product journal compatibility boundary. Gateway-ingested records are the
 * only camera-AI truth for a real site; explicit simulation/shadow records
 * never appear as a production camera observation.
 */
export function isCanonicalProductObservation(row: ObservationRow): boolean {
  if (!hasCameraReference(row)) return true;
  const metadata = row.metadata ?? {};
  const provenance = String(metadata.observation_provenance ?? "");
  if (["SIMULATION", "SHADOW_AI"].includes(provenance)
    || metadata.mock === true || metadata.synthetic === true || metadata.shadow_mode === true
    || ["mock", "local_shadow", "simulation"].includes(String(row.source_type ?? ""))) return false;
  if (provenance === "REAL_CAMERA_AI" || provenance === "CAMERA_NATIVE_EVENT") return true;
  // Existing Gateway records predate explicit provenance. Preserve them only
  // when they retain the authenticated system source boundary.
  return row.source_type === "system";
}
