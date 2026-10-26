import assert from "node:assert/strict";
import test from "node:test";
import { requireAuthoritySourceShapeV1, requiredAuthoritySourceColumnsV1 } from "./source-readiness-gate-v1.mjs";

const complete = () => new Map(Object.entries(requiredAuthoritySourceColumnsV1)
  .map(([name, columns]) => [name, new Set(columns)]));

test("missing immutable event-time acceptance fails closed", () => {
  const observed = complete();
  observed.delete("observer_home_review.event_acceptances");
  observed.delete("observer_home_review.event_bindings");
  observed.delete("observer_home_review.registration_versions");
  assert.throws(() => requireAuthoritySourceShapeV1(observed),
    /AUTHORITY_SOURCE_ABSENT:observer_home_review.registration_versions/);
});

test("sanitized original Development relation inventory is not authority", () => {
  // Names only from the bounded read-only catalog inventory. No user rows.
  const observed = new Map([
    ["public.observer_sites", new Set(["id", "digital_observer_organization_id"])],
    ["public.digital_observer_camera_sources", new Set(["id", "observer_site_id"])],
    ["public.observer_intelligence_signals", new Set(["id", "observer_site_id", "source_id", "metadata"])],
    ["public.digital_observer_risk_evaluations", new Set(requiredAuthoritySourceColumnsV1["public.digital_observer_risk_evaluations"])],
    ["public.digital_observer_authorized_recipients", new Set(["id", "observer_site_id", "updated_at"])],
    ["public.observer_alert_channel_settings", new Set(["id", "observer_site_id", "updated_at"])]
  ]);
  assert.throws(() => requireAuthoritySourceShapeV1(observed),
    /AUTHORITY_SOURCE_ABSENT:observer_home_review.registration_versions/);
});

test("mutable current recipient rows cannot stand in for versioned settings", () => {
  const observed = complete();
  observed.delete("observer_authority_review.recipient_policy_versions");
  observed.set("public.digital_observer_authorized_recipients", new Set(["id", "observer_site_id", "updated_at"]));
  observed.set("public.observer_alert_channel_settings", new Set(["id", "observer_site_id", "updated_at"]));
  assert.throws(() => requireAuthoritySourceShapeV1(observed),
    /AUTHORITY_SOURCE_ABSENT:observer_authority_review.recipient_policy_versions/);
});

test("a Risk identifier without persisted Risk scope is insufficient", () => {
  const observed = complete();
  observed.delete("public.digital_observer_risk_evaluations");
  assert.throws(() => requireAuthoritySourceShapeV1(observed),
    /AUTHORITY_SOURCE_ABSENT:public.digital_observer_risk_evaluations/);
});

test("Site or Tenant omission in frozen acceptance fails closed", () => {
  for (const column of ["tenant_id", "site_id"]) {
    const observed = complete();
    observed.get("observer_home_review.event_acceptances").delete(column);
    assert.throws(() => requireAuthoritySourceShapeV1(observed),
      new RegExp(`AUTHORITY_COLUMN_ABSENT:observer_home_review.event_acceptances.${column}`));
  }
});

test("a versionless recipient snapshot cannot qualify", () => {
  const observed = complete();
  observed.get("observer_authority_review.recipient_policy_versions").delete("version");
  assert.throws(() => requireAuthoritySourceShapeV1(observed),
    /AUTHORITY_COLUMN_ABSENT:observer_authority_review.recipient_policy_versions.version/);
});

test("replay authority cannot be inferred before a frozen plan exists", () => {
  const observed = complete();
  observed.delete("public.observer_event_risk_plan_authority");
  assert.throws(() => requireAuthoritySourceShapeV1(observed),
    /AUTHORITY_SOURCE_ABSENT:public.observer_event_risk_plan_authority/);
});

test("complete synthetic schema shape still never grants live authority", () => {
  assert.deepEqual(requireAuthoritySourceShapeV1(complete()),
    { status: "SCHEMA_PRESENT_NOT_AUTHORIZED", liveReady: false });
  assert.throws(() => requireAuthoritySourceShapeV1({}), /AUTHORITY_CATALOG_UNTRUSTED/);
});
