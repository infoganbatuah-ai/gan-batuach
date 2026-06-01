import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import {
  loadGardenFinanceData,
  type FinanceQueryDiagnostic,
  type FinanceSearchParams
} from "@/lib/domain/garden-finance-loader";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack}` : ""}` : String(error);
}

function DiagnosticRow({ item }: { item: FinanceQueryDiagnostic }) {
  return (
    <article className="card procedure-card">
      <div>
        <span className={item.success ? "pill good" : "pill bad"}>{item.success ? "success" : "error"}</span>
        <h3>{item.label}</h3>
        <p>{item.table} · columns: {item.columns}</p>
        <small>count: {item.count} {item.error ? `· ${item.error}` : ""}</small>
      </div>
    </article>
  );
}

function DebugShell({
  role = "manager",
  gardenId,
  profileId,
  diagnostics,
  errors,
  summary,
  thrownError
}: {
  role?: "manager" | "owner";
  gardenId?: string | null;
  profileId?: string | null;
  diagnostics?: FinanceQueryDiagnostic[];
  errors?: string[];
  summary?: Record<string, string | number | boolean | null>;
  thrownError?: string | null;
}) {
  const diagnosticRows = Array.isArray(diagnostics) ? diagnostics : [];
  const errorRows = Array.isArray(errors) ? errors : [];

  return (
    <DashboardShell role={role} title="אבחון כספים">
      <section className="dashboard-hero-card garden-hero-card">
        <div>
          <p className="eyebrow">Finance Debug</p>
          <h1>אבחון מינימלי לעמוד כספים</h1>
          <p>מסלול זה לא משתמש ברכיבי כספים מורכבים. אם הוא נטען, הבעיה היא בתצוגת ה־UI הרגילה ולא בזיהוי הגן או ב-loader.</p>
        </div>
        <Link className="button secondary" href="/dashboard/garden/finance?debug=1">חזרה לכספים</Link>
      </section>

      <section className="card action-panel">
        <div className="section-heading">
          <h2>פרטי הקשר</h2>
          <p>נתונים בסיסיים בלבד, ללא סודות או פרטי תשלום רגישים.</p>
        </div>
        <div className="risk-list">
          <div><span>profile id</span><b>{profileId ?? "לא נמצא"}</b></div>
          <div><span>garden id</span><b>{gardenId ?? "לא נמצא"}</b></div>
          {summary ? Object.entries(summary).map(([key, value]) => (
            <div key={key}><span>{key}</span><b>{String(value)}</b></div>
          )) : null}
        </div>
      </section>

      {thrownError ? (
        <section className="card action-panel">
          <div className="section-heading">
            <h2>שגיאה כללית</h2>
            <p>השגיאה נתפסה בתוך עמוד האבחון כדי לא להפנות למסך שגיאה כללי.</p>
          </div>
          <pre className="debug-pre">{thrownError}</pre>
        </section>
      ) : null}

      {errorRows.length ? (
        <section className="card action-panel">
          <div className="section-heading">
            <h2>שגיאות loader</h2>
            <p>השאילתות הבאות נכשלו, אבל העמוד ממשיך לעלות.</p>
          </div>
          <div className="risk-list">
            {errorRows.map((error, index) => <div key={`error-${index}`}><span>error</span><b>{error}</b></div>)}
          </div>
        </section>
      ) : null}

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>שאילתות</h2>
          <p>כל שאילתה רצה בנפרד עם fallback.</p>
        </div>
        {diagnosticRows.length ? (
          <div className="procedure-list">
            {diagnosticRows.map((item, index) => <DiagnosticRow item={item} key={`${item.label}-${index}`} />)}
          </div>
        ) : (
          <div className="empty-state">
            <strong>לא התקבלו אבחונים</strong>
            <span>ייתכן שהטעינה נעצרה לפני הרצת ה-loader.</span>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}

export default async function FinanceDebugPage({ searchParams }: { searchParams: Promise<FinanceSearchParams> }) {
  const params: FinanceSearchParams = await searchParams.catch(() => ({}));

  try {
    const { profile } = await requireRole(["manager", "owner"]);
    const role = profile.role === "owner" ? "owner" : "manager";
    const gardenId = profile.garden_id ?? "";
    const supabase = await createClient();
    const data = await loadGardenFinanceData({
      supabase: supabase as any,
      gardenId,
      searchParams: params,
      debug: true
    });

    return (
      <DebugShell
        role={role}
        gardenId={gardenId}
        profileId={profile.id}
        diagnostics={data.diagnostics}
        errors={data.errors}
        summary={{
          loader_ok: data.ok,
          children_count: data.core?.children?.length ?? 0,
          all_children_count: data.core?.allChildren?.length ?? 0,
          fee_groups_count: data.secondary?.feeGroups?.length ?? 0,
          history_count: data.secondary?.history?.length ?? 0,
          errors_count: data.errors?.length ?? 0
        }}
      />
    );
  } catch (error) {
    const message = errorMessage(error);
    console.error("[garden-finance-debug] fallback rendered", error);
    return <DebugShell diagnostics={[]} errors={[message]} thrownError={message} />;
  }
}
