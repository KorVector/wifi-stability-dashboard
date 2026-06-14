create table if not exists public.wifi_measurements (
  id text primary key,
  measured_at timestamptz not null,
  dorm text not null,
  location text not null,
  region_reference text,
  time_band_reference text,
  active_users integer,
  rain_mm numeric,
  latency_ms numeric,
  jitter_ms numeric,
  failure_pct numeric,
  download_mbps numeric,
  downloaded_bytes integer,
  risk_score integer,
  note text,
  created_at timestamptz default now()
);

alter table public.wifi_measurements enable row level security;

drop policy if exists "allow_public_insert_for_school_project" on public.wifi_measurements;
drop policy if exists "allow_public_select_for_school_project" on public.wifi_measurements;

create policy "allow_public_insert_for_school_project"
on public.wifi_measurements
for insert
to anon
with check (true);

create policy "allow_public_select_for_school_project"
on public.wifi_measurements
for select
to anon
using (true);
