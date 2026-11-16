import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const origin = "https://development.example.invalid";

async function click(workerPath, target) {
  const source = readFileSync(new URL(`../../${workerPath}`, import.meta.url), "utf8");
  const listeners = new Map();
  const opened = [];
  const self = {
    location: { origin },
    addEventListener: (type, listener) => listeners.set(type, listener),
    clients: {
      matchAll: async () => [],
      openWindow: async (url) => { opened.push(url); return null; }
    }
  };
  vm.runInNewContext(source, { self, URL, caches: {}, Response, fetch }, { timeout: 1000 });
  let pending;
  listeners.get("notificationclick")({
    notification: { data: { url: target }, close() {} },
    waitUntil: (promise) => { pending = promise; }
  });
  if (pending) await pending;
  assert.ok(opened.length <= 1);
  return opened[0] ?? null;
}

for (const [worker, fallback] of [
  ["public/sw.js", origin + "/dashboard"],
  ["public/firebase-messaging-sw.js", null]
]) {
  test(`${worker}: tap cannot open an external or cross-product destination`, async () => {
    for (const bad of [
      "https://attacker.example.invalid/phishing",
      "//attacker.example.invalid/phishing",
      "javascript:alert(1)",
      `${origin}/api/auth/logout`,
      "/dashboard/../api/auth/logout"
    ]) assert.equal(await click(worker, bad), fallback);
  });
}

test("Gan worker retains an authorized local dashboard destination", async () => {
  assert.equal(await click("public/sw.js", "/dashboard/parent"), origin + "/dashboard/parent");
  assert.equal(await click("public/sw.js", "/digital-observer/alerts"), origin + "/dashboard");
});

test("shared FCM worker retains local Gan and Observer resource destinations", async () => {
  assert.equal(await click("public/firebase-messaging-sw.js", "/dashboard/parent"), origin + "/dashboard/parent");
  assert.equal(await click("public/firebase-messaging-sw.js", "/digital-observer/alerts"),
    origin + "/digital-observer/alerts");
  assert.equal(await click("public/firebase-messaging-sw.js", null), null);
});
