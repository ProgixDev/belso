import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/motion";
import type { Locale } from "@/core/i18n";
import { site } from "@/core/site";
import type { Dictionary } from "@/features/i18n";
import { footerSections } from "./navigation";

/** The scene's own sky plate, carried down to the foot of the page. */
const SKY = "/design/belso-sky-bg.png";

/**
 * Which slice of the plate the footer shows.
 *
 * The footer is a wide, short box, so `object-cover` picks a horizontal band
 * out of a nearly square image and this number chooses which one. 55% lands on
 * open sky and soft cloud, with a palm frond in the far corner. Above it the
 * haze goes grey; below it a city skyline, a row of palms and a road come in,
 * which at footer height read as clutter behind type rather than as weather.
 */
const SKY_POSITION = "50% 55%";

/**
 * A wash of the page's own paper over the plate.
 *
 * The plate alone cannot carry type. It looks like it can at desktop widths —
 * measured 4.6:1 at its tightest on a 1440px viewport — but the footer is a
 * wide short box on a desktop and a tall narrow one on a phone, and
 * `object-cover` answers those with completely different crops. At 390px it
 * fits the plate by height, so the whole picture is in frame including the
 * road at its foot, and the copyright line lands on asphalt at 1.12:1.
 *
 * So the veil is not decoration, it is what makes the photograph a surface.
 * Swept across six viewports from 390 to 1920: 45% leaves four failures, 50%
 * leaves one, 55% clears everywhere with its tightest at 5.05:1. It is the
 * paper the rest of the page is made of, so the sky reads as seen through the
 * page rather than pasted behind it — and it stays a sky, which the deep-brown
 * scrim it replaced did not.
 */
const SKY_VEIL = "color-mix(in oklab, var(--color-background) 55%, transparent)";

/**
 * Storefront footer, on the scene's own sky.
 *
 * The page opens on that sky and now ends on it. The first pass screened the
 * plate behind a deep-brown scrim so cream type could sit on it, which held the
 * contrast but hid the thing it was carrying — the sky was technically present
 * and visually gone. The type flipped instead: ink on the plate, the same way
 * the hero sets its lede in dark brown against this same photograph.
 *
 * That has a consequence worth knowing. On flat colour, secondary type is made
 * quiet by fading it toward the ground. Over a photograph that is not
 * available — the ground is not one value, and every run set below full ink
 * failed somewhere in the viewport sweep. Hierarchy here is carried by size,
 * weight and tracking alone.
 *
 * The wordmark is set as a signature and everything else is kept quiet — small
 * caps at the same 10px/0.22em as the section mastheads, a single hairline —
 * because a footer earns its weight by how little it asks for, not how much it
 * lists. It was taking 465px of a desktop screen and 761px of a 844px phone,
 * which is a page of its own at the foot of every page; the air came down and
 * the two link columns now sit side by side at every width.
 *
 * It aligns to `--frame-inset`, like the header. The two bracket the page, so
 * they cannot disagree about where its edges are — before, the footer sat in a
 * 1280px column while the header spanned the window, and on the listings grid
 * the two started 282px apart.
 */
export function SiteFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const sections = footerSections(locale, dict);

  return (
    <footer className="text-foreground border-foreground/15 relative isolate border-t">
      {/* Decorative: the page already says where it is, in words. `bg-background`
       * on the frame, not the footer, so the plate has something to fail onto. */}
      <div aria-hidden="true" className="bg-background absolute inset-0 -z-10 overflow-hidden">
        <Image
          src={SKY}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: SKY_POSITION }}
        />
        <div data-sky-veil className="absolute inset-0" style={{ background: SKY_VEIL }} />
      </div>

      <div className="container-bleed py-[clamp(28px,4vh,52px)]">
        {/* Signature left, links right — the sections are a short list, and
         * stretching two of them across four columns leaves half the footer
         * empty, which reads as unfinished rather than spacious. */}
        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <p className="font-[family-name:var(--font-archivo)] text-[clamp(1.5rem,3vw,2.4rem)] leading-none font-bold tracking-[0.055em] uppercase">
              Belso
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed">{dict.footer.tagline}</p>
          </Reveal>

          <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:col-span-6 lg:col-start-7">
            {/* The `<nav>` keeps its own element and label — the reveal wraps it
             * rather than replacing it, or the landmark loses its name. */}
            {sections.map((section, index) => (
              <Reveal key={section.title} delay={0.1 + index * 0.08}>
                <nav aria-label={section.title}>
                  <h2 className="text-[10px] font-semibold tracking-[0.22em] uppercase">
                    {section.title}
                  </h2>
                  <ul className="mt-3 flex flex-col gap-2">
                    {section.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          /* Offset from the plate rather than tinted into it — a
                           * focus ring drawn on a photograph needs the gap to be
                           * seen at all. */
                          className="hover:text-foreground/65 focus-visible:ring-ring rounded-sm text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none motion-reduce:transition-none"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      <div className="border-foreground/20 border-t">
        <div className="container-bleed flex flex-wrap items-center justify-between gap-x-8 gap-y-2 py-3.5">
          <p className="text-xs">
            © {new Date().getFullYear()} {site.name}. {dict.footer.rights}
          </p>
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase">
            {dict.footer.place}
          </p>
        </div>
      </div>
    </footer>
  );
}
