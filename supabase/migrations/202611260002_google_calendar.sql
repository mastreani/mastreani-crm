-- Private Google OAuth tokens and event mapping. Only the Edge Function service role may access these tables.
create table if not exists public.mastreani_google_tokens (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table public.mastreani_google_tokens enable row level security;
revoke all on public.mastreani_google_tokens from anon, authenticated;
grant all on public.mastreani_google_tokens to service_role;

create table if not exists public.mastreani_google_events (
  owner_id uuid not null references auth.users(id) on delete cascade,
  history_id text not null,
  event_id text not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, history_id),
  unique (owner_id, event_id)
);
alter table public.mastreani_google_events enable row level security;
revoke all on public.mastreani_google_events from anon, authenticated;
grant all on public.mastreani_google_events to service_role;
