import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatError(error: unknown) {
  return error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack}` : ""}` : String(error);
}

export default async function FinanceGardenPingPage() {
  console.error("[finance-garden-ping] route started");

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

    const gardenId = profile?.garden_id ?? profile?.kindergarten_id ?? null;

    console.error("[finance-garden-ping] result", {
      hasUser: Boolean(user),
      userId: user?.id ?? null,
      hasProfile: Boolean(profile),
      role: profile?.role ?? null,
      gardenId,
      authError: authError?.message ?? null,
      profileError
    });

    return (
      <main style={{ direction: "rtl", fontFamily: "system-ui", padding: 24 }}>
        <h1>finance garden ping</h1>
        <p>user found: {user ? "yes" : "no"}</p>
        <p>profile found: {profile ? "yes" : "no"}</p>
        <p>role: {profile?.role ?? "none"}</p>
        <p>garden id: {gardenId ?? "none"}</p>
        <p>auth error: {authError?.message ?? "none"}</p>
        <p>profile error: {profileError ?? "none"}</p>
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
