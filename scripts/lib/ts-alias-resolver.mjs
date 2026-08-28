/**
 * The resolve hook behind `ts-alias-hook.mjs`.
 *
 * Two jobs, both of which TypeScript does at compile time and Node does not:
 *
 * 1. `@/x` → `<repo>/src/x`, matching `tsconfig.json`'s `paths`.
 * 2. An extensionless specifier → the `.ts` (or `.tsx`, or `/index.ts`) file it
 *    means. TypeScript source omits extensions; Node's ESM resolver requires
 *    them.
 *
 * `server-only` is mapped to a stub. It exists to fail a build when a server
 * module is pulled into a client bundle, which is a real and valuable guard —
 * but a seed script running under plain Node is neither, and the package's
 * `react-server` export condition would throw here. Stubbing it in this one
 * context keeps the guard intact everywhere it means something.
 */
import { statSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = join(root, "src");

const CANDIDATES = [".ts", ".tsx", ".mts", ".js", "/index.ts", "/index.tsx"];

/**
 * Node needs telling which files carry types. Saying plain `"module"` for a
 * `.ts` file skips type stripping and the first `import type` is a syntax
 * error; saying nothing at all makes Node reparse and warn on every file.
 */
const formatFor = (file) => (/\.(ts|tsx|mts)$/.test(file) ? "module-typescript" : "module");

/** A path that exists *and is a file* — not a directory that happens to share the name. */
const isFile = (path) => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

/**
 * Try the extensions TypeScript lets source files leave off.
 *
 * The `isFile` check is load-bearing. `repository.ts` imports `./fixtures`, and
 * there is a *directory* by that name — an `existsSync` here matched it and
 * handed Node a directory to read, which fails as `EISDIR` from inside a
 * worker thread and surfaces as a libuv assertion rather than anything
 * resembling a module resolution error.
 */
function withExtension(base) {
  if (isFile(base)) return base;
  for (const suffix of CANDIDATES) {
    const candidate = base + suffix;
    if (isFile(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier === "server-only" || specifier === "client-only") {
    return {
      url: pathToFileURL(join(root, "scripts", "lib", "empty.mjs")).href,
      shortCircuit: true,
    };
  }

  if (specifier.startsWith("@/")) {
    const found = withExtension(join(src, specifier.slice(2)));
    if (found)
      return { url: pathToFileURL(found).href, format: formatFor(found), shortCircuit: true };
  }

  // Relative imports between TypeScript files, which also omit the extension.
  //
  // Scoped to our own source on purpose. Without the `node_modules` guard this
  // also caught dependencies' internal relative imports and declared them ESM —
  // which is how `pg`, a CommonJS package, came back as "does not provide an
  // export named 'default'". Their resolution is Node's business, not ours.
  const parent = context.parentURL;
  if (
    specifier.startsWith(".") &&
    parent?.startsWith("file:") &&
    !parent.includes("node_modules")
  ) {
    const base = resolvePath(dirname(fileURLToPath(parent)), specifier);
    const found = withExtension(base);
    if (found)
      return { url: pathToFileURL(found).href, format: formatFor(found), shortCircuit: true };
  }

  return next(specifier, context);
}
