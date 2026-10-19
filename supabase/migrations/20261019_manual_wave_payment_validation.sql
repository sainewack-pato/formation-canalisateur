-- Demandes de validation manuelle des paiements Wave — Formation Canalisateur
begin;
create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  amount_xof integer not null default 20000 check (amount_xof = 20000),
  payment_method text not null default 'Wave' check (payment_method = 'Wave'),
  transaction_reference text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  admin_note text
);
create index if not exists payment_requests_status_submitted_idx
  on public.payment_requests(status, submitted_at desc);
alter table public.payment_requests enable row level security;
drop policy if exists "Learners submit own payment request" on public.payment_requests;
create policy "Learners submit own payment request"
  on public.payment_requests for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending' and reviewed_at is null and reviewed_by is null);
drop policy if exists "Learners read own payment requests" on public.payment_requests;
create policy "Learners read own payment requests"
  on public.payment_requests for select to authenticated
  using (auth.uid() = user_id);
commit;
