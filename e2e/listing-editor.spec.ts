import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import sharp from "sharp";
import { shot } from "./utils/shot";

/**
 * CUJ-06 — the client publishes a listing without a developer.
 *
 * The journey spec 010 built the database for and spec 011 exists to close:
 * sign in, create, write it in French, publish, see it live, translate it
 * later, rename it, take it off the site. Every one of those is an acceptance
 * criterion and every one of them is asserted **at the public pages**, not at
 * the repository — which is the lesson from spec 010, where every
 * repository-level test passed while half the site served a build-time
 * snapshot.
 *
 * Serial, and stateful on purpose: these steps are one story and each depends
 * on the last. Running them in parallel would mean six listings and no journey.
 *
 * The listing it creates is deleted afterwards, as the owner — `belso_editor`
 * deliberately cannot delete a listing (AC-4), which is the point of AC-4 and
 * the reason cleanup is the harness's job.
 */

const url = process.env.DATABASE_URL;
const email = process.env.BELSO_E2E_ADMIN_EMAIL;
const password = process.env.BELSO_E2E_ADMIN_PASSWORD;

test.skip(
  !url || !email || !password,
  "requires DATABASE_URL and a back-office account (BELSO_E2E_ADMIN_*)",
);
test.describe.configure({ mode: "serial" });

/** Unique per run, so a crashed run leaves nothing for the next one to trip on. */
const MARK = `e2e${Date.now().toString(36)}`;
const REFERENCE = `E2E-${MARK}`;
const SLUG = `villa-${MARK}`;
const RENAMED = `villa-${MARK}-renommee`;
const TITLE = `Villa d’essai ${MARK}`;
const DESCRIPTION =
  "Une villa d’essai, avec une description assez longue pour passer la validation de publication.";

let sql: pg.Client;

test.beforeAll(async () => {
  sql = new pg.Client({ connectionString: url });
  await sql.connect();
});

test.afterAll(async () => {
  await sql.query("delete from properties where reference = $1", [REFERENCE]);
  await sql.end();
});

async function signIn(page: Page) {
  await page.goto("/admin/listings");
  if (page.url().includes("/admin/connexion")) {
    await page.getByLabel("Adresse e-mail").fill(email as string);
    await page.getByLabel("Mot de passe").fill(password as string);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/admin\/listings/);
  }
}

/** The id of the listing under test, read once it exists. */
async function listingId(): Promise<string> {
  const { rows } = await sql.query("select id from properties where reference = $1", [REFERENCE]);
  return rows[0]?.id as string;
}

test("@cuj CUJ-06: she creates a listing, and it is a draft nobody can see (AC-2)", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Nouveau bien" }).click();

  await page.getByLabel("Référence").fill(REFERENCE);
  await page.getByLabel("Prix").fill("4250000");
  await page.getByLabel("Chambres").fill("4");
  await page.getByLabel("Salles de bain").fill("3");
  await page.getByLabel("Stationnements").fill("2");
  await page.getByLabel("Surface habitable (m²)").fill("320");

  await page.locator("#fr-title").fill(TITLE);
  await page.locator("#fr-description").fill(DESCRIPTION);
  await page.locator("#fr-district").fill("Palmeraie");
  await page.locator("#fr-city").fill("Marrakech");
  await page.locator("#fr-slug").fill(SLUG);

  await page.getByRole("button", { name: "Créer le brouillon" }).click();

  /*
   * Creating lands on the new listing, not back on an empty form. That is the
   * assertion, not a convenience: an emptied "Nouveau bien" page reads as a
   * failure, and pressing the button again makes a second listing.
   */
  await expect(page).toHaveURL(/\/admin\/listings\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  await shot(page, "60-editor-draft-created");

  /*
   * AC-2 names five surfaces, and the sitemap is the one that was missed in
   * spec 010 — sixty fixture URLs went to Google before anybody looked. It is
   * checked here for the same reason it is checked in `draft-listing.spec.ts`:
   * a filtered query is not an absent `<loc>`.
   */
  expect((await page.goto(`/fr/biens/${SLUG}`))?.status()).toBe(404);

  await page.goto("/fr/biens");
  await expect(page.getByText(TITLE)).toHaveCount(0);

  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain(SLUG);
});

test("she publishes it, and it appears in French on both sites (AC-3)", async ({ page }) => {
  await signIn(page);
  await page.goto(`/admin/listings/${await listingId()}`);

  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByRole("button", { name: "Repasser en brouillon" })).toBeVisible();
  await shot(page, "61-editor-published");

  /*
   * The "En ligne" link, checked in two parts: where it points, and that the
   * destination is really the listing.
   *
   * It was built from `toPublicPath` with a locale already in its argument, so
   * it read `/fr/fr/properties/…` — a link that looked entirely correct on
   * screen and 404d. Nothing caught it because nothing looked at its target.
   *
   * **Read and navigated rather than clicked**, after clicking proved flaky:
   * the publish action re-renders this tree, so a click can land on an element
   * React is in the middle of replacing and quietly does nothing. The first
   * attempt to paper over that — asserting the heading straight after the
   * click — was worse than useless, because the admin page's own `h1` is the
   * listing title too, so it passed on the page it had not left.
   */
  const publicHref = await page.getByRole("link", { name: new RegExp(SLUG) }).getAttribute("href");
  expect(publicHref).toBe(`/fr/biens/${SLUG}`);

  await page.goto(publicHref as string);
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();

  /*
   * And T16's assertion: under `pnpm start` this page is served from a
   * production build, so "publishing makes it appear" is a claim about the
   * running site rather than about a dev server that recompiles on every
   * request.
   */
  await expect(page.getByText(DESCRIPTION)).toBeVisible();

  await page.goto("/fr/biens");
  await expect(page.getByText(TITLE).first()).toBeVisible();

  // English: French text, and the honest note saying so. Not a blank page, and
  // not a listing missing from the English catalogue.
  await page.goto(`/en/properties/${SLUG}`);
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  await expect(page.getByText(/isn’t translated yet/)).toBeVisible();
  await shot(page, "62-published-english-note");
});

test("she adds the English later, without republishing (AC-3b)", async ({ page }) => {
  await signIn(page);

  // The French page as it stands, so it can be proved not to move.
  await page.goto(`/fr/biens/${SLUG}`);
  const frenchBefore = await page.locator("main").innerText();

  await page.goto(`/admin/listings/${await listingId()}`);
  await page.locator("#en-title").fill(`Test villa ${MARK}`);
  await page.locator("#en-description").fill("An English description, written later.");
  await page.locator("#en-district").fill("Palmeraie");
  await page.locator("#en-city").fill("Marrakech");
  await page.locator("#en-slug").fill(`villa-en-${MARK}`);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("status")).toContainText("Enregistré");

  await page.goto(`/en/properties/villa-en-${MARK}`);
  await expect(page.getByRole("heading", { name: `Test villa ${MARK}` })).toBeVisible();
  // The note is gone because there is now a translation, not because anything
  // republished the listing.
  await expect(page.getByText(/isn’t translated yet/)).toHaveCount(0);

  await page.goto(`/fr/biens/${SLUG}`);
  // The half of AC-3b that is easy to miss: adding a translation must not
  // disturb the page that was already correct.
  expect(await page.locator("main").innerText()).toBe(frenchBefore);
  await shot(page, "63-english-added");
});

/**
 * A photograph of a plausible size, built rather than committed.
 *
 * One is 4000px — what a camera actually produces, and the only way to prove
 * the resize happens on the file she would really upload. The rest are small so
 * that fifteen of them do not make this test the slowest thing in the suite;
 * what their number proves is the sequential upload loop, not the resizing.
 */
async function photograph(index: number, big = false): Promise<Buffer> {
  const size = big ? 4000 : 600;
  return sharp({
    create: {
      width: size,
      height: Math.round(size * 0.66),
      channels: 3,
      background: { r: 40 + index * 10, g: 120, b: 90 },
    },
  })
    .jpeg()
    .toBuffer();
}

test("she uploads fifteen photographs, orders them, and says what they show (AC-6)", async ({
  page,
}) => {
  /*
   * Longer than the default thirty seconds, because fifteen uploads are fifteen
   * requests, each decoding and re-encoding an image — one of them at 4000px.
   * That is the behaviour under test, not slowness to be tuned away: they are
   * sequential on purpose, so that a gallery upload cannot starve the public
   * site on a two-core box.
   */
  test.setTimeout(120_000);
  await signIn(page);
  await page.goto(`/admin/listings/${await listingId()}`);

  // TEMPORARY probe
  /*
   * Wait for the gallery to be interactive before driving it.
   *
   * Everything earlier in this journey is a `<form action>`, which submits
   * without JavaScript — so nothing before this point ever proved the page was
   * hydrated. This is the first step that depends on an event handler, and
   * without the wait it selected fifteen files against a form React had not
   * attached to yet and nothing happened at all.
   */
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const input = document.querySelector('input[type="file"]');
          return input ? Object.keys(input).some((k) => k.startsWith("__react")) : false;
        }),
      { timeout: 20_000, message: "the gallery never became interactive" },
    )
    .toBe(true);

  const files = await Promise.all(Array.from({ length: 15 }, (_, i) => photograph(i, i === 0)));

  await page.setInputFiles(
    'input[type="file"]',
    files.map((buffer, i) => ({
      name: `photographie-${i}.jpg`,
      mimeType: "image/jpeg",
      buffer,
    })),
  );

  // Uploaded one request at a time, so the last one arriving is the signal that
  // all fifteen are in — not a spinner disappearing.
  await expect(page.getByRole("listitem")).toHaveCount(15, { timeout: 120_000 });
  await shot(page, "66-photographs-uploaded");

  /*
   * The first is the 4000px one. What is served must be the WebP master, at
   * the long edge the pipeline produces — not the camera file, and not the
   * original, which keeps its EXIF and is deliberately unreachable.
   */
  const src = await page.getByRole("listitem").first().locator("img").getAttribute("src");
  const served = new URL(src as string, "http://localhost:3000");
  const url = served.searchParams.get("url") ?? served.pathname;
  expect(url).toMatch(/^\/media\/[0-9a-f-]{36}\/master\.webp$/);

  const master = await page.request.get(url);
  expect(master.status()).toBe(200);
  expect(master.headers()["content-type"]).toBe("image/webp");

  // The original sits beside it on disk and is not addressable.
  expect((await page.request.get(url.replace("master.webp", "original.jpeg"))).status()).toBe(404);

  const CAPTION = "La piscine au crépuscule";
  const captionOf = (position: number) =>
    page.getByRole("listitem").nth(position).getByLabel("Description (français)").inputValue();

  /*
   * Captions and reordering are asserted separately, because they fail for
   * different reasons and a combined assertion cannot say which happened.
   */
  const first = page.getByRole("listitem").first();
  await first.getByLabel("Description (français)").fill(CAPTION);
  // Blurring is what saves it — clicking the next field is how she would.
  await first.getByLabel("Description (English)").click();

  // Scoped to the gallery: Next renders its own empty `role="alert"` route
  // announcer on every page, so a bare role query always matches one.
  const gallery = page.locator("fieldset", { has: page.getByText("Photographies") });
  expect(await gallery.locator("[role=alert]").allTextContents()).toEqual([]);

  /*
   * Waited on **in the database**, not on a message in the interface.
   *
   * The gallery does say "Enregistré." now — it said nothing at all before, and
   * a caption that saves invisibly is a caption she cannot trust. But that flag
   * stays true from the last successful action, which after fifteen uploads
   * means it is already on screen before the caption is even sent: waiting for
   * it proved nothing, and the reload below raced the request. The row
   * appearing is the fact; the message is a courtesy.
   */
  await expect
    .poll(
      async () => {
        const { rows } = await sql.query(
          `select a.alt from property_media_alt a
             join property_media m on m.id = a.media_id
            where m.property_id = (select id from properties where reference = $1)
              and a.locale = 'fr'`,
          [REFERENCE],
        );
        return rows[0]?.alt ?? null;
      },
      { timeout: 20_000, message: "the caption never reached the database" },
    )
    .toBe(CAPTION);

  await page.reload();
  // Survives a reload, which is what proves it reached the database rather than
  // only the input it was typed into.
  await expect.poll(() => captionOf(0), { timeout: 20_000 }).toBe(CAPTION);

  // `exact`, because "Descendre la photographie 1" is a substring of 10 to 15.
  await page.getByRole("button", { name: "Descendre la photographie 1", exact: true }).click();

  /*
   * The order is a fact in the database, so that is where it is checked — the
   * same reasoning as the caption. Asserting on the page alone cannot tell a
   * stored reorder from a list that merely looks rearranged, and it is the
   * stored one the public gallery renders from.
   *
   * The captioned photograph was first; one step down puts it at position 1.
   */
  await expect
    .poll(
      async () => {
        const { rows } = await sql.query(
          `select m.position from property_media m
             join property_media_alt a on a.media_id = m.id and a.locale = 'fr'
            where m.property_id = (select id from properties where reference = $1)`,
          [REFERENCE],
        );
        return rows[0]?.position ?? null;
      },
      { timeout: 20_000, message: "the reorder never reached the database" },
    )
    .toBe(1);

  await page.reload();
  // And the page renders that order back.
  expect(await captionOf(1)).toBe(CAPTION);

  await shot(page, "67-photographs-reordered");
});

test("she renames it, and the address she published still works (AC-5)", async ({ page }) => {
  await signIn(page);
  await page.goto(`/admin/listings/${await listingId()}`);

  await page.locator("#fr-slug").fill(RENAMED);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("status")).toContainText("Enregistré");

  await page.goto(`/fr/biens/${RENAMED}`);
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();

  /*
   * The old address, which is the whole criterion: every link the agency has
   * emailed, every crawler's index and every message an agent sent a buyer
   * still points at it. A 404 there is a lost enquiry.
   */
  await page.goto(`/fr/biens/${SLUG}`);
  await expect(page).toHaveURL(new RegExp(`${RENAMED}$`));
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  await shot(page, "64-renamed-old-address-redirects");
});

test("she takes it off the site, and nothing is destroyed (AC-4)", async ({ page }) => {
  await signIn(page);
  await page.goto(`/admin/listings/${await listingId()}`);

  await page.getByRole("button", { name: "Retirer du site" }).click();
  await expect(page.getByRole("button", { name: "Publier" })).toBeVisible();
  await shot(page, "65-archived");

  await page.goto("/fr/biens");
  await expect(page.getByText(TITLE)).toHaveCount(0);
  expect((await page.goto(`/fr/biens/${RENAMED}`))?.status()).toBe(404);

  // Still in the back-office, with its text and its history intact — "off the
  // site" is not "gone", and there is no delete button anywhere for it to be.
  await page.goto("/admin/listings");
  await expect(page.getByText(TITLE)).toBeVisible();

  const { rows } = await sql.query(
    `select
       (select count(*) from property_translations where property_id = p.id)::int as translations,
       (select count(*) from property_slug_history where property_id = p.id)::int as history
     from properties p where p.reference = $1`,
    [REFERENCE],
  );
  expect(rows[0]).toEqual({ translations: 2, history: 1 });
});
