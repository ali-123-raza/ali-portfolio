create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  excerpt text,
  content text not null,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts enable row level security;

create policy "Published posts are public"
  on public.posts for select
  using (published = true or auth.uid() = author_id);

create policy "Owners can create posts"
  on public.posts for insert
  with check (auth.uid() = author_id);

create policy "Owners can update posts"
  on public.posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "Owners can delete posts"
  on public.posts for delete
  using (auth.uid() = author_id);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  file_url text not null,
  resource_type text not null default 'pdf',
  created_at timestamptz not null default now()
);

alter table public.resources enable row level security;

create policy "Resources are public"
  on public.resources for select
  using (true);

create policy "Owners can create resources"
  on public.resources for insert
  with check (auth.uid() = owner_id);

create policy "Owners can update resources"
  on public.resources for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners can delete resources"
  on public.resources for delete
  using (auth.uid() = owner_id);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

create policy "Public can download documents"
  on storage.objects for select
  using (bucket_id = 'documents');

create policy "Owners can upload documents"
  on storage.objects for insert
  with check (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "Owners can manage documents"
  on storage.objects for delete
  using (bucket_id = 'documents' and auth.role() = 'authenticated');
