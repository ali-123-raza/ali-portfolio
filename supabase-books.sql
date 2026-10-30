-- Run this once in Supabase > SQL Editor (after supabase-schema.sql).

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text,
  category text,
  description text,
  file_path text not null,
  cover_path text,
  file_name text,
  file_type text,
  file_size bigint,
  downloads integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.books enable row level security;

create policy "Books are public"
  on public.books for select
  using (true);

create policy "Owners can add books"
  on public.books for insert
  with check (auth.uid() = owner_id);

create policy "Owners can update books"
  on public.books for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners can delete books"
  on public.books for delete
  using (auth.uid() = owner_id);

-- Lets anonymous visitors bump the counter without being able to edit anything else.
create or replace function public.increment_book_downloads(book_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.books set downloads = downloads + 1 where id = book_id;
$$;

grant execute on function public.increment_book_downloads(uuid) to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('books', 'books', true)
on conflict (id) do nothing;

create policy "Public can download books"
  on storage.objects for select
  using (bucket_id = 'books');

create policy "Owners can upload books"
  on storage.objects for insert
  with check (bucket_id = 'books' and auth.role() = 'authenticated');

create policy "Owners can delete books"
  on storage.objects for delete
  using (bucket_id = 'books' and auth.role() = 'authenticated');
