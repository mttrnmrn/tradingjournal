import type { Direction, Instrument, Settings, TradeInput, TradeStatus } from "@/types";

/** Contract specifications. NAS100 is broker specific and comes from Settings. */
export const FUTURES_SPECS = {
  NQ: { tickSize: 0.25, tickValue: 5, pointValue: 20 },
  MNQ: { tickSize: 0.25, tickValue: 0.5, pointValue: 2 },
} as const;

export function pointValueFor(instrument: Instrument, settings: Pick<Settings, "nas100_point_value">): number {
  if (instrument === "NQ") return FUTURES_SPECS.NQ.pointValue;
  if (instrument === "MNQ") return FUTURES_SPECS.MNQ.pointValue;
  return settings.nas100_point_value;
}

export function isFutures(i: Instrument): i is "NQ" | "MNQ" {
  return i === "NQ" || i === "MNQ";
}

/** Round to cents without floating point drift. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
export function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export function grossPnl(direction: Direction, entry: number, exit: number, pointValue: number, qty: number): number {
  const points = direction === "Long" ? exit - entry : entry - exit;
  return round2(points * pointValue * qty);
}

export function netPnl(gross: number, commission: number, fees: number): number {
  return round2(gross - commission - fees);
}

/** "HH:MM" or "HH:MM:SS" -> minutes since midnight */
function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Holding duration in minutes. If exit is earlier than entry the trade is assumed to roll past midnight. */
export function holdingMinutes(entryTime: string | null, exitTime: string | null): number {
  if (!entryTime || !exitTime) return 0;
  const diff = toMinutes(exitTime) - toMinutes(entryTime);
  return diff >= 0 ? diff : diff + 24 * 60;
}

export function formatDuration(minutes: number): string {
  if (!isFinite(minutes) || minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function statusFromNet(net: number): TradeStatus {
  if (net > 0) return "Win";
  if (net < 0) return "Loss";
  return "Breakeven";
}

export interface Computed {
  pointValue: number;
  grossPnl: number;
  netPnl: number;
  /** $ risked, from the explicit risk amount or derived from entry/stop */
  riskDollars: number | null;
  riskReward: number | null;
  rMultiple: number | null;
  status: TradeStatus;
  holdingMinutes: number;
  /** true when entry or exit price is blank, so P&L cannot be derived from prices */
  pricesMissing: boolean;
}

export interface Calculated extends Computed {
  /** calculated values before applying user overrides */
  auto: { grossPnl: number; netPnl: number; rMultiple: number | null; status: TradeStatus };
  pnlOverridden: boolean;
  rOverridden: boolean;
  statusOverridden: boolean;
}

/**
 * Core calculation. Overrides (if present) replace the calculated gross P&L, R-multiple and status.
 * Net P&L is always recomputed from the (possibly overridden) gross so fees stay accounted for.
 */
export function calculateTrade(t: TradeInput, settings: Pick<Settings, "nas100_point_value">): Calculated {
  const pointValue = pointValueFor(t.instrument, settings);
  const pricesMissing = t.entry_price == null || t.exit_price == null;
  const autoGross = t.entry_price != null && t.exit_price != null ? grossPnl(t.direction, t.entry_price, t.exit_price, pointValue, t.quantity) : 0;
  const autoNet = netPnl(autoGross, t.commission, t.other_fees);

  const riskPoints = t.stop_loss != null && t.entry_price != null ? Math.abs(t.entry_price - t.stop_loss) : null;
  const derivedRisk = riskPoints != null ? round2(riskPoints * pointValue * t.quantity) : null;
  const riskDollars = t.risk_amount != null && t.risk_amount > 0 ? t.risk_amount : derivedRisk && derivedRisk > 0 ? derivedRisk : null;

  let riskReward: number | null = null;
  if (t.stop_loss != null && t.take_profit != null && t.entry_price != null && riskPoints && riskPoints > 0) {
    riskReward = round3(Math.abs(t.take_profit - t.entry_price) / riskPoints);
  }

  const pnlOverridden = t.override_gross_pnl != null;
  const gross = pnlOverridden ? round2(t.override_gross_pnl as number) : autoGross;
  const net = netPnl(gross, t.commission, t.other_fees);

  const autoR = riskDollars ? round3(autoNet / riskDollars) : null;
  const rOverridden = t.override_r_multiple != null;
  const r = rOverridden ? round3(t.override_r_multiple as number) : riskDollars ? round3(net / riskDollars) : null;

  const autoStatus = statusFromNet(autoNet);
  const statusOverridden = t.override_status != null;
  const status = statusOverridden ? (t.override_status as TradeStatus) : statusFromNet(net);

  return {
    pointValue,
    grossPnl: gross,
    netPnl: net,
    riskDollars,
    riskReward,
    rMultiple: r,
    status,
    holdingMinutes: holdingMinutes(t.entry_time, t.exit_time),
    pricesMissing,
    auto: { grossPnl: autoGross, netPnl: autoNet, rMultiple: autoR, status: autoStatus },
    pnlOverridden,
    rOverridden,
    statusOverridden,
  };
}

// ---------------------------------------------------------------- validation

export type FieldErrors = Partial<Record<string, string>>;

const isMultipleOfTick = (price: number, tick: number) => Math.abs(price / tick - Math.round(price / tick)) < 1e-6;

export function validateTrade(t: TradeInput): FieldErrors {
  const e: FieldErrors = {};
  if (!t.trade_date || !/^\d{4}-\d{2}-\d{2}$/.test(t.trade_date)) e.trade_date = "Trade date is required";
  const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

  // entry/exit time and entry/exit price are optional, but must be valid when given
  if (t.entry_price != null && (!num(t.entry_price) || t.entry_price <= 0)) e.entry_price = "Enter a price greater than 0";
  if (t.exit_price != null && (!num(t.exit_price) || t.exit_price <= 0)) e.exit_price = "Enter a price greater than 0";
  if (!num(t.quantity) || t.quantity <= 0) {
    e.quantity = "Quantity must be greater than 0";
  } else if (isFutures(t.instrument) && !Number.isInteger(t.quantity)) {
    e.quantity = `${t.instrument} trades whole contracts only`;
  } else if (!isFutures(t.instrument) && Math.abs(t.quantity * 100 - Math.round(t.quantity * 100)) > 1e-6) {
    e.quantity = "Lots support up to 2 decimals (e.g. 0.01)";
  }

  if (isFutures(t.instrument)) {
    const tick = FUTURES_SPECS[t.instrument].tickSize;
    const chk = (k: "entry_price" | "exit_price" | "stop_loss" | "take_profit", v: number | null) => {
      if (num(v) && v > 0 && !isMultipleOfTick(v, tick) && !e[k]) e[k] = `Must be a multiple of ${tick} (tick size)`;
    };
    chk("entry_price", t.entry_price);
    chk("exit_price", t.exit_price);
    chk("stop_loss", t.stop_loss);
    chk("take_profit", t.take_profit);
  }

  if (t.stop_loss != null) {
    if (!num(t.stop_loss) || t.stop_loss <= 0) e.stop_loss = "Enter a price greater than 0";
    else if (num(t.entry_price) && t.stop_loss === t.entry_price) e.stop_loss = "Stop loss cannot equal entry";
    else if (num(t.entry_price) && t.direction === "Long" && t.stop_loss > t.entry_price) e.stop_loss = "For a long, stop must be below entry";
    else if (num(t.entry_price) && t.direction === "Short" && t.stop_loss < t.entry_price) e.stop_loss = "For a short, stop must be above entry";
  }
  if (t.take_profit != null) {
    if (!num(t.take_profit) || t.take_profit <= 0) e.take_profit = "Enter a price greater than 0";
    else if (num(t.entry_price) && t.take_profit === t.entry_price) e.take_profit = "Take profit cannot equal entry";
    else if (num(t.entry_price) && t.direction === "Long" && t.take_profit < t.entry_price) e.take_profit = "For a long, target must be above entry";
    else if (num(t.entry_price) && t.direction === "Short" && t.take_profit > t.entry_price) e.take_profit = "For a short, target must be below entry";
  }
  if (t.risk_amount != null && (!num(t.risk_amount) || t.risk_amount < 0)) e.risk_amount = "Risk must be 0 or more";
  if (!num(t.commission) || t.commission < 0) e.commission = "Commission must be 0 or more";
  if (!num(t.other_fees) || t.other_fees < 0) e.other_fees = "Fees must be 0 or more";
  if (t.override_gross_pnl != null && !num(t.override_gross_pnl)) e.override_gross_pnl = "Enter a valid number";
  if (t.override_r_multiple != null && !num(t.override_r_multiple)) e.override_r_multiple = "Enter a valid number";
  return e;
}
