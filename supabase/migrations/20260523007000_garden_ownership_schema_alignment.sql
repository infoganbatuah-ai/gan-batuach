-- Align production gardens ownership schema with application writes.

alter table public.gardens
  add column if not exists owner_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists ownership_type text not null default 'teacher_only',
  add column if not exists owner_role_label text;

update public.gardens
set ownership_type = case
  when owner_profile_id is not null and manager_id is not null and owner_profile_id = manager_id then 'teacher_is_owner'
  when owner_profile_id is not null and manager_id is not null and owner_profile_id <> manager_id then 'separate_owner'
  when owner_profile_id is not null and manager_id is null then 'owner_only'
  else 'teacher_only'
end
where ownership_type is null or ownership_type not in ('teacher_is_owner', 'separate_owner', 'teacher_only', 'owner_only');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gardens_ownership_type_check'
      and conrelid = 'public.gardens'::regclass
  ) then
    alter table public.gardens
      add constraint gardens_ownership_type_check
      check (ownership_type in ('teacher_is_owner', 'separate_owner', 'teacher_only', 'owner_only'));
  end if;
end $$;

notify pgrst, 'reload schema';
