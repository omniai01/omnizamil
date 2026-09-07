-- Run once in Supabase SQL Editor (safe to re-run)

alter table public.devices
  add column if not exists country text not null default '',
  add column if not exists country_code text not null default '';

alter table public.app_settings
  add column if not exists update_message text not null default 'A new Omni-Removal update is available. Download and install it to continue.',
  add column if not exists social_links jsonb not null default '{
    "youtube": "https://youtube.com",
    "twitter": "https://x.com",
    "facebook": "https://facebook.com",
    "instagram": "https://instagram.com",
    "whatsapp": "https://whatsapp.com/channel",
    "discord": "https://discord.com"
  }'::jsonb,
  add column if not exists image_target bigint not null default 1000000,
  add column if not exists video_target bigint not null default 1000000;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  target_hwid text null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_created_idx on public.notifications (created_at desc);
create index if not exists notifications_target_idx on public.notifications (target_hwid);

alter table public.notifications enable row level security;

drop policy if exists notifications_anon_select on public.notifications;
create policy notifications_anon_select on public.notifications
  for select to anon, authenticated
  using (true);

drop policy if exists notifications_anon_insert on public.notifications;
-- inserts only via service role from admin (no anon insert policy)

create index if not exists devices_country_idx on public.devices (country_code);

alter table public.app_settings
  add column if not exists site_views bigint not null default 0,
  add column if not exists download_clicks bigint not null default 0,
  add column if not exists update_clicks bigint not null default 0;

alter table public.devices
  add column if not exists bytes_processed bigint not null default 0;

create or replace function public.bump_analytics(kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if kind = 'view' then
    update public.app_settings set site_views = coalesce(site_views, 0) + 1 where id = 1;
  elsif kind = 'download' then
    update public.app_settings set download_clicks = coalesce(download_clicks, 0) + 1 where id = 1;
  elsif kind = 'update_click' then
    update public.app_settings set update_clicks = coalesce(update_clicks, 0) + 1 where id = 1;
  end if;
end;
$$;

grant execute on function public.bump_analytics(text) to anon, authenticated;

-- Admin Errors tab: allow authenticated/service reads+updates (service_role bypasses RLS anyway)
drop policy if exists errors_anon_select on public.error_logs;
create policy errors_anon_select on public.error_logs
  for select to anon, authenticated
  using (true);

drop policy if exists errors_anon_update on public.error_logs;
create policy errors_anon_update on public.error_logs
  for update to anon, authenticated
  using (true)
  with check (true);

-- remove smoke test devices
delete from public.devices where display_name ilike '%smoke%' or user_alias ilike '%smoke%';

-- ============================================================
-- 100k scale pack (safe to re-run)
-- ============================================================

create index if not exists devices_status_last_ping_idx
  on public.devices (status, last_ping desc);

create index if not exists devices_active_ping_idx
  on public.devices (last_ping desc)
  where status = 'active';

create index if not exists notifications_broadcast_idx
  on public.notifications (created_at desc)
  where target_hwid is null;

create index if not exists notifications_target_created_idx
  on public.notifications (target_hwid, created_at desc);

create index if not exists usage_events_job_idx
  on public.usage_events (event_type, created_at desc)
  where event_type in ('image_clean', 'video_clean', 'fail', 'register');

-- Atomic clean counter (avoids race at high concurrency)
create or replace function public.bump_device_clean(
  p_hwid text,
  p_media text,
  p_success boolean,
  p_elapsed_ms int,
  p_bytes bigint default 0,
  p_display_name text default null,
  p_event_type text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text;
begin
  v_event := coalesce(
    nullif(p_event_type, ''),
    case
      when not p_success then 'fail'
      when p_media = 'video' then 'video_clean'
      else 'image_clean'
    end
  );

  update public.devices set
    last_ping = now(),
    status = 'active',
    display_name = coalesce(nullif(p_display_name, ''), display_name),
    user_alias = coalesce(nullif(p_display_name, ''), user_alias),
    total_process_ms = total_process_ms + greatest(p_elapsed_ms, 0),
    bytes_processed = coalesce(bytes_processed, 0) + greatest(p_bytes, 0),
    image_count = image_count + case when p_success and p_media = 'image' then 1 else 0 end,
    video_count = video_count + case when p_success and p_media = 'video' then 1 else 0 end,
    fail_count = fail_count + case when not p_success then 1 else 0 end
  where hwid = p_hwid;

  insert into public.usage_events (hwid, event_type, media_type, success, elapsed_ms, meta)
  values (
    p_hwid,
    v_event,
    case when p_media in ('image', 'video') then p_media else null end,
    p_success,
    greatest(p_elapsed_ms, 0),
    jsonb_build_object('bytes', greatest(p_bytes, 0))
  );
end;
$$;

grant execute on function public.bump_device_clean(text, text, boolean, int, bigint, text, text)
  to anon, authenticated;

-- Admin overview metrics without shipping 100k rows to the browser
create or replace function public.admin_device_metrics(online_minutes int default 10)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total', count(*),
    'active', count(*) filter (
      where last_ping > now() - make_interval(mins => greatest(online_minutes, 1))
        and status = 'active'
    ),
    'choked', count(*) filter (where status = 'choked'),
    'offline', count(*) filter (
      where last_ping <= now() - make_interval(mins => greatest(online_minutes, 1))
         or status in ('offline', 'banned')
    ),
    'images', coalesce(sum(image_count), 0),
    'videos', coalesce(sum(video_count), 0),
    'fails', coalesce(sum(fail_count), 0)
  )
  from public.devices;
$$;

grant execute on function public.admin_device_metrics(int) to anon, authenticated, service_role;

create or replace function public.admin_country_rollup()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  from (
    select
      coalesce(nullif(country, ''), 'Unknown') as country,
      coalesce(country_code, '') as country_code,
      count(*)::int as devices,
      coalesce(sum(image_count), 0)::bigint as images,
      coalesce(sum(video_count), 0)::bigint as videos
    from public.devices
    group by 1, 2
    order by (coalesce(sum(image_count), 0) + coalesce(sum(video_count), 0)) desc
    limit 100
  ) t;
$$;

grant execute on function public.admin_country_rollup() to anon, authenticated, service_role;

-- ShiftZero branding (admin-managed)
alter table public.app_settings
  add column if not exists brand_name text not null default 'ShiftZero',
  add column if not exists brand_tagline text not null default 'Zero cost. Always free.',
  add column if not exists brand_about text not null default 'Small tools. Zero cost. Zero telemetry. 100% on-device local AI.',
  add column if not exists brand_website_url text not null default 'https://shiftzero.dev',
  add column if not exists brand_logo_url text not null default '';

-- Prune chatty heartbeat noise + keep hot table lean (run manually or via cron)
delete from public.usage_events where event_type = 'heartbeat';
delete from public.usage_events where created_at < now() - interval '30 days';
