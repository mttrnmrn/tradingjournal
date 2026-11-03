import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { useData } from "@/context/DataContext";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/common";
import { AccountFormDialog } from "@/components/accounts/AccountFormDialog";
import { AccountStatusCard } from "@/components/accounts/AccountStatusCard";
import { accountStatus } from "@/lib/accounts";
import { todayIn } from "@/lib/dates";
import { deleteAccount } from "@/services/accounts";
import type { Account } from "@/types";

export default function AccountsPage() {
  const { accounts, trades, settings, refresh, setSelectedAccountIds } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const today = todayIn(settings.timezone);
  const statuses = useMemo(
    () => accounts.map((a) => accountStatus(a, trades.filter((t) => t.account_id === a.id), today)),
    [accounts, trades, today],
  );

  async function remove(a: Account, tradeCount: number) {
    setBusy(true);
    try {
      await deleteAccount(a.id);
      await refresh();
      setConfirmId(null);
      toast("success", tradeCount ? `Account deleted. Its ${tradeCount} trades are now Unassigned` : "Account deleted");
    } catch (e: any) {
      toast("error", e?.message ?? "Could not delete account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Track balances and loss limits for each trading account"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Add account
          </Button>
        }
      />

      {accounts.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Wallet className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-base font-semibold">No accounts yet</h2>
          <p className="max-w-md text-sm text-muted-foreground">Add an account with its starting balance and loss limits, then assign trades to it. You can filter every page by account.</p>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Add your first account
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {statuses.map((s) => (
            <div key={s.account.id} className="flex flex-col gap-2">
              <AccountStatusCard
                status={s}
                currency={settings.currency}
                actions={
                  <>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${s.account.name}`} onClick={() => (setEditing(s.account), setFormOpen(true))}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-loss hover:text-loss" aria-label={`Delete ${s.account.name}`} onClick={() => setConfirmId(s.account.id)}>
                      <Trash2 />
                    </Button>
                  </>
                }
              />
              {confirmId === s.account.id ? (
                <Card className="flex flex-wrap items-center gap-2 border-loss/40 px-3 py-2.5 text-sm">
                  <span className="flex-1 text-loss">
                    Delete “{s.account.name}”?{s.trades > 0 && ` Its ${s.trades} trades are kept as Unassigned.`}
                  </span>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirmId(null)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" size="sm" disabled={busy} onClick={() => remove(s.account, s.trades)}>
                    {busy ? "Deleting…" : "Delete"}
                  </Button>
                </Card>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedAccountIds([s.account.id]);
                    navigate("/analytics");
                  }}
                >
                  <BarChart3 /> View analytics
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <AccountFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        account={editing}
      />
    </>
  );
}
