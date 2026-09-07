-- OmniGrab: boolean only — never store Google email/password/cookies.
-- Safe to re-run.

alter table public.og_devices
  add column if not exists youtube_linked boolean not null default false;

alter table public.og_devices
  add column if not exists youtube_linked_at timestamptz;

comment on column public.og_devices.youtube_linked is
  'True if ShiftGrab reports a local YouTube session on the device. No credentials stored.';

create index if not exists og_devices_youtube_linked_idx
  on public.og_devices (youtube_linked);
