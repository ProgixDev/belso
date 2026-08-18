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

/**
 * A variable that exists but is blank means the same thing as one that was never
 * set: not configured. Say so explicitly, because `??` does not — it only catches
 * null and undefined, so `""` sails straight past the fallback and into the
 * schema. That is exactly how the first Vercel build failed: the variables were
 * declared on the project with empty values, `??` passed them through, and the
 * build died in `Collecting page data` with "must be a valid URL".
 */
function configured(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Stand-ins so the storefront builds and runs without a backend — the site is
 * public content, and only the auth routes need Supabase. They are recognisable
 * on sight, and `supabaseConfigured` below reports which state we are in.
 */
const PLACEHOLDER_URL = "https://localhost.supabase.co";
const PLACEHOLDER_ANON_KEY = "public-anon-key-placeholder";

// NEXT_PUBLIC_* must be referenced statically for Next.js to inline them.
export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: configured(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? PLACEHOLDER_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    configured(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? PLACEHOLDER_ANON_KEY,
});

/**
 * False when the placeholders above are in play: the storefront works, anything
 * that talks to Supabase does not. Nothing gates on this yet — it exists so a
 * caller can fail honestly rather than call a host that does not resolve.
 */
export const supabaseConfigured =
  clientEnv.NEXT_PUBLIC_SUPABASE_URL !== PLACEHOLDER_URL &&
  clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY !== PLACEHOLDER_ANON_KEY;

/*
 * Say it once, on the server, at build and boot. Silence here is how a deploy
 * ships with auth quietly dead; a browser warning would say it to visitors
 * instead of to us, which helps nobody.
 */
if (!supabaseConfigured && typeof window === "undefined" && process.env.NODE_ENV === "production") {
  console.warn(
    "[env] Supabase is not configured — NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are unset or blank. " +
      "The storefront is unaffected; sign-in and account routes cannot work until they are set.",
  );
}
