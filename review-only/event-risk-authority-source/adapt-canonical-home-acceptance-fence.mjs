// Review-only exact-anchor adaptation of a6bd2ba5's complete SQL body.
// No replacement is allowed unless the pinned source SHA and every anchor match.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const PINNED_CANONICAL_WRITER_SHA256 =
  "0aa722353c4dee721f45ae23afaac0f9d5d186a20d487cf9f025526170c8f293";

export function adaptCanonicalHomeAcceptance(source) {
  assert.equal(createHash("sha256").update(source).digest("hex"), PINNED_CANONICAL_WRITER_SHA256);
  const edits = [
    ["  p_observation jsonb\n) RETURNS uuid", "  p_observation jsonb,\n  p_expected_epoch bigint,\n  p_gateway_session_ref uuid\n) RETURNS uuid"],
    ["  a observer_home_review.event_acceptances%ROWTYPE;",
      "  a observer_home_review.event_acceptances%ROWTYPE;\n  g observer_home_review.qa_gateway_session_fixture%ROWTYPE;"],
    ["  IF p_registration_id IS NULL OR p_observation IS NULL",
      "  IF p_registration_id IS NULL OR p_observation IS NULL\n    OR p_expected_epoch IS NULL OR p_expected_epoch < 0\n    OR p_gateway_session_ref IS NULL"],
    ["  -- Retry first: never rebind an accepted event to the current Site/owner.",
      `  SELECT * INTO g FROM observer_home_review.qa_gateway_session_fixture
    WHERE session_ref=p_gateway_session_ref FOR SHARE;
  IF NOT FOUND OR NOT g.active OR g.expires_at <= pg_catalog.clock_timestamp()
    OR g.source_id IS DISTINCT FROM r.source_id THEN
    RAISE EXCEPTION 'HOME_GATEWAY_SESSION_UNVERIFIED' USING ERRCODE='42501';
  END IF;

  -- Retry first: never rebind an accepted event to the current Site/owner.`],
    ["      OR a.observation_snapshot IS DISTINCT FROM p_observation",
      "      OR a.observation_snapshot IS DISTINCT FROM p_observation\n      OR a.owner_epoch IS DISTINCT FROM p_expected_epoch"],
    ["        AND q.registration_id=a.registration_id AND q.version=a.registration_version",
      "        AND q.registration_id=a.registration_id AND q.version=a.registration_version\n        AND q.owner_epoch=a.owner_epoch"],
    ["  IF r.source_id IS DISTINCT FROM camera_source_id",
      "  IF r.revoked IS DISTINCT FROM false\n    OR r.owner_epoch IS DISTINCT FROM p_expected_epoch\n    OR r.source_id IS DISTINCT FROM camera_source_id"],
    ["     registration_version,authority_ref,acceptance_ref,observation_snapshot)",
      "     registration_version,authority_ref,acceptance_ref,observation_snapshot,owner_epoch)"],
    ["     v.version,v.authority_ref,acceptance_ref,p_observation);",
      "     v.version,v.authority_ref,acceptance_ref,p_observation,r.owner_epoch);"],
    ["    (audit_ref,action,registration_id,version,event_id)\n  VALUES (audit_ref,'ACCEPTED',r.registration_id,v.version,s.id);",
      "    (audit_ref,action,registration_id,version,event_id,owner_epoch)\n  VALUES (audit_ref,'ACCEPTED',r.registration_id,v.version,s.id,r.owner_epoch);"],
    ["REVOKE ALL ON FUNCTION observer_home_review.accept_live_home_signal_v1(uuid,jsonb)",
      "REVOKE ALL ON FUNCTION observer_home_review.accept_live_home_signal_v1(uuid,jsonb,bigint,uuid)"],
  ];
  let adapted = source;
  for (const [before, after] of edits) {
    const occurrences = adapted.split(before).length - 1;
    assert.equal(occurrences, 1, `canonical anchor mismatch: ${before.slice(0, 70)}`);
    adapted = adapted.replace(before, after);
  }
  assert.match(adapted, /HOME_EVENT_MANDATORY_EFFECT_MISSING/);
  assert.match(adapted, /HOME_INCIDENT_SCOPE_UNVERIFIED/);
  assert.match(adapted, /HOME_BINDING_UNVERIFIED/);
  return { sql: adapted, editCount: edits.length };
}
