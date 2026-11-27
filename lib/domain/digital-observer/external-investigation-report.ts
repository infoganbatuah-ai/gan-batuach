import type { InvestigationSearchResult } from "./investigation-results";

export function buildExternalInvestigationReport(result: Pick<InvestigationSearchResult, "grounding">) {
  return {
    format: "grounded_result_v1",
    evidence_reference_count: result.grounding.evidenceIds.length,
    source_recording_retrieval_supported: false,
    source_recording: { status: "unavailable", reason: "archive_access_not_validated" },
    unsupported_capabilities: ["face_recognition", "person_re_id", "vehicle_re_id"],
  } as const;
}
