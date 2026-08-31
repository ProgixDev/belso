import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";
// Fills DATABASE_URL and DATABASE_EDITOR_URL from `.env.local` when they are not
// exported, so this suite resolves its database the same way the application
// does. Without it `pnpm verify:db` fails with "DATABASE_URL is not set" on a
// machine where the site itself runs — and the guard in `vitest.db.setup.ts`
// reads the absence as "no database, nothing to protect".
import "./scripts/lib/env-local.mjs";

/**
 * The tests that need a real database, run on their own.
 *
 * Separate from `vitest.config.mts` because these **write**: they unpublish a
 * listing to prove a draft is invisible, rename one to prove an old address
 * still resolves, and put both back. Run alongside the rest they raced the
 * golden snapshot — the capture read the catalogue mid-mutation and reported
 * 109 queries where 111 were expected, a failure that looked exactly like a
 * snapshot drift and was nothing of the kind.
 *
 * `fileParallelism: false` because that race is the whole reason this file
 * exists. `environment: node` because there is no DOM here and `server-only`
 * has no business being satisfied by jsdom.
 *
 * Run by `pnpm test:db`, and by `pnpm verify:db` after a migrate and seed.
 * Skips itself with no `DATABASE_URL`, so it is safe to run anywhere.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts", "src/features/properties/repository.golden.test.ts"],
    fileParallelism: false,
    setupFiles: ["./vitest.db.setup.ts"],
  },
});
