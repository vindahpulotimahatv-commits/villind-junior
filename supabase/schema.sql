-- VILLIND JUNIOR TOURNAMENT - struktur database
-- Jalankan sekali di Supabase > SQL Editor > New query > Run.

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('U11','U15')),
  phase text not null default 'Babak Grup',
  team_a text not null,
  team_b text not null,
  kickoff timestamptz not null,
  venue text,
  score_a int not null default 0,
  score_b int not null default 0,
  status text not null default 'UPCOMING'
    check (status in ('UPCOMING','LIVE','HALF TIME','FULL TIME','POSTPONED','CANCELLED')),
  period int not null default 0,
  clock_base int not null default 0,
  clock_started_at timestamptz,
  is_demo boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  type text not null check (type in ('goal','undo','status','card')),
  team text check (team in ('A','B')),
  player text,
  minute int,
  note text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value text
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor text,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

-- KEAMANAN (Row Level Security)
alter table matches enable row level security;
alter table match_events enable row level security;
alter table settings enable row level security;
alter table activity_logs enable row level security;

-- Pengunjung: hanya boleh MEMBACA.
create policy "publik baca matches" on matches for select using (true);
create policy "publik baca events" on match_events for select using (true);
create policy "publik baca settings" on settings for select using (true);

-- Panitia (akun yang sudah login): boleh mengubah.
create policy "panitia ubah matches" on matches for all to authenticated using (true) with check (true);
create policy "panitia ubah events" on match_events for all to authenticated using (true) with check (true);
create policy "panitia ubah settings" on settings for all to authenticated using (true) with check (true);
-- Log aktivitas: panitia boleh menulis dan membaca, pengunjung tidak bisa melihat.
create policy "panitia tulis log" on activity_logs for insert to authenticated with check (true);
create policy "panitia baca log" on activity_logs for select to authenticated using (true);

-- Aktifkan realtime agar skor tampil langsung di website.
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table match_events;
