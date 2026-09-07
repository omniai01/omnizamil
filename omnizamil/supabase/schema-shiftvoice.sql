-- ShiftVoice — same Supabase project as Omni / OmniGrab. Safe to re-run.
-- Does NOT modify devices / og_* tables.

create extension if not exists "pgcrypto";

-- Legacy app tables (ShiftVoice already pushes here)
create table if not exists public.shiftvoice_usage (
  id text primary key,
  kind text,
  chars integer default 0,
  exports integer default 0,
  job_id text,
  title text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.shiftvoice_batches (
  id text primary key,
  mode text,
  item_count integer default 0,
  chars integer default 0,
  job_ids jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.shiftvoice_jobs (
  id text primary key,
  kind text,
  status text,
  title text,
  chars integer default 0,
  path text,
  created_at timestamptz,
  updated_at timestamptz default now()
);

alter table public.shiftvoice_usage enable row level security;
alter table public.shiftvoice_batches enable row level security;
alter table public.shiftvoice_jobs enable row level security;

drop policy if exists "anon insert usage" on public.shiftvoice_usage;
drop policy if exists "anon insert batches" on public.shiftvoice_batches;
drop policy if exists "anon insert jobs" on public.shiftvoice_jobs;
drop policy if exists sv_legacy_usage_all on public.shiftvoice_usage;
drop policy if exists sv_legacy_batches_all on public.shiftvoice_batches;
drop policy if exists sv_legacy_jobs_all on public.shiftvoice_jobs;

create policy sv_legacy_usage_all on public.shiftvoice_usage
  for all to anon, authenticated using (true) with check (true);
create policy sv_legacy_batches_all on public.shiftvoice_batches
  for all to anon, authenticated using (true) with check (true);
create policy sv_legacy_jobs_all on public.shiftvoice_jobs
  for all to anon, authenticated using (true) with check (true);

-- Admin-compatible device cloud (mirrors og_* shape)
-- image_count = total characters generated; video_count = export count
create table if not exists public.sv_devices (
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

create index if not exists sv_devices_last_ping_idx on public.sv_devices (last_ping desc);
create index if not exists sv_devices_status_idx on public.sv_devices (status);
create index if not exists sv_devices_country_idx on public.sv_devices (country_code);

create table if not exists public.sv_usage_events (
  id uuid primary key default gen_random_uuid(),
  hwid text not null references public.sv_devices(hwid) on delete cascade,
  event_type text not null check (event_type in ('register', 'heartbeat', 'download', 'fail')),
  media_type text check (media_type is null or media_type in ('video', 'audio', 'file')),
  success boolean,
  elapsed_ms integer,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sv_usage_events_hwid_idx on public.sv_usage_events (hwid, created_at desc);

create table if not exists public.sv_error_logs (
  id uuid primary key default gen_random_uuid(),
  hwid text not null references public.sv_devices(hwid) on delete cascade,
  user_alias text default '',
  error_type text not null default 'ENGINE',
  message text not null,
  stack_trace text default '',
  severity text not null default 'warning' check (severity in ('critical', 'warning', 'info')),
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sv_error_logs_status_idx on public.sv_error_logs (status, created_at desc);

create table if not exists public.sv_app_settings (
  id int primary key default 1 check (id = 1),
  maintenance_enabled boolean not null default false,
  maintenance_message text not null default 'ShiftVoice is under maintenance. Please try again later.',
  affect_all_devices boolean not null default true,
  allowed_hwids text[] not null default '{}',
  lock_engine boolean not null default true,
  force_update boolean not null default false,
  latest_version text not null default '1.6.0',
  update_url text default '',
  update_message text not null default 'A new ShiftVoice update is available. Download and install it to continue.',
  social_links jsonb not null default '{
    "youtube": "https://youtube.com",
    "twitter": "https://x.com",
    "facebook": "https://facebook.com",
    "instagram": "https://instagram.com",
    "whatsapp": "https://whatsapp.com/channel",
    "discord": "https://discord.com"
  }'::jsonb,
  brand_name text default 'ShiftVoice',
  brand_tagline text default 'Local TTS by ShiftZero.',
  brand_about text default 'ShiftVoice turns scripts into speech on your PC.',
  brand_website_url text default 'https://shiftzero.netlify.app',
  brand_logo_url text default '',
  image_target bigint not null default 1000000,
  video_target bigint not null default 1000000,
  site_views bigint not null default 0,
  download_clicks bigint not null default 0,
  update_clicks bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.sv_app_settings (id) values (1) on conflict (id) do nothing;

-- Maintenance timer (admin UI expects these; Omni/Grab already had them)
alter table public.sv_app_settings
  add column if not exists maintenance_duration_minutes integer not null default 0,
  add column if not exists maintenance_started_at timestamptz null;

create table if not exists public.sv_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  target_hwid text null,
  created_at timestamptz not null default now()
);

create index if not exists sv_notifications_created_idx on public.sv_notifications (created_at desc);

alter table public.sv_devices enable row level security;
alter table public.sv_usage_events enable row level security;
alter table public.sv_error_logs enable row level security;
alter table public.sv_app_settings enable row level security;
alter table public.sv_notifications enable row level security;

drop policy if exists sv_devices_anon_all on public.sv_devices;
create policy sv_devices_anon_all on public.sv_devices
  for all to anon, authenticated using (true) with check (true);

drop policy if exists sv_usage_anon_all on public.sv_usage_events;
create policy sv_usage_anon_all on public.sv_usage_events
  for all to anon, authenticated using (true) with check (true);

drop policy if exists sv_errors_anon_select on public.sv_error_logs;
create policy sv_errors_anon_select on public.sv_error_logs
  for select to anon, authenticated using (true);

drop policy if exists sv_errors_anon_insert on public.sv_error_logs;
create policy sv_errors_anon_insert on public.sv_error_logs
  for insert to anon, authenticated with check (true);

drop policy if exists sv_errors_anon_update on public.sv_error_logs;
create policy sv_errors_anon_update on public.sv_error_logs
  for update to anon, authenticated using (true) with check (true);

drop policy if exists sv_settings_anon_select on public.sv_app_settings;
create policy sv_settings_anon_select on public.sv_app_settings
  for select to anon, authenticated using (true);

drop policy if exists sv_notif_anon_select on public.sv_notifications;
create policy sv_notif_anon_select on public.sv_notifications
  for select to anon, authenticated using (true);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sv_devices_touch on public.sv_devices;
create trigger sv_devices_touch before update on public.sv_devices
for each row execute function public.touch_updated_at();

drop trigger if exists sv_error_logs_touch on public.sv_error_logs;
create trigger sv_error_logs_touch before update on public.sv_error_logs
for each row execute function public.touch_updated_at();

drop trigger if exists sv_app_settings_touch on public.sv_app_settings;
create trigger sv_app_settings_touch before update on public.sv_app_settings
for each row execute function public.touch_updated_at();

-- image_count += chars; video_count += exports (admin reuses same columns)
create or replace function public.sv_bump_tts(
  p_hwid text,
  p_chars int default 0,
  p_exports int default 0,
  p_success boolean default true,
  p_elapsed_ms int default 0,
  p_display_name text default null,
  p_kind text default 'tts',
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sv_devices set
    last_ping = now(),
    status = 'active',
    display_name = coalesce(nullif(p_display_name, ''), display_name),
    user_alias = coalesce(nullif(p_display_name, ''), user_alias),
    total_process_ms = total_process_ms + greatest(p_elapsed_ms, 0),
    image_count = image_count + case when p_success then greatest(p_chars, 0) else 0 end,
    video_count = video_count + case when p_success then greatest(p_exports, 0) else 0 end,
    fail_count = fail_count + case when not p_success then 1 else 0 end
  where hwid = p_hwid;

  insert into public.sv_usage_events (hwid, event_type, media_type, success, elapsed_ms, meta)
  values (
    p_hwid,
    case when p_success then 'download' else 'fail' end,
    'audio',
    p_success,
    greatest(p_elapsed_ms, 0),
    coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('kind', coalesce(nullif(p_kind, ''), 'tts'), 'chars', greatest(p_chars, 0))
  );
end;
$$;

grant execute on function public.sv_bump_tts(text, int, int, boolean, int, text, text, jsonb)
  to anon, authenticated;

create or replace function public.sv_admin_device_metrics(online_minutes int default 10)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - make_interval(mins => greatest(online_minutes, 1));
  result json;
begin
  select json_build_object(
    'total', (select count(*)::int from public.sv_devices),
    'active', (select count(*)::int from public.sv_devices where status = 'active' and last_ping >= cutoff),
    'choked', (select count(*)::int from public.sv_devices where status = 'choked'),
    'offline', (select count(*)::int from public.sv_devices where status = 'offline' or last_ping < cutoff),
    'images', (select coalesce(sum(image_count), 0)::bigint from public.sv_devices),
    'videos', (select coalesce(sum(video_count), 0)::bigint from public.sv_devices)
  ) into result;
  return result;
end;
$$;

grant execute on function public.sv_admin_device_metrics(int) to anon, authenticated;

create or replace function public.sv_admin_country_rollup()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  into result
  from (
    select
      coalesce(nullif(country, ''), 'Unknown') as country,
      coalesce(country_code, '') as country_code,
      count(*)::int as devices,
      coalesce(sum(image_count), 0)::bigint as images,
      coalesce(sum(video_count), 0)::bigint as videos
    from public.sv_devices
    group by 1, 2
    order by images + videos desc
  ) t;
  return result;
end;
$$;

grant execute on function public.sv_admin_country_rollup() to anon, authenticated;

create or replace function public.sv_platform_rollup()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  into result
  from (
    select
      coalesce(nullif(meta->>'kind', ''), 'tts') as platform,
      count(*) filter (where event_type = 'download' and success is true)::int as downloads,
      count(*) filter (where event_type = 'fail')::int as fails
    from public.sv_usage_events
    where event_type in ('download', 'fail')
    group by 1
    order by downloads desc
  ) t;
  return result;
end;
$$;

grant execute on function public.sv_platform_rollup() to anon, authenticated;

-- Top voices from usage event meta (voice / voices[])
create or replace function public.sv_voice_rollup(limit_n int default 20)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  into result
  from (
    select
      coalesce(
        nullif(trim(coalesce(e.meta->>'voice', e.meta->'voices'->>0, '')), ''),
        'unknown'
      ) as voice,
      count(*)::int as events,
      coalesce(sum(greatest(coalesce((e.meta->>'chars')::int, 0), 0)), 0)::bigint as chars,
      count(*) filter (where e.success is true)::int as ok,
      count(*) filter (where e.success is false)::int as fails
    from public.sv_usage_events e
    where e.event_type in ('download', 'fail')
      and coalesce(e.meta->>'kind', '') not in ('silence', 'align')
    group by 1
    order by chars desc, events desc
    limit greatest(limit_n, 1)
  ) t;
  return result;
end;
$$;

grant execute on function public.sv_voice_rollup(int) to anon, authenticated;

create or replace function public.sv_today_process_ms()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  day_start timestamptz := date_trunc('day', timezone('utc', now()));
  result json;
begin
  select json_build_object(
    'process_ms', (
      select coalesce(sum(greatest(elapsed_ms, 0)), 0)::bigint
      from public.sv_usage_events
      where created_at >= day_start
        and event_type in ('download', 'fail')
    ),
    'events', (
      select count(*)::int
      from public.sv_usage_events
      where created_at >= day_start
        and event_type in ('download', 'fail')
    ),
    'chars', (
      select coalesce(sum(greatest(coalesce((meta->>'chars')::int, 0), 0)), 0)::bigint
      from public.sv_usage_events
      where created_at >= day_start
        and event_type = 'download'
        and success is true
    ),
    'pending_jobs', (
      select count(*)::int
      from public.shiftvoice_jobs
      where status in ('queued', 'running')
    )
  ) into result;
  return result;
end;
$$;

grant execute on function public.sv_today_process_ms() to anon, authenticated;

NOTIFY pgrst, 'reload schema';
