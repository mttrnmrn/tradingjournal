import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartEmpty } from "@/components/common";
import { formatMoney } from "@/lib/utils";
import type { CumPoint } from "@/lib/analytics";

const PROFIT = "hsl(var(--profit))";
const LOSS = "hsl(var(--loss))";
const GRID = "hsl(var(--border))";
const AXIS = { fontSize: 11, fill: "hsl(var(--muted-foreground))" } as const;

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
    color: "hsl(var(--foreground))",
  },
  labelStyle: { color: "hsl(var(--muted-foreground))", marginBottom: 2 },
  itemStyle: { color: "hsl(var(--foreground))" },
};

const axisMoney = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}k` : String(v));

export function CumulativePnlChart({ data, currency }: { data: CumPoint[]; currency: string }) {
  if (!data.length) return <ChartEmpty />;
  const max = Math.max(...data.map((d) => d.cumulative));
  const min = Math.min(...data.map((d) => d.cumulative));
  // where zero sits between the top (0) and bottom (1) of the plotted range
  const zero = max <= 0 ? 0 : min >= 0 ? 1 : max / (max - min);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cumSplit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={PROFIT} stopOpacity={0.4} />
            <stop offset={zero} stopColor={PROFIT} stopOpacity={0.03} />
            <stop offset={zero} stopColor={LOSS} stopOpacity={0.03} />
            <stop offset="1" stopColor={LOSS} stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={48} domain={[(m: number) => Math.min(0, m), (m: number) => Math.max(0, m)]} />
        <ReferenceLine y={0} stroke="hsl(var(--primary))" strokeDasharray="4 4" />
        <Tooltip {...tooltipStyle} formatter={(v: number) => [formatMoney(v, { currency }), "Cumulative P&L"]} />
        <Area type="monotone" dataKey="cumulative" baseValue={0} stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#cumSplit)" dot={data.length < 40} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DailyPnlChart({ data, currency }: { data: { date: string; label: string; pnl: number; trades: number }[]; currency: string }) {
  if (!data.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={48} />
        <ReferenceLine y={0} stroke={GRID} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => [formatMoney(v, { currency }), "Net P&L"]} />
        <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={36}>
          {data.map((d) => (
            <Cell key={d.date} fill={d.pnl >= 0 ? PROFIT : LOSS} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WinLossChart({ wins, losses, breakevens }: { wins: number; losses: number; breakevens: number }) {
  const total = wins + losses + breakevens;
  if (!total) return <ChartEmpty />;
  const data = [
    { name: "Wins", value: wins, color: PROFIT },
    { name: "Losses", value: losses, color: LOSS },
    { name: "Breakeven", value: breakevens, color: "hsl(var(--muted-foreground))" },
  ].filter((d) => d.value > 0);
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-around">
      <div className="relative h-[190px] w-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={data.length > 1 ? 2 : 0} stroke="none">
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{total}</span>
          <span className="text-xs text-muted-foreground">trades</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {[
          { n: "Winning trades", v: wins, c: PROFIT },
          { n: "Losing trades", v: losses, c: LOSS },
          { n: "Breakeven trades", v: breakevens, c: "hsl(var(--muted-foreground))" },
        ].map((r) => (
          <li key={r.n} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.c }} />
            <span className="text-muted-foreground">{r.n}</span>
            <span className="ml-auto pl-4 font-medium tabular-nums">
              {r.v} <span className="text-xs text-muted-foreground">({((r.v / total) * 100).toFixed(0)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PnlBarChart({ data, currency, height = 220 }: { data: { name: string; pnl: number }[]; currency: string; height?: number }) {
  if (!data.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={48} />
        <ReferenceLine y={0} stroke={GRID} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => [formatMoney(v, { currency }), "Net P&L"]} />
        <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={56}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.pnl >= 0 ? PROFIT : LOSS} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
