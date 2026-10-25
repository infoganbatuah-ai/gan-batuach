import { SYNTHETIC_QA } from "./push44-ch1-private-media.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { dirname } from "node:path";

const deny = () => { throw new Error("QA_OWNER_ACTION_DENIED"); };
const keyPattern = /^[A-Za-z0-9_-]{43}$/;
const runFile = promisify(execFile);

// Compile and verify the reviewed Swift helper separately, then point this
// adapter at its protected absolute binary path. No shell or reusable code.
export function createPush44QaMacOwnerPresence({ helperPath, expectedSha256 } = {}) {
  if (process.platform !== "darwin" || typeof helperPath !== "string" ||
    !helperPath.startsWith("/") || helperPath.includes("..") ||
    !/^[0-9a-f]{64}$/.test(expectedSha256 || ""))
    throw new Error("QA_OWNER_PRESENCE_HELPER_REQUIRED");
  return async ({ operation, keyId }) => {
    try {
      const path = realpathSync(helperPath);
      const file = statSync(path), directory = statSync(dirname(path));
      if (path.startsWith("/Volumes/") || !file.isFile() ||
        file.uid !== process.getuid() || directory.uid !== process.getuid() ||
        (file.mode & 0o077) !== 0 || (directory.mode & 0o077) !== 0 ||
        createHash("sha256").update(readFileSync(path)).digest("hex") !== expectedSha256) return false;
      const { stdout, stderr } = await runFile(path,
        [operation, (keyId || "approval").slice(0, 16)],
        { timeout: 35_000, maxBuffer: 64, encoding: "utf8", env: { PATH: "/usr/bin:/bin" } });
      return stdout === "PRESENT\n" && stderr === "";
    } catch { return false; }
  };
}

// This is a host-only operator action, never an HTTP handler. The authorization
// reader must obtain its result server-side from the canonical Development
// owner record; caller-supplied JWT claims or user metadata are not sufficient.
// Presence is a fresh OS owner-authentication ceremony, not a reusable code.
export function createPush44QaOwnerAction({ expectedOwnerProfileId, readOwnerAuthorization, confirmHostPresence,
  now = Date.now } = {}) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(expectedOwnerProfileId || "") ||
    expectedOwnerProfileId === SYNTHETIC_QA.viewerId ||
    ![readOwnerAuthorization, confirmHostPresence, now].every(fn => typeof fn === "function"))
    throw new Error("QA_OWNER_ACTION_ADAPTERS_REQUIRED");
  let pending = false;
  return async ({ context, principal, keyId, enrollmentRequestId, purpose, operation, ownerAction }) => {
    if (pending || ownerAction !== undefined || !["AUTHORIZE_ENROLLMENT", "REVOKE_APPROVAL", "REVOKE"].includes(operation) ||
      principal?.verified !== true || principal.active !== true ||
      principal.environment !== SYNTHETIC_QA.viewerEnvironment || principal.viewerId !== SYNTHETIC_QA.viewerId ||
      typeof principal.sessionId !== "string" || principal.sessionId.length < 16 ||
      typeof purpose !== "string" || purpose.trim().length < 12 || purpose.length > 256 ||
      (operation !== "REVOKE_APPROVAL" && !keyPattern.test(keyId || "")) ||
      (operation === "AUTHORIZE_ENROLLMENT" && !/^[A-Za-z0-9_-]{16,96}$/.test(enrollmentRequestId || ""))) deny();
    pending = true;
    try {
      const owner = await readOwnerAuthorization({ context, principal, keyId, enrollmentRequestId, operation });
      if (owner?.verified !== true || owner.active !== true || owner.owner !== true ||
        owner.environment !== SYNTHETIC_QA.viewerEnvironment ||
        owner.profileId !== expectedOwnerProfileId || owner.profileId === principal.viewerId ||
        typeof owner.sessionId !== "string" || owner.sessionId.length < 16 ||
        owner.sessionId === principal.sessionId ||
        owner.tenantId !== SYNTHETIC_QA.tenantId || owner.siteId !== SYNTHETIC_QA.siteId ||
        !Number.isSafeInteger(owner.expiresAt) || owner.expiresAt <= now() ||
        owner.expiresAt > now() + 60_000) deny();
      // No reusable approval token is returned. The existing durable store
      // creates and consumes the one-use, key-bound approval after this step.
      const present = await confirmHostPresence({ operation, purpose,
        keyId: keyId || null, enrollmentRequestId: enrollmentRequestId || null, profileId: owner.profileId });
      if (present !== true) deny();
      const latest = await readOwnerAuthorization({ context, principal, keyId, enrollmentRequestId, operation });
      if (latest?.verified !== true || latest.active !== true || latest.owner !== true ||
        latest.profileId !== owner.profileId || latest.sessionId !== owner.sessionId ||
        latest.tenantId !== owner.tenantId || latest.siteId !== owner.siteId ||
        !Number.isSafeInteger(latest.expiresAt) || latest.expiresAt <= now()) deny();
      return true;
    } catch { deny(); }
    finally { pending = false; }
  };
}
