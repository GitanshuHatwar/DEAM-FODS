import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isMockMode =
  (import.meta.env.VITE_USE_MOCKS ?? "true").toString().toLowerCase() === "true";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url =
    supabaseUrl && supabaseUrl.startsWith("http")
      ? supabaseUrl
      : "https://placeholder-project.supabase.co";
  const key = supabaseAnonKey || "placeholder-anon-key";
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}
