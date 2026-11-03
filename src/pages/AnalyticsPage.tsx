import { useMemo } from "react";
import { Trophy, TriangleAlert } from "lucide-react";
import { useData } from "@/context/DataContext";
import { useRangedTrades } from "@/hooks/useRangedTrades";
import { byDirection, byInstrument, bySession, byTag, computeStats } from "@/lib/analytics";
import { formatDuration } from "@/lib/calc";
import { todayIn } from "@/lib/dates";
import { cn, formatMoney, formatPct, formatPF, formatR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangeFilter, EmptyState, PageHeader, Row, StatCard, toneOf } from "@/components/common";
import { PnlBarChart } from "@/components/charts/charts";
import { TradingCalendar } from "@/components/analytics/TradingCalendar";
import { AccountFilter } from "@/components/accounts/AccountFilter";

export default function AnalyticsPage() {
  const { trades, scopedTrades, scopeAccounts, scopedStartingBalance, tags, settings } = useData();
  const { range, setRange, filtered } = useRangedTrades({ preset: "all" });
  const cur = settings.currency;
  const money = (n: number | null | undefined, sign = false) => formatMoney(n, { currency: cur, sign });

  const stats = useMemo(() => computeStats(filtered, scopedStartingBalance), [filtered, scopedStartingBalance]);
  const inst = useMemo(() => byInstrument(filtered, scopedStartingBalance), [filtered, scopedStartingBalance]);
  const sess = useMemo(() => bySession(filtered), [filtered]);
  const dir = useMemo(() => byDirection(filtered), [filtered]);
  const tagStats = useMemo(() => byTag(filtered, tags).sort((a, b) => b.netPnl - a.netPnl), [filtered, tags]);

  // per-account comparison: period stats from the date-filtered trades, balance from the account's whole history
  const accountRows = useMemo(() => {
    const rows: { id: string; name: string; stats: ReturnType<typeof computeStats>; balance: number | null }[] = scopeAccounts.map((a) => {
      const all = scopedTrades.filter((t) => t.account_id === a.id);
      const balance = Math.round((a.starting_balance + all.reduce((s, t) => s + t.net_pnl, 0)) * 100) / 100;
      return { id: a.id, name: a.name, stats: computeStats(filtered.filter((t) => t.account_id === a.id), a.starting_balance), balance };
    });
    const unassigned = filtered.filter((t) => !t.account_id);
    if (unassigned.length) rows.push({ id: "none", name: "Unassigned", stats: computeStats(unassigned), balance: null });
    return rows;
  }, [scopeAccounts, scopedTrades, filtered]);

  const header = (
    <PageHeader title="Performance Analytics" description="Everything below is calculated from your recorded trades" actions={
        <>
          <AccountFilter />
          <DateRangeFilter value={range} onChange={setRange} />
        </>
      } />
  );

  if (trades.length === 0) {
    return (
      <>
        {header}
        <EmptyState message="Analytics are generated from your journal. Add a trade to see your performance breakdown." />
      </>
    );
  }

  const sessionsWithTrades = sess.filter((s) => s.stats.totalTrades > 0);
  const bestSession = sessionsWithTrades.length ? sessionsWithTrades.reduce((a, b) => (b.stats.netPnl > a.stats.netPnl ? b : a)) : null;
  const worstSession = sessionsWithTrades.length ? sessionsWithTrades.reduce((a, b) => (b.stats.netPnl < a.stats.netPnl ? b : a)) : null;
  const mostLosses = sessionsWithTrades.length ? sessionsWithTrades.reduce((a, b) => (b.stats.losses > a.stats.losses ? b : a)) : null;

  const noData = filtered.length === 0;

  return (
    <>
      {header}

      {/* A. Overall */}
      <h2 className="mb-2 text-sm font-semibold">Overall Performance</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total Net P&L" value={money(stats.netPnl, true)} tone={toneOf(stats.netPnl)} />
        <StatCard label="Win Rate" value={formatPct(stats.winRate)} />
        <StatCard label="Profit Factor" value={formatPF(stats.profitFactor, stats.profitFactorInfinite)} />
        <StatCard label="Avg Risk-to-Reward" value={stats.avgRR != null ? `1 : ${stats.avgRR.toFixed(2)}` : "—"} sub="Planned (stop → target)" />
        <StatCard label="Avg R-Multiple" value={formatR(stats.avgR)} tone={toneOf(stats.avgR)} />
        <StatCard label="Expectancy" value={money(stats.expectancy, true)} tone={toneOf(stats.expectancy)} sub={stats.expectancyR != null ? `${formatR(stats.expectancyR)} per trade` : "per trade"} />
        <StatCard label="Winning Trades" value={stats.wins} tone={stats.wins ? "profit" : "neutral"} />
        <StatCard label="Losing Trades" value={stats.losses} tone={stats.losses ? "loss" : "neutral"} />
        <StatCard label="Breakeven Trades" value={stats.breakevens} />
        <StatCard label="Total Trades" value={stats.totalTrades} />
      </div>

      {noData && <p className="mt-4 rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No trades in the selected date range.</p>}

      {!noData && (
        <>
          {accountRows.length > 1 && (
            <>
              <h2 className="mb-2 mt-8 text-sm font-semibold">Performance by Account</h2>
              <Card>
                <CardContent className="overflow-x-auto pt-4">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-1 font-medium">Account</th>
                        <th className="py-1 text-right font-medium">Trades</th>
                        <th className="py-1 text-right font-medium">Win rate</th>
                        <th className="py-1 text-right font-medium">Profit factor</th>
                        <th className="py-1 text-right font-medium">Net P&amp;L</th>
                        <th className="py-1 text-right font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountRows.map((r) => (
                        <tr key={r.id} className="border-t border-border/60">
                          <td className="py-2 font-medium">{r.name}</td>
                          <td className="py-2 text-right tabular-nums">{r.stats.totalTrades}</td>
                          <td className="py-2 text-right tabular-nums">{r.stats.totalTrades ? formatPct(r.stats.winRate) : "—"}</td>
                          <td className="py-2 text-right tabular-nums">{r.stats.totalTrades ? formatPF(r.stats.profitFactor, r.stats.profitFactorInfinite) : "—"}</td>
                          <td className={cn("py-2 text-right font-medium tabular-nums", r.stats.netPnl > 0 && "text-profit", r.stats.netPnl < 0 && "text-loss")}>{r.stats.totalTrades ? money(r.stats.netPnl, true) : "—"}</td>
                          <td className="py-2 text-right tabular-nums">{r.balance != null ? money(r.balance) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}

          {/* B. Instruments */}
          <h2 className="mb-2 mt-8 text-sm font-semibold">Performance by Instrument</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            {inst.map(({ instrument, stats: s }) => (
              <Card key={instrument}>
                <CardHeader>
                  <CardTitle>{instrument}</CardTitle>
                  <span className={cn("text-sm font-semibold tabular-nums", s.netPnl > 0 && "text-profit", s.netPnl < 0 && "text-loss")}>{s.totalTrades ? money(s.netPnl, true) : "—"}</span>
                </CardHeader>
                <CardContent>
                  {s.totalTrades === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No {instrument} trades in this period</p>
                  ) : (
                    <>
                      <Row label="Total trades" value={s.totalTrades} />
                      <Row label="Win rate" value={formatPct(s.winRate)} />
                      <Row label="Profit factor" value={formatPF(s.profitFactor, s.profitFactorInfinite)} />
                      <Row label="Average win" value={s.wins ? money(s.avgWin) : "—"} tone={s.wins ? "profit" : undefined} />
                      <Row label="Average loss" value={s.losses ? money(s.avgLoss) : "—"} tone={s.losses ? "loss" : undefined} />
                      <Row label="Average R-multiple" value={formatR(s.avgR)} tone={toneOf(s.avgR)} />
                      <Row label="Best trade" value={s.bestTrade && s.bestTrade.net_pnl > 0 ? money(s.bestTrade.net_pnl, true) : "—"} tone={s.bestTrade && s.bestTrade.net_pnl > 0 ? "profit" : undefined} />
                      <Row label="Worst trade" value={s.worstTrade && s.worstTrade.net_pnl < 0 ? money(s.worstTrade.net_pnl) : "—"} tone={s.worstTrade && s.worstTrade.net_pnl < 0 ? "loss" : undefined} />
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* C. Sessions */}
          <h2 className="mb-2 mt-8 text-sm font-semibold">Performance by Session</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="pt-4">
                <PnlBarChart data={sess.map((s) => ({ name: s.session, pnl: s.stats.netPnl }))} currency={cur} height={200} />
                {sessionsWithTrades.length > 0 && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="flex items-center gap-2 rounded-md border border-profit/30 bg-profit/10 px-3 py-2 text-sm">
                      <Trophy className="h-4 w-4 shrink-0 text-profit" />
                      <span>
                        Most profitable: <b>{bestSession?.session}</b> ({money(bestSession?.stats.netPnl, true)})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-loss/30 bg-loss/10 px-3 py-2 text-sm">
                      <TriangleAlert className="h-4 w-4 shrink-0 text-loss" />
                      <span>
                        {mostLosses && mostLosses.stats.losses > 0 ? (
                          <>
                            Most losses: <b>{mostLosses.session}</b> ({mostLosses.stats.losses} losing {mostLosses.stats.losses === 1 ? "trade" : "trades"})
                          </>
                        ) : (
                          <>No losing trades</>
                        )}
                        {worstSession && worstSession.stats.netPnl < 0 && <span className="block text-xs text-muted-foreground">Weakest P&amp;L: {worstSession.session} ({money(worstSession.stats.netPnl)})</span>}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="overflow-x-auto pt-4">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1 font-medium">Session</th>
                      <th className="py-1 text-right font-medium">Trades</th>
                      <th className="py-1 text-right font-medium">Win rate</th>
                      <th className="py-1 text-right font-medium">PF</th>
                      <th className="py-1 text-right font-medium">Net P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sess.map(({ session, stats: s }) => (
                      <tr key={session} className="border-t border-border/60">
                        <td className="py-2 font-medium">{session}</td>
                        <td className="py-2 text-right tabular-nums">{s.totalTrades}</td>
                        <td className="py-2 text-right tabular-nums">{s.totalTrades ? formatPct(s.winRate) : "—"}</td>
                        <td className="py-2 text-right tabular-nums">{s.totalTrades ? formatPF(s.profitFactor, s.profitFactorInfinite) : "—"}</td>
                        <td className={cn("py-2 text-right font-medium tabular-nums", s.netPnl > 0 && "text-profit", s.netPnl < 0 && "text-loss")}>{s.totalTrades ? money(s.netPnl, true) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* D. Long vs Short */}
          <h2 className="mb-2 mt-8 text-sm font-semibold">Long vs Short</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {(["Long", "Short"] as const).map((d) => {
              const s = dir[d];
              const avgProfit = s.totalTrades ? s.netPnl / s.totalTrades : 0;
              return (
                <Card key={d}>
                  <CardHeader>
                    <CardTitle className={d === "Long" ? "text-profit" : "text-loss"}>{d}</CardTitle>
                    <span className="text-xs text-muted-foreground">{s.totalTrades} trades</span>
                  </CardHeader>
                  <CardContent>
                    <Row label={`${d} win rate`} value={s.totalTrades ? formatPct(s.winRate) : "—"} />
                    <Row label={`${d} net P&L`} value={s.totalTrades ? money(s.netPnl, true) : "—"} tone={s.totalTrades ? toneOf(s.netPnl) : undefined} />
                    <Row label={`Average ${d.toLowerCase()} profit (per trade)`} value={s.totalTrades ? money(avgProfit, true) : "—"} tone={s.totalTrades ? toneOf(avgProfit) : undefined} />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* E. Winning & losing */}
          <h2 className="mb-2 mt-8 text-sm font-semibold">Winning &amp; Losing Analysis</h2>
          <Card>
            <CardContent className="grid gap-x-10 pt-4 md:grid-cols-2">
              <div>
                <Row label="Largest winning trade" value={stats.largestWin > 0 ? money(stats.largestWin, true) : "—"} tone={stats.largestWin > 0 ? "profit" : undefined} />
                <Row label="Largest losing trade" value={stats.largestLoss < 0 ? money(stats.largestLoss) : "—"} tone={stats.largestLoss < 0 ? "loss" : undefined} />
                <Row label="Average winning trade" value={stats.wins ? money(stats.avgWin, true) : "—"} tone={stats.wins ? "profit" : undefined} />
                <Row label="Average losing trade" value={stats.losses ? money(stats.avgLoss) : "—"} tone={stats.losses ? "loss" : undefined} />
              </div>
              <div>
                <Row label="Maximum consecutive wins" value={stats.maxWinStreak} />
                <Row label="Maximum consecutive losses" value={stats.maxLossStreak} />
                <Row label="Average holding time" value={formatDuration(stats.avgHoldingMinutes)} />
                <Row label="Maximum drawdown" value={stats.maxDrawdown > 0 ? "-" + money(stats.maxDrawdown) : money(0)} tone={stats.maxDrawdown > 0 ? "loss" : undefined} />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* F. Calendar (always shows every trade) */}
      <h2 className="mb-2 mt-8 text-sm font-semibold">Calendar</h2>
      <TradingCalendar trades={scopedTrades} currency={cur} today={todayIn(settings.timezone)} />

      {/* G. Tags */}
      {!noData && (
        <>
          <h2 className="mb-1 mt-8 text-sm font-semibold">Tag Performance</h2>
          <p className="mb-2 text-xs text-muted-foreground">A trade with several tags is counted once under each of its tags, so tag totals can add up to more than your overall totals.</p>
          <Card>
            <CardContent className="overflow-x-auto pt-4">
              {tagStats.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No tagged trades in this period. Add ICT / price action tags to your trades to see which setups perform best.</p>
              ) : (
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1 font-medium">Tag</th>
                      <th className="py-1 text-right font-medium">Trades</th>
                      <th className="py-1 text-right font-medium">W / L / BE</th>
                      <th className="py-1 text-right font-medium">Win rate</th>
                      <th className="py-1 text-right font-medium">Profit factor</th>
                      <th className="py-1 text-right font-medium">Avg R</th>
                      <th className="py-1 text-right font-medium">Net P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tagStats.map((t, i) => (
                      <tr key={t.tag.id} className="border-t border-border/60">
                        <td className="py-2 font-medium">
                          {t.tag.name}
                          {i === 0 && t.netPnl > 0 && <span className="ml-2 rounded bg-profit/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-profit">Top</span>}
                        </td>
                        <td className="py-2 text-right tabular-nums">{t.trades}</td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          {t.wins} / {t.losses} / {t.breakevens}
                        </td>
                        <td className="py-2 text-right tabular-nums">{formatPct(t.winRate)}</td>
                        <td className="py-2 text-right tabular-nums">{t.profitFactor != null ? t.profitFactor.toFixed(2) : t.netPnl > 0 ? "∞" : "—"}</td>
                        <td className="py-2 text-right tabular-nums">{formatR(t.avgR)}</td>
                        <td className={cn("py-2 text-right font-medium tabular-nums", t.netPnl > 0 && "text-profit", t.netPnl < 0 && "text-loss")}>{money(t.netPnl, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
