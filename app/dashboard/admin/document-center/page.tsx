import Link from "next/link";
import {
  Archive,
  Brain,
  Building2,
  ClipboardCheck,
  FileArchive,
  FileClock,
  FileSearch,
  FileText,
  FolderOpen,
  Image,
  Receipt,
  Search,
  ShieldCheck,
  UploadCloud,
  UsersRound
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { DocumentReviewActions } from "@/components/document-review-actions";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { evidenceTypeLabel } from "@/lib/domain/incident-cases";
import { createClient } from "@/lib/supabase/server";

type Tone = "good" | "warn" | "bad" | "default";

function statusTone(status?: string | null): Tone {
  const text = String(status ?? "").toLowerCase();
  if (["valid", "approved", "verified", "signed", "resolved", "closed"].includes(text)) return "good";
  if (["missing", "expired", "rejected", "failed"].includes(text)) return "bad";
  if (["pending_review", "pending_signature", "requires_approval", "open", "in_progress"].includes(text)) return "warn";
  return "default";
}

function statusLabel(status?: string | null) {
  const map: Record<string, string> = {
    valid: "תקף",
    approved: "מאושר",
    verified: "אומת",
    signed: "חתום",
    pending_review: "ממתין לבדיקה",
    pending_signature: "ממתין לחתימה",
    requires_approval: "דורש אישור",
    missing: "חסר",
    expired: "פג תוקף",
    rejected: "נדרש תיקון",
    open: "פתוח",
    in_progress: "בטיפול",
    closed: "נסגר",
    resolved: "טופל"
  };
  return map[String(status ?? "")] ?? "לתיעוד";
}

function dateText(value?: string | null) {
  if (!value) return "לא נקבע";
  return new Date(value).toLocaleDateString("he-IL");
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

function documentCategory(row: any) {
  const type = `${row.document_type ?? ""} ${row.owner_type ?? ""}`.toLowerCase();
  if (row.child_id || type.includes("child") || type.includes("medical") || type.includes("allergy")) return "child_documents";
  if (row.staff_id || type.includes("staff") || type.includes("certificate") || type.includes("training") || type.includes("background")) return "staff_documents";
  if (row.parent_id || type.includes("approval") || type.includes("consent")) return "child_documents";
  if (type.includes("invoice")) return "invoices";
  if (type.includes("receipt")) return "receipts";
  if (type.includes("contract")) return "contracts";
  if (type.includes("inspection")) return "inspection_documents";
  if (type.includes("compliance") || type.includes("license") || type.includes("insurance")) return "compliance_documents";
  return "kindergarten_documents";
}

function categoryLabel(category: string) {
  const map: Record<string, string> = {
    kindergarten_documents: "תיק גן",
    child_documents: "תיק ילד",
    staff_documents: "תיק צוות",
    inspection_documents: "מסמכי פיקוח",
    compliance_documents: "ציות",
    incident_evidence: "ראיות אירוע",
    complaint_evidence: "ראיות תלונה",
    contracts: "חוזים",
    invoices: "חשבוניות",
    receipts: "קבלות"
  };
  return map[category] ?? "מסמך";
}

export default async function AdminDocumentCenterPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("document center", async () => {
    const supabase = await createClient();
    const [documentsRes, evidenceRes, inspectionAnswersRes, signaturesRes, complaintsRes, casesRes] = await Promise.all([
      supabase.from("documents" as any).select("id,garden_id,staff_id,child_id,parent_id,inspector_id,uploaded_by,name,document_type,file_url,expires_at,status,owner_type,notes,reviewed_by,reviewed_at,created_at,gardens(name,city),children(full_name),staff(full_name)").order("created_at", { ascending: false }).limit(160),
      supabase.from("incident_case_evidence" as any).select("id,case_id,garden_id,evidence_type,title,description,source_type,storage_bucket,storage_path,external_reference,captured_at,visibility,created_at,incident_cases(case_number,status,severity),gardens(name,city)").order("created_at", { ascending: false }).limit(100),
      supabase.from("inspection_answers" as any).select("id,inspection_id,photo_url,document_url,note,score,created_at,inspections(garden_id,completed_at,status,gardens(name,city))").or("photo_url.not.is.null,document_url.not.is.null").order("created_at", { ascending: false }).limit(80),
      supabase.from("inspection_signatures" as any).select("id,inspection_id,signature_image,signed_at,gps_distance_meters,inspections(garden_id,status,gardens(name,city))").order("signed_at", { ascending: false }).limit(40),
      supabase.from("complaints" as any).select("id,garden_id,subject,status,severity,attachment_urls,created_at,gardens(name,city)").order("created_at", { ascending: false }).limit(80),
      supabase.from("incident_cases" as any).select("id,case_number,incident_type,severity,status,garden_id,created_at,closed_at,gardens(name,city)").order("created_at", { ascending: false }).limit(80)
    ]);
    [documentsRes, evidenceRes, inspectionAnswersRes, signaturesRes, complaintsRes, casesRes].forEach((res, index) => logSupabaseError(`document center query ${index}`, (res as any).error));
    return {
      rows: (documentsRes.data ?? []) as any[],
      evidence: (evidenceRes.data ?? []) as any[],
      inspectionEvidence: (inspectionAnswersRes.data ?? []) as any[],
      signatures: (signaturesRes.data ?? []) as any[],
      complaints: (complaintsRes.data ?? []) as any[],
      cases: (casesRes.data ?? []) as any[],
      queryError: [documentsRes, evidenceRes, inspectionAnswersRes, signaturesRes, complaintsRes, casesRes].some((res) => (res as any).error) ? "חלק מהנתונים לא נטענו כרגע" : null
    };
  }, { rows: [] as any[], evidence: [] as any[], inspectionEvidence: [] as any[], signatures: [] as any[], complaints: [] as any[], cases: [] as any[], queryError: null as string | null });

  const documents = result.data.rows;
  const evidence = result.data.evidence;
  const inspectionEvidence = result.data.inspectionEvidence;
  const signatures = result.data.signatures;
  const complaints = result.data.complaints;
  const cases = result.data.cases;
  const now = Date.now();
  const expiring = documents.filter((row) => {
    const days = daysUntil(row.expires_at);
    return days !== null && days >= 0 && days <= 30;
  });
  const expired = documents.filter((row) => {
    const days = daysUntil(row.expires_at);
    return days !== null && days < 0;
  });
  const missing = documents.filter((row) => ["missing", "rejected", "expired"].includes(String(row.status)));
  const unresolvedActions = documents.filter((row) => ["missing", "rejected", "expired", "pending_review", "requires_approval"].includes(String(row.status))).length + evidence.filter((row) => row.visibility === "internal" && !row.reviewed_at).length;
  const recentDocuments = [...documents].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()).slice(0, 12);
  const classification = [
    "kindergarten_documents",
    "child_documents",
    "staff_documents",
    "inspection_documents",
    "compliance_documents",
    "incident_evidence",
    "complaint_evidence",
    "contracts",
    "invoices",
    "receipts"
  ].map((category) => ({
    category,
    count:
      documents.filter((row) => documentCategory(row) === category).length +
      (category === "incident_evidence" ? evidence.length : 0) +
      (category === "inspection_documents" ? inspectionEvidence.length + signatures.length : 0) +
      (category === "complaint_evidence" ? complaints.filter((item) => Array.isArray(item.attachment_urls) && item.attachment_urls.length).length : 0)
  }));
  const digitalFiles = [
    { title: "תיק גן", count: documents.filter((row) => documentCategory(row) === "kindergarten_documents" || documentCategory(row) === "compliance_documents").length, icon: Building2, href: "/dashboard/admin/gardens" },
    { title: "תיק ילד", count: documents.filter((row) => documentCategory(row) === "child_documents").length, icon: UsersRound, href: "/dashboard/admin/documents?file=child" },
    { title: "תיק צוות", count: documents.filter((row) => documentCategory(row) === "staff_documents").length, icon: ShieldCheck, href: "/dashboard/admin/users" },
    { title: "ראיות פיקוח", count: inspectionEvidence.length + signatures.length, icon: ClipboardCheck, href: "/dashboard/admin/inspections" },
    { title: "ראיות אירוע", count: evidence.length + cases.length, icon: FileArchive, href: "/dashboard/admin/incident-center" },
    { title: "ראיות תלונה", count: complaints.filter((item) => Array.isArray(item.attachment_urls) && item.attachment_urls.length).length, icon: FileText, href: "/dashboard/admin/complaints" }
  ];

  return (
    <DashboardShell role="admin" title="מרכז מסמכים">
      <div className="document-center-2">
        <PremiumDashboardHero
          eyebrow="ניהול רשומות"
          title="כל המסמכים, הראיות והדוחות במקום אחד"
          subtitle="תיקי גן, ילדים, צוות, פיקוח, ציות, אירועים ותלונות עם תוקף, חיפוש, audit ושמירת היסטוריה."
          badge={`${unresolvedActions} לטיפול`}
          badgeTone={unresolvedActions ? "warn" : "good"}
          actions={<><Link className="button primary" href="/dashboard/admin/documents">סקירת מסמכים</Link><Link className="button secondary" href="/dashboard/admin/incident-center">תיקי אירוע</Link></>}
        >
          <FolderOpen size={46} />
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? result.data.queryError} />

        <section className="document-kpi-grid">
          <RoleMetricCard label="מסמכים" value={documents.length} hint="במאגר המרכזי" tone="good" />
          <RoleMetricCard label="פגים בקרוב" value={expiring.length} hint="30 ימים" tone={expiring.length ? "warn" : "good"} />
          <RoleMetricCard label="פגי תוקף" value={expired.length} hint="דורש חידוש" tone={expired.length ? "bad" : "good"} />
          <RoleMetricCard label="חסרים/לתיקון" value={missing.length} hint="ממתין לפעולה" tone={missing.length ? "bad" : "good"} />
          <RoleMetricCard label="ראיות" value={evidence.length + inspectionEvidence.length + signatures.length} hint="אירועים ופיקוח" tone="warn" />
          <RoleMetricCard label="תיקים" value={cases.length} hint="חקירה ותיעוד" tone={cases.length ? "warn" : "good"} />
        </section>

        <CleanSection title="סיווג מסמכים" subtitle="אותו מאגר, תצוגה אחת לפי סוג הרשומה.">
          <div className="document-classification-grid">
            {classification.map((item) => <article key={item.category}><span>{categoryLabel(item.category)}</span><strong>{item.count}</strong></article>)}
          </div>
        </CleanSection>

        <section className="document-file-grid">
          {digitalFiles.map((item) => <Link href={item.href} key={item.title}><item.icon /><div><strong>{item.title}</strong><span>{item.count} רשומות</span></div></Link>)}
        </section>

        <section className="document-center-layout">
          <CleanSection title="מסמכים אחרונים" subtitle="מסמכים חיים עם סטטוס, תוקף ובעלות.">
            {recentDocuments.length ? <div className="document-record-list">{recentDocuments.map((row) => <article key={row.id}><div><StatusBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</StatusBadge><h3>{row.name ?? "מסמך"}</h3><p>{categoryLabel(documentCategory(row))} · {row.gardens?.name ?? row.children?.full_name ?? row.staff?.full_name ?? "רשומה כללית"}</p><small>תוקף: {dateText(row.expires_at)} · נוצר: {dateText(row.created_at)}</small></div><div className="actions">{row.file_url ? <a className="button secondary tiny" href={row.file_url}>צפייה</a> : null}<DocumentReviewActions id={row.id} /></div></article>)}</div> : <EmptyState title="אין מסמכים להצגה" text="מסמכים שיועלו למערכת יופיעו כאן לפי תאריך וסטטוס." />}
          </CleanSection>

          <CleanSection title="מנוע תוקף וחידוש" subtitle="מעקב אחרי פקיעה, חסרים ופעולות פתוחות.">
            <div className="document-renewal-list">
              {[...expired, ...expiring, ...missing].slice(0, 12).map((row) => <Link href="/dashboard/admin/documents" key={`${row.id}-renewal`}><FileClock /><div><strong>{row.name}</strong><span>{statusLabel(row.status)} · תוקף {dateText(row.expires_at)}</span></div><StatusBadge tone={statusTone(row.status)}>{daysUntil(row.expires_at) !== null ? `${daysUntil(row.expires_at)} ימים` : "לבדיקה"}</StatusBadge></Link>)}
              {!expired.length && !expiring.length && !missing.length ? <EmptyState title="אין חידושים דחופים" text="מסמכים פגי תוקף או חסרים יופיעו כאן." /> : null}
            </div>
          </CleanSection>
        </section>

        <section className="document-center-layout">
          <CleanSection title="מאגר ראיות" subtitle="ראיות אירוע, תלונה ופיקוח מחוברות לרשומות המקור.">
            <div className="evidence-record-list">
              {evidence.slice(0, 8).map((item) => <Link href="/dashboard/admin/incident-center" key={item.id}><Image /><div><strong>{item.title}</strong><span>{evidenceTypeLabel(item.evidence_type)} · {item.gardens?.name ?? "גן"} · {item.incident_cases?.case_number ?? "תיק"}</span></div><StatusBadge tone={item.visibility === "approved_parent_update" ? "good" : "warn"}>{item.visibility === "internal" ? "פנימי" : "מאושר חלקית"}</StatusBadge></Link>)}
              {inspectionEvidence.slice(0, 5).map((item) => <Link href="/dashboard/admin/inspections" key={`inspection-${item.id}`}><ClipboardCheck /><div><strong>{item.photo_url ? "צילום פיקוח" : "מסמך פיקוח"}</strong><span>{item.inspections?.gardens?.name ?? "גן"} · ציון {item.score ?? "-"}</span></div><StatusBadge tone="warn">ראיית פיקוח</StatusBadge></Link>)}
              {signatures.slice(0, 4).map((item) => <Link href="/dashboard/admin/inspections" key={`signature-${item.id}`}><ShieldCheck /><div><strong>חתימת פקח</strong><span>{item.inspections?.gardens?.name ?? "גן"} · {dateText(item.signed_at)}</span></div><StatusBadge tone="good">חתום</StatusBadge></Link>)}
              {!evidence.length && !inspectionEvidence.length && !signatures.length ? <EmptyState title="אין ראיות להצגה" text="ראיות מתיקי אירוע וביקורות יופיעו כאן." /> : null}
            </div>
          </CleanSection>

          <CleanSection title="חיפוש, AI ו-retention" subtitle="תשתית עבודה אחידה לרשומות ארגוניות.">
            <div className="document-readiness-list">
              <span><Search /> חיפוש לפי שם, סוג, תאריך, בעלים ותגיות <b>מוכן לתצוגה</b></span>
              <span><Brain /> סיכום מסמך, שדות חסרים ותוקף <b>אישור אנושי</b></span>
              <span><Archive /> מדיניות שמירה לילדים, צוות, פיקוח ואירועים <b>לא מוחקת אוטומטית</b></span>
              <span><UploadCloud /> העלאה מרובה, מצלמה, גלריה וסריקה <b>מוכנות UX</b></span>
              <span><FileSearch /> Audit צפייה, הורדה, שינוי ומחיקה <b>נדרש הרחבה</b></span>
              <span><Receipt /> חוזים, חשבוניות וקבלות <b>סיווג קיים</b></span>
            </div>
          </CleanSection>
        </section>

        <section className="quick-actions-grid">
          <ActionCard title="סקירת מסמכים" text="אישור, דחייה ותוקף" href="/dashboard/admin/documents" icon={FileText} />
          <ActionCard title="תיקי אירוע" text="ראיות וציר חקירה" href="/dashboard/admin/incident-center" icon={FileArchive} />
          <ActionCard title="ביקורות" text="דוחות, חתימות ותמונות" href="/dashboard/admin/inspections" icon={ClipboardCheck} />
          <ActionCard title="תלונות" text="קבצים ותשובות" href="/dashboard/admin/complaints" icon={FileSearch} />
          <ActionCard title="ציות" text="חידושים והתראות" href="/dashboard/admin/compliance-center" icon={ShieldCheck} />
          <ActionCard title="דוחות" text="ייצוא ותיעוד" href="/dashboard/admin/reports" icon={FileArchive} />
        </section>
      </div>
    </DashboardShell>
  );
}
