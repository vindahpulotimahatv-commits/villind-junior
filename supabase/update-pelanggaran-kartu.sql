-- UPDATE untuk fitur pelanggaran, kartu kuning/merah, dan statistik layar penuh vMix.
-- Jalankan SEKALI di Supabase > SQL Editor > New query > Run.
-- Aman dijalankan pada database yang sudah berisi jadwal dan skor (data tidak hilang).
-- Jika Anda baru memasang dari awal dengan schema.sql terbaru, file ini TIDAK perlu dijalankan.

alter table match_events drop constraint if exists match_events_type_check;
alter table match_events add constraint match_events_type_check
  check (type in ('goal','undo','status','card','foul'));

alter table match_events add column if not exists period int;

do $$ begin
  alter publication supabase_realtime add table settings;
exception when duplicate_object then null;
end $$;
