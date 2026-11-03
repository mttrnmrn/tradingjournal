import { endOfMonth, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { INSTRUMENTS, SESSIONS } from "@/types";
import type { Instrument, Session, Tag, Trade } from "@/types";

/**
 * Conventions (documented in README):
 *  - Win / Loss / Breakeven counts use the trade's Result (status) field, which respects manual overrides.
 *  - Gross Profit = sum of net P&L of trades with net > 0; Gross Loss = sum of net P&L of trades with net < 0.
 *    So Gross Profit + Gross Loss = Total Net P&L, and Profit Factor = Gross Profit / |Gross Loss|.
 *  - Win rate = wins / total trades.
 *  - Expectancy = net P&L per trade ($). R-expectancy = average R across trades that have an R value.
 */

export interface Stats {
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  netPnl: number;
  grossProfit: number;
  grossLoss: number; // negative number
  winRate: number; // 0..100
  profitFactor: number | null; // null when undefined (no losses and no profit)
  profitFactorInfinite: boolean;
  avgWin: number;
  avgLoss: number; // negative number
  avgR: number | null;
  avgRR: number | null;
  expectancy: number;
  expectancyR: number | null;
  largestWin: number;
  largestLoss: number;
  maxWinStreak: number;
  maxLossStreak: number;
  avgHoldingMinutes: number;
  maxDrawdown: number; // positive $ amount
  maxDrawdownPct: number | null; // % of peak equity (needs starting balance), else null
  bestDay: { date: string; pnl: number } | null;
  worstDay: { date: string; pnl: number } | null;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
}

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const avg = (a: number[]) => (a.length ? sum(a) / a.length : 0);

export function sortChrono(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) =>
    a.trade_date !== b.trade_date
      ? a.trade_date < b.trade_date ? -1 : 1
      : (a.entry_time ?? "") !== (b.entry_time ?? "")
        ? (a.entry_time ?? "") < (b.entry_time ?? "") ? -1 : 1
        : a.created_at < b.created_at ? -1 : 1,
  );
}

export function dailyPnlMap(trades: Trade[]): Map<string, { pnl: number; count: number }> {
  const m = new Map<string, { pnl: number; count: number }>();
  for (const t of trades) {
    const cur = m.get(t.trade_date) ?? { pnl: 0, count: 0 };
    cur.pnl += t.net_pnl;
    cur.count += 1;
    m.set(t.trade_date, cur);
  }
  for (const v of m.values()) v.pnl = Math.round(v.pnl * 100) / 100;
  return m;
}

export function computeStats(trades: Trade[], startingBalance = 0): Stats {
  const ordered = sortChrono(trades);
  const wins = ordered.filter((t) => t.status === "Win");
  const losses = ordered.filter((t) => t.status === "Loss");
  const bes = ordered.filter((t) => t.status === "Breakeven");

  const grossProfit = sum(ordered.filter((t) => t.net_pnl > 0).map((t) => t.net_pnl));
  const grossLoss = sum(ordered.filter((t) => t.net_pnl < 0).map((t) => t.net_pnl));
  const netPnl = sum(ordered.map((t) => t.net_pnl));

  let profitFactor: number | null = null;
  let pfInf = false;
  if (grossLoss < 0) profitFactor = grossProfit / Math.abs(grossLoss);
  else if (grossProfit > 0) pfInf = true;

  const rs = ordered.map((t) => t.r_multiple).filter((x): x is number => x != null);
  const rrs = ordered.map((t) => t.risk_reward).filter((x): x is number => x != null);

  // streaks (breakeven resets neither: it is skipped? -> it breaks a streak, which is the stricter/common definition)
  let maxW = 0, maxL = 0, curW = 0, curL = 0;
  for (const t of ordered) {
    if (t.status === "Win") { curW++; curL = 0; }
    else if (t.status === "Loss") { curL++; curW = 0; }
    else { curW = 0; curL = 0; }
    maxW = Math.max(maxW, curW);
    maxL = Math.max(maxL, curL);
  }

  // drawdown on the equity curve (trade by trade), starting from starting balance
  let equity = startingBalance;
  let peak = startingBalance;
  let maxDD = 0;
  let maxDDPct: number | null = null;
  for (const t of ordered) {
    equity += t.net_pnl;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) {
      maxDD = dd;
      maxDDPct = peak > 0 ? (dd / peak) * 100 : null;
    }
  }

  const days = [...dailyPnlMap(ordered).entries()].map(([date, v]) => ({ date, pnl: v.pnl }));
  const bestDay = days.length ? days.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;
  const worstDay = days.length ? days.reduce((a, b) => (b.pnl < a.pnl ? b : a)) : null;

  const bestTrade = ordered.length ? ordered.reduce((a, b) => (b.net_pnl > a.net_pnl ? b : a)) : null;
  const worstTrade = ordered.length ? ordered.reduce((a, b) => (b.net_pnl < a.net_pnl ? b : a)) : null;

  return {
    totalTrades: ordered.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: bes.length,
    netPnl: round2(netPnl),
    grossProfit: round2(grossProfit),
    grossLoss: round2(grossLoss),
    winRate: ordered.length ? (wins.length / ordered.length) * 100 : 0,
    profitFactor,
    profitFactorInfinite: pfInf,
    avgWin: round2(avg(wins.map((t) => t.net_pnl))),
    avgLoss: round2(avg(losses.map((t) => t.net_pnl))),
    avgR: rs.length ? avg(rs) : null,
    avgRR: rrs.length ? avg(rrs) : null,
    expectancy: round2(ordered.length ? netPnl / ordered.length : 0),
    expectancyR: rs.length ? avg(rs) : null,
    largestWin: bestTrade && bestTrade.net_pnl > 0 ? bestTrade.net_pnl : 0,
    largestLoss: worstTrade && worstTrade.net_pnl < 0 ? worstTrade.net_pnl : 0,
    maxWinStreak: maxW,
    maxLossStreak: maxL,
    avgHoldingMinutes: avg(ordered.filter((t) => t.entry_time && t.exit_time).map((t) => t.holding_minutes)),
    maxDrawdown: round2(maxDD),
    maxDrawdownPct: maxDDPct,
    bestDay,
    worstDay,
    bestTrade,
    worstTrade,
  };
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------- series

export type Granularity = "daily" | "weekly" | "monthly";

export interface CumPoint {
  label: string; // axis label
  key: string; // sortable key (date of period start)
  pnl: number; // P&L within the bucket
  cumulative: number;
}

function bucketKey(date: string, g: Granularity): string {
  const d = parseISO(date);
  if (g === "daily") return date;
  if (g === "weekly") return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
  return format(startOfMonth(d), "yyyy-MM-dd");
}

function bucketLabel(key: string, g: Granularity): string {
  const d = parseISO(key);
  if (g === "monthly") return format(d, "MMM yyyy");
  if (g === "weekly") return "Wk " + format(d, "MMM d");
  return format(d, "MMM d");
}

export function cumulativeSeries(trades: Trade[], g: Granularity): CumPoint[] {
  const buckets = new Map<string, number>();
  for (const t of sortChrono(trades)) {
    const k = bucketKey(t.trade_date, g);
    buckets.set(k, (buckets.get(k) ?? 0) + t.net_pnl);
  }
  const keys = [...buckets.keys()].sort();
  let cum = 0;
  return keys.map((k) => {
    const pnl = round2(buckets.get(k) as number);
    cum = round2(cum + pnl);
    return { key: k, label: bucketLabel(k, g), pnl, cumulative: cum };
  });
}

export function dailySeries(trades: Trade[]) {
  const m = dailyPnlMap(trades);
  return [...m.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]) => ({ date, label: format(parseISO(date), "MMM d"), pnl: v.pnl, trades: v.count }));
}

// ---------------------------------------------------------------- groupings

export function byInstrument(trades: Trade[], startingBalance = 0): { instrument: Instrument; stats: Stats }[] {
  return INSTRUMENTS.map((instrument) => ({
    instrument,
    stats: computeStats(trades.filter((t) => t.instrument === instrument), startingBalance),
  }));
}

export function bySession(trades: Trade[]): { session: Session; stats: Stats }[] {
  return SESSIONS.map((session) => ({ session, stats: computeStats(trades.filter((t) => t.session === session)) }));
}

export function byDirection(trades: Trade[]) {
  return {
    Long: computeStats(trades.filter((t) => t.direction === "Long")),
    Short: computeStats(trades.filter((t) => t.direction === "Short")),
  };
}

export interface TagStats {
  tag: Tag;
  trades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  netPnl: number;
  avgPnl: number;
  profitFactor: number | null;
  avgR: number | null;
}

/** A trade with several tags counts once toward every one of its tags. */
export function byTag(trades: Trade[], tags: Tag[]): TagStats[] {
  return tags
    .map((tag) => {
      const ts = trades.filter((t) => t.tag_ids.includes(tag.id));
      const s = computeStats(ts);
      return {
        tag,
        trades: s.totalTrades,
        wins: s.wins,
        losses: s.losses,
        breakevens: s.breakevens,
        winRate: s.winRate,
        netPnl: s.netPnl,
        avgPnl: s.expectancy,
        profitFactor: s.profitFactor,
        avgR: s.avgR,
      };
    })
    .filter((x) => x.trades > 0);
}

// ---------------------------------------------------------------- calendar

export interface CalendarDay {
  date: string; // yyyy-MM-dd
  inMonth: boolean;
  pnl: number | null;
  count: number;
}

export function monthGrid(trades: Trade[], month: Date): CalendarDay[] {
  const map = dailyPnlMap(trades);
  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const gridStart = startOfWeek(first, { weekStartsOn: 0 });
  const days: CalendarDay[] = [];
  const cursor = new Date(gridStart);
  // 6 rows max; stop after the week containing the last day
  while (cursor <= last || cursor.getDay() !== 0) {
    const key = format(cursor, "yyyy-MM-dd");
    const v = map.get(key);
    days.push({ date: key, inMonth: cursor.getMonth() === first.getMonth(), pnl: v ? v.pnl : null, count: v ? v.count : 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

// ---------------------------------------------------------------- day stats

export interface DayStats {
  days: number;
  winDays: number;
  lossDays: number;
  breakevenDays: number;
  winRate: number; // 0..100, share of trading days with positive net P&L
}

export function dayStats(trades: Trade[]): DayStats {
  const days = [...dailyPnlMap(trades).values()];
  const winDays = days.filter((d) => d.pnl > 0).length;
  const lossDays = days.filter((d) => d.pnl < 0).length;
  return {
    days: days.length,
    winDays,
    lossDays,
    breakevenDays: days.length - winDays - lossDays,
    winRate: days.length ? (winDays / days.length) * 100 : 0,
  };
}

/** Weekly (Sun-Sat) totals for a calendar grid produced by monthGrid. */
export function weeklyTotals(days: CalendarDay[]): { pnl: number; count: number; tradedDays: number }[] {
  const out: { pnl: number; count: number; tradedDays: number }[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const week = days.slice(i, i + 7).filter((d) => d.inMonth);
    out.push({
      pnl: Math.round(week.reduce((s, d) => s + (d.pnl ?? 0), 0) * 100) / 100,
      count: week.reduce((s, d) => s + d.count, 0),
      tradedDays: week.filter((d) => d.pnl != null).length,
    });
  }
  return out;
}
