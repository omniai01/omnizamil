-- OmniGrab (ShiftGrab desktop) — same Supabase project, separate tables.
-- Run once in Supabase SQL Editor (safe to re-run). Does NOT touch Omni Removal tables.

create extension if not exists "pgcrypto";

create table if not exists public.og_devices (
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
  -- image_count = total successful downloads (audio+video+files)
  image_count bigint not null default 0,
  -- video_count = successful video downloads
  video_count bigint not null default 0,
  fail_count bigint not null default 0,
  total_process_ms bigint not null default 0,
  bytes_processed bigint not null default 0,
  youtube_linked boolean not null default false,
  youtube_linked_at timestamptz,
  last_ping timestamptz not null default now(),
  first_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists og_devices_last_ping_idx on public.og_devices (last_ping desc);
create index if not exists og_devices_status_idx on public.og_devices (status);
create index if not exists og_devices_status_last_ping_idx on public.og_devices (status, last_ping desc);
create index if not exists og_devices_country_idx on public.og_devices (country_code);

create table if not exists public.og_usage_events (
  id uuid primary key default gen_random_uuid(),
  hwid text not null references public.og_devices(hwid) on delete cascade,
  event_type text not null check (event_type in ('register', 'heartbeat', 'download', 'fail')),
  media_type text check (media_type is null or media_type in ('video', 'audio', 'file')),
  success boolean,
  elapsed_ms integer,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists og_usage_events_hwid_idx on public.og_usage_events (hwid, created_at desc);
create index if not exists og_usage_events_type_idx on public.og_usage_events (event_type, created_at desc);
create index if not exists og_usage_events_job_idx
  on public.og_usage_events (event_type, created_at desc)
  where event_type in ('download', 'fail', 'register');

create table if not exists public.og_error_logs (
  id uuid primary key default gen_random_uuid(),
  hwid text not null references public.og_devices(hwid) on delete cascade,
  user_alias text default '',
  error_type text not null default 'ENGINE',
  message text not null,
  stack_trace text default '',
  severity text not null default 'warning' check (severity in ('critical', 'warning', 'info')),
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists og_error_logs_status_idx on public.og_error_logs (status, created_at desc);

create table if not exists public.og_app_settings (
  id int primary key default 1 check (id = 1),
  maintenance_enabled boolean not null default false,
  maintenance_message text not null default 'OmniGrab is under maintenance. Please try again later.',
  affect_all_devices boolean not null default true,
  allowed_hwids text[] not null default '{}',
  lock_engine boolean not null default true,
  force_update boolean not null default false,
  latest_version text not null default '1.1.0',
  update_url text default 'https://github.com/omniai01/shiftgrab/releases/latest/download/ShiftGrab-Final.exe',
  update_message text not null default 'A new OmniGrab / ShiftGrab update is available. Download and install it to continue.',
  social_links jsonb not null default '{
    "youtube": "https://youtube.com",
    "twitter": "https://x.com",
    "facebook": "https://facebook.com",
    "instagram": "https://instagram.com",
    "whatsapp": "https://whatsapp.com/channel",
    "discord": "https://discord.com"
  }'::jsonb,
  brand_name text default 'ShiftGrab',
  brand_tagline text default 'On-device downloader by ShiftZero.',
  brand_about text default 'ShiftGrab downloads YouTube and social media locally. Admin product name: OmniGrab.',
  brand_website_url text default 'https://shiftzero.netlify.app',
  brand_logo_url text default '',
  image_target bigint not null default 1000000,
  video_target bigint not null default 1000000,
  site_views bigint not null default 0,
  download_clicks bigint not null default 0,
  update_clicks bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.og_app_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.og_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  target_hwid text null,
  created_at timestamptz not null default now()
);

create index if not exists og_notifications_created_idx on public.og_notifications (created_at desc);
create index if not exists og_notifications_target_idx on public.og_notifications (target_hwid);
create index if not exists og_notifications_broadcast_idx
  on public.og_notifications (created_at desc)
  where target_hwid is null;

alter table public.og_devices enable row level security;
alter table public.og_usage_events enable row level security;
alter table public.og_error_logs enable row level security;
alter table public.og_app_settings enable row level security;
alter table public.og_notifications enable row level security;

drop policy if exists og_devices_anon_all on public.og_devices;
create policy og_devices_anon_all on public.og_devices
  for all to anon, authenticated using (true) with check (true);

drop policy if exists og_usage_anon_all on public.og_usage_events;
create policy og_usage_anon_all on public.og_usage_events
  for all to anon, authenticated using (true) with check (true);

drop policy if exists og_errors_anon_select on public.og_error_logs;
create policy og_errors_anon_select on public.og_error_logs
  for select to anon, authenticated using (true);

drop policy if exists og_errors_anon_insert on public.og_error_logs;
create policy og_errors_anon_insert on public.og_error_logs
  for insert to anon, authenticated with check (true);

drop policy if exists og_errors_anon_update on public.og_error_logs;
create policy og_errors_anon_update on public.og_error_logs
  for update to anon, authenticated using (true) with check (true);

drop policy if exists og_settings_anon_select on public.og_app_settings;
create policy og_settings_anon_select on public.og_app_settings
  for select to anon, authenticated using (true);

drop policy if exists og_notif_anon_select on public.og_notifications;
create policy og_notif_anon_select on public.og_notifications
  for select to anon, authenticated using (true);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists og_devices_touch on public.og_devices;
create trigger og_devices_touch before update on public.og_devices
for each row execute function public.touch_updated_at();

drop trigger if exists og_error_logs_touch on public.og_error_logs;
create trigger og_error_logs_touch before update on public.og_error_logs
for each row execute function public.touch_updated_at();

drop trigger if exists og_app_settings_touch on public.og_app_settings;
create trigger og_app_settings_touch before update on public.og_app_settings
for each row execute function public.touch_updated_at();

create or replace function public.og_bump_analytics(kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if kind = 'view' then
    update public.og_app_settings set site_views = coalesce(site_views, 0) + 1 where id = 1;
  elsif kind = 'download' then
    update public.og_app_settings set download_clicks = coalesce(download_clicks, 0) + 1 where id = 1;
  elsif kind = 'update_click' then
    update public.og_app_settings set update_clicks = coalesce(update_clicks, 0) + 1 where id = 1;
  end if;
end;
$$;

grant execute on function public.og_bump_analytics(text) to anon, authenticated;

create or replace function public.og_bump_download(
  p_hwid text,
  p_media text,
  p_success boolean,
  p_elapsed_ms int,
  p_bytes bigint default 0,
  p_display_name text default null,
  p_platform text default null,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text;
  v_meta jsonb;
begin
  v_event := case when p_success then 'download' else 'fail' end;
  v_meta := coalesce(p_meta, '{}'::jsonb) || jsonb_build_object(
    'platform', coalesce(nullif(p_platform, ''), 'unknown')
  );

  update public.og_devices set
    last_ping = now(),
    status = 'active',
    display_name = coalesce(nullif(p_display_name, ''), display_name),
    user_alias = coalesce(nullif(p_display_name, ''), user_alias),
    total_process_ms = total_process_ms + greatest(p_elapsed_ms, 0),
    bytes_processed = coalesce(bytes_processed, 0) + greatest(p_bytes, 0),
    image_count = image_count + case when p_success then 1 else 0 end,
    video_count = video_count + case when p_success and p_media = 'video' then 1 else 0 end,
    fail_count = fail_count + case when not p_success then 1 else 0 end
  where hwid = p_hwid;

  insert into public.og_usage_events (hwid, event_type, media_type, success, elapsed_ms, meta)
  values (
    p_hwid,
    v_event,
    case when p_media in ('video', 'audio', 'file') then p_media else 'file' end,
    p_success,
    greatest(p_elapsed_ms, 0),
    v_meta
  );
end;
$$;

grant execute on function public.og_bump_download(text, text, boolean, int, bigint, text, text, jsonb)
  to anon, authenticated;

create or replace function public.og_admin_device_metrics(online_minutes int default 10)
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
    'total', (select count(*)::int from public.og_devices),
    'active', (select count(*)::int from public.og_devices where status = 'active' and last_ping >= cutoff),
    'choked', (select count(*)::int from public.og_devices where status = 'choked'),
    'offline', (select count(*)::int from public.og_devices where status = 'offline' or last_ping < cutoff),
    'images', (select coalesce(sum(image_count), 0)::bigint from public.og_devices),
    'videos', (select coalesce(sum(video_count), 0)::bigint from public.og_devices)
  ) into result;
  return result;
end;
$$;

grant execute on function public.og_admin_device_metrics(int) to anon, authenticated;

create or replace function public.og_admin_country_rollup()
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
    from public.og_devices
    group by 1, 2
    order by images + videos desc
  ) t;
  return result;
end;
$$;

grant execute on function public.og_admin_country_rollup() to anon, authenticated;

create or replace function public.og_platform_rollup()
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
      coalesce(nullif(meta->>'platform', ''), 'unknown') as platform,
      count(*) filter (where event_type = 'download' and success is true)::int as downloads,
      count(*) filter (where event_type = 'fail')::int as fails
    from public.og_usage_events
    where event_type in ('download', 'fail')
    group by 1
    order by downloads desc
  ) t;
  return result;
end;
$$;

grant execute on function public.og_platform_rollup() to anon, authenticated;
