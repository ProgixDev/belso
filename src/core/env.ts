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
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  // Add real server vars here, mirrored in .env.example, e.g.:
  // DATABASE_URL: z.string().url(),
});

export const env = serverEnvSchema.parse(process.env);
