import { addDays, format, parseISO, startOfWeek, subWeeks } from "date-fns";
import { dailyPnlMap, sortChrono, type Stats } from "@/lib/analytics";
import { round2 } from "@/lib/calc";
import type { Trade } from "@/types";

// ---------------------------------------------------------------- streaks

export interface StreakInfo {
  current: number; // length of the run that ends at the latest day/trade
  currentType: "win" | "loss" | null; // null = the latest day/trade was breakeven or there is no data
  maxWin: number;
  maxLoss: number;
}
export interface Streaks {
  days: StreakInfo;
  trades: StreakInfo;
}

type Outcome = "win" | "loss" | "flat";

function runs(outcomes: Outcome[]): StreakInfo {
  let maxW = 0, maxL = 0, cw = 0, cl = 0;
  for (const o of outcomes) {
    if (o === "win") { cw++; cl = 0; }
    else if (o === "loss") { cl++; cw = 0; }
    else { cw = 0; cl = 0; }
    maxW = Math.max(maxW, cw);
    maxL = Math.max(maxL, cl);
  }
  const last = outcomes[outcomes.length - 1];
  return {
    current: last === "win" ? cw : last === "loss" ? cl : 0,
    currentType: last === "win" ? "win" : last === "loss" ? "loss" : null,
    maxWin: maxW,
    maxLoss: maxL,
  };
}

/** Day streaks use each day's net P&L; trade streaks use each trade's Result. A breakeven breaks a streak. */
export function streakStats(trades: Trade[]): Streaks {
  const ordered = sortChrono(trades);
  const tradeOutcomes: Outcome[] = ordered.map((t) => (t.status === "Win" ? "win" : t.status === "Loss" ? "loss" : "flat"));
  const dayOutcomes: Outcome[] = [...dailyPnlMap(ordered).entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, v]) => (v.pnl > 0 ? "win" : v.pnl < 0 ? "loss" : "flat"));
  return { days: runs(dayOutcomes), trades: runs(tradeOutcomes) };
}

// ---------------------------------------------------------------- trader score

export interface ScoreAxis {
  key: "win" | "profitFactor" | "risk" | "discipline" | "resilience";
  label: string;
  value: number; // 0..100
  detail: string;
}
export interface TraderScore {
  total: number; // 0..100, average of the five axes
  axes: ScoreAxis[];
}

const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

function isDocumented(t: Trade): boolean {
  return Boolean(t.setup || t.entry_reason || t.exit_reason || t.notes || t.lessons || t.mistakes) || t.tag_ids.length > 0 || t.screenshots.length > 0;
}

/**
 * A 0-100 summary of five habits, each scaled to 0-100 (the total is their average):
 *  - Win: win rate.
 *  - Profit factor: PF 3.0 or better = 100 (1.0 = 33).
 *  - Risk: average win / average loss, 2:1 or better = 100.
 *  - Discipline: average of (% of trades with a stop loss) and (% of trades with a setup, notes, tags or screenshot).
 *  - Resilience: of the losing trades that were followed by another trade, the % after which the next trade was not a loss.
 * Returns null when there are no trades.
 */
export function traderScore(trades: Trade[], stats: Stats): TraderScore | null {
  if (trades.length === 0) return null;
  const n = trades.length;
  const ordered = sortChrono(trades);

  const win = stats.winRate;
  const pf = stats.profitFactorInfinite ? 100 : stats.profitFactor == null ? 0 : clamp100((stats.profitFactor / 3) * 100);

  let ratio: number | null = null;
  let risk = 0;
  if (stats.avgWin > 0 && stats.avgLoss < 0) {
    ratio = stats.avgWin / Math.abs(stats.avgLoss);
    risk = clamp100((ratio / 2) * 100);
  } else if (stats.wins > 0 && stats.losses === 0) {
    risk = 100;
  }

  const withStop = trades.filter((t) => t.stop_loss != null).length;
  const documented = trades.filter(isDocumented).length;
  const discipline = ((withStop / n + documented / n) / 2) * 100;

  let denominator = 0, recovered = 0;
  ordered.forEach((t, i) => {
    if (t.status !== "Loss" || i === ordered.length - 1) return;
    denominator++;
    if (ordered[i + 1].status !== "Loss") recovered++;
  });
  const resilience = stats.losses === 0 ? 100 : denominator === 0 ? 50 : (recovered / denominator) * 100;

  const axes: ScoreAxis[] = [
    { key: "win", label: "Win", value: win, detail: `Win rate ${win.toFixed(0)}%` },
    { key: "profitFactor", label: "Profit factor", value: pf, detail: stats.profitFactorInfinite ? "No losing trades" : stats.profitFactor != null ? `Profit factor ${stats.profitFactor.toFixed(2)} (3.0 = full score)` : "No profit yet" },
    { key: "risk", label: "Risk", value: risk, detail: ratio != null ? `Avg win / avg loss ${ratio.toFixed(2)} (2.0 = full score)` : "Needs both wins and losses" },
    { key: "discipline", label: "Discipline", value: discipline, detail: `${withStop}/${n} with a stop loss, ${documented}/${n} documented` },
    { key: "resilience", label: "Resilience", value: resilience, detail: stats.losses === 0 ? "No losing trades" : denominator === 0 ? "No trades after a loss yet" : `${recovered}/${denominator} losses followed by a non-loss` },
  ];
  return { total: Math.round(axes.reduce((s, a) => s + a.value, 0) / axes.length), axes };
}

// ---------------------------------------------------------------- activity heatmap

export interface HeatCell {
  date: string;
  count: number;
  pnl: number;
  future: boolean;
}
export interface ActivityGrid {
  columns: HeatCell[][]; // one column per week (Mon..Sun)
  months: { col: number; label: string }[];
}

/** Trades per day for the last `weeks` weeks (Monday-first columns), ending with the week of `today`. */
export function activityGrid(trades: Trade[], today: string, weeks = 18): ActivityGrid {
  const map = dailyPnlMap(trades);
  const start = startOfWeek(subWeeks(parseISO(today), weeks - 1), { weekStartsOn: 1 });
  const columns: HeatCell[][] = [];
  const months: { col: number; label: string }[] = [];
  let prevMonth = -1;
  for (let c = 0; c < weeks; c++) {
    const col: HeatCell[] = [];
    for (let r = 0; r < 7; r++) {
      const d = addDays(start, c * 7 + r);
      const key = format(d, "yyyy-MM-dd");
      const v = map.get(key);
      col.push({ date: key, count: v?.count ?? 0, pnl: v?.pnl ?? 0, future: key > today });
    }
    const first = addDays(start, c * 7);
    if (first.getMonth() !== prevMonth) {
      months.push({ col: c, label: format(first, "MMM") });
      prevMonth = first.getMonth();
    }
    columns.push(col);
  }
  return { columns, months };
}

/** How many of today's trades have any journal content (reasons, notes, lessons, mistakes or a screenshot). */
export function journalProgress(trades: Trade[], today: string): { total: number; journaled: number } {
  const todays = trades.filter((t) => t.trade_date === today);
  const journaled = todays.filter((t) => Boolean(t.entry_reason || t.exit_reason || t.notes || t.lessons || t.mistakes) || t.screenshots.length > 0).length;
  return { total: todays.length, journaled };
}

// ---------------------------------------------------------------- balance

export interface BalancePoint {
  date: string;
  label: string;
  balance: number;
}

/** End-of-day balance: starting balance plus cumulative net P&L. Pass ALL trades in scope, then slice by date. */
export function balanceSeries(trades: Trade[], startingBalance: number): BalancePoint[] {
  let bal = startingBalance;
  return [...dailyPnlMap(trades).entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]) => {
      bal = round2(bal + v.pnl);
      return { date, label: format(parseISO(date), "MMM d"), balance: bal };
    });
}
