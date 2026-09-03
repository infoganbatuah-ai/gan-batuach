import { NextResponse } from "next/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const BATCH_SIZE = 100;
const MAX_PER_RUN = 1_000;
const TIME_BUDGET_MS = 20_000;
const MEDIA_BUCKET = "digital-observer-event-media";

function expiredClips(admin: any, now: string) {
  return admin.from("digital_observer_event_clips")
    .select("id,observer_site_id,storage_bucket,storage_path,snapshot_storage_path,metadata")
    .in("clip_status", ["available", "failed"])
    .not("delete_after", "is", null)
    .lte("delete_after", now);
}

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function clipMetadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminClientConfigured()) return NextResponse.json({ error: "Media retention is not configured." }, { status: 503 });

  const admin = createAdminClient() as any;
  const startedAt = Date.now();
  const now = new Date().toISOString();
  let cursor: string | null = null;
  let processed = 0;
  let purged = 0;
  let retryableFailures = 0;
  try {
    while (processed < MAX_PER_RUN && Date.now() - startedAt < TIME_BUDGET_MS) {
      const limit = Math.min(BATCH_SIZE, MAX_PER_RUN - processed);
      let query = expiredClips(admin, now).order("id", { ascending: true }).limit(limit);
      if (cursor) query = query.gt("id", cursor);
      const { data: clips, error } = await query;
      if (error) throw new Error("retention_scan_failed");
      if (!clips?.length) break;

      // Keyset pagination continues past failed rows without skipping successful
      // deletions as offset pagination would. Failures remain eligible next run.
      for (const clip of clips) {
        if (Date.now() - startedAt >= TIME_BUDGET_MS) break;
        processed += 1;
        cursor = clip.id;
        try {
          const paths = [clip.storage_path, clip.snapshot_storage_path].filter((path): path is string => typeof path === "string" && path.length > 0);
          if (!clip.observer_site_id || (paths.length && (clip.storage_bucket !== MEDIA_BUCKET
            || paths.some(path => !path.startsWith(`${clip.observer_site_id}/`))))) {
            throw new Error("retention_storage_scope_invalid");
          }
          if (paths.length) {
            const remove = await admin.storage.from(MEDIA_BUCKET).remove(paths);
            if (remove.error) throw new Error("retention_remove_failed");
          }
          const update = await admin.from("digital_observer_event_clips")
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
          if (update.error) throw new Error("retention_update_failed");
          purged += 1;
        } catch {
          retryableFailures += 1;
        }
      }
      if (clips.length < limit) break;
    }

    const remaining = await expiredClips(admin, now).limit(1);
    if (remaining.error) throw new Error("retention_scan_failed");
    return NextResponse.json({ processed, purged, retryable_failures: retryableFailures, has_more: Boolean(remaining.data?.length) });
  } catch {
    return NextResponse.json({ error: "Unable to scan expired event media.", processed, purged, retryable_failures: retryableFailures, has_more: true }, { status: 500 });
  }
}
