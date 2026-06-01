import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default async function FinanceAuthPingPage() {
  console.error("[finance-auth-ping] route started");

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    console.error("[finance-auth-ping] auth result", { hasUser: Boolean(user), userId: user?.id ?? null, error: error?.message ?? null });

    return (
      <main style={{ direction: "rtl", fontFamily: "system-ui", padding: 24 }}>
        <h1>finance auth ping</h1>
        <p>user id: {user?.id ?? "not found"}</p>
        <p>auth error: {error?.message ?? "none"}</p>
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
