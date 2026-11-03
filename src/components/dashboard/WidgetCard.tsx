import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Card with a divided header (title, optional info tooltip, optional actions). */
export function WidgetCard({
  title,
  info,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  info?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <div className="flex min-h-[52px] items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {info && (
            <span title={info} className="cursor-help text-muted-foreground" aria-label={info}>
              <Info className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        {actions}
      </div>
      <div className={cn("flex-1 p-4", bodyClassName)}>{children}</div>
    </Card>
  );
}
