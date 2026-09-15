import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// supabase-js throws synchronously inside createClient() if either value is
// missing, e.g. "supabaseUrl is required.". Since this module is imported
// right at the top of main.jsx, that throw happens before React ever mounts
// anything, which is why build 6 showed Apple's reviewer a totally blank
// white screen on iPad Air instead of any UI at all (no error message, no
// loading state, nothing). That build was archived before the "Pass
// Supabase/API env vars into native build" fix landed, so the values were
// genuinely undefined at build time.
//
// This guard stops a missing config value from taking down the entire app.
// It logs a clear error and falls back to harmless placeholder values so
// createClient() doesn't throw; any real Supabase calls will then fail
// individually (network/auth error) instead of crashing on startup, and the
// ErrorBoundary/loading-state handling in main.jsx takes it from there.
if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
          "Missing Supabase config: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY were not set at build time. " +
            "Auth and data calls will fail until this build is replaced with one that has them."
        );
}

export const supabase = createClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder-anon-key"
  );
