import { NextResponse } from "next/server";
import { fail, handleRouteError } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { observerEventMediaDeadline, observerEventMediaReason, observerEventMediaState } from "@/lib/domain/digital-observer/event-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    if (!isAdminClientConfigured()) return fail("חתימת מדיה פרטית אינה זמינה כרגע.", 503);
    const { id } = await context.params;
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") === "thumbnail" ? "thumbnail" : "clip";
    const download = url.searchParams.get("download") === "1";
    const { profile, supabase: sessionSupabase } = session;
    const supabase = sessionSupabase as any;

    const { data: publicClip } = await supabase
      .from("digital_observer_event_clips" as any)
      .select("id,observer_site_id,camera_source_id,signal_id,clip_status")
      .eq("id", id)
      .maybeSingle();
    if (!publicClip) return fail("מקטע האירוע לא נמצא.", 404);
    const site = await getObserverSiteAccess(supabase, profile, publicClip.observer_site_id, { manage: false });
    if (!site) return fail("אין הרשאה לצפות במדיה של האירוע.", 403);

    const admin = createAdminClient();
    const { data: privateClip } = await admin
      .from("digital_observer_event_clips" as any)
      .select("id,observer_site_id,camera_source_id,clip_status,storage_bucket,storage_path,snapshot_storage_path,captured_at,delete_after,retention_hours,downloadable,metadata")
      .eq("id", publicClip.id)
      .eq("observer_site_id", publicClip.observer_site_id)
      .maybeSingle();
    if (!privateClip || privateClip.camera_source_id !== publicClip.camera_source_id) return fail("מדיית האירוע אינה משויכת למקור המאומת.", 403);
    const mediaState = observerEventMediaState(privateClip);
    if (mediaState !== "available") return fail(observerEventMediaReason(mediaState), mediaState === "expired" ? 410 : 404);
    if (download && privateClip.downloadable !== true) return fail("הורדת מדיה אינה מאושרת לאירוע זה.", 403);
    const path = kind === "thumbnail" ? privateClip.snapshot_storage_path : privateClip.storage_path;
    if (!privateClip.storage_bucket || !path) return fail("מדיית האירוע חסרה.", 404);
    if (privateClip.storage_bucket !== "digital-observer-event-media" || !path.startsWith(`${publicClip.observer_site_id}/`)) return fail("נתיב המדיה אינו שייך לאתר המאומת.", 403);
    const remainingSeconds = Math.floor(((observerEventMediaDeadline(privateClip) ?? 0) - Date.now()) / 1000);
    if (remainingSeconds < 1) return fail(observerEventMediaReason("expired"), 410);

    const { data: signed, error } = await admin.storage
      .from(privateClip.storage_bucket)
      .createSignedUrl(path, Math.min(60, remainingSeconds), download ? { download: kind === "thumbnail" ? "event-thumbnail.jpg" : "event-clip.mp4" } : undefined);
    if (error || !signed?.signedUrl) return fail("לא ניתן לפתוח מדיה פרטית.", 503);
    return NextResponse.redirect(signed.signedUrl, { status: 307, headers: { "cache-control": "private, no-store", "referrer-policy": "no-referrer" } });
  } catch (error) {
    return handleRouteError(error);
  }
}
