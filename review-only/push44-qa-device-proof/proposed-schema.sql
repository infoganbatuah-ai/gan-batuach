-- REVIEW ONLY. Do not run or move into supabase/migrations without a separate
-- authorized schema review, deployed-catalog check and rollback rehearsal.
CREATE SCHEMA IF NOT EXISTS observer_qa_private;
REVOKE ALL ON SCHEMA observer_qa_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA observer_qa_private TO service_role;

CREATE TABLE observer_qa_private.approved_installations (
  id uuid PRIMARY KEY,
  account_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  public_key_spki_base64 text NOT NULL CHECK (length(public_key_spki_base64) BETWEEN 80 AND 512),
  approved_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (id, account_profile_id),
  CHECK (expires_at > created_at)
);
CREATE UNIQUE INDEX approved_one_qa_installation_per_account
  ON observer_qa_private.approved_installations(account_profile_id)
  WHERE approved_at IS NOT NULL AND revoked_at IS NULL;

CREATE TABLE observer_qa_private.device_handoff_challenges (
  id uuid PRIMARY KEY,
  installation_id uuid NOT NULL,
  account_profile_id uuid NOT NULL,
  auth_session_id uuid NOT NULL,
  audience text NOT NULL CHECK (audience = 'com.ganbatuach.app.qa'),
  nonce text NOT NULL UNIQUE CHECK (nonce ~ '^[a-f0-9]{64}$'),
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  FOREIGN KEY (installation_id, account_profile_id)
    REFERENCES observer_qa_private.approved_installations(id, account_profile_id),
  CHECK (expires_at > issued_at AND expires_at <= issued_at + interval '60 seconds'),
  CHECK (consumed_at IS NULL OR consumed_at >= issued_at)
);
CREATE INDEX device_handoff_expiry_idx
  ON observer_qa_private.device_handoff_challenges(expires_at)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;

ALTER TABLE observer_qa_private.approved_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE observer_qa_private.device_handoff_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA observer_qa_private FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON observer_qa_private.approved_installations,
  observer_qa_private.device_handoff_challenges TO service_role;
