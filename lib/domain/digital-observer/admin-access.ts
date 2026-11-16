import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDigitalObserverApiUser } from "@/lib/domain/digital-observer/access";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { hasCurrentObserverAdmin } from "@/lib/domain/digital-observer/current-admin-authority";
export { hasCurrentObserverAdmin, DIGITAL_OBSERVER_ADMIN_METADATA_KEY } from "@/lib/domain/digital-observer/current-admin-authority";

export async function requireDigitalObserverAdmin(nextPath = "/digital-observer/admin") {
  const session = await requireUser(`/digital-observer/login?next=${encodeURIComponent(nextPath)}`);
  const active = await getDigitalObserverApiUser();
  if (!active || active.user.id !== session.user.id) redirect("/digital-observer/login?error=session_expired");
  const observerScoped = await hasCurrentObserverAdmin(session.user.id);

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
