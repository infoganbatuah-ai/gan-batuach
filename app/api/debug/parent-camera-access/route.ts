import { fail, handleRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { canParentViewCamera } from "@/lib/domain/parent-camera-access";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { profile } = await getSessionProfile();
    const isDevelopment = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SANDBOX_MODE === "true";
    if (!profile || (profile.role !== "admin" && !isDevelopment)) return fail("Forbidden", 403);

    const url = new URL(request.url);
    const cameraId = url.searchParams.get("camera_id");
    const parentProfileId = url.searchParams.get("parent_profile_id");
    const email = url.searchParams.get("email")?.trim().toLowerCase();
    if (!cameraId) return fail("camera_id is required", 422);
    if (!parentProfileId && !email) return fail("parent_profile_id or email is required", 422);

    const supabase = isAdminClientConfigured() ? createAdminClient() : await createClient();
    let resolvedParentProfileId = parentProfileId;
    let profileLookupError: unknown = null;

    if (!resolvedParentProfileId && email) {
      const { data, error } = await supabase
        .from("profiles" as any)
        .select("id, email, full_name, role, garden_id")
        .eq("email", email)
        .maybeSingle();
      profileLookupError = error ?? null;
      resolvedParentProfileId = data?.id ?? null;
      console.info("Parent camera debug profile lookup", { email, found: Boolean(data), profileLookupError });
    }

    if (!resolvedParentProfileId) {
      return ok({
        allowed: false,
        reason: "parent_profile_not_found",
        profile_lookup_error: profileLookupError,
        diagnostics: {
          parent_profile_found: false,
          requested_email: email,
          camera_id: cameraId
        }
      });
    }

    const decision = await canParentViewCamera(supabase as any, resolvedParentProfileId, cameraId);
    return ok(decision);
  } catch (error) {
    console.error("[debug-parent-camera-access]", error);
    return handleRouteError(error);
  }
}
