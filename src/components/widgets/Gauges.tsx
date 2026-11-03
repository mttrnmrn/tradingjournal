import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const PROFIT = "hsl(var(--profit))";
const LOSS = "hsl(var(--loss))";
const NEUTRAL = "hsl(var(--muted-foreground) / 0.55)";
const TRACK = "hsl(var(--muted))";
const BLUE = "#3b82f6";

/** Shell shared by the KPI widgets: small label on top, value + visual below. */
export function KpiCard({ label, value, valueClass, badge, visual, footer, className }: {
  label: string;
  value: ReactNode;
  valueClass?: string;
  badge?: ReactNode;
  visual?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col justify-between px-4 py-3.5 transition-colors hover:border-input", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {badge}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className={cn("truncate text-2xl font-semibold tabular-nums tracking-tight", valueClass)}>{value}</div>
          {footer && <div className="mt-1 text-xs text-muted-foreground">{footer}</div>}
        </div>
        {visual && <div className="shrink-0">{visual}</div>}
      </div>
    </Card>
  );
}

export function CountBadge({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-primary">{children}</span>;
}

/** Half-circle gauge split into wins / breakeven / losses. */
export function SemiGauge({ wins, breakevens, losses }: { wins: number; breakevens: number; losses: number }) {
  const total = wins + breakevens + losses;
  const seg = (n: number) => (total ? (n / total) * 100 : 0);
  const parts = [
    { pct: seg(wins), color: PROFIT, label: "Wins" },
    { pct: seg(breakevens), color: BLUE, label: "Breakeven" },
    { pct: seg(losses), color: LOSS, label: "Losses" },
  ];
  let start = 0;
  return (
    <div className="flex flex-col items-center">
      <svg width="104" height="60" viewBox="0 0 120 68" role="img" aria-label={`${wins} wins, ${breakevens} breakeven, ${losses} losses`}>
        <path d="M 10 62 A 50 50 0 0 1 110 62" pathLength={100} fill="none" stroke={TRACK} strokeWidth="9" strokeLinecap="butt" />
        {total > 0 &&
          parts.map((p) => {
            if (p.pct <= 0) return null;
            const el = (
              <path
                key={p.label}
                d="M 10 62 A 50 50 0 0 1 110 62"
                pathLength={100}
                fill="none"
                stroke={p.color}
                strokeWidth="9"
                strokeDasharray={`${Math.max(p.pct - (parts.filter((x) => x.pct > 0).length > 1 ? 1 : 0), 0.5)} 100`}
                strokeDashoffset={-start}
              />
            );
            start += p.pct;
            return el;
          })}
      </svg>
      <div className="-mt-1 flex gap-1.5 text-[10px] font-semibold tabular-nums">
        <span className="rounded bg-profit/15 px-1.5 text-profit">{wins}</span>
        <span className="rounded bg-blue-500/15 px-1.5 text-blue-500">{breakevens}</span>
        <span className="rounded bg-loss/15 px-1.5 text-loss">{losses}</span>
      </div>
    </div>
  );
}

/** Ring showing gross profit vs gross loss (profit factor). */
export function RingGauge({ profit, loss }: { profit: number; loss: number }) {
  const total = profit + Math.abs(loss);
  const p = total ? (profit / total) * 100 : 0;
  const l = total ? (Math.abs(loss) / total) * 100 : 0;
  const both = p > 0 && l > 0;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Gross profit versus gross loss">
      <g transform="rotate(-90 32 32)">
        <circle cx="32" cy="32" r="25" fill="none" stroke={TRACK} strokeWidth="8" />
        {p > 0 && <circle cx="32" cy="32" r="25" fill="none" stroke={PROFIT} strokeWidth="8" pathLength={100} strokeDasharray={`${p - (both ? 1 : 0)} 100`} />}
        {l > 0 && <circle cx="32" cy="32" r="25" fill="none" stroke={LOSS} strokeWidth="8" pathLength={100} strokeDasharray={`${l - (both ? 1 : 0)} 100`} strokeDashoffset={-p} />}
      </g>
    </svg>
  );
}

/** Average win vs average loss as two proportional bars. */
export function RatioBar({ avgWin, avgLoss, formatter }: { avgWin: number; avgLoss: number; formatter: (n: number) => string }) {
  const w = Math.abs(avgWin);
  const l = Math.abs(avgLoss);
  const total = w + l;
  return (
    <div className="mt-1 w-full">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {total > 0 && <div className="h-full bg-profit transition-all duration-500" style={{ width: `${(w / total) * 100}%` }} />}
        {total > 0 && <div className="h-full bg-loss transition-all duration-500" style={{ width: `${(l / total) * 100}%` }} />}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-medium tabular-nums">
        <span className="text-profit">{w ? formatter(avgWin) : "—"}</span>
        <span className="text-loss">{l ? formatter(avgLoss) : "—"}</span>
      </div>
    </div>
  );
}
