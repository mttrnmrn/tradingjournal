import { supabase } from "@/lib/supabase";
import { DEFAULT_SETTINGS, type Settings } from "@/types";

export async function fetchSettings(userId: string): Promise<Settings> {
  const { data, error } = await supabase.from("settings").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (data) {
    return {
      ...DEFAULT_SETTINGS,
      ...data,
      starting_balance: Number(data.starting_balance),
      nas100_point_value: Number(data.nas100_point_value),
      default_commission: Number(data.default_commission),
    } as Settings;
  }
  // first login: create the row with defaults
  const { error: insErr } = await supabase.from("settings").insert({ user_id: userId, ...DEFAULT_SETTINGS });
  if (insErr) throw insErr;
  return { ...DEFAULT_SETTINGS, user_id: userId };
}

export async function saveSettings(userId: string, s: Settings): Promise<void> {
  const { error } = await supabase.from("settings").upsert({
    user_id: userId,
    starting_balance: s.starting_balance,
    currency: s.currency,
    nas100_point_value: s.nas100_point_value,
    default_commission: s.default_commission,
    timezone: s.timezone,
    theme: s.theme,
  });
  if (error) throw error;
}
