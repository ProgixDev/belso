import { describe, expect, it } from "vitest";
import { locales } from "@/core/i18n";
import { districtIds, districtOrder, districts, isDistrictId } from "./districts";
import { propertyFixtures } from "./fixtures";

/**
 * The district pages are content, and content rots quietly: a locale added to
 * `locales` or a district added to the vocabulary leaves a page that renders
 * with an empty heading and no error anywhere. These make that a failing test
 * rather than a page nobody looks at.
 */

describe("district vocabulary", () => {
  it("orders every district exactly once", () => {
    expect([...districtOrder].sort()).toEqual([...districtIds].sort());
    expect(new Set(districtOrder).size).toBe(districtOrder.length);
  });

  it("recognises its own ids and nothing else", () => {
    for (const id of districtIds) expect(isDistrictId(id)).toBe(true);
    expect(isDistrictId("marrakech")).toBe(false);
    expect(isDistrictId("")).toBe(false);
    expect(isDistrictId(undefined)).toBe(false);
  });
});

describe("district content", () => {
  it("is written in every locale the site ships", () => {
    for (const id of districtIds) {
      for (const locale of locales) {
        const copy = districts[id].copy[locale];
        expect(copy, `${id} has no ${locale} copy`).toBeDefined();
        expect(copy.name.length, `${id}.${locale} has no name`).toBeGreaterThan(0);
        expect(copy.lede.length, `${id}.${locale} has no lede`).toBeGreaterThan(20);
      }
    }
  });

  it("gives each district more than a caption to justify its page", () => {
    for (const id of districtIds) {
      for (const locale of locales) {
        const paragraphs = districts[id].copy[locale].body.split("\n\n").filter(Boolean);
        expect(paragraphs.length, `${id}.${locale} is a single paragraph`).toBeGreaterThanOrEqual(
          2,
        );
        expect(districts[id].copy[locale].body.length).toBeGreaterThan(400);
      }
    }
  });
});

describe("districts against the catalogue", () => {
  it("places every listing in a district that exists", () => {
    for (const property of propertyFixtures) {
      expect(isDistrictId(property.districtId), `${property.reference}`).toBe(true);
    }
  });

  it("never opens a district page on a single card", () => {
    // One listing under a page of editorial reads as a site with nothing in it,
    // whichever district the visitor happens to land on first.
    const counts = new Map<string, number>();
    for (const property of propertyFixtures) {
      counts.set(property.districtId, (counts.get(property.districtId) ?? 0) + 1);
    }
    for (const id of districtIds) {
      expect(counts.get(id) ?? 0, `${id} has too few listings`).toBeGreaterThanOrEqual(2);
    }
  });
});
