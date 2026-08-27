import { NextResponse } from "next/server";
import { fail, handleRouteError } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const { id } = await context.params;
    const { profile, supabase: sessionSupabase } = session;
    const supabase = sessionSupabase as any;

    const { data: candidate } = await supabase
      .from("digital_observer_identity_candidates" as any)
      .select("id,observer_site_id,preview_available")
      .eq("id", id)
      .maybeSingle();
    if (!candidate?.preview_available) return fail("אין תמונת תצוגה זמינה.", 404);
    const site = await getObserverSiteAccess(supabase, profile, candidate.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לצפות בתמונה.", 403);
    if ((site as any).vision_privacy_mode === "skeleton_only" || (site as any).business_handles_children) {
      return fail("תמונות פנים חסומות באתר המטפל בילדים.", 403);
    }
    if (!isAdminClientConfigured()) return fail("חתימת תמונה פרטית אינה זמינה כרגע.", 503);

    const admin = createAdminClient();
    const { data: privateCandidate } = await admin
      .from("digital_observer_identity_candidates" as any)
      .select("sample_storage_bucket,sample_storage_path")
      .eq("id", candidate.id)
      .eq("observer_site_id", candidate.observer_site_id)
      .maybeSingle();
    if (!privateCandidate?.sample_storage_bucket || !privateCandidate?.sample_storage_path) {
      return fail("תמונת המועמד אינה זמינה.", 404);
    }

    const { data: signed, error } = await admin.storage
      .from(privateCandidate.sample_storage_bucket)
      .createSignedUrl(privateCandidate.sample_storage_path, 60);
    if (error || !signed?.signedUrl) return fail("לא ניתן לפתוח תצוגה פרטית.", 503);
    return NextResponse.redirect(signed.signedUrl, { status: 307 });
  } catch (error) {
    return handleRouteError(error);
  }
}
