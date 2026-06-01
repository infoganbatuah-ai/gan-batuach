export const dynamic = "force-dynamic";

export default function FinancePingPage() {
  console.error("[finance-ping] route rendered");

  return (
    <main style={{ direction: "rtl", fontFamily: "system-ui", padding: 24 }}>
      <h1>finance ping ok</h1>
      <p>Route is available without auth, Supabase, DashboardShell or finance imports.</p>
    </main>
  );
}
