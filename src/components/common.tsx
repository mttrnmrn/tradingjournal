import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { RANGE_LABELS } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { DateRange, RangePreset } from "@/types";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone,
  sub,
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: "profit" | "loss" | "neutral";
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("px-4 py-3 transition-colors hover:border-input", className)}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-semibold tabular-nums tracking-tight", tone === "profit" && "text-profit", tone === "loss" && "text-loss")}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

export function toneOf(n: number | null | undefined): "profit" | "loss" | "neutral" {
  if (n == null || n === 0) return "neutral";
  return n > 0 ? "profit" : "loss";
}

export function Row({ label, value, tone }: { label: string; value: ReactNode; tone?: "profit" | "loss" | "neutral" }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium tabular-nums", tone === "profit" && "text-profit", tone === "loss" && "text-loss")}>{value}</span>
    </div>
  );
}

export function EmptyState({
  title = "No trades yet",
  message = "Record your first trade to start building your journal and unlock your performance analytics.",
  cta = true,
}: {
  title?: string;
  message?: string;
  cta?: boolean;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <BookOpen className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {cta && (
        <Button asChild>
          <Link to="/journal?new=1">
            <Plus /> Add your first trade
          </Link>
        </Button>
      )}
    </Card>
  );
}

export function ChartEmpty({ message = "No data for this period" }: { message?: string }) {
  return <div className="flex h-full min-h-[180px] items-center justify-center text-sm text-muted-foreground">{message}</div>;
}

export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label="Date range"
        className="w-[150px]"
        value={value.preset}
        onChange={(e) => {
          const preset = e.target.value as RangePreset;
          onChange(preset === "custom" ? { preset, from: value.from, to: value.to } : { preset });
        }}
      >
        {(Object.keys(RANGE_LABELS) as RangePreset[]).map((p) => (
          <option key={p} value={p}>
            {RANGE_LABELS[p]}
          </option>
        ))}
      </Select>
      {value.preset === "custom" && (
        <>
          <Input type="date" aria-label="From date" className="w-[150px]" value={value.from ?? ""} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" aria-label="To date" className="w-[150px]" value={value.to ?? ""} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </>
      )}
    </div>
  );
}

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center gap-3 text-sm text-muted-foreground">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
      {label}
    </div>
  );
}
