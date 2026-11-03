import { supabase } from "@/lib/supabase";
import type { Account, MaxLossType } from "@/types";

export interface AccountInput {
  name: string;
  starting_balance: number;
  max_loss_limit: number | null;
  max_loss_type: MaxLossType;
  daily_loss_limit: number | null;
}

const optNum = (v: unknown) => (v == null ? null : Number(v));

function normalize(r: any): Account {
  return {
    ...r,
    starting_balance: Number(r.starting_balance),
    max_loss_limit: optNum(r.max_loss_limit),
    daily_loss_limit: optNum(r.daily_loss_limit),
  } as Account;
}

function friendly(error: { code?: string; message: string }): Error {
  if (error.code === "23505") return new Error("You already have an account with that name");
  return new Error(error.message);
}

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase.from("accounts").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalize);
}

export async function createAccount(userId: string, input: AccountInput): Promise<void> {
  const { error } = await supabase.from("accounts").insert({ ...input, name: input.name.trim(), user_id: userId });
  if (error) throw friendly(error);
}

export async function updateAccount(id: string, input: AccountInput): Promise<void> {
  const { error } = await supabase.from("accounts").update({ ...input, name: input.name.trim() }).eq("id", id);
  if (error) throw friendly(error);
}

/** Trades of a deleted account are kept and become "Unassigned" (FK is ON DELETE SET NULL). */
export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) throw error;
}
