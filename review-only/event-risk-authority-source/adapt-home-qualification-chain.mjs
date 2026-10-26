// Exact pinned adaptation of 296aa990's qualification body to the guarded
// observer_home_review schema. No live authority source or caller grant.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const PINNED_QUALIFICATION_SHA256 =
  "5de14e2bd4cfbee63416371becb948b7f96c3d605115befaaa86d0e5a4a12a2e";

export function adaptHomeQualification(source) {
  assert.equal(createHash("sha256").update(source).digest("hex"), PINNED_QUALIFICATION_SHA256);
  const start = source.indexOf("CREATE FUNCTION review_registration_writer.qualify_registration_v1(");
  const end = source.indexOf("END $writer$;", start) + "END $writer$;".length;
  assert.ok(start > source.indexOf("DO $guard$") && end > start);
  let body = source.slice(start, end);
  let anchorEdits = 0;
  function once(before, after) {
    assert.equal(body.split(before).length - 1, 1, `qualification anchor mismatch: ${before.slice(0, 70)}`);
    body = body.replace(before, after);
    anchorEdits++;
  }
  const schemaCount = body.split("review_registration_writer.").length - 1;
  assert.ok(schemaCount >= 12);
  body = body.replaceAll("review_registration_writer.", "observer_home_review.");
  for (const [before, after] of [
    ["observer_home_review.authority_fixture", "observer_home_review.qa_owner_authority_fixture"],
    ["observer_home_review.session_fixture", "observer_home_review.qa_owner_session_fixture"],
    ["observer_home_review.current_scope_fixture", "observer_home_review.qa_current_scope_fixture"]
  ]) {
    assert.equal(body.split(before).length - 1, 2, `qualification relation mismatch: ${before}`);
    body = body.replaceAll(before, after);
  }
  for (const [before, after] of [
    ["a.provenance_verified", "a.verified"],
    ["s.actor_kind", "s.kind"],
    ["old.actor_id", "old.authorized_actor_id"],
    ["old.audit_ref", "old.qualification_audit_ref"],
    ["  next_version bigint;", "  verified_source uuid;\n  next_version bigint;"],
    ["  IF NOT FOUND OR h.revoked THEN",
      "  IF NOT FOUND OR h.revoked IS DISTINCT FROM false\n    OR h.owner_epoch IS DISTINCT FROM 0 THEN"],
    ["  IF h.current_version <> p_expected_version THEN",
      "  IF COALESCE(h.current_version,0) <> p_expected_version THEN"],
    ["    WHERE registration_id=h.registration_id AND current_version=p_expected_version AND NOT revoked;",
      "    WHERE registration_id=h.registration_id\n      AND COALESCE(current_version,0)=p_expected_version\n      AND revoked=false AND owner_epoch=0;"],
    ["    (registration_id,version,request_ref,tenant_id,site_id,source_id,\n     owner_profile_id,actor_id,authority_ref,fingerprint,audit_ref)",
      "    (registration_id,version,request_ref,tenant_id,site_id,source_id,\n     owner_profile_id,registering_actor_id,authorized_actor_id,authority_ref,fingerprint,qualification_audit_ref)"],
    ["      h.owner_profile_id,s.actor_id,a.authority_ref,a.fingerprint,new_audit);",
      "      h.owner_profile_id,s.owner_profile_id,s.owner_profile_id,a.authority_ref,a.fingerprint,new_audit);"],
    ["    (audit_ref,request_ref,registration_id,version,actor_id,authority_ref,action)",
      "    (audit_ref,request_ref,registration_id,version,actor_id,authority_ref,fingerprint,owner_epoch,action)"],
    ["    VALUES (new_audit,p_request_ref,h.registration_id,next_version,s.actor_id,a.authority_ref,",
      "    VALUES (new_audit,p_request_ref,h.registration_id,next_version,s.owner_profile_id,a.authority_ref,a.fingerprint,h.owner_epoch,"],
    ["  IF NOT FOUND OR NOT c.active OR c.tenant_id IS DISTINCT FROM h.tenant_id\n    OR c.site_id IS DISTINCT FROM h.site_id OR c.source_id IS DISTINCT FROM h.source_id\n    OR c.owner_profile_id IS DISTINCT FROM h.owner_profile_id THEN\n    RAISE EXCEPTION 'REGISTRATION_CURRENT_SCOPE_CHANGED' USING ERRCODE='42501';\n  END IF;",
      `  IF NOT FOUND OR NOT c.active OR c.tenant_id IS DISTINCT FROM h.tenant_id
    OR c.site_id IS DISTINCT FROM h.site_id OR c.source_id IS DISTINCT FROM h.source_id
    OR c.owner_profile_id IS DISTINCT FROM h.owner_profile_id THEN
    RAISE EXCEPTION 'REGISTRATION_CURRENT_SCOPE_CHANGED' USING ERRCODE='42501';
  END IF;
  SELECT src.id INTO verified_source FROM public.digital_observer_camera_sources src
    JOIN public.observer_sites st ON st.id=src.observer_site_id
    JOIN public.digital_observer_organizations org ON org.id=st.digital_observer_organization_id
    WHERE src.id=h.source_id AND src.observer_site_id=h.site_id
      AND src.status='connected' AND src.source_mode='live'
      AND st.id=h.site_id AND st.site_type='home' AND st.garden_id IS NULL
      AND st.active AND st.monitoring_enabled
      AND st.metadata->'observer_monitoring_consent'='true'::jsonb
      AND st.owner_profile_id=h.owner_profile_id
      AND org.id=h.tenant_id AND org.owner_profile_id=h.owner_profile_id AND org.active
    FOR SHARE OF src,st,org;
  IF NOT FOUND OR verified_source IS DISTINCT FROM h.source_id THEN
    RAISE EXCEPTION 'REGISTRATION_CURRENT_SCOPE_CHANGED' USING ERRCODE='42501';
  END IF;`]
  ]) once(before, after);
  const actorRefs = body.split("s.actor_id").length - 1;
  assert.ok(actorRefs >= 3);
  body = body.replaceAll("s.actor_id", "s.owner_profile_id");
  assert.doesNotMatch(body, /review_registration_writer\./);
  return { sql: body, anchorEdits, schemaReferences: schemaCount, actorReferences: actorRefs };
}
