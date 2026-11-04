import assert from "node:assert/strict";
import { calculateTrade, holdingMinutes, validateTrade } from "../src/lib/calc";
import { computeStats, cumulativeSeries, byTag, dayStats, monthGrid, weeklyTotals } from "../src/lib/analytics";
import { resolveRange } from "../src/lib/dates";
import { activityGrid, balanceSeries, journalProgress, streakStats, traderScore } from "../src/lib/insights";
import { accountStatus, scopedStartingBalance, scopeTrades, validateAccount } from "../src/lib/accounts";
import type { Account, Trade, TradeInput } from "../src/types";

const base: TradeInput = {
  account_id: null, trade_date: "2026-10-05", entry_time: "21:30", exit_time: "22:15",
  instrument: "NQ", direction: "Long", session: "New York",
  entry_price: 20000, exit_price: 20010.25, stop_loss: 19995, take_profit: 20020,
  quantity: 2, risk_amount: null, commission: 4.5, other_fees: 0.5,
  setup: "", market_bias: null, entry_reason: "", exit_reason: "", mistakes: "", lessons: "", notes: "",
  tag_ids: [], override_gross_pnl: null, override_r_multiple: null, override_status: null,
};
const S = { nas100_point_value: 1 };

// NQ long: 10.25 pts * $20 * 2 = 410
let c = calculateTrade(base, S);
assert.equal(c.pointValue, 20);
assert.equal(c.grossPnl, 410);
assert.equal(c.netPnl, 405);
assert.equal(c.riskDollars, 5 * 20 * 2); // 200 from stop distance
assert.equal(c.rMultiple, 2.025);
assert.equal(c.riskReward, 4);
assert.equal(c.status, "Win");
assert.equal(c.holdingMinutes, 45);

// MNQ uses $2/pt, never the same as NQ
c = calculateTrade({ ...base, instrument: "MNQ" }, S);
assert.equal(c.pointValue, 2);
assert.equal(c.grossPnl, 41);

// NQ short loss
c = calculateTrade({ ...base, direction: "Short", entry_price: 20000, exit_price: 20003, stop_loss: 20005, take_profit: 19990, quantity: 1, commission: 2, other_fees: 0 }, S);
assert.equal(c.grossPnl, -60);
assert.equal(c.netPnl, -62);
assert.equal(c.status, "Loss");
assert.equal(c.rMultiple, -0.62); // risk = 5*20 = 100

// NAS100 fractional lots with broker point value
c = calculateTrade({ ...base, instrument: "NAS100", entry_price: 20000.5, exit_price: 20012.3, stop_loss: null, take_profit: null, quantity: 0.35, commission: 0, other_fees: 0 }, { nas100_point_value: 10 });
assert.equal(c.pointValue, 10);
assert.equal(c.grossPnl, 41.3);
assert.equal(c.rMultiple, null);

// explicit risk amount wins over stop distance
c = calculateTrade({ ...base, risk_amount: 100 }, S);
assert.equal(c.riskDollars, 100);
assert.equal(c.rMultiple, 4.05);

// overrides
c = calculateTrade({ ...base, override_gross_pnl: 100, override_status: "Breakeven", override_r_multiple: 0.5 }, S);
assert.equal(c.grossPnl, 100);
assert.equal(c.netPnl, 95);
assert.equal(c.status, "Breakeven");
assert.equal(c.rMultiple, 0.5);

// optional fields: no times, no prices
c = calculateTrade({ ...base, entry_time: null, exit_time: null }, S);
assert.equal(c.holdingMinutes, 0);
assert.equal(c.grossPnl, 410); // prices still drive P&L
c = calculateTrade({ ...base, entry_price: null, exit_price: null }, S);
assert.equal(c.pricesMissing, true);
assert.equal(c.grossPnl, 0);
assert.equal(c.riskDollars, null); // stop distance needs an entry price
assert.equal(c.riskReward, null);
c = calculateTrade({ ...base, entry_price: null, exit_price: null, override_gross_pnl: 250, risk_amount: 100 }, S);
assert.equal(c.grossPnl, 250);
assert.equal(c.netPnl, 245);
assert.equal(c.rMultiple, 2.45);
assert.equal(c.status, "Win");
assert.deepEqual(validateTrade({ ...base, entry_time: null, exit_time: null, entry_price: null, exit_price: null }), {});
assert.ok(validateTrade({ ...base, entry_price: -5 }).entry_price); // still validated when given

// overnight holding
assert.equal(holdingMinutes("23:30", "00:15"), 45);

// validation
assert.ok(validateTrade({ ...base, entry_price: 20000.1 }).entry_price);
assert.ok(validateTrade({ ...base, quantity: 1.5 }).quantity);
assert.equal(validateTrade({ ...base, instrument: "NAS100", quantity: 0.35, entry_price: 20000.12, exit_price: 20001.1, stop_loss: 19990.5, take_profit: 20020.7 }).quantity, undefined);
assert.ok(validateTrade({ ...base, stop_loss: 20005 }).stop_loss);
assert.deepEqual(validateTrade(base), {});

// ---- analytics
const mk = (i: number, date: string, status: Trade["status"], net: number, tags: number[] = [], r: number | null = null): Trade => ({
  id: String(i), user_id: "u", account_id: null, trade_date: date, entry_time: "10:00:00", exit_time: "10:30:00",
  instrument: "NQ", direction: "Long", session: "New York", status,
  entry_price: 1, exit_price: 1, stop_loss: null, take_profit: null, quantity: 1, risk_amount: null,
  commission: 0, other_fees: 0, point_value: 20, gross_pnl: net, net_pnl: net, r_multiple: r, risk_reward: null,
  holding_minutes: 30, pnl_overridden: false, r_overridden: false, status_overridden: false,
  setup: null, market_bias: null, entry_reason: null, exit_reason: null, mistakes: null, lessons: null, notes: null,
  created_at: `2026-10-0${i}T00:00:00Z`, updated_at: "", tag_ids: tags, screenshots: [],
});
const ts = [
  mk(1, "2026-10-01", "Win", 300, [1, 4], 1.5),
  mk(2, "2026-10-02", "Loss", -100, [1], -1),
  mk(3, "2026-10-03", "Loss", -200, [4]),
  mk(4, "2026-10-04", "Win", 500, [1], 2.5),
  mk(5, "2026-10-05", "Breakeven", 0),
];
const s = computeStats(ts, 10000);
assert.equal(s.netPnl, 500);
assert.equal(s.grossProfit, 800);
assert.equal(s.grossLoss, -300);
assert.equal(s.winRate, 50); // 2 wins / (2 wins + 2 losses): the breakeven is not a loss
assert.equal(computeStats([ts[0], ts[4]], 0).winRate, 100);
assert.ok(Math.abs((s.profitFactor as number) - 800 / 300) < 1e-9);
assert.equal(s.maxLossStreak, 2);
assert.equal(s.maxWinStreak, 1);
assert.equal(s.maxDrawdown, 300); // 10300 peak -> 10000
assert.equal(s.bestDay?.pnl, 500);
assert.equal(s.worstDay?.pnl, -200);
assert.equal(s.avgWin, 400);
assert.equal(s.avgLoss, -150);
assert.equal(s.expectancy, 100);
const tagRes = byTag(ts, [{ id: 1, name: "FVG", sort_order: 1 }, { id: 4, name: "Sweep", sort_order: 2 }]);
assert.equal(tagRes[0].trades, 3);
assert.equal(tagRes[0].netPnl, 700); // multi-tag: trade 1 counted in both tags
assert.equal(tagRes[1].trades, 2);
assert.equal(tagRes[1].netPnl, 100);
const cum = cumulativeSeries(ts, "daily");
assert.equal(cum[cum.length - 1].cumulative, 500);
assert.equal(cumulativeSeries(ts, "monthly").length, 1);

// day stats: Oct 1 +300, Oct 2 -100, Oct 3 -200, Oct 4 +500, Oct 5 0
const ds = dayStats(ts);
assert.equal(ds.days, 5);
assert.equal(ds.winDays, 2);
assert.equal(ds.lossDays, 2);
assert.equal(ds.breakevenDays, 1);
assert.equal(ds.winRate, 50);
// weekly totals only count days inside the shown month
const grid = monthGrid(ts, new Date(2026, 9, 1));
assert.equal(grid.length % 7, 0);
const wk = weeklyTotals(grid);
assert.equal(wk.reduce((a, w) => a + w.pnl, 0), 500);
assert.equal(wk.reduce((a, w) => a + w.count, 0), 5);

// ranges
const r = resolveRange({ preset: "week" }, "Asia/Manila", new Date("2026-10-30T03:10:00Z"));
assert.equal(r.from, "2026-10-26");
assert.equal(r.to, "2026-11-01");
assert.deepEqual(resolveRange({ preset: "month" }, "UTC", new Date("2026-10-30T12:00:00Z")), { from: "2026-10-01", to: "2026-10-31" });

// ---- accounts: balance, max loss (static / trailing), daily loss
const acct: Account = { id: "A", user_id: "u", name: "Prop 10k", starting_balance: 10000, max_loss_limit: 1000, max_loss_type: "static", daily_loss_limit: 500, created_at: "" };
const day = [mk(1, "2026-10-01", "Loss", -300), mk(2, "2026-10-02", "Win", 800), mk(3, "2026-10-03", "Loss", -550)];
let st = accountStatus(acct, day, "2026-10-03");
assert.equal(st.balance, 9950);
assert.equal(st.netPnl, -50);
assert.equal(st.maxLossUsed, 50);
assert.equal(st.maxLossFloor, 9000);
assert.equal(st.maxLossRemaining, 950);
assert.equal(st.maxLossPct, 5);
assert.equal(st.maxLossBreached, false);
assert.equal(st.todayPnl, -550);
assert.equal(st.dailyUsed, 550);
assert.equal(st.dailyRemaining, -50);
assert.equal(st.dailyBreachedToday, true);
assert.equal(st.dailyBreachDays, 1);
assert.equal(accountStatus(acct, day, "2026-10-02").dailyBreachedToday, false); // +800 day
assert.equal(accountStatus(acct, day, "2026-10-04").dailyUsed, 0); // no trades today

const trail: Account = { ...acct, max_loss_type: "trailing" };
st = accountStatus(trail, day, "2026-10-03");
assert.equal(st.peak, 10500);
assert.equal(st.maxLossUsed, 550);
assert.equal(st.maxLossFloor, 9500);
assert.equal(st.maxLossRemaining, 450);
assert.equal(st.maxLossPct, 55);

const blown = [...day, mk(4, "2026-10-04", "Loss", -1000)];
st = accountStatus(acct, blown, "2026-10-04");
assert.equal(st.maxLossBreached, true);
assert.equal(st.maxLossBreachedOn, "2026-10-04");
assert.equal(st.maxLossRemaining, -50);
assert.equal(st.maxLossPct, 100);
assert.equal(accountStatus(trail, blown, "2026-10-04").maxLossBreachedOn, "2026-10-04");

const noLimits: Account = { ...acct, max_loss_limit: null, daily_loss_limit: null };
st = accountStatus(noLimits, blown, "2026-10-04");
assert.equal(st.maxLossFloor, null);
assert.equal(st.maxLossPct, null);
assert.equal(st.dailyRemaining, null);
assert.equal(st.maxLossBreached, false);

// ---- account filter scoping
const accB: Account = { ...acct, id: "B", name: "Funded 5k", starting_balance: 5000 };
const scoped = [{ ...mk(1, "2026-10-01", "Win", 100), account_id: "A" }, { ...mk(2, "2026-10-02", "Win", 50), account_id: "B" }, mk(3, "2026-10-03", "Loss", -20)];
assert.equal(scopeTrades(scoped, []).length, 3); // empty = all
assert.equal(scopeTrades(scoped, ["A"]).length, 1);
assert.equal(scopeTrades(scoped, ["A", "B"]).length, 2);
assert.equal(scopeTrades(scoped, ["A", "none"]).length, 2);
assert.equal(scopedStartingBalance([acct, accB], scoped, [], 2000), 17000); // 10000 + 5000 + default for the unassigned trade
assert.equal(scopedStartingBalance([acct, accB], scoped, ["A"], 2000), 10000);
assert.equal(scopedStartingBalance([acct, accB], scoped, ["A", "B"], 2000), 15000);
assert.equal(scopedStartingBalance([acct, accB], scoped.slice(0, 2), [], 2000), 15000); // no unassigned trades -> default not added
assert.equal(scopedStartingBalance([], scoped, [], 2000), 2000); // no accounts at all
assert.ok(validateAccount({ name: " ", starting_balance: 100, max_loss_limit: null, max_loss_type: "static", daily_loss_limit: null }, []).name);
assert.ok(validateAccount({ name: "prop 10K", starting_balance: 100, max_loss_limit: null, max_loss_type: "static", daily_loss_limit: null }, ["Prop 10k"]).name);
assert.ok(validateAccount({ name: "X", starting_balance: NaN, max_loss_limit: 0, max_loss_type: "static", daily_loss_limit: -5 }, []).starting_balance);
assert.deepEqual(validateAccount({ name: "X", starting_balance: 0, max_loss_limit: null, max_loss_type: "static", daily_loss_limit: null }, []), {});

// ---- streaks (ts: Win, Loss, Loss, Win, Breakeven on consecutive days)
let sk = streakStats(ts);
assert.equal(sk.trades.maxWin, 1);
assert.equal(sk.trades.maxLoss, 2);
assert.equal(sk.trades.current, 0); // last trade is breakeven
assert.equal(sk.trades.currentType, null);
assert.equal(sk.days.maxLoss, 2);
sk = streakStats([mk(1, "2026-10-01", "Loss", -1), mk(2, "2026-10-02", "Win", 1), mk(3, "2026-10-03", "Win", 1)]);
assert.equal(sk.trades.current, 2);
assert.equal(sk.trades.currentType, "win");
assert.equal(sk.days.current, 2);
assert.equal(sk.days.maxLoss, 1);
// two trades on one day net out to ONE day outcome
sk = streakStats([mk(1, "2026-10-01", "Win", 100), mk(2, "2026-10-01", "Loss", -40), mk(3, "2026-10-02", "Win", 50)]);
assert.equal(sk.days.current, 2);
assert.equal(sk.trades.current, 1);
assert.equal(streakStats([]).days.currentType, null);

// ---- trader score on ts (win 50%, PF 2.67, ratio 2.67, 4/5 documented, 0 stops, resilience 1/2)
const tsStats = computeStats(ts);
const sc = traderScore(ts, tsStats)!;
const ax = Object.fromEntries(sc.axes.map((a) => [a.key, a.value]));
assert.equal(ax.win, 50);
assert.ok(Math.abs(ax.profitFactor - (800 / 300 / 3) * 100) < 1e-9);
assert.equal(ax.risk, 100);
assert.equal(ax.discipline, 40);
assert.equal(ax.resilience, 50);
assert.equal(sc.total, 66);
assert.equal(traderScore([], computeStats([])), null);
const onlyWins = [mk(1, "2026-10-01", "Win", 100), mk(2, "2026-10-02", "Win", 50)];
const ow = traderScore(onlyWins, computeStats(onlyWins))!;
assert.equal(ow.axes.find((a) => a.key === "profitFactor")!.value, 100);
assert.equal(ow.axes.find((a) => a.key === "resilience")!.value, 100);

// ---- activity grid: 2 weeks ending Fri 2026-10-30 -> Mon Oct 19 .. Sun Nov 1
const ag = activityGrid([mk(1, "2026-10-20", "Win", 10), mk(2, "2026-10-20", "Loss", -5), mk(3, "2026-10-27", "Win", 1)], "2026-10-30", 2);
assert.equal(ag.columns.length, 2);
assert.equal(ag.columns[0][0].date, "2026-10-19");
assert.equal(ag.columns[0][1].date, "2026-10-20");
assert.equal(ag.columns[0][1].count, 2);
assert.equal(ag.columns[0][1].pnl, 5);
assert.equal(ag.columns[1][1].count, 1);
assert.equal(ag.columns.flat().filter((c) => c.future).length, 2); // Oct 31 and Nov 1
assert.equal(ag.months[0].label, "Oct");
assert.equal(ag.months.length, 1); // week of Oct 26 is still October

// ---- journal progress + balance series
const jt = [{ ...mk(1, "2026-10-30", "Win", 1), notes: "good" }, mk(2, "2026-10-30", "Loss", -1), mk(3, "2026-10-29", "Win", 1)];
assert.deepEqual(journalProgress(jt, "2026-10-30"), { total: 2, journaled: 1 });
const bs = balanceSeries(ts, 10000);
assert.equal(bs.length, 5);
assert.equal(bs[0].balance, 10300);
assert.equal(bs[bs.length - 1].balance, 10500);

console.log("All calculation tests passed");
