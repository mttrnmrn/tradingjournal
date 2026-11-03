import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useToast } from "@/components/ui/toast";
import { calculateTrade, formatDuration, isFutures, validateTrade, type FieldErrors } from "@/lib/calc";
import { todayIn } from "@/lib/dates";
import { cn, formatMoney, formatR } from "@/lib/utils";
import { createTrade, updateTrade, type ScreenshotChanges } from "@/services/trades";
import { BIASES, DIRECTIONS, INSTRUMENTS, SESSIONS, STATUSES, UNASSIGNED, type Instrument, type Trade, type TradeInput, type TradeStatus } from "@/types";
import { ScreenshotSlot } from "./ScreenshotSlot";

interface FormState {
  account_id: string;
  trade_date: string;
  entry_time: string;
  exit_time: string;
  instrument: Instrument;
  direction: (typeof DIRECTIONS)[number];
  session: (typeof SESSIONS)[number];
  entry_price: string;
  exit_price: string;
  stop_loss: string;
  take_profit: string;
  quantity: string;
  risk_amount: string;
  setup: string;
  market_bias: string;
  entry_reason: string;
  exit_reason: string;
  mistakes: string;
  lessons: string;
  notes: string;
  tag_ids: number[];
  override_gross_pnl: string;
  override_r_multiple: string;
  override_status: string;
}

const str = (n: number | null | undefined) => (n == null ? "" : String(n));

/** "" -> null, otherwise a number (NaN is kept so validation can flag it). */
function parseOpt(s: string): number | null {
  const t = s.trim();
  return t === "" ? null : Number(t);
}
function parseReq(s: string): number {
  const t = s.trim();
  return t === "" ? NaN : Number(t);
}

function toInput(f: FormState): TradeInput {
  return {
    account_id: f.account_id || null,
    trade_date: f.trade_date,
    entry_time: f.entry_time || null,
    exit_time: f.exit_time || null,
    instrument: f.instrument,
    direction: f.direction,
    session: f.session,
    entry_price: parseOpt(f.entry_price),
    exit_price: parseOpt(f.exit_price),
    stop_loss: parseOpt(f.stop_loss),
    take_profit: parseOpt(f.take_profit),
    quantity: parseReq(f.quantity),
    risk_amount: parseOpt(f.risk_amount),
    // fees are no longer entered: the P&L you type is the final result
    commission: 0,
    other_fees: 0,
    setup: f.setup,
    market_bias: (f.market_bias || null) as TradeInput["market_bias"],
    entry_reason: f.entry_reason,
    exit_reason: f.exit_reason,
    mistakes: f.mistakes,
    lessons: f.lessons,
    notes: f.notes,
    tag_ids: f.tag_ids,
    override_gross_pnl: parseOpt(f.override_gross_pnl),
    override_r_multiple: parseOpt(f.override_r_multiple),
    override_status: (f.override_status || null) as TradeStatus | null,
  };
}

export function TradeFormDialog({ open, onOpenChange, trade }: { open: boolean; onOpenChange: (o: boolean) => void; trade?: Trade | null }) {
  const { user } = useAuth();
  const { settings, tags, accounts, selectedAccountIds, refresh } = useData();
  const toast = useToast();
  const editing = Boolean(trade);

  /** Account pre-selected for a new trade: the single filtered account, else the last one used, else the first. */
  const defaultAccountId = (): string => {
    if (accounts.length === 0) return "";
    if (selectedAccountIds.length === 1 && selectedAccountIds[0] !== UNASSIGNED && accounts.some((a) => a.id === selectedAccountIds[0])) return selectedAccountIds[0];
    try {
      const last = localStorage.getItem("tj-last-account");
      if (last && accounts.some((a) => a.id === last)) return last;
    } catch {
      /* ignore */
    }
    return accounts[0].id;
  };

  const blank = (): FormState => ({
    account_id: defaultAccountId(),
    trade_date: todayIn(settings.timezone),
    entry_time: "",
    exit_time: "",
    instrument: "NQ",
    direction: "Long",
    session: "New York",
    entry_price: "",
    exit_price: "",
    stop_loss: "",
    take_profit: "",
    quantity: "1",
    risk_amount: "",
    setup: "",
    market_bias: "",
    entry_reason: "",
    exit_reason: "",
    mistakes: "",
    lessons: "",
    notes: "",
    tag_ids: [],
    override_gross_pnl: "",
    override_r_multiple: "",
    override_status: "",
  });

  const fromTrade = (t: Trade): FormState => ({
    account_id: t.account_id ?? "",
    trade_date: t.trade_date,
    entry_time: t.entry_time ? t.entry_time.slice(0, 5) : "",
    exit_time: t.exit_time ? t.exit_time.slice(0, 5) : "",
    instrument: t.instrument,
    direction: t.direction,
    session: t.session,
    entry_price: str(t.entry_price),
    exit_price: str(t.exit_price),
    stop_loss: str(t.stop_loss),
    take_profit: str(t.take_profit),
    quantity: str(t.quantity),
    risk_amount: str(t.risk_amount),
    setup: t.setup ?? "",
    market_bias: t.market_bias ?? "",
    entry_reason: t.entry_reason ?? "",
    exit_reason: t.exit_reason ?? "",
    mistakes: t.mistakes ?? "",
    lessons: t.lessons ?? "",
    notes: t.notes ?? "",
    tag_ids: t.tag_ids,
    // older trades with fees keep their net result so editing never changes it silently
    override_gross_pnl: t.pnl_overridden || t.commission || t.other_fees ? str(t.net_pnl) : "",
    override_r_multiple: t.r_overridden ? str(t.r_multiple) : "",
    override_status: t.status_overridden ? t.status : "",
  });

  const [form, setForm] = useState<FormState>(blank);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [showOverrides, setShowOverrides] = useState(false);
  const [before, setBefore] = useState<File | null>(null);
  const [after, setAfter] = useState<File | null>(null);
  const [removeBefore, setRemoveBefore] = useState(false);
  const [removeAfter, setRemoveAfter] = useState(false);

  // reset whenever the dialog opens
  useEffect(() => {
    if (!open) return;
    const f = trade ? fromTrade(trade) : blank();
    setForm(f);
    setErrors({});
    setBefore(null);
    setAfter(null);
    setRemoveBefore(false);
    setRemoveAfter(false);
    setShowOverrides(Boolean(trade && (trade.pnl_overridden || trade.r_overridden || trade.status_overridden)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trade?.id]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k as string] ? { ...e, [k]: undefined } : e));
  };

  const input = useMemo(() => toInput(form), [form]);
  const previewValid = useMemo(() => {
    const n = (v: number | null) => v == null || Number.isFinite(v);
    return n(input.entry_price) && n(input.exit_price) && Number.isFinite(input.quantity) && input.quantity > 0 && n(input.stop_loss) && n(input.take_profit) && n(input.risk_amount) && n(input.override_gross_pnl);
  }, [input]);
  const calc = useMemo(() => (previewValid ? calculateTrade(input, settings) : null), [previewValid, input, settings]);

  const futures = isFutures(form.instrument);
  const cur = settings.currency;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validateTrade(input);
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast("error", "Please fix the highlighted fields");
      if (errs.override_r_multiple) setShowOverrides(true);
      return;
    }
    if (!user) return;
    if (input.instrument === "NAS100" && !(settings.nas100_point_value > 0)) {
      toast("error", "Set your NAS100 point value in Settings first");
      return;
    }
    const shots: ScreenshotChanges = {
      before: before ? { file: before } : removeBefore ? { remove: true } : undefined,
      after: after ? { file: after } : removeAfter ? { remove: true } : undefined,
    };
    setSaving(true);
    try {
      if (trade) await updateTrade(user.id, trade, input, settings, shots);
      else await createTrade(user.id, input, settings, shots);
      await refresh();
      try {
        if (form.account_id) localStorage.setItem("tj-last-account", form.account_id);
      } catch {
        /* ignore */
      }
      toast("success", trade ? "Trade updated" : "Trade saved");
      onOpenChange(false);
    } catch (err: any) {
      toast("error", err?.message ?? "Could not save trade");
    } finally {
      setSaving(false);
    }
  }

  const num = (k: keyof FormState, label: string, opts: { step?: string; placeholder?: string; hint?: string } = {}) => (
    <Field label={label} error={errors[k as string]} hint={opts.hint}>
      <Input
        type="number"
        inputMode="decimal"
        step={opts.step ?? "any"}
        placeholder={opts.placeholder}
        value={form[k] as string}
        invalid={Boolean(errors[k as string])}
        onChange={(e) => set(k, e.target.value as never)}
      />
    </Field>
  );

  const sectionTitle = (t: string) => <h3 className="mb-3 mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t}</h3>;

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent wide className="h-[92vh]">
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Trade" : "Add Trade"}</DialogTitle>
            <DialogDescription>P&amp;L, R-multiple and result are calculated automatically from the instrument.</DialogDescription>
          </DialogHeader>

          <DialogBody className="flex-1 space-y-6">
            <section>
              {sectionTitle("Trade information")}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {accounts.length > 0 && (
                  <Field label="Account">
                    <Select value={form.account_id} onChange={(e) => set("account_id", e.target.value)}>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                      <option value="">Unassigned</option>
                    </Select>
                  </Field>
                )}
                <Field label="Trade date" error={errors.trade_date}>
                  <Input type="date" value={form.trade_date} invalid={Boolean(errors.trade_date)} onChange={(e) => set("trade_date", e.target.value)} />
                </Field>
                <Field label="Entry time (optional)" error={errors.entry_time}>
                  <Input type="time" value={form.entry_time} invalid={Boolean(errors.entry_time)} onChange={(e) => set("entry_time", e.target.value)} />
                </Field>
                <Field label="Exit time (optional)" error={errors.exit_time}>
                  <Input type="time" value={form.exit_time} invalid={Boolean(errors.exit_time)} onChange={(e) => set("exit_time", e.target.value)} />
                </Field>
                <Field label="Instrument">
                  <Select value={form.instrument} onChange={(e) => set("instrument", e.target.value as Instrument)}>
                    {INSTRUMENTS.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Direction">
                  <Select value={form.direction} onChange={(e) => set("direction", e.target.value as FormState["direction"])}>
                    {DIRECTIONS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Session">
                  <Select value={form.session} onChange={(e) => set("session", e.target.value as FormState["session"])}>
                    {SESSIONS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Market bias">
                  <Select value={form.market_bias} onChange={(e) => set("market_bias", e.target.value)}>
                    <option value="">—</option>
                    {BIASES.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Trade status" hint={calc?.statusOverridden ? "Manually set" : "Auto from net P&L"}>
                  <Select
                    value={form.override_status}
                    onChange={(e) => set("override_status", e.target.value)}
                  >
                    <option value="">{calc ? `Auto (${calc.auto.status})` : "Auto"}</option>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </section>

            <section>
              {sectionTitle("Trade execution")}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {num("entry_price", "Entry price (optional)", { step: futures ? "0.25" : "any" })}
                {num("exit_price", "Exit price (optional)", { step: futures ? "0.25" : "any" })}
                {num("stop_loss", "Stop loss", { step: futures ? "0.25" : "any" })}
                {num("take_profit", "Take profit", { step: futures ? "0.25" : "any" })}
                {num("quantity", futures ? "Contracts" : "Lots", { step: futures ? "1" : "0.01", hint: futures ? "Whole contracts" : "Fractional lots allowed" })}
                {num("risk_amount", `Risk amount (${cur})`, { step: "0.01", hint: "Blank = derived from stop loss" })}
                {num("override_gross_pnl", `P&L (${cur})`, { step: "any", placeholder: "e.g. 250 or -120", hint: calc && !calc.pricesMissing ? `Blank = calculated from prices (${formatMoney(calc.auto.grossPnl, { currency: cur, sign: true })})` : "Your final result, negative for a loss" })}
              </div>

              {calc?.pricesMissing && !calc.pnlOverridden && (
                <p className="mt-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-foreground">
                  Without both entry and exit prices, P&amp;L can't be calculated and will save as {formatMoney(0, { currency: cur })}. Type your result in the P&amp;L field above.
                </p>
              )}

              <div className="mt-4 rounded-lg border bg-muted/30 p-3">
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                  <Calc label="Point value" value={calc ? `${formatMoney(calc.pointValue, { currency: cur })}/pt` : "—"} />
                  <Calc label="P&L" value={calc ? formatMoney(calc.netPnl, { currency: cur, sign: true }) : "—"} tone={calc?.netPnl} strong />
                  <Calc label="R-multiple" value={calc ? formatR(calc.rMultiple) : "—"} tone={calc?.rMultiple} />
                  <Calc label="Planned R:R" value={calc?.riskReward != null ? `1 : ${calc.riskReward.toFixed(2)}` : "—"} />
                  <Calc label="Holding" value={calc ? formatDuration(calc.holdingMinutes) : "—"} />
                </div>
              </div>

              <button type="button" className="mt-3 text-xs font-medium text-primary hover:underline" onClick={() => setShowOverrides((s) => !s)}>
                {showOverrides ? "Hide R-multiple override" : "Override R-multiple…"}
              </button>
              {showOverrides && (
                <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-2">
                  <Field label="R-multiple override" error={errors.override_r_multiple} hint={calc ? `Calculated: ${formatR(calc.auto.rMultiple)}` : undefined}>
                    <Input type="number" step="any" placeholder="Leave blank to use calculated" value={form.override_r_multiple} onChange={(e) => set("override_r_multiple", e.target.value)} />
                  </Field>
                </div>
              )}
            </section>

            <section>
              {sectionTitle("ICT / price action tags")}
              <div className="flex flex-wrap gap-2">
                {tags.length === 0 && <p className="text-sm text-muted-foreground">No tags found. Make sure the SQL schema was run (it seeds the tag list).</p>}
                {tags.map((t) => {
                  const on = form.tag_ids.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("tag_ids", on ? form.tag_ids.filter((x) => x !== t.id) : [...form.tag_ids, t.id])}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        on ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground hover:border-input hover:text-foreground",
                      )}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              {sectionTitle("Trade analysis")}
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Trading setup" className="md:col-span-2">
                  <Input value={form.setup} onChange={(e) => set("setup", e.target.value)} placeholder="e.g. London sweep → NY FVG entry" maxLength={200} />
                </Field>
                <Field label="Entry reason">
                  <Textarea value={form.entry_reason} onChange={(e) => set("entry_reason", e.target.value)} />
                </Field>
                <Field label="Exit reason">
                  <Textarea value={form.exit_reason} onChange={(e) => set("exit_reason", e.target.value)} />
                </Field>
                <Field label="Mistakes made">
                  <Textarea value={form.mistakes} onChange={(e) => set("mistakes", e.target.value)} />
                </Field>
                <Field label="Lessons learned">
                  <Textarea value={form.lessons} onChange={(e) => set("lessons", e.target.value)} />
                </Field>
                <Field label="Personal notes" className="md:col-span-2">
                  <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
                </Field>
              </div>
            </section>

            <section>
              {sectionTitle("Screenshots")}
              <div className="grid gap-4 md:grid-cols-2">
                <ScreenshotSlot
                  title="Before entry"
                  existing={trade?.screenshots.find((s) => s.kind === "before")}
                  file={before}
                  removed={removeBefore}
                  onFile={(f) => {
                    setBefore(f);
                    setRemoveBefore(false);
                  }}
                  onRemove={() => {
                    setBefore(null);
                    setRemoveBefore(true);
                  }}
                  onError={(m) => toast("error", m)}
                />
                <ScreenshotSlot
                  title="After exit"
                  existing={trade?.screenshots.find((s) => s.kind === "after")}
                  file={after}
                  removed={removeAfter}
                  onFile={(f) => {
                    setAfter(f);
                    setRemoveAfter(false);
                  }}
                  onRemove={() => {
                    setAfter(null);
                    setRemoveAfter(true);
                  }}
                  onError={(m) => toast("error", m)}
                />
              </div>
            </section>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Save trade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Calc({ label, value, tone, strong }: { label: string; value: string; tone?: number | null; strong?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("tabular-nums", strong ? "text-base font-semibold" : "font-medium", tone != null && tone > 0 && "text-profit", tone != null && tone < 0 && "text-loss")}>{value}</div>
    </div>
  );
}
