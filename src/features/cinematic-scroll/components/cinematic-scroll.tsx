"use client";

import Image from "next/image";
import type { CSSProperties, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import styles from "../cinematic-scroll.module.css";
import { aboutFacts, aboutShots, collage, heroLede, navLinks, scene, sights, stats } from "../data";
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

export function CinematicScroll() {
  const { sectionRef, worldRef, trackRef, controlsRef, activeSight, moveSlider, selectSight } =
    useCinematicScroll(sights.length);

  const onCardKeyDown = (event: KeyboardEvent<HTMLElement>, index: number) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectSight(index);
  };

  return (
    <main className={styles.siteShell}>
      <section
        ref={sectionRef}
        className={styles.cinemaScroll}
        id="cinema"
        aria-label="Belso cinematic scroll story"
      >
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

            <header className={styles.siteHeader} aria-label="Primary navigation">
              <a className={styles.siteLogo} href="#cinema">
                Belso
              </a>
              <nav className={styles.siteNav} aria-label="Main menu">
                {navLinks.map((link, i) => (
                  <a
                    key={link.label}
                    className={styles.navLink}
                    href={link.href}
                    style={vars({ "--nav-in": `var(--in-n${i + 1}, 1)` })}
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
              <button className={styles.siteContact} type="button">
                <span>Contact</span>
                <span aria-hidden="true" className={styles.siteContactMark}>
                  ↗
                </span>
              </button>
            </header>

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

              <div className={styles.creamSheet}>
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
                <button className={styles.heroCta} type="button">
                  <span className={styles.heroCtaLabel}>Book a call</span>
                  <span aria-hidden="true" className={styles.heroCtaMark}>
                    »
                  </span>
                </button>
              </div>
            </div>
            <p className={styles.heroNote}>
              A modern residence inspired by warm stone, desert calm, and the lasting beauty of
              timeless design.
            </p>
          </section>

          <section className={styles.aboutPanel} id="about" aria-label="About Belso">
            <div className={styles.aboutEyebrow}>
              <span aria-hidden="true" className={styles.aboutEyebrowMark} />
              <span>About Belso</span>
            </div>
            <div className={styles.aboutBody}>
              <h2>A quieter kind of address</h2>
              <div className={styles.aboutCopy}>
                <p>
                  Belso is a private address in the Palmeraie — thirty residences drawn in warm
                  stone, shaded timber and still water. It is built for the way Marrakech actually
                  lives: slowly, in the shade, with the doors open.
                </p>
                <p>
                  Every home is dual-aspect and turned away from the road, so light crosses it all
                  day and the city never quite arrives. Heritage craft, held to a contemporary plan.
                </p>
              </div>
            </div>

            <ul className={styles.aboutGallery}>
              {aboutShots.map((shot) => (
                <li
                  className={styles.aboutShot}
                  key={shot.id}
                  style={vars({
                    "--shot-col": String(shot.column),
                    "--shot-span": String(shot.span),
                    "--shot-offset": String(shot.offset),
                    "--shot-delay": String(shot.delay),
                  })}
                >
                  <Image
                    src={shot.image}
                    alt={shot.imageAlt}
                    fill
                    sizes="(max-width: 900px) 40vw, 18vw"
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
          </section>

          <section
            className={`${styles.storyPanel} ${styles.storyPanelBridge}`}
            id="bridge"
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
            id="bazaar"
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
