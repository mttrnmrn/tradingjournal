import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartEmpty } from "@/components/common";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import type { TraderScore } from "@/lib/insights";

const INFO =
  "Average of five 0-100 scores. Win: win rate. Profit factor: 3.0+ = 100. Risk: avg win / avg loss, 2:1+ = 100. Discipline: share of trades with a stop loss and share with a setup, notes, tags or screenshot. Resilience: how often a loss is followed by a non-loss.";

export function TraderScoreCard({ score }: { score: TraderScore | null }) {
  return (
    <WidgetCard title="Trader Score" info={INFO}>
      {!score ? (
        <ChartEmpty message="Add trades to see your score" />
      ) : (
        <>
          <div role="img" aria-label={`Trader score ${score.total} out of 100`}>
            <ResponsiveContainer width="100%" height={230}>
              <RadarChart data={score.axes.map((a) => ({ subject: a.label, value: Math.round(a.value), detail: a.detail }))} outerRadius="68%">
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: "hsl(var(--primary))", fontWeight: 500 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="hsl(var(--primary))" fillOpacity={0.32} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, _n, item) => [`${v}/100`, (item?.payload as { detail?: string })?.detail ?? "Score"]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center gap-5 border-t pt-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Your trader score</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">{score.total}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="relative h-2 rounded-full" style={{ background: "linear-gradient(90deg,#ef4444 0%,#f59e0b 35%,#eab308 55%,#22c55e 100%)" }}>
                <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground shadow" style={{ left: `${score.total}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-muted-foreground">
                {[0, 20, 40, 60, 80, 100].map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </WidgetCard>
  );
}
