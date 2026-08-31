import "server-only";
import { resolve } from "node:path";
import { z } from "zod";

/**
 * Server-side environment access — the ONLY place process.env is read.
 * `server-only` makes importing this from a client component a build error,
 * which is exactly the failure mode we want (secrets can't drift client-side).
 * Client-exposed values must be NEXT_PUBLIC_* and added to the separate schema below.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /**
   * Postgres, on our own VPS (ADR-0008, spec 010).
   *
   * Server-only and never `NEXT_PUBLIC_` — it carries a password, and
   * `check-secrets` would reject the public spelling, correctly.
   *
   * Optional here with the blank-is-unset treatment: a variable *declared* with
   * an empty value is not a configured value, and treating it as one is what
   * broke the first Vercel deploy. Unset is legitimate for `pnpm verify`, the
   * build and a fresh clone — but not for production, which the guard below
   * enforces.
   */
  DATABASE_URL: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v === "" || v.startsWith("postgres"), "DATABASE_URL must be a postgres:// URL")
    .transform((v) => v || undefined)
    .optional(),

  /**
   * Keys the enquiry throttle's HMAC (`features/enquiries/rate-limit.ts`).
   *
   * Optional, and unset it degrades to a plain hash rather than refusing to
   * throttle — a limiter that fails open would be worse than one that is merely
   * less private. But **set it in production**: without it the key is a bare
   * hash of a /24, and the entire IPv4 space is enumerable in minutes, so anyone
   * holding a database dump could work out which network enquired.
   */
  THROTTLE_SECRET: z
    .string()
    .transform((v) => v.trim())
    .transform((v) => v || undefined)
    .optional(),

  /**
   * The back-office's connection, as `belso_editor` (ADR-0010, spec 011).
   *
   * **It must never fall back to `DATABASE_URL`.** The whole point of the split
   * is that the role the storefront holds cannot write a listing; a fallback
   * would restore exactly the privilege the second role exists to remove, while
   * looking like a kindness to whoever forgot to set it. Unset, `/admin`
   * reports itself unconfigured and the public site is untouched — which is the
   * right way round, because the storefront serving is worth more than the
   * editor working.
   *
   * Same blank-is-unset treatment as `DATABASE_URL`, for the same reason.
   */
  DATABASE_EDITOR_URL: z
    .string()
    .transform((v) => v.trim())
    .refine(
      (v) => v === "" || v.startsWith("postgres"),
      "DATABASE_EDITOR_URL must be a postgres:// URL",
    )
    .transform((v) => v || undefined)
    .optional(),

  /**
   * Where uploaded photographs are written (spec 011, AC-6).
   *
   * **Not `public/`**, which is tempting and wrong: Next serves that directory
   * from a manifest computed at build time, so a photograph uploaded at runtime
   * is written to a path nothing will serve until the next deploy — a failure
   * that looks like a broken upload and is a misunderstanding of the framework.
   * Files are served by a route handler that resolves against this root instead.
   *
   * It is also the reason this is a variable rather than a constant: in
   * production it points at a mounted volume that survives a container rebuild.
   * Get it wrong and the client's photography disappears on the next deploy,
   * which looks like data loss and is a mount.
   */
  MEDIA_ROOT: z
    .string()
    .transform((v) => v.trim())
    .transform((v) => v || undefined)
    .optional(),
});

export const env = serverEnvSchema.parse(process.env);

/**
 * Production may not fall back to fixtures, and may not silently discard leads.
 *
 * `DATABASE_URL` is optional above because `pnpm verify`, the build and a fresh
 * clone genuinely have no database, and the repository serves fixtures instead.
 * That branch is correct for development and catastrophic in production: one
 * mistyped variable on a deploy and the site serves twenty **invented** villas
 * — fake addresses, fake prices — as the agency's real inventory, while the
 * enquiry form answers every visitor "sent" and stores nothing. Silently, with
 * nothing in the logs.
 *
 * So the same variable that is optional everywhere else is required here, and
 * the boot fails rather than the catalogue quietly becoming fiction.
 *
 * **Not during `next build`**, which sets `NODE_ENV=production` itself. Guarding
 * the build would make `pnpm verify` — which builds, on machines that correctly
 * have no database — impossible to pass. What must never happen is *serving*
 * without one, and that is what this checks.
 */
const isBuilding = process.env.NEXT_PHASE === "phase-production-build";

/**
 * The one deliberate way past this, and why it exists.
 *
 * `pnpm start` is `NODE_ENV=production`, so the guard also refuses to boot the
 * local production server that Playwright drives — which would make `pnpm e2e`
 * impossible on a machine with no database, and the e2e suite is exactly where
 * a contributor with no tunnel needs to work. `playwright.config.ts` sets this
 * when no `DATABASE_URL` is present.
 *
 * A real deployment never sets it, which is the whole point: the escape hatch
 * has to be something a deploy could not do by accident, and an environment
 * variable nobody writes into a production config is that.
 */
const allowFixtures = process.env.BELSO_ALLOW_FIXTURES === "1";

if (env.NODE_ENV === "production" && !isBuilding && !allowFixtures && !env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required in production: without it the site would serve fixture listings " +
      "as real inventory and accept enquiries without storing them.",
  );
}

/**
 * A missing editor connection warns; it does not throw.
 *
 * The asymmetry with `DATABASE_URL` above is deliberate and is the ADR-0010
 * trade-off written as code. Without `DATABASE_URL` the storefront would *lie*
 * to visitors, so it must not boot. Without `DATABASE_EDITOR_URL` the storefront
 * is entirely correct and only the back-office is unavailable — refusing to boot
 * would take a working public site down to protect three people's editor, which
 * is the wrong trade for an agency whose website is its shopfront.
 *
 * It is loud because the failure is otherwise silent until the client tries to
 * publish something and cannot, at which point nobody remembers the deploy.
 *
 * `console` rather than `src/lib/logger.ts`: `core` is the bottom of the layer
 * stack and may not import from `lib` (`module-boundaries.md`). There is nothing
 * to redact in a fixed string.
 */
if (env.NODE_ENV === "production" && !isBuilding && !env.DATABASE_EDITOR_URL) {
  console.warn(
    "[belso] DATABASE_EDITOR_URL is not set: the back-office is unavailable. " +
      "The public site is unaffected. Set it to the belso_editor connection string.",
  );
}

/**
 * The resolved media root, with a development default so uploads work on a
 * fresh clone. Relative values resolve against the working directory, because a
 * relative path in a deploy config is a question about which directory the
 * process started in, and nobody wants to answer that at 2am.
 */
export const mediaRoot = resolve(env.MEDIA_ROOT ?? "media");
