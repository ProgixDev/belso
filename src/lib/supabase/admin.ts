import "server-only";
import { createClient } from "@supabase/supabase-js";
import { clientEnv } from "@/core/env.client";
import { env } from "@/core/env";

/**
 * Admin Supabase client — uses the SERVICE ROLE key, which BYPASSES RLS. Server
 * code only (the `server-only` import enforces this). Use sparingly, e.g. account
 * deletion. Never expose this client or the key to the browser.
 */
export function createAdminClient() {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (server-only secret).");
  }
  return createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
