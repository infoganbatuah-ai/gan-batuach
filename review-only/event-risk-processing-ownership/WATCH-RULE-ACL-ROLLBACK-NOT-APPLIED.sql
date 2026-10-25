-- OFFLINE ROLLBACK ALTERNATIVE ONLY. Never source this file.
-- Restoring EXECUTE to anon/authenticated requires a separate security and
-- compatibility decision; it is not an automatic rollback. No COMMIT.
BEGIN;
DO $draft_guard$
BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: rollback exposure approval required';
END;
$draft_guard$;

GRANT EXECUTE ON FUNCTION
  public.record_digital_observer_watch_rule_evaluation(
    uuid,integer,uuid,uuid,uuid,boolean,jsonb,jsonb,text,timestamptz
  ) TO anon, authenticated;
