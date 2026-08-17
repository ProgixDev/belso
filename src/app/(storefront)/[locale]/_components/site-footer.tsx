import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/core/i18n";
import { site } from "@/core/site";
import type { Dictionary } from "@/features/i18n";
import { footerSections } from "./navigation";

/**
 * The scene's own sky plate, carried down to the foot of the page.
 *
 * It is anchored to its top edge because that is the moody end of it — the
 * lower two thirds are a lit skyline, palms and a road, which at this size read
 * as clutter behind type rather than atmosphere. Everything below the horizon
 * is cropped away.
 */
const SKY = "/design/belso-sky-bg.png";

/**
 * How far the shell is pulled back over the sky, top to bottom.
 *
 * The plate is a pale gold dusk — the *lightest* thing in the palette — so it
 * cannot sit under cream type unscreened; measured raw, the small caps came out
 * near 1:1. The scrim is what turns a photograph into a glow: enough shell to
 * hold contrast, little enough that the warmth still reaches the eye. It
 * deepens toward the bottom so the legal bar sits on near-solid ground.
 */
const SKY_SCRIM =
  "linear-gradient(180deg," +
  " color-mix(in oklab, var(--color-shell) 80%, transparent) 0%," +
  " color-mix(in oklab, var(--color-shell) 88%, transparent) 52%," +
  " color-mix(in oklab, var(--color-shell) 96%, transparent) 100%)";

/**
 * Storefront footer, on the shell the cinematic scene is mounted on.
 *
 * The page opens on that deep brown and now closes on it, so the film and the
 * site read as one surface rather than a scene bolted to a document. It is a
 * shade darker than the sections' ink, which is what stops the last band and
 * the footer merging into one undifferentiated slab where they meet.
 *
 * The wordmark is set large and alone here, as a signature. Everything else is
 * kept quiet — small caps at the same 10px/0.22em as the section mastheads, a
 * single hairline, and generous air — because a footer earns its weight by how
 * little it asks for, not how much it lists.
 */
export function SiteFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const sections = footerSections(locale, dict);

  return (
    <footer className="bg-shell text-shell-foreground relative isolate">
      {/* Decorative: the page already says where it is, in words. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
        <Image src={SKY} alt="" fill sizes="100vw" className="object-cover object-top" />
        <div className="absolute inset-0" style={{ background: SKY_SCRIM }} />
      </div>

      <div className="container-page py-[clamp(48px,8vh,104px)]">
        {/* Signature left, links right — the sections are a short list, and
         * stretching two of them across four columns leaves half the footer
         * empty, which reads as unfinished rather than spacious. */}
        <div className="grid gap-x-10 gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="font-[family-name:var(--font-archivo)] text-[clamp(2rem,4.6vw,3.6rem)] leading-none font-bold tracking-[0.055em] uppercase">
              Belso
            </p>
            <p className="text-shell-foreground/65 mt-5 max-w-xs text-sm leading-relaxed">
              {dict.footer.tagline}
            </p>
          </div>

          <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:col-span-6 lg:col-start-7">
            {sections.map((section) => (
              <nav key={section.title} aria-label={section.title}>
                <h2 className="text-shell-foreground/60 text-[10px] font-semibold tracking-[0.22em] uppercase">
                  {section.title}
                </h2>
                <ul className="mt-5 flex flex-col gap-3">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        /* Offset from a dark ground, so the ring is not
                         * swallowed by the surface it is drawn on. */
                        className="text-shell-foreground/85 hover:text-shell-foreground focus-visible:ring-ring rounded-sm text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--color-shell)] focus-visible:outline-none motion-reduce:transition-none"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
      </div>

      <div className="border-shell-foreground/15 border-t">
        <div className="container-page flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-6">
          <p className="text-shell-foreground/60 text-xs">
            © {new Date().getFullYear()} {site.name}. {dict.footer.rights}
          </p>
          <p className="text-shell-foreground/60 text-[10px] font-semibold tracking-[0.22em] uppercase">
            {dict.footer.place}
          </p>
        </div>
      </div>
    </footer>
  );
}
