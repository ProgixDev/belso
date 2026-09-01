#!/usr/bin/env node
/**
 * Decide whether the deployed back-office can actually be signed into
 * (spec 013, T-08).
 *
 * **The third deploy probe, and the only one that needs a credential.**
 * `check-media` proves the photographs survive a redeploy and `check-serving`
 * proves the storefront has a catalogue rather than an apology — both of which a
 * broken back-office passes cleanly. The editor is a separate database role on a
 * separate connection string (ADR-0010), so it fails separately: the site can
 * serve twenty listings perfectly while `DATABASE_EDITOR_URL` is wrong and the
 * one person the site was built for cannot get in.
 *
 * Drives a real browser rather than posting to the Server Action. The action id
 * is generated at build time, so a scripted POST either hard-codes an id that
 * breaks whenever an action is added, or invents one and proves nothing. What
 * this covers is the whole path — Traefik, the container, the session cookie,
 * the editor role's connection.
 *
 * Usage:
 *
 *   BELSO_ADMIN_EMAIL=sofia@belso.ma \
 *   BELSO_ADMIN_PASSWORD="$(ssh belso-vps 'cat /docker/belso/back-office-password.txt')" \
 *     pnpm ops:check-signin https://belso.ma
 *
 * The password comes from the environment, never an argument: an argument is
 * visible in `ps`. It is never printed, and nothing here logs the form contents.
 */
import { mkdirSync } from "node:fs";

import { chromium } from "@playwright/test";

const BASE = (process.argv[2] ?? process.env.BELSO_PROBE_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);

const EMAIL = process.env.BELSO_ADMIN_EMAIL;
const PASSWORD = process.env.BELSO_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("check-signin ✗ needs BELSO_ADMIN_EMAIL and BELSO_ADMIN_PASSWORD");
  process.exit(1);
}

/**
 * The basic-auth gate the site sits behind until it is allowed to be public
 * (spec 013, T-08b). Optional, because it disappears at launch — but without it
 * every check below fails on a 401 and reports the back-office as broken when
 * the only thing missing is the probe's own credential.
 */
const [gateUser, ...gateRest] = (process.env.BELSO_PROBE_AUTH ?? "").split(":");
const httpCredentials = gateUser ? { username: gateUser, password: gateRest.join(":") } : undefined;

const SHOTS = "artifacts/screenshots/013-belso-deploy";
mkdirSync(SHOTS, { recursive: true });

let failures = 0;
const check = (label, ok) => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures += 1;
};

const submit = async (page, password) => {
  await page.getByLabel("Adresse e-mail").fill(EMAIL);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
};

console.log(`check-signin: probing ${BASE}/admin`);

const browser = await chromium.launch();

try {
  /*
   * The wrong password first, and in its own browser context.
   *
   * Without a negative, "signed in" and "the form lets anyone through" look
   * identical. Sharing one context between the two attempts makes the second
   * submit race the first form's re-render, which cost an hour on the first
   * deploy: the correct password was reported as refused, and it had been
   * accepted.
   */
  const anon = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    httpCredentials,
  });
  const out = await anon.newPage();

  await out.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  check("signed out, /admin lands on the sign-in form", /\/admin\/connexion/.test(out.url()));
  await out.screenshot({ path: `${SHOTS}/70-live-signed-out.png`, fullPage: true });

  await submit(out, "not-the-password");

  // Waited for rather than sampled: the message arrives when the action answers,
  // and `isVisible()` at that instant reports on the form as it was before.
  const refused = await out
    .getByText(/incorrect/i)
    .waitFor({ state: "visible", timeout: 15000 })
    .then(
      () => true,
      () => false,
    );
  check("a wrong password is refused, and says so", refused && /connexion/.test(out.url()));
  await out.screenshot({ path: `${SHOTS}/71-live-sign-in-refused.png`, fullPage: true });
  await anon.close();

  const real = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    httpCredentials,
  });
  const page = await real.newPage();

  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await submit(page, PASSWORD);

  // Waited on the URL, not on networkidle. The action answers, React follows the
  // redirect, and the network can go quiet in between — which reads as a failed
  // sign-in for a sign-in that worked.
  const signedIn = await page.waitForURL(/\/admin$/, { timeout: 20000 }).then(
    () => true,
    () => false,
  );
  check("the real password signs in", signedIn);

  const session = (await real.cookies()).find((cookie) => /session/i.test(cookie.name));
  check(
    "a session cookie is set, httpOnly and secure",
    Boolean(session?.httpOnly && session?.secure),
  );
  await page.screenshot({ path: `${SHOTS}/72-live-signed-in.png`, fullPage: true });

  /*
   * Signed in is not the same as working. Everything above rides on the session
   * cookie; the catalogue below is read through `DATABASE_EDITOR_URL`, a
   * different role with a different credential, and it is the half a deploy is
   * most likely to get wrong.
   *
   * Counted by reference rather than by table row: this screen renders cards. A
   * selector that matches nothing returns 0, which reads exactly like an empty
   * catalogue — the failure the probe exists to catch, reported for the wrong
   * reason.
   */
  await page.goto(`${BASE}/admin/listings`, { waitUntil: "networkidle" });
  const listings = await page.getByText(/^BL-[0-9]{4}$/).count();
  check(`the editor sees the catalogue (${listings} listings)`, listings > 0);
  await page.screenshot({ path: `${SHOTS}/73-live-editor-catalogue.png`, fullPage: true });

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.waitForURL(/\/admin\/connexion/, { timeout: 20000 }).catch(() => {});
  check("signing out returns to the form", /\/admin\/connexion/.test(page.url()));
  await real.close();
} catch (error) {
  console.error(`check-signin ✗ ${error instanceof Error ? error.message : String(error)}`);
  failures += 1;
} finally {
  await browser.close();
}

console.log(
  failures === 0
    ? "\ncheck-signin ✓ the back-office is reachable, refuses a wrong password and reads the catalogue"
    : `\ncheck-signin ✗ ${failures} check(s) failed — screenshots in ${SHOTS}`,
);

process.exit(failures === 0 ? 0 : 1);
