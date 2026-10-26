import { createHash } from "node:crypto";

const LIMIT = 1024 * 1024;
const MAX_ITEMS = 4096;
const DOMAINS = new Set(["GENERIC", "SNAPSHOT-CONTENT", "SNAPSHOT-ENVELOPE"]);
const SCOPE_KEYS = ["tenantId", "siteId", "sourceId", "eventId", "incidentId", "riskDecisionId"];
const CONTENT_KEYS = ["schemaVersion", "scope", "decisionCode", "severity", "settingsVersion",
  "policyVersion", "capturedAt", "recipients"];

function fail(reason) { throw new Error(`CANON_V1_${reason}`); }
function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).length !== keys.length
    || keys.some(key => !Object.hasOwn(value, key))) fail("SHAPE_INVALID");
}
function utf8(value) {
  if (value.includes("\0")) fail("TEXT_INVALID");
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail("TEXT_INVALID");
    } else if (unit >= 0xdc00 && unit <= 0xdfff) fail("TEXT_INVALID");
  }
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > LIMIT) fail("SIZE_EXCEEDED");
  return bytes;
}
function lengthHex(length) {
  if (!Number.isInteger(length) || length < 0 || length > LIMIT) fail("SIZE_EXCEEDED");
  return Buffer.from(length.toString(16).padStart(8, "0") + ":", "ascii");
}
function byteOrder(a, b) { return Buffer.compare(utf8(a), utf8(b)); }

export function canonicalBytesV1(value, depth = 0) {
  if (depth > 32) fail("DEPTH_EXCEEDED");
  if (value === null) return Buffer.from("Z", "ascii");
  if (typeof value === "boolean") return Buffer.from(value ? "B1" : "B0", "ascii");
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail("NUMBER_INVALID");
    return Buffer.from(`I${Object.is(value, -0) ? "0" : value};`, "ascii");
  }
  if (typeof value === "string") {
    const bytes = utf8(value);
    return Buffer.concat([Buffer.from("S", "ascii"), lengthHex(bytes.length), bytes]);
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ITEMS || Object.keys(value).length !== value.length) fail("SHAPE_INVALID");
    return Buffer.concat([Buffer.from("A", "ascii"), lengthHex(value.length),
      ...value.map(item => canonicalBytesV1(item, depth + 1))]);
  }
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const keys = Object.keys(value);
    if (keys.length > MAX_ITEMS) fail("SIZE_EXCEEDED");
    keys.sort(byteOrder);
    const parts = [Buffer.from("O", "ascii"), lengthHex(keys.length)];
    for (const key of keys) {
      parts.push(canonicalBytesV1(key, depth + 1), canonicalBytesV1(value[key], depth + 1));
    }
    return Buffer.concat(parts);
  }
  fail("TYPE_INVALID");
}

export function digestJsonV1(value, domain = "GENERIC") {
  if (!DOMAINS.has(domain)) fail("DOMAIN_INVALID");
  const body = canonicalBytesV1(value);
  if (body.length > LIMIT) fail("SIZE_EXCEEDED");
  return createHash("sha256").update(Buffer.from(`DO-DIGEST-V1:${domain}\0`, "utf8"))
    .update(body).digest("hex");
}

function sortedUnique(values, selector, maxLength = 128) {
  let previous;
  for (const value of values) {
    const current = selector(value);
    if (typeof current !== "string" || !current || utf8(current).length > maxLength
      || previous !== undefined && byteOrder(previous, current) >= 0) fail("ORDER_OR_DUPLICATE");
    previous = current;
  }
}

export function snapshotDigestsV1(content, expectedTenantId, expectedSiteId) {
  exactKeys(content, CONTENT_KEYS);
  exactKeys(content.scope, SCOPE_KEYS);
  if (content.schemaVersion !== 1
    || content.scope.tenantId !== expectedTenantId || content.scope.siteId !== expectedSiteId
    || SCOPE_KEYS.some(key => typeof content.scope[key] !== "string" || !content.scope[key])
    || ["decisionCode", "severity", "settingsVersion", "policyVersion"]
      .some(key => typeof content[key] !== "string" || !content[key] || utf8(content[key]).length > 128)
    || typeof content.capturedAt !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(content.capturedAt)
    || !Number.isFinite(Date.parse(content.capturedAt))
    || new Date(content.capturedAt).toISOString() !== content.capturedAt
    || !Array.isArray(content.recipients) || content.recipients.length > 100) fail("SNAPSHOT_INVALID");
  sortedUnique(content.recipients, recipient => recipient?.recipientRef);
  for (const recipient of content.recipients) {
    exactKeys(recipient, ["recipientRef", "channels"]);
    if (!Array.isArray(recipient.channels) || recipient.channels.length > 4) fail("SNAPSHOT_INVALID");
    sortedUnique(recipient.channels, channel => channel?.channel, 16);
    for (const channel of recipient.channels) {
      exactKeys(channel, ["channel", "enabled", "severityLevels"]);
      if (!["in_app", "email", "sms", "push"].includes(channel.channel)
        || typeof channel.enabled !== "boolean"
        || !Array.isArray(channel.severityLevels) || channel.severityLevels.length > 16) fail("SNAPSHOT_INVALID");
      sortedUnique(channel.severityLevels, level => level, 32);
    }
  }
  const fingerprint = digestJsonV1(content, "SNAPSHOT-CONTENT");
  const digest = digestJsonV1({ ...content, fingerprint }, "SNAPSHOT-ENVELOPE");
  return { fingerprint, digest };
}

export function assertSnapshotDigestsV1(content, tenantId, siteId, expected) {
  const actual = snapshotDigestsV1(content, tenantId, siteId);
  if (!expected || actual.fingerprint !== expected.fingerprint || actual.digest !== expected.digest) {
    fail("DIGEST_MISMATCH");
  }
  return true;
}
