import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    /*
     * `scripts/` is included deliberately. Those files open connections to the
     * client's database and one of them upserts her whole catalogue, so they
     * carry more risk per line than most of `src` — and a test placed beside
     * one would have been collected by nothing at all.
     */
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,mts}"],
    /**
     * `*.db.test.ts` is excluded here and run by `pnpm test:db` instead.
     *
     * Those tests **write** to the shared database — they unpublish a listing
     * to prove a draft is invisible, then put it back. Vitest runs test files
     * in parallel, so with a `DATABASE_URL` set they raced the golden snapshot:
     * the capture read the catalogue mid-mutation and reported 109 queries
     * where 111 were expected. The failure looked like a snapshot drift and was
     * nothing of the kind.
     *
     * Separating them keeps `pnpm test` parallel and honest, and gives the
     * writing tests a run of their own where nothing else is reading.
     */
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.db.test.ts"],
  },
});
