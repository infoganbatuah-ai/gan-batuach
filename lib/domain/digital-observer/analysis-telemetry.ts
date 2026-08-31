import { z } from "zod";

export const analysisReportSchema = z.object({
  source_id: z.string().uuid(),
  state: z.enum(["no_event", "event_detected", "no_media", "processing_failed", "offline", "deferred_budget", "consent_unavailable"]),
  last_attempt_at: z.string().datetime().nullable(),
  last_analyzed_at: z.string().datetime().nullable(),
  detection_count: z.number().int().min(0).max(100).nullable()
}).strict().superRefine((report, ctx) => {
  const success = report.state === "no_event" || report.state === "event_detected";
  if (success ? !report.last_attempt_at || !report.last_analyzed_at || report.detection_count === null
    || (report.state === "no_event") !== (report.detection_count === 0)
    : report.last_analyzed_at !== null || report.detection_count !== null) ctx.addIssue({ code: "custom", message: "Invalid analysis evidence" });
  if (["offline", "deferred_budget"].includes(report.state) && report.last_attempt_at !== null) ctx.addIssue({ code: "custom", message: "Unattempted source has an attempt" });
  if (["no_media", "processing_failed"].includes(report.state) && !report.last_attempt_at) ctx.addIssue({ code: "custom", message: "Missing analysis attempt" });
});

export const analysisTelemetrySchema = z.object({
  authorization_id: z.string().uuid(),
  completed_at: z.string().datetime(),
  reports: z.array(analysisReportSchema).min(1).max(128)
    .refine(reports => new Set(reports.map(report => report.source_id)).size === reports.length, "Duplicate source")
}).strict();

export class AnalysisTelemetryStorageError extends Error {
  status: number;
  constructor(status: number) {
    super(status === 409 ? "Analysis report rejected" : "Analysis report storage unavailable");
    this.status = status;
  }
}

export function validatedAnalysisTelemetry(input: unknown, now = Date.now()) {
  const report = analysisTelemetrySchema.parse(input);
  const completed = Date.parse(report.completed_at);
  if (!Number.isFinite(now) || completed > now || now - completed > 300_000) throw new Error("Analysis report is stale");
  for (const row of report.reports) {
    const attempted = row.last_attempt_at ? Date.parse(row.last_attempt_at) : null;
    const analyzed = row.last_analyzed_at ? Date.parse(row.last_analyzed_at) : null;
    if (attempted !== null && (attempted > completed || completed - attempted > 300_000)) throw new Error("Invalid attempt time");
    if (analyzed !== null && (attempted === null || analyzed < attempted || analyzed > completed)) throw new Error("Invalid analysis time");
  }
  return report;
}

export async function recordAnalysisTelemetry(db: any, siteId: string, gatewayId: string, receiptId: string, input: unknown, now = Date.now()) {
  const report = validatedAnalysisTelemetry(input, now);
  const result = await db.rpc("record_observer_analysis_telemetry", {
    p_observer_site_id: siteId, p_gateway_id: gatewayId, p_receipt_id: receiptId,
    p_authorization_id: report.authorization_id, p_completed_at: report.completed_at, p_reports: report.reports
  });
  if (result.error || !result.data) throw new AnalysisTelemetryStorageError(
    ["P0001", "23505", "23514", "22P02"].includes(result.error?.code) ? 409 : 503);
  if (!Number.isSafeInteger(result.data.stored) || result.data.stored < 0 || result.data.stored > report.reports.length
    || Date.parse(result.data.reported_at) !== Date.parse(report.completed_at)) throw new AnalysisTelemetryStorageError(503);
  return { stored: Number(result.data.stored), reported_at: result.data.reported_at };
}
