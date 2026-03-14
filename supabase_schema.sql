-- Supabase schema for Boban Status Dashboard

create table if not exists agent_status (
  id bigserial primary key,
  ts timestamptz not null default now(),
  current_task text,
  mac_ram_pct numeric(5,2),
  mac_cpu_pct numeric(5,2),
  mac_disk_pct numeric(5,2),
  gateway_running boolean,
  oauth_expires_days integer,
  last_message text
);

create index if not exists agent_status_ts_idx on agent_status(ts desc);

create table if not exists agent_backlog (
  id bigserial primary key,
  title text not null,
  description text,
  priority integer not null check (priority between 1 and 5),
  status text not null check (status in ('pending','in_progress','done','blocked')) default 'pending',
  created_by text not null check (created_by in ('human','boban')) default 'human',
  tags text[],
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists agent_backlog_status_idx on agent_backlog(status);
create index if not exists agent_backlog_priority_idx on agent_backlog(priority);

create table if not exists agent_events (
  id bigserial primary key,
  ts timestamptz not null default now(),
  type text not null,
  message text not null
);

create index if not exists agent_events_ts_idx on agent_events(ts desc);
create index if not exists agent_events_type_idx on agent_events(type);

create table if not exists agent_learning_backlog (
  id bigserial primary key,
  topic text not null,
  why text,
  priority integer not null check (priority between 1 and 5),
  status text not null check (status in ('pending','in_progress','done','blocked')) default 'pending',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists agent_learning_backlog_status_idx on agent_learning_backlog(status);
create index if not exists agent_learning_backlog_priority_idx on agent_learning_backlog(priority);

-- ── Bertik: betting intelligence ────────────────────────────────────────────
create table if not exists betting_recommendations (
  id             bigserial primary key,

  -- Structured event fields (preferred over legacy event_name/selection)
  sport          text,                  -- "soccer" | "basketball" | "tennis" | …
  league         text,                  -- "EPL" | "NBA" | "UCL" | …
  event_id       text,                  -- "soccer-epl-2026-03-15-ars-che"
  market_type    text,                  -- "h2h" | "totals" | "btts" | "spreads"
  selection_name text,                  -- "Arsenal" | "Over 2.5" | "Yes"

  -- Legacy plain-text fallbacks (kept for backward compatibility)
  event_name     text,
  selection      text,

  -- Core betting fields
  odds           numeric(6,3) not null,
  edge_pct       numeric(5,2),
  ev_pct         numeric(5,2),
  stake_pct      numeric(5,2),
  confidence     text check (confidence in ('high','medium','low')) default 'medium',
  status         text not null
                   check (status in ('recommended','won','lost','push','void'))
                   default 'recommended',
  profit_loss    numeric(8,3),
  recommended_at timestamptz not null default now(),
  settled_at     timestamptz,
  notes          text
);

create index if not exists betting_recs_status_idx     on betting_recommendations(status);
create index if not exists betting_recs_sport_idx      on betting_recommendations(sport);
create index if not exists betting_recs_event_id_idx   on betting_recommendations(event_id);
create index if not exists betting_recs_rec_at_idx     on betting_recommendations(recommended_at desc);
create index if not exists betting_recs_settled_at_idx on betting_recommendations(settled_at desc);

-- Migration: add new columns to an existing table
-- alter table betting_recommendations
--   add column if not exists sport          text,
--   add column if not exists league         text,
--   add column if not exists event_id       text,
--   add column if not exists market_type    text,
--   add column if not exists selection_name text;
