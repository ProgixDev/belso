import { describe, expect, it } from "vitest";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "./password";

/**
 * scrypt is slow on purpose — that is the mechanism — so this file is slower
 * than the rest of the suite by design. Each `hashPassword` is roughly 85ms.
 */

describe("hashPassword", () => {
  it("produces a self-describing hash that verifies", async () => {
    const stored = await hashPassword("un mot de passe correct");

    expect(stored).toMatch(/^scrypt\$32768\$8\$1\$[^$]+\$[^$]+$/);
    await expect(verifyPassword("un mot de passe correct", stored)).resolves.toBe(true);
  });

  it("salts, so the same password never hashes the same way twice", async () => {
    const [a, b] = await Promise.all([hashPassword("identique"), hashPassword("identique")]);

    // Without a salt these would match, and one leaked hash would identify
    // everybody who chose the same password.
    expect(a).not.toBe(b);
    await expect(verifyPassword("identique", a)).resolves.toBe(true);
    await expect(verifyPassword("identique", b)).resolves.toBe(true);
  });
});

describe("verifyPassword", () => {
  it("refuses the wrong password", async () => {
    const stored = await hashPassword("le bon");
    await expect(verifyPassword("le mauvais", stored)).resolves.toBe(false);
  });

  it("uses the parameters recorded in the row, not today's constants", async () => {
    /*
     * The reason the parameters are stored at all. This row was written with a
     * far cheaper cost than `PARAMS` uses now; raising the cost must not lock
     * out the accounts that already exist.
     */
    const stored = await hashPassword("historique");
    const [, , r, p, salt, key] = stored.split("$");
    const cheaper = ["scrypt", "16384", r, p, salt, key].join("$");

    // Different N, so the derived key differs and this is a clean refusal —
    // the point is that it is refused rather than throwing on unexpected
    // parameters, which is what a hard-coded N would do.
    await expect(verifyPassword("historique", cheaper)).resolves.toBe(false);
    await expect(verifyPassword("historique", stored)).resolves.toBe(true);
  });

  it("refuses a malformed hash instead of throwing", async () => {
    // A corrupt or hand-edited row must be a failed sign-in, not a 500 that
    // takes the whole back-office down.
    for (const bad of ["", "not-a-hash", "scrypt$32768$8$1$onlyfive", "bcrypt$1$2$3$4$5"]) {
      await expect(verifyPassword("anything", bad)).resolves.toBe(false);
    }
  });
});

describe("verifyAgainstDummy", () => {
  it("always fails, and costs what a real verify costs", async () => {
    const stored = await hashPassword("une vraie");

    const realStart = performance.now();
    await verifyPassword("une tentative", stored);
    const real = performance.now() - realStart;

    const dummyStart = performance.now();
    await expect(verifyAgainstDummy("une tentative")).resolves.toBe(false);
    const dummy = performance.now() - dummyStart;

    /*
     * The assertion is deliberately loose — a timing test on a shared CI box
     * that demanded tight bounds would be the flakiest thing in the repo. What
     * it has to catch is the failure that matters: an unknown email returning
     * in a millisecond while a real one takes a quarter of a second, which
     * answers the question the error message refuses to. An order of magnitude
     * is far below that signal and far above the noise.
     */
    expect(dummy).toBeGreaterThan(real / 10);
  });
});
