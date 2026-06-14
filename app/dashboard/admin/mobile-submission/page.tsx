import Link from "next/link";
import { Apple, ClipboardCheck, FileCheck2, Flag, KeyRound, LockKeyhole, Play, ShieldCheck, UploadCloud } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
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

function scoreTone(score: number): Tone {
  if (score >= 82) return "good";
  if (score >= 58) return "warn";
  return "bad";
}

function toneForStatus(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["approved", "released", "ready_for_review", "internal_testing_ready", "testflight_ready", "google_internal_ready", "mitigated", "closed", "ready"].includes(value)) return "good";
  if (["preparing", "submitted", "in_review", "open", "in_progress", "accepted_risk", "not_tested", "planned"].includes(value)) return "warn";
  if (["not_ready", "blocked", "rejected", "failed"].includes(value)) return "bad";
  return "default";
}

function percent(done: number, total: number) {
  return total ? Math.round((done / total) * 100) : 0;
}

export default async function MobileSubmissionPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("mobile actual submission", async () => {
    const supabase = await createClient();
    const [scores, submission, checklists, risks, rejections, envAudit, platforms, channels, metadata, privacy, dataSafety, screenshots, qa, reviewNotes, demoAccounts, legalLinks] = await Promise.all([
      safeQuery<Row>("mobile submission scores", () => supabase.from("mobile_release_readiness_scores" as any).select("*").order("calculated_at", { ascending: false }).limit(2)),
      safeQuery<Row>("mobile store submission status", () => supabase.from("mobile_store_submission_status" as any).select("*").order("platform").order("channel").limit(40)),
      safeQuery<Row>("mobile store submission checklists", () => supabase.from("mobile_store_submission_checklists" as any).select("*").order("platform").order("checklist_area").limit(120)),
      safeQuery<Row>("mobile store release risks", () => supabase.from("mobile_store_release_risks" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(80)),
      safeQuery<Row>("mobile store rejection history", () => supabase.from("mobile_store_rejection_history" as any).select("*").order("created_at", { ascending: false }).limit(40)),
      safeQuery<Row>("mobile production env audit", () => supabase.from("mobile_production_environment_audit" as any).select("*").order("area").limit(40)),
      safeQuery<Row>("mobile platform readiness", () => supabase.from("mobile_store_platform_readiness" as any).select("*").order("platform").limit(10)),
      safeQuery<Row>("mobile release channels", () => supabase.from("mobile_release_channels" as any).select("*").order("platform").order("release_stage").limit(80)),
      safeQuery<Row>("mobile store metadata", () => supabase.from("mobile_store_metadata_items" as any).select("*").order("locale").order("field_name").limit(80)),
      safeQuery<Row>("mobile privacy labels", () => supabase.from("mobile_store_privacy_labels" as any).select("*").order("data_category").limit(80)),
      safeQuery<Row>("google play data safety", () => supabase.from("google_play_data_safety_items" as any).select("*").order("data_category").limit(80)),
      safeQuery<Row>("mobile screenshots", () => supabase.from("mobile_screenshot_plan" as any).select("*").order("target_role").limit(80)),
      safeQuery<Row>("mobile QA", () => supabase.from("mobile_release_qa_checklist" as any).select("*").order("role_key").order("workflow").limit(100)),
      safeQuery<Row>("mobile review notes", () => supabase.from("mobile_store_review_notes" as any).select("*").order("note_area").limit(60)),
      safeQuery<Row>("mobile demo accounts", () => supabase.from("mobile_demo_account_pack" as any).select("*").order("role_key").limit(20)),
      safeQuery<Row>("mobile legal links", () => supabase.from("mobile_legal_link_readiness" as any).select("*").order("link_type").limit(40))
    ]);
    return { scores, submission, checklists, risks, rejections, envAudit, platforms, channels, metadata, privacy, dataSafety, screenshots, qa, reviewNotes, demoAccounts, legalLinks };
  }, {
    scores: [] as Row[],
    submission: [] as Row[],
    checklists: [] as Row[],
    risks: [] as Row[],
    rejections: [] as Row[],
    envAudit: [] as Row[],
    platforms: [] as Row[],
    channels: [] as Row[],
    metadata: [] as Row[],
    privacy: [] as Row[],
    dataSafety: [] as Row[],
    screenshots: [] as Row[],
    qa: [] as Row[],
    reviewNotes: [] as Row[],
    demoAccounts: [] as Row[],
    legalLinks: [] as Row[]
  });

  const data = result.data;
  const score = data.scores.find((item) => item.snapshot_key === "mobile-actual-submission-baseline") ?? data.scores[0] ?? {};
  const overall = Number(score.overall_readiness ?? 0);
  const iosStatus = data.submission.find((item) => item.platform === "ios" && item.channel === "testflight") ?? {};
  const androidStatus = data.submission.find((item) => item.platform === "android" && item.channel === "google_internal_testing") ?? {};
  const approvedChecklist = data.checklists.filter((item) => ["approved", "ready_for_review", "not_required"].includes(String(item.status))).length;
  const criticalRisks = data.risks.filter((item) => ["critical", "high"].includes(String(item.severity)) && !["mitigated", "closed", "accepted_risk"].includes(String(item.status))).length;
  const metadataReady = data.metadata.filter((item) => ["ready_for_review", "approved"].includes(String(item.status))).length;
  const privacyNeedsReview = data.privacy.filter((item) => item.status === "needs_legal_review").length + data.dataSafety.filter((item) => item.status === "needs_legal_review").length;
  const screenshotReady = data.screenshots.filter((item) => ["captured", "approved"].includes(String(item.status))).length;
  const qaPassed = data.qa.filter((item) => item.status === "passed").length;
  const qaBlocked = data.qa.filter((item) => ["blocked", "failed"].includes(String(item.status))).length;
  const blockers = Array.isArray(score.release_blockers) ? score.release_blockers : [];

  return (
    <DashboardShell role="admin" title="Mobile Submission">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Actual Store Submission"
          title="הגשה מבוקרת ל-App Store ול-Google Play"
          subtitle="מרכז הגשה אמיתי ל-TestFlight, Apple App Review, Google Internal Testing, Android closed testing ו-production readiness. אין upload, פרסום או חתימות בלי נכסים ואישור מפורש."
          badge={`${overall}/100`}
          badgeTone={scoreTone(overall)}
          actions={<><Link className="button primary" href="/dashboard/admin/mobile-release">Readiness</Link><Link className="button secondary" href="/dashboard/admin/provider-production">Providers</Link></>}
        >
          <div className="setup-checklist">
            <span>No publishing</span>
            <span>No signing secrets in repo</span>
            <span>Synthetic screenshots only</span>
            <span>Final approval required</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="Submission readiness" value={`${overall}/100`} hint={label(score.release_status)} tone={scoreTone(overall)} />
          <RoleMetricCard label="iOS / TestFlight" value={`${iosStatus.readiness_score ?? 0}/100`} hint={label(iosStatus.submission_status)} tone={scoreTone(Number(iosStatus.readiness_score ?? 0))} />
          <RoleMetricCard label="Android internal" value={`${androidStatus.readiness_score ?? 0}/100`} hint={label(androidStatus.submission_status)} tone={scoreTone(Number(androidStatus.readiness_score ?? 0))} />
          <RoleMetricCard label="Checklist" value={`${approvedChecklist}/${data.checklists.length}`} hint={`${percent(approvedChecklist, data.checklists.length)}% ready/review`} tone={approvedChecklist === data.checklists.length ? "good" : "warn"} />
          <RoleMetricCard label="Privacy review" value={privacyNeedsReview} hint="labels / data safety" tone={privacyNeedsReview ? "warn" : "good"} />
          <RoleMetricCard label="Screenshots" value={`${screenshotReady}/${data.screenshots.length}`} hint="demo data only" tone={screenshotReady ? "good" : "warn"} />
          <RoleMetricCard label="QA" value={`${qaPassed}/${data.qa.length}`} hint={`${qaBlocked} blocked/failed`} tone={qaBlocked ? "bad" : "warn"} />
          <RoleMetricCard label="High risks" value={criticalRisks} hint="store release risks" tone={criticalRisks ? "bad" : "good"} />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Submission Status" subtitle="סטטוסי הגשה לפי חנות וערוץ. לא מפרסם בפועל.">
            <div className="camera-infra-list">
              {data.submission.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.status_key}>
                  <div>
                    <strong>{label(item.platform)} · {label(item.channel)}</strong>
                    <span>{item.notes ?? "Submission workflow"}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.submission_status)}>{label(item.submission_status)}</StatusBadge>
                  <StatusBadge tone={scoreTone(Number(item.readiness_score ?? 0))}>{item.readiness_score}/100</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Release Blockers" subtitle="מה מונע הגשה אמיתית כרגע.">
            <div className="procedure-list compact-list">
              {blockers.length ? blockers.map((blocker: string) => (
                <div className="mini-row" key={blocker}>
                  <span>{blocker}</span>
                  <strong><StatusBadge tone="warn">manual</StatusBadge></strong>
                  <small>דורש טיפול לפני upload או submit.</small>
                </div>
              )) : <EmptyState title="אין חסמים רשומים" text="אם כל הבדיקות עוברות, ניתן לעדכן סטטוס לאישור ידני." />}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="Apple / Google Submission Checklist" subtitle="חשבונות, חתימה, metadata, screenshots, privacy, QA ואישור סופי.">
          <div className="communication-template-grid">
            {data.checklists.map((item) => (
              <article className="communication-template-card" key={item.id ?? item.checklist_key}>
                <div>
                  <strong>{label(item.platform)} · {label(item.checklist_area)}</strong>
                  <span>{item.checklist_item}</span>
                  <small>{item.evidence_reference ?? item.owner ?? "evidence pending"}</small>
                </div>
                <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
              </article>
            ))}
          </div>
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Production Mobile Environment" subtitle="אין service role, אין payment secrets, אין private keys בבאנדל.">
            <div className="camera-infra-list">
              {data.envAudit.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.audit_key}>
                  <div>
                    <strong>{label(item.area)}</strong>
                    <span>{item.notes}</span>
                  </div>
                  <StatusBadge tone={item.secret_exposure_risk ? "bad" : toneForStatus(item.status)}>{item.secret_exposure_risk ? "secret risk" : label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Platform Confirmation" subtitle="Next.js / React / TypeScript עטוף ב-Capacitor. לא React Native ולא Flutter.">
            <div className="procedure-list compact-list">
              {data.platforms.map((item) => (
                <div className="mini-row" key={item.id ?? item.platform}>
                  <span>{item.platform === "ios" ? "Apple iOS" : "Google Android"} · {item.bundle_or_application_id}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge></strong>
                  <small>{item.display_name} · version {item.app_version} · build {item.build_number}</small>
                </div>
              ))}
              {data.channels.map((item) => (
                <div className="mini-row" key={item.id ?? item.channel_key}>
                  <span>{item.channel_name}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge></strong>
                  <small>{item.notes}</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Privacy Labels / Data Safety" subtitle="טיוטות בלבד עד final review.">
            <div className="procedure-list compact-list">
              {data.privacy.slice(0, 9).map((item) => (
                <div className="mini-row" key={item.id ?? item.label_key}>
                  <span>Apple · {label(item.data_category)}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge></strong>
                  <small>{item.purpose}</small>
                </div>
              ))}
              {data.dataSafety.slice(0, 9).map((item) => (
                <div className="mini-row" key={item.id ?? item.item_key}>
                  <span>Google · {label(item.data_category)}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge></strong>
                  <small>encrypted: {String(item.encrypted_in_transit)} · deletion: {String(item.deletion_supported)}</small>
                </div>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Metadata, Review Notes & Demo Accounts" subtitle="לא שומרים סיסמאות אמיתיות בקבצים ציבוריים.">
            <div className="procedure-list compact-list">
              <div className="mini-row">
                <span>Store metadata ready</span>
                <strong><StatusBadge tone={metadataReady ? "good" : "warn"}>{metadataReady}/{data.metadata.length}</StatusBadge></strong>
                <small>Hebrew and English package</small>
              </div>
              {data.reviewNotes.map((item) => (
                <div className="mini-row" key={item.id ?? item.note_key}>
                  <span>{label(item.note_area)}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge></strong>
                  <small>{item.note_text}</small>
                </div>
              ))}
              {data.demoAccounts.map((item) => (
                <div className="mini-row" key={item.id ?? item.account_key}>
                  <span>{label(item.role_key)} · {item.display_name}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge></strong>
                  <small>{item.instructions}</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Mobile QA Before Submission" subtitle="כל deep link חייב auth והרשאות. Camera viewing חסום עד אישור policy.">
            <div className="procedure-list compact-list">
              {data.qa.map((item) => (
                <div className="mini-row" key={item.id ?? item.qa_key}>
                  <span>{label(item.role_key)} · {label(item.workflow)}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge></strong>
                  <small>{item.notes}</small>
                </div>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Release Risks & Rejection Workflow" subtitle="דחייה נרשמת, מוקצית לבעלים, מתוקנת, נבדקת ומוגשת מחדש.">
            <div className="procedure-list compact-list">
              {data.risks.map((risk) => (
                <div className="mini-row" key={risk.id ?? risk.risk_key}>
                  <span>{label(risk.risk_category)}</span>
                  <strong><StatusBadge tone={toneForStatus(risk.severity)}>{label(risk.severity)}</StatusBadge></strong>
                  <small>{risk.mitigation}</small>
                </div>
              ))}
              {data.rejections.map((item) => (
                <div className="mini-row" key={item.id ?? item.rejection_key}>
                  <span>{label(item.platform)} rejection workflow</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge></strong>
                  <small>{item.required_fix}</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="Legal & Support Links" subtitle="קישורים חייבים לעבוד ב-production לפני review.">
          <div className="grid cols-4">
            {data.legalLinks.map((link) => (
              <ActionCard key={link.id ?? link.link_key} icon={FileCheck2} title={label(link.link_type)} text={`${link.url_path} · ${label(link.status)}`} href={link.url_path ?? "/dashboard/admin/mobile-submission"} />
            ))}
            <ActionCard icon={Apple} title="Apple Package" text="Privacy labels, screenshots, reviewer notes" href="/dashboard/admin/mobile-submission" />
            <ActionCard icon={Play} title="Google Package" text="Data Safety, internal testing, Play listing" href="/dashboard/admin/mobile-submission" />
            <ActionCard icon={UploadCloud} title="Build Guide" text="Capacitor release steps documented" href="/dashboard/admin/mobile-release" />
            <ActionCard icon={KeyRound} title="Signing" text="No certificates or private keys in repo" href="/dashboard/admin/mobile-submission" />
            <ActionCard icon={LockKeyhole} title="Privacy" text={`${privacyNeedsReview} disclosures need review`} href="/dashboard/admin/legal-review" />
            <ActionCard icon={ShieldCheck} title="Provider safety" text="Push, payments, invoices and webhooks" href="/dashboard/admin/provider-production" />
            <ActionCard icon={ClipboardCheck} title="QA" text={`${qaBlocked} blocked/failed`} href="/dashboard/admin/master-qa" />
            <ActionCard icon={Flag} title="Release decision" text="Manual final approval required" href="/dashboard/admin/launch-readiness" />
          </div>
        </CleanSection>

        <CleanSection title="Manual Submission Guardrails" subtitle="המערכת מכינה את החבילה. ההגשה עצמה נשארת פעולה ידנית ומאושרת.">
          <div className="setup-checklist">
            <span>Apple Developer / Google Play accounts verified</span>
            <span>Signing assets stored outside repo</span>
            <span>Privacy and Data Safety approved</span>
            <span>Reviewer accounts handled securely</span>
            <span>Final submit approval recorded</span>
          </div>
        </CleanSection>
      </div>
    </DashboardShell>
  );
}
