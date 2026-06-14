import Link from "next/link";
import { Bell, Camera, ClipboardCheck, FileCheck2, Image, Link2, LockKeyhole, Smartphone, Store, TabletSmartphone } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, any>;
type Tone = "default" | "good" | "warn" | "bad";

async function safeQuery<T>(label: string, run: () => any) {
  try {
    const result = (await run()) as { data: T[] | null; error: any };
    logSupabaseError(label, result.error);
    return result.error ? [] : result.data ?? [];
  } catch (error) {
    logSupabaseError(label, error);
    return [];
  }
}

function label(value?: string | null) {
  return String(value ?? "לא ידוע").replaceAll("_", " ");
}

function toneForStatus(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["ready", "approved", "documented", "prepared", "ready_for_test", "ready_for_review", "ready_for_internal_test", "internal_testing_ready", "captured", "passed"].includes(value)) return "good";
  if (["preparing", "draft", "needs_review", "needs_legal_review", "planned", "not_tested", "future_ready", "needs_setup"].includes(value)) return "warn";
  if (["blocked", "missing", "failed", "should_not_request", "not_ready"].includes(value)) return "bad";
  return "default";
}

function scoreTone(score: number): Tone {
  if (score >= 82) return "good";
  if (score >= 58) return "warn";
  return "bad";
}

function percent(done: number, total: number) {
  return total ? Math.round((done / total) * 100) : 0;
}

export default async function MobileReleasePage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("mobile release readiness", async () => {
    const supabase = await createClient();
    const [scores, architecture, platforms, capacitor, permissions, explanations, push, privacyLabels, dataSafety, sensitiveReview, metadata, screenshots, branding, builds, channels, testflight, googleTesting, reviewNotes, demoAccounts, legalLinks, qa, diagnostics] = await Promise.all([
      safeQuery<Row>("mobile release readiness scores", () => supabase.from("mobile_release_readiness_scores" as any).select("*").order("calculated_at", { ascending: false }).limit(1)),
      safeQuery<Row>("mobile architecture reviews", () => supabase.from("mobile_architecture_reviews" as any).select("*").order("architecture_area").limit(30)),
      safeQuery<Row>("mobile store platform readiness", () => supabase.from("mobile_store_platform_readiness" as any).select("*").order("platform").limit(10)),
      safeQuery<Row>("capacitor configuration audit", () => supabase.from("capacitor_configuration_audit" as any).select("*").order("config_area").limit(40)),
      safeQuery<Row>("mobile native permissions inventory", () => supabase.from("mobile_native_permissions_inventory" as any).select("*").order("permission_name").limit(80)),
      safeQuery<Row>("mobile permission explanations", () => supabase.from("mobile_permission_explanations" as any).select("*").order("permission_type").limit(30)),
      safeQuery<Row>("mobile push release readiness", () => supabase.from("mobile_push_release_readiness" as any).select("*").order("capability").limit(50)),
      safeQuery<Row>("mobile store privacy labels", () => supabase.from("mobile_store_privacy_labels" as any).select("*").order("data_category").limit(80)),
      safeQuery<Row>("google play data safety", () => supabase.from("google_play_data_safety_items" as any).select("*").order("data_category").limit(80)),
      safeQuery<Row>("mobile child sensitive data review", () => supabase.from("mobile_child_sensitive_data_review" as any).select("*").order("data_area").limit(40)),
      safeQuery<Row>("mobile store metadata", () => supabase.from("mobile_store_metadata_items" as any).select("*").order("locale").order("field_name").limit(80)),
      safeQuery<Row>("mobile screenshot plan", () => supabase.from("mobile_screenshot_plan" as any).select("*").order("target_role").limit(80)),
      safeQuery<Row>("mobile branding readiness", () => supabase.from("mobile_branding_readiness" as any).select("*").order("asset_type").limit(40)),
      safeQuery<Row>("mobile build pipeline readiness", () => supabase.from("mobile_build_pipeline_readiness" as any).select("*").order("platform").order("build_type").limit(60)),
      safeQuery<Row>("mobile release channels", () => supabase.from("mobile_release_channels" as any).select("*").order("platform").order("release_stage").limit(60)),
      safeQuery<Row>("testflight readiness", () => supabase.from("testflight_readiness" as any).select("*").order("item").limit(30)),
      safeQuery<Row>("google internal testing readiness", () => supabase.from("google_internal_testing_readiness" as any).select("*").order("item").limit(30)),
      safeQuery<Row>("mobile store review notes", () => supabase.from("mobile_store_review_notes" as any).select("*").order("note_area").limit(50)),
      safeQuery<Row>("mobile demo account pack", () => supabase.from("mobile_demo_account_pack" as any).select("*").order("role_key").limit(20)),
      safeQuery<Row>("mobile legal link readiness", () => supabase.from("mobile_legal_link_readiness" as any).select("*").order("link_type").limit(40)),
      safeQuery<Row>("mobile release qa checklist", () => supabase.from("mobile_release_qa_checklist" as any).select("*").order("role_key").order("workflow").limit(80)),
      safeQuery<Row>("mobile crash diagnostics readiness", () => supabase.from("mobile_crash_diagnostics_readiness" as any).select("*").order("provider_option").limit(20))
    ]);
    return { scores, architecture, platforms, capacitor, permissions, explanations, push, privacyLabels, dataSafety, sensitiveReview, metadata, screenshots, branding, builds, channels, testflight, googleTesting, reviewNotes, demoAccounts, legalLinks, qa, diagnostics };
  }, {
    scores: [] as Row[],
    architecture: [] as Row[],
    platforms: [] as Row[],
    capacitor: [] as Row[],
    permissions: [] as Row[],
    explanations: [] as Row[],
    push: [] as Row[],
    privacyLabels: [] as Row[],
    dataSafety: [] as Row[],
    sensitiveReview: [] as Row[],
    metadata: [] as Row[],
    screenshots: [] as Row[],
    branding: [] as Row[],
    builds: [] as Row[],
    channels: [] as Row[],
    testflight: [] as Row[],
    googleTesting: [] as Row[],
    reviewNotes: [] as Row[],
    demoAccounts: [] as Row[],
    legalLinks: [] as Row[],
    qa: [] as Row[],
    diagnostics: [] as Row[]
  });

  const data = result.data;
  const score = data.scores[0];
  const overall = Number(score?.overall_readiness ?? 0);
  const ios = data.platforms.find((platform) => platform.platform === "ios");
  const android = data.platforms.find((platform) => platform.platform === "android");
  const screenshotReady = data.screenshots.filter((item) => ["captured", "approved"].includes(String(item.status))).length;
  const metadataReady = data.metadata.filter((item) => ["ready_for_review", "approved"].includes(String(item.status))).length;
  const privacyNeedsLegal = data.privacyLabels.filter((item) => item.status === "needs_legal_review").length + data.dataSafety.filter((item) => item.status === "needs_legal_review").length;
  const blockedQa = data.qa.filter((item) => ["failed", "blocked"].includes(String(item.status))).length;
  const releaseBlockers = Array.isArray(score?.release_blockers) ? score.release_blockers : [];

  return (
    <DashboardShell role="admin" title="Mobile Release">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="App Store / Google Play Readiness"
          title="מוכנות הגשה לאפל וגוגל"
          subtitle="מרכז אחד למוכנות iOS, Android, Capacitor, הרשאות, Push, Privacy Labels, Data Safety, צילומי מסך, build pipeline וחשבונות דמו. אין כאן הגשה או פרסום."
          badge={`${overall}/100`}
          badgeTone={scoreTone(overall)}
          actions={<><Link className="button primary" href="/dashboard/admin/mobile-platform">Mobile Platform</Link><Link className="button secondary" href="/dashboard/admin/push-production">Push</Link></>}
        >
          <div className="setup-checklist">
            <span>לא React Native / לא Flutter</span>
            <span>Next.js עטוף ב־Capacitor</span>
            <span>אין upload לחנויות</span>
            <span>נתוני screenshots סינתטיים בלבד</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="Overall" value={`${overall}/100`} hint={label(score?.release_status)} tone={scoreTone(overall)} />
          <RoleMetricCard label="iOS" value={`${score?.ios_readiness ?? 0}/100`} hint={ios?.bundle_or_application_id ?? "bundle TBD"} tone={scoreTone(Number(score?.ios_readiness ?? 0))} />
          <RoleMetricCard label="Android" value={`${score?.android_readiness ?? 0}/100`} hint={android?.bundle_or_application_id ?? "application ID TBD"} tone={scoreTone(Number(score?.android_readiness ?? 0))} />
          <RoleMetricCard label="Build" value={`${score?.build_readiness ?? 0}/100`} hint="signing not active" tone={scoreTone(Number(score?.build_readiness ?? 0))} />
          <RoleMetricCard label="Push" value={`${score?.push_readiness ?? 0}/100`} hint={`${data.push.length} capabilities`} tone={scoreTone(Number(score?.push_readiness ?? 0))} />
          <RoleMetricCard label="Privacy" value={`${score?.privacy_label_readiness ?? 0}/100`} hint={`${privacyNeedsLegal} legal review`} tone={privacyNeedsLegal ? "warn" : "good"} />
          <RoleMetricCard label="Screenshots" value={`${screenshotReady}/${data.screenshots.length}`} hint="synthetic data only" tone={screenshotReady ? "good" : "warn"} />
          <RoleMetricCard label="QA blockers" value={blockedQa} hint="mobile checklist" tone={blockedQa ? "bad" : "warn"} />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Platform Architecture" subtitle="הארכיטקטורה הניידת הנוכחית מתועדת כ־Capacitor wrapper.">
            <div className="camera-infra-list">
              {data.architecture.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.review_key}>
                  <div>
                    <strong>{label(item.architecture_area)}</strong>
                    <span>{item.current_state}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Capacitor Configuration Audit" subtitle="app id, app name, webDir, plugins, permissions, links and push.">
            <div className="camera-infra-list">
              {data.capacitor.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.audit_key}>
                  <div>
                    <strong>{label(item.config_area)}</strong>
                    <span>{item.detected_value} · expected: {item.expected_value}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="iOS / Android Readiness" subtitle="מזהים, שם אפליקציה, אייקונים, launch screen, גרסה, build וחשבונות מפתח.">
          <div className="procedure-list">
            {data.platforms.map((platform) => (
              <article className="card procedure-card" key={platform.id ?? platform.platform}>
                <div>
                  <StatusBadge tone={toneForStatus(platform.status)}>{label(platform.status)}</StatusBadge>
                  <h3>{platform.platform === "ios" ? "Apple App Store" : "Google Play"}</h3>
                  <p>{platform.display_name} · {platform.bundle_or_application_id}</p>
                  <small>version {platform.app_version} · build {platform.build_number} · developer {label(platform.developer_account_status)}</small>
                </div>
                <div className="procedure-meta">
                  <StatusBadge tone={toneForStatus(platform.app_icon_status)}>icon {label(platform.app_icon_status)}</StatusBadge>
                  <StatusBadge tone={toneForStatus(platform.launch_screen_status)}>launch {label(platform.launch_screen_status)}</StatusBadge>
                </div>
              </article>
            ))}
          </div>
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Native Permissions Inventory" subtitle="מיקרופון לא נדרש לתצפיתן גן; מיקום רק ל־GPS attendance/pickup/inspection.">
            <div className="camera-infra-list">
              {data.permissions.map((permission) => (
                <article className="camera-infra-row" key={permission.id ?? permission.permission_key}>
                  <div>
                    <strong>{permission.permission_name}</strong>
                    <span>{permission.purpose}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(permission.status)}>{label(permission.status)}</StatusBadge>
                  <StatusBadge tone={toneForStatus(permission.gan_batuach_israel_mode_rule)}>{label(permission.gan_batuach_israel_mode_rule)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Permission Explanation Copy" subtitle="נוסחים בעברית לחנויות ולבקשות הרשאה.">
            <div className="procedure-list">
              {data.explanations.map((item) => (
                <article className="card procedure-card" key={item.id ?? item.explanation_key}>
                  <div>
                    <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                    <h3>{label(item.permission_type)}</h3>
                    <p>{item.hebrew_copy}</p>
                  </div>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="App Store Privacy Labels" subtitle="מיפוי קטגוריות מידע לאפל. לא לשליחה לפני review משפטי.">
            <div className="camera-infra-list">
              {data.privacyLabels.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.label_key}>
                  <div>
                    <strong>{label(item.data_category)}</strong>
                    <span>{item.purpose}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Google Play Data Safety" subtitle="איסוף, מטרות, שיתוף, הצפנה ומחיקה.">
            <div className="camera-infra-list">
              {data.dataSafety.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.item_key}>
                  <div>
                    <strong>{label(item.data_category)}</strong>
                    <span>{item.purpose}</span>
                  </div>
                  <StatusBadge tone={item.encrypted_in_transit ? "good" : "bad"}>encrypted</StatusBadge>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="Store Metadata & Screenshots" subtitle="תוכן חנויות וצילומי מסך עם demo/synthetic data בלבד.">
          <div className="camera-infra-kpis">
            <RoleMetricCard label="Metadata" value={`${metadataReady}/${data.metadata.length}`} hint="Hebrew + English" tone={scoreTone(percent(metadataReady, data.metadata.length))} />
            <RoleMetricCard label="Screenshots" value={`${screenshotReady}/${data.screenshots.length}`} hint="planned/captured" tone={screenshotReady ? "good" : "warn"} />
            <RoleMetricCard label="Branding" value={data.branding.filter((item) => ["ready", "approved"].includes(String(item.status))).length} hint={`${data.branding.length} assets`} tone="warn" />
            <RoleMetricCard label="Legal links" value={data.legalLinks.filter((item) => ["ready_for_review", "approved"].includes(String(item.status))).length} hint={`${data.legalLinks.length} links`} tone="warn" />
          </div>
          <div className="procedure-list">
            {data.screenshots.map((shot) => (
              <article className="card procedure-card" key={shot.id ?? shot.screenshot_key}>
                <div>
                  <StatusBadge tone={toneForStatus(shot.status)}>{label(shot.status)}</StatusBadge>
                  <h3>{shot.screen_name}</h3>
                  <p>{label(shot.target_role)} · {shot.notes}</p>
                </div>
                <div className="procedure-meta"><StatusBadge tone="good">{label(shot.privacy_rule)}</StatusBadge></div>
              </article>
            ))}
          </div>
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Build Pipeline & Release Channels" subtitle="תיעוד build, signing, staging/production וערוצי שחרור.">
            <div className="camera-infra-list">
              {[...data.builds, ...data.channels].map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.build_key ?? item.channel_key}>
                  <div>
                    <strong>{label(item.build_type ?? item.channel_name)}</strong>
                    <span>{item.notes}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="TestFlight & Google Internal Testing" subtitle="הכנה לבדיקה פנימית בלבד, ללא upload.">
            <div className="camera-infra-list">
              {[...data.testflight, ...data.googleTesting].map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.readiness_key}>
                  <div>
                    <strong>{item.item}</strong>
                    <span>{item.notes}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Reviewer Notes & Demo Accounts" subtitle="חשבונות סינתטיים והסברים לבודקי Apple/Google.">
            <div className="camera-infra-list">
              {data.reviewNotes.slice(0, 8).map((note) => (
                <article className="camera-infra-row" key={note.id ?? note.note_key}>
                  <div>
                    <strong>{label(note.note_area)}</strong>
                    <span>{note.note_text}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(note.status)}>{label(note.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Mobile QA Checklist" subtitle="בדיקות חובה לפני TestFlight, Google Internal או production.">
            <div className="camera-infra-list">
              {data.qa.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.qa_key}>
                  <div>
                    <strong>{label(item.workflow)}</strong>
                    <span>{label(item.role_key)} · {item.notes}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="Security, Camera & Diagnostics Readiness" subtitle="הגנות ניידות, watermark, crash diagnostics וקישורים למסכים הרלוונטיים.">
          <div className="premium-action-grid">
            <ActionCard icon={LockKeyhole} title="Mobile Security" text="MFA, trusted device, session and sensitive action readiness." href="/dashboard/admin/identity-security" />
            <ActionCard icon={Camera} title="Camera Protection" text="Android FLAG_SECURE readiness, iOS capture detection readiness, web watermark only." href="/dashboard/admin/camera-compliance" />
            <ActionCard icon={Bell} title="Push Readiness" text={`${data.push.length} push capabilities tracked.`} href="/dashboard/admin/push-production" />
            <ActionCard icon={Link2} title="Deep Links" text="Child timeline, messages, documents, payments, pickup, inspection, task and camera." href="/dashboard/admin/mobile-platform" />
            <ActionCard icon={Image} title="Screenshots" text="No real children, private data, medical docs or ID documents." href="/APP_STORE_GOOGLE_PLAY_SUBMISSION_READINESS.md" />
            <ActionCard icon={FileCheck2} title="Documentation" text="Full store submission readiness pack." href="/APP_STORE_GOOGLE_PLAY_SUBMISSION_READINESS.md" />
          </div>
        </CleanSection>

        <CleanSection title="Release Blockers" subtitle="חסמים לפני הגשה אמיתית לחנויות.">
          {releaseBlockers.length ? (
            <div className="camera-infra-list">
              {releaseBlockers.map((blocker: string) => (
                <article className="camera-infra-row" key={blocker}>
                  <div><strong>{blocker}</strong><span>חייב טיפול לפני upload או submission.</span></div>
                  <StatusBadge tone="bad">blocked</StatusBadge>
                </article>
              ))}
            </div>
          ) : <EmptyState title="אין חסמי release רשומים" text="עדיין נדרש אישור חיצוני לפני הגשה." />}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <ActionCard icon={Store} title="Commercial Launch" text="Mobile release depends on commercial and support readiness." href="/dashboard/admin/commercial-launch" />
          <ActionCard icon={ClipboardCheck} title="Master QA" text="Run mobile role QA before any store testing." href="/dashboard/admin/master-qa" />
          <ActionCard icon={Smartphone} title="Mobile Platform" text="Existing app shell, push, devices and mobile health." href="/dashboard/admin/mobile-platform" />
          <ActionCard icon={TabletSmartphone} title="Mobile Audit" text="Responsive and native-shell readiness review." href="/dashboard/admin/mobile-audit" />
        </section>
      </div>
    </DashboardShell>
  );
}
