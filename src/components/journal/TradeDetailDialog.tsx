import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge, ResultBadge } from "@/components/ui/badge";
import { Row } from "@/components/common";
import { useData } from "@/context/DataContext";
import { formatDuration } from "@/lib/calc";
import { formatMoney, formatNumber, formatR, hhmm } from "@/lib/utils";
import type { Trade } from "@/types";
import { ScreenshotView } from "./ScreenshotSlot";

function Text({ title, value }: { title: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{title}</div>
      <p className="whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}

export function TradeDetailDialog({
  trade,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  trade: Trade | null;
  onClose: () => void;
  onEdit: (t: Trade) => void;
  onDuplicate: (t: Trade) => Promise<void>;
  onDelete: (t: Trade) => Promise<void>;
}) {
  const { tags, settings, accounts } = useData();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const cur = settings.currency;
  const money = (n: number | null, sign = false) => formatMoney(n, { currency: cur, sign });

  return (
    <Dialog
      open={Boolean(trade)}
      onOpenChange={(o) => {
        if (!o && !busy) {
          setConfirming(false);
          onClose();
        }
      }}
    >
      <DialogContent wide className="h-[92vh]">
        {trade && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {trade.instrument} {trade.direction}
                <ResultBadge status={trade.status} />
                {(trade.pnl_overridden || trade.r_overridden || trade.status_overridden) && <Badge className="text-muted-foreground">Manual override</Badge>}
              </DialogTitle>
              <DialogDescription>
                {format(parseISO(trade.trade_date), "EEEE, MMM d, yyyy")} · {hhmm(trade.entry_time)} – {hhmm(trade.exit_time)} · {trade.session} session
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="flex-1 space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { l: "Net P&L", v: money(trade.net_pnl, true), t: trade.net_pnl },
                  { l: "Gross P&L", v: money(trade.gross_pnl, true), t: trade.gross_pnl },
                  { l: "R-multiple", v: formatR(trade.r_multiple), t: trade.r_multiple ?? 0 },
                  { l: "Planned R:R", v: trade.risk_reward != null ? `1 : ${trade.risk_reward.toFixed(2)}` : "—", t: 0 },
                ].map((x) => (
                  <div key={x.l} className="rounded-lg border px-3 py-2">
                    <div className="text-xs text-muted-foreground">{x.l}</div>
                    <div className={`text-lg font-semibold tabular-nums ${x.t > 0 ? "text-profit" : x.t < 0 ? "text-loss" : ""}`}>{x.v}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-x-10 md:grid-cols-2">
                <div>
                  <Row label="Entry price" value={formatNumber(trade.entry_price)} />
                  <Row label="Exit price" value={formatNumber(trade.exit_price)} />
                  <Row label="Stop loss" value={trade.stop_loss != null ? formatNumber(trade.stop_loss) : "—"} />
                  <Row label="Take profit" value={trade.take_profit != null ? formatNumber(trade.take_profit) : "—"} />
                  <Row label={trade.instrument === "NAS100" ? "Lots" : "Contracts"} value={formatNumber(trade.quantity, trade.instrument === "NAS100" ? 2 : 0)} />
                </div>
                <div>
                  <Row label="Point value used" value={`${money(trade.point_value)} / pt`} />
                  <Row label="Risk amount" value={trade.risk_amount != null ? money(trade.risk_amount) : "—"} />
                  <Row label="Commission" value={money(trade.commission)} />
                  <Row label="Swap / other fees" value={money(trade.other_fees)} />
                  <Row label="Holding time" value={formatDuration(trade.holding_minutes)} />
                  <Row label="Account" value={accounts.find((a) => a.id === trade.account_id)?.name ?? "Unassigned"} />
                </div>
              </div>

              {trade.tag_ids.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Tags</div>
                  <div className="flex flex-wrap gap-2">
                    {tags
                      .filter((t) => trade.tag_ids.includes(t.id))
                      .map((t) => (
                        <Badge key={t.id} className="border-primary/30 bg-primary/10 text-primary">
                          {t.name}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <ScreenshotView title="Before entry" shot={trade.screenshots.find((s) => s.kind === "before")} />
                <ScreenshotView title="After exit" shot={trade.screenshots.find((s) => s.kind === "after")} />
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 text-sm">
                  {trade.setup && <Badge>Setup: {trade.setup}</Badge>}
                  {trade.market_bias && <Badge>Bias: {trade.market_bias}</Badge>}
                </div>
                <Text title="Entry reason" value={trade.entry_reason} />
                <Text title="Exit reason" value={trade.exit_reason} />
                <Text title="Mistakes made" value={trade.mistakes} />
                <Text title="Lessons learned" value={trade.lessons} />
                <Text title="Personal notes" value={trade.notes} />
              </div>
            </DialogBody>

            <DialogFooter className="sm:justify-between">
              {confirming ? (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <span className="text-sm text-loss">Delete this trade and its screenshots permanently?</span>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await onDelete(trade);
                        setConfirming(false);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? "Deleting…" : "Yes, delete"}
                  </Button>
                </div>
              ) : (
                <>
                  <Button variant="ghost" className="text-loss hover:text-loss" onClick={() => setConfirming(true)}>
                    <Trash2 /> Delete
                  </Button>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await onDuplicate(trade);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Copy /> Duplicate
                    </Button>
                    <Button onClick={() => onEdit(trade)}>
                      <Pencil /> Edit
                    </Button>
                  </div>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
