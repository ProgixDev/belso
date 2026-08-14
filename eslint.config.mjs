import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

/**
 * The boundaries section encodes docs/architecture/module-boundaries.md:
 *   app → features → shared(components,hooks,lib) → core
 * plus "features are imported only via their index.ts public API".
 * Changing it is an architectural decision: dedicated PR + ADR (Constitution Art. IV/V).
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "artifacts/**",
    // Feature packs are parked/inactive until installed via /add-feature — they
    // live outside src and must add zero weight to the app (tsconfig also excludes them).
    "packs/**",
  ]),
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "import/resolver": {
        typescript: { alwaysTryTypes: true },
      },
      "boundaries/include": ["src/**/*"],
      "boundaries/elements": [
        { type: "core", pattern: "src/core" },
        { type: "shared", pattern: ["src/components", "src/hooks", "src/lib"] },
        { type: "feature", mode: "folder", pattern: "src/features/*", capture: ["featureName"] },
        { type: "app", pattern: "src/app" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        2,
        {
          default: "disallow",
          rules: [
            // Layering: who may import whom.
            { from: { type: "app" }, allow: { to: { type: ["feature", "shared", "core"] } } },
            { from: { type: "feature" }, allow: { to: { type: ["shared", "core"] } } },
            { from: { type: "shared" }, allow: { to: { type: ["shared", "core"] } } },
            { from: { type: "core" }, allow: { to: { type: "core" } } },
            // Public API: a feature's internals are private — only index.ts(x) may be imported.
            {
              to: { type: "feature", internalPath: "!index.*" },
              disallow: { from: { type: "*" } },
              message:
                "Import features only via their public API (index.ts) — see docs/architecture/module-boundaries.md",
            },
          ],
        },
      ],
      // Belt-and-braces: ban deep feature imports even where boundaries can't resolve.
      "no-restricted-imports": [
        2,
        {
          patterns: [
            {
              group: ["@/features/*/*"],
              message: "Deep feature imports are forbidden — use the slice's index.ts.",
            },
          ],
        },
      ],
    },
  },
  {
    // Tests may reach into slice internals (they live beside them anyway).
    files: ["src/**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": 0,
    },
  },
]);

export default eslintConfig;
