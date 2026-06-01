import { loadGardenFinanceData } from "@/lib/domain/garden-finance-loader";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatError(error: unknown) {
  return error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack}` : ""}` : String(error);
}

export default async function FinanceLoaderPingPage() {
  console.error("[finance-loader-ping] route started");

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    let profile: any = null;
    let profileError: string | null = null;
    if (user?.id) {
      const result = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      profile = result.data;
      profileError = result.error?.message ?? null;
    }

    const gardenId = profile?.garden_id ?? profile?.kindergarten_id ?? "";
    const data = await loadGardenFinanceData({
      supabase: supabase as any,
      gardenId,
      searchParams: {},
      debug: true
    });

    console.error("[finance-loader-ping] result", {
      hasUser: Boolean(user),
      hasProfile: Boolean(profile),
      role: profile?.role ?? null,
      gardenId: gardenId || null,
      loaderOk: data.ok,
      diagnostics: data.diagnostics?.length ?? 0,
      errors: data.errors?.length ?? 0,
      authError: authError?.message ?? null,
      profileError
    });

    return (
      <main style={{ direction: "rtl", fontFamily: "system-ui", padding: 24 }}>
        <h1>finance loader ping</h1>
        <p>user found: {user ? "yes" : "no"}</p>
        <p>profile found: {profile ? "yes" : "no"}</p>
        <p>role: {profile?.role ?? "none"}</p>
        <p>garden id: {gardenId || "none"}</p>
        <p>loader ok: {String(data.ok)}</p>
        <p>auth error: {authError?.message ?? "none"}</p>
        <p>profile error: {profileError ?? "none"}</p>
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
