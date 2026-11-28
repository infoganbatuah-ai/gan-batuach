import test from "node:test";
import assert from "node:assert/strict";
import { integrationEnvironment } from "../development/integration-environment.mjs";

const local = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55421",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic"
};
const cameraPilot = {
  GAN_CAMERA_PILOT_QA: "1", GAN_CAMERA_PILOT_GARDEN: "garden-a",
  GAN_CAMERA_PILOT_SITE: "site-a", GAN_CAMERA_PILOT_CAMERA: "camera-a",
  GAN_CAMERA_PILOT_VIEWER: "viewer-a", GAN_CAMERA_PILOT_ORIGIN: "http://127.0.0.1:4444",
  GAN_CAMERA_PILOT_SERVICE_TOKEN: "synthetic-test", GAN_CAMERA_PILOT_SIGNING_KEY: "synthetic-test"
};

test("canonical launch admits only explicitly supplied private pilot config", () => {
  assert.equal(integrationEnvironment(local, { system: cameraPilot }).GAN_CAMERA_PILOT_QA, undefined);
  assert.equal(integrationEnvironment(local, { cameraPilot }).GAN_CAMERA_PILOT_QA, "1");
  assert.throws(() => integrationEnvironment({ ...local, ...cameraPilot }), /Unapproved/);
});

test("rejects incomplete config, nonloopback, UI-only and release overrides", () => {
  for (const patch of [
    { GAN_CAMERA_PILOT_GARDEN: "" }, { GAN_CAMERA_PILOT_ORIGIN: "https://example.invalid" },
    { GAN_CAMERA_PILOT_ORIGIN: "http://127.0.0.1:4444/other" }, { PRODUCTION_ACTIVATION_APPROVED: "true" }
  ]) assert.throws(() => integrationEnvironment(local, { cameraPilot: { ...cameraPilot, ...patch } }));
  assert.throws(() => integrationEnvironment({}, { cameraPilot, uiOnly: true }));
});
