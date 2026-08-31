import { NextResponse } from "next/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const BATCH_SIZE = 100;
const MEDIA_BUCKET = "digital-observer-event-media";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function clipMetadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function retentionDeadline(clip: any) {
  const captured = Date.parse(clip.captured_at ?? "");
  const configured = Date.parse(clip.delete_after ?? "");
  const requested = Number(clip.retention_hours);
  const hours = Number.isFinite(requested) && requested > 0 ? Math.min(48, requested) : 48;
  const deadlines = [configured, Number.isFinite(captured) ? captured + hours * 3_600_000 : NaN].filter(Number.isFinite);
  return deadlines.length ? Math.min(...deadlines) : null;
}

function safeMediaPaths(clip: any) {
  const paths = [clip.storage_path, clip.snapshot_storage_path].filter((path): path is string => typeof path === "string" && path.length > 0);
  if (!paths.length) return [];
  if (clip.storage_bucket !== MEDIA_BUCKET || typeof clip.observer_site_id !== "string") return null;
  if (paths.some(path => !path.startsWith(`${clip.observer_site_id}/`) || path.length > 1024
    || path.split("/").some(part => !/^[A-Za-z0-9._-]+$/.test(part) || part === "." || part === ".."))) return null;
  return [...new Set(paths)];
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminClientConfigured()) return NextResponse.json({ error: "Media retention is not configured." }, { status: 503 });

  const admin = createAdminClient() as any;
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  // Supported policies are 1/6/24/48 hours. Also enforce the hard 48-hour cap
  // even when a legacy delete_after is absent or was set beyond that deadline.
  const due = [
    `delete_after.lte.${now}`,
    ...[1, 6, 24].map(hours => `and(retention_hours.eq.${hours},captured_at.lte.${new Date(nowMs - hours * 3_600_000).toISOString()})`),
    `captured_at.lte.${new Date(nowMs - 48 * 3_600_000).toISOString()}`
  ].join(",");
  const { data: clips, error } = await admin
    .from("digital_observer_event_clips")
    .select("id,observer_site_id,storage_bucket,storage_path,snapshot_storage_path,captured_at,delete_after,retention_hours,metadata")
    .in("clip_status", ["available", "failed"])
    .or(due)
    .order("delete_after", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(BATCH_SIZE);
  if (error) return NextResponse.json({ error: "Unable to scan expired event media." }, { status: 500 });

  let purged = 0;
  let retryableFailures = 0;
  let invalidPaths = 0;
  for (const clip of clips ?? []) {
    const deadline = retentionDeadline(clip);
    if (deadline === null || deadline > nowMs) continue;
    const paths = safeMediaPaths(clip);
    if (paths === null) { invalidPaths += 1; continue; }
    try {
      if (paths.length) {
        const remove = await admin.storage.from(clip.storage_bucket).remove(paths);
        if (remove.error) {
          retryableFailures += 1;
          continue;
        }
      }
      let updateQuery = admin
        .from("digital_observer_event_clips")
        .update({
          clip_status: "expired",
          storage_path: null,
          snapshot_storage_path: null,
          downloadable: false,
          media_status: "expired",
          media_missing_reason: "retention_expired",
          metadata: {
            ...clipMetadata(clip.metadata),
            clip_available: false,
            thumbnail_available: false,
            media_status: "expired",
            media_missing_reason: "retention_expired",
            retention_purged_at: now
          }
        })
        .eq("id", clip.id)
        .eq("observer_site_id", clip.observer_site_id);
      // Do not clear replacement paths written while the storage request ran.
      for (const field of ["storage_bucket", "storage_path", "snapshot_storage_path"]) {
        updateQuery = clip[field] == null ? updateQuery.is(field, null) : updateQuery.eq(field, clip[field]);
      }
      const update = await updateQuery.select("id").maybeSingle();
      if (update.error || !update.data) {
        retryableFailures += 1;
        continue;
      }
      purged += 1;
    } catch {
      retryableFailures += 1;
    }
  }

  return NextResponse.json({ processed: (clips ?? []).length, purged, retryable_failures: retryableFailures, invalid_paths: invalidPaths, scan_limit_reached: (clips ?? []).length >= BATCH_SIZE });
}
