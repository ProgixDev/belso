"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import styles from "../cinematic-scroll.module.css";
import { aboutShots, scene } from "../data";
import type { CinematicCopy, HeroSearch } from "../types";
import { useCinematicScroll } from "../use-cinematic-scroll";

/**
 * The full-bleed scene plates are photoreal renders — the default quality of 75
 * bands their sky gradients badly. Declared in next.config.ts `images.qualities`.
 */
const PLATE_QUALITY = 90;

/** Inline styles here only ever alias a motion custom property to a per-item one. */
type CssVars = CSSProperties & Record<`--${string}`, string>;

const vars = (v: Record<`--${string}`, string>) => v as CssVars;

/**
 * Two beats: the hero, and the about sheet that closes it.
 *
 * It used to run six, over a 6600px runway — split frames, a residences bridge,
 * an amenities panel, a sliding card deck over a photo collage. Each spoke its
 * own motion language, and between them they held the scroll for four thousand
 * pixels to say what three static sections say better. Everything after about
 * is now ordinary page content, composed by the route.
 */
export function CinematicScroll({ search, copy }: { search: HeroSearch; copy: CinematicCopy }) {
  const { sectionRef, worldRef, galleryRef } = useCinematicScroll();

  return (
    <section
      ref={sectionRef}
      // A stable hook for the e2e specs, which have to reach in and read the
      // motion variables to know when a frame has settled. Keying them on the
      // accessible name instead would tie every scene assertion to the page's
      // language and to the exact wording of the copy.
      id="scene"
      className={`${styles.siteShell} ${styles.cinemaScroll}`}
      aria-label={copy.sceneLabel}
    >
      <div className={styles.stage}>
        <div ref={worldRef} className={styles.world}>
          <div className={styles.skyImg}>
            <Image
              src={scene.sky}
              alt=""
              aria-hidden="true"
              fill
              priority
              sizes="100vw"
              className={styles.slotImg}
              quality={PLATE_QUALITY}
            />
          </div>

          <h1 className={styles.heroTitle}>Belso</h1>

          <Image
            className={styles.forePlate}
            src={scene.housePlate}
            alt=""
            aria-hidden="true"
            fill
            priority
            sizes="100vw"
            quality={PLATE_QUALITY}
          />

          <div className={styles.crown} aria-hidden="true" />
          <div className={styles.shade} aria-hidden="true" />
        </div>

        <section className={styles.introCopy} aria-label={copy.heroLabel}>
          <div aria-hidden="true" className={styles.introVignette} />
          <div className={styles.heroColumn}>
            <div className={styles.heroStats}>
              {copy.stats.map((stat, i) => (
                <div
                  key={stat.label}
                  className={styles.heroStat}
                  style={vars({ "--stat-in": `var(--in-s${i + 1}, 1)` })}
                >
                  <div className={styles.heroStatValue}>{stat.value}</div>
                  <div className={styles.heroStatLabel}>{stat.label}</div>
                </div>
              ))}
            </div>
            <div className={styles.heroBlock}>
              <h2 className={styles.heroLede}>
                {copy.lede.map((line, i) => (
                  <span
                    key={line}
                    className={styles.heroLedeLine}
                    style={vars({ "--lede-in": `var(--in-l${i + 1}, 1)` })}
                  >
                    {line}
                  </span>
                ))}
              </h2>

              {/*
               * The site's primary action, so it is labelled rather than left
               * to a placeholder. `htmlFor` on a visible label instead of an
               * `sr-only` one: the string was already written, it was just
               * hidden from everyone who could see.
               *
               * A plain GET form, deliberately: it puts the visitor's words in
               * the URL (AC-2) and works before this client component has
               * hydrated — which on a page this animation-heavy is not a
               * hypothetical window.
               */}
              <div className={styles.heroSearchBlock}>
                <label className={styles.heroSearchLabel} htmlFor="hero-search">
                  {search.label}
                </label>

                <form
                  className={styles.heroSearch}
                  action={search.action}
                  method="get"
                  role="search"
                >
                  <input
                    className={styles.heroSearchInput}
                    id="hero-search"
                    name="q"
                    type="search"
                    placeholder={search.placeholder}
                    autoComplete="off"
                  />
                  <button className={styles.heroSearchSubmit} type="submit">
                    <span>{search.submitLabel}</span>
                    <span aria-hidden="true" className={styles.heroCtaMark}>
                      →
                    </span>
                  </button>
                </form>

                <p className={styles.heroSearchHint}>{search.hint}</p>
              </div>
            </div>
          </div>
        </section>

        <section
          className={styles.aboutPanel}
          data-chrome-tone="light"
          aria-label={copy.about.name}
        >
          {/*
           * A real section header, not a whispered label. The index, the name
           * and a rule running to the edge is the editorial convention for
           * "a new chapter starts here" — it announces the section without
           * competing with the headline underneath it.
           */}
          <header className={styles.aboutMasthead}>
            <span aria-hidden="true" className={styles.aboutIndex}>
              01
            </span>
            <h2 className={styles.aboutKicker}>{copy.about.name}</h2>
            <span aria-hidden="true" className={styles.aboutRule} />
            <span className={styles.aboutPlace}>{copy.about.place}</span>
          </header>

          <div className={styles.aboutBody}>
            <p className={styles.aboutStatement}>{copy.about.statement}</p>
            <div className={styles.aboutCopy}>
              <p className={styles.aboutLede}>{copy.about.lede}</p>
              <p>{copy.about.body}</p>
            </div>
          </div>

          <ul className={styles.aboutGallery} ref={galleryRef}>
            {aboutShots.map((shot) => (
              <li
                className={styles.aboutShot}
                key={shot.id}
                data-align={shot.align}
                style={vars({
                  "--shot-col": String(shot.column),
                  "--shot-span": String(shot.span),
                  "--shot-height": String(shot.height),
                  "--shot-delay": String(shot.delay),
                })}
              >
                <Image
                  src={shot.image}
                  alt={copy.about.shots[shot.id]}
                  fill
                  sizes="(max-width: 900px) 45vw, 26vw"
                  className={styles.slotImg}
                />
              </li>
            ))}
          </ul>

          <div className={styles.aboutFoot}>
            <dl className={styles.aboutFacts}>
              {copy.about.facts.map((fact) => (
                <div className={styles.aboutFact} key={fact.label}>
                  <dt className={styles.aboutFactValue}>{fact.value}</dt>
                  <dd className={styles.aboutFactLabel}>{fact.label}</dd>
                </div>
              ))}
            </dl>
            <span className={styles.aboutHint}>{copy.scrollHint}</span>
          </div>
        </section>
      </div>
    </section>
  );
}
