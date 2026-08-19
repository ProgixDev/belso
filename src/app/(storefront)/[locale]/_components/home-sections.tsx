import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/motion";
import { displayCurrency } from "@/core/currency";
import type { Locale } from "@/core/i18n";
import type { Dictionary } from "@/features/i18n";
import {
  districtOrder,
  districts,
  type LocalizedProperty,
  PropertyCard,
} from "@/features/properties";
import { formatApproxPrice, formatArea, formatPrice } from "@/lib/format";
import { propertyCardLabels } from "./property-labels";
import { SectionMasthead, SectionStatement } from "./section-masthead";

/**
 * What the landing page says after the film ends.
 *
 * These replace four scroll-driven beats — split frames, a residences bridge,
 * an amenities panel and a sliding card deck — that between them held the
 * scroll for four thousand pixels. Three static sections say the same thing,
 * and every one of them is now a door to a real page rather than a scroll
 * position that only exists on this route.
 *
 * The rhythm alternates paper and ink so no two bands of the same ground sit
 * together: the shelf, then one listing on ink, the neighbourhoods, the
 * grounds, selling on ink, and the invitation to write.
 */

/**
 * The one call to action shape. Underlined at rest rather than on hover: it is
 * the only link in the section, so it has to look like one before it is touched.
 */
function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="focus-visible:ring-ring group inline-flex items-center gap-2 self-start rounded-sm border-b border-current pb-1 text-[11px] font-semibold tracking-[0.18em] uppercase focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
    >
      {children}
      <span
        aria-hidden="true"
        className="transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
      >
        →
      </span>
    </Link>
  );
}

/** Masthead · statement · copy · link — the shape every section below the scene takes. */
function Section({
  id,
  index,
  name,
  place,
  statement,
  lede,
  href,
  cta,
  tone = "paper",
  children,
}: {
  id: string;
  index: string;
  name: string;
  place: string;
  statement: string;
  lede: string;
  href: string;
  cta: string;
  tone?: "paper" | "ink";
  children?: React.ReactNode;
}) {
  const onInk = tone === "ink";

  return (
    <section
      id={id}
      className={`border-t py-[clamp(56px,9vh,120px)] ${
        onInk ? "bg-foreground text-background border-transparent" : "border-border"
      }`}
    >
      <div className="container-page">
        {/* The masthead leads, the statement follows a beat later, the prose
         * after that — the order a reader takes them in anyway. */}
        <Reveal distance={12}>
          <SectionMasthead index={index} name={name} place={place} tone={tone} />
        </Reveal>

        {/* The same 12-column grid the about sheet's copy sits on, so the
         * statement starts on the left edge and the prose on the eighth column
         * all the way down the page. */}
        <div className="mt-[clamp(28px,5vh,64px)] grid gap-x-6 gap-y-8 md:grid-cols-12">
          <Reveal delay={0.08} className="md:col-span-6">
            <SectionStatement>{statement}</SectionStatement>
          </Reveal>

          <Reveal delay={0.16} className="flex flex-col gap-6 md:col-span-5 md:col-start-8">
            <p
              className={`max-w-[46ch] text-[clamp(1.05rem,1.25vw,1.35rem)] leading-[1.45] ${
                onInk ? "text-background/85" : "text-foreground/90"
              }`}
            >
              {lede}
            </p>
            <SectionLink href={href}>{cta}</SectionLink>
          </Reveal>
        </div>

        {children ? <div className="mt-[clamp(36px,6vh,72px)]">{children}</div> : null}
      </div>
    </section>
  );
}

export function ResidencesSection({
  locale,
  dict,
  properties,
  href,
  districtsHref,
}: {
  locale: Locale;
  dict: Dictionary;
  /** A short shelf, chosen by the page. The full catalogue is one link away. */
  properties: LocalizedProperty[];
  href: string;
  /** The neighbourhood index — the other way into the catalogue. */
  districtsHref: string;
}) {
  const copy = dict.home.residences;

  return (
    <Section
      id="residences"
      index={copy.index}
      name={copy.name}
      place={copy.place}
      statement={copy.statement}
      lede={copy.lede}
      href={href}
      cta={copy.cta}
    >
      {properties.length > 0 ? (
        <ul className="grid gap-[clamp(16px,1.6vw,26px)] sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property, index) => (
            // Staggered along the row: three cards arriving together read as a
            // block appearing, one after another reads as a shelf being filled.
            <Reveal as="li" key={property.id} delay={index * 0.09}>
              {/* `quiet`: no reference, no agency, no publication date. This is
               * an invitation, not a search result — that row belongs on the
               * catalogue page, where someone is comparing. */}
              <PropertyCard
                property={property}
                locale={locale}
                variant="quiet"
                labels={{ ...propertyCardLabels(dict), type: dict.propertyType[property.type] }}
              />
            </Reveal>
          ))}
        </ul>
      ) : null}

      {/*
       * Three cards is a sample, not a catalogue. The neighbourhoods are the
       * other way in — for the visitor who does not yet know what they want but
       * does know they are choosing between the medina and the Palmeraie.
       */}
      <Reveal
        as="nav"
        delay={0.2}
        aria-label={dict.districts.title}
        className="border-border/60 mt-[clamp(32px,5vh,56px)] border-t pt-[clamp(20px,3vh,32px)]"
      >
        {/* The label sits above the row rather than inside it. As the first
         * list item it was a word of a different size and colour in a line of
         * ten place names, and the wrap broke ragged around it. */}
        <Link
          href={districtsHref}
          className="focus-visible:ring-ring text-foreground/50 hover:text-foreground/80 inline-block rounded-sm text-[10px] font-semibold tracking-[0.22em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none motion-reduce:transition-none"
        >
          {dict.districts.title}
        </Link>

        <ul className="mt-[clamp(12px,1.6vh,18px)] flex flex-wrap items-baseline gap-x-[clamp(18px,2vw,34px)] gap-y-2">
          {districtOrder.map((id) => (
            <li key={id}>
              <Link
                href={`${districtsHref}/${id}`}
                className="focus-visible:ring-ring rounded-sm font-serif text-[1.05rem] hover:opacity-70 focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
              >
                {districts[id].copy[locale].name}
              </Link>
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  );
}

export function GroundsSection({ dict, href }: { dict: Dictionary; href: string }) {
  const copy = dict.home.grounds;

  return (
    <Section
      id="grounds"
      index={copy.index}
      name={copy.name}
      place={copy.place}
      statement={copy.statement}
      lede={copy.lede}
      href={href}
      cta={copy.cta}
    >
      {/* A list, not a row of icon cards: these are facts about the place, and
       * four of them do not need four boxes to be read. */}
      <ul className="border-border grid gap-px border-t sm:grid-cols-2 lg:grid-cols-4">
        {copy.items.map((item, index) => (
          <Reveal
            as="li"
            key={item}
            delay={index * 0.07}
            distance={10}
            className="border-border border-b py-5 pr-6 text-[0.95rem] leading-snug sm:border-b-0 sm:py-6"
          >
            {item}
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}

export function EnquireSection({ dict, href }: { dict: Dictionary; href: string }) {
  const copy = dict.home.enquire;

  return (
    <Section
      id="enquire"
      index={copy.index}
      name={copy.name}
      place={copy.place}
      statement={copy.statement}
      lede={copy.lede}
      href={href}
      cta={copy.cta}
    />
  );
}

/**
 * One listing, given the room the shelf cannot give it.
 *
 * The shelf answers "what have you got"; this answers "what would you show me
 * first". It is the page's one large photograph outside the film, and the only
 * beat where a single property is the subject rather than one of three.
 *
 * **Everything it says comes from the property.** The heading is the listing's
 * own title, the standfirst its opening paragraph, the figures its figures — so
 * there is no copy here to fall out of date with the catalogue, and no claim
 * that has to stay true of whichever listing is chosen.
 */
export function FeaturedSection({
  locale,
  dict,
  property,
  href,
}: {
  locale: Locale;
  dict: Dictionary;
  property: LocalizedProperty;
  href: string;
}) {
  const copy = dict.home.featured;
  const labels = propertyCardLabels(dict);
  const cover = property.media[0];
  const approx = formatApproxPrice(property.price, property.currency, displayCurrency, locale);
  const opening = property.description.split("\n\n")[0] ?? "";
  const surface = property.builtArea > 0 ? property.builtArea : (property.landArea ?? 0);

  const facts = [
    property.bedrooms > 0 ? `${property.bedrooms} ${labels.bedsShort}` : null,
    property.bathrooms > 0 ? `${property.bathrooms} ${labels.bathsShort}` : null,
    surface > 0 ? formatArea(surface, locale) : null,
    property.parking > 0 ? `${property.parking} ${labels.parkingShort}` : null,
  ].filter((fact): fact is string => Boolean(fact));

  return (
    <section
      id="featured"
      className="bg-foreground text-background border-t border-transparent py-[clamp(56px,9vh,120px)]"
    >
      <div className="container-page">
        <Reveal distance={12}>
          <SectionMasthead
            index={copy.index}
            name={copy.name}
            /* The caption is the property's own address rather than a fixed
             * line, so the masthead says where this one actually is. */
            place={`${property.district} · ${property.city}`}
            tone="ink"
          />
        </Reveal>

        <div className="mt-[clamp(28px,5vh,64px)] grid items-center gap-x-10 gap-y-8 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            {/*
             * The photograph is a second route to the same page, so it is
             * hidden from assistive technology and taken out of the tab order:
             * the heading below is the link that gets announced, and two stops
             * to one destination is noise to anyone tabbing through.
             */}
            <Link
              href={href}
              tabIndex={-1}
              aria-hidden="true"
              className="bg-background/10 block aspect-[4/3] overflow-hidden rounded-2xl"
            >
              {cover ? (
                <Image
                  src={cover.url}
                  alt=""
                  width={cover.width}
                  height={cover.height}
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  className="h-full w-full object-cover"
                />
              ) : null}
            </Link>
          </Reveal>

          <Reveal delay={0.12} className="flex flex-col gap-4 lg:col-span-5">
            <p className="text-background/55 text-[10.5px] font-semibold tracking-[0.16em] uppercase">
              {dict.propertyType[property.type]}
              {property.builtYear ? (
                <>
                  <span aria-hidden="true"> · </span>
                  {property.builtYear}
                </>
              ) : null}
            </p>

            <h3 className="max-w-[16ch] text-[clamp(1.6rem,2.8vw,2.6rem)] leading-[1.05] font-bold tracking-[-0.02em]">
              <Link
                href={href}
                className="focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
              >
                {property.title}
              </Link>
            </h3>

            <p className="text-[1.35rem] leading-none font-semibold">
              {formatPrice(property.price, property.currency, locale)}
              {property.kind === "rent" ? (
                <span className="text-background/60 text-sm font-normal"> {labels.perMonth}</span>
              ) : null}
              {approx ? (
                <span className="text-background/60 ml-3 text-sm font-normal">{approx}</span>
              ) : null}
            </p>

            <p className="text-background/80 max-w-[46ch] text-[1.02rem] leading-[1.6]">
              {opening}
            </p>

            {facts.length > 0 ? (
              <p className="text-background/60 text-sm">
                {facts.map((fact, index) => (
                  <span key={fact}>
                    {index > 0 ? <span aria-hidden="true"> · </span> : null}
                    {fact}
                  </span>
                ))}
              </p>
            ) : null}

            <div className="mt-2">
              <SectionLink href={href}>{copy.cta}</SectionLink>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** How many neighbourhoods the home page shows before sending you to the index. */
const DISTRICT_SHELF = 4;

/**
 * The neighbourhood writing, given a section rather than a strip.
 *
 * The strip under the shelf is a shortcut for someone who already knows which
 * name they want. This is for the visitor who does not: it shows what four of
 * them are actually for, in the same words the pages themselves use.
 */
export function DistrictsSection({
  locale,
  dict,
  href,
}: {
  locale: Locale;
  dict: Dictionary;
  href: string;
}) {
  const copy = dict.home.districts;

  return (
    <Section
      id="quartiers"
      index={copy.index}
      name={copy.name}
      place={copy.place}
      statement={copy.statement}
      /* Borrowed from the index rather than written again: the promise made
       * here is the one that page keeps. */
      lede={dict.districts.lede}
      href={href}
      cta={copy.cta}
    >
      <ul className="grid gap-x-8 gap-y-[clamp(20px,3vh,32px)] sm:grid-cols-2 lg:grid-cols-4">
        {districtOrder.slice(0, DISTRICT_SHELF).map((id, index) => {
          const district = districts[id].copy[locale];
          return (
            <Reveal as="li" key={id} delay={index * 0.07}>
              <Link
                href={`${href}/${id}`}
                className="focus-visible:ring-ring border-border hover:border-foreground/40 group flex h-full flex-col gap-2 rounded-sm border-t pt-5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none motion-reduce:transition-none"
              >
                <h3 className="font-serif text-[clamp(1.4rem,2.2vw,1.85rem)] leading-none font-semibold">
                  {district.name}
                </h3>
                <p className="text-foreground/75 text-[0.95rem] leading-[1.55]">{district.lede}</p>
              </Link>
            </Reveal>
          );
        })}
      </ul>
    </Section>
  );
}

/**
 * The other half of the business, on the page an owner actually lands on.
 *
 * Selling is not in the header — four items is what a 390px screen holds — so
 * without this the only route to it was the footer. The four steps are the
 * seller's page's own, titles only: enough to show there is a method, not so
 * much that the page has already been read.
 */
export function SellSection({ dict, href }: { dict: Dictionary; href: string }) {
  const copy = dict.home.sell;

  return (
    <Section
      id="vendre"
      index={copy.index}
      name={copy.name}
      place={copy.place}
      statement={dict.sell.statement}
      lede={dict.sell.lede}
      href={href}
      cta={copy.cta}
      tone="ink"
    >
      <ol className="grid gap-x-8 gap-y-[clamp(18px,2.5vh,28px)] sm:grid-cols-2 lg:grid-cols-4">
        {dict.sell.steps.map((step, index) => (
          <Reveal as="li" key={step.title} delay={index * 0.07}>
            <div className="border-background/20 flex flex-col gap-2 border-t pt-4">
              <span
                aria-hidden="true"
                className="text-background/40 font-serif text-[1.1rem] leading-none [font-variant-numeric:lining-nums]"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="font-serif text-[1.25rem] leading-none font-semibold">{step.title}</h3>
            </div>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}
