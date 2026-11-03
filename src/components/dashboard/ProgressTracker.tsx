import { Link } from "react-router-dom";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { cn, formatMoney } from "@/lib/utils";
import type { ActivityGrid, HeatCell } from "@/lib/insights";

const CELL = 14;
const GAP = 3;
const STEP = CELL + GAP;
const LEVELS = ["bg-muted", "bg-primary/25", "bg-primary/50", "bg-primary/75", "bg-primary"];

const level = (n: number) => Math.min(n, 4);

export function ProgressTracker({ grid, journal, currency }: { grid: ActivityGrid; journal: { total: number; journaled: number }; currency: string }) {
  const tip = (c: HeatCell) => `${c.date}: ${c.count ? `${c.count} ${c.count === 1 ? "trade" : "trades"}, ${formatMoney(c.pnl, { currency, sign: true })}` : "no trades"}`;
  const pct = journal.total ? (journal.journaled / journal.total) * 100 : 0;

  return (
    <WidgetCard title="Progress tracker" info="Trades logged per day over the last 18 weeks. Darker squares mean more trades." className="h-full">
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-2">
          <div className="flex flex-col text-[10px] text-muted-foreground" style={{ gap: GAP, paddingTop: 20 }}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
              <div key={d} style={{ height: CELL, lineHeight: `${CELL}px` }}>
                {i % 2 === 0 ? d : ""}
              </div>
            ))}
          </div>
          <div>
            <div className="relative h-4 text-[10px] text-muted-foreground" style={{ width: grid.columns.length * STEP, marginBottom: 4 }}>
              {grid.months.map((m) => (
                <span key={m.col} className="absolute" style={{ left: m.col * STEP }}>
                  {m.label}
                </span>
              ))}
            </div>
            <div className="grid grid-flow-col" style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, gridAutoColumns: `${CELL}px`, gap: GAP }}>
              {grid.columns.flat().map((c) => (
                <div key={c.date} title={c.future ? undefined : tip(c)} className={cn("rounded-[3px]", c.future ? "bg-transparent" : LEVELS[level(c.count)])} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
        Less
        {LEVELS.map((l) => (
          <span key={l} className={cn("h-3 w-3 rounded-[3px]", l)} />
        ))}
        More
      </div>

      <div className="mt-4 flex items-center gap-4 border-t pt-4">
        <div className="min-w-[88px]">
          <div className="text-xs font-medium text-muted-foreground" title="Today's trades that have reasons, notes, lessons, mistakes or a screenshot">
            Today's journaling
          </div>
          <div className="mt-0.5 text-xl font-semibold tabular-nums">{journal.total ? `${journal.journaled}/${journal.total}` : "—"}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">{journal.total ? (journal.journaled === journal.total ? "All of today's trades are journaled" : "Add notes to finish today's journal") : "No trades logged today"}</div>
        </div>
        <Link to="/journal" className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent">
          Journal
        </Link>
      </div>
    </WidgetCard>
  );
}
