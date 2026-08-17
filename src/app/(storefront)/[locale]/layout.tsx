import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RootShell, baseMetadata } from "@/app/_shell/root-shell";
import { type Locale, isLocale, localeDirection, localeTag, locales } from "@/core/i18n";

/**
 * Storefront root layout. Everything a visitor sees lives under a locale
 * segment; the unlocalised routes (`/account`, `/sign-in`, `/examples`) sit in
 * the `(system)` group with their own root and keep their bare paths.
 *
 * This owns `<html>` — that is the whole point of the route group. `lang` and
 * `dir` are read off the segment, so a French page finally says so (AC-1).
 */

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return baseMetadata;

  return {
    ...baseMetadata,
    // Coarse on purpose: this is the locale *root*. Every page below it is
    // expected to set its own canonical — a listing inheriting `/fr` would tell
    // search engines the whole storefront is one URL.
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(locales.map((l) => [localeTag[l], `/${l}`])),
    },
    openGraph: {
      ...baseMetadata.openGraph,
      locale: localeTag[locale].replace("-", "_"),
      url: `${baseMetadata.metadataBase}${locale}`,
    },
  };
}

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <RootShell lang={localeTag[locale as Locale]} dir={localeDirection[locale as Locale]}>
      {children}
    </RootShell>
  );
}
