-- SECURITY FIX: parent RLS scope hardening.
-- Parents must not receive whole-kindergarten access through can_access_garden.
-- Parent access is child-specific, request-specific, or explicitly public-safe.

create or replace function public.can_manage_garden(target_garden_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_garden_id is not null and (
    public.is_admin()
    or exists (
      select 1
      from public.profiles p
      left join public.gardens g on g.id = target_garden_id
      left join public.network_manager_assignments nma
        on nma.network_id = g.network_id
        and nma.profile_id = p.id
        and nma.active = true
        and (nma.ends_at is null or nma.ends_at > now())
      where p.id = auth.uid()
        and p.active = true
        and (
          (p.role::text in ('manager', 'owner') and p.garden_id = target_garden_id)
          or (p.role::text = 'network_manager' and nma.id is not null)
        )
    )
  )
$$;

create or replace function public.can_staff_access_garden(target_garden_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_garden_id is not null and (
    public.can_manage_garden(target_garden_id)
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.active = true
        and p.role::text = 'staff'
        and p.garden_id = target_garden_id
    )
  )
$$;

create or replace function public.can_inspector_access_garden(target_garden_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_garden_id is not null and (
    public.is_admin()
    or exists (
      select 1
      from public.profiles p
      join public.gardens g on g.id = target_garden_id
      where p.id = auth.uid()
        and p.active = true
        and p.role::text = 'inspector'
        and g.inspector_id = p.id
    )
  )
$$;

create or replace function public.can_access_garden(target_garden_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_garden_id is not null
    and (
      public.can_manage_garden(target_garden_id)
      or public.can_staff_access_garden(target_garden_id)
      or public.can_inspector_access_garden(target_garden_id)
    )
$$;

create or replace function public.can_parent_access_child(target_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_child_id is not null
    and exists (
      select 1
      from public.children c
      left join public.parents p on p.id = c.primary_parent_id
      left join public.permanent_child_files f on f.id = c.permanent_child_file_id
      where c.id = target_child_id
        and (
          p.profile_id = auth.uid()
          or p.user_id = auth.uid()
          or f.primary_parent_profile_id = auth.uid()
        )
    )
$$;

create or replace function public.can_parent_access_child_file(target_child_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_child_file_id is not null
    and exists (
      select 1
      from public.permanent_child_files f
      where f.id = target_child_file_id
        and f.primary_parent_profile_id = auth.uid()
    )
$$;

create or replace function public.can_access_child_record(target_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_child_id is not null
    and exists (
      select 1
      from public.children c
      where c.id = target_child_id
        and (
          public.can_access_garden(c.garden_id)
          or public.can_parent_access_child(c.id)
        )
    )
$$;

create or replace function public.can_access_sensitive_child_data(target_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_child_record(target_child_id)
$$;

create or replace function public.can_parent_access_enrollment_request(target_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_request_id is not null
    and exists (
      select 1
      from public.kindergarten_enrollment_requests r
      left join public.permanent_child_files f on f.id = r.child_profile_id
      where r.id = target_request_id
        and (
          r.parent_id = auth.uid()
          or f.primary_parent_profile_id = auth.uid()
        )
    )
$$;

create or replace function public.can_access_document(target_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_document_id is not null
    and exists (
      select 1
      from public.documents d
      left join public.staff s on s.id = d.staff_id
      where d.id = target_document_id
        and (
          public.is_admin()
          or d.uploaded_by = auth.uid()
          or (d.child_id is not null and public.can_access_child_record(d.child_id))
          or (d.staff_id is not null and s.profile_id = auth.uid())
          or (d.garden_id is not null and public.can_manage_garden(d.garden_id))
        )
    )
$$;

create or replace function public.can_access_payment_record(target_payment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_payment_id is not null
    and exists (
      select 1
      from public.subscription_payments p
      where p.id = target_payment_id
        and (
          public.is_admin()
          or public.can_manage_garden(p.garden_id)
        )
    )
$$;

drop policy if exists "children garden scoped read" on public.children;
create policy "children scoped read hardened" on public.children
for select using (public.can_access_child_record(id));

drop policy if exists "jwt tenant children read" on public.children;
create policy "jwt tenant children read hardened" on public.children
for select using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or exists (
    select 1
    from public.parents p
    where p.id = children.primary_parent_id
      and (p.profile_id = auth.uid() or p.user_id = auth.uid())
  )
);

drop policy if exists "children manager parent write" on public.children;
create policy "children manager write hardened" on public.children
for insert with check (public.is_admin() or public.can_manage_garden(garden_id));

drop policy if exists "children manager update" on public.children;
create policy "children manager update hardened" on public.children
for update using (public.is_admin() or public.can_manage_garden(garden_id))
with check (public.is_admin() or public.can_manage_garden(garden_id));

drop policy if exists "parents garden scoped read" on public.parents;
create policy "parents scoped read hardened" on public.parents
for select using (
  public.is_admin()
  or public.can_manage_garden(garden_id)
  or profile_id = auth.uid()
  or user_id = auth.uid()
);

drop policy if exists "parents write own garden" on public.parents;
create policy "parents scoped write hardened" on public.parents
for all using (
  public.is_admin()
  or public.can_manage_garden(garden_id)
  or profile_id = auth.uid()
  or user_id = auth.uid()
)
with check (
  public.is_admin()
  or public.can_manage_garden(garden_id)
  or profile_id = auth.uid()
  or user_id = auth.uid()
);

drop policy if exists "staff garden scoped read" on public.staff;
create policy "staff scoped read hardened" on public.staff
for select using (
  public.is_admin()
  or public.can_manage_garden(garden_id)
  or public.can_inspector_access_garden(garden_id)
  or profile_id = auth.uid()
);

drop policy if exists "staff manager write" on public.staff;
create policy "staff manager write hardened" on public.staff
for all using (public.is_admin() or public.can_manage_garden(garden_id))
with check (public.is_admin() or public.can_manage_garden(garden_id));

drop policy if exists "documents scoped read" on public.documents;
create policy "documents scoped read hardened" on public.documents
for select using (public.can_access_document(id));

drop policy if exists "documents scoped write" on public.documents;
create policy "documents scoped insert hardened" on public.documents
for insert with check (
  public.is_admin()
  or (garden_id is not null and public.can_manage_garden(garden_id))
  or uploaded_by = auth.uid()
  or (child_id is not null and public.can_parent_access_child(child_id))
);

create policy "documents scoped update hardened" on public.documents
for update using (
  public.is_admin()
  or (garden_id is not null and public.can_manage_garden(garden_id))
  or uploaded_by = auth.uid()
)
with check (
  public.is_admin()
  or (garden_id is not null and public.can_manage_garden(garden_id))
  or uploaded_by = auth.uid()
);

drop policy if exists "child daily journals scoped read" on public.child_daily_journals;
create policy "child daily journals scoped read hardened" on public.child_daily_journals
for select using (public.can_access_child_record(child_id));

drop policy if exists "child daily journals scoped write" on public.child_daily_journals;
create policy "child daily journals scoped write hardened" on public.child_daily_journals
for all using (public.is_admin() or public.can_staff_access_garden(garden_id))
with check (public.is_admin() or public.can_staff_access_garden(garden_id));

drop policy if exists "child health scoped read" on public.child_health_records;
create policy "child health scoped read hardened" on public.child_health_records
for select using (public.can_access_sensitive_child_data(child_id));

drop policy if exists "child health scoped write" on public.child_health_records;
create policy "child health scoped write hardened" on public.child_health_records
for all using (public.is_admin() or public.can_staff_access_garden(garden_id))
with check (public.is_admin() or public.can_staff_access_garden(garden_id));

drop policy if exists "medicine logs scoped read" on public.medicine_given_logs;
create policy "medicine logs scoped read hardened" on public.medicine_given_logs
for select using (public.can_access_sensitive_child_data(child_id));

drop policy if exists "medicine logs scoped write" on public.medicine_given_logs;
create policy "medicine logs scoped write hardened" on public.medicine_given_logs
for all using (public.is_admin() or public.can_staff_access_garden(garden_id))
with check (public.is_admin() or public.can_staff_access_garden(garden_id));

drop policy if exists "medical scoped read" on public.medical_events;
create policy "medical scoped read hardened" on public.medical_events
for select using (public.can_access_sensitive_child_data(child_id));

drop policy if exists "medical manager write" on public.medical_events;
create policy "medical manager write hardened" on public.medical_events
for all using (public.is_admin() or public.can_staff_access_garden(garden_id))
with check (public.is_admin() or public.can_staff_access_garden(garden_id));

drop policy if exists "incident timeline scoped read" on public.incident_timeline;
create policy "incident timeline scoped read hardened" on public.incident_timeline
for select using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or (entity_type in ('child', 'children') and public.can_parent_access_child(entity_id))
);

drop policy if exists "incident timeline scoped insert" on public.incident_timeline;
create policy "incident timeline scoped insert hardened" on public.incident_timeline
for insert with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "child timeline scoped read" on public.child_timeline_events;
create policy "child timeline scoped read hardened" on public.child_timeline_events
for select using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or public.can_parent_access_child(child_id)
  or public.can_parent_access_child_file(permanent_child_file_id)
);

drop policy if exists "child timeline scoped insert" on public.child_timeline_events;
create policy "child timeline scoped insert hardened" on public.child_timeline_events
for insert with check (public.is_admin() or public.can_access_garden(garden_id) or actor_id = auth.uid());

drop policy if exists "child enrollments scoped read" on public.child_kindergarten_enrollments;
create policy "child enrollments scoped read hardened" on public.child_kindergarten_enrollments
for select using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or public.can_parent_access_child(child_id)
  or public.can_parent_access_child_file(permanent_child_file_id)
);

drop policy if exists "child enrollments scoped write" on public.child_kindergarten_enrollments;
create policy "child enrollments scoped write hardened" on public.child_kindergarten_enrollments
for all using (public.is_admin() or public.can_manage_garden(garden_id))
with check (public.is_admin() or public.can_manage_garden(garden_id));

drop policy if exists "parent kindergarten links scoped read" on public.parent_kindergarten_links;
create policy "parent kindergarten links scoped read hardened" on public.parent_kindergarten_links
for select using (
  public.is_admin()
  or public.can_manage_garden(garden_id)
  or parent_profile_id = auth.uid()
);

drop policy if exists "parent kindergarten links scoped write" on public.parent_kindergarten_links;
create policy "parent kindergarten links scoped write hardened" on public.parent_kindergarten_links
for all using (public.is_admin() or public.can_manage_garden(garden_id))
with check (public.is_admin() or public.can_manage_garden(garden_id));

drop policy if exists "kindergarten subscriptions by role" on public.kindergarten_subscriptions;
create policy "kindergarten subscriptions manager admin read" on public.kindergarten_subscriptions
for select using (public.is_admin() or public.can_manage_garden(garden_id));

drop policy if exists "subscription payments by role" on public.subscription_payments;
create policy "subscription payments manager admin read" on public.subscription_payments
for select using (public.is_admin() or public.can_manage_garden(garden_id));

drop policy if exists "billing invoices by role" on public.billing_invoices;
create policy "billing invoices manager admin read" on public.billing_invoices
for select using (public.is_admin() or public.can_manage_garden(garden_id));

drop policy if exists "billing receipts by role" on public.billing_receipts;
create policy "billing receipts manager admin read" on public.billing_receipts
for select using (public.is_admin() or public.can_manage_garden(garden_id));

drop policy if exists "payment history garden scoped read" on public.child_payment_history;
create policy "payment history scoped read hardened" on public.child_payment_history
for select using (
  public.is_admin()
  or public.can_manage_garden(garden_id)
  or public.can_parent_access_child(child_id)
);

drop policy if exists "payment history manager write" on public.child_payment_history;
create policy "payment history manager write hardened" on public.child_payment_history
for all using (public.is_admin() or public.can_manage_garden(garden_id))
with check (public.is_admin() or public.can_manage_garden(garden_id));

drop policy if exists "attendance scoped read" on public.attendance;
create policy "attendance scoped read hardened" on public.attendance
for select using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or (child_id is not null and public.can_parent_access_child(child_id))
);

drop policy if exists "jwt tenant attendance read" on public.attendance;
create policy "jwt tenant attendance read hardened" on public.attendance
for select using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or (child_id is not null and public.can_parent_access_child(child_id))
);

drop policy if exists "attendance scoped write" on public.attendance;
create policy "attendance scoped write hardened" on public.attendance
for all using (
  public.is_admin()
  or public.can_staff_access_garden(garden_id)
  or (child_id is not null and public.can_parent_access_child(child_id))
)
with check (
  public.is_admin()
  or public.can_staff_access_garden(garden_id)
  or (child_id is not null and public.can_parent_access_child(child_id))
);

drop policy if exists "complaints scoped read" on public.complaints;
create policy "complaints scoped read hardened" on public.complaints
for select using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or exists (
    select 1 from public.parents p
    where p.id = complaints.parent_id
      and (p.profile_id = auth.uid() or p.user_id = auth.uid())
  )
  or (child_id is not null and public.can_parent_access_child(child_id))
);

drop policy if exists "complaints parent insert" on public.complaints;
create policy "complaints scoped insert hardened" on public.complaints
for insert with check (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or exists (
    select 1 from public.parents p
    where p.id = complaints.parent_id
      and (p.profile_id = auth.uid() or p.user_id = auth.uid())
  )
  or (child_id is not null and public.can_parent_access_child(child_id))
);

drop policy if exists "complaints admin inspector update" on public.complaints;
create policy "complaints admin inspector update hardened" on public.complaints
for update using (public.is_admin() or public.can_inspector_access_garden(garden_id))
with check (public.is_admin() or public.can_inspector_access_garden(garden_id));

drop policy if exists "pickup scoped read" on public.pickup_confirmations;
create policy "pickup scoped read hardened" on public.pickup_confirmations
for select using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or public.can_parent_access_child(child_id)
);

drop policy if exists "pickup parent insert" on public.pickup_confirmations;
create policy "pickup scoped insert hardened" on public.pickup_confirmations
for insert with check (
  public.is_admin()
  or public.can_staff_access_garden(garden_id)
  or public.can_parent_access_child(child_id)
);

drop policy if exists "ai events scoped read" on public.ai_events;
create policy "ai events scoped read hardened" on public.ai_events
for select using (
  public.is_admin()
  or (public.current_role()::text in ('manager', 'owner', 'staff', 'inspector') and public.can_access_garden(garden_id))
);

drop policy if exists "ai events service/admin write" on public.ai_events;
create policy "ai events service/admin write hardened" on public.ai_events
for all using (
  public.is_admin()
  or (public.current_role()::text in ('manager', 'owner', 'inspector') and public.can_access_garden(garden_id))
)
with check (
  public.is_admin()
  or (public.current_role()::text in ('manager', 'owner', 'inspector') and public.can_access_garden(garden_id))
);

drop policy if exists "jwt tenant camera streams read" on public.camera_streams;
create policy "jwt tenant camera streams read hardened" on public.camera_streams
for select using (
  public.is_admin()
  or public.can_access_garden(coalesce(garden_id, kindergarten_id))
);

comment on function public.can_access_garden(uuid) is 'Operational garden access only. Does not grant parent whole-kindergarten access.';
comment on function public.can_parent_access_child(uuid) is 'Parent child-specific access helper. Use for parent access to child-scoped sensitive records.';
comment on function public.can_access_sensitive_child_data(uuid) is 'Sensitive child data helper; parent access is child-specific, operational roles remain garden-scoped.';
comment on function public.can_access_document(uuid) is 'Document access helper; checks uploader, child ownership, staff self-document, manager/admin garden access.';

notify pgrst, 'reload schema';
