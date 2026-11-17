-- PUSH 38I: permit a bounded terminal state when signed known-good recovery
-- itself fails. This does not change RLS or grant broader access.
begin;
alter table public.observer_edge_device_updates
  drop constraint if exists observer_edge_device_updates_state_check;
alter table public.observer_edge_device_updates
  add constraint observer_edge_device_updates_state_check
  check (state in ('IDLE','UPDATE_AVAILABLE','DOWNLOADING','VERIFYING','STAGED',
    'INSTALLING','RESTARTING','VERIFYING_HEALTH','HEALTHY','ROLLBACK_REQUIRED',
    'ROLLING_BACK','ROLLED_BACK','UPDATE_FAILED','ACTION_REQUIRED'));
commit;
