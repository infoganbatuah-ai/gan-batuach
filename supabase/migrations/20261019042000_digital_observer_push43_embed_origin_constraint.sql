-- DIGITAL OBSERVER PUSH 43: repair the loopback origin branch of the
-- short-lived embedded-session allowlist constraint.
--
-- The original PostgreSQL regex stored an over-escaped 127.0.0.1 pattern.
-- Character classes make the dot matching unambiguous without broadening the
-- permitted origin set. No data is created, copied or removed.
-- Recovery: restore the prior constraint only if a reviewed forward migration
-- is required; the prior expression incorrectly rejected 127.0.0.1.

alter table public.digital_observer_embedded_sessions
  drop constraint if exists do_embedded_session_origin_check;

alter table public.digital_observer_embedded_sessions
  add constraint do_embedded_session_origin_check
  check (
    allowed_origin ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?$'
    or allowed_origin ~ '^http://(localhost|127[.]0[.]0[.]1)(:[0-9]+)?$'
  ) not valid;

alter table public.digital_observer_embedded_sessions
  validate constraint do_embedded_session_origin_check;
