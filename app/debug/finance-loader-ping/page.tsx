import { loadFinanceAuthDiagnostics } from "@/lib/debug/finance-auth-diagnostics";
import { loadGardenFinanceData } from "@/lib/domain/garden-finance-loader";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatError(error: unknown) {
  return error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack}` : ""}` : String(error);
}

export default async function FinanceLoaderPingPage() {
  await requireRole(["admin"]);
  console.error("[finance-loader-ping] route started");

  try {
    const diagnostics = await loadFinanceAuthDiagnostics();
    const gardenId = diagnostics.sessionProfile.gardenId ?? "";
    const data = await loadGardenFinanceData({
      supabase: diagnostics.supabase as any,
      gardenId,
      searchParams: {},
      debug: true
    });

    console.error("[finance-loader-ping] result", {
      cookies: diagnostics.cookieNames,
      getUser: diagnostics.getUser,
      getSession: diagnostics.getSession,
      role: diagnostics.sessionProfile.role,
      gardenId: gardenId || null,
      loaderOk: data.ok,
      diagnostics: data.diagnostics?.length ?? 0,
      errors: data.errors?.length ?? 0
    });

    return (
      <main style={{ direction: "rtl", fontFamily: "system-ui", padding: 24 }}>
        <h1>finance loader ping</h1>
        <p>cookie names: {diagnostics.cookieNames.length ? diagnostics.cookieNames.join(", ") : "none"}</p>
        <p>auth.getUser user id: {diagnostics.getUser.userId ?? "not found"}</p>
        <p>auth.getUser error: {diagnostics.getUser.error ?? "none"}</p>
        <p>auth.getSession user id: {diagnostics.getSession.userId ?? "not found"}</p>
        <p>auth.getSession error: {diagnostics.getSession.error ?? "none"}</p>
        <p>getSessionProfile user id: {diagnostics.sessionProfile.userId ?? "not found"}</p>
        <p>profile found: {diagnostics.sessionProfile.profileId ? "yes" : "no"}</p>
        <p>role: {diagnostics.sessionProfile.role ?? "none"}</p>
        <p>garden id: {gardenId || "none"}</p>
        <p>loader ok: {String(data.ok)}</p>
        <h2>diagnostics</h2>
        <ul>
          {(data.diagnostics ?? []).map((item, index) => (
            <li key={`${item.label}-${index}`}>
              {item.label} | {item.table} | {item.columns} | {item.success ? "success" : "error"} | count: {item.count} | {item.error ?? ""}
            </li>
          ))}
        </ul>
        <h2>errors</h2>
        <ul>
          {(data.errors ?? []).map((item, index) => <li key={`error-${index}`}>{item}</li>)}
        </ul>
      </main>
    );
  } catch (error) {
    const message = formatError(error);
    console.error("[finance-loader-ping] failed", error);
    return (
      <main style={{ direction: "rtl", fontFamily: "system-ui", padding: 24 }}>
        <h1>finance loader ping failed</h1>
        <pre>{message}</pre>
      </main>
    );
  }
}
