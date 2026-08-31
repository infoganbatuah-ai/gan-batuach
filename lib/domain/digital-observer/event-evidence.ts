export type EventMediaRecord = Record<string, any>;
export type EventMediaState = "available" | "expired" | "missing_source" | "missing_clip" | "missing_thumbnail" | "invalid_retention" | "unavailable";

export function observerEventMediaDeadline(clip: EventMediaRecord | null | undefined) {
  const captured = Date.parse(clip?.captured_at ?? "");
  const configured = Date.parse(clip?.delete_after ?? "");
  if (!Number.isFinite(captured) || !Number.isFinite(configured)) return null;
  const requestedHours = Number(clip?.retention_hours);
  const hours = Number.isFinite(requestedHours) && requestedHours > 0 ? Math.min(48, requestedHours) : 48;
  return Math.min(configured, captured + hours * 60 * 60 * 1000);
}

export function observerEventMediaState(clip: EventMediaRecord | null | undefined, now = Date.now()): EventMediaState {
  if (!clip) return "missing_clip";
  if (!clip.camera_source_id) return "missing_source";
  const metadata = clip.metadata && typeof clip.metadata === "object" ? clip.metadata : {};
  const deadline = observerEventMediaDeadline(clip);
  if (deadline === null) return "invalid_retention";
  if (Date.parse(clip.captured_at) > now + 60_000) return "invalid_retention";
  if (deadline <= now || clip.clip_status === "expired" || metadata.media_status === "expired") return "expired";
  if (clip.clip_status !== "available" || ["failed", "missing"].includes(metadata.media_status)) return "unavailable";
  if (!clip.storage_path && metadata.clip_available !== true) return "missing_clip";
  if (!clip.snapshot_storage_path && metadata.thumbnail_available !== true) return "missing_thumbnail";
  return "available";
}

export function observerEventMediaReason(state: EventMediaState) {
  const reasons: Record<EventMediaState, string> = {
    available: "תמונה וקטע וידאו זמינים לבדיקה",
    expired: "חלון שמירת המדיה הסתיים. תיאור האירוע נשאר ביומן.",
    missing_source: "לא נמצא מקור מצלמה משויך לאירוע",
    missing_clip: "קטע הווידאו של האירוע חסר",
    missing_thumbnail: "התמונה מתוך האירוע חסרה",
    invalid_retention: "לא ניתן לאמת את חלון שמירת המדיה",
    unavailable: "מדיית האירוע אינה זמינה כרגע"
  };
  return reasons[state];
}
