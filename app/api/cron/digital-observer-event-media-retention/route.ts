import { NextResponse } from "next/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const BATCH_SIZE = 100;

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
  const now = new Date().toISOString();
  const { data: clips, error } = await admin
    .from("digital_observer_event_clips")
    .select("id,storage_bucket,storage_path,snapshot_storage_path,metadata")
    .in("clip_status", ["available", "failed"])
    .not("delete_after", "is", null)
    .lte("delete_after", now)
    .limit(BATCH_SIZE);
  if (error) return NextResponse.json({ error: "Unable to scan expired event media." }, { status: 500 });

  let purged = 0;
  let retryableFailures = 0;
  for (const clip of clips ?? []) {
    const paths = [clip.storage_path, clip.snapshot_storage_path].filter((path): path is string => typeof path === "string" && path.length > 0);
    if (clip.storage_bucket && paths.length) {
      const remove = await admin.storage.from(clip.storage_bucket).remove(paths);
      if (remove.error) {
        retryableFailures += 1;
        continue;
      }
    }
    const update = await admin
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
      .eq("id", clip.id);
    if (update.error) {
      retryableFailures += 1;
      continue;
    }
    purged += 1;
  }

  return NextResponse.json({ processed: (clips ?? []).length, purged, retryable_failures: retryableFailures });
}
