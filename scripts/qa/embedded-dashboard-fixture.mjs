import assert from "node:assert/strict";
import { loadTs } from "./digital-guard-test-loader.mjs";

const { hashEmbeddedToken } = loadTs("lib/domain/digital-observer/partner-platform.ts");
export const audience = "synthetic-partner-dashboard";
export const token = "doemb_synthetic_only";
const pepper = "synthetic-local-pepper";
const sessionTable = "digital_observer_embedded_sessions";
const linkTable = "digital_observer_partner_customer_sites";
const customerTable = "digital_observer_partner_customers";
export const camerasTable = "digital_observer_camera_sources";

export function embeddedDashboardFixture(allowedOrigin) {
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const session = {
    id: "session", partner_id: "partner", partner_customer_id: "customer", observer_site_id: "site",
    token_hash: hashEmbeddedToken(token, pepper), allowed_origin: allowedOrigin, audience, scopes: ["cameras.read"],
    expires_at: expiresAt, revoked_at: null,
    digital_observer_partner_customers: { id: "customer", partner_id: "partner", customer_status: "active", customer_organization_id: "tenant" },
    digital_observer_partners: { partner_status: "sandbox", allowed_embed_origins: [allowedOrigin] },
  };
  const state = { session, linked: true, siteOrg: "tenant", reads: [], duringCameraRead: () => {}, confirmError: false };
  function rows(table) {
    switch (table) {
      case sessionTable: return [session];
      case customerTable: return [session.digital_observer_partner_customers];
      case linkTable: return state.linked ? [{ partner_customer_id: "customer", observer_site_id: "site" }] : [
        { partner_customer_id: "another-customer", observer_site_id: "site" },
        { partner_customer_id: "customer", observer_site_id: "another-site" },
      ];
      case "observer_sites": return [
        { id: "site", digital_observer_organization_id: state.siteOrg, garden_id: null, site_type: "home" },
        { id: "another-site", digital_observer_organization_id: "tenant", garden_id: null, site_type: "home" },
      ];
      case "digital_observer_partner_brand_profiles": return [];
      case camerasTable:
        state.duringCameraRead();
        return [
          { id: "expected-camera", observer_site_id: "site", source_mode: "demo" },
          { id: "other-camera", observer_site_id: "another-site", source_mode: "demo" },
        ];
      default: assert.fail(`Unexpected table: ${table}`);
    }
  }
  const admin = {
    from(table) {
      state.reads.push(table);
      if (table === "digital_observer_enterprise_audit_events") return { insert: async () => ({ error: null }) };
      const filters = [];
      let values;
      function result(single) {
        if (values && state.confirmError) return { data: null, error: { code: "fixture_error" } };
        if (table === sessionTable && values?.revoked_at && state.revocationError) return { data: null, error: { code: "fixture_error" } };
        const selected = rows(table).filter((row) => filters.every((matches) => matches(row)));
        if (values) selected.forEach((row) => Object.assign(row, values));
        return { data: single ? selected[0] ?? null : selected, error: null };
      }
      return {
        select() { return this; },
        eq(key, value) { filters.push((row) => row[key] === value); return this; },
        is(key, value) { return this.eq(key, value); },
        neq(key, value) { filters.push((row) => row[key] !== value); return this; },
        gt(key, value) { filters.push((row) => row[key] > value); return this; },
        order() { return this; },
        limit() { return this; },
        update(data) { values = data; return this; },
        async maybeSingle() { return result(true); },
        async single() { return result(true); },
        then(resolve) { return Promise.resolve(result(false)).then(resolve); },
      };
    },
  };
  const { GET, OPTIONS } = loadTs("app/api/digital-observer/embed/v1/dashboard/route.ts", {
    process: { env: { DIGITAL_OBSERVER_ENTERPRISE_CREDENTIAL_PEPPER: pepper } },
    "@/lib/supabase/admin": { createAdminClient: () => admin, isAdminClientConfigured: () => true },
  });
  return { state, admin, GET, OPTIONS };
}
