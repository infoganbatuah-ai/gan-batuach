import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

const camera = { id: "camera", garden_id: "garden", observer_site_id: "site", active: true,
  parent_view_allowed: true, staff_view_allowed: true, class_group: "Room A" };
const policy = { viewing_enabled: true, approved_camera_ids: ["camera"],
  metadata: { parent_consent_ready: true, legal_review_approved: true }, restricted_hours: {} };

function fixture(patch = {}) {
  const tables = {
    parent_camera_policies: policy,
    child_kindergarten_enrollments: [{ child_id: "child" }],
    attendance: [{ child_id: "child" }],
    children: [{ classroom: "Room A" }],
    ...patch.tables
  };
  const calls = [];
  const client = { from(table) {
    const filters = [];
    const result = () => {
      calls.push({ table, filters });
      return { data: tables[table], error: null };
    };
    const chain = {
      select: () => chain, eq: (...args) => { filters.push(["eq", ...args]); return chain; },
      is: (...args) => { filters.push(["is", ...args]); return chain; },
      in: (...args) => { filters.push(["in", ...args]); return chain; },
      not: (...args) => { filters.push(["not", ...args]); return chain; },
      limit: async () => result(), maybeSingle: async () => result()
    };
    return chain;
  }};
  const { canUseSyntheticCameraPilot } = loadTs("lib/management/camera-pilot-role-policy.js", {
    "@/lib/domain/capability-policy-engine": { isCapabilityAllowed: async (_, __, ___, options) =>
      options.legalReviewApproved && options.consentConfirmed && patch.capability !== false },
    "@/lib/domain/parent-camera-access": { canParentViewCamera: async () => ({ allowed: patch.parentCamera !== false }) },
    "@/lib/domain/israel-date": { israelTodayDateKey: () => "2026-11-28" },
    "@/lib/domain/video-streaming": { parseViewingWindow: () => ({ allowed: patch.hours !== false }) },
    "@/lib/management/family-link": { guardianChildIds: async () => patch.files ?? ["file"] },
    "@/lib/management/staff-employment-context": { resolveStaffEmploymentContext: async () => ({
      available: true, activeEmployment: { garden_id: patch.staffGarden ?? "garden",
        classroom_names: patch.staffRooms ?? ["Room A"] }
    }) },
    "@/lib/security/identity-security": { getMfaGateStatus: async () => ({ allowed: patch.mfa !== false }) }
  });
  return { calls, check: (role = "parent", aal = "aal2", cameraPatch = {}, site = "site") =>
    canUseSyntheticCameraPilot(client, { id: "viewer", role, active: true }, { aal }, { ...camera, ...cameraPatch }, site) };
}

test("eligible synthetic Parent requires enrollment and current room attendance for the same Garden", async () => {
  const { check, calls } = fixture();
  assert.equal(await check(), true);
  assert.deepEqual(calls.find(call => call.table === "child_kindergarten_enrollments").filters, [
    ["eq", "garden_id", "garden"], ["eq", "status", "active"], ["in", "permanent_child_file_id", ["file"]]
  ]);
  assert.ok(calls.find(call => call.table === "attendance").filters.some(filter =>
    filter[0] === "in" && filter[1] === "child_id" && filter[2][0] === "child"));
});

test("rejects missing MFA, unrelated enrollment, changed attendance, policy and incorrect room", async () => {
  assert.equal(await fixture().check("parent", "aal1"), false);
  assert.equal(await fixture({ mfa: false }).check(), false);
  assert.equal(await fixture({ files: [] }).check(), false);
  assert.equal(await fixture({ tables: { child_kindergarten_enrollments: [] } }).check(), false);
  assert.equal(await fixture({ tables: { attendance: [] } }).check(), false);
  assert.equal(await fixture({ tables: { children: [{ classroom: "Room B" }] } }).check(), false);
  assert.equal(await fixture({ tables: { parent_camera_policies: null } }).check(), false);
  assert.equal(await fixture({ capability: false }).check(), false);
  assert.equal(await fixture().check("parent", "aal2", { parent_view_allowed: false }), false);
  assert.equal(await fixture().check("parent", "aal2", {}, "other-site"), false);
});

test("Staff requires active Garden and classroom assignment and camera permission", async () => {
  assert.equal(await fixture().check("staff"), true);
  assert.equal(await fixture({ staffGarden: "foreign" }).check("staff"), false);
  assert.equal(await fixture({ staffRooms: ["Room B"] }).check("staff"), false);
  assert.equal(await fixture().check("staff", "aal1", { staff_view_allowed: false }), false);
  assert.equal(await fixture().check("inspector"), false);
  assert.equal(await fixture().check("admin"), false);
});
