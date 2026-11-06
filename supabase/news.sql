-- VILLIND JUNIOR TOURNAMENT: modul berita (migrasi additive, tidak mengubah tabel lama)
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'UPDATE',
  excerpt text,
  body text not null,
  image_url text,
  published boolean not null default false,
  author text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.news enable row level security;
drop policy if exists "public read published news" on public.news;
drop policy if exists "authenticated manage news" on public.news;
create policy "public read published news" on public.news for select using (published = true);
create policy "authenticated manage news" on public.news for all to authenticated using (true) with check (true);

create index if not exists news_published_created_idx on public.news (published, created_at desc);
-- Realtime tidak diperlukan untuk berita; halaman publik memuat berita saat dibuka.
