"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { isLocale } from "@/core/i18n";
import { getDictionary } from "@/features/i18n";
import { logger } from "@/lib/logger";

/**
 * Error boundaries are client components and cannot await `params`, so the
 * locale comes from `useParams`. It falls back to French rather than English:
 * this is the default locale, and an error screen is the worst place to also
 * change language on someone.
 */
export default function DistrictError({
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
    logger.error("district page failed", { digest: error.digest, message: error.message });
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
