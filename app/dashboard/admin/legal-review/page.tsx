import Link from "next/link";
import { FileCheck2, Scale, ShieldCheck, Video } from "lucide-react";
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
    return { data: result.error ? [] : result.data ?? [], available: !result.error };
  } catch (error) {
    logSupabaseError(label, error);
    return { data: [] as T[], available: false };
  }
}

function toneForStatus(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["approved", "approved_with_conditions", "ready_for_external_review", "approved_wording", "ready_for_review", "signed"].includes(value)) return "good";
  if (["open", "under_review", "needs_changes", "requires_external_review", "needs_review", "requested", "draft_for_legal_review"].includes(value)) return "warn";
  if (["blocked", "rejected", "critical", "high", "missing"].includes(value)) return "bad";
  return "default";
}

function scoreTone(score: number): Tone {
  if (score >= 82) return "good";
  if (score >= 62) return "warn";
  return "bad";
}

function label(value?: string | null) {
  return String(value ?? "לא ידוע").replaceAll("_", " ");
}

export default async function LegalReviewPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("legal review center", async () => {
    const supabase = await createClient();
    const [scores, documents, items, subprocessors, copyRisks, accessModes] = await Promise.all([
      safeQuery<Row>("legal readiness scores", () => supabase.from("legal_readiness_scores" as any).select("*").order("created_at", { ascending: false }).limit(1)),
      safeQuery<Row>("legal review documents", () => supabase.from("legal_review_documents" as any).select("*").order("risk_level").order("document_category").limit(120)),
      safeQuery<Row>("legal review items", () => supabase.from("legal_review_items" as any).select("*").order("risk_level").order("target_review_date").limit(120)),
      safeQuery<Row>("subprocessor register", () => supabase.from("subprocessor_register" as any).select("*").order("risk_rating").order("provider_name").limit(80)),
      safeQuery<Row>("public copy review", () => supabase.from("legal_public_copy_review_items" as any).select("*").order("risk_level").order("page_path").limit(80)),
      safeQuery<Row>("external reviewer access modes", () => supabase.from("external_reviewer_access_modes" as any).select("*").order("reviewer_type").limit(40))
    ]);
    return {
      scores: scores.data, documents: documents.data, items: items.data,
      subprocessors: subprocessors.data, copyRisks: copyRisks.data, accessModes: accessModes.data,
      availability: [scores, documents, items, subprocessors, copyRisks, accessModes].map((source) => source.available)
    };
  }, {
    scores: [] as Row[],
    documents: [] as Row[],
    items: [] as Row[],
    subprocessors: [] as Row[],
    copyRisks: [] as Row[],
    accessModes: [] as Row[],
    availability: Array<boolean>(6).fill(false)
  });

  const data = result.data;
  const available = data.availability;
  const unavailable = "לא זמין";
  const queryError = result.error ?? (available.some((value) => !value) ? "לא ניתן לטעון חלק מהנתונים כרגע" : null);
  const score = data.scores[0];
  const legalScore = Number(score?.legal_readiness_score ?? 0);
  const readyDocuments = data.documents.filter((doc) => ["ready_for_external_review", "approved", "approved_with_conditions"].includes(String(doc.status))).length;
  const missingDocuments = data.documents.filter((doc) => ["missing", "blocked"].includes(String(doc.status))).length;
  const openItems = data.items.filter((item) => !["approved", "approved_with_conditions", "closed", "accepted_risk"].includes(String(item.current_status)));
  const highRiskOpen = openItems.filter((item) => ["critical", "high"].includes(String(item.risk_level)));
  const subprocessorNeedsReview = data.subprocessors.filter((provider) => ["needs_review", "not_started", "under_review"].includes(String(provider.privacy_review_status))).length;
  const copyRiskOpen = data.copyRisks.filter((item) => !["approved_wording", "resolved"].includes(String(item.status))).length;

  return (
    <DashboardShell role="admin" title="Legal Review">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="External Review Pack"
          title="חבילת סקירה משפטית, פרטיות ורגולציה"
          subtitle="מרכז אחד למסמכים, שאלות פתוחות, DPIA, מצלמות, AI, DPA, subprocessors וסיכוני ניסוח ציבורי. זהו readiness pack בלבד, לא אישור משפטי."
          badge={available[0] ? `${legalScore}/100` : unavailable}
          badgeTone={available[0] ? scoreTone(legalScore) : "default"}
          actions={<><Link className="button primary" href="/dashboard/admin/capability-legal-review">מטריצת יכולות</Link><Link className="button secondary" href="/dashboard/admin/iso-evidence">ראיות ISO</Link></>}
        >
          <div className="setup-checklist">
            <span>DRAFT FOR LEGAL REVIEW</span>
            <span>אין גישה לילדים, רפואי, מצלמות חיות או secrets לבודק חיצוני</span>
            <span>אישור סופי חייב להגיע מאנשי מקצוע חיצוניים</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={queryError} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="Legal score" value={available[0] ? `${legalScore}/100` : unavailable} hint="Readiness only" tone={available[0] ? scoreTone(legalScore) : "default"} />
          <RoleMetricCard label="Review packs" value={available[1] ? data.documents.length : unavailable} hint={available[1] ? `${readyDocuments} מוכנים` : unavailable} tone={available[1] ? missingDocuments ? "bad" : "good" : "default"} />
          <RoleMetricCard label="Open questions" value={available[2] ? openItems.length : unavailable} hint={available[2] ? `${highRiskOpen.length} high/critical` : unavailable} tone={available[2] ? highRiskOpen.length ? "bad" : "warn" : "default"} />
          <RoleMetricCard label="Privacy readiness" value={available[0] ? `${score?.privacy_review_readiness ?? 0}%` : unavailable} hint="DPIA, DPA, rights" tone={available[0] ? scoreTone(Number(score?.privacy_review_readiness ?? 0)) : "default"} />
          <RoleMetricCard label="Camera readiness" value={available[0] ? `${score?.camera_review_readiness ?? 0}%` : unavailable} hint="Parent viewing review" tone={available[0] ? scoreTone(Number(score?.camera_review_readiness ?? 0)) : "default"} />
          <RoleMetricCard label="AI readiness" value={available[0] ? `${score?.ai_governance_readiness ?? 0}%` : unavailable} hint="Human review boundaries" tone={available[0] ? scoreTone(Number(score?.ai_governance_readiness ?? 0)) : "default"} />
          <RoleMetricCard label="Subprocessors" value={available[3] ? data.subprocessors.length : unavailable} hint={available[3] ? `${subprocessorNeedsReview} צריכים review` : unavailable} tone={available[3] ? subprocessorNeedsReview ? "warn" : "good" : "default"} />
          <RoleMetricCard label="Copy risks" value={available[4] ? data.copyRisks.length : unavailable} hint={available[4] ? `${copyRiskOpen} פתוחים` : unavailable} tone={available[4] ? copyRiskOpen ? "warn" : "good" : "default"} />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <ActionCard icon={Scale} title="Legal architecture pack" text="Roles, data types, sensitive categories, camera/AI processing, audit and retention." href="/dashboard/admin/docs/GAN_BATUACH_LEGAL_ARCHITECTURE_PACK" />
          <ActionCard icon={Video} title="Camera compliance pack" text="No RTSP exposure, short tokens, checked-in validation, watermark and web limitations." href="/dashboard/admin/docs/CAMERA_COMPLIANCE_EXTERNAL_REVIEW_PACK" />
          <ActionCard icon={ShieldCheck} title="DPIA and AI review" text="No automatic decisions, parent raw AI blocked, explainability and human review." href="/dashboard/admin/docs/DPIA_EXTERNAL_REVIEW_PACK" />
          <ActionCard icon={FileCheck2} title="DPA readiness" text="Controller/processor roles, subprocessors, security measures and deletion/return model." href="/dashboard/admin/docs/DATA_PROCESSING_AGREEMENT_READINESS" />
        </section>

        <CleanSection title="Review Pack Documents" subtitle="כל המסמכים מסומנים כטיוטה לסקירה חיצונית, לא כמסמך משפטי סופי.">
          {!available[1] ? <EmptyState title="נתוני חבילת המסמכים לא זמינים" text="לא ניתן לטעון את הנתונים כרגע." /> : data.documents.length === 0 ? <EmptyState title="אין מסמכי review pack" text="הרצת המיגרציה של Phase 166 תוסיף את הרשם." /> : (
            <div className="procedure-list">
              {data.documents.map((doc) => (
                <article className="card procedure-card" key={doc.id ?? doc.document_key}>
                  <div>
                    <StatusBadge tone={toneForStatus(doc.status)}>{label(doc.status)}</StatusBadge>
                    <h3>{doc.title}</h3>
                    <p>{doc.summary}</p>
                    <small>{doc.document_path} · {label(doc.external_reviewer_type)} · next review {doc.next_review_date ?? "TBD"}</small>
                  </div>
                  <div className="procedure-meta">
                    <StatusBadge tone={toneForStatus(doc.risk_level)}>{label(doc.risk_level)}</StatusBadge>
                    <StatusBadge tone="default">{label(doc.document_category)}</StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Open Legal Questions" subtitle="שאלות שדורשות עורך דין פרטיות/רגולציה/מצלמות לפני production.">
            {!available[2] ? <EmptyState title="נתוני השאלות לא זמינים" text="לא ניתן לטעון את הנתונים כרגע." /> : openItems.length === 0 ? <EmptyState title="אין שאלות פתוחות" /> : (
              <div className="camera-infra-list">
                {openItems.slice(0, 18).map((item) => (
                  <article className="camera-infra-row" key={item.id ?? item.item_key}>
                    <div>
                      <strong>{item.item_title}</strong>
                      <span>{item.legal_question}</span>
                    </div>
                    <StatusBadge tone={toneForStatus(item.current_status)}>{label(item.current_status)}</StatusBadge>
                    <StatusBadge tone={toneForStatus(item.risk_level)}>{label(item.risk_level)}</StatusBadge>
                  </article>
                ))}
              </div>
            )}
          </CleanSection>

          <CleanSection title="Subprocessor Register" subtitle="ספקים חיצוניים שדורשים DPA, privacy/security review ובדיקת תפקידים.">
            {!available[3] ? <EmptyState title="נתוני הספקים לא זמינים" text="לא ניתן לטעון את הנתונים כרגע." /> : <div className="camera-infra-list">
              {data.subprocessors.map((provider) => (
                <article className="camera-infra-row" key={provider.id ?? provider.provider_key}>
                  <div>
                    <strong>{provider.provider_name}</strong>
                    <span>{provider.service_purpose}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(provider.privacy_review_status)}>{label(provider.privacy_review_status)}</StatusBadge>
                  <StatusBadge tone={toneForStatus(provider.risk_rating)}>{label(provider.risk_rating)}</StatusBadge>
                </article>
              ))}
            </div>}
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Public Copy Risks" subtitle="ניסוחים מסוכנים והניסוח הבטוח יותר שאושר לסקירה.">
            {!available[4] ? <EmptyState title="נתוני סיכוני הניסוח לא זמינים" text="לא ניתן לטעון את הנתונים כרגע." /> : <div className="camera-infra-list">
              {data.copyRisks.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.item_key}>
                  <div>
                    <strong>{item.risky_claim}</strong>
                    <span>{item.safer_wording}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>}
          </CleanSection>

          <CleanSection title="External Reviewer Access Mode" subtitle="תכנון גישה מוגבלת לבודקים חיצוניים בלי מידע אישי רגיש.">
            {!available[5] ? <EmptyState title="נתוני תכנון הגישה לא זמינים" text="לא ניתן לטעון את הנתונים כרגע." /> : <div className="camera-infra-list">
              {data.accessModes.map((mode) => (
                <article className="camera-infra-row" key={mode.id ?? mode.mode_key}>
                  <div>
                    <strong>{label(mode.reviewer_type)}</strong>
                    <span>{mode.notes}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(mode.status)}>{label(mode.status)}</StatusBadge>
                </article>
              ))}
            </div>}
          </CleanSection>
        </section>
      </div>
    </DashboardShell>
  );
}
