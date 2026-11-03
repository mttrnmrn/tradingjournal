-- =====================================================================
-- Personal Trading Journal - Supabase schema
-- Run this whole file in: Supabase Dashboard -> SQL Editor -> New query
-- Safe to re-run (idempotent where possible).
-- =====================================================================

-- ---------- ENUMS ----------
do $$ begin
  create type instrument_t as enum ('NQ', 'MNQ', 'NAS100');
exception when duplicate_object then null; end $$;
do $$ begin
  create type direction_t as enum ('Long', 'Short');
exception when duplicate_object then null; end $$;
do $$ begin
  create type session_t as enum ('Asian', 'London', 'New York');
exception when duplicate_object then null; end $$;
do $$ begin
  create type status_t as enum ('Win', 'Loss', 'Breakeven');
exception when duplicate_object then null; end $$;
do $$ begin
  create type bias_t as enum ('Bullish', 'Bearish', 'Neutral');
exception when duplicate_object then null; end $$;
do $$ begin
  create type shot_kind_t as enum ('before', 'after');
exception when duplicate_object then null; end $$;

-- ---------- SETTINGS (one row per user) ----------
create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  starting_balance numeric(14,2) not null default 0,
  currency text not null default 'USD',
  nas100_point_value numeric(12,4) not null default 1,   -- $ per point per 1.0 lot (broker specific)
  default_commission numeric(12,2) not null default 0,   -- $ per trade
  timezone text not null default 'Asia/Manila',
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  updated_at timestamptz not null default now()
);

-- ---------- TAGS (fixed ICT / price action list, shared, read-only) ----------
create table if not exists public.tags (
  id serial primary key,
  name text not null unique,
  sort_order int not null default 0
);

insert into public.tags (name, sort_order) values
  ('Fair Value Gap (FVG)', 1),
  ('Order Block (OB)', 2),
  ('Breaker Block', 3),
  ('Liquidity Sweep', 4),
  ('Buy-Side Liquidity (BSL)', 5),
  ('Sell-Side Liquidity (SSL)', 6),
  ('SMT Divergence', 7),
  ('Market Structure Shift (MSS)', 8),
  ('Break of Structure (BOS)', 9),
  ('Change of Character (CHoCH)', 10),
  ('Previous Day High (PDH)', 11),
  ('Previous Day Low (PDL)', 12),
  ('Asian High / Low', 13),
  ('London High / Low', 14),
  ('New York Open', 15),
  ('Support / Resistance', 16),
  ('Other', 17)
on conflict (name) do nothing;

-- ---------- ACCOUNTS (trading / prop accounts with risk limits) ----------
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

-- ---------- TRADES ----------
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,

  -- trade information (times are wall-clock in the trading time zone)
  trade_date date not null,
  entry_time time,   -- optional
  exit_time time,    -- optional
  instrument instrument_t not null,
  direction direction_t not null,
  session session_t not null,
  status status_t not null,

  -- execution
  entry_price numeric(14,4) check (entry_price is null or entry_price > 0),  -- optional
  exit_price numeric(14,4) check (exit_price is null or exit_price > 0),     -- optional
  stop_loss numeric(14,4) check (stop_loss is null or stop_loss > 0),
  take_profit numeric(14,4) check (take_profit is null or take_profit > 0),
  quantity numeric(12,4) not null check (quantity > 0),     -- contracts (NQ/MNQ) or lots (NAS100)
  risk_amount numeric(14,2) check (risk_amount is null or risk_amount >= 0),
  commission numeric(12,2) not null default 0 check (commission >= 0),
  other_fees numeric(12,2) not null default 0 check (other_fees >= 0),
  point_value numeric(12,4) not null check (point_value > 0), -- $/point per contract/lot used for this trade

  -- computed values (stored so history never changes if settings change)
  gross_pnl numeric(14,2) not null,
  net_pnl numeric(14,2) not null,
  r_multiple numeric(10,3),
  risk_reward numeric(10,3),
  holding_minutes integer not null default 0,
  -- true when the user manually overrode computed values
  pnl_overridden boolean not null default false,
  r_overridden boolean not null default false,
  status_overridden boolean not null default false,

  -- analysis
  setup text,
  market_bias bias_t,
  entry_reason text,
  exit_reason text,
  mistakes text,
  lessons text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trades_user_date_idx on public.trades (user_id, trade_date desc);
create index if not exists trades_user_instrument_idx on public.trades (user_id, instrument);
create index if not exists trades_user_account_idx on public.trades (user_id, account_id);

-- ---------- TRADE <-> TAG (many to many) ----------
create table if not exists public.trade_tags (
  trade_id uuid not null references public.trades(id) on delete cascade,
  tag_id int not null references public.tags(id) on delete cascade,
  primary key (trade_id, tag_id)
);
create index if not exists trade_tags_tag_idx on public.trade_tags (tag_id);

-- ---------- SCREENSHOTS (one "before" and one "after" per trade) ----------
create table if not exists public.trade_screenshots (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind shot_kind_t not null,
  storage_path text not null,
  file_name text,
  created_at timestamptz not null default now(),
  unique (trade_id, kind)
);

-- ---------- updated_at trigger ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trades_touch on public.trades;
create trigger trades_touch before update on public.trades
  for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.settings enable row level security;
alter table public.accounts enable row level security;
alter table public.tags enable row level security;
alter table public.trades enable row level security;
alter table public.trade_tags enable row level security;
alter table public.trade_screenshots enable row level security;

-- settings
drop policy if exists "settings_owner_all" on public.settings;
create policy "settings_owner_all" on public.settings
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- tags: read-only for signed-in users
drop policy if exists "tags_read" on public.tags;
create policy "tags_read" on public.tags
  for select to authenticated using (true);

-- accounts
drop policy if exists "accounts_owner_all" on public.accounts;
create policy "accounts_owner_all" on public.accounts
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- trades (an account link must point at one of your own accounts)
drop policy if exists "trades_owner_all" on public.trades;
create policy "trades_owner_all" on public.trades
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (account_id is null or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()))
  );

-- trade_tags: allowed only if the parent trade belongs to the user
drop policy if exists "trade_tags_owner_all" on public.trade_tags;
create policy "trade_tags_owner_all" on public.trade_tags
  for all to authenticated
  using (exists (select 1 from public.trades t where t.id = trade_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.trades t where t.id = trade_id and t.user_id = auth.uid()));

-- screenshots
drop policy if exists "shots_owner_all" on public.trade_screenshots;
create policy "shots_owner_all" on public.trade_screenshots
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.trades t where t.id = trade_id and t.user_id = auth.uid())
  );

-- =====================================================================
-- STORAGE: private bucket, files stored under "<user_id>/<trade_id>/<kind>-<ts>.<ext>"
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trade-screenshots', 'trade-screenshots', false, 10485760,
        array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/png', 'image/jpeg'];

drop policy if exists "shots_storage_select" on storage.objects;
create policy "shots_storage_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "shots_storage_insert" on storage.objects;
create policy "shots_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "shots_storage_update" on storage.objects;
create policy "shots_storage_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "shots_storage_delete" on storage.objects;
create policy "shots_storage_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
