import { describe, expect, it } from "vitest";
import { locales } from "@/core/i18n";
import { propertyFixtures } from "./properties";

/**
 * These assert the *variance* the fixtures exist to provide, not the content.
 *
 * docs/design/quality-bar.md rejects UI proven only against uniform data, and
 * the failure mode is quiet: someone tidies the fixtures, every description
 * becomes two neat lines, the card grid looks perfect, and the layout breaks
 * the day real copy arrives. This test is what makes that tidy-up fail loudly.
 */

describe("fixture integrity", () => {
  it("gives every listing a unique id, reference and per-locale slug", () => {
    const ids = propertyFixtures.map((p) => p.id);
    const references = propertyFixtures.map((p) => p.reference);
    expect(new Set(ids).size).toBe(propertyFixtures.length);
    expect(new Set(references).size).toBe(propertyFixtures.length);

    for (const locale of locales) {
      const slugs = propertyFixtures
        .map((p) => p.translations[locale]?.slug)
        .filter((slug): slug is string => Boolean(slug));
      expect(new Set(slugs).size, `duplicate ${locale} slug`).toBe(slugs.length);
    }
  });

  it("always has French text to fall back to", () => {
    for (const property of propertyFixtures) {
      expect(property.translations.fr, `${property.reference} has no French`).toBeDefined();
    }
  });

  it("gives every photo an alt text in both locales", () => {
    for (const property of propertyFixtures) {
      for (const media of property.media) {
        for (const locale of locales) {
          expect(media.alt[locale]?.length, `${media.id} missing ${locale} alt`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("fixture variance (docs/design/quality-bar.md)", () => {
  it("carries at least one listing with no English translation", () => {
    const untranslated = propertyFixtures.filter((p) => !p.translations.en);
    expect(untranslated.length).toBeGreaterThanOrEqual(1);
  });

  it("carries at least one listing that is no longer available", () => {
    const unavailable = propertyFixtures.filter((p) => p.status !== "available");
    expect(unavailable.length).toBeGreaterThanOrEqual(1);
    expect(unavailable.map((p) => p.status)).toContain("sold");
  });

  it("varies photo count across the range a gallery must handle", () => {
    const counts = propertyFixtures.map((p) => p.media.length);
    expect(Math.min(...counts)).toBeLessThanOrEqual(3);
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(15);
  });

  it("varies description length by at least an order of magnitude", () => {
    const lengths = propertyFixtures
      .map((p) => p.translations.fr?.description.length ?? 0)
      .filter((n) => n > 0);
    expect(Math.min(...lengths)).toBeLessThan(150);
    expect(Math.max(...lengths)).toBeGreaterThan(900);
  });

  it("covers more than one listing kind, currency and property type", () => {
    expect(new Set(propertyFixtures.map((p) => p.kind)).size).toBeGreaterThan(1);
    expect(new Set(propertyFixtures.map((p) => p.currency)).size).toBeGreaterThan(1);
    expect(new Set(propertyFixtures.map((p) => p.type)).size).toBeGreaterThanOrEqual(5);
  });

  it("includes a listing with no bedrooms, which breaks a villa-shaped key-facts row", () => {
    expect(propertyFixtures.some((p) => p.bedrooms === 0)).toBe(true);
  });

  it("gives every building a year, and land none", () => {
    // The card prints "VILLA · 2006" from this. A missing year on a house
    // silently drops half the eyebrow; a year on a plot of land is a fiction.
    for (const property of propertyFixtures) {
      if (property.type === "land") {
        expect(
          property.builtYear,
          `${property.reference} is land with a build year`,
        ).toBeUndefined();
      } else {
        expect(property.builtYear, `${property.reference} has no build year`).toBeGreaterThan(1800);
      }
    }
  });

  it("carries a listing with no parking, because the medina has none", () => {
    expect(propertyFixtures.some((p) => p.parking === 0)).toBe(true);
    expect(propertyFixtures.some((p) => p.parking > 0)).toBe(true);
  });
});
