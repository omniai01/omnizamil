-- Maintenance timer columns for Omni Removal + OmniGrab.
-- Safe to re-run in Supabase SQL Editor.

alter table public.app_settings
  add column if not exists maintenance_duration_minutes integer not null default 0,
  add column if not exists maintenance_started_at timestamptz null;

alter table public.og_app_settings
  add column if not exists maintenance_duration_minutes integer not null default 0,
  add column if not exists maintenance_started_at timestamptz null;
