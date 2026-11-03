import { useMemo, useState, type FormEvent } from "react";
import { Moon, Sun } from "lucide-react";
import { useData } from "@/context/DataContext";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/common";
import { COMMON_TIMEZONES, todayIn } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Settings } from "@/types";

function allTimeZones(): string[] {
  try {
    const fn = (Intl as any).supportedValuesOf as ((k: string) => string[]) | undefined;
    if (fn) return fn("timeZone");
  } catch {
    /* fall through */
  }
  return COMMON_TIMEZONES;
}

export default function SettingsPage() {
  const { settings, updateSettings } = useData();
  const toast = useToast();
  const [form, setForm] = useState({
    starting_balance: String(settings.starting_balance),
    nas100_point_value: String(settings.nas100_point_value),
    default_commission: String(settings.default_commission),
    timezone: settings.timezone,
    theme: settings.theme,
    currency: settings.currency,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const zones = useMemo(() => {
    const all = new Set([...COMMON_TIMEZONES, ...allTimeZones()]);
    all.add(settings.timezone);
    return [...all].sort((a, b) => a.localeCompare(b));
  }, [settings.timezone]);

  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const bal = Number(form.starting_balance);
    const pv = Number(form.nas100_point_value);
    const com = form.default_commission.trim() === "" ? 0 : Number(form.default_commission);
    if (form.starting_balance.trim() === "" || !Number.isFinite(bal) || bal < 0) errs.starting_balance = "Enter 0 or more";
    if (form.nas100_point_value.trim() === "" || !Number.isFinite(pv) || pv <= 0) errs.nas100_point_value = "Must be greater than 0";
    if (!Number.isFinite(com) || com < 0) errs.default_commission = "Enter 0 or more";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: form.timezone });
    } catch {
      errs.timezone = "Invalid time zone";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const next: Settings = {
      ...settings,
      starting_balance: bal,
      nas100_point_value: pv,
      default_commission: com,
      timezone: form.timezone,
      theme: form.theme as Settings["theme"],
      currency: form.currency,
    };
    setSaving(true);
    try {
      await updateSettings(next);
      toast("success", "Settings saved");
    } catch (err: any) {
      toast("error", err?.message ?? "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Account, calculation and display preferences" />
      <form onSubmit={save} className="max-w-2xl space-y-4" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Default starting balance" error={errors.starting_balance} hint="Pre-fills new accounts, and counts for trades that have no account">
              <Input type="number" step="0.01" min="0" value={form.starting_balance} invalid={Boolean(errors.starting_balance)} onChange={(e) => set("starting_balance", e.target.value)} />
            </Field>
            <Field label="Account currency">
              <Select value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                <option value="USD">USD</option>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trade calculations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="NAS100 point value ($ per point, per 1.0 lot)" error={errors.nas100_point_value} hint="Check your broker's contract specification. Applies to trades saved from now on.">
                <Input type="number" step="any" min="0" value={form.nas100_point_value} invalid={Boolean(errors.nas100_point_value)} onChange={(e) => set("nas100_point_value", e.target.value)} />
              </Field>
              <Field label="Default commission ($ per trade)" error={errors.default_commission} hint="Pre-filled when adding a trade">
                <Input type="number" step="0.01" min="0" value={form.default_commission} invalid={Boolean(errors.default_commission)} onChange={(e) => set("default_commission", e.target.value)} />
              </Field>
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Futures are fixed: <b>NQ</b> $20/point ($5 per 0.25 tick) · <b>MNQ</b> $2/point ($0.50 per 0.25 tick). Each saved trade keeps the point value it was calculated with, so changing settings never rewrites past results.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Trading time zone" error={errors.timezone} hint={`Defines "today", "this week" and so on. Currently ${todayIn(form.timezone)} there.`}>
              <Select value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Theme</span>
              <div className="inline-flex w-fit rounded-md border p-0.5">
                {(["dark", "light"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={form.theme === t}
                    onClick={async () => {
                      set("theme", t);
                      try {
                        await updateSettings({ ...settings, theme: t });
                      } catch (err: any) {
                        set("theme", settings.theme);
                        toast("error", err?.message ?? "Could not change theme");
                      }
                    }}
                    className={cn("flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition-colors", form.theme === t ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    {t === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    {t === "dark" ? "Dark" : "Light"}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </form>
    </>
  );
}
