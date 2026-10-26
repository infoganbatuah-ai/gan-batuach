// REVIEW ONLY: catalog-shape precondition, never an authority adapter.
// An existing table/column is not proof that its rows or writers are trusted.
const required = Object.freeze({
  "observer_home_review.registration_versions": ["registration_id", "version", "tenant_id", "site_id", "source_id", "authority_ref"],
  "observer_home_review.event_acceptances": ["event_id", "tenant_id", "site_id", "source_id", "registration_id", "registration_version", "acceptance_ref"],
  "observer_home_review.event_bindings": ["event_id", "tenant_id", "site_id", "source_id", "registration_id", "registration_version", "binding_ref"],
  "observer_authority_review.recipient_policy_versions": ["tenant_id", "site_id", "version", "snapshot", "snapshot_fingerprint", "audit_event_id"],
  "public.digital_observer_risk_evaluations": ["id", "observer_site_id", "incident_id", "triggering_event_id", "risk_engine_version", "evaluated_at"],
  "public.observer_event_risk_plan_authority": ["signal_id", "tenant_id", "observer_site_id", "risk_evaluation_id", "recipient_settings_version", "recipient_snapshot"]
});

/**
 * Reject a proposed decision-time reader when the named durable source is
 * absent from a trusted pg_catalog inventory. Passing this shape check is
 * deliberately only SCHEMA_PRESENT_NOT_AUTHORIZED: writer provenance,
 * immutability, transaction boundaries, role ACL and real rows remain gates.
 */
export function requireAuthoritySourceShapeV1(catalog) {
  if (!(catalog instanceof Map)) throw new Error("AUTHORITY_CATALOG_UNTRUSTED");
  for (const [relation, columns] of Object.entries(required)) {
    const observed = catalog.get(relation);
    if (!(observed instanceof Set)) throw new Error(`AUTHORITY_SOURCE_ABSENT:${relation}`);
    for (const column of columns) {
      if (!observed.has(column)) throw new Error(`AUTHORITY_COLUMN_ABSENT:${relation}.${column}`);
    }
  }
  return Object.freeze({ status: "SCHEMA_PRESENT_NOT_AUTHORIZED", liveReady: false });
}

export const requiredAuthoritySourceColumnsV1 = required;
