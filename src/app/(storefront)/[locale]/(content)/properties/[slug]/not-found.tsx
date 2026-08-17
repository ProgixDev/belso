import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { defaultLocale, isLocale, toPublicPath } from "@/core/i18n";
import { getDictionary } from "@/features/i18n";
import { cn } from "@/lib/utils";

/**
 * AC-8: an address that does not exist gets a not-found in the visitor's
 * language, with a way back into the catalogue.
 *
 * `not-found.tsx` cannot read route params, so the locale is unavailable here.
 * It renders in the default locale rather than guessing — and the header and
 * footer above it are still the ones the locale layout chose, so the page does
 * not visually change language.
 */
export default function PropertyNotFound() {
  const locale = isLocale(defaultLocale) ? defaultLocale : "fr";
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-32">
      <EmptyState
        title={dict.properties.notFoundTitle}
        description={dict.properties.notFoundBody}
        action={
          <Link
            href={toPublicPath("/properties", locale)}
            className={cn(buttonVariants({ variant: "default" }))}
          >
            {dict.properties.browseAll}
          </Link>
        }
      />
    </div>
  );
}
