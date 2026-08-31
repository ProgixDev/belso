import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { displayCurrency } from "@/core/currency";
import { type Locale, toPublicPath } from "@/core/i18n";
import { formatApproxPrice, formatArea, formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { altFor } from "../lib";
import type { LocalizedProperty } from "../types";

/**
 * One result in the listings grid (AC-3).
 *
 * The shape is the one every property portal converges on, because it answers
 * the questions in the order a buyer asks them: what is it and how old, what
 * does it cost, where is it, how big, and how current is this. Read top to
 * bottom it is a sentence; scanned down a column it is four aligned rows.
 *
 * Strings arrive as a `labels` bag rather than being looked up here: this slice
 * may not import the i18n slice, so `app` resolves the dictionary and passes
 * down only what this component renders.
 */
export type PropertyCardLabels = {
  /** The property type, already translated ("Villa", "Riad"). */
  type: string;
  bedsShort: string;
  bathsShort: string;
  parkingShort: string;
  perMonth: string;
  reference: string;
  listedOn: string;
  forSale: string;
  forRent: string;
  agency: string;
  statusUnderOffer: string;
  statusSold: string;
  statusRented: string;
};

/**
 * Four glyphs, drawn here rather than pulled in.
 *
 * The project has no icon dependency and does not need one for four marks at
 * 14px. They are stroked in `currentColor` so they take the muted foreground
 * with their labels, and `aria-hidden` because the number beside each one
 * already says what it is.
 */
const icon = "h-3.5 w-3.5 shrink-0";
const strokes = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function BedIcon() {
  return (
    <svg viewBox="0 0 24 24" className={icon} aria-hidden="true" {...strokes}>
      <path d="M3 18v-7a1 1 0 0 1 1-1h9a4 4 0 0 1 4 4v4" />
      <path d="M3 14h18v4" />
      <path d="M6.5 10V8.5A1.5 1.5 0 0 1 8 7h2" />
    </svg>
  );
}

function BathIcon() {
  return (
    <svg viewBox="0 0 24 24" className={icon} aria-hidden="true" {...strokes}>
      <path d="M3 12h18v2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" />
      <path d="M6 12V6a2 2 0 0 1 4 0" />
      <path d="M6 18l-1 2M18 18l1 2" />
    </svg>
  );
}

/** Corner brackets: surface, without pretending to be a floor plan. */
function AreaIcon() {
  return (
    <svg viewBox="0 0 24 24" className={icon} aria-hidden="true" {...strokes}>
      <path d="M4 9V4h5" />
      <path d="M15 4h5v5" />
      <path d="M20 15v5h-5" />
      <path d="M9 20H4v-5" />
    </svg>
  );
}

/** A P in a rounded square — the one glyph nobody has to be taught. */
function ParkingIcon() {
  return (
    <svg viewBox="0 0 24 24" className={icon} aria-hidden="true" {...strokes}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M10 17V8h3a2.5 2.5 0 0 1 0 5h-3" />
    </svg>
  );
}

export function PropertyCard({
  property,
  labels,
  locale,
  variant = "full",
  /** The first row of cards is above the fold; the rest should not fight it for bandwidth. */
  priority = false,
}: {
  property: LocalizedProperty;
  labels: PropertyCardLabels;
  locale: Locale;
  /**
   * `full` is the catalogue card: everything a buyer compares on, reference and
   * publication date included. `quiet` drops that last row for the shelves that
   * are an invitation rather than a search result — the home page and the row
   * under a listing. A reference number is what you quote once you are already
   * interested; on a teaser it is administration in a place meant to seduce.
   */
  variant?: "full" | "quiet";
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

  /*
   * Land has no built area, no bedrooms and no parking, so the row is built
   * from what the listing actually has rather than printing four zeros — which
   * reads as missing data instead of as the point of the listing.
   */
  const surface = property.builtArea > 0 ? property.builtArea : (property.landArea ?? 0);
  const facts = [
    property.bedrooms > 0 && {
      key: "beds",
      glyph: <BedIcon />,
      value: `${property.bedrooms} ${labels.bedsShort}`,
    },
    property.bathrooms > 0 && {
      key: "baths",
      glyph: <BathIcon />,
      value: `${property.bathrooms} ${labels.bathsShort}`,
    },
    surface > 0 && { key: "area", glyph: <AreaIcon />, value: formatArea(surface, locale) },
    property.parking > 0 && {
      key: "parking",
      glyph: <ParkingIcon />,
      value: `${property.parking} ${labels.parkingShort}`,
    },
  ].filter((fact): fact is { key: string; glyph: React.ReactElement; value: string } =>
    Boolean(fact),
  );

  return (
    <article
      className={cn(
        "group border-border/60 bg-card relative flex flex-col overflow-hidden rounded-2xl border",
        "hover:border-foreground/30 transition-colors duration-300 ease-out",
        "motion-reduce:transition-none",
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
            alt={altFor(cover.alt, locale)}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
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

      <div className="flex flex-1 flex-col gap-1.5 px-4 pt-4 pb-4">
        <p className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.16em] uppercase">
          {labels.type}
          {property.builtYear ? (
            <>
              <span aria-hidden="true"> · </span>
              {property.builtYear}
            </>
          ) : null}
        </p>

        <p className="text-[1.3rem] leading-none font-bold tracking-tight">
          {formatPrice(property.price, property.currency, locale)}
          {property.kind === "rent" ? (
            <span className="text-muted-foreground text-sm font-normal"> {labels.perMonth}</span>
          ) : null}
        </p>
        {/* AC-3: the converted value sits with the price, always marked approximate. */}
        {approx ? <p className="text-muted-foreground text-xs">{approx}</p> : null}

        <h3 className="mt-1 text-[0.95rem] leading-snug font-medium">
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
      </div>

      {facts.length > 0 ? (
        <ul className="border-border/60 text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5 text-xs">
          {facts.map((fact) => (
            <li key={fact.key} className="flex items-center gap-1.5">
              {fact.glyph}
              <span className="text-foreground/80 whitespace-nowrap">{fact.value}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {variant === "full" ? (
        <div className="border-border/60 text-muted-foreground flex items-end justify-between gap-3 border-t px-4 py-2.5 text-[11px]">
          <div className="min-w-0">
            <p className="truncate">
              {labels.reference} {property.reference}
            </p>
            <p className="truncate">{labels.agency}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-foreground/80 font-semibold">
              {property.kind === "rent" ? labels.forRent : labels.forSale}
            </p>
            {/*
             * The date it went up, not "3 days ago". The district pages are
             * statically generated, so a relative label would be baked at build
             * time and drift a day further from the truth every day after.
             */}
            <p>
              {labels.listedOn} {formatDate(property.listedAt, locale)}
            </p>
          </div>
        </div>
      ) : null}
    </article>
  );
}
