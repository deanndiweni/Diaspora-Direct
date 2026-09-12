import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Guard against a blank-screen crash: if these aren't set at build time,
// createClient() throws synchronously during module load, before React
// ever mounts, which is why the app can show a totally blank screen with
// no visible error (this is what App Review hit on 9 Sept 2026).
export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY at build time."
    : null;

export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl, supabaseAnonKey);

if (supabaseConfigError) {
  // Still visible in the WKWebView console via Safari Web Inspector even
  // though the UI shows a friendly fallback screen instead of blank white.
  console.error("[supabaseClient]", supabaseConfigError);
}
