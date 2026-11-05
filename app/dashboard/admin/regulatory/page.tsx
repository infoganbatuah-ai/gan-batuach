import Link from "next/link";
import { Ban, CheckCircle2, EyeOff, FileText, GitBranch, Gavel, LockKeyhole, Scale, ShieldCheck, UserCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

function toneForScore(score: number): "default" | "good" | "warn" | "bad" {
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  if (score > 0) return "bad";
  return "default";
}

function statusTone(status?: string | null): "default" | "good" | "warn" | "bad" {
  if (status === "enabled" || status === "allowed" || status === "implemented") return "good";
  if (status === "legal_review_required" || status === "restricted" || status === "partial" || status === "draft") return "warn";
  if (status === "disabled" || status === "missing") return "bad";
  return "default";
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    enabled: "מותר",
    disabled: "כבוי",
    legal_review_required: "בדיקה משפטית",
    allowed: "מותר",
    restricted: "מוגבל",
    implemented: "מיושם",
    partial: "חלקי",
    missing: "חסר",
    draft: "טיוטה",
    retired: "הוצא משימוש",
    allowed_after_review: "מותר אחרי אישור",
    blocked: "חסום"
  };
  return labels[String(status ?? "")] ?? status ?? "לא ידוע";
}

function averageScore(rows: any[]) {
  const values = rows.map((row) => Number(row.readiness_score ?? 0)).filter((value) => value > 0);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function principleScore(rows: any[], principle: string) {
  return averageScore(rows.filter((row) => row.principle === principle));
}

export default async function AdminRegulatoryControlCenterPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("regulatory control center", async () => {
    const supabase = await createClient();
    async function query<T>(index: number, run: () => PromiseLike<{ data: T[] | null; error: unknown }>) {
      try {
        const response = await run();
        logSupabaseError(`regulatory query ${index}`, response.error);
        return { data: response.error ? [] as T[] : response.data ?? [], available: !response.error };
      } catch (error) {
        logSupabaseError(`regulatory query ${index}`, error);
        return { data: [] as T[], available: false };
      }
    }
    const [modesRes, matrixRes, registryRes, privacyRes, visibilityRes, auditRes, aiMatrixRes] = await Promise.all([
      query(0, () => supabase.from("regulatory_policy_modes" as any).select("*").order("vertical_key").order("mode_key")),
      query(1, () => supabase.from("vertical_capability_matrix" as any).select("*").order("vertical_key").order("capability_category").order("capability_name").limit(500)),
      query(2, () => supabase.from("legal_feature_registry" as any).select("*").order("feature_category").order("feature_name").limit(200)),
      query(3, () => supabase.from("privacy_by_design_controls" as any).select("*").order("principle").limit(200)),
      query(4, () => supabase.from("parent_visibility_policy_rules" as any).select("*").order("visibility_status").order("source_type").limit(120)),
      query(5, () => supabase.from("regulatory_policy_audit_events" as any).select("*").order("created_at", { ascending: false }).limit(80)),
      query(6, () => supabase.from("ai_vertical_capability_matrix" as any).select("*").order("vertical_key").limit(250))
    ]);
    const available = [modesRes, matrixRes, registryRes, privacyRes, visibilityRes, auditRes, aiMatrixRes].map((response) => response.available);
    return {
      modes: (modesRes.data ?? []) as any[],
      matrix: (matrixRes.data ?? []) as any[],
      registry: (registryRes.data ?? []) as any[],
      privacy: (privacyRes.data ?? []) as any[],
      visibility: (visibilityRes.data ?? []) as any[],
      audit: (auditRes.data ?? []) as any[],
      aiMatrix: (aiMatrixRes.data ?? []) as any[],
      available,
      queryError: available.some((known) => !known)
        ? "חלק מנתוני הרגולציה אינם זמינים. הנתונים האחרים מוצגים בנפרד."
        : null
    };
  }, {
    modes: [] as any[],
    matrix: [] as any[],
    registry: [] as any[],
    privacy: [] as any[],
    visibility: [] as any[],
    audit: [] as any[],
    aiMatrix: [] as any[],
    available: Array<boolean>(7).fill(false),
    queryError: null as string | null
  });

  const data = result.data;
  const ganMode = data.modes.find((mode: any) => mode.mode_key === "GAN_BATUACH_ISRAEL_MODE");
  const ganCapabilities = data.matrix.filter((item: any) => item.vertical_key === "gan_batuach");
  const enabled = ganCapabilities.filter((item: any) => item.capability_status === "enabled").length;
  const disabled = ganCapabilities.filter((item: any) => item.capability_status === "disabled").length;
  const legalReview = ganCapabilities.filter((item: any) => item.capability_status === "legal_review_required").length;
  const privacyScore = averageScore(data.privacy);
  const cameraCompliance = averageScore(data.registry.filter((item: any) => item.feature_category === "camera").map((item: any) => ({ readiness_score: item.legal_status === "allowed" ? 90 : 60 })));
  const aiCompliance = Math.round(((enabled + disabled) / Math.max(ganCapabilities.length, 1)) * 100);
  const parentVisibilityScore = Math.round((data.visibility.filter((item: any) => ["allowed_after_review", "blocked"].includes(item.visibility_status)).length / Math.max(data.visibility.length, 1)) * 100);
  const dataGovernanceScore = Math.round((principleScore(data.privacy, "data_minimization") + principleScore(data.privacy, "purpose_limitation") + principleScore(data.privacy, "access_limitation") + principleScore(data.privacy, "retention_limitation")) / 4);
  const readinessScore = Math.round((privacyScore + aiCompliance + parentVisibilityScore + dataGovernanceScore) / 4);
  const groupedByVertical = data.matrix.reduce((groups: Record<string, any[]>, item: any) => {
    groups[item.vertical_key] = [...(groups[item.vertical_key] ?? []), item];
    return groups;
  }, {});

  const known = (index: number) => data.available[index];
  const readinessKnown = known(1) && known(3) && known(4);
  const unavailable = "לא זמין";

  return (
    <DashboardShell role="admin" title="רגולציה">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Israeli Regulatory Mode"
          title="מרכז רגולציה, פרטיות והפעלת יכולות"
          subtitle="רשומות מדיניות ודרישות בלבד — לא הוכחת עמידה בדין הישראלי, הרשאה משפטית, אכיפת AI/שמע/פנים/ביומטריה, חשיפה להורים, הסכמה או בדיקה מקצועית. Digital Observer Core נשאר שלם; המסך אינו מפעיל יכולות."
          badge={readinessKnown ? `${readinessScore}/100` : unavailable}
          badgeTone={readinessKnown ? toneForScore(readinessScore) : "default"}
          actions={<><Link className="button primary" href="/dashboard/admin/ai-platform">פלטפורמת AI</Link><Link className="button secondary" href="/dashboard/admin/security-center">אבטחה</Link></>}
        >
          <div className="setup-checklist">
            <span>{!known(0) ? unavailable : ganMode ? `רשומת GAN_BATUACH_ISRAEL_MODE: ${statusLabel(ganMode.status)} — לא הוכחת הפעלה` : "GAN_BATUACH_ISRAEL_MODE: לא נטען"}</span>
            <span>דרישה: אין שמע, זיהוי פנים או פרופיל ביומטרי לילדים</span>
            <span>דרישה: בדיקה אנושית חובה לפני פעולה רגישה</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />

        <div className="premium-metric-grid">
          <RoleMetricCard label="מצב ישראל" value={known(0) ? (ganMode?.status ? statusLabel(ganMode.status) : "לא נטען") : unavailable} hint="GAN_BATUACH_ISRAEL_MODE" tone={known(0) ? (ganMode?.status === "enabled" ? "good" : "warn") : "default"} />
          <RoleMetricCard label="יכולות מותרות" value={known(1) ? (enabled) : unavailable} hint="Gan Batuach" tone={known(1) ? ("good") : "default"} />
          <RoleMetricCard label="יכולות כבויות" value={known(1) ? (disabled) : unavailable} hint="שמע, פנים וביומטריה" tone={known(1) ? ("bad") : "default"} />
          <RoleMetricCard label="בדיקה משפטית" value={known(1) ? (legalReview) : unavailable} hint="יכולות לא מופעלות" tone={known(1) ? (legalReview ? "warn" : "good") : "default"} />
          <RoleMetricCard label="פרטיות" value={known(3) ? (`${privacyScore}/100`) : unavailable} hint="Privacy by Design" tone={known(3) ? (toneForScore(privacyScore)) : "default"} />
          <RoleMetricCard label="AI" value={known(1) ? (`${aiCompliance}%`) : unavailable} hint="תאימות יכולות" tone={known(1) ? (toneForScore(aiCompliance)) : "default"} />
          <RoleMetricCard label="הורים" value={known(4) ? (`${parentVisibilityScore}%`) : unavailable} hint="גבולות חשיפה" tone={known(4) ? (toneForScore(parentVisibilityScore)) : "default"} />
          <RoleMetricCard label="ממשל מידע" value={known(3) ? (`${dataGovernanceScore}/100`) : unavailable} hint="מזעור, מטרה, גישה ושמירה" tone={known(3) ? (toneForScore(dataGovernanceScore)) : "default"} />
        </div>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><Ban size={20} /> דרישות — הגבלות חובה לגן בטוח</h2>
            <div className="setup-checklist">
              <span>הקלטת שמע, ניתוח שמע, מילות מפתח וזיהוי דיבור כבויים.</span>
              <span>זיהוי פנים, התאמת פנים ו-embeddings כבויים.</span>
              <span>פרופילים ביומטריים לילדים ומזהים מתמשכים כבויים ללא אישור משפטי מפורש.</span>
              <span>אין האשמות, החלטות משמעתיות או הודעות פאניקה אוטומטיות להורים.</span>
            </div>
          </article>
          <article className="card action-panel">
            <h2><CheckCircle2 size={20} /> דרישות — יכולות מותרות עם ביקורת</h2>
            <div className="setup-checklist">
              <span>Pose estimation ו-skeleton tracking ללא זיהוי מתמשך.</span>
              <span>Motion analytics, fall detection, density, restricted area ו-inactivity.</span>
              <span>Anomaly detection כהמלצה בלבד, עם בדיקה אנושית לפני הסלמה.</span>
              <span>הורים רואים רק סיכומים, אירועים והתראות שאושרו.</span>
            </div>
          </article>
        </section>

        <CleanSection title="מטריצת יכולות לפי ורטיקל" subtitle="כל יכולת מקבלת סטטוס: מותר, כבוי או בדיקה משפטית.">
          {!known(1) ? <div className="empty-mini">{unavailable}</div> : data.matrix.length === 0 ? <EmptyState title="אין מטריצת יכולות" text="לאחר הרצת המיגרציה תופיע כאן שכבת המדיניות לכל ורטיקל." /> : (
            <div className="grid cols-2 dashboard-panels">
              {Object.entries(groupedByVertical).map(([vertical, items]) => (
                <article className="card action-panel" key={vertical}>
                  <h2><GitBranch size={20} /> {String(vertical).replaceAll("_", " ")}</h2>
                  {(items as any[]).slice(0, 10).map((item: any) => (
                    <div className="list-item" key={item.id}>
                      <div>
                        <strong>{item.capability_name}</strong>
                        <span>{item.capability_category} · {item.restriction_summary ?? "מנוהל לפי מדיניות"}</span>
                      </div>
                      <StatusBadge tone={statusTone(item.capability_status)}>{statusLabel(item.capability_status)}</StatusBadge>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><EyeOff size={20} /> מדיניות חשיפה להורים</h2>
            {!known(4) ? <div className="empty-mini">{unavailable}</div> : data.visibility.length === 0 ? <div className="empty-mini">אין כללי חשיפה.</div> : data.visibility.map((rule: any) => (
              <div className="list-item" key={rule.id}>
                <div><strong>{rule.source_type}</strong><span>{rule.rule_summary}</span></div>
                <StatusBadge tone={statusTone(rule.visibility_status)}>{statusLabel(rule.visibility_status)}</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><LockKeyhole size={20} /> Privacy by Design</h2>
            {!known(3) ? <div className="empty-mini">{unavailable}</div> : data.privacy.length === 0 ? <div className="empty-mini">אין בקרות פרטיות.</div> : data.privacy.map((control: any) => (
              <div className="list-item" key={control.id}>
                <div><strong>{control.control_name}</strong><span>{control.evidence_summary}</span></div>
                <StatusBadge tone={toneForScore(Number(control.readiness_score ?? 0))}>{control.readiness_score}/100</StatusBadge>
              </div>
            ))}
          </article>
        </section>

        <CleanSection title="Legal Feature Registry" subtitle="רישום משפטי של תכונה, סטטוס, ורטיקלים מותרים והגבלות.">
          {!known(2) ? <div className="empty-mini">{unavailable}</div> : data.registry.length === 0 ? <EmptyState title="אין רישום תכונות" text="המיגרציה מוסיפה רישום משפטי ראשוני." /> : (
            <div className="procedure-list">
              {data.registry.map((feature: any) => (
                <article className="card procedure-card" key={feature.id}>
                  <div>
                    <StatusBadge tone={statusTone(feature.legal_status)}>{statusLabel(feature.legal_status)}</StatusBadge>
                    <h3>{feature.feature_name}</h3>
                    <p>{feature.restriction_summary}</p>
                    <small>מותר: {(feature.allowed_verticals ?? []).join(", ") || "אין"} · מוגבל: {(feature.restricted_verticals ?? []).join(", ") || "אין"}</small>
                  </div>
                  <div className="procedure-meta">
                    <span>{feature.feature_category}</span>
                    <StatusBadge tone={feature.approval_required ? "warn" : "good"}>{feature.approval_required ? "דורש אישור" : "ללא אישור נוסף"}</StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <CleanSection title="יומן רגולטורי" subtitle="שינויים במדיניות, יכולות והגבלות חייבים להיות מתועדים.">
          {!known(5) ? <div className="empty-mini">{unavailable}</div> : data.audit.length === 0 ? <EmptyState title="אין אירועי רגולציה" text="שינויי מדיניות עתידיים יופיעו כאן." /> : (
            <div className="procedure-list">
              {data.audit.map((event: any) => (
                <article className="card procedure-card" key={event.id}>
                  <div>
                    <StatusBadge tone={statusTone(event.event_type === "restriction_override" ? "restricted" : "enabled")}>{event.event_type}</StatusBadge>
                    <h3>{event.reason ?? event.event_key ?? "אירוע רגולטורי"}</h3>
                    <p>{event.vertical_key ?? "כללי"} · {event.capability_key ?? event.feature_key ?? "מדיניות"}</p>
                  </div>
                  <span>{event.created_at ? new Date(event.created_at).toLocaleString("he-IL") : ""}</span>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="Security Center" text="בקרות גישה, סודות וגיבוי" href="/dashboard/admin/security-center" icon={ShieldCheck} />
          <ActionCard title="AI Platform" text="מודלים, כיול ומטריצת AI" href="/dashboard/admin/ai-platform" icon={Scale} />
          <ActionCard title="Policies" text="תקנונים ואישורי משתמשים" href="/dashboard/admin/policies" icon={FileText} />
          <ActionCard title="Audit Logs" text="מעקב פעולות מערכת" href="/dashboard/admin/audit-logs" icon={Gavel} />
          <ActionCard title="Parent Safety Boundary" text="מידע מאושר בלבד" href="/dashboard/parent/ai-events" icon={UserCheck} />
        </section>
      </div>
    </DashboardShell>
  );
}
