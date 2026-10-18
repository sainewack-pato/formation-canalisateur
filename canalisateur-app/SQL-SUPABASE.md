# Configuration Supabase – Formation Canalisateur GIE I2DS

## Étape 1 — SQL Editor

Copiez-collez **tout** ce bloc dans **SQL Editor** → Run :

```sql
-- Table progressions
create table if not exists public.progressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  email text,
  user_name text,
  completed_modules text[] default '{}',
  best_score int default 0,
  is_admin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists progressions_user_id_idx on public.progressions(user_id);
create index if not exists progressions_email_idx on public.progressions(email);

alter table public.progressions enable row level security;

-- Fonction pour tester admin sans récursion RLS
create or replace function public.is_current_user_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.progressions where user_id = auth.uid() limit 1),
    false
  );
$$;

-- Policies
drop policy if exists "select_own_or_admin" on public.progressions;
create policy "select_own_or_admin"
  on public.progressions for select
  using (auth.uid() = user_id or public.is_current_user_admin());

drop policy if exists "insert_own" on public.progressions;
create policy "insert_own"
  on public.progressions for insert
  with check (auth.uid() = user_id);

drop policy if exists "update_own_or_admin" on public.progressions;
create policy "update_own_or_admin"
  on public.progressions for update
  using (auth.uid() = user_id or public.is_current_user_admin());
```

## Étape 2 — Authentication

1. **Authentication** → **Providers** → Email activé  
2. **Authentication** → **Settings** → pour les tests, désactivez **Confirm email**

## Étape 3 — Devenir administrateur

1. Créez un compte dans l’application (`index.html`)
2. Dans SQL Editor :

```sql
update public.progressions
set is_admin = true
where email = 'VOTRE_EMAIL_ICI';
```

3. Ouvrez `admin.html` et connectez-vous avec ce compte

## URLs après déploiement Netlify

- App : `https://votre-site.netlify.app/`
- Admin : `https://votre-site.netlify.app/admin.html`
