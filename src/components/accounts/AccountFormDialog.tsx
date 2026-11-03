import { useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useToast } from "@/components/ui/toast";
import { validateAccount, type AccountInput } from "@/lib/accounts";
import type { FieldErrors } from "@/lib/calc";
import { createAccount, updateAccount } from "@/services/accounts";
import type { Account, MaxLossType } from "@/types";

interface FormState {
  name: string;
  starting_balance: string;
  max_loss_limit: string;
  max_loss_type: MaxLossType;
  daily_loss_limit: string;
}

const str = (n: number | null) => (n == null ? "" : String(n));
const opt = (s: string) => (s.trim() === "" ? null : Number(s));

export function AccountFormDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (o: boolean) => void; account?: Account | null }) {
  const { user } = useAuth();
  const { accounts, settings, refresh } = useData();
  const toast = useToast();
  const [f, setF] = useState<FormState>({ name: "", starting_balance: "", max_loss_limit: "", max_loss_type: "static", daily_loss_limit: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setF(
      account
        ? { name: account.name, starting_balance: String(account.starting_balance), max_loss_limit: str(account.max_loss_limit), max_loss_type: account.max_loss_type, daily_loss_limit: str(account.daily_loss_limit) }
        : { name: "", starting_balance: settings.starting_balance > 0 ? String(settings.starting_balance) : "", max_loss_limit: "", max_loss_type: "static", daily_loss_limit: "" },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account?.id]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const input: AccountInput = {
      name: f.name,
      starting_balance: f.starting_balance.trim() === "" ? NaN : Number(f.starting_balance),
      max_loss_limit: opt(f.max_loss_limit),
      max_loss_type: f.max_loss_type,
      daily_loss_limit: opt(f.daily_loss_limit),
    };
    const errs = validateAccount(input, accounts.filter((a) => a.id !== account?.id).map((a) => a.name));
    setErrors(errs);
    if (Object.keys(errs).length || !user) return;
    setSaving(true);
    try {
      if (account) await updateAccount(account.id, input);
      else await createAccount(user.id, input);
      await refresh();
      toast("success", account ? "Account updated" : "Account created");
      onOpenChange(false);
    } catch (err: any) {
      toast("error", err?.message ?? "Could not save account");
    } finally {
      setSaving(false);
    }
  }

  const cur = settings.currency;

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader>
            <DialogTitle>{account ? "Edit account" : "Add account"}</DialogTitle>
            <DialogDescription>Loss limits are optional. Leave a limit blank to turn it off.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Account name" error={errors.name}>
              <Input autoFocus value={f.name} invalid={Boolean(errors.name)} maxLength={60} placeholder="e.g. Prop firm 50k" onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label={`Starting balance (${cur})`} error={errors.starting_balance}>
              <Input type="number" inputMode="decimal" step="0.01" min="0" value={f.starting_balance} invalid={Boolean(errors.starting_balance)} onChange={(e) => set("starting_balance", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`Max loss limit (${cur})`} error={errors.max_loss_limit} hint="Total loss allowed on the account">
                <Input type="number" inputMode="decimal" step="0.01" min="0" placeholder="Optional" value={f.max_loss_limit} invalid={Boolean(errors.max_loss_limit)} onChange={(e) => set("max_loss_limit", e.target.value)} />
              </Field>
              <Field label="Max loss type" hint={f.max_loss_type === "static" ? "Floor = starting balance − limit" : "Floor = highest balance − limit"}>
                <Select value={f.max_loss_type} onChange={(e) => set("max_loss_type", e.target.value as MaxLossType)}>
                  <option value="static">Static</option>
                  <option value="trailing">Trailing</option>
                </Select>
              </Field>
            </div>
            <Field label={`Daily loss limit (${cur})`} error={errors.daily_loss_limit} hint="Most you may lose in one trading day">
              <Input type="number" inputMode="decimal" step="0.01" min="0" placeholder="Optional" value={f.daily_loss_limit} invalid={Boolean(errors.daily_loss_limit)} onChange={(e) => set("daily_loss_limit", e.target.value)} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : account ? "Save changes" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
