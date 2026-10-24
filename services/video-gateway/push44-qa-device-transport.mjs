import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { createCh1DevelopmentAuthenticator } from "./push44-ch1-development-session.mjs";
import { createPush44QaDeviceProof } from "./push44-qa-device-proof.mjs";
import { createPush44QaEnrollmentApproval } from "./push44-qa-enrollment-approval.mjs";
import { createPush44QaOwnerAction } from "./push44-qa-owner-action.mjs";

const deny = () => { throw new Error("QA_DEVICE_TRANSPORT_DENIED"); };
const limited = value => typeof value === "string" && value.length <= 2048;

// Isolated Development control transport. It cannot bind a public interface;
// importing the module opens no listener. A later iPhone-facing HTTPS route
// requires a separate approved security review and activation step.
export function createPush44QaDeviceTransport({ proof, requestEnrollment, readRequestStatus, authenticate, database, trustedIngress,
  now = Date.now } = {}) {
  if (!proof || typeof requestEnrollment !== "function" || typeof readRequestStatus !== "function" ||
    typeof authenticate !== "function" || !database)
    throw new Error("QA_DEVICE_TRANSPORT_ADAPTERS_REQUIRED");
  if (typeof now !== "function") throw new Error("QA_DEVICE_TRANSPORT_CLOCK_REQUIRED");
  if (trustedIngress && (trustedIngress.hostname !== "qa-iphone-device-proof.ganbatuach.com" ||
    !/^[A-Za-z0-9_-]{43,96}$/.test(trustedIngress.localIngressKey || "") ||
    !Number.isSafeInteger(trustedIngress.expiresAt) || trustedIngress.expiresAt <= now() ||
    trustedIngress.expiresAt > now() + 30 * 60_000))
    throw new Error("QA_DEVICE_INGRESS_CONFIG_DENIED");
  database.exec(`CREATE TABLE IF NOT EXISTS push44_qa_transport_limit (
    id INTEGER PRIMARY KEY CHECK(id=1), attempts INTEGER NOT NULL DEFAULT 0
  );
  INSERT OR IGNORE INTO push44_qa_transport_limit(id) VALUES(1);
  CREATE TABLE IF NOT EXISTS push44_qa_transport_audit (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, event TEXT NOT NULL
  );`);
  const record = event => database.prepare("INSERT INTO push44_qa_transport_audit(at,event) VALUES(?,?)")
    .run(now(), event);
  const server = createServer(async (request, response) => {
    const reply = (status, value) => {
      response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store",
        "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" });
      response.end(JSON.stringify(value));
    };
    try {
      if (trustedIngress && now() >= trustedIngress.expiresAt) deny();
      // The counter survives process restarts; error or exhaustion denies
      // without calling any credential or enrollment adapter.
      if (database.prepare(`UPDATE push44_qa_transport_limit SET attempts=attempts+1
        WHERE id=1 AND attempts<1000`).run().changes !== 1) deny();
      const localHost = request.headers.host === `127.0.0.1:${server.address()?.port}`;
      const ingressKey = request.headers["x-do-qa-ingress-key"];
      const privateIngress = trustedIngress && request.headers.host === trustedIngress.hostname &&
        request.headers["x-forwarded-host"] === trustedIngress.hostname &&
        request.headers["x-forwarded-proto"] === "https" &&
        request.headers.origin === `https://${trustedIngress.hostname}` &&
        typeof ingressKey === "string" && ingressKey.length === trustedIngress.localIngressKey.length &&
        timingSafeEqual(Buffer.from(ingressKey), Buffer.from(trustedIngress.localIngressKey));
      if (request.socket.remoteAddress !== "127.0.0.1" || request.method !== "POST" ||
        request.headers.cookie || !(privateIngress || (localHost && !request.headers.origin && !trustedIngress)) ||
        request.headers["content-type"] !== "application/json" ||
        !/^Bearer [A-Za-z0-9._~-]{32,8192}$/.test(request.headers.authorization || "")) deny();
      const declaredLength = request.headers["content-length"];
      if (declaredLength !== undefined && (!/^\d{1,4}$/.test(declaredLength) || Number(declaredLength) > 2048)) deny();
      const path = request.url;
      if (!["/qa-device/request-enrollment", "/qa-device/status", "/qa-device/challenge", "/qa-device/enroll", "/qa-device/prove", "/qa-device/revoke"].includes(path)) deny();
      // The canonical Development adapter validates the actual server-side
      // session, not just the Bearer string or decoded JWT claims.
      const session = await authenticate(request);
      if (session?.verified !== true || session.active !== true) deny();
      const chunks = []; let bytes = 0;
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > 2048) deny();
        chunks.push(chunk);
      }
      const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!input || typeof input !== "object" || Array.isArray(input)) deny();
      const allowedFields = {
        "/qa-device/request-enrollment": ["publicKey"],
        "/qa-device/status": ["publicKey", "enrollmentRequestId"],
        "/qa-device/challenge": ["operation", "publicKey", "method", "path"],
        "/qa-device/enroll": ["publicKey", "challengeId", "signature"],
        "/qa-device/prove": ["challengeId", "signature", "method", "path"],
        "/qa-device/revoke": ["keyId", "purpose"]
      }[path];
      if (Object.keys(input).some(key => !allowedFields.includes(key))) deny();
      const context = request;
      record("STARTED");
      let result;
      if (path === "/qa-device/request-enrollment") {
        if (!limited(input.publicKey)) deny();
        result = await requestEnrollment({ context, publicKey: input.publicKey });
      } else if (path === "/qa-device/status") {
        if (!limited(input.publicKey) || !limited(input.enrollmentRequestId)) deny();
        result = await readRequestStatus({ context, publicKey: input.publicKey,
          enrollmentRequestId: input.enrollmentRequestId });
      } else if (path === "/qa-device/challenge") {
        if ((input.operation === "ENROLL" && !limited(input.publicKey)) ||
          (input.operation === "ACCESS" && input.publicKey !== undefined) ||
          !limited(input.operation) || !limited(input.method) || !limited(input.path)) deny();
        result = await proof.issueChallenge({ context, operation: input.operation,
          publicKey: input.publicKey, method: input.method, path: input.path });
      } else if (path === "/qa-device/enroll") {
        if (!limited(input.publicKey) || !limited(input.challengeId) || !limited(input.signature)) deny();
        result = await proof.enroll({ context, publicKey: input.publicKey,
          challengeId: input.challengeId, signature: input.signature });
      } else if (path === "/qa-device/prove") {
        if (!limited(input.challengeId) || !limited(input.signature) || !limited(input.method) || !limited(input.path)) deny();
        await proof.verifyRequest({ context, challengeId: input.challengeId,
          signature: input.signature, method: input.method, path: input.path });
        result = { verified: true };
      } else {
        if (!limited(input.keyId) || !limited(input.purpose)) deny();
        result = await proof.revoke({ context, keyId: input.keyId, purpose: input.purpose });
      }
      record("ACCEPTED");
      reply(200, result);
    } catch {
      try { record("DENIED"); } catch { /* The response still fails closed. */ }
      reply(403, { error: "QA_DEVICE_DENIED" });
    }
  });
  server.headersTimeout = 3000;
  server.requestTimeout = 5000;
  server.maxConnections = 2;
  server.setTimeout(5000, socket => socket.destroy());
  return Object.freeze({
    async listen() {
      if (server.listening) deny();
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
      });
      return `http://127.0.0.1:${server.address().port}`;
    },
    async close() {
      if (server.listening) await new Promise(resolve => server.close(resolve));
    }
  });
}

// Composition is host-owned: no token, admin action or service-role key is
// embedded in the mobile bundle, and no listener starts before listen().
export function createPush44QaLocalOperator({ database, expectedRuntimeSha,
  readSessionToken, readApprovedSession, readDelegation, expectedOwnerProfileId,
  readOwnerAuthorization, confirmHostPresence, trustedIngress,
  fetcher, now = Date.now } = {}) {
  if (!database || typeof readDelegation !== "function")
    throw new Error("QA_DEVICE_OPERATOR_ADAPTERS_REQUIRED");
  const authenticate = createCh1DevelopmentAuthenticator({ expectedRuntimeSha,
    readSessionToken, readApprovedSession, fetcher });
  const verifyOwnerAction = createPush44QaOwnerAction({ expectedOwnerProfileId,
    readOwnerAuthorization, confirmHostPresence, now });
  const approvals = createPush44QaEnrollmentApproval({ database, authenticate,
    readDelegation, verifyOwnerAction, now });
  const proof = createPush44QaDeviceProof({ database, authenticate, readDelegation,
    readApprovedEnrollment: approvals.readApprovedEnrollment,
    consumeApproval: approvals.consumeApproval,
    authorizeOwnerAction: verifyOwnerAction, now });
  const transport = createPush44QaDeviceTransport({ proof, requestEnrollment: approvals.requestEnrollment,
    readRequestStatus: approvals.readRequestStatus,
    authenticate, database, trustedIngress, now });
  return Object.freeze({
    requestEnrollment: approvals.requestEnrollment,
    authorizeEnrollment: approvals.authorize,
    revokePendingApproval: approvals.revoke,
    ...transport
  });
}
