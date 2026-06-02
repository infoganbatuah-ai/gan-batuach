-- Policies, credential state, messaging and inspection demand support.

alter table public.generated_credentials
  add column if not exists password_changed_at timestamptz,
  add column if not exists reset_sent_at timestamptz;

alter table public.messages
  add column if not exists status text not null default 'unread',
  add column if not exists content text,
  add column if not exists sent_at timestamptz not null default now();

update public.messages set content = body where content is null;

create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  policy_type text not null check (policy_type in ('kindergarten', 'parent', 'inspector', 'staff')),
  title text not null,
  body text not null,
  version integer not null default 1,
  published_at timestamptz,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (policy_type, version)
);

create table if not exists public.policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  policy_type text not null,
  version integer not null,
  accepted_at timestamptz not null default now(),
  unique (policy_id, user_id)
);

alter table public.policies enable row level security;
alter table public.policy_acceptances enable row level security;

drop policy if exists "policies readable authenticated" on public.policies;
create policy "policies readable authenticated" on public.policies for select using (auth.uid() is not null);
drop policy if exists "policies admin write" on public.policies;
create policy "policies admin write" on public.policies for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "policy acceptances own or admin" on public.policy_acceptances;
create policy "policy acceptances own or admin" on public.policy_acceptances for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "policy acceptances self insert" on public.policy_acceptances;
create policy "policy acceptances self insert" on public.policy_acceptances for insert with check (user_id = auth.uid());

insert into public.policies (policy_type, title, body, version, published_at, active)
values
  ('kindergarten', 'תקנון גני ילדים', 'תקנון זמני לגני ילדים: הגן מתחייב למסירת מידע נכון, שמירת פרטיות קטינים, ניהול מסמכים, עמידה בתהליכי פיקוח, טיפול בליקויים, שמירת הרשאות מצלמות ותיעוד אירועים.', 1, now(), true),
  ('parent', 'תקנון הורים', 'תקנון זמני להורים: ההורה מתחייב למסור פרטי ילד נכונים, לעדכן מידע רפואי, לכבד פרטיות ילדים אחרים, להשתמש בצפייה והרשאות רק לפי תנאי המערכת ולנהל פניות בצורה מתועדת.', 1, now(), true),
  ('inspector', 'תקנון מפקחים', 'תקנון זמני למפקחים: הפקח מתחייב לבצע ביקורות לפי סטנדרט גן בטוח, לתעד ממצאים, להשתמש ב-GPS וחתימה, לשמור סודיות ולדווח על חריגים בזמן.', 1, now(), true),
  ('staff', 'תקנון צוות', 'תקנון זמני לצוות: איש צוות מתחייב להשלים פרטים, להעלות אישורים, לדווח נוכחות, לשמור פרטיות ילדים, לפעול לפי נהלי הגן ולדווח על חריגים.', 1, now(), true)
on conflict (policy_type, version) do nothing;

notify pgrst, 'reload schema';
