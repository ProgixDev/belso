import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { defaultLocale, locales } from "@/core/i18n";
import { ADMIN_PREFIX } from "@/core/session-cookie";
import { listListingsForEditor } from "@/features/properties";

export const metadata: Metadata = { title: "Biens" };

/**
 * The catalogue as she sees it — drafts and archived listings included.
 *
 * The one screen that shows what the public site cannot, which is why it exists
 * at all: a draft is invisible everywhere else by design (AC-2), so without
 * this there is no way to find one again after closing the tab.
 */

const STATE = {
  draft: { label: "Brouillon", tone: "muted" },
  published: { label: "En ligne", tone: "accent" },
  archived: { label: "Retiré", tone: "outline" },
} as const;

export default async function ListingsPage() {
  const listings = await listListingsForEditor();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Biens</h1>
          <p className="text-muted-foreground text-sm">
            {listings.length} bien{listings.length > 1 ? "s" : ""}, brouillons compris.
          </p>
        </div>
        {/*
         * A styled link, not a `Button asChild` — this kit's Button has no
         * `asChild`, and navigating is a link's job. The classes match so the
         * two read as one control set.
         */}
        <Link
          href={`${ADMIN_PREFIX}/listings/nouveau`}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          Nouveau bien
        </Link>
      </div>

      {listings.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucun bien pour le moment. Créez le premier.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {listings.map((listing) => {
            const state = STATE[listing.publication];
            const french = listing.translations[defaultLocale];
            /*
             * Which languages exist, shown at a glance. The spec asks for it in
             * as many words: she has to be able to see which listings are
             * French-only, or she cannot know what is waiting for a translator.
             */
            const missing = locales.filter((locale) => !listing.translations[locale]);

            return (
              <li key={listing.id}>
                <Link
                  href={`${ADMIN_PREFIX}/listings/${listing.id}`}
                  className="border-border/60 hover:border-foreground/30 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-5 py-4 transition-colors"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {french?.title ?? "Sans titre"}
                    </span>
                    <span className="text-muted-foreground text-sm">{listing.reference}</span>
                  </span>

                  <Badge variant={state.tone}>{state.label}</Badge>

                  {missing.length > 0 ? (
                    <Badge variant="outline">
                      {missing.includes("en") ? "Français seul" : "Traduction manquante"}
                    </Badge>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
