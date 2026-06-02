alter table public.inspectors
  add column if not exists identity_number text;

create unique index if not exists idx_inspectors_identity_number_unique
  on public.inspectors (identity_number)
  where identity_number is not null and btrim(identity_number) <> '';

notify pgrst, 'reload schema';
