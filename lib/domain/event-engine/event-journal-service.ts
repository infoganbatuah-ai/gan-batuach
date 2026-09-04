import { cameraZoneMapper, normalizeZoneType } from "./camera-zone-mapper";
import { observerEventNarrative } from "../digital-observer/event-narrative";
import { canonicalJournalEventType, journalEventMatchesZone, type JournalSeverity } from "./event-validation-pipeline";
import { mediaFaultLifecycle } from "./media-fault-lifecycle";

type Row = Record<string, any>;
export type JournalEvent = { id?: string; timestamp: string; camera_id: string; camera_name: string; zone_type: string | null; event_type: string; severity: JournalSeverity; description: string; recording_url: string | null; count: number; first_seen: string; last_seen: string };
const severity = (v: unknown): JournalSeverity => ["critical", "urgent"].includes(String(v).toLowerCase()) ? "CRITICAL" : ["warning", "high", "medium"].includes(String(v).toLowerCase()) ? "WARNING" : "INFO";
const weight = { INFO: 0, WARNING: 1, CRITICAL: 2 };
const date = (v: unknown) => typeof v === "string" && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
const cameraRef = (r: Row) => String(r.camera_source_id || r.metadata?.camera_source_id || r.camera_id || r.metadata?.camera_id || "");
const continuousPresenceEvents = new Set(["person_detected", "unrecognized_standing_visitor", "vehicle_detected", "car_detected"]);
const connectivityEvents = new Set(["camera_offline", "camera_reconnected"]);

export class EventJournalService {
  constructor(private debounceMs = 90_000, private continuousActivityMs = 10 * 60_000) {}
  normalize(row: Row): JournalEvent {
    const m = row.metadata ?? {};
    const timestamp = date(m.last_seen ?? row.last_seen ?? row.timestamp ?? row.created_at) ?? "";
    const cameraId = cameraRef(row);
    return {
      id: row.id, timestamp, camera_id: cameraId,
      camera_name: row.camera_name || m.camera_name || (cameraId ? `מצלמה ${cameraId}` : "אירוע מערכת"),
      zone_type: normalizeZoneType(row.zone_type ?? m.zone_type),
      event_type: row.event_type || m.event_type || row.signal_type || "system",
      severity: severity(row.severity),
      description: row.description || m.event_summary || m.event_description || observerEventNarrative(row).summary,
      recording_url: m.recording_required === false ? null : row.recording_url || m.recording_url || null,
      count: Math.max(1, Number(m.journal_count ?? row.repeated_count) || 1),
      first_seen: date(m.first_seen ?? row.first_seen ?? row.timestamp ?? row.created_at) ?? timestamp,
      last_seen: timestamp
    };
  }
  /** Keep original signal IDs and review fields for every journal consumer. */
  groupRows(rows: Row[], cameras: Row[] = [], clips: Row[] = [], options: { includeSpatialMismatches?: boolean } = {}): Row[] {
    // Connectivity/media readiness probes are diagnostics, not security events.
    // Their original rows and recordings remain intact in storage.
    const enriched = rows.filter(row => (row.metadata?.event_type ?? row.event_type ?? row.signal_type) !== "camera_media_readiness").map((row): Row => {
      const m = { ...row.metadata };
      // Always recompute presentation flags; never trust a stored display flag.
      delete m.journal_spatial_mismatch;
      const camera = cameras.find((c) => (!c.observer_site_id || !row.observer_site_id || c.observer_site_id === row.observer_site_id)
        && (c.id === cameraRef(row) || c.camera_stream_id === cameraRef(row)));
      if (camera) {
        const mapped = cameraZoneMapper.map(camera);
        const recordedZone = normalizeZoneType(m.zone_type ?? row.zone_type);
        // Validated events keep their historical zone when a camera is moved.
        // Legacy detections are checked against the now-confirmed mapping.
        const checkedZone = m.validated_event === true && recordedZone ? recordedZone : mapped.source !== "default" ? mapped.zone_type : recordedZone;
        if (checkedZone && journalEventMatchesZone(String(row.event_type ?? m.event_type ?? row.signal_type ?? ""), checkedZone) === false) {
          m.journal_spatial_mismatch = { zone_type: checkedZone, basis: m.validated_event === true && recordedZone ? "recorded_zone" : "current_mapping" };
        }
        m.camera_source_id = camera.id;
        m.camera_name = mapped.camera_name;
        m.zone_type = normalizeZoneType(m.zone_type) ?? (mapped.source !== "default" ? mapped.zone_type : null);
      }
      const clip = clips.find((c) => c.signal_id === row.id && c.clip_status === "available" && (!c.delete_after || Date.parse(c.delete_after) > Date.now()));
      if (clip && m.recording_required !== false) m.recording_url = `/api/digital-observer/event-clips/${clip.id}/media?kind=clip`;
      const fault = mediaFaultLifecycle(m, date(m.first_seen ?? row.created_at) ?? new Date(0).toISOString());
      if (fault) m.media_fault = fault;
      return { ...row, metadata: m };
    }).filter((row) => date(row.metadata.last_seen ?? row.timestamp ?? row.created_at)
      && (options.includeSpatialMismatches || !row.metadata.journal_spatial_mismatch));
    enriched.sort((a, b) => this.normalize(b).timestamp.localeCompare(this.normalize(a).timestamp));
    const output: Row[] = [];
    const groupKeys = new WeakMap<object, string>();
    const healthEpisode = new Map<string, number>();
    const recoveryBoundary = new Map<string, string>();
    for (const row of enriched) {
      const event = this.normalize(row);
      const eventType = canonicalJournalEventType(event.event_type);
      const episode = healthEpisode.get(event.camera_id) ?? 0;
      const identity = connectivityEvents.has(eventType)
        ? `health-episode:${episode}`
        : continuousPresenceEvents.has(eventType)
          ? "continuous-activity"
          : String(row.metadata?.track_id ?? row.metadata?.incident_id ?? "");
      const groupKey = `${eventType}:${identity}`;
      const groupWindow = eventType === "camera_offline"
        ? Number.POSITIVE_INFINITY
        : continuousPresenceEvents.has(eventType) ? this.continuousActivityMs : this.debounceMs;
      const existing = event.camera_id ? output.find((item) => {
        const prev = this.normalize(item);
        return item.observer_site_id === row.observer_site_id && prev.camera_id === event.camera_id
          && groupKeys.get(item) === groupKey && (connectivityEvents.has(eventType) || item.review_status === row.review_status)
          && JSON.stringify(item.metadata?.journal_spatial_mismatch) === JSON.stringify(row.metadata?.journal_spatial_mismatch)
          && Date.parse(prev.first_seen) - Date.parse(event.last_seen) <= groupWindow;
      }) : undefined;
      if (!existing) {
        if (eventType === "camera_offline") {
          const recoveredAt = recoveryBoundary.get(event.camera_id);
          row.metadata = { ...row.metadata,
            outage_status: recoveredAt ? "resolved" : "open",
            outage_started_at: event.first_seen,
            outage_last_observed_at: event.last_seen,
            ...(recoveredAt ? { outage_recovered_at: recoveredAt } : {}) };
        }
        output.push(row);
        groupKeys.set(row, groupKey);
      } else {
        const prev = this.normalize(existing);
        const reviewStatuses = [...new Set([...(Array.isArray(existing.metadata?.journal_review_statuses) ? existing.metadata.journal_review_statuses : [existing.review_status]), row.review_status].filter(Boolean))].slice(0, 10);
        existing.metadata = { ...existing.metadata, first_seen: event.first_seen, last_seen: prev.last_seen,
          journal_count: prev.count + event.count, recording_url: prev.recording_url || event.recording_url,
          recording_required: existing.metadata.recording_required === true || row.metadata.recording_required === true ? true : existing.metadata.recording_required,
          ...(eventType === "camera_offline" ? {
            outage_started_at: event.first_seen,
            outage_last_observed_at: prev.last_seen,
            journal_review_statuses: reviewStatuses
          } : {}) };
        if (weight[event.severity] > weight[prev.severity]) existing.severity = row.severity;
      }
      // In reverse chronological order, a reconnect separates the older outage
      // from any newer outage already seen for this camera.
      if (eventType === "camera_reconnected") {
        recoveryBoundary.set(event.camera_id, event.timestamp);
        healthEpisode.set(event.camera_id, episode + 1);
      }
    }
    return output;
  }
  partitionRows(rows: Row[], cameras: Row[] = [], clips: Row[] = []) {
    const grouped = this.groupRows(rows, cameras, clips, { includeSpatialMismatches: true });
    return {
      events: grouped.filter(row => !row.metadata.journal_spatial_mismatch),
      spatialMismatches: grouped.filter(row => row.metadata.journal_spatial_mismatch)
    };
  }
  group(rows: Row[], cameras: Row[] = [], clips: Row[] = []): JournalEvent[] { return this.groupRows(rows, cameras, clips).map((r) => this.normalize(r)); }
  async getDashboardEvents(s: any, o: { observerSiteId?: string; limit?: number } = {}) { return this.query(s, o); }
  async getGuardChatEvents(s: any, o: { observerSiteId?: string; limit?: number } = {}) { return this.query(s, { ...o, limit: o.limit ?? 20 }); }
  private async query(s: any, o: { observerSiteId?: string; limit?: number }) {
    if (!o.observerSiteId) throw new Error("Journal requires a site scope");
    const [signals, cameras, clips] = await Promise.all([
      s.from("observer_intelligence_signals").select("*").eq("observer_site_id", o.observerSiteId).order("created_at", { ascending: false }).limit(1000),
      s.from("digital_observer_camera_sources").select("id,camera_stream_id,display_name,location_label,metadata").eq("observer_site_id", o.observerSiteId),
      s.from("digital_observer_event_clips").select("id,signal_id,clip_status,delete_after").eq("observer_site_id", o.observerSiteId)
    ]);
    for (const result of [signals, cameras, clips]) if (result.error) throw new Error(result.error.message);
    return this.group(signals.data ?? [], cameras.data ?? [], clips.data ?? []).slice(0, o.limit ?? 100);
  }
}
export const eventJournalService = new EventJournalService();
