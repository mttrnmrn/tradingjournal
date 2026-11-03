import { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { filterByRange, resolveRange } from "@/lib/dates";
import type { DateRange } from "@/types";

/** Trades filtered by the selected accounts AND a date-range preset (in the user's trading time zone). */
export function useRangedTrades(initial: DateRange = { preset: "all" }) {
  const { scopedTrades, settings } = useData();
  const [range, setRange] = useState<DateRange>(initial);
  const filtered = useMemo(() => filterByRange(scopedTrades, range, settings.timezone), [scopedTrades, range, settings.timezone]);
  const bounds = useMemo(() => resolveRange(range, settings.timezone), [range, settings.timezone]);
  return { range, setRange, filtered, bounds };
}
