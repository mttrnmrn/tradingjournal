import { round2, type FieldErrors } from "@/lib/calc";
import { dailyPnlMap, sortChrono } from "@/lib/analytics";
import { UNASSIGNED, type Account, type MaxLossType, type Trade } from "@/types";

/**
 * Account limit conventions (documented in README):
 *  - Balance = starting balance + net P&L of the account's trades.
 *  - Max loss, STATIC: breached when balance <= starting balance - limit.
 *  - Max loss, TRAILING: floor follows the highest balance reached, so it is breached when
 *    balance <= peak balance - limit. (No "stops trailing at the starting balance" rule.)
 *  - Daily loss: breached when a day's net P&L (by trade date, in your trading time zone) <= -limit.
 *  - Limits are measured over ALL trades of the account, ignoring the dashboard date filter.
 */

export interface AccountStatus {
  account: Account;
  trades: number;
  netPnl: number;
  balance: number;
  peak: number;
  // max loss
  maxLossUsed: number; // $ below the reference (start or peak), never negative
  maxLossFloor: number | null; // balance at which the limit is hit
  maxLossRemaining: number | null; // balance - floor (<= 0 once breached)
  maxLossPct: number | null; // 0..100
  maxLossBreached: boolean;
  maxLossBreachedOn: string | null;
  // daily loss (for `today`)
  todayPnl: number;
  dailyUsed: number;
  dailyRemaining: number | null;
  dailyPct: number | null; // 0..100
  dailyBreachedToday: boolean;
  dailyBreachDays: number; // historical days that hit the limit
}

export function accountStatus(account: Account, trades: Trade[], today: string): AccountStatus {
  const ordered = sortChrono(trades);
  const trailing = account.max_loss_type === "trailing";
  const limit = account.max_loss_limit;

  let equity = account.starting_balance;
  let peak = equity;
  let breachedOn: string | null = null;
  for (const t of ordered) {
    equity = round2(equity + t.net_pnl);
    if (equity > peak) peak = equity;
    if (limit != null && breachedOn == null) {
      const ref = trailing ? peak : account.starting_balance;
      if (round2(ref - equity) >= limit) breachedOn = t.trade_date;
    }
  }

  const ref = trailing ? peak : account.starting_balance;
  const maxLossUsed = Math.max(0, round2(ref - equity));
  const floor = limit != null ? round2(ref - limit) : null;

  const days = dailyPnlMap(ordered);
  const todayPnl = days.get(today)?.pnl ?? 0;
  const dailyUsed = Math.max(0, round2(-todayPnl));
  const dl = account.daily_loss_limit;
  let breachDays = 0;
  if (dl != null) for (const v of days.values()) if (v.pnl <= -dl) breachDays++;

  const pct = (used: number, lim: number | null) => (lim ? round2(Math.min(100, (used / lim) * 100)) : null);

  return {
    account,
    trades: ordered.length,
    netPnl: round2(equity - account.starting_balance),
    balance: equity,
    peak,
    maxLossUsed,
    maxLossFloor: floor,
    maxLossRemaining: floor != null ? round2(equity - floor) : null,
    maxLossPct: pct(maxLossUsed, limit),
    maxLossBreached: breachedOn != null,
    maxLossBreachedOn: breachedOn,
    todayPnl,
    dailyUsed,
    dailyRemaining: dl != null ? round2(dl - dailyUsed) : null,
    dailyPct: pct(dailyUsed, dl),
    dailyBreachedToday: dl != null && todayPnl <= -dl,
    dailyBreachDays: breachDays,
  };
}

// ---------------------------------------------------------------- scoping

/** `selected` holds account ids (and UNASSIGNED). Empty means "all accounts". */
export function scopeTrades(trades: Trade[], selected: string[]): Trade[] {
  if (selected.length === 0) return trades;
  return trades.filter((t) => selected.includes(t.account_id ?? UNASSIGNED));
}

export function scopeAccounts(accounts: Account[], selected: string[]): Account[] {
  return selected.length === 0 ? accounts : accounts.filter((a) => selected.includes(a.id));
}

/**
 * Starting balance for the selected scope = sum of the selected accounts' starting balances.
 * The default starting balance from Settings is added for trades that have no account
 * (or when no accounts exist at all).
 */
export function scopedStartingBalance(accounts: Account[], trades: Trade[], selected: string[], defaultBalance: number): number {
  let sum = scopeAccounts(accounts, selected).reduce((s, a) => s + a.starting_balance, 0);
  const unassignedInScope = selected.length === 0 || selected.includes(UNASSIGNED);
  if (unassignedInScope && (accounts.length === 0 || trades.some((t) => !t.account_id))) sum += defaultBalance;
  return round2(sum);
}

// ---------------------------------------------------------------- validation

export interface AccountInput {
  name: string;
  starting_balance: number;
  max_loss_limit: number | null;
  max_loss_type: MaxLossType;
  daily_loss_limit: number | null;
}

export function validateAccount(a: AccountInput, otherNames: string[]): FieldErrors {
  const e: FieldErrors = {};
  const name = a.name.trim();
  if (!name) e.name = "Give the account a name";
  else if (name.length > 60) e.name = "Keep the name under 60 characters";
  else if (otherNames.some((n) => n.trim().toLowerCase() === name.toLowerCase())) e.name = "You already have an account with that name";

  if (!Number.isFinite(a.starting_balance) || a.starting_balance < 0) e.starting_balance = "Enter a starting balance of 0 or more";
  if (a.max_loss_limit != null && (!Number.isFinite(a.max_loss_limit) || a.max_loss_limit <= 0)) e.max_loss_limit = "Must be greater than 0 (or leave blank)";
  if (a.daily_loss_limit != null && (!Number.isFinite(a.daily_loss_limit) || a.daily_loss_limit <= 0)) e.daily_loss_limit = "Must be greater than 0 (or leave blank)";
  return e;
}
