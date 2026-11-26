create table if not exists public.mastreani_crm_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"clients":[],"cards":[],"columns":["Agendar","Concluído"]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.mastreani_crm_state enable row level security;

-- Recriar políticas torna a migração segura de reaplicar.
drop policy if exists "Owner can read own CRM" on public.mastreani_crm_state;
drop policy if exists "Owner can create own CRM" on public.mastreani_crm_state;
drop policy if exists "Owner can update own CRM" on public.mastreani_crm_state;
create policy "Owner can read own CRM" on public.mastreani_crm_state
  for select to authenticated using (auth.uid() = owner_id);
create policy "Owner can create own CRM" on public.mastreani_crm_state
  for insert to authenticated with check (auth.uid() = owner_id);
create policy "Owner can update own CRM" on public.mastreani_crm_state
  for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

grant select, insert, update on public.mastreani_crm_state to authenticated;
