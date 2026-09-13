create table if not exists public.editorial_articles (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null, summary text not null, body text not null,
  image_url text not null, image_alt text not null,
  ages text not null, garden_groups text[] not null default '{}', tags text[] not null default '{}',
  meta_title text not null, meta_description text not null,
  faqs jsonb not null default '[]'::jsonb, sources jsonb not null default '[]'::jsonb,
  published_at timestamptz not null default now(), status text not null default 'draft' check (status in ('published', 'draft')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists editorial_articles_publication_idx on public.editorial_articles (status, published_at desc);
alter table public.editorial_articles enable row level security;
create policy "editorial published read" on public.editorial_articles for select using (status = 'published' and published_at <= now());
create policy "editorial admin manage" on public.editorial_articles for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('editorial-images', 'editorial-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "editorial images public read" on storage.objects for select using (bucket_id = 'editorial-images');
