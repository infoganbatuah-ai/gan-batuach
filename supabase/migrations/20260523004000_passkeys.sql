create table if not exists public.passkey_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  device_type text,
  backed_up boolean not null default false,
  transports text[] not null default '{}',
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists public.passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  email text,
  challenge text not null,
  challenge_type text not null check (challenge_type in ('registration', 'authentication')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

create index if not exists passkey_credentials_user_idx on public.passkey_credentials(user_id);
create index if not exists passkey_credentials_email_idx on public.passkey_credentials(lower(email));
create index if not exists passkey_challenges_user_type_idx on public.passkey_challenges(user_id, challenge_type, created_at desc);
create index if not exists passkey_challenges_email_type_idx on public.passkey_challenges(lower(email), challenge_type, created_at desc);

alter table public.passkey_credentials enable row level security;
alter table public.passkey_challenges enable row level security;

do $$ begin
  create policy "Users can view their passkeys"
    on public.passkey_credentials for select
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can delete their passkeys"
    on public.passkey_credentials for delete
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can view their passkey challenges"
    on public.passkey_challenges for select
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
