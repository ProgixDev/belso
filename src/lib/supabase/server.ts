import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clientEnv } from "@/core/env.client";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Reads/writes the auth session via httpOnly cookies (set by the middleware on
 * refresh). Authorization is enforced by RLS — never trust the client.
 *
 * NOTE (App Router): in a Server Component you can READ but not always WRITE
 * cookies; the `setAll` try/catch tolerates that (the middleware refresh covers it).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — ignore; middleware refreshes cookies.
          }
        },
      },
    },
  );
}
