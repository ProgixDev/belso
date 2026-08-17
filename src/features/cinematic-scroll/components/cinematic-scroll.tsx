"use client";

import Image from "next/image";
import type { CSSProperties, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import styles from "../cinematic-scroll.module.css";
import {
  aboutFacts,
  aboutShots,
  collage,
  heroLede,
  scene,
  sceneAnchors,
  sights,
  stats,
} from "../data";
import type { HeroSearch } from "../types";
import { useCinematicScroll } from "../use-cinematic-scroll";

/**
 * The full-bleed scene plates are photoreal renders — the default quality of 75
 * bands their sky gradients badly. Declared in next.config.ts `images.qualities`.
 */
const PLATE_QUALITY = 90;

/** Inline styles here only ever alias a motion custom property to a per-item one. */
type CssVars = CSSProperties & Record<`--${string}`, string>;

const vars = (v: Record<`--${string}`, string>) => v as CssVars;

/** The card list is tripled so the slider can loop in both directions. */
const loopedSights = [...sights, ...sights, ...sights];

export function CinematicScroll({ search }: { search: HeroSearch }) {
  const {
    sectionRef,
    worldRef,
    trackRef,
    controlsRef,
    galleryRef,
    activeSight,
    moveSlider,
    selectSight,
  } = useCinematicScroll(sights.length);

  const onCardKeyDown = (event: KeyboardEvent<HTMLElement>, index: number) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectSight(index);
  };

  return (
    <main id="main" className={styles.siteShell}>
      <section
        ref={sectionRef}
        className={styles.cinemaScroll}
        id="cinema"
        aria-label="Belso cinematic scroll story"
      >
        {/*
         * Scroll targets for the nav. They sit in the runway rather than in the
         * sticky stage, because only the runway has real scroll positions —
         * see `sceneAnchors` in ../data.
         */}
        {sceneAnchors.map((anchor) => (
          <span
            key={anchor.id}
            id={anchor.id}
            className={styles.sceneAnchor}
            style={vars({ "--anchor-at": String(anchor.at) })}
            aria-hidden="true"
          />
        ))}

        <div className={styles.stage}>
          <div ref={worldRef} className={styles.world}>
            <div className={styles.skyImg}>
              <Image
                src={scene.sky}
                alt="Sky backdrop"
                fill
                priority
                sizes="100vw"
                className={styles.slotImg}
                quality={PLATE_QUALITY}
              />
            </div>

            <div className={styles.backStack}>
              <div className={styles.backFour} />

              <section className={styles.sightsSlider} aria-label="Belso residences slider">
                <div ref={trackRef} className={styles.sightsTrack}>
                  {loopedSights.map((sight, index) => (
                    <article
                      key={`${sight.id}-${index}`}
                      className={cn(styles.sightCard, index === activeSight && styles.isActive)}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open ${sight.title}`}
                      onClick={() => selectSight(index)}
                      onKeyDown={(event) => onCardKeyDown(event, index)}
                    >
                      <span className={styles.sightKicker}>{sight.kicker}</span>
                      <div className={styles.sightPin}>
                        <Image
                          src={sight.image}
                          alt={sight.imageAlt}
                          fill
                          sizes="68px"
                          className={styles.slotImg}
                        />
                      </div>
                      <h3>{sight.title}</h3>
                      <p>{sight.blurb}</p>
                    </article>
                  ))}
                </div>
              </section>

              <div className={styles.creamSheet} data-chrome-tone="light">
                <div className={styles.creamHead}>
                  <span className={styles.creamEyebrow}>
                    <span aria-hidden="true" className={styles.creamEyebrowRule} />
                    Private retreat
                  </span>
                  <div className={styles.creamStats}>
                    {stats.map((stat) => (
                      <div key={stat.value}>
                        <div className={styles.creamStatValue}>{stat.value}</div>
                        <div className={styles.creamStatLabel}>
                          {stat.label[0]}
                          <br />
                          {stat.label[1]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={styles.creamGrid}>
                  {collage.map((tile) => (
                    <div
                      key={tile.id}
                      className={styles.creamTile}
                      style={{
                        aspectRatio: tile.aspectRatio,
                        marginTop: tile.marginTop,
                        gridColumn: tile.span ? `span ${tile.span}` : undefined,
                      }}
                    >
                      <Image
                        src={tile.image}
                        alt={tile.imageAlt}
                        fill
                        sizes="(max-width: 640px) 33vw, (max-width: 1100px) 25vw, 17vw"
                        className={styles.slotImg}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div ref={controlsRef} className={styles.sightsControls} aria-label="Slider controls">
              <button
                className={styles.sightNav}
                type="button"
                aria-label="Previous residence"
                onClick={() => moveSlider(-1)}
              >
                ←
              </button>
              <button
                className={styles.sightNav}
                type="button"
                aria-label="Next residence"
                onClick={() => moveSlider(1)}
              >
                →
              </button>
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

            <div className={`${styles.splitFrame} ${styles.splitFrameLeft}`}>
              <Image
                src={scene.doorLeft}
                alt="Tall exterior detail"
                fill
                sizes="50vw"
                className={styles.slotImg}
                quality={PLATE_QUALITY}
              />
            </div>
            <div className={`${styles.splitFrame} ${styles.splitFrameRight}`}>
              <Image
                src={scene.doorRight}
                alt="Tall garden view"
                fill
                sizes="50vw"
                className={styles.slotImg}
                quality={PLATE_QUALITY}
              />
            </div>

            <div className={styles.bridgeImg}>
              <Image
                src={scene.heroTall}
                alt="Belso seen in three-quarter view"
                fill
                sizes="100vw"
                className={styles.slotImg}
                quality={PLATE_QUALITY}
              />
            </div>

            <div className={styles.frameTwoImg}>
              <Image
                src={scene.reveal}
                alt="Interior close-up"
                fill
                sizes="130vw"
                className={styles.slotImg}
                quality={PLATE_QUALITY}
              />
            </div>

            <div className={styles.crown} aria-hidden="true" />
            <div className={styles.shade} aria-hidden="true" />
          </div>

          <section className={styles.introCopy} aria-label="Belso overview">
            <div aria-hidden="true" className={styles.introVignette} />
            <div className={styles.heroColumn}>
              <div className={styles.heroStats}>
                {stats.map((stat, i) => (
                  <div
                    key={stat.value}
                    className={styles.heroStat}
                    style={vars({ "--stat-in": `var(--in-s${i + 1}, 1)` })}
                  >
                    <div className={styles.heroStatValue}>{stat.value}</div>
                    <div className={styles.heroStatLabel}>
                      {stat.label[0]}
                      <br />
                      {stat.label[1]}
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.heroBlock}>
                <h2 className={styles.heroLede}>
                  {heroLede.map((word, i) => (
                    <span
                      key={word}
                      className={styles.heroLedeLine}
                      style={vars({ "--lede-in": `var(--in-l${i + 1}, 1)` })}
                    >
                      {word}
                    </span>
                  ))}
                </h2>

                {/*
                 * A plain GET form, deliberately: it puts the visitor's words in
                 * the URL (AC-2) and works before this client component has
                 * hydrated — which on a page this animation-heavy is not a
                 * hypothetical window.
                 */}
                <form
                  className={styles.heroSearch}
                  action={search.action}
                  method="get"
                  role="search"
                >
                  <label className="sr-only" htmlFor="hero-search">
                    {search.label}
                  </label>
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
                      »
                    </span>
                  </button>
                </form>
              </div>
            </div>
            <p className={styles.heroNote}>
              A modern residence inspired by warm stone, desert calm, and the lasting beauty of
              timeless design.
            </p>
          </section>

          <section className={styles.aboutPanel} data-chrome-tone="light" aria-label="About Belso">
            {/*
             * A real section header, not a whispered label. The index, the name
             * and a rule running to the edge is the editorial convention for
             * "a new chapter starts here" — it announces the section without
             * competing with the headline underneath it.
             */}
            <div className={styles.aboutClip}>
              <div className={styles.aboutInner}>
                <header className={styles.aboutMasthead}>
                  <span aria-hidden="true" className={styles.aboutIndex}>
                    01
                  </span>
                  <h2 className={styles.aboutKicker}>About Belso</h2>
                  <span aria-hidden="true" className={styles.aboutRule} />
                  <span className={styles.aboutPlace}>Marrakech · Palmeraie</span>
                </header>

                <div className={styles.aboutBody}>
                  <p className={styles.aboutStatement}>A quieter kind of address</p>
                  <div className={styles.aboutCopy}>
                    <p className={styles.aboutLede}>
                      Belso is a private address in the Palmeraie — thirty residences drawn in warm
                      stone, shaded timber and still water.
                    </p>
                    <p>
                      It is built for the way Marrakech actually lives: slowly, in the shade, with
                      the doors open. Every home is dual-aspect and turned away from the road, so
                      light crosses it all day and the city never quite arrives.
                    </p>
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
                        alt={shot.imageAlt}
                        fill
                        sizes="(max-width: 900px) 45vw, 26vw"
                        className={styles.slotImg}
                      />
                    </li>
                  ))}
                </ul>

                <div className={styles.aboutFoot}>
                  <dl className={styles.aboutFacts}>
                    {aboutFacts.map((fact) => (
                      <div className={styles.aboutFact} key={fact.label}>
                        <dt className={styles.aboutFactValue}>{fact.value}</dt>
                        <dd className={styles.aboutFactLabel}>{fact.label}</dd>
                      </div>
                    ))}
                  </dl>
                  <span className={styles.aboutHint}>Scroll to explore</span>
                </div>
              </div>
            </div>
          </section>

          <section
            className={`${styles.storyPanel} ${styles.storyPanelBridge}`}
            aria-label="Residence details"
          >
            <span className={styles.bridgeEyebrow}>The residences</span>
            <h2>A slower way to live.</h2>
            <p className={styles.bridgeLede}>
              Thirty homes arranged around a shaded courtyard, each one dual-aspect, each one drawn
              for long light and quiet air.
            </p>
            <dl className={styles.facts}>
              <div>
                <dt>184</dt>
                <dd>Smallest residence, sqm</dd>
              </div>
              <div>
                <dt>2027</dt>
                <dd>Scheduled delivery</dd>
              </div>
            </dl>
          </section>

          <section
            className={`${styles.storyPanel} ${styles.storyPanelBazaar}`}
            aria-label="Amenities details"
          >
            <span className={styles.bazaarEyebrow}>Amenities</span>
            <h2>Everything close, nothing near.</h2>
            <p className={styles.bazaarLede}>
              A lap pool under the colonnade, a spa cut into stone, and a private lane to the
              harbour — all inside the walls.
            </p>
            <button className={styles.noteButton} type="button">
              <span>Request the brochure</span>
              <span aria-hidden="true" className={styles.noteButtonMark}>
                ↗
              </span>
            </button>
          </section>
        </div>
      </section>
    </main>
  );
}
