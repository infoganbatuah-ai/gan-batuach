import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const sql = read("supabase/migrations/20260913210000_management_canonical_messaging_threads.sql");
const hardening = read("supabase/migrations/20260913211000_management_messaging_qa_hardening.sql");
const attachmentsSql = read("supabase/migrations/20260913212000_management_private_message_attachments.sql");
const attachmentUpload = read("app/api/communication/threads/[id]/messages/[messageId]/attachments/route.ts");
const attachmentDownload = read("app/api/communication/threads/[id]/messages/[messageId]/attachments/[attachmentId]/route.ts");
const threads = read("app/api/communication/threads/route.ts");
const message = read("app/api/communication/threads/[id]/route.ts");
const broadcast = read("app/api/communication/broadcasts/route.ts");
const garden = read("app/dashboard/garden/messages/page.tsx");
const staff = read("app/dashboard/staff/messages/page.tsx");
const parent = read("app/dashboard/parent/messages/page.tsx");

test("canonical messages remain participant and current-relationship scoped", () => {
  assert.match(sql, /can_access_management_communication_thread/);
  assert.match(sql, /can_guardian_access_child\(child\.permanent_child_file_id, 'education'\)/);
  assert.match(sql, /enrollment\.status='active'/);
  assert.match(sql, /t\.child_id is null or child\.id=t\.child_id/);
  assert.match(sql, /can_manage_garden\(t\.garden_id\)/);
  assert.match(sql, /can_staff_access_garden\(t\.garden_id\)/);
  assert.match(sql, /staff_assignment\.classroom_id=child_assignment\.classroom_id/);
  assert.match(sql, /participant\.left_at is null/);
  assert.doesNotMatch(sql, /or public\.is_admin\(\).*communication thread participant read/);
});

test("direct sends derive authorization server-side and reject duplicate retries", () => {
  assert.match(threads, /create_management_communication_thread/);
  assert.match(threads, /Idempotency-Key/);
  assert.match(sql, /messages_sender_idempotency_key_unique/);
  assert.match(sql, /communication_child_denied/);
  assert.match(sql, /communication_recipient_denied/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(message, /send_management_communication_message/);
});

test("read state is per participant and canonical tables reject direct writes", () => {
  assert.match(sql, /last_read_message_id/);
  assert.match(sql, /mark_management_communication_thread_read/);
  assert.match(sql, /revoke insert, update, delete on public\.communication_threads/);
  assert.match(sql, /revoke insert, update, delete on public\.messages/);
});

test("broadcast recipients are a single authorized audience snapshot", () => {
  assert.match(sql, /create_management_communication_broadcast/);
  assert.match(sql, /'audience_snapshot',recipients/);
  assert.match(sql, /enrollment\.garden_id=p_garden_id and enrollment\.status='active'/);
  assert.match(sql, /p_classroom_id is null or assignment\.classroom_id=p_classroom_id/);
  assert.match(sql, /communication_broadcast_empty_audience/);
  assert.match(broadcast, /audience: z\.enum\(\["parents", "staff"\]\)/);
  assert.match(broadcast, /Idempotency-Key/);
});

test("inspector and Admin are absent from operational messaging recipient surfaces", () => {
  assert.doesNotMatch(garden, /inspectorsRes/);
  assert.doesNotMatch(staff, /inspector:inspector_id/);
  assert.match(garden, /Complaints and privileged support use their own audited workflows/);
  assert.match(parent, /InternalMessagingCenter/);
});

test("messaging stays separate from complaint and task lifecycle state", () => {
  assert.match(sql, /Complaint, Task and Notification remain independent domains/);
  assert.doesNotMatch(sql, /update public\.complaints set/);
  assert.doesNotMatch(sql, /update public\.tasks set/);
});

test("attachment URLs are not accepted by the canonical messaging route", () => {
  assert.doesNotMatch(threads, /attachment_urls/);
  assert.doesNotMatch(message, /attachment_urls/);
  assert.match(sql, /canonical management message participant read/);
});

test("QA hardening enforces Classroom scope and removes direct destructive grants", () => {
  assert.match(hardening, /ca\.child_id=child_row\.id and ca\.is_current/);
  assert.match(hardening, /sa\.classroom_id/);
  assert.match(hardening, /membership\.status='active' and membership\.ended_at is null/);
  assert.match(hardening, /revoke truncate, references, trigger on public\.communication_threads/);
  assert.match(hardening, /public\.messages from anon, authenticated/);
  assert.match(hardening, /revoke execute on function public\.create_management_communication_thread/);
  assert.match(hardening, /from public, anon/);
});

test("same-key checks run after serialization in all messaging mutations", () => {
  const create = hardening.split("create or replace function public.create_management_communication_thread(")[1].split("create or replace function public.send_management_communication_message(")[0];
  const send = hardening.split("create or replace function public.send_management_communication_message(")[1].split("create or replace function public.create_management_communication_broadcast(")[0];
  const broadcastSql = hardening.split("create or replace function public.create_management_communication_broadcast(")[1];
  assert.ok(create.indexOf("pg_advisory_xact_lock") < create.indexOf("if p_idempotency_key is not null"));
  assert.ok(send.indexOf("for update") < send.indexOf("if p_idempotency_key is not null"));
  assert.ok(broadcastSql.indexOf("pg_advisory_xact_lock") < broadcastSql.indexOf("if p_idempotency_key is not null"));
});

test("message attachments use private Storage and current thread authority", () => {
  assert.match(attachmentsSql, /'management-message-attachments', false, 5242880/);
  assert.match(attachmentsSql, /as restrictive\s+for all to public using \(bucket_id <> 'management-message-attachments'\)/);
  assert.match(attachmentsSql, /can_access_management_communication_thread\(thread_id\)/);
  assert.match(attachmentsSql, /m\.thread_id=new\.thread_id/);
  assert.match(attachmentsSql, /m\.sender_id=new\.uploaded_by/);
  assert.match(attachmentUpload, /message\.sender_id !== session\.profile\.id/);
  assert.match(attachmentUpload, /\.eq\("thread_id", threadId\)/);
  assert.match(attachmentDownload, /\.eq\("thread_id", threadId\)\.eq\("message_id", messageId\)/);
  assert.match(attachmentDownload, /\.createSignedUrl\(attachment\.storage_path, 60, \{ download: true \}\)/);
  assert.match(attachmentDownload, /"Cache-Control": "private, no-store"/);
  assert.doesNotMatch(attachmentUpload + attachmentDownload, /getPublicUrl/);
});
