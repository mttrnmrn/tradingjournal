import { SCREENSHOT_BUCKET, supabase } from "@/lib/supabase";
import { calculateTrade } from "@/lib/calc";
import type { Screenshot, Settings, ShotKind, Trade, TradeInput } from "@/types";

const PAGE = 1000;

const SELECT = "*, trade_tags(tag_id), trade_screenshots(id, trade_id, kind, storage_path, file_name)";

function normalize(row: any): Trade {
  const num = (v: any) => (v == null ? null : Number(v));
  return {
    ...row,
    entry_price: num(row.entry_price),
    exit_price: num(row.exit_price),
    stop_loss: num(row.stop_loss),
    take_profit: num(row.take_profit),
    quantity: Number(row.quantity),
    risk_amount: num(row.risk_amount),
    commission: Number(row.commission),
    other_fees: Number(row.other_fees),
    point_value: Number(row.point_value),
    gross_pnl: Number(row.gross_pnl),
    net_pnl: Number(row.net_pnl),
    r_multiple: num(row.r_multiple),
    risk_reward: num(row.risk_reward),
    holding_minutes: Number(row.holding_minutes),
    tag_ids: (row.trade_tags ?? []).map((x: any) => x.tag_id),
    screenshots: (row.trade_screenshots ?? []) as Screenshot[],
  } as Trade;
}

export async function fetchTrades(): Promise<Trade[]> {
  const all: Trade[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("trades")
      .select(SELECT)
      .order("trade_date", { ascending: false })
      .order("entry_time", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data ?? []).map(normalize));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

export interface ScreenshotChange {
  file?: File | null; // new file to upload for this slot
  remove?: boolean; // remove the existing screenshot
}

export interface ScreenshotChanges {
  before?: ScreenshotChange;
  after?: ScreenshotChange;
}

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg"];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function validateImage(file: File): string | null {
  const okExt = /\.(png|jpe?g)$/i.test(file.name);
  if (!ALLOWED_IMAGE_TYPES.includes(file.type) && !okExt) return "Only PNG, JPG and JPEG images are supported";
  if (file.size > MAX_IMAGE_BYTES) return "Image must be 10 MB or smaller";
  return null;
}

function toRow(input: TradeInput, settings: Pick<Settings, "nas100_point_value">) {
  const c = calculateTrade(input, settings);
  const nz = (s: string) => (s.trim() ? s.trim() : null);
  return {
    account_id: input.account_id,
    trade_date: input.trade_date,
    entry_time: input.entry_time ? (input.entry_time.length === 5 ? input.entry_time + ":00" : input.entry_time) : null,
    exit_time: input.exit_time ? (input.exit_time.length === 5 ? input.exit_time + ":00" : input.exit_time) : null,
    instrument: input.instrument,
    direction: input.direction,
    session: input.session,
    status: c.status,
    entry_price: input.entry_price,
    exit_price: input.exit_price,
    stop_loss: input.stop_loss,
    take_profit: input.take_profit,
    quantity: input.quantity,
    risk_amount: input.risk_amount,
    commission: input.commission,
    other_fees: input.other_fees,
    point_value: c.pointValue,
    gross_pnl: c.grossPnl,
    net_pnl: c.netPnl,
    r_multiple: c.rMultiple,
    risk_reward: c.riskReward,
    holding_minutes: c.holdingMinutes,
    pnl_overridden: c.pnlOverridden,
    r_overridden: c.rOverridden,
    status_overridden: c.statusOverridden,
    setup: nz(input.setup),
    market_bias: input.market_bias,
    entry_reason: nz(input.entry_reason),
    exit_reason: nz(input.exit_reason),
    mistakes: nz(input.mistakes),
    lessons: nz(input.lessons),
    notes: nz(input.notes),
  };
}

async function replaceTags(tradeId: string, tagIds: number[]) {
  const { error: delErr } = await supabase.from("trade_tags").delete().eq("trade_id", tradeId);
  if (delErr) throw delErr;
  if (tagIds.length) {
    const { error } = await supabase.from("trade_tags").insert(tagIds.map((tag_id) => ({ trade_id: tradeId, tag_id })));
    if (error) throw error;
  }
}

async function applyScreenshots(userId: string, tradeId: string, existing: Screenshot[], changes: ScreenshotChanges) {
  for (const kind of ["before", "after"] as ShotKind[]) {
    const ch = changes[kind];
    if (!ch) continue;
    const current = existing.find((s) => s.kind === kind);
    if (ch.file) {
      const ext = /\.png$/i.test(ch.file.name) || ch.file.type === "image/png" ? "png" : "jpg";
      const path = `${userId}/${tradeId}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(SCREENSHOT_BUCKET)
        .upload(path, ch.file, { contentType: ext === "png" ? "image/png" : "image/jpeg", upsert: false });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase
        .from("trade_screenshots")
        .upsert({ trade_id: tradeId, user_id: userId, kind, storage_path: path, file_name: ch.file.name }, { onConflict: "trade_id,kind" });
      if (dbErr) {
        await supabase.storage.from(SCREENSHOT_BUCKET).remove([path]);
        throw dbErr;
      }
      if (current) await supabase.storage.from(SCREENSHOT_BUCKET).remove([current.storage_path]);
    } else if (ch.remove && current) {
      await supabase.from("trade_screenshots").delete().eq("id", current.id);
      await supabase.storage.from(SCREENSHOT_BUCKET).remove([current.storage_path]);
    }
  }
}

export async function createTrade(
  userId: string,
  input: TradeInput,
  settings: Pick<Settings, "nas100_point_value">,
  shots: ScreenshotChanges = {},
): Promise<string> {
  const { data, error } = await supabase.from("trades").insert({ ...toRow(input, settings), user_id: userId }).select("id").single();
  if (error) throw error;
  const id = data.id as string;
  try {
    await replaceTags(id, input.tag_ids);
    await applyScreenshots(userId, id, [], shots);
  } catch (e) {
    // do not leave a half-saved trade behind
    await supabase.from("trades").delete().eq("id", id);
    throw e;
  }
  return id;
}

export async function updateTrade(
  userId: string,
  existing: Trade,
  input: TradeInput,
  settings: Pick<Settings, "nas100_point_value">,
  shots: ScreenshotChanges = {},
): Promise<void> {
  const { error } = await supabase.from("trades").update(toRow(input, settings)).eq("id", existing.id);
  if (error) throw error;
  await replaceTags(existing.id, input.tag_ids);
  await applyScreenshots(userId, existing.id, existing.screenshots, shots);
}

export async function deleteTrade(trade: Trade): Promise<void> {
  const paths = trade.screenshots.map((s) => s.storage_path);
  if (paths.length) await supabase.storage.from(SCREENSHOT_BUCKET).remove(paths);
  const { error } = await supabase.from("trades").delete().eq("id", trade.id);
  if (error) throw error;
}

/** Duplicate keeps all fields and tags but not screenshots. Dated today in the trading time zone by the caller. */
export async function duplicateTrade(userId: string, trade: Trade, newDate: string): Promise<string> {
  const { id, created_at, updated_at, tag_ids, screenshots, user_id, ...rest } = trade;
  const { data, error } = await supabase
    .from("trades")
    .insert({ ...rest, trade_date: newDate, user_id: userId })
    .select("id")
    .single();
  if (error) throw error;
  try {
    await replaceTags(data.id, tag_ids);
  } catch (e) {
    await supabase.from("trades").delete().eq("id", data.id);
    throw e;
  }
  return data.id as string;
}

export async function signedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(SCREENSHOT_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
