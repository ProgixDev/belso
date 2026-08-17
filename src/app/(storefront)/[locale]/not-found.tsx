import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { defaultLocale } from "@/core/i18n";
import { getDictionary } from "@/features/i18n";
import { cn } from "@/lib/utils";
import { PageShell } from "./_components/page-shell";

/**
 * Any storefront address that matches no route.
 *
 * `not-found.tsx` cannot read route params, so the locale is not available and
 * this renders in the default locale rather than guessing. It brings its own
 * `PageShell` because it sits above the `(content)` group and would otherwise
 * arrive as bare text on a blank page.
 */
export default function StorefrontNotFound() {
  const dict = getDictionary(defaultLocale);

  return (
    <PageShell locale={defaultLocale} dict={dict}>
      <div className="mx-auto w-full max-w-3xl px-6 py-32">
        <EmptyState
          title={dict.common.errorTitle}
          description={dict.common.errorBody}
          action={
            <Link href={`/${defaultLocale}`} className={cn(buttonVariants({ variant: "default" }))}>
              {dict.common.backHome}
            </Link>
          }
        />
      </div>
    </PageShell>
  );
}
