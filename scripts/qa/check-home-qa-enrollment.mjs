import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { reconcileHomeQaEnrollment } from "../../services/video-gateway/home-qa-enrollment.mjs";

const site = randomUUID(), tenant = randomUUID();
const record = profile => ({ enrollment_id: randomUUID(), device_id: randomUUID(),
  site_id: site, tenant_id: tenant, profile, credential_version: 1, config_version: 1,
  public_key_spki: generateKeyPairSync("ed25519").publicKey.export({ format: "der", type: "spki" }).toString("base64url") });
const capture = { environment: "HOME_QA", devices: [record("PHYSICAL_GATEWAY"), record("SOFTWARE_CONNECTOR")] };
const approval = { environment: "HOME_QA", provenance: "AUTHENTICATED_PRODUCT_ADMIN_READ_ONLY",
  devices: structuredClone(capture.devices) };
assert.equal(reconcileHomeQaEnrollment(capture, approval).length, 2);
const reject = (modifiedCapture, modifiedApproval, pattern) => assert.throws(
  () => reconcileHomeQaEnrollment(modifiedCapture, modifiedApproval), pattern);
reject({ ...capture, devices: capture.devices.slice(0, 1) }, approval, /INCOMPLETE/);
reject(capture, { ...approval, devices: approval.devices.map((row, index) => index ? { ...row, tenant_id: randomUUID() } : row) }, /WITNESS_MISMATCH/);
reject(capture, { ...approval, devices: approval.devices.map((row, index) => index ? { ...row, public_key_spki: record("SOFTWARE_CONNECTOR").public_key_spki } : row) }, /WITNESS_MISMATCH/);
reject({ ...capture, devices: [capture.devices[0], { ...capture.devices[1], private_key: "never" }] }, approval, /UNEXPECTED_FIELD/);
reject({ ...capture, devices: [capture.devices[0], { ...capture.devices[1], profile: "PHYSICAL_GATEWAY" }] }, approval, /NOT_EXACT_HOME_PAIR/);
const sharedKey = { ...capture.devices[1], public_key_spki: capture.devices[0].public_key_spki };
reject({ ...capture, devices: [capture.devices[0], sharedKey] },
  { ...approval, devices: [approval.devices[0], sharedKey] }, /NOT_EXACT_HOME_PAIR/);
reject(capture, { ...approval, provenance: "CALLER_SUPPLIED" }, /EVIDENCE_INCOMPLETE/);
console.log(JSON.stringify({ status: "PASS", contract: "HOME_QA_OWNER_WITNESSED_PUBLIC_KEY_ONLY", cases: 8,
  liveEnrollment: false }));
