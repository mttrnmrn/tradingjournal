import { addDays, format, parseISO, startOfMonth, startOfWeek, startOfYear } from "date-fns";
import type { DateRange } from "@/types";

/** Today's date (YYYY-MM-DD) in the given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return format(now, "yyyy-MM-dd");
  }
}

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

/** Resolve a range preset to inclusive from/to date strings (null = unbounded). Weeks start on Monday. */
export function resolveRange(range: DateRange, timeZone: string, now: Date = new Date()): { from: string | null; to: string | null } {
  const today = todayIn(timeZone, now);
  const t = parseISO(today);
  switch (range.preset) {
    case "today":
      return { from: today, to: today };
    case "week": {
      const s = startOfWeek(t, { weekStartsOn: 1 });
      return { from: fmt(s), to: fmt(addDays(s, 6)) };
    }
    case "month": {
      const s = startOfMonth(t);
      const e = new Date(s.getFullYear(), s.getMonth() + 1, 0);
      return { from: fmt(s), to: fmt(e) };
    }
    case "year": {
      const s = startOfYear(t);
      return { from: fmt(s), to: `${s.getFullYear()}-12-31` };
    }
    case "custom":
      return { from: range.from || null, to: range.to || null };
    default:
      return { from: null, to: null };
  }
}

export function filterByRange<T extends { trade_date: string }>(trades: T[], range: DateRange, timeZone: string): T[] {
  const { from, to } = resolveRange(range, timeZone);
  return trades.filter((t) => (!from || t.trade_date >= from) && (!to || t.trade_date <= to));
}

export const RANGE_LABELS: Record<DateRange["preset"], string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year",
  all: "All Time",
  custom: "Custom Range",
};

export const COMMON_TIMEZONES = [
  "Asia/Manila",
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Dubai",
  "Australia/Sydney",
];
