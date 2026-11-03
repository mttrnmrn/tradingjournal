import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ArrowDown, ArrowUp, Plus, Search, X } from "lucide-react";
import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { ResultBadge } from "@/components/ui/badge";
import { DateRangeFilter, EmptyState, PageHeader } from "@/components/common";
import { AccountFilter } from "@/components/accounts/AccountFilter";
import { TradeFormDialog } from "@/components/journal/TradeFormDialog";
import { TradeDetailDialog } from "@/components/journal/TradeDetailDialog";
import { filterByRange, todayIn } from "@/lib/dates";
import { cn, formatMoney, formatNumber, formatR } from "@/lib/utils";
import { deleteTrade, duplicateTrade } from "@/services/trades";
import { DIRECTIONS, INSTRUMENTS, SESSIONS, STATUSES, type DateRange, type Trade } from "@/types";

type SortKey = "trade_date" | "account" | "instrument" | "direction" | "session" | "entry_price" | "exit_price" | "quantity" | "net_pnl" | "r_multiple" | "status";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "trade_date", label: "Date" },
  { key: "instrument", label: "Instrument" },
  { key: "account", label: "Account" },
  { key: "direction", label: "Direction" },
  { key: "session", label: "Session" },
  { key: "entry_price", label: "Entry Price", align: "right" },
  { key: "exit_price", label: "Exit Price", align: "right" },
  { key: "quantity", label: "Quantity", align: "right" },
  { key: "net_pnl", label: "Net P&L", align: "right" },
  { key: "r_multiple", label: "R-Multiple", align: "right" },
  { key: "status", label: "Result" },
];

export default function JournalPage() {
  const { trades, scopedTrades, accounts, tags, settings, refresh } = useData();
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [instrument, setInstrument] = useState("");
  const [direction, setDirection] = useState("");
  const [session, setSession] = useState("");
  const [result, setResult] = useState("");
  const [tagId, setTagId] = useState("");
  const [range, setRange] = useState<DateRange>({ preset: "all" });
  const [sortKey, setSortKey] = useState<SortKey>("trade_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // /journal?new=1 (dashboard CTA) opens the form; /journal?trade=<id> (calendar) opens that trade
  useEffect(() => {
    let changed = false;
    if (params.get("new")) {
      setEditId(null);
      setFormOpen(true);
      params.delete("new");
      changed = true;
    }
    const tid = params.get("trade");
    if (tid) {
      setDetailId(tid);
      params.delete("trade");
      changed = true;
    }
    if (changed) setParams(params, { replace: true });
  }, [params, setParams]);

  const editTrade = editId ? (trades.find((t) => t.id === editId) ?? null) : null;
  const detailTrade = detailId ? (trades.find((t) => t.id === detailId) ?? null) : null;

  const accountNames = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const acctName = (id: string | null) => (id ? (accountNames.get(id) ?? "—") : "Unassigned");
  const columns = accounts.length > 0 ? COLUMNS : COLUMNS.filter((c) => c.key !== "account");

  const tagNames = useMemo(() => new Map(tags.map((t) => [t.id, t.name.toLowerCase()])), [tags]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = filterByRange(scopedTrades, range, settings.timezone).filter((t) => {
      if (instrument && t.instrument !== instrument) return false;
      if (direction && t.direction !== direction) return false;
      if (session && t.session !== session) return false;
      if (result && t.status !== result) return false;
      if (tagId && !t.tag_ids.includes(Number(tagId))) return false;
      if (q) {
        const hay = [t.instrument, t.direction, t.session, t.status, t.setup, t.market_bias, t.entry_reason, t.exit_reason, t.mistakes, t.lessons, t.notes, t.trade_date, ...t.tag_ids.map((id) => tagNames.get(id))]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const mult = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      const av = (sortKey === "account" ? acctName(a.account_id) : a[sortKey]) as string | number | null;
      const bv = (sortKey === "account" ? acctName(b.account_id) : b[sortKey]) as string | number | null;
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls always last
      if (bv == null) return -1;
      let c = av < bv ? -1 : av > bv ? 1 : 0;
      if (c === 0 && sortKey === "trade_date") { const ae = a.entry_time ?? "", be = b.entry_time ?? ""; c = ae < be ? -1 : ae > be ? 1 : 0; }
      return c * mult;
    });
    return list;
  }, [scopedTrades, accountNames, range, settings.timezone, instrument, direction, session, result, tagId, search, sortKey, sortDir, tagNames]);

  const filtersActive = Boolean(search || instrument || direction || session || result || tagId || range.preset !== "all");
  const totalNet = rows.reduce((s, t) => s + t.net_pnl, 0);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "trade_date" || k === "net_pnl" || k === "r_multiple" ? "desc" : "asc");
    }
  }

  function clearFilters() {
    setSearch("");
    setInstrument("");
    setDirection("");
    setSession("");
    setResult("");
    setTagId("");
    setRange({ preset: "all" });
  }

  async function handleDelete(t: Trade) {
    try {
      await deleteTrade(t);
      await refresh();
      setDetailId(null);
      toast("success", "Trade deleted");
    } catch (e: any) {
      toast("error", e?.message ?? "Could not delete trade");
    }
  }

  async function handleDuplicate(t: Trade) {
    if (!user) return;
    try {
      const id = await duplicateTrade(user.id, t, todayIn(settings.timezone));
      await refresh();
      toast("success", "Trade duplicated — review and adjust the copy");
      setDetailId(null);
      setEditId(id);
      setFormOpen(true);
    } catch (e: any) {
      toast("error", e?.message ?? "Could not duplicate trade");
    }
  }

  const money = (n: number | null, sign = false) => formatMoney(n, { currency: settings.currency, sign });

  return (
    <>
      <PageHeader
        title="Trading Journal"
        description={`${scopedTrades.length} ${scopedTrades.length === 1 ? "trade" : "trades"}${scopedTrades.length !== trades.length ? ` in selected accounts (${trades.length} total)` : " recorded"}`}
        actions={
          <Button
            onClick={() => {
              setEditId(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Add Trade
          </Button>
        }
      />

      {trades.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <Card className="mb-4 space-y-3 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search setup, notes, tags, reasons…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search trades" />
              </div>
              <AccountFilter />
              <DateRangeFilter value={range} onChange={setRange} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select aria-label="Instrument" className="w-[130px]" value={instrument} onChange={(e) => setInstrument(e.target.value)}>
                <option value="">All instruments</option>
                {INSTRUMENTS.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </Select>
              <Select aria-label="Direction" className="w-[120px]" value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="">Long & Short</option>
                {DIRECTIONS.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </Select>
              <Select aria-label="Session" className="w-[130px]" value={session} onChange={(e) => setSession(e.target.value)}>
                <option value="">All sessions</option>
                {SESSIONS.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </Select>
              <Select aria-label="Result" className="w-[130px]" value={result} onChange={(e) => setResult(e.target.value)}>
                <option value="">All results</option>
                {STATUSES.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </Select>
              <Select aria-label="Tag" className="w-[190px]" value={tagId} onChange={(e) => setTagId(e.target.value)}>
                <option value="">All tags</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Sort by"
                className="w-[170px]"
                value={`${sortKey}:${sortDir}`}
                onChange={(e) => {
                  const [k, d] = e.target.value.split(":");
                  setSortKey(k as SortKey);
                  setSortDir(d as "asc" | "desc");
                }}
              >
                <option value="trade_date:desc">Newest first</option>
                <option value="trade_date:asc">Oldest first</option>
                <option value="net_pnl:desc">Best P&L</option>
                <option value="net_pnl:asc">Worst P&L</option>
                <option value="r_multiple:desc">Highest R</option>
                <option value="r_multiple:asc">Lowest R</option>
              </Select>
              {filtersActive && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X /> Clear
                </Button>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    {columns.map((c) => (
                      <th key={c.key} className={cn("px-3 py-2.5 font-medium", c.align === "right" ? "text-right" : "text-left")} aria-sort={sortKey === c.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                        <button onClick={() => toggleSort(c.key)} className={cn("inline-flex items-center gap-1 hover:text-foreground", sortKey === c.key && "text-foreground")}>
                          {c.label}
                          {sortKey === c.key && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr
                      key={t.id}
                      tabIndex={0}
                      onClick={() => setDetailId(t.id)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setDetailId(t.id))}
                      className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5">{format(parseISO(t.trade_date), "MMM d, yyyy")}</td>
                      <td className="px-3 py-2.5 font-medium">{t.instrument}</td>
                      {accounts.length > 0 && <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{acctName(t.account_id)}</td>}
                      <td className={cn("px-3 py-2.5", t.direction === "Long" ? "text-profit" : "text-loss")}>{t.direction}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{t.session}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(t.entry_price)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(t.exit_price)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(t.quantity, t.instrument === "NAS100" ? 2 : 0)}</td>
                      <td className={cn("px-3 py-2.5 text-right font-medium tabular-nums", t.net_pnl > 0 && "text-profit", t.net_pnl < 0 && "text-loss")}>{money(t.net_pnl, true)}</td>
                      <td className={cn("px-3 py-2.5 text-right tabular-nums", t.r_multiple != null && t.r_multiple > 0 && "text-profit", t.r_multiple != null && t.r_multiple < 0 && "text-loss")}>{formatR(t.r_multiple)}</td>
                      <td className="px-3 py-2.5">
                        <ResultBadge status={t.status} />
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={columns.length} className="px-3 py-12 text-center text-sm text-muted-foreground">
                        No trades match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {rows.length > 0 && (
              <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <span>
                  Showing {rows.length} of {scopedTrades.length}
                </span>
                <span>
                  Net P&amp;L of shown trades:{" "}
                  <span className={cn("font-semibold tabular-nums", totalNet > 0 && "text-profit", totalNet < 0 && "text-loss")}>{money(Math.round(totalNet * 100) / 100, true)}</span>
                </span>
              </div>
            )}
          </Card>
        </>
      )}

      <TradeFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditId(null);
        }}
        trade={editTrade}
      />
      <TradeDetailDialog
        trade={detailTrade}
        onClose={() => setDetailId(null)}
        onEdit={(t) => {
          setDetailId(null);
          setEditId(t.id);
          setFormOpen(true);
        }}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
      />
    </>
  );
}
