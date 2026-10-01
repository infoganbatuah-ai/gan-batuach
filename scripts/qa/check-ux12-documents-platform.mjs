import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const [workspace, css, api, fileApi, reviewApi, policy, migration, garden, parent, staff, inspector, admin, adminAlias, nav, routes] = await Promise.all([
  read("components/documents-platform.tsx"),
  read("app/styles/ux-implement-12.css"),
  read("app/api/documents/route.ts"),
  read("app/api/documents/[id]/file/route.ts"),
  read("app/api/documents/[id]/review/route.ts"),
  read("lib/management/document-policy.ts"),
  read("supabase/migrations/20260920130000_management_private_documents.sql"),
  read("app/dashboard/garden/documents/page.tsx"),
  read("app/dashboard/parent/documents/page.tsx"),
  read("app/dashboard/staff/documents/page.tsx"),
  read("app/dashboard/inspector/documents/page.tsx"),
  read("app/dashboard/admin/documents/page.tsx"),
  read("app/dashboard/admin/document-center/page.tsx"),
  read("components/role-app-shell.tsx"),
  read("lib/dashboard-route-safety.ts")
]);

test("Documents remain the canonical private domain", () => {
  assert.match(api, /register_management_document/);
  assert.match(api, /supportedDocumentSignature/);
  assert.match(api, /maxBytes = 12 \* 1024 \* 1024/);
  assert.match(api, /replaces_document_id/);
  assert.match(migration, /management documents server only/);
  assert.match(migration, /bucket_id <> 'documents'/);
  assert.match(fileApi, /createSignedUrl/);
  assert.match(fileApi, /60/);
  assert.doesNotMatch(workspace, /storage_path|storage_bucket/);
});

test("Documents, message attachments and inspection evidence stay separate", () => {
  assert.match(migration, /attachments\/evidence[\s\S]*retain their own domain tables/);
  assert.doesNotMatch(admin, /incident_case_evidence|inspection_answers|message_attachments/);
  assert.match(adminAlias, /redirect\("\/dashboard\/admin\/documents"\)/);
  assert.match(inspector, /ראיות ממצאים נשארות במרחב הראיות הנפרד/);
});

test("Upload, replacement, verification, rejection and expiry use server authority", () => {
  assert.match(workspace, /uploadManagementDocument/);
  assert.match(workspace, /replaces_document_id/);
  assert.match(workspace, /DocumentReviewActions/);
  assert.match(reviewApi, /review_management_document/);
  assert.match(policy, /effectiveDocumentStatus/);
  assert.match(policy, /expiring_soon/);
  assert.match(migration, /rejection_reason/);
  assert.doesNotMatch(workspace, /status\s*=\s*["']valid|localStorage/);
});

test("Role pages use RLS-scoped session clients and canonical owner targets", () => {
  for (const source of [garden, parent, staff, inspector, admin]) {
    assert.match(source, /createClient/);
    assert.doesNotMatch(source, /createAdminClient|service_role/);
    assert.match(source, /DocumentsPlatform/);
  }
  assert.match(parent, /getParentFamilyContext/);
  assert.match(staff, /resolveStaffEmploymentContext/);
  assert.match(inspector, /requireOperationalRole\(\["inspector"\]\)/);
  assert.match(admin, /\["garden", "owner", "teacher", "inspection"\]/);
  assert.match(nav, /\/dashboard\/inspector\/documents/);
  assert.match(routes, /\/dashboard\/inspector\/documents/);
});

test("The Documents Center matches the approved Desktop and Mobile composition", () => {
  for (const selector of ["documents-hero", "documents-metrics", "documents-category-strip", "documents-workspace", "documents-list-pane", "document-detail-pane", "document-secure-preview", "document-upload-sheet", "document-history-card"]) {
    assert.match(css, new RegExp("\\." + selector));
  }
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(workspace, /role="dialog"/);
  assert.match(workspace, /aria-modal="true"/);
  assert.match(workspace, /aria-live="polite"/);
  assert.match(workspace, /PDF, JPG, PNG או WEBP · עד 12MB/);
});

test("Unsupported and unavailable states are explicit", () => {
  assert.match(workspace, /תצוגה אינה זמינה/);
  assert.match(workspace, /לא נמצאו מסמכים/);
  assert.match(workspace, /אין מסמכים בתצוגה הזו/);
  assert.match(workspace, /העלאת המסמך נכשלה/);
  assert.match(workspace, /נדרשת החלפה/);
});
