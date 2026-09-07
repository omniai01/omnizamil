-- Omni-Removal / OmniZamil telemetry schema (Supabase)
-- Run once in Supabase SQL Editor if the setup script cannot connect.

create extension if not exists "pgcrypto";

-- Bound devices (auto-register from desktop app)
create table if not exists public.devices (
  hwid text primary key,
  display_name text not null default '',
  user_alias text not null default '',
  os text default '',
  cpu text default '',
  ram_gb numeric default 0,
  gpu text default '',
  app_version text default '',
  country text not null default '',
  country_code text not null default '',
  status text not null default 'active' check (status in ('active', 'choked', 'offline', 'banned')),
  image_count bigint not null default 0,
  video_count bigint not null default 0,
  fail_count bigint not null default 0,
  total_process_ms bigint not null default 0,
  bytes_processed bigint not null default 0,
  last_ping timestamptz not null default now(),
  first_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists devices_last_ping_idx on public.devices (last_ping desc);
create index if not exists devices_status_idx on public.devices (status);

-- Per-job / heartbeat usage events
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  hwid text not null references public.devices(hwid) on delete cascade,
  event_type text not null check (event_type in ('register', 'heartbeat', 'image_clean', 'video_clean', 'fail')),
  media_type text check (media_type is null or media_type in ('image', 'video')),
  success boolean,
  elapsed_ms integer,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_hwid_idx on public.usage_events (hwid, created_at desc);
create index if not exists usage_events_type_idx on public.usage_events (event_type, created_at desc);

-- Engine / client errors (admin sees detail; user sees friendly message)
create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  hwid text not null references public.devices(hwid) on delete cascade,
  user_alias text default '',
  error_type text not null default 'ENGINE',
  message text not null,
  stack_trace text default '',
  severity text not null default 'warning' check (severity in ('critical', 'warning', 'info')),
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists error_logs_status_idx on public.error_logs (status, created_at desc);

-- Global control plane (maintenance / force update)
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  maintenance_enabled boolean not null default false,
  maintenance_message text not null default 'Omni-Removal is under maintenance. Please try again later.',
  affect_all_devices boolean not null default true,
  allowed_hwids text[] not null default '{}',
  lock_engine boolean not null default true,
  force_update boolean not null default false,
  latest_version text not null default '1.0.0',
  update_url text default '',
  update_message text not null default 'A new Omni-Removal update is available. Download and install it to continue.',
  social_links jsonb not null default '{
    "youtube": "https://youtube.com",
    "twitter": "https://x.com",
    "facebook": "https://facebook.com",
    "instagram": "https://instagram.com",
    "whatsapp": "https://whatsapp.com/channel",
    "discord": "https://discord.com"
  }'::jsonb,
  image_target bigint not null default 1000000,
  video_target bigint not null default 1000000,
  site_views bigint not null default 0,
  download_clicks bigint not null default 0,
  update_clicks bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id)
values (1)
on conflict (id) do nothing;

-- Admin → client notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  target_hwid text null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_created_idx on public.notifications (created_at desc);
create index if not exists notifications_target_idx on public.notifications (target_hwid);

-- Keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists devices_touch on public.devices;
create trigger devices_touch before update on public.devices
for each row execute function public.touch_updated_at();

drop trigger if exists error_logs_touch on public.error_logs;
create trigger error_logs_touch before update on public.error_logs
for each row execute function public.touch_updated_at();

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings
for each row execute function public.touch_updated_at();

-- RLS
alter table public.devices enable row level security;
alter table public.usage_events enable row level security;
alter table public.error_logs enable row level security;
alter table public.app_settings enable row level security;
alter table public.notifications enable row level security;

-- Desktop clients (anon / publishable): register + report only
drop policy if exists devices_anon_upsert on public.devices;
create policy devices_anon_upsert on public.devices
  for all to anon, authenticated
  using (true) with check (true);

drop policy if exists usage_anon_insert on public.usage_events;
create policy usage_anon_insert on public.usage_events
  for insert to anon, authenticated
  with check (true);

drop policy if exists usage_anon_select_own on public.usage_events;
create policy usage_anon_select_own on public.usage_events
  for select to anon, authenticated
  using (true);

drop policy if exists errors_anon_insert on public.error_logs;
create policy errors_anon_insert on public.error_logs
  for insert to anon, authenticated
  with check (true);

drop policy if exists errors_anon_select on public.error_logs;
create policy errors_anon_select on public.error_logs
  for select to anon, authenticated
  using (true);

drop policy if exists errors_anon_update on public.error_logs;
create policy errors_anon_update on public.error_logs
  for update to anon, authenticated
  using (true)
  with check (true);

drop policy if exists settings_anon_read on public.app_settings;
create policy settings_anon_read on public.app_settings
  for select to anon, authenticated
  using (true);

drop policy if exists notifications_anon_select on public.notifications;
create policy notifications_anon_select on public.notifications
  for select to anon, authenticated
  using (true);

-- service_role bypasses RLS automatically for the admin panel
