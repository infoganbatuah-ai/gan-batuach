import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const TARGET_PATH = "/dashboard/inspector/inspections/due";
export const REQUEST_LIMIT = 6;
export const RUN_DEADLINE_MS = 35_000;
export const RECEIPT_LIMIT_BYTES = 1_048_576;
const STACK_LIMIT_BYTES = 16_384;
const FRAME_LIMIT = 20;
const FRAME_ROOTS = ["/_next/", "/node_modules/", "/app/", "/components/", "/lib/", "/src/"];

export function fingerprint(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function safeName(value) {
  const name = String(value ?? "");
  return /^(?:Error|TypeError|ReferenceError|SyntaxError|RangeError|URIError|AggregateError)$/.test(name) ? name : "OtherError";
}

export function errorCategory(value) {
  const message = String(value ?? "");
  if (message.includes("The server could not finish this Suspense boundary")) return "SUSPENSE_SERVER_FALLBACK";
  if (message.includes("Failed to fetch RSC payload")) return "RSC_FETCH_FALLBACK";
  if (message.includes("Hydration failed")) return "HYDRATION_ERROR";
  if (message.includes("Fast Refresh had to perform a full reload")) return "HMR_FULL_RELOAD";
  if (message.includes("Cannot read properties of")) return "PROPERTY_ACCESS_ERROR";
  return "UNCLASSIFIED";
}

function safeFunction(value) {
  const name = String(value ?? "").trim();
  return name.length <= 100 && (/^[A-Za-z_$][A-Za-z0-9_.$]*$/.test(name) || name === "<anonymous>") ? name : "<anonymous>";
}

function safeModule(value) {
  let source = String(value ?? "").replaceAll("\\", "/").split(/[?#]/, 1)[0];
  if (/^https?:\/\//.test(source)) {
    try {
      const url = new URL(source);
      if (!["127.0.0.1", "localhost"].includes(url.hostname)) return "<external-module>";
      source = url.pathname;
    } catch { return "<unknown-module>"; }
  }
  const root = FRAME_ROOTS.find((part) => source.includes(part));
  if (!root) return "<unknown-module>";
  const parts = source.slice(source.indexOf(root) + 1).split("/").slice(0, 12);
  return parts.map((part) => {
    if (!/^[A-Za-z0-9_.@-]{1,80}$/.test(part) || /[A-Za-z0-9_-]{30,}/.test(part) || /@/.test(part) && !part.startsWith("@")) return "<redacted>";
    return part;
  }).join("/").slice(0, 360);
}

function boundedFrames(frames) {
  const safe = [];
  for (const frame of frames.slice(0, FRAME_LIMIT)) {
    const line = Number(frame.lineNumber ?? frame.line);
    const column = Number(frame.columnNumber ?? frame.column);
    const item = {
      function: safeFunction(frame.functionName ?? frame.function),
      module: safeModule(frame.url ?? frame.module),
      line: Number.isSafeInteger(line) && line >= 0 && line < 1_000_000 ? line : null,
      column: Number.isSafeInteger(column) && column >= 0 && column < 1_000_000 ? column : null,
    };
    if (Buffer.byteLength(JSON.stringify([...safe, item])) > STACK_LIMIT_BYTES) break;
    safe.push(item);
  }
  return safe;
}

function parseStack(stack) {
  const frames = [];
  for (const line of String(stack ?? "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("at ")) continue;
    const body = trimmed.slice(3);
    const opening = body.lastIndexOf(" (");
    const functionName = opening < 0 ? "<anonymous>" : body.slice(0, opening);
    const location = opening < 0 ? body : body.slice(opening + 2).replace(/\)$/, "");
    const match = location.match(/^(.*):(\d+):(\d+)$/);
    if (match) frames.push({ functionName, url: match[1], lineNumber: Number(match[2]), columnNumber: Number(match[3]) });
  }
  return frames;
}

export function sanitizeError(error) {
  const stack = String(error?.stack ?? "");
  return {
    name: safeName(error?.name),
    category: errorCategory(error?.message),
    message: "OMITTED_UNTRUSTED",
    fingerprint: fingerprint(stack || error?.message),
    frames: boundedFrames(parseStack(stack)),
  };
}

export function sanitizeInitiator(initiator) {
  const type = String(initiator?.type ?? "");
  return {
    type: ["parser", "script", "preload", "preflight", "other"].includes(type) ? type : "unknown",
    frames: boundedFrames(Array.isArray(initiator?.stack?.callFrames) ? initiator.stack.callFrames : []),
  };
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
