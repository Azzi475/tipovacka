-- Záloha dat před změnami (volitelné, doporučeno spustit ručně před migrací)
-- create table predictions_backup as select * from predictions;
-- create table matches_backup as select * from matches;

-- Rozšíření tabulky tournaments o API league/season
alter table tournaments
  add column if not exists api_league_id int,
  add column if not exists api_season int;

-- Tabulka pro logování fetchů
-- Používá se v /api/cron/fetch-results pro audit a diagnostiku.
create table if not exists fetch_logs (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  started_at timestamptz default now(),
  finished_at timestamptz,
  api_calls int default 0,
  matches_updated int default 0,
  matches_not_found int default 0,
  api_response jsonb,
  error text,
  triggered_by text not null check (triggered_by in ('cron','manual'))
);

-- Index pro rychlé zobrazení posledních logů v adminu
create index if not exists idx_fetch_logs_tournament_started
  on fetch_logs (tournament_id, started_at desc);
