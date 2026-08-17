import { notFound } from "next/navigation";
import { isLocale } from "@/core/i18n";
import { getDictionary } from "@/features/i18n";
import { PageShell } from "../_components/page-shell";

/**
 * Chrome for every storefront page except the home scene.
 *
 * The group exists precisely to exclude `[locale]/page.tsx`: the cinematic
 * landing supplies its own header, staggered in by the splash, and a shared one
 * above it would double the navigation and break the intro (T1.7 note). Contact
 * and the legal pages join this group in Phase 3.
 */
export default async function ContentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <PageShell locale={locale} dict={getDictionary(locale)}>
      {children}
    </PageShell>
  );
}
