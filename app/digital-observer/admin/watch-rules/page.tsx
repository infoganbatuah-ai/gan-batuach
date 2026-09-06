import { Braces, CheckCircle2, Radar, ShieldCheck, XCircle } from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { createDigitalObserverAdminDataClient, requireDigitalObserverAdmin } from "@/lib/domain/digital-observer/admin-access";
import { formatObserverDate } from "@/lib/domain/digital-observer/runtime";

type Row = Record<string, unknown>;

export default async function DigitalObserverWatchRuleAdminPage() {
  const { profile } = await requireDigitalObserverAdmin("/digital-observer/admin/watch-rules");
  const db = createDigitalObserverAdminDataClient();
  const [rulesResult, versionsResult, evaluationsResult, sitesResult] = await Promise.all([
    db.from("observer_watch_requests" as never)
      .select("id,observer_site_id,camera_source_id,title,active,original_natural_language,structured_rule,validation_status,compiler_version,rule_version,rule_state,last_matched_at,match_count,metadata,created_at,updated_at")
      .not("compiler_version", "is", null).order("updated_at", { ascending: false }).limit(300),
    db.from("digital_observer_watch_rule_versions" as never)
      .select("id,rule_id,version,change_type,compiler_version,candidate_fingerprint,environment,created_at")
      .order("created_at", { ascending: false }).limit(1000),
    db.from("digital_observer_watch_rule_evaluations" as never)
      .select("id,rule_id,rule_version,event_id,incident_id,risk_evaluation_id,matched,matched_conditions,non_match_reasons,evaluation_version,event_provenance,evaluated_at")
      .order("evaluated_at", { ascending: false }).limit(1000),
    db.from("observer_sites" as never).select("id,name").is("garden_id", null).neq("site_type", "kindergarten").limit(500)
  ]);
  const failed = [rulesResult, versionsResult, evaluationsResult, sitesResult].some((result) => result.error);
  const rules = (rulesResult.data ?? []) as Row[];
  const versions = (versionsResult.data ?? []) as Row[];
  const evaluations = (evaluationsResult.data ?? []) as Row[];
  const siteNames = new Map(((sitesResult.data ?? []) as Row[]).map((site) => [String(site.id), String(site.name)]));
  const versionsByRule = new Map<string, Row[]>();
  const evaluationsByRule = new Map<string, Row[]>();
  for (const version of versions) versionsByRule.set(String(version.rule_id), [...(versionsByRule.get(String(version.rule_id)) ?? []), version]);
  for (const evaluation of evaluations) evaluationsByRule.set(String(evaluation.rule_id), [...(evaluationsByRule.get(String(evaluation.rule_id)) ?? []), evaluation]);

  return <ObserverAppShell profile={profile} mode="admin" activeHref="/digital-observer/admin/watch-rules" title="כללי ניטור" statusLabel="מהדר מוגבל ומבוקר">
    <div className="do-page-stack">
      {failed ? <div className="do-notice warn"><XCircle /><span>חלק מנתוני הכללים אינם זמינים. לא מוצג סטטוס חלופי מומצא.</span></div> : null}
      <section className="do-business-summary">
        <article className="do-metric"><Radar /><strong>{rules.length}</strong><span>כללים מהודרים</span></article>
        <article className="do-metric"><CheckCircle2 /><strong>{rules.filter((rule) => rule.rule_state === "ACTIVE").length}</strong><span>פעילים</span></article>
        <article className="do-metric"><Braces /><strong>{versions.length}</strong><span>גרסאות שמורות</span></article>
        <article className="do-metric"><ShieldCheck /><strong>{evaluations.filter((item) => item.matched === true).length}</strong><span>התאמות אמת</span></article>
      </section>
      <div className="do-notice info"><ShieldCheck /><span><strong>Natural Language הוא קלט בלבד</strong><small>הטקסט אינו קוד ואינו מבצע פעולות. כל כלל נשמר כ־JSON מוגבל, עובר validation, דורש אישור ונבדק רק מול REAL_CAMERA_AI.</small></span></div>
      {rules.length ? <section className="do-page-stack">{rules.map((rule) => {
        const ruleVersions = versionsByRule.get(String(rule.id)) ?? [];
        const ruleEvaluations = evaluationsByRule.get(String(rule.id)) ?? [];
        const latest = ruleEvaluations[0];
        return <article className="do-panel" key={String(rule.id)}>
          <div className="do-section-head"><div><h2>{String(rule.title)}</h2><p>{siteNames.get(String(rule.observer_site_id)) ?? String(rule.observer_site_id)}</p></div><span className={rule.rule_state === "ACTIVE" ? "do-badge good" : "do-badge warn"}>{String(rule.rule_state)}</span></div>
          <div className="do-summary-list">
            <div><span>טקסט מקורי</span><strong>{String(rule.original_natural_language)}</strong></div>
            <div><span>Validation</span><strong>{String(rule.validation_status)}</strong></div>
            <div><span>מהדר / גרסה</span><strong>{String(rule.compiler_version)} · v{String(rule.rule_version)}</strong></div>
            <div><span>התאמות</span><strong>{String(rule.match_count ?? 0)}</strong></div>
            <div><span>התאמה אחרונה</span><strong>{rule.last_matched_at ? formatObserverDate(String(rule.last_matched_at)) : "אין"}</strong></div>
          </div>
          <details className="do-observer-insight-disclosure"><summary><span><Braces /><b>JSON מובנה ופתרון ישויות</b><small>לבדיקת Admin בלבד</small></span></summary><pre>{JSON.stringify(rule.structured_rule, null, 2)}</pre></details>
          <div className="do-grid cols-2">
            <div><h3>היסטוריית גרסאות</h3><div className="do-row-list">{ruleVersions.slice(0, 8).map((version) => <div className="do-row" key={String(version.id)}><Braces /><span className="do-row-main"><strong>גרסה {String(version.version)} · {String(version.change_type)}</strong><small>{String(version.compiler_version)} · {String(version.environment)}</small></span><time>{formatObserverDate(String(version.created_at))}</time></div>)}</div></div>
            <div><h3>הערכה אחרונה</h3>{latest ? <div className="do-summary-list"><div><span>תוצאה</span><strong>{latest.matched === true ? "MATCH" : "NO MATCH"}</strong></div><div><span>Event</span><strong>{String(latest.event_id)}</strong></div><div><span>סיבות</span><strong>{JSON.stringify(latest.matched === true ? latest.matched_conditions : latest.non_match_reasons)}</strong></div><div><span>Evaluator</span><strong>{String(latest.evaluation_version)}</strong></div></div> : <div className="do-empty compact"><Radar /><strong>עדיין לא נבדק מול Event חדש</strong></div>}</div>
          </div>
        </article>;
      })}</section> : <div className="do-empty"><Radar /><strong>אין עדיין כללים מהודרים</strong></div>}
    </div>
  </ObserverAppShell>;
}
