export const INSTRUMENTS = ["NQ", "MNQ", "NAS100"] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

export const DIRECTIONS = ["Long", "Short"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const SESSIONS = ["Asian", "London", "New York"] as const;
export type Session = (typeof SESSIONS)[number];

export const STATUSES = ["Win", "Loss", "Breakeven"] as const;
export type TradeStatus = (typeof STATUSES)[number];

export const BIASES = ["Bullish", "Bearish", "Neutral"] as const;
export type MarketBias = (typeof BIASES)[number];

export type ShotKind = "before" | "after";

export type MaxLossType = "static" | "trailing";

/** Token used in account filters for trades that have no account. */
export const UNASSIGNED = "none";

export interface Account {
  id: string;
  user_id: string;
  name: string;
  starting_balance: number;
  max_loss_limit: number | null; // $ (optional)
  max_loss_type: MaxLossType;
  daily_loss_limit: number | null; // $ (optional)
  created_at: string;
}

export interface Tag {
  id: number;
  name: string;
  sort_order: number;
}

export interface Settings {
  user_id?: string;
  starting_balance: number;
  currency: string;
  nas100_point_value: number;
  default_commission: number;
  timezone: string;
  theme: "dark" | "light";
}

export const DEFAULT_SETTINGS: Settings = {
  starting_balance: 0,
  currency: "USD",
  nas100_point_value: 1,
  default_commission: 0,
  timezone: "Asia/Manila",
  theme: "dark",
};

export interface Screenshot {
  id: string;
  trade_id: string;
  kind: ShotKind;
  storage_path: string;
  file_name: string | null;
}

/** A trade row as stored in the database (with tag ids / screenshots joined in). */
export interface Trade {
  id: string;
  user_id: string;
  account_id: string | null;
  trade_date: string; // YYYY-MM-DD
  entry_time: string | null; // HH:MM:SS (optional)
  exit_time: string | null;
  instrument: Instrument;
  direction: Direction;
  session: Session;
  status: TradeStatus;
  entry_price: number | null; // optional
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  quantity: number;
  risk_amount: number | null;
  commission: number;
  other_fees: number;
  point_value: number;
  gross_pnl: number;
  net_pnl: number;
  r_multiple: number | null;
  risk_reward: number | null;
  holding_minutes: number;
  pnl_overridden: boolean;
  r_overridden: boolean;
  status_overridden: boolean;
  setup: string | null;
  market_bias: MarketBias | null;
  entry_reason: string | null;
  exit_reason: string | null;
  mistakes: string | null;
  lessons: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  tag_ids: number[];
  screenshots: Screenshot[];
}

/** Values collected by the trade form (strings for number inputs are parsed before this). */
export interface TradeInput {
  account_id: string | null;
  trade_date: string;
  entry_time: string | null; // HH:MM (optional)
  exit_time: string | null;
  instrument: Instrument;
  direction: Direction;
  session: Session;
  entry_price: number | null; // optional
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  quantity: number;
  risk_amount: number | null;
  commission: number;
  other_fees: number;
  setup: string;
  market_bias: MarketBias | null;
  entry_reason: string;
  exit_reason: string;
  mistakes: string;
  lessons: string;
  notes: string;
  tag_ids: number[];
  // optional overrides (null = use calculated value)
  override_gross_pnl: number | null;
  override_r_multiple: number | null;
  override_status: TradeStatus | null;
}

export type RangePreset = "today" | "week" | "month" | "year" | "all" | "custom";
export interface DateRange {
  preset: RangePreset;
  from?: string; // YYYY-MM-DD (custom)
  to?: string;
}
