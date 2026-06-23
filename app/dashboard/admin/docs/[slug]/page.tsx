import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { FileText } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { PremiumCard, SectionHeader, StatusChip } from "@/components/gan-batuach-design-system";
import { RoleAppShell } from "@/components/role-app-shell";

const allowedDocs: Record<string, { file: string; title: string }> = {
  "COMMERCIAL_LAUNCH_READINESS_AND_SALES_OPERATIONS_PLATFORM": {
    file: "COMMERCIAL_LAUNCH_READINESS_AND_SALES_OPERATIONS_PLATFORM.md",
    title: "Commercial Launch Readiness"
  },
  "GAN_BATUACH_LEGAL_ARCHITECTURE_PACK": {
    file: "GAN_BATUACH_LEGAL_ARCHITECTURE_PACK.md",
    title: "Legal Architecture Pack"
  },
  "CAMERA_COMPLIANCE_EXTERNAL_REVIEW_PACK": {
    file: "CAMERA_COMPLIANCE_EXTERNAL_REVIEW_PACK.md",
    title: "Camera Compliance Review"
  },
  "DPIA_EXTERNAL_REVIEW_PACK": {
    file: "DPIA_EXTERNAL_REVIEW_PACK.md",
    title: "DPIA External Review"
  },
  "DATA_PROCESSING_AGREEMENT_READINESS": {
    file: "DATA_PROCESSING_AGREEMENT_READINESS.md",
    title: "DPA Readiness"
  },
  "APP_STORE_GOOGLE_PLAY_SUBMISSION_READINESS": {
    file: "APP_STORE_GOOGLE_PLAY_SUBMISSION_READINESS.md",
    title: "App Store / Google Play Readiness"
  },
  "PENETRATION_TEST_RULES_OF_ENGAGEMENT": {
    file: "PENETRATION_TEST_RULES_OF_ENGAGEMENT.md",
    title: "Penetration Test Rules of Engagement"
  },
  "SECURITY_ARCHITECTURE_EXTERNAL_REVIEW_PACK": {
    file: "SECURITY_ARCHITECTURE_EXTERNAL_REVIEW_PACK.md",
    title: "Security Architecture External Review"
  },
  "EXTERNAL_SECURITY_REVIEW_CHECKLIST": {
    file: "EXTERNAL_SECURITY_REVIEW_CHECKLIST.md",
    title: "External Security Review Checklist"
  },
  "EXTERNAL_PENETRATION_TEST_AND_SECURITY_REVIEW_PREPARATION": {
    file: "EXTERNAL_PENETRATION_TEST_AND_SECURITY_REVIEW_PREPARATION.md",
    title: "External Penetration Test Preparation"
  }
};

export default async function AdminDocViewerPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireRole(["admin"]);
  const { slug } = await params;
  const doc = allowedDocs[slug];
  const content = doc ? await readFile(path.join(/* turbopackIgnore: true */ process.cwd(), doc.file), "utf8").catch(() => null) : null;

  return (
    <RoleAppShell role="admin" activeHref="/dashboard/admin" title={doc?.title ?? "מסמך לא נמצא"} subtitle="צפייה פנימית במסמכי מוכנות, בלי חשיפה ישירה של קבצי repository.">
      <div className="admin-doc-viewer">
        <SectionHeader
          title={doc?.title ?? "מסמך לא נמצא"}
          subtitle="מסמכי readiness מוצגים רק לאדמין ומיועדים לתפעול פנימי."
          icon={FileText}
          action={<Link className="button secondary" href="/dashboard/admin">חזרה לאדמין</Link>}
        />
        <PremiumCard>
          {content ? (
            <>
              <StatusChip tone="warning">Internal readiness document</StatusChip>
              <pre className="admin-doc-viewer-pre">{content}</pre>
            </>
          ) : (
            <div className="empty-state">
              <strong>המסמך לא נמצא או לא מאושר לצפייה פנימית.</strong>
              <span>הקישור נשמר בטוח ולא חושף קובץ פרטי ישירות.</span>
            </div>
          )}
        </PremiumCard>
      </div>
    </RoleAppShell>
  );
}
