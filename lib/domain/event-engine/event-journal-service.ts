import type { JournalSeverity } from "./event-validation-pipeline";

export type JournalEvent = { timestamp: string; camera_id: string; camera_name: string; zone_type: string; event_type: string; severity: JournalSeverity; description: string; recording_url: string | null; count?: number; first_seen?: string; last_seen?: string };
type Row = Record<string, any>;

const clean = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value.trim() : fallback;
const sev = (value: unknown): JournalSeverity => ["critical", "urgent"].includes(String(value).toLowerCase()) ? "CRITICAL" : ["warning", "high", "medium"].includes(String(value).toLowerCase()) ? "WARNING" : "INFO";

export class EventJournalService {
  constructor(private debounceMs = 90_000) {}
  normalize(row: Row): JournalEvent {
    const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const cameraId = String(row.camera_id ?? metadata.camera_id ?? "unknown-camera");
    const cameraName = clean(row.camera_name ?? metadata.camera_name, `מצלמה ${cameraId}`);
    const zoneType = clean(row.zone_type ?? metadata.zone_type, "INDOOR").toUpperCase();
    return { timestamp: clean(row.created_at ?? row.timestamp, new Date().toISOString()), camera_id: cameraId, camera_name: cameraName, zone_type: zoneType, event_type: clean(row.event_type ?? row.signal_type ?? metadata.event_type, "system"), severity: sev(row.severity), description: clean(row.description ?? row.title ?? metadata.event_description ?? metadata.event_summary, "אירוע דורש בדיקה"), recording_url: clean(row.recording_url ?? metadata.recording_url ?? metadata.clip_url, "") || null };
  }
  group(rows: Row[]): JournalEvent[] {
    const sorted = rows.map((row) => this.normalize(row)).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const output: JournalEvent[] = [];
    for (const event of sorted) {
      const existing = output.find((item) => item.camera_id === event.camera_id && item.event_type === event.event_type && Math.abs(Date.parse(item.timestamp) - Date.parse(event.timestamp)) <= this.debounceMs);
      if (existing) { existing.count = (existing.count ?? 1) + 1; existing.first_seen = event.timestamp < (existing.first_seen ?? existing.timestamp) ? event.timestamp : (existing.first_seen ?? existing.timestamp); existing.last_seen = existing.timestamp; if (!existing.recording_url) existing.recording_url = event.recording_url; continue; }
      output.push({ ...event, count: 1, first_seen: event.timestamp, last_seen: event.timestamp });
    }
    return output;
  }
  async getDashboardEvents(supabase: any, options: { observerSiteId?: string; limit?: number } = {}) { return this.query(supabase, options); }
  async getGuardChatEvents(supabase: any, options: { observerSiteId?: string; limit?: number } = {}) { return this.query(supabase, { ...options, limit: options.limit ?? 20 }); }
  private async query(supabase: any, options: { observerSiteId?: string; limit?: number }) {
    let query = supabase.from("observer_intelligence_signals" as any).select("*").order("created_at", { ascending: false }).limit(options.limit ?? 100);
    if (options.observerSiteId) query = query.eq("observer_site_id", options.observerSiteId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Row[];
    if (options.observerSiteId && rows.length) {
      const { data: cameras } = await supabase.from("digital_observer_camera_sources")
        .select("id,display_name,location_label,metadata").eq("observer_site_id", options.observerSiteId);
      const byId = new Map<string, Row>((cameras ?? []).map((camera: Row) => [String(camera.id), camera] as [string, Row]));
      rows.forEach((row) => {
        const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Row : {};
        const camera = byId.get(String(row.camera_source_id ?? metadata.camera_source_id ?? row.camera_id));
        if (camera) row.metadata = { ...metadata, camera_name: camera.display_name, zone_type: metadata.zone_type ?? camera.metadata?.zone_type ?? camera.location_label };
      });
    }
    return this.group(rows);
  }
}

export const eventJournalService = new EventJournalService();
