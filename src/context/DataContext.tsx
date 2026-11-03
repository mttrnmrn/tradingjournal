import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchTrades } from "@/services/trades";
import { fetchTags } from "@/services/tags";
import { fetchAccounts } from "@/services/accounts";
import { fetchSettings, saveSettings as persistSettings } from "@/services/settings";
import { scopeAccounts, scopedStartingBalance, scopeTrades } from "@/lib/accounts";
import { DEFAULT_SETTINGS, UNASSIGNED, type Account, type Settings, type Tag, type Trade } from "@/types";

interface DataValue {
  /** every trade, regardless of account filter */
  trades: Trade[];
  /** trades after applying the account filter (use this for stats, charts, lists) */
  scopedTrades: Trade[];
  tags: Tag[];
  accounts: Account[];
  /** accounts included by the current filter */
  scopeAccounts: Account[];
  /** selected account ids (and "none" for unassigned). Empty = all accounts. */
  selectedAccountIds: string[];
  setSelectedAccountIds: (ids: string[]) => void;
  /** starting balance of the accounts in scope */
  scopedStartingBalance: number;
  settings: Settings;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateSettings: (s: Settings) => Promise<void>;
}

const DataContext = createContext<DataValue | null>(null);
const SELECTION_KEY = "tj-accounts";

function applyTheme(theme: "dark" | "light") {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("tj-theme", theme);
  } catch {
    /* ignore */
  }
}

function loadSelection(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SELECTION_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [selected, setSelected] = useState<string[]>(loadSelection);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [t, tg, ac] = await Promise.all([fetchTrades(), fetchTags(), fetchAccounts()]);
      setTrades(t);
      setTags(tg);
      setAccounts(ac);
      setAccountsLoaded(true);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load data");
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setTrades([]);
      setAccounts([]);
      setAccountsLoaded(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const s = await fetchSettings(user.id);
        if (cancelled) return;
        setSettings(s);
        applyTheme(s.theme);
        await refresh();
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refresh]);

  // drop selected accounts that no longer exist (e.g. after deleting one)
  useEffect(() => {
    if (!accountsLoaded) return;
    setSelected((sel) => {
      const next = sel.filter((id) => id === UNASSIGNED || accounts.some((a) => a.id === id));
      return next.length === sel.length ? sel : next;
    });
  }, [accounts, accountsLoaded]);

  useEffect(() => {
    try {
      localStorage.setItem(SELECTION_KEY, JSON.stringify(selected));
    } catch {
      /* ignore */
    }
  }, [selected]);

  const updateSettings = useCallback(
    async (s: Settings) => {
      if (!user) return;
      const prev = settings;
      // apply immediately so the UI responds, then persist
      setSettings(s);
      applyTheme(s.theme);
      try {
        await persistSettings(user.id, s);
      } catch (e) {
        setSettings(prev);
        applyTheme(prev.theme);
        throw e;
      }
    },
    [user, settings],
  );

  const scopedTrades = useMemo(() => scopeTrades(trades, selected), [trades, selected]);
  const scopedAccounts = useMemo(() => scopeAccounts(accounts, selected), [accounts, selected]);
  const startBalance = useMemo(
    () => scopedStartingBalance(accounts, trades, selected, settings.starting_balance),
    [accounts, trades, selected, settings.starting_balance],
  );

  const value = useMemo<DataValue>(
    () => ({
      trades,
      scopedTrades,
      tags,
      accounts,
      scopeAccounts: scopedAccounts,
      selectedAccountIds: selected,
      setSelectedAccountIds: setSelected,
      scopedStartingBalance: startBalance,
      settings,
      loading,
      error,
      refresh,
      updateSettings,
    }),
    [trades, scopedTrades, tags, accounts, scopedAccounts, selected, startBalance, settings, loading, error, refresh, updateSettings],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
