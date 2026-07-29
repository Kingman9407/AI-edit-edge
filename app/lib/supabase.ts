import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const isDev = process.env.NODE_ENV === "development";

if (typeof window !== "undefined") {
  console.group("🔌 [Supabase Diagnostics]");
  console.log("  NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? `${supabaseUrl.substring(0, 25)}…` : "❌ MISSING (undefined or empty)");
  console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY:", supabaseAnonKey ? `${supabaseAnonKey.substring(0, 15)}…` : "❌ MISSING (undefined or empty)");
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("  ⚠️ Supabase client could not be initialized because env vars are missing. Make sure .env.local has NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, and restart your Next.js dev server.");
  } else {
    console.log("  ✅ Supabase client initialized successfully.");
  }
  console.groupEnd();
}

export const supabase: SupabaseClient | null = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

/**
 * Diagnostic helper to test table read/write connectivity to Supabase
 */
export async function testSupabaseConnection() {
  if (!supabase) {
    console.error("❌ [Supabase Test] Cannot run connection test: Supabase client is null.");
    return false;
  }

  console.log("🔍 [Supabase Test] Testing connection to table 'ai_logs'...");
  try {
    const { data, error, count } = await supabase.from("ai_logs").select("*", { count: "exact", head: true });
    if (error) {
      console.error("❌ [Supabase Test] Error querying 'ai_logs':", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      if (error.code === "42501") {
        console.warn("  💡 HINT: Error code 42501 indicates Row Level Security (RLS) is blocking access. Ensure RLS on 'ai_logs' allows SELECT/INSERT for anon users, or add an INSERT policy.");
      } else if (error.code === "42P01") {
        console.warn("  💡 HINT: Error code 42P01 indicates the table 'ai_logs' does not exist in your Supabase database. Please create it in Supabase SQL Editor.");
      }
      return false;
    }
    console.log(`✅ [Supabase Test] Connection successful! Found ${count ?? 0} existing records in 'ai_logs'.`);
    return true;
  } catch (err) {
    console.error("❌ [Supabase Test] Unexpected exception during connection test:", err);
    return false;
  }
}
