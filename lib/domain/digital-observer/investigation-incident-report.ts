import { createHash } from "node:crypto";
import { z } from "zod";
import type { IncidentReconstructions } from "./investigation-recording-timeline";
import type { InvestigationSearchResult } from "./investigation-results";

const reportVersion = "observer-incident-observations-v1";
const id = z.string().uuid();
const observationLimit = 25;

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function canonicalJson(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function canExportInvestigationReport(input: {
  actorId: string;
  siteId: string;
  site: { id?: unknown; owner_profile_id?: unknown } | null;
  historyAllowed: boolean;
}) {
  return input.historyAllowed && id.safeParse(input.actorId).success && id.safeParse(input.siteId).success &&
    input.site?.id === input.siteId && input.site.owner_profile_id === input.actorId;
}

export function buildInvestigationIncidentReport(input: {
  siteId: string;
  reconstruction: IncidentReconstructions[number];
  pagination: Pick<InvestigationSearchResult["pagination"], "cursor" | "limit">;
}) {
  const { reconstruction, siteId, pagination } = input;
  const observations = reconstruction.groups.flatMap((group) => group.observations)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.eventId.localeCompare(b.eventId));
  if (!id.safeParse(siteId).success || !id.safeParse(reconstruction.incidentId).success ||
    observations.length === 0 || observations.length > observationLimit) return null;
  if (observations.some((row) => !id.safeParse(row.sourceId).success || !id.safeParse(row.eventId).success)) return null;

  const report = {
    version: reportVersion,
    source: {
      kind: "authorized_investigation_page",
      site_id: siteId,
      incident_id: reconstruction.incidentId,
      page_cursor: pagination.cursor,
      page_limit: pagination.limit,
    },
    limits: {
      page_partial: reconstruction.partialSearch || reconstruction.capped,
      omitted_observations: reconstruction.omittedObservations,
      source_clocks_synchronized: false,
      custody_verified: false,
    },
    observations: observations.map((row) => {
      const evidenceId = row.evidenceState === "AVAILABLE" && id.safeParse(row.evidenceId).success ? row.evidenceId : null;
      return {
        event_id: row.eventId,
        source_id: row.sourceId,
        time_utc: row.observedAt,
        time_basis: row.timeBasis,
        evidence_state: row.evidenceState === "AVAILABLE" && !evidenceId ? "UNAVAILABLE" : row.evidenceState,
        evidence_id: evidenceId,
      };
    }),
  };
  return { report, content_sha256: createHash("sha256").update(canonicalJson(report), "utf8").digest("hex") };
}

export async function authorizeInvestigationReportDownload(input: {
  document: NonNullable<ReturnType<typeof buildInvestigationIncidentReport>>;
  requestedDigest: string;
  writeAudit: () => Promise<boolean>;
}) {
  if (input.document.content_sha256 !== input.requestedDigest) return "PAGE_CHANGED";
  try {
    return await input.writeAudit() === true ? "READY" : "AUDIT_UNAVAILABLE";
  } catch {
    return "AUDIT_UNAVAILABLE";
  }
}
