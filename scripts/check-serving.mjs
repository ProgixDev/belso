#!/usr/bin/env node
/**
 * Decide whether a container is fit to replace the one already serving
 * (spec 013, AC-6).
 *
 * **A 200 is not the question.** Point the application at an unreachable
 * database and it comes up healthy, answers 200, and serves the "listings
 * cannot be loaded" page — which is correct, deliberate and tested
 * (spec 010, AC-5, `db-down.spec.ts`). The site staying honest during an
 * outage is a feature. Replacing a working catalogue with that page because a
 * deploy had the wrong password is not.
 *
 * So the probe asks the only question that separates the two: **is there a
 * catalogue in there.**
 *
 * It reads the sitemap rather than a rendered page. The catalogue is streamed
 * RSC, so its listings arrive escaped inside a flight payload and grepping the
 * HTML for them is unreliable — a lesson from T-03, where a working site looked
 * empty. The sitemap is plain XML generated from the same database and says
 * plainly how many listings exist.
 *
 * Usage: pnpm ops:check-serving [url]        (default http://127.0.0.1:3000)
 */
const BASE = (process.argv[2] ?? process.env.BELSO_PROBE_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);

/** A site with a database has listings in its sitemap; one without has none. */
const MINIMUM_LISTINGS = 1;

/**
 * `user:password` for the basic-auth gate the site sits behind until it is
 * allowed to be public (spec 013, T-08b — `scripts/vps/belso-gate.sh`). Absent
 * once the gate is removed at launch, which is why it is optional here rather
 * than required.
 */
const AUTH = process.env.BELSO_PROBE_AUTH;

async function get(path) {
  const response = await fetch(`${BASE}${path}`, {
    redirect: "follow",
    headers: AUTH ? { Authorization: `Basic ${Buffer.from(AUTH).toString("base64")}` } : undefined,
  });
  return { status: response.status, body: await response.text() };
}

try {
  console.log(`check-serving: probing ${BASE}`);

  const robots = await get("/robots.txt");
  if (robots.status === 401) {
    // Named, because a 401 here means the probe is misconfigured and the site is
    // fine — the opposite conclusion from every other failure in this file.
    console.error(`\ncheck-serving ✗ the site is behind the pre-launch gate (401).`);
    console.error(`  Pass the credential: BELSO_PROBE_AUTH="$(ssh belso-vps`);
    console.error(`  'cat /docker/belso/gate-credentials.txt')" pnpm ops:check-serving ${BASE}`);
    process.exit(1);
  }
  if (robots.status !== 200) {
    console.error(`check-serving ✗ the server is not answering at all (${robots.status})`);
    process.exit(1);
  }
  console.log("check-serving: the server answers");

  const sitemap = await get("/sitemap.xml");
  if (sitemap.status !== 200) {
    /*
     * What an unreachable database actually produces. The sitemap is generated
     * from the catalogue, so the query throws and the route 500s — while the
     * pages a visitor sees still answer 200 with the outage copy. That split is
     * exactly why the probe reads this and not a rendered page.
     */
    console.error(`\ncheck-serving ✗ the sitemap failed (${sitemap.status}).`);
    console.error(`  The site is answering, so this is the database and not the server:`);
    console.error(`  the catalogue query threw. Check DATABASE_URL in the deploy environment.`);
    process.exit(1);
  }

  /*
   * Listing URLs specifically, not any URL. The sitemap still lists the static
   * pages — home, about, contact, the legal documents — when the database is
   * unreachable, so counting entries would pass on an empty catalogue.
   */
  const listings = [...sitemap.body.matchAll(/<loc>[^<]*\/(?:biens|properties)\/[^<]+<\/loc>/g)];

  if (listings.length < MINIMUM_LISTINGS) {
    console.error(`\ncheck-serving ✗ the site answers and has no catalogue.`);
    console.error(
      `  ${listings.length} listing URLs in the sitemap, expected at least ${MINIMUM_LISTINGS}.`,
    );
    console.error(`  This is what a wrong DATABASE_URL looks like: healthy container, 200s,`);
    console.error(`  and every visitor told the listings cannot be loaded.`);
    process.exit(1);
  }

  console.log(`check-serving: ${listings.length} listings in the sitemap`);
  console.log(`\ncheck-serving ✓ this container is serving a catalogue, not an apology`);
} catch (error) {
  console.error(`check-serving ✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
