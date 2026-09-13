import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const sql = read("supabase/migrations/20260913210000_management_canonical_messaging_threads.sql");
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
