import { notFound } from "next/navigation";
import { type Locale, isLocale, localeDirection, locales } from "@/core/i18n";

/**
 * Storefront layout. Everything a visitor sees lives under a locale segment;
 * the unlocalised routes (`/account`, `/sign-in`, `/examples`) are excluded in
 * `src/proxy.ts` and keep their bare paths.
 *
 * KNOWN GAP: `<html lang>` and `dir` still come from the root layout, which
 * cannot see the locale. `dir` is applied to the wrapper below so RTL has a
 * hook, but `lang` is wrong for English pages until the root layout is split
 * into per-group roots. Tracked as T1.7a.
 */

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return <div dir={localeDirection[locale as Locale]}>{children}</div>;
}
