import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export const DIGITAL_OBSERVER_ADMIN_METADATA_KEY = "digital_observer_admin";

export async function hasCurrentObserverAdmin(userId: string) {
  try {
    if (!userId || !isAdminClientConfigured()) return false;
    // A session JWT can retain a revoked claim; consult current server-owned Auth.
    const { data, error } = await createAdminClient().auth.admin.getUserById(userId);
    return !error && data.user?.id === userId &&
      data.user.app_metadata?.[DIGITAL_OBSERVER_ADMIN_METADATA_KEY] === true;
  } catch { return false; }
}
