-- REVIEW ONLY: this is an isolated candidate, not a migration or RPC replacement.
BEGIN;
DO $review_guard$ BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: cross-language digest candidate';
END $review_guard$;

CREATE SCHEMA review_digest;

-- Byte grammar v1: Z=null, B0/B1=boolean, I<decimal>;=safe integer,
-- S<8-hex-byte-length>:<UTF8>, A<8-hex-count>:<elements>,
-- O<8-hex-count>:<key,value pairs sorted by UTF8 byte order>.
-- No float/decimal, no NUL, no implicit Unicode normalization.
CREATE FUNCTION review_digest.canonical_bytes_v1(p_value jsonb,p_depth integer DEFAULT 0)
RETURNS bytea LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER
SET search_path=pg_catalog,pg_temp AS $canonical$
DECLARE
  v_type text;
  v_text text;
  v_number numeric;
  v_count bigint;
  v_key text;
  v_child jsonb;
  v_out bytea;
BEGIN
  IF p_value IS NULL OR p_depth > 32 THEN
    RAISE EXCEPTION 'CANON_V1_SIZE_OR_DEPTH_INVALID' USING ERRCODE='22023';
  END IF;
  v_type := pg_catalog.jsonb_typeof(p_value);
  IF v_type='null' THEN
    RETURN pg_catalog.convert_to('Z','UTF8');
  ELSIF v_type='boolean' THEN
    RETURN pg_catalog.convert_to(CASE WHEN p_value='true'::jsonb THEN 'B1' ELSE 'B0' END,'UTF8');
  ELSIF v_type='number' THEN
    v_number := (p_value::text)::numeric;
    IF v_number <> pg_catalog.trunc(v_number)
       OR pg_catalog.abs(v_number) > 9007199254740991 THEN
      RAISE EXCEPTION 'CANON_V1_NUMBER_INVALID' USING ERRCODE='22023';
    END IF;
    RETURN pg_catalog.convert_to('I'||(v_number::bigint)::text||';','UTF8');
  ELSIF v_type='string' THEN
    v_text := p_value #>> '{}';
    IF pg_catalog.octet_length(v_text) > 1048576 THEN
      RAISE EXCEPTION 'CANON_V1_TEXT_INVALID' USING ERRCODE='22023';
    END IF;
    RETURN pg_catalog.convert_to('S'||pg_catalog.lpad(pg_catalog.to_hex(pg_catalog.octet_length(v_text)),8,'0')||':','UTF8')
      || pg_catalog.convert_to(v_text,'UTF8');
  ELSIF v_type='array' THEN
    v_count := pg_catalog.jsonb_array_length(p_value);
    IF v_count > 4096 THEN RAISE EXCEPTION 'CANON_V1_ARRAY_TOO_LARGE' USING ERRCODE='22023'; END IF;
    v_out := pg_catalog.convert_to('A'||pg_catalog.lpad(pg_catalog.to_hex(v_count),8,'0')||':','UTF8');
    FOR v_child IN SELECT value FROM pg_catalog.jsonb_array_elements(p_value) LOOP
      v_out := v_out || review_digest.canonical_bytes_v1(v_child,p_depth+1);
      IF pg_catalog.octet_length(v_out) > 1048576 THEN
        RAISE EXCEPTION 'CANON_V1_SIZE_EXCEEDED' USING ERRCODE='22023';
      END IF;
    END LOOP;
  ELSIF v_type='object' THEN
    SELECT count(*) INTO v_count FROM pg_catalog.jsonb_each(p_value);
    IF v_count > 4096 THEN RAISE EXCEPTION 'CANON_V1_OBJECT_TOO_LARGE' USING ERRCODE='22023'; END IF;
    v_out := pg_catalog.convert_to('O'||pg_catalog.lpad(pg_catalog.to_hex(v_count),8,'0')||':','UTF8');
    FOR v_key,v_child IN SELECT key,value FROM pg_catalog.jsonb_each(p_value)
        ORDER BY key COLLATE "C" LOOP
      v_out := v_out || review_digest.canonical_bytes_v1(pg_catalog.to_jsonb(v_key),p_depth+1)
        || review_digest.canonical_bytes_v1(v_child,p_depth+1);
      IF pg_catalog.octet_length(v_out) > 1048576 THEN
        RAISE EXCEPTION 'CANON_V1_SIZE_EXCEEDED' USING ERRCODE='22023';
      END IF;
    END LOOP;
  ELSE
    RAISE EXCEPTION 'CANON_V1_TYPE_INVALID' USING ERRCODE='22023';
  END IF;
  IF pg_catalog.octet_length(v_out) > 1048576 THEN
    RAISE EXCEPTION 'CANON_V1_SIZE_EXCEEDED' USING ERRCODE='22023';
  END IF;
  RETURN v_out;
END;
$canonical$;

CREATE FUNCTION review_digest.digest_json_v1(p_value jsonb,p_domain text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER
SET search_path=pg_catalog,pg_temp AS $digest$
DECLARE v_bytes bytea;
BEGIN
  IF p_domain IS NULL OR p_domain NOT IN ('GENERIC','SNAPSHOT-CONTENT','SNAPSHOT-ENVELOPE') THEN
    RAISE EXCEPTION 'CANON_V1_DOMAIN_INVALID' USING ERRCODE='22023';
  END IF;
  v_bytes := review_digest.canonical_bytes_v1(p_value,0);
  IF pg_catalog.octet_length(v_bytes) > 1048576 THEN
    RAISE EXCEPTION 'CANON_V1_SIZE_EXCEEDED' USING ERRCODE='22023';
  END IF;
  RETURN pg_catalog.encode(pg_catalog.sha256(
    pg_catalog.convert_to('DO-DIGEST-V1:'||p_domain,'UTF8')
    || pg_catalog.decode('00','hex') || v_bytes),'hex');
END;
$digest$;

-- This is a shape/scope candidate only. It is NOT an authority producer.
CREATE FUNCTION review_digest.snapshot_digests_v1(
  p_content jsonb,p_tenant uuid,p_site uuid)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER
SET search_path=pg_catalog,pg_temp AS $snapshot$
DECLARE
  v_scope jsonb;
  v_rec jsonb;
  v_channel jsonb;
  v_level jsonb;
  v_previous text;
  v_channel_previous text;
  v_level_previous text;
  v_ref text;
  v_fingerprint text;
BEGIN
  IF pg_catalog.jsonb_typeof(p_content) IS DISTINCT FROM 'object'
     OR NOT (p_content ?& ARRAY['schemaVersion','scope','decisionCode','severity',
       'settingsVersion','policyVersion','capturedAt','recipients'])
     OR (p_content - ARRAY['schemaVersion','scope','decisionCode','severity',
       'settingsVersion','policyVersion','capturedAt','recipients']) <> '{}'::jsonb
     OR p_content->'schemaVersion' IS DISTINCT FROM '1'::jsonb THEN
    RAISE EXCEPTION 'CANON_V1_SNAPSHOT_INVALID' USING ERRCODE='23514';
  END IF;
  v_scope := p_content->'scope';
  IF pg_catalog.jsonb_typeof(v_scope) IS DISTINCT FROM 'object'
     OR NOT (v_scope ?& ARRAY['tenantId','siteId','sourceId','eventId','incidentId','riskDecisionId'])
     OR (v_scope - ARRAY['tenantId','siteId','sourceId','eventId','incidentId','riskDecisionId']) <> '{}'::jsonb
     OR v_scope->>'tenantId' IS DISTINCT FROM p_tenant::text
     OR v_scope->>'siteId' IS DISTINCT FROM p_site::text THEN
    RAISE EXCEPTION 'CANON_V1_SCOPE_INVALID' USING ERRCODE='23514';
  END IF;
  FOREACH v_ref IN ARRAY ARRAY['tenantId','siteId','sourceId','eventId','incidentId','riskDecisionId'] LOOP
    IF pg_catalog.jsonb_typeof(v_scope->v_ref) IS DISTINCT FROM 'string'
       OR coalesce(v_scope->>v_ref,'')='' THEN
      RAISE EXCEPTION 'CANON_V1_SCOPE_INVALID' USING ERRCODE='23514';
    END IF;
  END LOOP;
  FOREACH v_ref IN ARRAY ARRAY['decisionCode','severity','settingsVersion','policyVersion'] LOOP
    IF pg_catalog.jsonb_typeof(p_content->v_ref) IS DISTINCT FROM 'string'
       OR pg_catalog.octet_length(p_content->>v_ref) NOT BETWEEN 1 AND 128 THEN
      RAISE EXCEPTION 'CANON_V1_SNAPSHOT_INVALID' USING ERRCODE='23514';
    END IF;
  END LOOP;
  IF pg_catalog.jsonb_typeof(p_content->'capturedAt') IS DISTINCT FROM 'string'
     OR p_content->>'capturedAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
     OR pg_catalog.to_char((p_content->>'capturedAt')::timestamptz AT TIME ZONE 'UTC',
         'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') IS DISTINCT FROM p_content->>'capturedAt'
     OR pg_catalog.jsonb_typeof(p_content->'recipients') IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(p_content->'recipients') > 100 THEN
    RAISE EXCEPTION 'CANON_V1_SNAPSHOT_INVALID' USING ERRCODE='23514';
  END IF;
  v_previous := '';
  FOR v_rec IN SELECT value FROM pg_catalog.jsonb_array_elements(p_content->'recipients') LOOP
    v_ref := v_rec->>'recipientRef';
    IF pg_catalog.jsonb_typeof(v_rec) IS DISTINCT FROM 'object'
       OR NOT (v_rec ?& ARRAY['recipientRef','channels'])
       OR (v_rec - ARRAY['recipientRef','channels']) <> '{}'::jsonb
       OR pg_catalog.jsonb_typeof(v_rec->'recipientRef') IS DISTINCT FROM 'string'
       OR pg_catalog.octet_length(v_ref) NOT BETWEEN 1 AND 128
       OR v_ref COLLATE "C" <= v_previous COLLATE "C"
       OR pg_catalog.jsonb_typeof(v_rec->'channels') IS DISTINCT FROM 'array'
       OR pg_catalog.jsonb_array_length(v_rec->'channels') > 4 THEN
      RAISE EXCEPTION 'CANON_V1_RECIPIENT_INVALID' USING ERRCODE='23514';
    END IF;
    v_previous := v_ref;
    v_channel_previous := '';
    FOR v_channel IN SELECT value FROM pg_catalog.jsonb_array_elements(v_rec->'channels') LOOP
      v_ref := v_channel->>'channel';
      IF pg_catalog.jsonb_typeof(v_channel) IS DISTINCT FROM 'object'
         OR NOT (v_channel ?& ARRAY['channel','enabled','severityLevels'])
         OR (v_channel - ARRAY['channel','enabled','severityLevels']) <> '{}'::jsonb
         OR pg_catalog.jsonb_typeof(v_channel->'channel') IS DISTINCT FROM 'string'
         OR v_ref NOT IN ('in_app','email','sms','push')
         OR v_ref COLLATE "C" <= v_channel_previous COLLATE "C"
         OR pg_catalog.jsonb_typeof(v_channel->'enabled') IS DISTINCT FROM 'boolean'
         OR pg_catalog.jsonb_typeof(v_channel->'severityLevels') IS DISTINCT FROM 'array'
         OR pg_catalog.jsonb_array_length(v_channel->'severityLevels') > 16 THEN
        RAISE EXCEPTION 'CANON_V1_CHANNEL_INVALID' USING ERRCODE='23514';
      END IF;
      v_channel_previous := v_ref;
      v_level_previous := '';
      FOR v_level IN SELECT value FROM pg_catalog.jsonb_array_elements(v_channel->'severityLevels') LOOP
        v_ref := v_level #>> '{}';
        IF pg_catalog.jsonb_typeof(v_level) IS DISTINCT FROM 'string'
           OR pg_catalog.octet_length(v_ref) NOT BETWEEN 1 AND 32
           OR v_ref COLLATE "C" <= v_level_previous COLLATE "C" THEN
          RAISE EXCEPTION 'CANON_V1_LEVEL_INVALID' USING ERRCODE='23514';
        END IF;
        v_level_previous := v_ref;
      END LOOP;
    END LOOP;
  END LOOP;
  v_fingerprint := review_digest.digest_json_v1(p_content,'SNAPSHOT-CONTENT');
  RETURN pg_catalog.jsonb_build_object('fingerprint',v_fingerprint,
    'digest',review_digest.digest_json_v1(p_content ||
      pg_catalog.jsonb_build_object('fingerprint',v_fingerprint),'SNAPSHOT-ENVELOPE'));
END;
$snapshot$;

CREATE FUNCTION review_digest.assert_snapshot_digests_v1(
  p_content jsonb,p_tenant uuid,p_site uuid,p_fingerprint text,p_digest text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER
SET search_path=pg_catalog,pg_temp AS $assert_digest$
DECLARE v_actual jsonb;
BEGIN
  v_actual := review_digest.snapshot_digests_v1(p_content,p_tenant,p_site);
  IF p_fingerprint IS NULL OR p_digest IS NULL
     OR v_actual->>'fingerprint' IS DISTINCT FROM p_fingerprint
     OR v_actual->>'digest' IS DISTINCT FROM p_digest THEN
    RAISE EXCEPTION 'CANON_V1_DIGEST_MISMATCH' USING ERRCODE='23514';
  END IF;
  RETURN true;
END;
$assert_digest$;

-- No COMMIT. The aborting guard is never removed outside a disposable fixture.
