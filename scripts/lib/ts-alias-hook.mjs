/**
 * Let plain `node` run the app's TypeScript modules.
 *
 * Node 23+ strips types on its own, so the only thing standing between a script
 * and `src/` is the `@/*` path alias, which is a tsconfig concept Node knows
 * nothing about. This maps it, and resolves the extension the way TypeScript
 * source omits it.
 *
 * The alternative was a `tsx`/`ts-node` dependency, or exporting the fixtures to
 * a second generated JSON file that could drift from the real ones. Twenty
 * lines and no dependency beat both — and it means the seed reads *the same*
 * `fixtures/properties.ts` the site and the golden snapshot read, which is the
 * property that makes AC-1 meaningful.
 *
 * Used as: `node --import ./scripts/lib/ts-alias-hook.mjs scripts/seed.mjs`
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(new URL("./ts-alias-resolver.mjs", import.meta.url), pathToFileURL("./"));
