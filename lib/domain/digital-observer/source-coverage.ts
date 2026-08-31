type Row = Record<string, any>;

export function observerSourceCoverage(siteId: string, sources: Row[], signals: Row[], now = Date.now(), analysisReports: Row[] = []) {
  const rows = new Map<string, {
    id: string; name: string; zone: string | null; connection: "reported_connected" | "offline" | "unknown";
    savedRecords: number; lastRecordAt: string | null; lastAnalyzedAt: string | null; lastReportedAt: string | null; analysisState: string;
  }>();
  const legacySourceIds = new Map<string, string>();
  const sourceGateways = new Map<string, unknown>();
  for (const source of sources) {
    if (source.observer_site_id !== siteId || !source.id || rows.has(source.id)) continue;
    const states = [source.status, source.health_status].map(value => String(value ?? ""));
    const offline = states.some(value => ["offline", "failed", "error", "disabled", "blocked"].includes(value));
    const connected = states.some(value => ["connected", "healthy", "online", "active"].includes(value));
    rows.set(source.id, {
      id: source.id, name: source.display_name || "מצלמה ללא שם", zone: source.location_label || null,
      connection: offline ? "offline" : connected ? "reported_connected" : "unknown",
      savedRecords: 0, lastRecordAt: null, lastAnalyzedAt: null, lastReportedAt: null, analysisState: "not_reported"
    });
    sourceGateways.set(source.id, source.metadata?.gateway_id);
    if (source.camera_stream_id) legacySourceIds.set(source.camera_stream_id, source.id);
  }
  for (const signal of signals) {
    if (signal.observer_site_id !== siteId) continue;
    // Never assign a site-wide milestone or conflicting source to the first
    // camera. The event's explicit source takes precedence over legacy camera_id.
    const sourceId = signal.metadata?.camera_source_id ?? (rows.has(signal.camera_id) ? signal.camera_id : legacySourceIds.get(signal.camera_id));
    const row = rows.get(sourceId);
    const timestamp = Date.parse(String(signal.created_at ?? ""));
    if (!row || !Number.isFinite(timestamp) || timestamp > now || timestamp < now - 48 * 60 * 60 * 1000) continue;
    row.savedRecords++;
    if (!row.lastRecordAt || timestamp > Date.parse(row.lastRecordAt)) row.lastRecordAt = new Date(timestamp).toISOString();
  }
  for (const report of analysisReports) {
    const row = rows.get(report.camera_source_id);
    if (!row || report.observer_site_id !== siteId || !report.gateway_id || sourceGateways.get(report.camera_source_id) !== report.gateway_id) continue;
    if (!["no_event", "event_detected", "no_media", "processing_failed", "offline", "deferred_budget", "consent_unavailable"].includes(report.state)) continue;
    const reported = Date.parse(String(report.reported_at ?? ""));
    if (!Number.isFinite(reported) || reported > now || (row.lastReportedAt && reported <= Date.parse(row.lastReportedAt))) continue;
    const success = report.state === "no_event" || report.state === "event_detected";
    const attempted = report.last_attempt_at === null ? null : Date.parse(report.last_attempt_at);
    const analyzed = report.last_analyzed_at === null ? null : Date.parse(report.last_analyzed_at);
    if (attempted !== null && (!Number.isFinite(attempted) || attempted > reported || reported - attempted > 300_000)) continue;
    if (["offline", "deferred_budget"].includes(report.state) && attempted !== null) continue;
    if (["no_media", "processing_failed"].includes(report.state) && attempted === null) continue;
    if (success ? attempted === null || analyzed === null || !Number.isFinite(attempted) || !Number.isFinite(analyzed)
      || analyzed < attempted || analyzed > reported || !Number.isSafeInteger(report.detection_count)
      || report.detection_count < 0 || report.detection_count > 100 || (report.state === "no_event") !== (report.detection_count === 0)
      : report.last_analyzed_at !== null || report.detection_count !== null) continue;
    row.lastReportedAt = new Date(reported).toISOString();
    row.lastAnalyzedAt = success ? new Date(analyzed!).toISOString() : null;
    row.analysisState = now - reported > 10 * 60 * 1000 ? "stale" : report.state;
  }
  // Only source-scoped server receipts establish a reported round. Neither
  // a round nor saved events establish continuous coverage or learned routines.
  return [...rows.values()];
}
