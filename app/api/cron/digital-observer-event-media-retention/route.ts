import { NextResponse } from "next/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createRetentionPolicy, createSupabaseStorageBackend, executeRetention } from "@/lib/domain/digital-observer/storage-contract.mjs";

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

  // Generated database types are updated only after the migration is applied.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const now = new Date().toISOString();
  const { data: clips, error } = await admin
    .from("digital_observer_event_clips")
    .select("id,observer_site_id,storage_bucket,storage_path,snapshot_storage_path,delete_after,metadata,observer_sites(owner_profile_id)")
    .in("clip_status", ["available", "failed"])
    .not("delete_after", "is", null)
    .lte("delete_after", now)
    .limit(BATCH_SIZE);
  if (error) return NextResponse.json({ error: "Unable to scan expired event media." }, { status: 500 });

  let purged = 0;
  let retryableFailures = 0;
  for (const clip of clips ?? []) {
    const metadata = clipMetadata(clip.metadata);
    if (metadata.legal_hold === true) continue;
    const tenantId = clip.observer_sites?.owner_profile_id;
    const canonicalPaths = [metadata.clip_object_id, metadata.thumbnail_object_id].filter((path): path is string => typeof path === "string" && path.length > 0);
    const legacyPaths = [clip.storage_path, clip.snapshot_storage_path].filter((path): path is string => typeof path === "string" && path.length > 0);
    try {
      if (tenantId && metadata.storage_backend_id === "supabase-private-evidence" && canonicalPaths.length) {
        const storage = createSupabaseStorageBackend({ client: admin, bucket: clip.storage_bucket });
        const policy = createRetentionPolicy({ policyId: "event-media-default", version: Number(metadata.retention_policy_version || 1), tenantId, siteId: clip.observer_site_id, retentionDays: 1 });
        for (const objectId of canonicalPaths) await executeRetention({ backend: storage, policy, object: { object_id: objectId, tenant_id: tenantId, site_id: clip.observer_site_id,
          evidence_id: clip.id, delete_after: clip.delete_after, created_at: clip.delete_after, legal_hold: false, size_bytes: 0 }, updateCanonical: async () => undefined });
      } else if (clip.storage_bucket && legacyPaths.length) {
        // Bounded pre-PUSH-34 compatibility; retirement waits for verified migration.
        const remove = await admin.storage.from(clip.storage_bucket).remove(legacyPaths);
        if (remove.error) throw new Error("legacy_storage_delete_failed");
      }
    } catch { retryableFailures += 1; continue; }
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
          ...metadata,
          clip_object_id: null,
          thumbnail_object_id: null,
          storage_state: "DELETED",
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
