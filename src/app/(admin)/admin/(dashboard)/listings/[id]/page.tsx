import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { defaultLocale, locales, toPublicPath } from "@/core/i18n";
import { ADMIN_PREFIX } from "@/core/session-cookie";
import {
  PhotographManager,
  PropertyEditor,
  PublicationControls,
  getListingForEditor,
} from "@/features/properties";

export const metadata: Metadata = { title: "Modifier un bien" };

/**
 * One listing, editable.
 *
 * The publication controls sit **outside** the editor form rather than inside
 * it: HTML forbids a form within a form, so a publish button inside the editor
 * would either submit the editor or need JavaScript to work at all.
 */
export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getListingForEditor(id);
  if (!listing) notFound();

  const french = listing.translations[defaultLocale];
  const untranslated = locales.filter((locale) => !listing.translations[locale]);
  /*
   * The address a visitor uses, not the one the app router sees: the proxy
   * rewrites `/fr/biens/x` onto `/fr/properties/x`, and pasting the internal
   * path to somebody would 404 for them.
   *
   * `toPublicPath` adds the locale itself, so its argument must not carry one.
   * Passing `/fr/properties/…` produced `/fr/fr/properties/…` — a link that
   * rendered, looked right, and 404d. Found in a screenshot, because no test
   * clicked it; there is one now.
   */
  const publicUrl = french ? toPublicPath(`/properties/${french.slug}`, defaultLocale) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`${ADMIN_PREFIX}/listings`}
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          ← Tous les biens
        </Link>
        <h1 className="font-serif text-3xl">{french?.title ?? "Sans titre"}</h1>
        <p className="text-muted-foreground text-sm">
          {listing.reference}
          {untranslated.length > 0 ? (
            <>
              {" · "}
              {/*
               * Named in as many words rather than left to a badge. The spec is
               * explicit that she has to see which listings are French-only, or
               * she will not know what is waiting for a translator — and the
               * public site says nothing about it, by design.
               */}
              <span>Publié en français seulement</span>
            </>
          ) : null}
        </p>
      </div>

      <PublicationControls listing={listing} />

      {listing.publication === "published" && publicUrl ? (
        <p className="text-muted-foreground text-sm">
          En ligne :{" "}
          <Link href={publicUrl} className="underline underline-offset-4">
            {publicUrl}
          </Link>
        </p>
      ) : null}

      <PropertyEditor listing={listing} />

      <PhotographManager listing={listing} />
    </div>
  );
}
