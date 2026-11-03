import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addMonths, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResultBadge } from "@/components/ui/badge";
import { monthGrid, weeklyTotals } from "@/lib/analytics";
import { cn, formatMoney, formatR, hhmm } from "@/lib/utils";
import type { Trade } from "@/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GRID = "grid-cols-[repeat(7,minmax(0,1fr))_minmax(56px,0.9fr)]";

export function TradingCalendar({ trades, currency, today }: { trades: Trade[]; currency: string; today: string }) {
  const [month, setMonth] = useState(() => {
    const latest = trades.length ? trades.reduce((a, b) => (b.trade_date > a ? b.trade_date : a), trades[0].trade_date) : today;
    return parseISO(latest.slice(0, 7) + "-01");
  });
  const [selected, setSelected] = useState<string | null>(null);

  const days = useMemo(() => monthGrid(trades, month), [trades, month]);
  const weekly = useMemo(() => weeklyTotals(days), [days]);
  const monthKey = format(month, "yyyy-MM");
  const monthTotal = useMemo(() => {
    const inMonth = trades.filter((t) => t.trade_date.startsWith(monthKey));
    return { pnl: Math.round(inMonth.reduce((s, t) => s + t.net_pnl, 0) * 100) / 100, count: inMonth.length, days: new Set(inMonth.map((t) => t.trade_date)).size };
  }, [trades, monthKey]);
  const dayTrades = useMemo(
    () => (selected ? trades.filter((t) => t.trade_date === selected).sort((a, b) => ((a.entry_time ?? "") < (b.entry_time ?? "") ? -1 : 1)) : []),
    [trades, selected],
  );

  const short = (n: number) => {
    const abs = Math.abs(n);
    const body = abs >= 10000 ? `${(abs / 1000).toFixed(1)}k` : abs >= 1000 ? `${(abs / 1000).toFixed(2)}k` : abs.toFixed(abs % 1 === 0 ? 0 : 2);
    return (n < 0 ? "-" : n > 0 ? "+" : "") + "$" + body;
  };

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <CardTitle>Trading Calendar</CardTitle>
        <div className="flex items-center gap-2">
          <div className="mr-2 hidden items-center gap-2 text-xs sm:flex">
            <span className="text-muted-foreground">Monthly stats:</span>
            <span className={cn("rounded-md px-2 py-0.5 font-semibold tabular-nums", monthTotal.pnl > 0 && "bg-profit/15 text-profit", monthTotal.pnl < 0 && "bg-loss/15 text-loss", monthTotal.pnl === 0 && "bg-muted text-muted-foreground")}>{formatMoney(monthTotal.pnl, { currency, sign: true })}</span>
            <span className="rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">{monthTotal.days} {monthTotal.days === 1 ? "day" : "days"}</span>
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronLeft />
          </Button>
          <span className="min-w-[110px] text-center text-sm font-medium">{format(month, "MMMM yyyy")}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(parseISO(today.slice(0, 7) + "-01"))}>
            Today
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("grid gap-1 text-center text-xs text-muted-foreground", GRID)}>
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
          <div className="py-1">Week</div>
        </div>
        <div className={cn("grid gap-1", GRID)}>
          {days.map((d, idx) => {
            const has = d.pnl != null;
            const isSel = selected === d.date;
            const wk = idx % 7 === 6 ? weekly[Math.floor(idx / 7)] : null;
            return (
              <Fragment key={d.date}>
              <button
                onClick={() => setSelected(isSel ? null : d.date)}
                aria-label={`${format(parseISO(d.date), "MMMM d")}${has ? `, ${d.count} trades, ${formatMoney(d.pnl, { currency, sign: true })}` : ", no trades"}`}
                className={cn(
                  "flex min-h-[58px] flex-col items-start justify-between rounded-md border p-1.5 text-left transition-colors sm:min-h-[74px] sm:p-2",
                  !d.inMonth && "opacity-35",
                  !has && "bg-card text-muted-foreground",
                  has && (d.pnl as number) > 0 && "border-profit/40 bg-profit/15",
                  has && (d.pnl as number) < 0 && "border-loss/40 bg-loss/15",
                  has && d.pnl === 0 && "bg-muted",
                  d.date === today && "ring-1 ring-primary/60",
                  isSel && "ring-2 ring-primary",
                  "hover:brightness-110",
                )}
              >
                <span className="text-xs">{Number(d.date.slice(8))}</span>
                {has && (
                  <span className="w-full">
                    <span className={cn("block truncate text-[11px] font-semibold tabular-nums sm:text-xs", (d.pnl as number) > 0 && "text-profit", (d.pnl as number) < 0 && "text-loss")}>{short(d.pnl as number)}</span>
                    <span className="hidden text-[10px] text-muted-foreground sm:block">
                      {d.count} {d.count === 1 ? "trade" : "trades"}
                    </span>
                  </span>
                )}
              </button>
              {wk && (
                <div
                  className={cn(
                    "flex min-h-[58px] flex-col items-center justify-center rounded-md border border-dashed p-1 text-center sm:min-h-[74px]",
                    wk.tradedDays === 0 && "text-muted-foreground/60",
                  )}
                >
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Wk {Math.floor(idx / 7) + 1}</span>
                  <span className={cn("max-w-full truncate text-[11px] font-semibold tabular-nums sm:text-xs", wk.pnl > 0 && "text-profit", wk.pnl < 0 && "text-loss")}>
                    {wk.tradedDays ? short(wk.pnl) : "—"}
                  </span>
                  {wk.tradedDays > 0 && <span className="hidden text-[10px] text-muted-foreground sm:block">{wk.tradedDays} {wk.tradedDays === 1 ? "day" : "days"}</span>}
                </div>
              )}
              </Fragment>
            );
          })}
        </div>

        {selected && (
          <div className="mt-4 animate-fade-in rounded-lg border">
            <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
              <span>{format(parseISO(selected), "EEEE, MMM d, yyyy")}</span>
              <span className="text-xs text-muted-foreground">{dayTrades.length} {dayTrades.length === 1 ? "trade" : "trades"}</span>
            </div>
            {dayTrades.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No trades recorded on this day.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <tbody>
                    {dayTrades.map((t) => (
                      <tr key={t.id} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{hhmm(t.entry_time)}</td>
                        <td className="px-3 py-2 font-medium">
                          <Link to={`/journal?trade=${t.id}`} className="hover:underline">
                            {t.instrument}
                          </Link>
                        </td>
                        <td className={cn("px-3 py-2", t.direction === "Long" ? "text-profit" : "text-loss")}>{t.direction}</td>
                        <td className="px-3 py-2">{t.session}</td>
                        <td className={cn("px-3 py-2 text-right font-medium tabular-nums", t.net_pnl > 0 && "text-profit", t.net_pnl < 0 && "text-loss")}>{formatMoney(t.net_pnl, { currency, sign: true })}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatR(t.r_multiple)}</td>
                        <td className="px-3 py-2">
                          <ResultBadge status={t.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
