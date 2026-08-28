"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { isLocale } from "@/core/i18n";
import { getDictionary } from "@/features/i18n";
import { logger } from "@/lib/logger";

/**
 * The home page reads the catalogue, and until now had nothing to catch it.
 *
 * There was no `error.tsx` anywhere under `[locale]/` outside `(content)/`, so a
 * database outage on the site's most-visited URL fell through to
 * `src/app/global-error.tsx` — which replaces the whole document with
 * `<html lang="en">` and "Something went wrong": no header, no footer, no
 * brand, and in English to a mostly French audience.
 *
 * That went unseen because the home page was prerendered, so it never touched
 * the database; making it dynamic (spec 010, review board) uncovered it. The
 * e2e assertion that was supposed to cover this passed on the global error page
 * too, because that page also has an `h1` — which is why it now checks for the
 * site's own header and footer instead.
 *
 * Locale comes from `useParams` because error boundaries are client components
 * and cannot await `params`. It falls back to French: an error screen is the
 * worst possible place to also change someone's language.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ locale: string }>();
  const locale = isLocale(params?.locale) ? params.locale : "fr";
  const dict = getDictionary(locale);

  useEffect(() => {
    logger.error("storefront page failed", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-24">
      <EmptyState
        title={dict.properties.unavailableTitle}
        description={dict.properties.unavailableBody}
        action={<Button onClick={reset}>{dict.common.retry}</Button>}
      />
    </div>
  );
}
