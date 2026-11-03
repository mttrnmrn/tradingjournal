import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartEmpty } from "@/components/common";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { cn, formatMoney } from "@/lib/utils";
import type { BalancePoint } from "@/lib/insights";

const axisMoney = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}k` : String(Math.round(v)));

export function BalanceCard({ points, balance, startingBalance, currency }: { points: BalancePoint[]; balance: number; startingBalance: number; currency: string }) {
  const change = Math.round((balance - startingBalance) * 100) / 100;
  return (
    <WidgetCard
      title="Account Balance"
      info="End-of-day balance: starting balance plus cumulative net P&L of the selected accounts. The dashed line is your starting balance."
      actions={
        <div className="text-right leading-tight">
          <div className="text-sm font-semibold tabular-nums">{formatMoney(balance, { currency })}</div>
          <div className={cn("text-[11px] font-medium tabular-nums", change > 0 && "text-profit", change < 0 && "text-loss", change === 0 && "text-muted-foreground")}>{formatMoney(change, { currency, sign: true })} all time</div>
        </div>
      }
    >
      {points.length === 0 ? (
        <ChartEmpty />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} minTickGap={28} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={48} domain={["auto", "auto"]} />
            {startingBalance > 0 && <ReferenceLine y={startingBalance} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />}
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              formatter={(v: number) => [formatMoney(v, { currency }), "Balance"]}
            />
            <Area type="monotone" dataKey="balance" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#balFill)" dot={points.length < 30} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </WidgetCard>
  );
}
