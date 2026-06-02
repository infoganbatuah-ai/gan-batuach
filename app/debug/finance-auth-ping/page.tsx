import { loadFinanceAuthDiagnostics } from "@/lib/debug/finance-auth-diagnostics";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default async function FinanceAuthPingPage() {
  await requireRole(["admin"]);
  console.error("[finance-auth-ping] route started");

  try {
    const diagnostics = await loadFinanceAuthDiagnostics();

    console.error("[finance-auth-ping] auth result", {
      cookies: diagnostics.cookieNames,
      getUser: diagnostics.getUser,
      getSession: diagnostics.getSession,
      sessionProfile: {
        userId: diagnostics.sessionProfile.userId,
        profileId: diagnostics.sessionProfile.profileId,
        role: diagnostics.sessionProfile.role,
        gardenId: diagnostics.sessionProfile.gardenId
      }
    });

    return (
      <main style={{ direction: "rtl", fontFamily: "system-ui", padding: 24 }}>
        <h1>finance auth ping</h1>
        <p>cookie names: {diagnostics.cookieNames.length ? diagnostics.cookieNames.join(", ") : "none"}</p>
        <p>auth.getUser user id: {diagnostics.getUser.userId ?? "not found"}</p>
        <p>auth.getUser error: {diagnostics.getUser.error ?? "none"}</p>
        <p>auth.getSession user id: {diagnostics.getSession.userId ?? "not found"}</p>
        <p>auth.getSession error: {diagnostics.getSession.error ?? "none"}</p>
        <p>getSessionProfile user id: {diagnostics.sessionProfile.userId ?? "not found"}</p>
        <p>getSessionProfile profile id: {diagnostics.sessionProfile.profileId ?? "not found"}</p>
        <p>role: {diagnostics.sessionProfile.role ?? "none"}</p>
        <p>garden id: {diagnostics.sessionProfile.gardenId ?? "none"}</p>
      </main>
    );
  } catch (error) {
    const message = formatError(error);
    console.error("[finance-auth-ping] failed", error);
    return (
      <main style={{ direction: "rtl", fontFamily: "system-ui", padding: 24 }}>
        <h1>finance auth ping failed</h1>
        <pre>{message}</pre>
      </main>
    );
  }
}
