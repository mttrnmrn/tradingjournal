-- =====================================================================
-- Run this ONCE in Supabase -> SQL Editor if you already ran schema.sql
-- before the "accounts" update. Safe to run more than once.
-- New projects do not need it (schema.sql already includes everything).
-- =====================================================================

-- 1. Accounts table
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  starting_balance numeric(14,2) not null default 0 check (starting_balance >= 0),
  max_loss_limit numeric(14,2) check (max_loss_limit is null or max_loss_limit > 0),
  max_loss_type text not null default 'static' check (max_loss_type in ('static', 'trailing')),
  daily_loss_limit numeric(14,2) check (daily_loss_limit is null or daily_loss_limit > 0),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- 2. Link trades to an account (deleting an account keeps its trades, unassigned)
alter table public.trades
  add column if not exists account_id uuid references public.accounts(id) on delete set null;
create index if not exists trades_user_account_idx on public.trades (user_id, account_id);

-- 3. Row Level Security
alter table public.accounts enable row level security;

drop policy if exists "accounts_owner_all" on public.accounts;
create policy "accounts_owner_all" on public.accounts
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "trades_owner_all" on public.trades;
create policy "trades_owner_all" on public.trades
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (account_id is null or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()))
  );

-- 4. Existing trades: create "Main Account" (using your Settings starting balance)
--    and move all of your current trades into it.
insert into public.accounts (user_id, name, starting_balance)
select t.user_id, 'Main Account', coalesce(s.starting_balance, 0)
from (select distinct user_id from public.trades where account_id is null) t
left join public.settings s on s.user_id = t.user_id
where not exists (select 1 from public.accounts a where a.user_id = t.user_id);

update public.trades tr
set account_id = a.id
from public.accounts a
where a.user_id = tr.user_id
  and tr.account_id is null
  and (select count(*) from public.accounts x where x.user_id = tr.user_id) = 1;
