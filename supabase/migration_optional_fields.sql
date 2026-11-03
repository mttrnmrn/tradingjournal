-- =====================================================================
-- Run this ONCE in Supabase -> SQL Editor if you already ran schema.sql
-- before this update. It makes entry/exit time and entry/exit price
-- optional so trades can be saved without them.
-- Safe to run more than once.
-- =====================================================================
alter table public.trades alter column entry_time drop not null;
alter table public.trades alter column exit_time drop not null;
alter table public.trades alter column entry_price drop not null;
alter table public.trades alter column exit_price drop not null;
