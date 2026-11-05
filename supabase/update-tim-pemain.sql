-- UPDATE untuk fitur: ganti logo tim dan daftar pemain dari halaman admin.
-- Jalankan SEKALI di Supabase > SQL Editor > New query > Run.
-- Aman dijalankan pada database yang sudah berisi jadwal dan skor (data tidak hilang).

-- 1. Logo tim hasil unggahan (kalau kosong, website memakai logo bawaan)
create table if not exists team_logos (
  name text primary key,
  url text not null,
  updated_at timestamptz not null default now()
);

-- 2. Daftar pemain per tim dan kategori (hanya panitia yang bisa melihat dan mengubah)
create table if not exists team_players (
  id uuid primary key default gen_random_uuid(),
  team text not null,
  category text not null check (category in ('U11','U15')),
  no text,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists team_players_team_idx on team_players (team, category);

alter table team_logos enable row level security;
alter table team_players enable row level security;

drop policy if exists "publik baca logo tim" on team_logos;
create policy "publik baca logo tim" on team_logos for select using (true);
drop policy if exists "panitia ubah logo tim" on team_logos;
create policy "panitia ubah logo tim" on team_logos for all to authenticated using (true) with check (true);

drop policy if exists "panitia ubah pemain" on team_players;
create policy "panitia ubah pemain" on team_players for all to authenticated using (true) with check (true);

-- 3. Tempat penyimpanan file gambar logo
insert into storage.buckets (id, name, public) values ('logos', 'logos', true)
  on conflict (id) do update set public = true;

drop policy if exists "publik baca file logo" on storage.objects;
create policy "publik baca file logo" on storage.objects for select using (bucket_id = 'logos');
drop policy if exists "panitia unggah file logo" on storage.objects;
create policy "panitia unggah file logo" on storage.objects for insert to authenticated with check (bucket_id = 'logos');
drop policy if exists "panitia ubah file logo" on storage.objects;
create policy "panitia ubah file logo" on storage.objects for update to authenticated using (bucket_id = 'logos') with check (bucket_id = 'logos');
drop policy if exists "panitia hapus file logo" on storage.objects;
create policy "panitia hapus file logo" on storage.objects for delete to authenticated using (bucket_id = 'logos');

-- 4. Agar logo baru langsung tampil di website tanpa muat ulang
do $$ begin
  alter publication supabase_realtime add table team_logos;
exception when duplicate_object then null;
end $$;
