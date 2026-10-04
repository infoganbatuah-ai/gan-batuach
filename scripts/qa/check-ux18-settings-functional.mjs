import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { config } from "../development/local-database.mjs";
import { localCredentials } from "../development/local-client.mjs";

const base = process.env.GB_UX18_BASE_URL ?? "http://127.0.0.1:3018";
assert.equal(new URL(base).hostname, "127.0.0.1");
assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
assert.equal((await fetch(`${base}/api/health`)).status, 200);
const keys = localCredentials();
assert.equal(keys.url, "http://127.0.0.1:55421");
const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
const identity = (email) => {
  const user = identities.users.find((item) => item.email === email);
  assert.ok(user?.password, `Missing synthetic identity ${email}`);
  return user;
};
const users = {
  owner: identity("owner-a@integration.qa.invalid"),
  parent: identity("parent-a@integration.qa.invalid"),
  staff: identity("staff-a@integration.qa.invalid"),
  inspector: identity("inspector-a@integration.qa.invalid"),
  admin: identity("admin@integration.qa.invalid")
};

async function session(user) {
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, {
    cookieOptions: { path: "/", sameSite: "lax", secure: false },
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value)) }
  });
  const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  assert.equal(login.error, null, login.error?.message);
  return { cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; "), id: login.data.user.id };
}

const sessions = Object.fromEntries(await Promise.all(Object.entries(users).map(async ([role, user]) => [role, await session(user)])));
async function request(role, path, init = {}) {
  return fetch(`${base}${path}`, { redirect: "manual", ...init, headers: { cookie: sessions[role].cookie, ...(init.headers ?? {}) } });
}

for (const [role, path] of Object.entries({ owner: "/dashboard/garden/settings", parent: "/dashboard/parent/settings", staff: "/dashboard/staff/settings", inspector: "/dashboard/inspector/settings", admin: "/dashboard/admin/settings" })) {
  const response = await request(role, path);
  assert.equal(response.status, 200, `${role} settings route`);
}

for (const [role, path] of [["parent", "/dashboard/garden/settings"], ["staff", "/dashboard/admin/settings"], ["inspector", "/dashboard/garden/settings"], ["owner", "/dashboard/admin/settings"]]) {
  const response = await request(role, path);
  const body = response.status === 200 ? await response.text() : "";
  assert.ok([302, 303, 307, 308].includes(response.status) || (response.status === 200 && /NEXT_REDIRECT|__next-page-redirect|redirect/i.test(body)), `${role} must be redirected away from ${path}; status=${response.status}; location=${response.headers.get("location")}`);
}

const admin = createSupabaseClient(keys.url, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
const ownerProfile = await admin.from("profiles").select("id,full_name,phone,address,emergency_contact,garden_id").eq("id", sessions.owner.id).single();
assert.equal(ownerProfile.error, null, ownerProfile.error?.message);
const garden = await admin.from("gardens").select("id,name").eq("id", ownerProfile.data.garden_id).single();
assert.equal(garden.error, null, garden.error?.message);

const ownerSave = await request("owner", "/api/profile/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ full_name: ownerProfile.data.full_name, phone: ownerProfile.data.phone ?? "", address: ownerProfile.data.address ?? "", emergency_contact: ownerProfile.data.emergency_contact ?? "", garden: { name: garden.data.name } }) });
assert.equal(ownerSave.status, 200, `Owner profile/Garden save failed: ${await ownerSave.text()}`);

const parentGardenWrite = await request("parent", "/api/profile/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ garden: { name: garden.data.name } }) });
assert.equal(parentGardenWrite.status, 403, "Parent must not mutate Garden settings");

const preferencesGet = await request("owner", "/api/profile/communication-preferences");
assert.equal(preferencesGet.status, 200);
const preferencesBody = await preferencesGet.json();
const current = preferencesBody.data?.preferences ?? preferencesBody.preferences ?? {};
const preferencesSave = await request("owner", "/api/profile/communication-preferences", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ preferred_language: current.preferred_language ?? "he", quiet_hours_start: current.quiet_hours_start ?? null, quiet_hours_end: current.quiet_hours_end ?? null, quiet_hours_timezone: current.quiet_hours_timezone ?? "Asia/Jerusalem" }) });
assert.equal(preferencesSave.status, 200, `Preference save failed: ${await preferencesSave.text()}`);

for (const role of Object.keys(users)) {
  const security = await request(role, "/dashboard/security-settings");
  assert.equal(security.status, 200, `${role} security route`);
}

console.log(JSON.stringify({ status: "PASS", environment: config.environment, productionAccess: false, roles: Object.keys(users), profileSave: "PASS", crossRoleIsolation: "PASS", gardenMutationIsolation: "PASS", notificationPreferences: "PASS", securityRoutes: "PASS" }, null, 2));
