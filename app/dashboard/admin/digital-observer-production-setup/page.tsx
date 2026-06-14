import Link from "next/link";
import { AlertTriangle, Camera, CheckCircle2, Cloud, CreditCard, Database, Gauge, Globe2, ListChecks, RotateCcw, ShieldCheck } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function pill(status?: string | null) {
  const value = String(status ?? "");
  if (["ready", "ready_for_review", "passed"].includes(value)) return "pill good";
  if (["planned", "disabled_by_default", "future_only", "not_tested", "needs_review"].includes(value)) return "pill warn";
  if (["blocked", "failed"].includes(value)) return "pill bad";
  return "pill";
}

function avg(items: any[]) {
  if (!items.length) return 0;
  return Math.round(items.reduce((sum, item) => sum + Number(item.readiness_score ?? 0), 0) / items.length);
}

export default async function AdminDigitalObserverProductionSetupPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("digital observer production setup", async () => {
    const supabase = await createClient();
    const [setup, envs, qa, separation, risks, rollback] = await Promise.all([
      supabase.from("digital_observer_production_setup_readiness" as any).select("*").order("area").limit(100),
      supabase.from("digital_observer_production_env_readiness" as any).select("*").order("env_group").order("env_key").limit(100),
      supabase.from("digital_observer_production_qa_checks" as any).select("*").order("product_type").order("check_area").limit(120),
      supabase.from("digital_observer_separation_decisions" as any).select("*").order("updated_at", { ascending: false }).limit(1),
      supabase.from("digital_observer_extraction_risks" as any).select("*").order("severity").limit(80),
      supabase.from("digital_observer_rollback_plans" as any).select("*").order("rollback_key").limit(50)
    ]);
    [setup, envs, qa, separation, risks, rollback].forEach((query, index) => logSupabaseError("digital observer production setup query " + index, query.error));
    return {
      setup: setup.data ?? [],
      envs: envs.data ?? [],
      qa: qa.data ?? [],
      separation: separation.data?.[0] ?? null,
      risks: risks.data ?? [],
      rollback: rollback.data ?? [],
      queryError: setup.error ? "לא ניתן לטעון נתוני production setup כרגע" : null
    };
  }, { setup: [] as any[], envs: [] as any[], qa: [] as any[], separation: null as any, risks: [] as any[], rollback: [] as any[], queryError: null as string | null });

  const data = result.data;
  const score = avg(data.setup);
  const byArea = Object.fromEntries(data.setup.map((item) => [item.area, item]));
  const blockers = data.setup.filter((item) => item.status === "blocked" || item.blocker).length + data.risks.filter((risk) => ["critical", "high"].includes(risk.severity) && risk.status === "open").length;
  const qaReady = data.qa.filter((item) => item.status === "passed").length;
  const qaTotal = data.qa.length;

  return (
    <DashboardShell role="admin" title="Digital Observer Production Setup">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Separate production setup</p>
          <h1>Digital Observer production separation readiness.</h1>
          <p>מכין דומיין, Vercel, env, Supabase strategy, billing, QA ו־rollback בלי ליצור משאבים חיצוניים ובלי להסיר את /digital-observer.</p>
        </div>
        <div className="hero-actions">
          <Link className="button primary" href="/dashboard/admin/digital-observer-separation">Separation decision</Link>
          <Link className="button secondary" href="/digital-observer">Public site</Link>
        </div>
      </div>
      <AdminDataError message={result.error ?? data.queryError} />

      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><Gauge /><strong>{score}/100</strong><span>setup readiness</span></article>
        <article className="metric-card"><Globe2 /><strong>{byArea.domain?.readiness_score ?? 0}/100</strong><span>domain readiness</span></article>
        <article className="metric-card"><Cloud /><strong>{byArea.vercel?.readiness_score ?? 0}/100</strong><span>Vercel readiness</span></article>
        <article className="metric-card"><Database /><strong>{byArea.supabase?.readiness_score ?? 0}/100</strong><span>Supabase readiness</span></article>
        <article className="metric-card"><ShieldCheck /><strong>{byArea.environment?.readiness_score ?? 0}/100</strong><span>environment readiness</span></article>
        <article className="metric-card"><CreditCard /><strong>{byArea.billing?.readiness_score ?? 0}/100</strong><span>billing separation</span></article>
        <article className="metric-card"><ListChecks /><strong>{qaReady}/{qaTotal}</strong><span>QA passed</span></article>
        <article className="metric-card"><AlertTriangle /><strong>{blockers}</strong><span>blockers</span></article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Recommended mode</h2><p>Uses the Phase 182 decision. Full split is not assumed.</p></div>
          <div className="risk-list">
            <div>Phase 182 decision <b><span className={pill(data.separation?.decision_state)}>{data.separation?.decision_state ?? "keep_inside_gan_batuach"}</span></b></div>
            <div>Current mode <b>/digital-observer inside Gan Batuach</b></div>
            <div>Next safe mode <b>domain-only or separate Vercel after beta validation</b></div>
            <div>Supabase split <b>future only</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Production safety flags</h2><p>All production switches default to false.</p></div>
          <div className="risk-list">
            {data.envs.filter((env) => env.env_key.includes("ENABLED")).map((env) => (
              <div key={env.id}>{env.env_key} <b>{env.default_value ?? "unset"}</b></div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Setup readiness</h2><p>Domain, Vercel, Supabase, env, billing, gateway, deployment, QA, rollback and product context.</p></div>
        <div className="procedure-list">
          {data.setup.map((item) => (
            <article className="card procedure-card" key={item.id}>
              <div>
                <span className={pill(item.status)}>{item.status}</span>
                <span className="pill">{item.area}</span>
                <h3>{item.title}</h3>
                <p>{item.next_action}</p>
                <small>{item.blocker ?? "No blocker recorded"}</small>
              </div>
              <div className="procedure-meta"><strong>{item.readiness_score}/100</strong><span>{item.selected_mode}</span></div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <Globe2 />
          <h2>Domain setup readiness</h2>
          <p>Prepare marketing/app/admin/support domains, DNS, SSL, redirects and rollback. No actual DNS change is required.</p>
          <div className="setup-checklist">
            <span>observer.gan-batuach.co.il</span>
            <span>digital-observer.co.il</span>
            <span>app.digitalobserver.ai</span>
            <span>app.digital-observer.co.il</span>
          </div>
        </article>
        <article className="card action-panel">
          <RotateCcw />
          <h2>Rollback readiness</h2>
          <div className="risk-list">
            {data.rollback.map((item) => <div key={item.id}>{item.rollback_step} <b>{item.status}</b></div>)}
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <CheckCircle2 />
          <h2>Environment readiness</h2>
          <div className="risk-list">
            {data.envs.slice(0, 18).map((env) => <div key={env.id}>{env.env_key} <b>{env.status}</b></div>)}
          </div>
        </article>
        <article className="card action-panel">
          <Camera />
          <h2>Camera gateway readiness</h2>
          <p>Keep shared gateway for now. Assess separate gateway, credential isolation and bandwidth before paid scale.</p>
          <span className={pill(byArea.camera_gateway?.status)}>{byArea.camera_gateway?.selected_mode ?? "shared_gateway_now"}</span>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Separated setup QA</h2><p>Gan Batuach must stay healthy while Digital Observer routes are tested.</p></div>
        <div className="procedure-list">
          {data.qa.map((item) => (
            <article className="card procedure-card" key={item.id}>
              <div>
                <span className={pill(item.status)}>{item.status}</span>
                <span className="pill">{item.product_type}</span>
                <h3>{item.route_or_flow}</h3>
                <p>{item.expected_result}</p>
              </div>
              <div className="procedure-meta"><span>{item.check_area}</span></div>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
