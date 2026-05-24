-- Stabilization additions for tasks, reports, document review and notifications.

alter table public.tasks
  add column if not exists assigned_role text,
  add column if not exists assigned_group text,
  add column if not exists repeat_rule text,
  add column if not exists priority text not null default 'medium',
  add column if not exists task_type text,
  add column if not exists requires_proof boolean not null default false,
  add column if not exists proof_files jsonb not null default '[]'::jsonb,
  add column if not exists completion_comment text,
  add column if not exists rejection_reason text,
  add column if not exists waiting_approval_at timestamptz;

alter table public.complaints
  add column if not exists category text default 'general',
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists last_response_at timestamptz,
  add column if not exists resolution text,
  add column if not exists child_id uuid references public.children(id) on delete set null,
  add column if not exists attachment_urls text[] not null default '{}';

alter table public.notifications
  add column if not exists severity text default 'medium';

alter table public.documents
  add column if not exists owner_type text,
  add column if not exists notes text;

notify pgrst, 'reload schema';
