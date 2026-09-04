import { z } from "zod";

// This vocabulary matches skeleton_observer_events, not Standard face/LPR
// signals. No biometric engine, generic journal or media provider is imported.
const descriptions = {
  fall_suspected: "סימן תנועה שעשוי להעיד על נפילה — נדרשת בדיקה",
  inactivity_suspected: "חוסר תנועה לבדיקה",
  high_velocity_motion: "תנועה מהירה לבדיקה",
  crowding_suspected: "צפיפות לבדיקה",
  supervision_attention_required: "סימן המחייב בדיקת השגחה",
  restricted_area_presence: "תנועה באזור מוגבל לבדיקה",
  unusual_motion_pattern: "דפוס תנועה חריג לבדיקה",
  person_down_suspected: "מנח נמוך לבדיקה",
  pose_sample: "דגימת תנוחה",
  motion_sample: "דגימת תנועה"
} as const;
const eventType = z.enum(Object.keys(descriptions) as [keyof typeof descriptions, ...(keyof typeof descriptions)[]]);
const reviewStatus = z.enum(["detected", "pending_review", "reviewing", "dismissed", "confirmed", "needs_followup", "escalated", "resolved", "closed"]);
const instant = z.iso.datetime({ offset: true });
export const skeletonJournalQuerySchema = z.object({
  from: instant, to: instant,
  camera_id: z.string().uuid().optional(),
  event_type: eventType.optional(),
  review_status: reviewStatus.optional(),
  limit: z.number().int().min(1).max(100).default(20)
}).strict().refine(value => {
  const duration = Date.parse(value.to) - Date.parse(value.from);
  return duration > 0 && duration <= 31 * 86_400_000;
}, "SKELETON_JOURNAL_INVALID_WINDOW");

const scopeSchema = z.object({
  id: z.string().uuid(), role: z.enum(["manager", "owner"]),
  garden_id: z.string().uuid(), active: z.literal(true)
});
type Profile = { id?: unknown; role?: unknown; garden_id?: unknown; active?: unknown };
const rowSchema = z.object({
  id: z.string().uuid(), garden_id: z.string().uuid(), camera_id: z.string().uuid(), zone_id: z.string().uuid().nullable(),
  event_type: eventType, event_timestamp: instant,
  severity: z.enum(["info", "low", "medium", "high", "urgent", "critical"]),
  confidence: z.number().finite().min(0).max(1).nullable(), review_status: reviewStatus,
  retention_until: instant,
  camera: z.object({ id: z.string().uuid(), garden_id: z.string().uuid() }),
  parent_visible: z.literal(false), raw_frame_stored: z.literal(false),
  face_data_present: z.literal(false), audio_data_present: z.literal(false), identity_fields_present: z.literal(false)
});

export function canReadSkeletonJournal(profile: Profile | null | undefined) {
  return scopeSchema.safeParse(profile).success;
}

// Explicit columns are a privacy boundary. Do not replace with '*', join a
// generic intelligence table, or include arbitrary descriptions/metadata.
export const SKELETON_JOURNAL_COLUMNS = "id,garden_id,camera_id,zone_id,event_type,event_timestamp,severity,confidence,review_status,retention_until,parent_visible,raw_frame_stored,face_data_present,audio_data_present,identity_fields_present,camera:camera_streams!inner(id,garden_id)";

/** Read-only, user-session/RLS client required. Garden scope comes exclusively
 * from the authenticated profile; a request cannot choose another tenant. */
export async function searchSkeletonJournal(db: any, profile: Profile, input: unknown, now = new Date()) {
  if (!canReadSkeletonJournal(profile)) throw new Error("SKELETON_JOURNAL_FORBIDDEN");
  const scope = scopeSchema.parse(profile);
  const query = skeletonJournalQuerySchema.parse(input);
  if (!Number.isFinite(now.getTime())) throw new Error("SKELETON_JOURNAL_INVALID_NOW");
  const from = new Date(query.from).toISOString(), to = new Date(query.to).toISOString();

  if (query.camera_id) {
    const camera = await db.from("camera_streams").select("id,garden_id")
      .eq("id", query.camera_id).eq("garden_id", scope.garden_id).maybeSingle();
    if (camera.error) throw new Error("SKELETON_JOURNAL_UNAVAILABLE");
    if (!camera.data || camera.data.id !== query.camera_id || camera.data.garden_id !== scope.garden_id)
      throw new Error("SKELETON_JOURNAL_CAMERA_FORBIDDEN");
  }

  let request = db.from("skeleton_observer_events").select(SKELETON_JOURNAL_COLUMNS)
    .eq("garden_id", scope.garden_id).eq("camera.garden_id", scope.garden_id).gte("event_timestamp", from).lt("event_timestamp", to)
    .gt("retention_until", now.toISOString())
    .eq("parent_visible", false).eq("raw_frame_stored", false).eq("face_data_present", false)
    .eq("audio_data_present", false).eq("identity_fields_present", false);
  if (query.camera_id) request = request.eq("camera_id", query.camera_id);
  if (query.event_type) request = request.eq("event_type", query.event_type);
  if (query.review_status) request = request.eq("review_status", query.review_status);
  const result = await request.order("event_timestamp", { ascending: false }).order("id").limit(query.limit + 1);
  if (result.error) throw new Error("SKELETON_JOURNAL_UNAVAILABLE");

  let excluded = 0;
  const events = [];
  for (const candidate of result.data ?? []) {
    const parsed = rowSchema.safeParse(candidate);
    if (!parsed.success) { excluded++; continue; }
    const row = parsed.data;
    if (row.garden_id !== scope.garden_id || row.camera.garden_id !== scope.garden_id || row.camera.id !== row.camera_id
      || Date.parse(row.event_timestamp) < Date.parse(from)
      || Date.parse(row.event_timestamp) >= Date.parse(to) || Date.parse(row.retention_until) <= now.getTime()
      || (query.camera_id && row.camera_id !== query.camera_id)
      || (query.event_type && row.event_type !== query.event_type)
      || (query.review_status && row.review_status !== query.review_status)) { excluded++; continue; }
    events.push({ id: row.id, camera_id: row.camera_id, zone_id: row.zone_id, type: row.event_type,
      timestamp: new Date(row.event_timestamp).toISOString(), severity: row.severity, confidence: row.confidence,
      review_status: row.review_status, summary: descriptions[row.event_type] });
  }
  return {
    events: events.slice(0, query.limit),
    window: { from_inclusive: from, to_exclusive: to },
    coverage: { historical_only: true, continuous_analysis_verified: false, hardware_actions: 0,
      privacy_mode: "skeleton_only", identifying_fields_included: false, media_included: false,
      limit_reached: (result.data?.length ?? 0) > query.limit, invalid_rows_excluded: excluded }
  };
}
