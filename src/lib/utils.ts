import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(n: number | null | undefined, opts: { sign?: boolean; currency?: string; decimals?: number } = {}): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const { sign = false, currency = "USD", decimals = 2 } = opts;
  const abs = Math.abs(n);
  let body: string;
  try {
    body = new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(abs);
  } catch {
    body = "$" + abs.toFixed(decimals);
  }
  if (n < 0 && abs >= 0.005) return "-" + body;
  if (sign && n > 0) return "+" + body;
  return body;
}

export function formatNumber(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatPct(n: number | null | undefined, decimals = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(decimals) + "%";
}

export function formatR(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return (n > 0 ? "+" : "") + n.toFixed(2) + "R";
}

export function formatPF(pf: number | null, infinite: boolean): string {
  if (infinite) return "∞";
  if (pf == null) return "—";
  return pf.toFixed(2);
}

/** Tailwind text class for a P&L value. */
export function pnlColor(n: number | null | undefined): string {
  if (n == null || n === 0) return "text-foreground";
  return n > 0 ? "text-profit" : "text-loss";
}

export function hhmm(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "—";
}
