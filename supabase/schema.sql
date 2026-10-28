-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query).
create table if not exists public.trips (
  id          uuid primary key,
  share_id    text not null unique,
  title       text not null,
  preferences jsonb not null,
  itinerary   jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists trips_updated_at_idx on public.trips (updated_at desc);

-- The FastAPI backend uses the service-role key, which bypasses RLS.
-- Enabling RLS with no policies blocks direct access with the public anon key.
alter table public.trips enable row level security;

-- Only the backend (service role) may use the table through the Data API.
-- Needed when "Automatically expose new tables" is turned off for the project.
grant select, insert, update, delete on public.trips to service_role;
revoke all on public.trips from anon, authenticated;
