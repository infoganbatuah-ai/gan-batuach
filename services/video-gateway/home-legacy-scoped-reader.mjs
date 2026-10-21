import { compareLegacyCredentialReadonly } from "./legacy-identity-bridge.mjs";
import { HOME_LEGACY_MATCH_BINDINGS } from "./home-legacy-match-service.mjs";

// Private trusted-process capability only. A deployment must supply an
// approved server-side DB query and protected credential source in the SAME
// trust boundary. Neither capability is accepted from a request or exported.
// No new DB login, HTTP route, Production connector, or secret transport exists.
const EXACT_READ = `select id, gateway_id, observer_site_id, tenant_id,
  deployment_profile, config_version, status, lifecycle_state,
  identity_scheme, refresh_token_hash
from public.video_gateway_device_enrollments
where (
  (id = '1c450dca-38a8-4e49-853f-c613ca498c27'::uuid
    and gateway_id = '62df97e2-3c0b-427f-9108-bde029bc10e7'::uuid
    and tenant_id = 'cc1673b8-3eb0-4785-a12c-1fb88f425a41'::uuid
    and observer_site_id = 'cc1673b8-3eb0-4785-a12c-1fb88f425a41'::uuid
    and deployment_profile = 'PHYSICAL_GATEWAY' and config_version = 1)
  or
  (id = 'd7ee3c9f-0b2e-4943-947b-c410c6bc2a41'::uuid
    and gateway_id = 'db267b52-6282-4944-bcee-5d4857698fb0'::uuid
    and tenant_id = 'cc1673b8-3eb0-4785-a12c-1fb88f425a41'::uuid
    and observer_site_id = 'cc1673b8-3eb0-4785-a12c-1fb88f425a41'::uuid
    and deployment_profile = 'SOFTWARE_CONNECTOR' and config_version = 4)
)
and id = $1::uuid and gateway_id = $2::uuid
and tenant_id = $3::uuid and observer_site_id = $4::uuid
and status = 'delivered' and lifecycle_state = 'ACTIVE'
and identity_scheme = 'LEGACY_HMAC'
limit 2`;

export function createHomeLegacyScopedReader({ query, loadProtectedCredential }) {
  if (typeof query !== "function" || typeof loadProtectedCredential !== "function")
    throw new TypeError("TRUSTED_COMPARISON_CAPABILITIES_REQUIRED");

  return Object.freeze({
    async compareBoundCredential(binding) {
      const pinned = binding && HOME_LEGACY_MATCH_BINDINGS[binding.deviceId];
      if (!pinned || Object.keys(pinned).some(key => binding[key] !== pinned[key]) ||
        Object.keys(binding).some(key => !Object.hasOwn(pinned, key))) return "UNKNOWN";
      try {
        const result = await query(EXACT_READ, [pinned.enrollmentId, pinned.deviceId,
          pinned.tenantId, pinned.siteId]);
        if (!Array.isArray(result?.rows) || result.rows.length !== 1) return "UNKNOWN";
        const localCredential = await loadProtectedCredential({ deviceId: pinned.deviceId,
          deploymentProfile: pinned.deploymentProfile });
        return compareLegacyCredentialReadonly({ rows: result.rows,
          expected: { id: pinned.enrollmentId, gateway_id: pinned.deviceId,
            observer_site_id: pinned.siteId, tenant_id: pinned.tenantId,
            deployment_profile: pinned.deploymentProfile,
            config_version: pinned.configVersion }, localCredential });
      } catch {
        // DB/credential errors may contain secrets; never log or return them.
        return "UNKNOWN";
      }
    }
  });
}
