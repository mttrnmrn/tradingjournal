import { useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Card } from "@/components/ui/card";
import { cn, formatMoney } from "@/lib/utils";
import type { Trade } from "@/types";

type Tab = "recent" | "largest";

export function RecentTradesCard({ recent, largest, currency }: { recent: Trade[]; largest: Trade[]; currency: string }) {
  const [tab, setTab] = useState<Tab>("recent");
  const rows = tab === "recent" ? recent : largest;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b px-2">
        <div className="flex">
          {(
            [
              ["recent", "Recent trades"],
              ["largest", "Largest trades"],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn("relative px-3 py-3 text-sm font-medium transition-colors", tab === k ? "text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary" : "text-muted-foreground hover:text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
        <Link to="/journal" className="px-3 text-xs font-medium text-primary hover:underline">
          View all
        </Link>
      </div>
      <div className="px-3 pb-3 pt-2">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No trades in this period</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="rounded-l-md bg-muted/60 px-3 py-2 font-medium">Date</th>
                <th className="bg-muted/60 px-3 py-2 font-medium">Symbol</th>
                <th className="rounded-r-md bg-muted/60 px-3 py-2 text-right font-medium">Net P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <Link to={`/journal?trade=${t.id}`} className="block">
                      {format(parseISO(t.trade_date), "MM-dd-yyyy")}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 font-medium">
                    {t.instrument} <span className={cn("text-xs font-normal", t.direction === "Long" ? "text-profit" : "text-loss")}>{t.direction}</span>
                  </td>
                  <td className={cn("px-3 py-2.5 text-right font-semibold tabular-nums", t.net_pnl > 0 && "text-profit", t.net_pnl < 0 && "text-loss")}>{formatMoney(t.net_pnl, { currency })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
