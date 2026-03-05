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
