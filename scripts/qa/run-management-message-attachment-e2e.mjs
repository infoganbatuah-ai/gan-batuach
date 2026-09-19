// Explicitly local-only QA. Supply disposable Auth users and keys through a
// restricted environment file; never print credentials or signed URLs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const config = {
  app: process.env.GB_M29_QA_APP_URL,
  supabase: process.env.GB_M29_QA_SUPABASE_URL,
  anon: process.env.GB_M29_QA_ANON_KEY,
  service: process.env.GB_M29_QA_SERVICE_KEY,
  identitiesFile: process.env.GB_M29_QA_IDENTITIES_FILE,
  thread: process.env.GB_M29_QA_THREAD_ID,
  message: process.env.GB_M29_QA_MESSAGE_ID
};
for (const [name, value] of Object.entries(config)) assert.ok(value, `Missing GB-M29 local QA setting: ${name}`);
for (const url of [config.app, config.supabase]) {
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(url).hostname), "GB-M29 E2E is loopback-only");
}

const bucket = "management-message-attachments";
const root = `${config.app}/api/communication/threads/${config.thread}/messages/${config.message}/attachments`;
const userIds = {
  parentA: "00000000-0000-4000-8000-000000000101", parentB: "00000000-0000-4000-8000-000000000102",
  managerA: "00000000-0000-4000-8000-000000000201", managerB: "00000000-0000-4000-8000-000000000202",
  staffB: "00000000-0000-4000-8000-000000000302", revokedStaff: "00000000-0000-4000-8000-000000000305",
  inspector: "00000000-0000-4000-8000-000000000401", admin: "00000000-0000-4000-8000-000000000501"
};
const privateIdentities = JSON.parse(readFileSync(config.identitiesFile, "utf8"));
const identities = Object.fromEntries(Object.entries(userIds).map(([role, id]) => {
  const user = privateIdentities.users.find((item) => item.id === id);
  assert.ok(user?.email && user?.password, `Missing disposable ${role} identity`);
  return [role, user];
}));

async function cookieFor(identity) {
  const jar = new Map();
  const client = createServerClient(config.supabase, config.anon, {
    cookieOptions: { path: "/", sameSite: "lax", secure: false },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value))
    }
  });
  const { error } = await client.auth.signInWithPassword({ email: identity.email, password: identity.password });
  assert.ifError(error);
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function api(url, cookie, options = {}) {
  return fetch(url, { ...options, redirect: "manual", headers: {
    ...(cookie ? { Cookie: cookie } : {}), ...options.headers
  } });
}

const cookies = {};
for (const [role, identity] of Object.entries(identities)) cookies[role] = await cookieFor(identity);
const bytes = new TextEncoder().encode("%PDF-1.4\nGB-M29 synthetic attachment QA\n%%EOF\n");
const form = new FormData();
form.set("file", new File([bytes], "synthetic.pdf", { type: "application/pdf" }));
const created = await api(root, cookies.parentA, { method: "POST", body: form });
assert.equal(created.status, 201, `authorized upload returned ${created.status}`);
const payload = (await created.json()).data;
assert.equal(payload.message_id, config.message);
assert.ok(payload.id && payload.download_path);

const admin = createClient(config.supabase, config.service, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: metadata, error: metadataError } = await admin.from("management_message_attachments")
  .select("id,storage_path,thread_id,message_id,garden_id").eq("id", payload.id).single();
assert.ifError(metadataError);
assert.equal(metadata.thread_id, config.thread);
assert.equal(metadata.message_id, config.message);
const detail = await api(`${config.app}/api/communication/threads/${config.thread}`, cookies.parentA);
assert.equal(detail.status, 200);
const detailBody = (await detail.json()).data;
assert.ok(detailBody.attachments.some((item) => item.id === payload.id && item.download_path === payload.download_path));
assert.ok(!JSON.stringify(detailBody).includes(metadata.storage_path), "private object path exposed in thread detail");
const { data: bucketInfo, error: bucketError } = await admin.storage.getBucket(bucket);
assert.ifError(bucketError);
assert.equal(bucketInfo.public, false);

const downloadUrl = `${config.app}${payload.download_path}`;
for (const role of ["parentA", "managerA"]) {
  const response = await api(downloadUrl, cookies[role]);
  assert.equal(response.status, 302, `${role} signed retrieval returned ${response.status}`);
  const signed = response.headers.get("location");
  assert.ok(signed && !signed.includes("/public/"), "raw public URL exposed");
  const object = await fetch(signed);
  assert.equal(object.status, 200, `${role} signed object returned ${object.status}`);
  assert.deepEqual(new Uint8Array(await object.arrayBuffer()), bytes);
}
for (const role of ["parentB", "managerB", "staffB", "revokedStaff", "inspector", "admin"]) {
  const response = await api(downloadUrl, cookies[role]);
  assert.equal(response.status, 404, `${role} gained attachment access`);
}
assert.equal((await api(root, cookies.parentB, { method: "POST" })).status, 404, "unrelated Parent uploaded to thread");
assert.equal((await api(root, cookies.managerA, { method: "POST" })).status, 403, "non-sender attached to message");
assert.equal((await api(downloadUrl, null)).status, 401, "unauthenticated retrieval allowed");
const wrongId = downloadUrl.replace(payload.id, "00000000-0000-4000-8000-000000000001");
assert.equal((await api(wrongId, cookies.parentA)).status, 404, "altered attachment ID allowed");
const wrongThread = downloadUrl.replace(config.thread, "00000000-0000-4000-8000-000000000002");
assert.equal((await api(wrongThread, cookies.parentA)).status, 404, "altered thread ID allowed");

const anon = createClient(config.supabase, config.anon, { auth: { persistSession: false, autoRefreshToken: false } });
const raw = await anon.storage.from(bucket).download(metadata.storage_path);
assert.ok(raw.error, "raw anonymous Storage download allowed");
const publicUrl = `${config.supabase}/storage/v1/object/public/${bucket}/${metadata.storage_path}`;
assert.notEqual((await fetch(publicUrl)).status, 200, "public raw URL exposed object");
assert.ok((await anon.storage.from(bucket).createSignedUrl(metadata.storage_path, 60)).error,
  "anonymous actor could create a fresh signed URL");
const parent = createClient(config.supabase, config.anon, { auth: { persistSession: false, autoRefreshToken: false } });
assert.ifError((await parent.auth.signInWithPassword({ email: identities.parentA.email, password: identities.parentA.password })).error);
const direct = await parent.storage.from(bucket).download(metadata.storage_path);
assert.ok(direct.error, "direct authenticated Storage download allowed");

const signedResponse = await api(downloadUrl, cookies.parentA);
assert.equal(signedResponse.status, 302);
await new Promise((resolve) => setTimeout(resolve, 65_000));
const expired = await fetch(signedResponse.headers.get("location"));
assert.notEqual(expired.status, 200, "signed URL remained valid after 60-second expiry");
console.log("GB-M29 private attachment E2E PASS: authorized participants, negative role/ID matrix, private storage, signed URL expiry");
