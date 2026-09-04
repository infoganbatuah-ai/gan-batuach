-- Supabase installs pgcrypto in the extensions schema. The immutable audit
-- trigger previously restricted search_path to public, so inserts failed with
-- `function digest(text, unknown) does not exist` before camera diagnostics
-- could be queued. Qualify pgcrypto explicitly and keep the function's search
-- path locked down.
begin;

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_extension extension
    join pg_catalog.pg_namespace namespace
      on namespace.oid = extension.extnamespace
    where extension.extname = 'pgcrypto'
      and namespace.nspname = 'extensions'
  ) then
    raise exception 'pgcrypto_extension_schema_invalid' using errcode = '3F000';
  end if;
end;
$$;

create or replace function public.set_immutable_audit_hash()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_previous text;
  v_metadata_hash text;
begin
  select event_hash
    into v_previous
    from public.immutable_audit_events
   where event_hash is not null
   order by created_at desc, id desc
   limit 1;

  if new.previous_event_hash is null then
    new.previous_event_hash := v_previous;
  end if;

  v_metadata_hash := encode(
    extensions.digest(coalesce(new.metadata::text, '{}'), 'sha256'::text),
    'hex'
  );
  new.event_hash := encode(
    extensions.digest(concat_ws('|',
      new.id::text,
      new.event_type,
      new.event_category,
      coalesce(new.actor_profile_id::text, ''),
      coalesce(new.target_type, ''),
      coalesce(new.target_id::text, ''),
      coalesce(new.garden_id::text, ''),
      coalesce(new.child_id::text, ''),
      coalesce(new.camera_id::text, ''),
      coalesce(new.document_id::text, ''),
      new.created_at::text,
      v_metadata_hash,
      coalesce(new.previous_event_hash, '')
    ), 'sha256'::text),
    'hex'
  );

  return new;
end;
$$;

comment on function public.set_immutable_audit_hash() is
  'Builds the append-only audit hash chain with schema-qualified pgcrypto calls.';

-- Run the real trigger twice inside a savepoint. Fixed inputs provide an
-- independent compatibility fixture, and rollback removes both test rows
-- before the production migration commits.
savepoint immutable_audit_pgcrypto_self_test;
set local time zone 'UTC';

insert into public.immutable_audit_events (
  id, event_type, event_category, target_type, metadata, risk_level,
  created_at, previous_event_hash
) values (
  '0199a8bb-4db0-7f8f-8d91-96e4f58921b4',
  'immutable_audit_pgcrypto_self_test',
  'security',
  'migration',
  '{"sequence":1,"self_test":"pgcrypto_schema"}'::jsonb,
  'low',
  '2099-01-01 00:00:00+00'::timestamptz,
  repeat('0', 64)
);

insert into public.immutable_audit_events (
  id, event_type, event_category, target_type, metadata, risk_level,
  created_at, previous_event_hash
) values (
  '0199a8bb-4db0-7f8f-8d91-96e4f58921b5',
  'immutable_audit_pgcrypto_self_test',
  'security',
  'migration',
  '{"sequence":2,"self_test":"pgcrypto_schema"}'::jsonb,
  'low',
  '2099-01-01 00:00:01+00'::timestamptz,
  null
);

do $$
declare
  first_row public.immutable_audit_events%rowtype;
  second_row public.immutable_audit_events%rowtype;
begin
  select * into strict first_row
  from public.immutable_audit_events
  where id = '0199a8bb-4db0-7f8f-8d91-96e4f58921b4';

  select * into strict second_row
  from public.immutable_audit_events
  where id = '0199a8bb-4db0-7f8f-8d91-96e4f58921b5';

  if first_row.event_hash is distinct from 'a3a47da63b11cf2ea69adf5b61d3fab0e7659654958f1ea6cdede6e69f44c6e6'
    or length(first_row.event_hash) is distinct from 64
    or second_row.previous_event_hash is distinct from first_row.event_hash
    or second_row.event_hash is distinct from '9e1c9e4cd793e83218870787c0ef781ad6db708d856c9d01bfadf92687dac36a'
    or length(second_row.event_hash) is distinct from 64 then
    raise exception 'immutable_audit_pgcrypto_self_test_failed' using errcode = '23514';
  end if;
end;
$$;

rollback to savepoint immutable_audit_pgcrypto_self_test;
release savepoint immutable_audit_pgcrypto_self_test;

notify pgrst, 'reload schema';
commit;
