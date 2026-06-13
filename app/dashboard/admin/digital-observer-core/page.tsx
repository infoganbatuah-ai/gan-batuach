import Link from "next/link";
import { AlertTriangle, BrainCircuit, Camera, Database, GitBranch, Layers3, Package, Route, ShieldCheck, Workflow } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildObserverCoreSummary } from "@/lib/domain/digital-observer-core";

type Row = Record<string, any>;
type Tone = "default" | "good" | "warn" | "bad";

function toneForScore(score: number): Tone {
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  return "bad";
}

function statusTone(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["enabled", "active", "existing", "mapped", "extract_ready", "allowed"].includes(value)) return "good";
  if (["future", "planned", "restricted", "legal_review_required", "draft", "discovery"].includes(value)) return "warn";
  if (["disabled", "blocked", "retired"].includes(value)) return "bad";
  return "default";
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    enabled: "פעיל",
    disabled: "כבוי",
    restricted: "מוגבל",
    legal_review_required: "בדיקה משפטית",
    active: "פעיל",
    future: "עתידי",
    draft: "טיוטה",
    existing: "קיים",
    mapped: "מופה",
    extract_ready: "מוכן להפרדה",
    planned: "מתוכנן",
    blocked: "חסום",
    discovery: "בחינה"
  };
  return labels[String(status ?? "")] ?? status ?? "לא ידוע";
}

async function safeQuery<T>(label: string, run: () => any) {
  try {
    const result = await run() as { data: T[] | null; error: any };
    logSupabaseError(label, result.error);
    return result.error ? [] : result.data ?? [];
  } catch (error) {
    logSupabaseError(label, error);
    return [];
  }
}

function englishName(value?: string | null) {
  return String(value ?? "").replaceAll("_", " ");
}

export default async function DigitalObserverCorePage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("digital observer core", async () => {
    const supabase = await createClient();
    const [capabilities, profiles, services, packages, policies, boundaries, roadmap, matrix] = await Promise.all([
      safeQuery<Row>("observer core capabilities", () => supabase.from("digital_observer_core_capabilities" as any).select("*").order("core_module").order("capability_name").limit(300)),
      safeQuery<Row>("observer vertical profiles", () => supabase.from("observer_vertical_profiles" as any).select("*").order("profile_status").order("vertical_key").limit(80)),
      safeQuery<Row>("observer core services", () => supabase.from("observer_core_services_registry" as any).select("*").order("service_type").order("service_name").limit(120)),
      safeQuery<Row>("observer shared packages", () => supabase.from("observer_shared_package_mapping" as any).select("*").order("extraction_priority").order("package_key").limit(80)),
      safeQuery<Row>("observer cross vertical policies", () => supabase.from("observer_cross_vertical_policies" as any).select("*").order("feature_key").limit(120)),
      safeQuery<Row>("observer data boundaries", () => supabase.from("observer_data_boundary_map" as any).select("*").order("boundary_type").order("data_domain").limit(120)),
      safeQuery<Row>("observer roadmap", () => supabase.from("observer_roadmap_registry" as any).select("*").order("vertical_key").order("module_name").limit(120)),
      safeQuery<Row>("vertical capability matrix observer core", () => supabase.from("vertical_capability_matrix" as any).select("*").in("vertical_key", ["digital_observer_core", "gan_batuach", "school_safe", "business_observer", "home_observer", "municipality_observer", "enterprise_observer"]).order("vertical_key").order("capability_name").limit(350))
    ]);
    return { capabilities, profiles, services, packages, policies, boundaries, roadmap, matrix };
  }, {
    capabilities: [] as Row[],
    profiles: [] as Row[],
    services: [] as Row[],
    packages: [] as Row[],
    policies: [] as Row[],
    boundaries: [] as Row[],
    roadmap: [] as Row[],
    matrix: [] as Row[]
  });

  const data = result.data;
  const summary = buildObserverCoreSummary({
    capabilities: data.capabilities,
    profiles: data.profiles,
    services: data.services,
    policies: data.policies,
    roadmap: data.roadmap
  });
  const legalReviewItems = data.matrix.filter((item) => item.capability_status === "legal_review_required" || item.legal_status === "legal_review_required");
  const restrictedItems = data.matrix.filter((item) => item.capability_status === "restricted" || item.legal_status === "restricted");
  const groupedMatrix = data.matrix.reduce((groups: Record<string, Row[]>, item) => {
    groups[item.vertical_key] = [...(groups[item.vertical_key] ?? []), item];
    return groups;
  }, {});

  return (
    <DashboardShell role="admin" title="Digital Observer Core">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Digital Observer Core"
          title="מרכז הפרדת תצפיתן דיגיטלי לוורטיקלים"
          subtitle="מפת יכולות שמכינה את Digital Observer Core להיות פלטפורמת מודיעין עצמאית, בלי לשבור את Gan Batuach ובלי לשכפל קוד."
          badge={`${summary.readinessScore}/100`}
          badgeTone={toneForScore(summary.readinessScore)}
          actions={<><Link className="button primary" href="/dashboard/admin/regulatory">רגולציה</Link><Link className="button secondary" href="/dashboard/admin/ai-governance">ממשל AI</Link></>}
        >
          <div className="setup-checklist">
            <span>אין ריפו חדש בשלב הזה</span>
            <span>אין העתקת קוד</span>
            <span>Gan Batuach נשאר מצב גן ישראלי מפוקח</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="יכולות Core" value={summary.totalCapabilities} hint={`${summary.reusableCapabilities} ניתנות לשימוש חוזר`} tone="good" />
          <RoleMetricCard label="מיפוי הפרדה" value={`${summary.extractReadyCount}/${summary.totalCapabilities}`} hint="קיים, מופה או מוכן" tone={toneForScore(Math.round((summary.extractReadyCount / Math.max(summary.totalCapabilities, 1)) * 100))} />
          <RoleMetricCard label="שירותים" value={summary.mappedServices} hint="AI, מצלמות, Workflow ועוד" tone="good" />
          <RoleMetricCard label="פרופילים" value={`${summary.activeProfiles + summary.futureProfiles}/${data.profiles.length}`} hint="Gan Batuach + עתידיים" tone="good" />
          <RoleMetricCard label="Gan Batuach פעיל" value={summary.ganBatuachEnabled} hint="יכולות מאושרות בפרופיל" tone="good" />
          <RoleMetricCard label="Gan Batuach כבוי" value={summary.ganBatuachDisabled} hint="שמע, פנים, ביומטריה" tone="bad" />
          <RoleMetricCard label="מוגבל" value={restrictedItems.length || summary.restrictedCount} hint="דורש מדיניות" tone="warn" />
          <RoleMetricCard label="בדיקה משפטית" value={legalReviewItems.length || summary.legalReviewCount} hint="לא מופעל אוטומטית" tone="warn" />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><ShieldCheck size={20} /> Gan Batuach Profile</h2>
            <div className="setup-checklist">
              <span>מופעל: פיקוח, ציות, פורטל הורים, ציר זמן ילד, Pose ו-Motion analytics.</span>
              <span>כבוי: שמע, זיהוי פנים, ביומטריה בלתי מוגבלת.</span>
              <span>מוגבל: soft biometrics, gait analytics ומעקב זהות מתמשך.</span>
              <span>כל אירוע רגיש נשאר תחת בדיקה אנושית.</span>
            </div>
          </article>
          <article className="card action-panel">
            <h2><Layers3 size={20} /> Future Architecture</h2>
            <div className="setup-checklist">
              <span>apps/gan-batuach נשאר היישום המוסדר לגני ילדים.</span>
              <span>apps/digital-observer מתוכנן כמוצר עתידי בלבד.</span>
              <span>packages/observer-core, camera-core, ai-core, workflow-core, audit-core, analytics-core, ui-core ממופים.</span>
              <span>הפרדה בפועל תבוצע רק אחרי בדיקות חוזים, RLS ו־privacy boundaries.</span>
            </div>
          </article>
        </section>

        <CleanSection title="Core Capability Inventory" subtitle="כל היכולות שניתן להפוך בעתיד לליבה משותפת, עם גבול מידע ויעד חבילה.">
          {data.capabilities.length === 0 ? <EmptyState title="אין מלאי יכולות" text="לאחר הרצת המיגרציה יופיע כאן מיפוי Digital Observer Core." /> : (
            <div className="procedure-list">
              {data.capabilities.map((capability) => (
                <article className="card procedure-card" key={capability.id}>
                  <div>
                    <StatusBadge tone={statusTone(capability.implementation_status)}>{statusLabel(capability.implementation_status)}</StatusBadge>
                    <h3>{capability.capability_name}</h3>
                    <p>{capability.extraction_notes}</p>
                    <small>{capability.core_module} · {capability.future_package_key ?? "ללא חבילה"} · {statusLabel(capability.data_boundary)}</small>
                  </div>
                  <div className="procedure-meta">
                    <span>{capability.capability_category}</span>
                    <StatusBadge tone={capability.reusable ? "good" : "warn"}>{capability.reusable ? "Reusable" : "Vertical"}</StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="camera-infra-grid">
          <CleanSection title="Vertical Capability Matrix" subtitle="מה פעיל, כבוי, מוגבל או דורש בדיקה בכל ורטיקל.">
            {Object.keys(groupedMatrix).length === 0 ? <EmptyState title="אין מטריצה" text="המיגרציה מרחיבה את המטריצה הקיימת במקום ליצור כפילות." /> : (
              <div className="camera-infra-list">
                {Object.entries(groupedMatrix).map(([vertical, items]) => (
                  <article className="camera-infra-row" key={vertical}>
                    <div>
                      <strong>{englishName(vertical)}</strong>
                      <span>{items.length} יכולות · {items.filter((item) => item.capability_status === "enabled").length} פעילות · {items.filter((item) => ["restricted", "legal_review_required"].includes(item.capability_status)).length} מוגבלות</span>
                    </div>
                    <StatusBadge tone={vertical === "gan_batuach" ? "good" : "warn"}>{vertical === "gan_batuach" ? "פעיל" : "עתידי"}</StatusBadge>
                  </article>
                ))}
              </div>
            )}
          </CleanSection>

          <CleanSection title="Vertical Profiles" subtitle="פרופילים שמגדירים יכולות מותרות, כבויות ומוגבלות.">
            <div className="camera-infra-list">
              {data.profiles.map((profile) => (
                <article className="camera-infra-row" key={profile.id}>
                  <div>
                    <strong>{profile.display_name}</strong>
                    <span>{profile.description}</span>
                  </div>
                  <StatusBadge tone={statusTone(profile.profile_status)}>{statusLabel(profile.profile_status)}</StatusBadge>
                  <StatusBadge tone="default">{(profile.allowed_capabilities ?? []).length} enabled</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="camera-infra-grid">
          <CleanSection title="Core Services Registry" subtitle="שירותים שיישארו תחילה בתוך Gan Batuach וממופים להפרדה עתידית.">
            <div className="camera-infra-list">
              {data.services.map((service) => (
                <article className="camera-infra-row" key={service.id}>
                  <div><strong>{service.service_name}</strong><span>{service.service_summary} · {service.current_module_path}</span></div>
                  <StatusBadge tone={statusTone(service.extraction_status)}>{statusLabel(service.extraction_status)}</StatusBadge>
                  <StatusBadge tone="default">{service.future_package_key}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Shared Package Mapping" subtitle="החבילות העתידיות, בלי לבצע extraction בפועל בשלב הזה.">
            <div className="camera-infra-list">
              {data.packages.map((pkg) => (
                <article className="camera-infra-row" key={pkg.id}>
                  <div><strong>{pkg.package_name}</strong><span>{pkg.future_path} · {(pkg.included_modules ?? []).join(", ")}</span></div>
                  <StatusBadge tone={statusTone(pkg.status)}>{statusLabel(pkg.status)}</StatusBadge>
                  <StatusBadge tone="default">P{pkg.extraction_priority}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><Database size={20} /> Data Boundary Mapping</h2>
            {data.boundaries.map((boundary) => (
              <div className="list-item" key={boundary.id}>
                <div><strong>{boundary.data_domain}</strong><span>{boundary.sharing_rule}</span></div>
                <StatusBadge tone={boundary.contains_child_data || boundary.contains_biometric_data ? "bad" : boundary.contains_pii ? "warn" : "good"}>{statusLabel(boundary.boundary_type)}</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><AlertTriangle size={20} /> Cross-Vertical Policy</h2>
            {data.policies.map((policy) => (
              <div className="list-item" key={policy.id}>
                <div><strong>{policy.feature_key}</strong><span>{policy.restriction_summary}</span></div>
                <StatusBadge tone={statusTone(policy.policy_status)}>{statusLabel(policy.policy_status)}</StatusBadge>
              </div>
            ))}
          </article>
        </section>

        <CleanSection title="Observer Roadmap Registry" subtitle="מודולים עתידיים נשמרים כמפת דרך בלבד.">
          {data.roadmap.length === 0 ? <EmptyState title="אין מפת דרך" text="מודולים עתידיים כמו School Safe ו-Business Observer יופיעו כאן." /> : (
            <div className="premium-action-grid">
              {data.roadmap.map((item) => (
                <article className="premium-action-card" key={item.id}>
                  <Route size={22} />
                  <strong>{item.module_name}</strong>
                  <span>{englishName(item.vertical_key)} · {item.dependency_summary}</span>
                  <StatusBadge tone={statusTone(item.roadmap_status)}>{statusLabel(item.roadmap_status)}</StatusBadge>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="Camera Core" text="מצלמות, Gateway ושידור מאובטח" href="/dashboard/admin/camera-infrastructure" icon={Camera} />
          <ActionCard title="AI Core" text="מודלים, כיול וממשל" href="/dashboard/admin/ai-platform" icon={BrainCircuit} />
          <ActionCard title="Workflow Core" text="משימות ותהליכים" href="/dashboard/admin/workflows" icon={Workflow} />
          <ActionCard title="Audit Core" text="יומן פעולות ורגולציה" href="/dashboard/admin/audit-logs" icon={ShieldCheck} />
          <ActionCard title="Analytics Core" text="מגמות והשוואות" href="/dashboard/admin/analytics-center" icon={GitBranch} />
          <ActionCard title="Package Plan" text="מיפוי חבילות עתידיות" href="/dashboard/admin/observer-packages" icon={Package} />
        </section>
      </div>
    </DashboardShell>
  );
}
