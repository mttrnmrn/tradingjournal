import { supabase } from "@/lib/supabase";
import type { Tag } from "@/types";

export async function fetchTags(): Promise<Tag[]> {
  const { data, error } = await supabase.from("tags").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []) as Tag[];
}
