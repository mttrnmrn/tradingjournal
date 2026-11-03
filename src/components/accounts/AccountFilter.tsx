import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Wallet } from "lucide-react";
import { useData } from "@/context/DataContext";
import { cn } from "@/lib/utils";
import { UNASSIGNED } from "@/types";

/** Multi-select account filter. Nothing selected (or everything selected) = all accounts. */
export function AccountFilter() {
  const { accounts, trades, selectedAccountIds, setSelectedAccountIds } = useData();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (accounts.length === 0) return null;

  const hasUnassigned = trades.some((t) => !t.account_id);
  const options = [...accounts.map((a) => ({ id: a.id, name: a.name })), ...(hasUnassigned ? [{ id: UNASSIGNED, name: "Unassigned" }] : [])];
  const all = selectedAccountIds.length === 0;
  const isOn = (id: string) => all || selectedAccountIds.includes(id);
  const checkedCount = all ? options.length : options.filter((o) => selectedAccountIds.includes(o.id)).length;

  const label = all
    ? "All accounts"
    : checkedCount === 1
      ? (options.find((o) => selectedAccountIds.includes(o.id))?.name ?? "1 account")
      : `${checkedCount} accounts`;

  function toggle(id: string) {
    const current = all ? options.map((o) => o.id) : selectedAccountIds;
    const on = current.includes(id);
    if (on && current.length === 1) return; // keep at least one selected
    const next = on ? current.filter((x) => x !== id) : [...current, id];
    setSelectedAccountIds(next.length === options.length ? [] : next);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 min-w-[150px] items-center gap-2 rounded-md border border-input bg-card px-3 text-sm shadow-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !all && "border-primary/60 text-primary",
        )}
      >
        <Wallet className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div role="listbox" aria-multiselectable className="absolute right-0 z-30 mt-1 w-64 animate-fade-in rounded-lg border bg-card p-1 shadow-xl">
          <button
            type="button"
            onClick={() => setSelectedAccountIds([])}
            className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent/60"
          >
            <span className={cn("font-medium", all && "text-primary")}>All accounts</span>
            {all && <Check className="h-4 w-4 text-primary" />}
          </button>
          <div className="my-1 border-t" />
          <div className="max-h-64 overflow-y-auto">
            {options.map((o) => {
              const on = isOn(o.id);
              return (
                <div key={o.id} className="group flex items-center rounded-md hover:bg-accent/60">
                  <button type="button" role="option" aria-selected={on} onClick={() => toggle(o.id)} className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-sm">
                    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <span className="truncate">{o.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccountIds([o.id]);
                      setOpen(false);
                    }}
                    className="mr-1 rounded px-1.5 py-1 text-xs font-medium text-muted-foreground opacity-0 transition hover:text-primary focus:opacity-100 group-hover:opacity-100"
                  >
                    Only
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
