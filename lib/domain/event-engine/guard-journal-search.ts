import { z } from "zod";
import { buildGuardJournalQuery, type GuardJournalQueryInput, type GuardQueryContext } from "../digital-observer/guard-chat-query";
import { GUARD_EVENT_TYPES, type GuardEventType } from "../digital-observer/guard-event-types";
import { eventJournalService } from "./event-journal-service";
import { cameraZoneMapper } from "./camera-zone-mapper";

type Row = Record<string, any>;
export type GuardJournalContext = GuardQueryContext & { privacyRestricted: boolean };
export function guardHistoryPrivacyRestricted(site: Row) {
  return !["home", "business"].includes(site.site_type) || Boolean(site.garden_id) || site.business_handles_children === true || site.vision_privacy_mode === "skeleton_only";
}
// Public intent names are never interpolated into database filters. A sighting
// is deliberately NOT an entry, exit, verified face or authorized vehicle.
export const GUARD_STORAGE_EVENT_TYPES: Record<GuardEventType, readonly string[]> = {
  ENTRY: ["ENTRY", "person_entered", "room_entry", "entry", "authorized_entry"],
  EXIT: ["EXIT", "person_exited", "room_exit", "exit"],
  UNAUTHORIZED_FACE: ["UNAUTHORIZED_FACE", "unauthorized_face", "unrecognized_face"],
  KNOWN_FACE: ["KNOWN_FACE", "known_face", "face_identification"],
  VEHICLE_IN: ["VEHICLE_IN", "vehicle_entered", "vehicle_entry", "vehicle_in", "car_entered"],
  VEHICLE_OUT: ["VEHICLE_OUT", "vehicle_exited", "vehicle_exit", "vehicle_out", "car_exited"],
  PERIMETER_BREACH: ["PERIMETER_BREACH", "fence_scaling", "unauthorized_night_motion", "motion_after_hours", "perimeter_breach"],
  LINE_CROSSING: ["LINE_CROSSING", "line_crossing", "person_entered", "person_exited", "vehicle_entered", "vehicle_exited"],
  FIRE_SMOKE_ALERT: ["FIRE_SMOKE_ALERT", "fire_smoke_alert", "fire_detected", "smoke_detected", "fire", "smoke"],
  POOL_HAZARD: ["POOL_HAZARD", "pool_hazard", "drowning_hazard", "drowning", "unsupervised_child", "person_near_pool_off_hours", "water_breach", "pool_entry_off_hours"]
};
export function guardStorageEventTypes(types: readonly string[]): string[] {
  return [...new Set(types.flatMap(type => {
    if (!GUARD_EVENT_TYPES.includes(type as GuardEventType)) throw new Error("GUARD_QUERY_UNKNOWN_EVENT_TYPE");
    return GUARD_STORAGE_EVENT_TYPES[type as GuardEventType];
  }))];
}
const uuid = z.string().uuid();
const rowCamera = (row: Row) => String(row.metadata?.camera_source_id || row.camera_source_id || row.camera_id || "");
const typeOf = (row: Row) => String(row.metadata?.event_type || row.event_type || row.signal_type || "");
const cap = 1000;

export function guardContextForSite(site: Row, cameras: Row[]): GuardJournalContext {
  return {
    observerSiteId: site.id, timeZone: site.timezone, privacyRestricted: guardHistoryPrivacyRestricted(site),
    cameras: cameras.map(camera => ({ id: camera.id, observerSiteId: camera.observer_site_id,
      name: camera.display_name, zoneName: camera.location_label,
      aliases: [camera.camera_stream_id, camera.metadata?.gateway_stream_id,
        ...(cameraZoneMapper.map(camera).source === "default" ? [] : ({ PARKING: ["חניה", "חנייה", "parking", "garage"], POOL: ["בריכה", "pool"], ENTRANCE: ["כניסה", "entrance"], PERIMETER: ["היקף", "perimeter"], INDOOR: [] }[cameraZoneMapper.map(camera).zone_type])),
        ...(Array.isArray(camera.metadata?.aliases) ? camera.metadata.aliases : [])]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    }))
  };
}

/** Conservative convenience parser, not a free-form agent. Unsupported time or
 * ambiguous source language asks for clarification; it never broadens scope. */
export function guardHistoryInput(message: string, context: GuardQueryContext, cameraSourceId?: string): GuardJournalQueryInput | null {
  const text = message.normalize("NFKC").toLocaleLowerCase("he-IL").replace(/\s+/g, " ").trim();
  if (/(תתריע|תעקוב|שים לב|מעכשיו|הפעל|תפעיל|הזז|סירנה|אזעקה)/u.test(text)) return null;
  if (!/(אירוע|יומן|היסטורי|מי נכנס|מי יצא|מה קרה|כניסות|יציאות|history|events)/u.test(text)) return null;
  if (/(עכשיו|כרגע|השבוע|חודש|שבוע|שלשום|last week|now)/u.test(text)) throw new Error("GUARD_QUERY_INVALID_WINDOW");
  const date = text.match(/\b\d{4}-\d{2}-\d{2}\b/g);
  const days = [/(היום|today)/u.test(text) ? "today" : null, /(אתמול|yesterday)/u.test(text) ? "yesterday" : null].filter(Boolean);
  if ((date?.length ?? 0) + days.length !== 1) throw new Error("GUARD_QUERY_INVALID_WINDOW");
  const times = text.match(/\b\d{1,2}:\d{2}\b/g) ?? [];
  if (times.length !== 0 && times.length !== 2) throw new Error("GUARD_QUERY_INVALID_WINDOW");
  if (/(שעה|שעות|בין)/u.test(text) && times.length !== 2) throw new Error("GUARD_QUERY_INVALID_WINDOW");
  const clock = times.length ? { fromTime: times[0]!.padStart(5, "0"), toTime: times[1]!.padStart(5, "0") } : {};
  const candidates = context.cameras.filter(camera => camera.observerSiteId === context.observerSiteId).flatMap(camera =>
    [camera.name, camera.zoneName, ...(camera.aliases ?? [])].filter((name): name is string => Boolean(name))
      .map(name => ({ id: camera.id, name, key: name.normalize("NFKC").toLocaleLowerCase("he-IL").replace(/\s+/g, " ").trim() }))
  ).filter(alias => {
    const escaped = alias.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^\\p{L}\\p{N}])[בהלמ]?${escaped}(?=$|[^\\p{L}\\p{N}])`, "u").test(text);
  });
  const longest = candidates.sort((a, b) => b.key.length - a.key.length)[0];
  const mentioned = candidates.filter(alias => !longest || !longest.key.includes(alias.key) || alias.key === longest.key);
  if (new Set(mentioned.map(alias => alias.id)).size > 1 && !cameraSourceId) throw new Error("GUARD_QUERY_AMBIGUOUS_ZONE");
  if (cameraSourceId && mentioned.some(alias => alias.id !== cameraSourceId && alias.key !== longest?.key)) throw new Error("GUARD_QUERY_CAMERA_ZONE_MISMATCH");
  if (!longest && /(מצלמת|במצלמה|באזור|בחדר|camera|zone)/u.test(text)) throw new Error("GUARD_QUERY_UNKNOWN_ZONE");
  if (!longest && /(?:^|\s)ב(?!ין(?:\s|$)|כל המצלמות)[\p{L}]/u.test(text)) throw new Error("GUARD_QUERY_UNKNOWN_ZONE");
  const vehicle = /(רכב|מכוני|vehicle|car)/u.test(text);
  const entering = /(נכנס|כניסות|entry|entries)/u.test(text), exiting = /(יצא|יציאות|exit)/u.test(text);
  if (vehicle && !entering && !exiting) throw new Error("GUARD_QUERY_UNKNOWN_EVENT_TYPE");
  const eventTypes: GuardEventType[] = [...(entering ? [vehicle ? "VEHICLE_IN" as const : "ENTRY" as const] : []), ...(exiting ? [vehicle ? "VEHICLE_OUT" as const : "EXIT" as const] : [])];
  return { cameraSourceId, cameraZoneName: longest?.name,
    window: date ? { kind: "date", date: date[0], ...clock } : { kind: "relative", day: days[0] as "today" | "yesterday", ...clock },
    ...(eventTypes.length ? { eventTypes } : {}), limit: 20 };
}

/** Uses the user's session client, never an admin client or a camera transport.
 * New validated events store their observed timestamp in created_at at ingestion.
 * Legacy events use the linked clip's captured_at, never their ingestion time.
 * Both streams apply site, camera, type, review and time filters BEFORE the cap. */
export async function searchGuardJournal(db: any, input: GuardJournalQueryInput, context: GuardJournalContext, cameras: Row[]) {
  // Until a separately reviewed skeleton-only projection exists, do not read
  // potentially identifying legacy events, including unfiltered history queries.
  if (context.privacyRestricted !== false) throw new Error("GUARD_QUERY_PRIVACY_SCOPE_UNSUPPORTED");
  const plan = buildGuardJournalQuery(input, context);
  const types = guardStorageEventTypes(plan.eventTypes);
  const scopedCameras = cameras.filter(camera => camera.observer_site_id === plan.observerSiteId);
  const camera = plan.cameraSourceId ? scopedCameras.find(item => item.id === plan.cameraSourceId) : null;
  if (plan.cameraSourceId && !camera) throw new Error("GUARD_QUERY_CAMERA_OUTSIDE_SITE");
  const selectedIds = camera ? [camera.id, camera.camera_stream_id].filter(value => uuid.safeParse(value).success) : [];
  function filters(query: any, joined = false) {
    const prefix = joined ? "signal." : "";
    if (types.length) query = query.or(`metadata->>event_type.in.(${types.join(",")}),and(metadata->>event_type.is.null,signal_type.in.(${types.join(",")}))`, joined ? { referencedTable: "signal" } : undefined);
    if (plan.reviewStatuses.length) query = query.in(`${prefix}review_status`, [...plan.reviewStatuses]);
    // The legacy query is already scoped by the clip's real camera FK. Older
    // signals may lack a redundant camera field; conflicting fields are rejected below.
    if (camera && !joined) query = query.or(`metadata->>camera_source_id.eq.${camera.id},camera_id.in.(${selectedIds.join(",")})`);
    return query;
  }
  let current = db.from("observer_intelligence_signals")
    .select("id,observer_site_id,camera_id,signal_type,severity,confidence,review_status,recommended_action,metadata,created_at,clip:digital_observer_event_clips(id,observer_site_id,camera_source_id,signal_id,clip_status,delete_after)")
    .eq("observer_site_id", plan.observerSiteId).eq("metadata->>validated_event", "true")
    .gte("created_at", plan.fromInclusive).lt("created_at", plan.toExclusive);
  current = filters(current).order("created_at", { ascending: false }).order("id").limit(cap + 1);
  let legacy = db.from("digital_observer_event_clips")
    .select("id,observer_site_id,camera_source_id,signal_id,captured_at,clip_status,delete_after,signal:observer_intelligence_signals!inner(id,observer_site_id,camera_id,signal_type,severity,confidence,review_status,recommended_action,metadata,created_at)")
    .eq("observer_site_id", plan.observerSiteId).eq("signal.observer_site_id", plan.observerSiteId)
    .or("metadata->>validated_event.is.null,metadata->>validated_event.neq.true", { referencedTable: "signal" })
    .gte("captured_at", plan.fromInclusive).lt("captured_at", plan.toExclusive);
  if (camera) legacy = legacy.eq("camera_source_id", camera.id);
  legacy = filters(legacy, true).order("captured_at", { ascending: false }).order("id").limit(cap + 1);
  const [currentResult, legacyResult] = await Promise.all([current, legacy]);
  if (currentResult.error || legacyResult.error) throw new Error("GUARD_JOURNAL_UNAVAILABLE");
  const rows: Row[] = [], clips: Row[] = [];
  let invalidEvidence = 0;
  const from = Date.parse(plan.fromInclusive), to = Date.parse(plan.toExclusive);
  function append(row: Row, observed: string, basis: string) {
    const source = scopedCameras.find(item => item.id === rowCamera(row) || item.camera_stream_id === rowCamera(row));
    const time = Date.parse(observed);
    if (row.observer_site_id !== plan.observerSiteId || !source || (camera && source.id !== camera.id)
      || !Number.isFinite(time) || time < from || time >= to || (types.length && !types.includes(typeOf(row)))
      || (plan.reviewStatuses.length && !plan.reviewStatuses.includes(row.review_status))) { invalidEvidence++; return; }
    const timestamp = new Date(time).toISOString();
    rows.push({ ...row, timestamp, metadata: { ...row.metadata, camera_source_id: source.id, first_seen: timestamp, last_seen: timestamp, journal_timestamp_basis: basis } });
  }
  for (const row of (currentResult.data ?? []).slice(0, cap)) {
    // Reject imported/malformed rows that claim validation but used arrival time.
    // The live ingestion contract stores these two timestamps identically.
    if (row.metadata?.validated_event !== true || Date.parse(row.metadata?.first_seen) !== Date.parse(row.created_at)) { invalidEvidence++; continue; }
    append(row, row.metadata.first_seen, "validated_observation");
    for (const clip of (Array.isArray(row.clip) ? row.clip : row.clip ? [row.clip] : [])) {
      if (clip.observer_site_id === plan.observerSiteId && clip.signal_id === row.id && scopedCameras.some(source => source.id === clip.camera_source_id && [source.id, source.camera_stream_id].includes(rowCamera(row)))) clips.push(clip);
    }
  }
  for (const clip of (legacyResult.data ?? []).slice(0, cap)) {
    const row = clip.signal;
    const linkedSource = scopedCameras.find(source => source.id === clip.camera_source_id);
    if (!row || Array.isArray(row) || row.metadata?.validated_event === true || clip.observer_site_id !== plan.observerSiteId
      || !linkedSource || (rowCamera(row) && ![linkedSource.id, linkedSource.camera_stream_id].includes(rowCamera(row)))) { invalidEvidence++; continue; }
    append({ ...row, metadata: { ...row.metadata, camera_source_id: linkedSource.id } }, clip.captured_at, "linked_capture");
    clips.push(clip);
  }
  const partition = eventJournalService.partitionRows(rows, scopedCameras, clips);
  const grouped = partition.events.map(row => eventJournalService.normalize(row));
  return {
    query: plan, events: grouped.slice(0, plan.limit),
    coverage: { historical_only: true, hardware_actions: 0, continuous_analysis_verified: false, dvr_archive_scanned: false,
      // PostgREST may enforce a server cap of exactly 1000 despite limit(1001).
      limit_reached: (currentResult.data?.length ?? 0) >= cap || (legacyResult.data?.length ?? 0) >= cap || grouped.length > plan.limit,
      legacy_without_observation_time_excluded: true, invalid_evidence_excluded: invalidEvidence, spatial_mismatches_excluded: partition.spatialMismatches.length }
  };
}

export function guardJournalAnswer(result: Awaited<ReturnType<typeof searchGuardJournal>>) {
  const format = new Intl.DateTimeFormat("he-IL", { timeZone: result.query.timeZone, dateStyle: "short", timeStyle: "short" });
  const range = `${format.format(new Date(result.query.fromInclusive))}–${format.format(new Date(result.query.toExclusive))}`;
  const lines = result.events.map(event => `${format.format(new Date(event.timestamp))} · ${event.camera_name}: ${event.description}`);
  return `${lines.length ? `נמצאו ${result.events.length} אירועים שמורים בטווח ${range}:\n${lines.join("\n")}` : `לא נמצאו אירועים שמורים תואמים בטווח ${range}.`}${result.coverage.limit_reached ? "\nהתוצאות מוגבלות; אפשר לצמצם את הטווח." : ""}\nזהו חיפוש היסטורי בלבד, לא בדיקת נוכחות עכשיו או הוכחה לכיסוי רציף. רשומות ישנות ללא זמן תצפית או צילום מזוהה אינן נכללות.`;
}
