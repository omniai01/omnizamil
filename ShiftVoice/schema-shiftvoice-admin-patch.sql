-- ShiftVoice admin telemetry patch — run once in Supabase SQL Editor.
-- Safe to re-run.

alter table public.sv_app_settings
  add column if not exists maintenance_duration_minutes integer not null default 0,
  add column if not exists maintenance_started_at timestamptz null;

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
