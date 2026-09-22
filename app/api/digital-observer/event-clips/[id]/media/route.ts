import { NextResponse } from "next/server";
import { fail, handleSafeRouteError } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/security/audit-log-service";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { privateRateLimitIdentifier } from "@/lib/security/request-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicEventClip = {
  id: string;
  observer_site_id: string;
  camera_source_id: string;
  signal_id: string;
  clip_status: string;
};

type PrivateEventClip = PublicEventClip & {
  storage_bucket: string | null;
  storage_path: string | null;
  snapshot_storage_path: string | null;
  metadata: Record<string, unknown> | null;
};

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    if (!isAdminClientConfigured()) return fail("חתימת מדיה פרטית אינה זמינה כרגע.", 503);
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return fail("מזהה המדיה אינו תקין.", 422);
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") === "thumbnail" ? "thumbnail" : "clip";
    const download = url.searchParams.get("download") === "1";
    const { profile, supabase: sessionSupabase } = session;

    const { data: publicClipResult } = await sessionSupabase
      .from("digital_observer_event_clips" as never)
      .select("id,observer_site_id,camera_source_id,signal_id,clip_status")
      .eq("id", id)
      .maybeSingle();
    const publicClip = publicClipResult as PublicEventClip | null;
    if (!publicClip) return fail("מקטע האירוע לא נמצא.", 404);
    const site = await getObserverSiteAccess(sessionSupabase, profile, publicClip.observer_site_id, { manage: false });
    if (!site) return fail("אין הרשאה לצפות במדיה של האירוע.", 403);
    await assertRateLimit(privateRateLimitIdentifier({ userId: profile.id, tenantId: site.id, headers: request.headers }), "digital-observer:evidence:sign", 60, 60);

    const admin = createAdminClient();
    const { data: privateClipResult } = await admin
      .from("digital_observer_event_clips" as never)
      .select("id,observer_site_id,camera_source_id,clip_status,storage_bucket,storage_path,snapshot_storage_path,metadata")
      .eq("id", publicClip.id)
      .eq("observer_site_id", publicClip.observer_site_id)
      .maybeSingle();
    const privateClip = privateClipResult as PrivateEventClip | null;
    const metadata = privateClip?.metadata && typeof privateClip.metadata === "object" ? privateClip.metadata : {};
    if (!privateClip || privateClip.clip_status !== "available" || metadata.media_status === "failed") {
      return fail(String(metadata.media_missing_reason || "מדיית האירוע אינה זמינה."), 404);
    }
    const path = kind === "thumbnail" ? privateClip.snapshot_storage_path : privateClip.storage_path;
    if (!privateClip.storage_bucket || !path) return fail("מדיית האירוע חסרה.", 404);

    const { data: signed, error } = await admin.storage
      .from(privateClip.storage_bucket)
      .createSignedUrl(path, 60, download ? { download: kind === "thumbnail" ? "event-thumbnail.jpg" : "event-clip.mp4" } : undefined);
    if (error || !signed?.signedUrl) return fail("לא ניתן לפתוח מדיה פרטית.", 503);
    await writeAuditEvent({
      eventType: "observer_evidence_access_issued",
      eventCategory: "camera",
      actorProfileId: profile.id,
      actorRole: profile.role,
      targetType: "digital_observer_event_clip",
      targetId: privateClip.id,
      cameraId: privateClip.camera_source_id,
      metadata: { observer_site_id: site.id, media_kind: kind, download, signed_ttl_seconds: 60 },
      riskLevel: download ? "medium" : "low"
    });
    const response = NextResponse.redirect(signed.signedUrl, { status: 307 });
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
