-- OmniGrab RPCs only (tables already exist). Safe to re-run in SQL Editor.

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

NOTIFY pgrst, 'reload schema';
