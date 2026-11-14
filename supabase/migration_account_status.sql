-- =====================================================================
-- Run this ONCE in Supabase -> SQL Editor (safe to run more than once).
-- Adds the account Status choice: Evaluation / Funded / Breached.
-- New projects do not need it (schema.sql already includes it).
-- =====================================================================
alter table public.accounts
  add column if not exists status text not null default 'evaluation';

alter table public.accounts drop constraint if exists accounts_status_check;
alter table public.accounts
  add constraint accounts_status_check check (status in ('evaluation', 'funded', 'breached'));

notify pgrst, 'reload schema';
