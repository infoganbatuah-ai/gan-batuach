// Host-only bridge to the existing Digital Observer admin claim and active
// profile contract (lib/domain/digital-observer/admin-access.ts and access.ts).
// The injected functions must use an approved Production Auth connection;
// never trust decoded JWT claims or client-supplied role strings.
export function createHomeLegacyAdminVerifier({ getUser, getProfile }) {
  if (typeof getUser !== "function" || typeof getProfile !== "function")
    throw new TypeError("AUTHENTICATED_ADMIN_SOURCE_REQUIRED");
  return async function verifyAdministrator(accessToken) {
    if (typeof accessToken !== "string" || accessToken.length < 32) return null;
    try {
      const user = await getUser(accessToken);
      if (!user?.id || user.app_metadata?.digital_observer_admin !== true) return null;
      const profile = await getProfile(user.id, accessToken);
      if (!profile || profile.id !== user.id || profile.active !== true || profile.role !== "admin")
        return null;
      return { authenticated: true, role: "platform_admin", actorId: user.id };
    } catch {
      return null;
    }
  };
}
