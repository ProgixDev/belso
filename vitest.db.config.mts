import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

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
  },
});
