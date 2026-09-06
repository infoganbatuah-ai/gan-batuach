import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export const DIGITAL_OBSERVER_ADMIN_METADATA_KEY = "digital_observer_admin";

export function hasObserverAdminClaim(appMetadata: Record<string, unknown> | null | undefined) {
  return appMetadata?.[DIGITAL_OBSERVER_ADMIN_METADATA_KEY] === true;
}

export async function requireDigitalObserverAdmin(nextPath = "/digital-observer/admin") {
  const session = await requireUser(`/digital-observer/login?next=${encodeURIComponent(nextPath)}`);
  const observerScoped = hasObserverAdminClaim(session.user.app_metadata);

  if (!observerScoped) redirect("/digital-observer/dashboard?error=observer_admin_required");
  if (!isAdminClientConfigured()) redirect("/digital-observer/dashboard?error=observer_admin_unavailable");

  return {
    ...session,
    observerAdmin: {
      scope: "digital_observer_only" as const,
      mediaAccess: false as const,
      secretAccess: false as const
    }
  };
}

export function createDigitalObserverAdminDataClient() {
  return createAdminClient();
}
