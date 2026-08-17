import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { displayCurrency } from "@/core/currency";
import { type Locale, toPublicPath } from "@/core/i18n";
import { formatApproxPrice, formatArea, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LocalizedProperty } from "../types";

/**
 * One result in the listings grid (AC-3).
 *
 * Strings arrive as a `labels` bag rather than being looked up here: this slice
 * may not import the i18n slice, so `app` resolves the dictionary and passes
 * down only what this component renders.
 */
export type PropertyCardLabels = {
  bedrooms: string;
  builtArea: string;
  perMonth: string;
  statusUnderOffer: string;
  statusSold: string;
  statusRented: string;
  type: string;
};

export function PropertyCard({
  property,
  labels,
  locale,
  /** The first row of cards is above the fold; the rest should not fight it for bandwidth. */
  priority = false,
}: {
  property: LocalizedProperty;
  labels: PropertyCardLabels;
  locale: Locale;
  priority?: boolean;
}) {
  const href = toPublicPath(`/properties/${property.slug}`, locale);
  const cover = property.media[0];
  const approx = formatApproxPrice(property.price, property.currency, displayCurrency, locale);

  const statusLabel =
    property.status === "underOffer"
      ? labels.statusUnderOffer
      : property.status === "sold"
        ? labels.statusSold
        : property.status === "rented"
          ? labels.statusRented
          : null;

  return (
    <article
      className={cn(
        "group border-border/70 bg-card relative flex flex-col overflow-hidden rounded-xl border",
        // The focus ring belongs to the whole card, because the whole card is
        // the target. `has-[a:focus-visible]` rather than `focus-within` so it
        // does not light up on a mouse click.
        "has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-offset-2",
      )}
    >
      <div className="bg-muted relative aspect-[4/3] overflow-hidden">
        {cover ? (
          <Image
            src={cover.url}
            alt={cover.alt[locale]}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            priority={priority}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : null}

        {statusLabel ? (
          <div className="absolute top-3 left-3">
            {/* Never colour alone: the word is what says "sold", in greyscale and aloud. */}
            <Badge variant="default">{statusLabel}</Badge>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
          {labels.type}
        </p>

        <h3 className="text-base leading-snug font-semibold tracking-tight">
          {/*
           * The whole card is the target — a stretched link keeps the hit area
           * large without nesting the image inside the anchor, which would make
           * the accessible name the alt text plus the title.
           *
           * The link's own outline is suppressed because it would draw a box
           * around the title text alone, mid-card. The card draws the ring
           * instead (see the `has-[a:focus-visible]` rules above) — suppressing
           * it here *without* that replacement left keyboard users with no
           * focus indicator on any listing at all, which is how this was found.
           */}
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
            {property.title}
          </Link>
        </h3>

        <p className="text-muted-foreground text-sm">
          {property.district}, {property.city}
        </p>

        <div className="mt-auto pt-2">
          <p className="text-base font-semibold tracking-tight">
            {formatPrice(property.price, property.currency, locale)}
            {property.kind === "rent" ? (
              <span className="text-muted-foreground font-normal"> {labels.perMonth}</span>
            ) : null}
          </p>
          {approx ? <p className="text-muted-foreground mt-0.5 text-xs">{approx}</p> : null}

          <p className="text-muted-foreground mt-3 text-xs">
            {property.bedrooms > 0 ? (
              <>
                {property.bedrooms} {labels.bedrooms.toLowerCase()}
                <span aria-hidden="true"> · </span>
              </>
            ) : null}
            {/*
             * Land has no built area. Falling back to the plot keeps the row
             * from rendering "0 m²", which reads as missing data rather than
             * as the point of the listing.
             */}
            {formatArea(
              property.builtArea > 0 ? property.builtArea : (property.landArea ?? 0),
              locale,
            )}
          </p>
        </div>
      </div>
    </article>
  );
}
