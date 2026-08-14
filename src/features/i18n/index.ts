/**
 * Public API of the i18n slice — the only file other layers may import
 * (docs/architecture/module-boundaries.md).
 *
 * Locale *configuration* deliberately lives in `src/core/i18n.ts` instead: the
 * proxy needs it, and middleware cannot import a feature. This slice owns the
 * dictionaries and the UI built from them.
 */
export {};
