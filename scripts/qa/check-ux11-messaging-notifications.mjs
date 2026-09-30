import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const [messages, broadcasts, notifications, preferences, threadsApi, detailApi, broadcastApi, preferenceApi, delivery, gardenApi, inspector, css, migration, attachments] = await Promise.all([
  read("components/internal-messaging-center.tsx"),
  read("components/broadcast-center.tsx"),
  read("components/notification-center.tsx"),
  read("components/parent-notification-preferences.tsx"),
  read("app/api/communication/threads/route.ts"),
  read("app/api/communication/threads/[id]/route.ts"),
  read("app/api/communication/broadcasts/route.ts"),
  read("app/api/profile/communication-preferences/route.ts"),
  read("lib/management/external-delivery.ts"),
  read("app/api/garden/communication/route.ts"),
  read("app/dashboard/inspector/messages/page.tsx"),
  read("app/globals.css"),
  read("supabase/migrations/20260913210000_management_canonical_messaging_threads.sql"),
  read("app/api/communication/threads/[id]/messages/[messageId]/attachments/route.ts")
]);

test("Messaging uses canonical participant-scoped threads and idempotent sends", () => {
  assert.match(messages, /\/api\/communication\/threads/);
  assert.match(messages, /Idempotency-Key/);
  assert.match(messages, /communication_thread_participants/);
  assert.match(threadsApi, /create_management_communication_thread/);
  assert.match(detailApi, /send_management_communication_message/);
  assert.match(migration, /can_access_management_communication_thread/);
  assert.doesNotMatch(messages, /localStorage|Math\.random/);
});

test("Messages, broadcasts, notifications, complaints and Tasks remain separate", () => {
  assert.match(migration, /Complaint, Task and Notification remain independent domains/);
  assert.match(broadcasts, /השיחות האישיות, המשימות והתלונות נשארות נפרדות/);
  assert.doesNotMatch(broadcastApi, /complaints|workflow_tasks/);
  assert.doesNotMatch(threadsApi, /mark.*task|mark.*complaint/i);
});

test("Private attachments use the canonical bucket and participant authorization", () => {
  assert.match(messages, /attachments/);
  assert.match(attachments, /isAdminClientConfigured/);
  assert.match(attachments, /message\.sender_id !== session\.profile\.id/);
  assert.match(attachments, /image\/jpeg/);
  assert.match(attachments, /application\/pdf/);
  assert.match(attachments, /maxBytes = 5 \* 1024 \* 1024/);
});

test("Broadcast audiences are the canonical Parent or active Staff snapshots", () => {
  assert.match(broadcastApi, /z\.enum\(\["parents", "staff"\]\)/);
  assert.match(migration, /audience_snapshot/);
  assert.match(migration, /employment\.status='active'/);
  assert.match(broadcasts, /כל הורי הגן/);
  assert.match(broadcasts, /עובדים פעילים בלבד/);
  assert.doesNotMatch(broadcasts, /best match|AI match|delivery rate/i);
});

test("Notifications use canonical read state, safe deep links and categories", () => {
  assert.match(notifications, /\/api\/notifications\/mark-read/);
  assert.match(notifications, /target\.startsWith\("\/dashboard\/"\)/);
  assert.match(notifications, /preference_category/);
  assert.match(notifications, /action_url/);
  assert.doesNotMatch(notifications, /window\.location|dangerouslySetInnerHTML/);
});

test("Quiet hours and provider readiness are truthful", () => {
  assert.match(preferences, /quiet_hours_start/);
  assert.match(preferences, /quiet_hours_end/);
  assert.match(preferenceApi, /Quiet hours require both start and end/);
  assert.match(delivery, /suppressed_quiet_hours/);
  assert.match(delivery, /whatsapp: "not_configured"/);
  assert.match(delivery, /sms: "not_configured"/);
  assert.match(gardenApi, /הערוץ שנבחר אינו מחובר לספק מסירה מאומת/);
  assert.doesNotMatch(preferences, /enabled by default|delivered successfully/i);
});

test("Inspector communication remains limited and cannot enter operational threads", () => {
  assert.match(inspector, /אין גישה לצ׳אט התפעולי של הגן/);
  assert.match(inspector, /מפקח מקבל התראות ופעולות רק בהקשר פיקוח/);
  assert.match(threadsApi, /\["parent", "manager", "owner", "staff"\]/);
  assert.doesNotMatch(threadsApi, /"inspector"/);
});

test("Desktop and Mobile have purpose-built RTL and accessible communication layouts", () => {
  for (const selector of ["communication-workspace", "communication-message-bubble", "broadcast-platform", "notification-platform", "notification-preferences-platform", "delivery-readiness-strip"]) {
    assert.match(css, new RegExp("\\." + selector));
  }
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(messages, /aria-label="רשימת שיחות"/);
  assert.match(notifications, /aria-label="רשימת התראות"/);
  assert.match(preferences, /aria-label="מוכנות ערוצי מסירה"/);
});
