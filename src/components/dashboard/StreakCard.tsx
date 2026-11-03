import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StreakInfo, Streaks } from "@/lib/insights";

function Pill({ tone, children, title }: { tone: "win" | "loss"; children: string; title: string }) {
  return (
    <span title={title} className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums", tone === "win" ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss")}>
      {children}
    </span>
  );
}

function Block({ label, unit, info, circle }: { label: string; unit: "day" | "trade"; info: StreakInfo; circle?: boolean }) {
  const plural = (n: number) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  const tone = info.currentType === "win" ? "border-profit text-profit" : info.currentType === "loss" ? "border-loss text-loss" : "border-muted-foreground/40 text-muted-foreground";
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2.5">
        {circle ? (
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] text-lg font-semibold tabular-nums", tone)} title={info.currentType ? `Current ${info.currentType} streak` : "No active streak"}>
            {info.current}
          </div>
        ) : (
          <div className={cn("w-8 text-xl font-semibold tabular-nums", info.currentType === "win" && "text-profit", info.currentType === "loss" && "text-loss")}>{info.current || "--"}</div>
        )}
        <div className="flex flex-col gap-1">
          <Pill tone="loss" title={`Longest losing streak (${unit}s)`}>{plural(info.maxLoss)}</Pill>
          <Pill tone="win" title={`Longest winning streak (${unit}s)`}>{plural(info.maxWin)}</Pill>
        </div>
      </div>
    </div>
  );
}

export function StreakCard({ streaks }: { streaks: Streaks }) {
  return (
    <Card className="px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        Current streak
        <span title="The big number is your current run. Red and green pills show your longest losing and winning streaks." className="cursor-help">
          <Info className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <Block label="Days" unit="day" info={streaks.days} circle />
        <Block label="Trades" unit="trade" info={streaks.trades} />
      </div>
    </Card>
  );
}
