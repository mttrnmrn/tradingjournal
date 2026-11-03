import { cn } from "@/lib/utils";
import type { TradeStatus } from "@/types";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", className)} {...props} />
  );
}

export function ResultBadge({ status }: { status: TradeStatus }) {
  const cls =
    status === "Win"
      ? "border-profit/30 bg-profit/10 text-profit"
      : status === "Loss"
        ? "border-loss/30 bg-loss/10 text-loss"
        : "border-border bg-muted text-muted-foreground";
  return <Badge className={cls}>{status}</Badge>;
}
