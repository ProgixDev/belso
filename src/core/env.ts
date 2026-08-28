import "server-only";
import { z } from "zod";

/**
 * Server-side environment access — the ONLY place process.env is read.
 * `server-only` makes importing this from a client component a build error,
 * which is exactly the failure mode we want (secrets can't drift client-side).
 * Client-exposed values must be NEXT_PUBLIC_* and added to the separate schema below.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Server-only secrets. NEVER prefix these NEXT_PUBLIC_ — they must not reach the
  // browser. The Supabase service_role key bypasses RLS; use it only in trusted
  // server code (e.g. the account-deletion route). Optional until you wire it up.
  // `.transform` before `.optional()`: a variable declared with an empty value
  // is not set, but zod would otherwise measure "" against min(20) and fail the
  // build. Same trap that broke the first Vercel deploy (see env.client.ts).
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v === "" || v.length >= 20, "SUPABASE_SERVICE_ROLE_KEY looks truncated")
    .transform((v) => v || undefined)
    .optional(),
  /**
   * Postgres, on our own VPS (ADR-0008, spec 010).
   *
   * Server-only and never `NEXT_PUBLIC_` — it carries a password, and
   * `check-secrets` would reject the public spelling, correctly.
   *
   * Optional, with the same blank-is-unset treatment as the key above: a
   * variable *declared* with an empty value is not a configured value, and
   * treating it as one is precisely what broke the first Vercel deploy. Unset
   * is a legitimate state today — the repository still reads fixtures — and it
   * is what the "listings cannot be loaded" path (AC-5) is built for.
   */
  DATABASE_URL: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v === "" || v.startsWith("postgres"), "DATABASE_URL must be a postgres:// URL")
    .transform((v) => v || undefined)
    .optional(),
});

export const env = serverEnvSchema.parse(process.env);
