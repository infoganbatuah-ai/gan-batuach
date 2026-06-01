import { loadFinanceAuthDiagnostics } from "@/lib/debug/finance-auth-diagnostics";

export const dynamic = "force-dynamic";

function formatError(error: unknown) {
  return error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack}` : ""}` : String(error);
}

export default async function FinanceGardenPingPage() {
  console.error("[finance-garden-ping] route started");

  try {
    const diagnostics = await loadFinanceAuthDiagnostics();
    const profile = diagnostics.sessionProfile.profile as any;
    const gardenId = diagnostics.sessionProfile.gardenId;

    console.error("[finance-garden-ping] result", {
      cookies: diagnostics.cookieNames,
      getUser: diagnostics.getUser,
      getSession: diagnostics.getSession,
      hasProfile: Boolean(profile),
      role: diagnostics.sessionProfile.role,
      gardenId
    });

    return (
      <main style={{ direction: "rtl", fontFamily: "system-ui", padding: 24 }}>
        <h1>finance garden ping</h1>
        <p>cookie names: {diagnostics.cookieNames.length ? diagnostics.cookieNames.join(", ") : "none"}</p>
        <p>auth.getUser user id: {diagnostics.getUser.userId ?? "not found"}</p>
        <p>auth.getUser error: {diagnostics.getUser.error ?? "none"}</p>
        <p>auth.getSession user id: {diagnostics.getSession.userId ?? "not found"}</p>
        <p>auth.getSession error: {diagnostics.getSession.error ?? "none"}</p>
        <p>dashboard helper user found: {diagnostics.sessionProfile.userId ? "yes" : "no"}</p>
        <p>profile found: {profile ? "yes" : "no"}</p>
        <p>role: {diagnostics.sessionProfile.role ?? "none"}</p>
        <p>garden id: {gardenId ?? "none"}</p>
      </main>
    );
  } catch (error) {
    const message = formatError(error);
    console.error("[finance-garden-ping] failed", error);
    return (
      <main style={{ direction: "rtl", fontFamily: "system-ui", padding: 24 }}>
        <h1>finance garden ping failed</h1>
        <pre>{message}</pre>
      </main>
    );
  }
}
