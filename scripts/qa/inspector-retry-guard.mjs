import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const TARGET_PATH = "/dashboard/inspector/inspections/due";
export const REQUEST_LIMIT = 6;
export const RUN_DEADLINE_MS = 35_000;
export const RECEIPT_LIMIT_BYTES = 1_048_576;

export function fingerprint(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

export function requestCategory(request, origin) {
  const url = new URL(request.url());
  if (url.origin !== origin || url.pathname !== TARGET_PATH) return null;
  const headers = request.headers();
  const kind = request.resourceType() === "document" ? "document" :
    headers.rsc === "1" || headers.RSC === "1" ? "rsc" : null;
  if (!kind) return null;
  let initiator = "unknown";
  try {
    const frameUrl = new URL(request.frame().url());
    initiator = frameUrl.origin !== origin ? "other-origin" : frameUrl.pathname === TARGET_PATH ? "same-target" : "other-app-route";
  } catch { /* Navigation requests may have no frame yet. */ }
  return { kind, initiator, navigation: request.isNavigationRequest(), redirected: Boolean(request.redirectedFrom()) };
}

export function createRequestGuard({ origin, now = () => Date.now(), onLimit = () => {} }) {
  const attempts = [];
  let limited = false;
  return {
    attempts,
    get limited() { return limited; },
    async route(route) {
      const category = requestCategory(route.request(), origin);
      if (category) {
        attempts.push({ at: new Date(now()).toISOString(), ...category, disposition: attempts.length < REQUEST_LIMIT ? "allowed" : "blocked" });
        if (attempts.length > REQUEST_LIMIT) {
          limited = true;
          try { await route.abort("blockedbyclient"); }
          finally { onLimit(); }
          return;
        }
      }
      await route.continue();
    },
  };
}

export async function withinDeadline(work, milliseconds, onDeadline = () => {}) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise((_, reject) => {
        timer = setTimeout(() => { onDeadline(); reject(new Error("DIAGNOSTIC_DEADLINE")); }, milliseconds);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function boundedCleanup(action, milliseconds = 3_000) {
  return withinDeadline(action, milliseconds, () => {});
}

export function persistReceipt(path, receipt) {
  const content = `${JSON.stringify(receipt, null, 2)}\n`;
  if (Buffer.byteLength(content) > RECEIPT_LIMIT_BYTES) throw new Error("RECEIPT_SIZE_LIMIT");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, content, { flag: "wx", mode: 0o600 });
  return fingerprint(content);
}
