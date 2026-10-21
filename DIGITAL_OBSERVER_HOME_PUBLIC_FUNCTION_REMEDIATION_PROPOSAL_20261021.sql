-- REVIEW-ONLY Production proposal for PR #235. NOT a migration and NOT
-- approved for execution. First verify deployed definitions, caller inventory,
-- cron identity, and a current backup; rehearse on an isolated clone.
-- Changes grants only, not function bodies or data. No blanket revocation.
begin;

revoke execute on function public.assign_child_to_classroom(uuid,uuid,uuid)
  from public, anon;
revoke execute on function public.assign_staff_to_classroom(uuid,uuid,uuid,text)
  from public, anon;
revoke execute on function public.escalate_task(uuid,text,uuid)
  from public, anon;
-- Authenticated Product flows call the three functions above; their internal
-- authorization checks remain mandatory. Keep their existing authenticated
-- and service_role grants until actual caller compatibility is verified.

revoke execute on function public.notify_role(uuid,public.app_role,text,text,text,uuid)
  from public, anon, authenticated, service_role;
-- The verified current SQL caller is the SECURITY DEFINER monthly reminder
-- function owned by postgres. An older escalate_task definition called this
-- helper, but the later deployed definition no longer does.
-- Owner execution still works; any separately verified service caller needs
-- an explicit reviewed GRANT before this proposal can be activated.

revoke execute on function public.process_monthly_inspection_reminders(timestamptz)
  from public, anon, authenticated;
-- Existing protected cron route invokes this with createAdminClient;
-- service_role and owner retain access. Verify exact runtime role first.

commit;

-- Separate future-default phase, not included above, is documented in
-- DIGITAL_OBSERVER_HOME_LEGACY_SECURE_COMPARE_DESIGN_CLOSURE_20261021.md.
-- Rollback is a separately reviewed, exact-grant restore. Regranting PUBLIC
-- reopens the demonstrated exposure and is an emergency-only action.
