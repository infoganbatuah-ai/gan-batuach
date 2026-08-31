type Row = Record<string, any>;

export function observerSourceCoverage(siteId: string, sources: Row[], signals: Row[], now = Date.now()) {
  const rows = new Map<string, {
    id: string; name: string; zone: string | null; connection: "reported_connected" | "offline" | "unknown";
    savedRecords: number; lastRecordAt: string | null; lastAnalyzedAt: null; analysisState: "not_reported";
  }>();
  const legacySourceIds = new Map<string, string>();
  for (const source of sources) {
    if (source.observer_site_id !== siteId || !source.id || rows.has(source.id)) continue;
    const states = [source.status, source.health_status].map(value => String(value ?? ""));
    const offline = states.some(value => ["offline", "failed", "error", "disabled", "blocked"].includes(value));
    const connected = states.some(value => ["connected", "healthy", "online", "active"].includes(value));
    rows.set(source.id, {
      id: source.id, name: source.display_name || "מצלמה ללא שם", zone: source.location_label || null,
      connection: offline ? "offline" : connected ? "reported_connected" : "unknown",
      savedRecords: 0, lastRecordAt: null, lastAnalyzedAt: null, analysisState: "not_reported"
    });
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
  // Events and a static capability flag do not establish successful empty
  // analysis rounds, media continuity or identity/baseline learning coverage.
  return [...rows.values()];
}
