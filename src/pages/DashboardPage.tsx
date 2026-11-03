import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { useRangedTrades } from "@/hooks/useRangedTrades";
import { byInstrument, computeStats, cumulativeSeries, dailySeries, dayStats, type Granularity } from "@/lib/analytics";
import { formatDuration } from "@/lib/calc";
import { todayIn } from "@/lib/dates";
import { activityGrid, balanceSeries, journalProgress, streakStats, traderScore } from "@/lib/insights";
import { cn, formatMoney, formatPct, formatPF, formatR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChartEmpty, DateRangeFilter, EmptyState, PageHeader, Row, StatCard, toneOf } from "@/components/common";
import { CumulativePnlChart, DailyPnlChart, PnlBarChart, WinLossChart } from "@/components/charts/charts";
import { CountBadge, KpiCard, RatioBar, RingGauge, SemiGauge } from "@/components/widgets/Gauges";
import { TradingCalendar } from "@/components/analytics/TradingCalendar";
import { AccountFilter } from "@/components/accounts/AccountFilter";
import { AccountStatusCard } from "@/components/accounts/AccountStatusCard";
import { accountStatus } from "@/lib/accounts";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { StreakCard } from "@/components/dashboard/StreakCard";
import { TraderScoreCard } from "@/components/dashboard/TraderScoreCard";
import { ProgressTracker } from "@/components/dashboard/ProgressTracker";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { RecentTradesCard } from "@/components/dashboard/RecentTradesCard";

const GRANULARITIES: { v: Granularity; label: string }[] = [
  { v: "daily", label: "Daily" },
  { v: "weekly", label: "Weekly" },
  { v: "monthly", label: "Monthly" },
];

export default function DashboardPage() {
  const { trades, scopedTrades, scopeAccounts, scopedStartingBalance, settings } = useData();
  const { range, setRange, filtered } = useRangedTrades({ preset: "all" });
  const [gran, setGran] = useState<Granularity>("daily");
  const cur = settings.currency;
  const money = (n: number | null | undefined, sign = false) => formatMoney(n, { currency: cur, sign });

  const stats = useMemo(() => computeStats(filtered, scopedStartingBalance), [filtered, scopedStartingBalance]);
  const days = useMemo(() => dayStats(filtered), [filtered]);
  const today = todayIn(settings.timezone);
  // loss limits, streaks, balance and the heatmap use full history, not the date filter
  const accountStatuses = useMemo(
    () => scopeAccounts.map((a) => accountStatus(a, trades.filter((t) => t.account_id === a.id), today)),
    [scopeAccounts, trades, today],
  );
  const cum = useMemo(() => cumulativeSeries(filtered, gran), [filtered, gran]);
  const daily = useMemo(() => dailySeries(filtered), [filtered]);
  const inst = useMemo(() => byInstrument(filtered, scopedStartingBalance), [filtered, scopedStartingBalance]);
  const score = useMemo(() => traderScore(filtered, stats), [filtered, stats]);
  const streaks = useMemo(() => streakStats(scopedTrades), [scopedTrades]);
  const grid = useMemo(() => activityGrid(scopedTrades, today), [scopedTrades, today]);
  const journal = useMemo(() => journalProgress(scopedTrades, today), [scopedTrades, today]);
  const balance = useMemo(() => balanceSeries(scopedTrades, scopedStartingBalance), [scopedTrades, scopedStartingBalance]);
  const currentBalance = balance.length ? balance[balance.length - 1].balance : scopedStartingBalance;
  const recent = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => (a.trade_date !== b.trade_date ? (a.trade_date < b.trade_date ? 1 : -1) : (a.entry_time ?? "") < (b.entry_time ?? "") ? 1 : -1))
        .slice(0, 8),
    [filtered],
  );
  const largest = useMemo(() => [...filtered].sort((a, b) => Math.abs(b.net_pnl) - Math.abs(a.net_pnl)).slice(0, 8), [filtered]);

  const header = (
    <PageHeader
      title="Dashboard"
      description="Your trading performance at a glance"
      actions={
        <>
          <AccountFilter />
          <DateRangeFilter value={range} onChange={setRange} />
          <Button asChild>
            <Link to="/journal?new=1">
              <Plus /> Add Trade
            </Link>
          </Button>
        </>
      }
    />
  );

  if (trades.length === 0) {
    return (
      <>
        {header}
        <EmptyState />
      </>
    );
  }

  const dd = stats.maxDrawdown;
  const winLossRatio = stats.avgLoss < 0 && stats.avgWin > 0 ? stats.avgWin / Math.abs(stats.avgLoss) : null;

  return (
    <>
      {header}

      {/* Headline widgets */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard
          label="Net P&L"
          badge={<CountBadge>{stats.totalTrades}</CountBadge>}
          value={money(stats.netPnl, true)}
          valueClass={cn(stats.netPnl > 0 && "text-profit", stats.netPnl < 0 && "text-loss")}
          footer={`Total trades: ${stats.totalTrades}`}
        />
        <KpiCard label="Trade win %" value={formatPct(stats.winRate)} visual={<SemiGauge wins={stats.wins} breakevens={stats.breakevens} losses={stats.losses} />} />
        <KpiCard label="Profit factor" value={formatPF(stats.profitFactor, stats.profitFactorInfinite)} visual={<RingGauge profit={stats.grossProfit} loss={stats.grossLoss} />} />
        <KpiCard label="Day win %" value={days.days ? formatPct(days.winRate) : "—"} visual={<SemiGauge wins={days.winDays} breakevens={days.breakevenDays} losses={days.lossDays} />} />
        <KpiCard label="Avg win / loss trade" value={winLossRatio != null ? winLossRatio.toFixed(2) : "—"} footer={<RatioBar avgWin={stats.avgWin} avgLoss={stats.avgLoss} formatter={(n) => money(n)} />} />
        <StreakCard streaks={streaks} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Gross Profit" value={money(stats.grossProfit)} tone={stats.grossProfit > 0 ? "profit" : "neutral"} />
        <StatCard label="Gross Loss" value={money(stats.grossLoss)} tone={stats.grossLoss < 0 ? "loss" : "neutral"} />
        <StatCard label="Average Win" value={stats.wins ? money(stats.avgWin) : "—"} tone={stats.avgWin > 0 ? "profit" : "neutral"} />
        <StatCard label="Average Loss" value={stats.losses ? money(stats.avgLoss) : "—"} tone={stats.avgLoss < 0 ? "loss" : "neutral"} />
        <StatCard label="Average R-Multiple" value={formatR(stats.avgR)} tone={toneOf(stats.avgR)} />
        <StatCard label="Total Trades" value={stats.totalTrades} sub={`${stats.wins}W · ${stats.losses}L · ${stats.breakevens}BE`} />
        <StatCard
          label="Maximum Drawdown"
          value={dd > 0 ? "-" + money(dd) : money(0)}
          tone={dd > 0 ? "loss" : "neutral"}
          sub={stats.maxDrawdownPct != null && dd > 0 ? `${stats.maxDrawdownPct.toFixed(1)}% of peak equity` : undefined}
        />
      </div>

      {accountStatuses.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold">Accounts</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accountStatuses.map((s) => (
              <AccountStatusCard key={s.account.id} status={s} currency={cur} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-4 space-y-4">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <TraderScoreCard score={score} />
          <WidgetCard
            title="Daily net cumulative P&L"
            info="Running total of net P&L. Green fill is above zero, red below."
            actions={
              <div className="flex rounded-lg border p-0.5">
                {GRANULARITIES.map((g) => (
                  <button key={g.v} onClick={() => setGran(g.v)} className={cn("rounded-md px-2 py-0.5 text-xs font-medium transition-colors", gran === g.v ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>
                    {g.label}
                  </button>
                ))}
              </div>
            }
          >
            {filtered.length === 0 ? <ChartEmpty message="No trades in the selected date range" /> : <CumulativePnlChart data={cum} currency={cur} />}
          </WidgetCard>
          <WidgetCard title="Net daily P&L" info="Net P&L for each trading day." className="lg:col-span-2 xl:col-span-1">
            {filtered.length === 0 ? <ChartEmpty message="No trades in the selected date range" /> : <DailyPnlChart data={daily} currency={cur} />}
          </WidgetCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ProgressTracker grid={grid} journal={journal} currency={cur} />
          <BalanceCard points={balance} balance={currentBalance} startingBalance={scopedStartingBalance} currency={cur} />
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <TradingCalendar trades={scopedTrades} currency={cur} today={today} />
          </div>
          <RecentTradesCard recent={recent} largest={largest} currency={cur} />
        </div>

        {filtered.length > 0 && (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <WidgetCard title="Win / Loss Distribution">
                <WinLossChart wins={stats.wins} losses={stats.losses} breakevens={stats.breakevens} />
              </WidgetCard>

              <WidgetCard title="Performance by Instrument">
                <PnlBarChart data={inst.map((i) => ({ name: i.instrument, pnl: i.stats.netPnl }))} currency={cur} height={170} />
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-1 font-medium">Instrument</th>
                        <th className="py-1 text-right font-medium">Trades</th>
                        <th className="py-1 text-right font-medium">Win rate</th>
                        <th className="py-1 text-right font-medium">Net P&amp;L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inst.map(({ instrument, stats: s }) => (
                        <tr key={instrument} className="border-t border-border/60">
                          <td className="py-1.5 font-medium">{instrument}</td>
                          <td className="py-1.5 text-right tabular-nums">{s.totalTrades}</td>
                          <td className="py-1.5 text-right tabular-nums">{s.totalTrades ? formatPct(s.winRate) : "—"}</td>
                          <td className={cn("py-1.5 text-right font-medium tabular-nums", s.netPnl > 0 && "text-profit", s.netPnl < 0 && "text-loss")}>{s.totalTrades ? money(s.netPnl, true) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </WidgetCard>
            </div>

            <WidgetCard title="Trading Statistics">
              <div className="grid gap-x-10 md:grid-cols-2">
                <div>
                  <Row
                    label="Best Trading Day"
                    value={stats.bestDay ? `${money(stats.bestDay.pnl, true)} · ${format(parseISO(stats.bestDay.date), "MMM d, yyyy")}` : "—"}
                    tone={stats.bestDay ? toneOf(stats.bestDay.pnl) : undefined}
                  />
                  <Row
                    label="Worst Trading Day"
                    value={stats.worstDay ? `${money(stats.worstDay.pnl, true)} · ${format(parseISO(stats.worstDay.date), "MMM d, yyyy")}` : "—"}
                    tone={stats.worstDay ? toneOf(stats.worstDay.pnl) : undefined}
                  />
                  <Row label="Longest Winning Streak" value={`${stats.maxWinStreak} ${stats.maxWinStreak === 1 ? "trade" : "trades"}`} />
                  <Row label="Longest Losing Streak" value={`${stats.maxLossStreak} ${stats.maxLossStreak === 1 ? "trade" : "trades"}`} />
                </div>
                <div>
                  <Row label="Average Holding Time" value={formatDuration(stats.avgHoldingMinutes)} />
                  <Row label="Largest Winning Trade" value={stats.largestWin > 0 ? money(stats.largestWin, true) : "—"} tone={stats.largestWin > 0 ? "profit" : undefined} />
                  <Row label="Largest Losing Trade" value={stats.largestLoss < 0 ? money(stats.largestLoss) : "—"} tone={stats.largestLoss < 0 ? "loss" : undefined} />
                  <Row label="Expectancy (per trade)" value={money(stats.expectancy, true)} tone={toneOf(stats.expectancy)} />
                </div>
              </div>
            </WidgetCard>
          </>
        )}
      </div>
    </>
  );
}
