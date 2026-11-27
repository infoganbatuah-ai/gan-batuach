-- The platform Admin compliance page reads these five existing sources with
-- bounded queries. The later Management policies retain guardian/Garden scope
-- but omit the platform Admin, making existing rows look empty to that page.
-- Add only authenticated, active platform-Admin SELECT access. Existing
-- guardian/Garden policies and all write privileges remain unchanged.

drop policy if exists management_attendance_admin_read on public.attendance;
create policy management_attendance_admin_read
  on public.attendance for select to authenticated
  using (public.is_admin());

drop policy if exists management_pickup_event_admin_read on public.child_pickup_events;
create policy management_pickup_event_admin_read
  on public.child_pickup_events for select to authenticated
  using (public.is_admin());

drop policy if exists management_authorized_adult_admin_read on public.authorized_adults;
create policy management_authorized_adult_admin_read
  on public.authorized_adults for select to authenticated
  using (public.is_admin());

drop policy if exists management_pickup_authorization_admin_read on public.pickup_authorizations;
create policy management_pickup_authorization_admin_read
  on public.pickup_authorizations for select to authenticated
  using (public.is_admin());

drop policy if exists management_attendance_audit_admin_read on public.attendance_compliance_audit_trail;
create policy management_attendance_audit_admin_read
  on public.attendance_compliance_audit_trail for select to authenticated
  using (public.is_admin());
