import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/motion";
import { isLocale, type Locale, localeTag, locales, toPublicPath } from "@/core/i18n";
import { getDictionary, isLegalDoc, legalDocs, legalSections } from "@/features/i18n";

/**
 * One template, three documents (AC-10).
 *
 * The body is a marked placeholder — see `dictionaries/legal.ts` for why, and
 * for the section skeletons. Each section renders its real heading plus a
 * visible note that the text is being written, so the page is never blank and
 * can never be mistaken for published legal copy.
 *
 * `noindex`: half-written legal notices are exactly what should not be ranking,
 * and this flips to indexable in the same commit that brings the real text.
 *
 * No `loading.tsx` here on purpose — an unknown `[doc]` must return a hard 404,
 * and a Suspense boundary above this route would make it a soft 200 (T2.8 note).
 */

export function generateStaticParams() {
  return locales.flatMap((locale) => legalDocs.map((doc) => ({ locale, doc })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; doc: string }>;
}): Promise<Metadata> {
  const { locale, doc } = await params;
  if (!isLocale(locale) || !isLegalDoc(doc)) return {};
  const dict = getDictionary(locale);

  return {
    title: dict.legal[doc],
    robots: { index: false, follow: true },
    alternates: {
      canonical: toPublicPath(`/legal/${doc}`, locale),
      languages: Object.fromEntries(
        locales.map((l) => [localeTag[l], toPublicPath(`/legal/${doc}`, l)]),
      ),
    },
  };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; doc: string }>;
}) {
  const { locale, doc } = await params;
  if (!isLocale(locale)) notFound();
  // An unknown document is a 404, not an empty page with a heading.
  if (!isLegalDoc(doc)) notFound();

  const dict = getDictionary(locale);
  const sections = legalSections[doc];

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="font-[family-name:var(--font-archivo)] text-3xl font-extrabold tracking-tight sm:text-4xl">
        {dict.legal[doc]}
      </h1>

      <Reveal>
        <p
          role="note"
          className="border-border bg-muted/50 text-muted-foreground mt-6 rounded-md border px-4 py-3 text-sm"
        >
          {dict.legal.placeholder}
        </p>
      </Reveal>

      <div className="mt-12 flex flex-col gap-10">
        {/* Staggered, but shallowly: nine headings arriving one after another at a
         * tenth of a second apart reads as a list assembling itself, which is
         * the opposite of what a legal page should feel like. */}
        {sections.map((section, index) => (
          <Reveal key={section.id} delay={Math.min(index, 4) * 0.04}>
            <section aria-labelledby={section.id}>
              <h2 id={section.id} className="text-lg font-semibold tracking-tight">
                {section.heading[locale as Locale]}
              </h2>
              {/*
               * A short marker rather than repeating the banner sentence under
               * every heading — nine identical paragraphs read as a bug, and the
               * note at the top has already said it once, properly.
               */}
              <p className="text-muted-foreground/70 mt-2 text-sm italic">
                {dict.legal.sectionPlaceholder}
              </p>
            </section>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
