-- Hausfußball Supabase foundation
-- Live-Spielstand und Push-Tokens bleiben vorerst in Cloudflare D1.
-- Diese Tabelle ist für spätere Cloud-News gedacht.
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 5000),
  category text not null default 'Allgemein',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.news enable row level security;

drop policy if exists "Anyone can read published news" on public.news;
create policy "Anyone can read published news"
  on public.news for select
  using (published = true);

drop policy if exists "Admins can manage news" on public.news;
create policy "Admins can manage news"
  on public.news for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create index if not exists news_published_created_at_idx
  on public.news (published, created_at desc);
