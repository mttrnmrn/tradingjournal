import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatMoney } from "@/lib/utils";
import type { AccountStatus } from "@/lib/accounts";

function LimitBar({
  label,
  used,
  limit,
  pct,
  remaining,
  breached,
  note,
  currency,
}: {
  label: string;
  used: number;
  limit: number;
  pct: number;
  remaining: number;
  breached: boolean;
  note?: string;
  currency: string;
}) {
  const m = (n: number) => formatMoney(n, { currency });
  const tone = breached || pct >= 100 ? "bg-loss" : pct >= 80 ? "bg-amber-500" : "bg-profit";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <span className="font-semibold">{m(used)}</span>
          <span className="text-muted-foreground"> / {m(limit)}</span>
        </span>
      </div>
      <div
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div className={cn("h-full rounded-full transition-all duration-500", tone)} style={{ width: `${Math.max(pct, used > 0 ? 2 : 0)}%` }} />
      </div>
      <div className="mt-1 flex justify-between gap-2 text-[11px]">
        <span className={cn(breached ? "font-semibold text-loss" : "text-muted-foreground")}>{breached ? "Limit breached" : `${m(Math.max(remaining, 0))} remaining`}</span>
        {note && <span className="text-muted-foreground">{note}</span>}
      </div>
    </div>
  );
}

export function AccountStatusCard({ status, currency, actions }: { status: AccountStatus; currency: string; actions?: ReactNode }) {
  const { account: a } = status;
  const m = (n: number | null, sign = false) => formatMoney(n, { currency, sign });
  const hasLimits = a.max_loss_limit != null || a.daily_loss_limit != null;

  return (
    <Card className={cn("flex flex-col gap-4 p-4", (status.maxLossBreached || status.dailyBreachedToday) && "border-loss/40")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{a.name}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {status.maxLossBreached && <Badge className="border-loss/30 bg-loss/10 text-loss">Max loss breached</Badge>}
            {status.dailyBreachedToday && <Badge className="border-loss/30 bg-loss/10 text-loss">Daily limit hit today</Badge>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>

      <div>
        <div className="text-2xl font-semibold tabular-nums tracking-tight">{m(status.balance)}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          <span className={cn("font-medium tabular-nums", status.netPnl > 0 && "text-profit", status.netPnl < 0 && "text-loss")}>{m(status.netPnl, true)}</span>
          {" · "}
          {status.trades} {status.trades === 1 ? "trade" : "trades"} · started {m(a.starting_balance)}
        </div>
      </div>

      {hasLimits ? (
        <div className="space-y-3">
          {a.max_loss_limit != null && (
            <LimitBar
              label={`Max loss limit (${a.max_loss_type})`}
              used={status.maxLossUsed}
              limit={a.max_loss_limit}
              pct={status.maxLossPct ?? 0}
              remaining={status.maxLossRemaining ?? 0}
              breached={status.maxLossBreached}
              note={status.maxLossFloor != null ? `Floor ${m(status.maxLossFloor)}` : undefined}
              currency={currency}
            />
          )}
          {a.daily_loss_limit != null && (
            <LimitBar
              label="Daily loss limit (today)"
              used={status.dailyUsed}
              limit={a.daily_loss_limit}
              pct={status.dailyPct ?? 0}
              remaining={status.dailyRemaining ?? 0}
              breached={status.dailyBreachedToday}
              note={status.dailyBreachDays > 0 ? `Hit on ${status.dailyBreachDays} ${status.dailyBreachDays === 1 ? "day" : "days"}` : undefined}
              currency={currency}
            />
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No loss limits set for this account.</p>
      )}
    </Card>
  );
}
