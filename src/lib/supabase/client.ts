import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/core/env.client";

/**
 * Supabase client for Client Components / browser code. Uses the public
 * anon/publishable key — RLS is the authorization boundary, not key secrecy.
 * See docs/architecture/backend.md.
 */
export function createClient() {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
