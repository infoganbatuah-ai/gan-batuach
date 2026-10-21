import { HOME_LEGACY_MATCH_DEVICES, HOME_LEGACY_MATCH_SITE_ID } from "./home-legacy-match-service.mjs";

// The query capability must be a dedicated, short-lived PostgreSQL login
// restricted to the private function in the reviewed migration. It must not
// be a Supabase service_role/admin connection or a generic SQL proxy.
export function createHomeLegacyScopedReader(query) {
  if (typeof query !== "function") throw new TypeError("SCOPED_READER_REQUIRED");

  async function readExact(deviceId) {
    if (!Object.hasOwn(HOME_LEGACY_MATCH_DEVICES, deviceId)) return [];
    const result = await query(
      "select id, gateway_id, observer_site_id, tenant_id, deployment_profile, config_version, status, lifecycle_state, identity_scheme, refresh_token_hash from private_home_legacy_compare.read_exact_enrollment($1::uuid)",
      [deviceId]
    );
    if (!Array.isArray(result?.rows) || result.rows.length !== 1) return [];
    const row = result.rows[0];
    if (row?.gateway_id !== deviceId || row.observer_site_id !== HOME_LEGACY_MATCH_SITE_ID ||
      row.deployment_profile !== HOME_LEGACY_MATCH_DEVICES[deviceId] ||
      typeof row.tenant_id !== "string" || !row.tenant_id) return [];
    return [row];
  }

  return Object.freeze({
    async resolveApprovedBinding(deviceId) {
      const [row] = await readExact(deviceId);
      if (!row) return null;
      return { enrollmentId: row.id, deviceId: row.gateway_id,
        siteId: row.observer_site_id, tenantId: row.tenant_id,
        deploymentProfile: row.deployment_profile, configVersion: row.config_version };
    },
    async loadScopedRows(binding) {
      if (!binding || !Object.hasOwn(HOME_LEGACY_MATCH_DEVICES, binding.deviceId) ||
        binding.siteId !== HOME_LEGACY_MATCH_SITE_ID ||
        binding.deploymentProfile !== HOME_LEGACY_MATCH_DEVICES[binding.deviceId]) return [];
      const rows = await readExact(binding.deviceId);
      const row = rows[0];
      return row && row.id === binding.enrollmentId && row.tenant_id === binding.tenantId &&
        row.config_version === binding.configVersion ? rows : [];
    }
  });
}
