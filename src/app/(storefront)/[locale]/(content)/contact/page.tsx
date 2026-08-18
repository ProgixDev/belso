import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, localeTag, locales, toPublicPath } from "@/core/i18n";
import { Reveal } from "@/components/motion";
import { EnquiryForm } from "@/features/enquiries";
import { getDictionary } from "@/features/i18n";
import { enquiryLabels } from "../../_components/enquiry-labels";

/**
 * The general contact page — the same form as a listing enquiry, without a
 * property attached. The confirmation says so: with nothing to name back, it
 * uses the general wording rather than a sentence with a hole in it.
 *
 * No `loading.tsx`: nothing here is fetched, so a skeleton would flash for zero
 * milliseconds while putting this route behind a Suspense boundary — which is
 * what turns a `notFound()` into a soft 200 (see the T2.8 note in tasks.md).
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);

  return {
    title: dict.contact.title,
    description: dict.contact.lede,
    alternates: {
      canonical: toPublicPath("/contact", locale),
      languages: Object.fromEntries(
        locales.map((l) => [localeTag[l], toPublicPath("/contact", l)]),
      ),
    },
  };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <Reveal>
        <h1 className="font-[family-name:var(--font-archivo)] text-3xl font-extrabold tracking-tight sm:text-4xl">
          {dict.contact.title}
        </h1>
        <p className="text-muted-foreground mt-3 text-base">{dict.contact.lede}</p>
      </Reveal>

      <Reveal delay={0.1}>
        <EnquiryForm labels={enquiryLabels(dict)} className="mt-10" />
      </Reveal>
    </div>
  );
}
