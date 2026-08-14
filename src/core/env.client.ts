import { z } from "zod";

/**
 * Client-exposed environment. These are inlined into the browser bundle, so they
 * are PUBLIC by definition — only `NEXT_PUBLIC_*` values that are safe to ship.
 * (Server-only secrets live in `src/core/env.ts`, guarded by `server-only`.)
 *
 * The Supabase anon/publishable key is public and RLS-bound; the guard below
 * refuses a service_role / secret key — shipping that would bypass RLS.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required")
    .refine((v) => !v.includes("service_role") && !v.startsWith("sb_secret_"), {
      message:
        "That looks like a SERVICE ROLE / secret key — never expose it. Use the anon/publishable key; the service key bypasses RLS.",
    }),
});

// NEXT_PUBLIC_* must be referenced statically for Next.js to inline them.
export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://localhost.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "public-anon-key-placeholder",
});
