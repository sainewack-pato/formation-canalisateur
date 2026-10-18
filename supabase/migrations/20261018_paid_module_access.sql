-- GIE I2DS — accès aux modules payants
-- À examiner puis exécuter manuellement dans le SQL Editor du projet Supabase.
-- Cette migration n'est PAS exécutée automatiquement par GitHub.
begin;

create table if not exists public.module_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by text not null default 'migration_initiale',
  note text
);

create table if not exists public.paid_module_content (
  module_id text primary key check (module_id in ('m02','m03','m04','m05','m06','m07','m08')),
  content jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.module_access enable row level security;
alter table public.paid_module_content enable row level security;

-- Les clients ordinaires ne peuvent ni lire les contenus payants ni modifier les autorisations.
drop policy if exists "Users read own module access" on public.module_access;
create policy "Users read own module access"
  on public.module_access for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "No direct paid content access" on public.paid_module_content;
create policy "No direct paid content access"
  on public.paid_module_content for select to authenticated
  using (false);

-- Pas de politique INSERT/UPDATE/DELETE pour les utilisateurs : seules les opérations
-- administratives serveur (service_role) ou SQL Editor pourront gérer ces tables.

-- Préserver l'accès complet des trois comptes déjà autorisés.
insert into public.module_access (user_id, granted_by, note)
values
  ('17a6bd12-5019-4b0f-8d96-caa2b02c8d37', 'migration_initiale', 'Compte existant à préserver'),
  ('3f73090d-921d-4e55-8462-9d4005046b77', 'migration_initiale', 'Profil existant à préserver'),
  ('17a6bd12-5019-4b0f-8d96-caa2b02c8d37', 'migration_initiale', 'Profil existant à préserver'),
  ('e3535c93-e5f5-4303-a57e-fda0ae6beeeb', 'migration_initiale', 'Profil existant à préserver')
on conflict (user_id) do nothing;

commit;
