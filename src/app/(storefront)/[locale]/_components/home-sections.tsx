import Link from "next/link";
import { Reveal } from "@/components/motion";
import type { Locale } from "@/core/i18n";
import type { Dictionary } from "@/features/i18n";
import {
  districtOrder,
  districts,
  type LocalizedProperty,
  PropertyCard,
} from "@/features/properties";
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
 * The rhythm is paper · ink · paper, so the middle band separates the two
 * without needing motion to do it.
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
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property, index) => (
            // Staggered along the row: three cards arriving together read as a
            // block appearing, one after another reads as a shelf being filled.
            <Reveal as="li" key={property.id} delay={index * 0.09}>
              <PropertyCard
                property={property}
                locale={locale}
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
        className="border-border/60 mt-[clamp(28px,4vh,48px)] border-t pt-[clamp(18px,2.5vh,28px)]"
      >
        <ul className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <li className="text-foreground/50 text-[10px] font-semibold tracking-[0.22em] uppercase">
            <Link
              href={districtsHref}
              className="focus-visible:ring-ring rounded-sm hover:opacity-70 focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
            >
              {dict.districts.title}
            </Link>
          </li>
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
      tone="ink"
    >
      {/* A list, not a row of icon cards: these are facts about the place, and
       * four of them do not need four boxes to be read. */}
      <ul className="border-background/20 grid gap-px border-t sm:grid-cols-2 lg:grid-cols-4">
        {copy.items.map((item, index) => (
          <Reveal
            as="li"
            key={item}
            delay={index * 0.07}
            distance={10}
            className="border-background/20 border-b py-5 pr-6 text-[0.95rem] leading-snug sm:border-b-0 sm:py-6"
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
