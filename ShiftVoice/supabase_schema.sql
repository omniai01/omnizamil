-- Run in Supabase SQL editor once.

create table if not exists shiftvoice_usage (
  id text primary key,
  kind text,
  chars integer default 0,
  exports integer default 0,
  job_id text,
  title text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists shiftvoice_batches (
  id text primary key,
  mode text,
  item_count integer default 0,
  chars integer default 0,
  job_ids jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists shiftvoice_jobs (
  id text primary key,
  kind text,
  status text,
  title text,
  chars integer default 0,
  path text,
  created_at timestamptz,
  updated_at timestamptz default now()
);

alter table shiftvoice_usage enable row level security;
alter table shiftvoice_batches enable row level security;
alter table shiftvoice_jobs enable row level security;

drop policy if exists "anon insert usage" on shiftvoice_usage;
drop policy if exists "anon insert batches" on shiftvoice_batches;
drop policy if exists "anon insert jobs" on shiftvoice_jobs;

create policy "anon insert usage" on shiftvoice_usage for insert to anon with check (true);
create policy "anon insert batches" on shiftvoice_batches for insert to anon with check (true);
create policy "anon insert jobs" on shiftvoice_jobs for insert to anon with check (true);
