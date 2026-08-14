/**
 * Public API of the i18n slice — the only file other layers may import
 * (docs/architecture/module-boundaries.md).
 *
 * Locale *configuration* deliberately lives in `src/core/i18n.ts` instead: the
 * proxy needs it, and middleware cannot import a feature. This slice owns the
 * dictionaries and the UI built from them.
 *
 * Dictionaries are handed to feature components as props from `app`, never
 * imported by another slice — features may not import each other.
 */
import type { Locale } from "@/core/i18n";
import { en } from "./dictionaries/en";
import { fr } from "./dictionaries/fr";

export type { Dictionary } from "./dictionaries/fr";

const dictionaries = { fr, en } as const;

/** The full string table for a locale. Synchronous — these are static objects. */
export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}

/**
 * Fill `{placeholders}` in a dictionary string.
 * `interpolate("{count} biens", { count: 12 })` → `"12 biens"`.
 */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export { LocaleSwitcher } from "./components/locale-switcher";
