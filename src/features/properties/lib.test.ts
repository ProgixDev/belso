import { describe, expect, it } from "vitest";
import { convert, displayCurrency } from "@/core/currency";
import { districts } from "./districts";
import { propertyFixtures } from "./fixtures";
import {
  altFor,
  approximateLocation,
  localizeProperty,
  matchScore,
  pickSimilar,
  resolveLocation,
  resolveTranslation,
  similarityScore,
  sortProperties,
  undescribedCount,
  tokenize,
} from "./lib";
import { propertySearchParamsSchema, type Property } from "./types";

/** Haversine, near enough at city scale — this only has to bound a scatter. */
const metresBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng) * Math.cos(toRad((a.lat + b.lat) / 2));
  return Math.sqrt(dLat * dLat + dLng * dLng) * 6_371_000;
};

const byReference = (reference: string): Property => {
  const found = propertyFixtures.find((p) => p.reference === reference);
  if (!found) throw new Error(`fixture ${reference} is gone — update this test`);
  return found;
};

/** What the comparators actually order on — see `comparablePrice` in lib.ts. */
const comparable = (p: Property) => convert(p.price, p.currency, displayCurrency) ?? p.price;

/** The listing with no English translation — the AC-9 case. */
const untranslated = byReference("BL-1108");
/** A fully translated listing, for contrast. */
const translated = byReference("BL-1101");

describe("resolveTranslation (AC-9)", () => {
  it("returns the requested language without a fallback flag", () => {
    const result = resolveTranslation(translated, "en");

    expect(result?.isFallback).toBe(false);
    expect(result?.textLocale).toBe("en");
    expect(result?.title).toBe("Atlas view villa, Palmeraie");
  });

  it("falls back to French and says so when English is missing", () => {
    const result = resolveTranslation(untranslated, "en");

    // The note AC-9 requires is driven by this flag, not by inspecting the text.
    expect(result?.isFallback).toBe(true);
    expect(result?.textLocale).toBe("fr");
    expect(result?.description.length).toBeGreaterThan(0);
  });

  it("never returns an empty description for any fixture in any locale", () => {
    for (const property of propertyFixtures) {
      for (const locale of ["fr", "en"] as const) {
        const result = resolveTranslation(property, locale);
        expect(
          result?.description.trim().length,
          `${property.reference} @ ${locale}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("returns null when a property has no text at all", () => {
    expect(resolveTranslation({ ...translated, translations: {} }, "fr")).toBeNull();
  });
});

describe("altFor", () => {
  it("uses the language of the page when it is there", () => {
    expect(altFor({ fr: "La piscine au crépuscule", en: "The pool at dusk" }, "en")).toBe(
      "The pool at dusk",
    );
  });

  it("falls back to French rather than leaving the photograph silent", () => {
    /*
     * The regression this whole function exists for. Every seeded photograph
     * carries both locales, so `alt[locale]` was never `undefined` — until the
     * back-office lets the client caption in French alone, which spec 011
     * explicitly encourages. Unhandled, the first such caption puts
     * `alt={undefined}` on the *English* site and the photograph is announced by
     * its file name: an accessibility regression caused by the feature built to
     * stop alt text being an afterthought.
     */
    expect(altFor({ fr: "La piscine au crépuscule" }, "en")).toBe("La piscine au crépuscule");
  });

  it("uses whatever language exists when neither the page's nor French is there", () => {
    expect(altFor({ en: "The pool at dusk" }, "fr")).toBe("The pool at dusk");
  });

  it("is an empty string, never undefined, when there is no text at all", () => {
    /*
     * `""` tells a screen reader the image is decorative and to skip it — a
     * small lie about a photograph of a house, and the right one when there is
     * nothing to say. `undefined` makes the browser read out the URL instead,
     * which is the outcome worth ruling out.
     */
    expect(altFor({}, "fr")).toBe("");
  });
});

describe("localizeProperty", () => {
  it("flattens the requested locale onto the property", () => {
    const result = localizeProperty(translated, "fr");

    expect(result?.slug).toBe("villa-vue-atlas-palmeraie");
    expect(result?.locale).toBe("fr");
    expect(result?.isFallback).toBe(false);
    expect(result?.reference).toBe("BL-1101");
  });

  it("keeps the requested locale even when the text falls back", () => {
    const result = localizeProperty(untranslated, "en");

    // The page is still English — only the prose is not. Conflating the two
    // would send the visitor to a French URL from an English page.
    expect(result?.locale).toBe("en");
    expect(result?.textLocale).toBe("fr");
    expect(result?.isFallback).toBe(true);
  });

  it("does not leak the raw translations map to components", () => {
    const result = localizeProperty(translated, "fr");

    expect(result).not.toHaveProperty("translations");
  });
});

describe("tokenize", () => {
  it("drops accents, case, punctuation and short words", () => {
    // "entre" is a stopword and "8", "12", "M" are too short to carry intent —
    // which is how a budget phrase stops polluting the match without the
    // matcher having to understand that it was a budget.
    expect(tokenize("Villa moderne à Marrakech, entre 8 et 12 M MAD")).toEqual([
      "villa",
      "moderne",
      "marrakech",
      "mad",
    ]);
  });

  it("drops words too common to carry intent", () => {
    // Without this, "avec" alone matches every listing and AC-4 is unreachable.
    expect(tokenize("une maison avec un jardin et une piscine")).toEqual([
      "maison",
      "jardin",
      "piscine",
    ]);
  });

  it("deduplicates repeated words", () => {
    expect(tokenize("villa villa villa")).toEqual(["villa"]);
  });
});

describe("matchScore (AC-2, AC-4)", () => {
  it("matches a property on its own words", () => {
    expect(matchScore(translated, "villa Palmeraie")).toBeGreaterThan(0);
  });

  it("scores a closer description higher", () => {
    const specific = matchScore(translated, "villa palmeraie atlas oliviers");
    const vague = matchScore(translated, "villa");

    expect(specific).toBeGreaterThan(vague);
  });

  it("returns zero when nothing in the query is about the property", () => {
    // AC-4 depends on this being reachable: an always-matching search can
    // never show the empty state.
    expect(matchScore(translated, "chalet islande fjord")).toBe(0);
  });

  it("treats an empty query as matching everything", () => {
    for (const property of propertyFixtures) {
      expect(matchScore(property, "")).toBeGreaterThan(0);
      expect(matchScore(property, "   ")).toBeGreaterThan(0);
    }
  });

  it("finds a listing by its reference", () => {
    expect(matchScore(translated, "BL-1101")).toBeGreaterThan(0);
  });
});

describe("sortProperties (AC-3)", () => {
  it("orders by price ascending", () => {
    // Asserted on the converted value, not `price`: the fixtures mix MAD and
    // EUR, so raw digits are not an ordering at all.
    const values = sortProperties(propertyFixtures, "priceAsc").map(comparable);

    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it("orders by price descending", () => {
    const values = sortProperties(propertyFixtures, "priceDesc").map(comparable);

    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it("puts the most recently listed first by default", () => {
    const dates = sortProperties(propertyFixtures).map((p) => Date.parse(p.listedAt));

    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it("compares across currencies, not on raw digits", () => {
    // The regression: a 12 800 000 MAD villa is about €1.2M, so it must rank
    // *below* a €3 900 000 estate. Sorting on the bare number puts the cheaper
    // property first and the grid states it with total confidence.
    const mad = byReference("BL-1101"); // 12 800 000 MAD
    const eur = byReference("BL-1104"); // 3 900 000 EUR

    expect(mad.price).toBeGreaterThan(eur.price);
    expect(sortProperties([mad, eur], "priceDesc").map((p) => p.reference)).toEqual([
      "BL-1104",
      "BL-1101",
    ]);
    expect(sortProperties([mad, eur], "priceAsc").map((p) => p.reference)).toEqual([
      "BL-1101",
      "BL-1104",
    ]);
  });

  it("does not mutate the input", () => {
    const original = [...propertyFixtures];
    sortProperties(propertyFixtures, "priceDesc");

    expect(propertyFixtures).toEqual(original);
  });

  it("breaks ties deterministically so the grid does not reshuffle", () => {
    const a = { ...translated, id: "x", reference: "BL-9002", price: 1000, listedAt: "2026-01-01" };
    const b = { ...translated, id: "y", reference: "BL-9001", price: 1000, listedAt: "2026-01-01" };

    expect(sortProperties([a, b], "priceAsc").map((p) => p.reference)).toEqual([
      "BL-9001",
      "BL-9002",
    ]);
    expect(sortProperties([b, a], "priceAsc").map((p) => p.reference)).toEqual([
      "BL-9001",
      "BL-9002",
    ]);
  });
});

describe("similarity (AC-5)", () => {
  it("never proposes the property itself", () => {
    expect(similarityScore(translated, translated)).toBe(-1);
    expect(pickSimilar(translated, propertyFixtures).map((p) => p.id)).not.toContain(translated.id);
  });

  it("ranks the same type in the same city above an unrelated listing", () => {
    const sameType = byReference("BL-1109"); // villa, Marrakech
    const unrelated = byReference("BL-1107"); // land, no bedrooms

    expect(similarityScore(translated, sameType)).toBeGreaterThan(
      similarityScore(translated, unrelated),
    );
  });

  it("returns at most the requested number", () => {
    expect(pickSimilar(translated, propertyFixtures, 3).length).toBeLessThanOrEqual(3);
    expect(pickSimilar(translated, propertyFixtures, 1).length).toBeLessThanOrEqual(1);
  });

  it("finds something for every fixture, so the detail row is never empty", () => {
    for (const property of propertyFixtures) {
      expect(pickSimilar(property, propertyFixtures).length, property.reference).toBeGreaterThan(0);
    }
  });
});

describe("propertySearchParamsSchema (SEC-INPUT-001)", () => {
  it("passes an ordinary search through untouched", () => {
    expect(propertySearchParamsSchema.parse({ q: "riad medina", sort: "priceAsc" })).toEqual({
      q: "riad medina",
      sort: "priceAsc",
      // Unasked-for, so it falls back: the catalogue is a list until told otherwise.
      view: "grid",
    });
  });

  it("falls back to the list on a stale or hostile view", () => {
    expect(propertySearchParamsSchema.parse({ view: "satellite-3d" }).view).toBe("grid");
    expect(propertySearchParamsSchema.parse({}).view).toBe("grid");
    expect(propertySearchParamsSchema.parse({ view: "map" }).view).toBe("map");
  });

  it("falls back rather than throwing on a stale or hostile sort", () => {
    // A dead `?sort=` in a shared link is a typo, not a 500 for the visitor.
    expect(propertySearchParamsSchema.parse({ sort: "; drop table" }).sort).toBe("newest");
    expect(propertySearchParamsSchema.parse({}).sort).toBe("newest");
  });

  it("bounds the query so an unbounded string cannot be echoed or matched", () => {
    const parsed = propertySearchParamsSchema.parse({ q: "x".repeat(5000) });

    expect(parsed.q).toBe("");
  });

  it("trims, so a whitespace-only search is treated as no search", () => {
    expect(propertySearchParamsSchema.parse({ q: "   " }).q).toBe("");
  });
});

describe("approximateLocation", () => {
  const center = { lat: 31.63, lng: -7.99 };

  it("puts the same listing in the same place every time", () => {
    // The point is computed on the server and again in the browser. Anything
    // random here hydrates to a different map than the one that was sent.
    const first = approximateLocation("BL-1101", center);
    const second = approximateLocation("BL-1101", center);
    expect(first).toEqual(second);
  });

  it("keeps the point inside the district it was derived from", () => {
    for (const property of propertyFixtures) {
      const district = districts[property.districtId];
      const point = approximateLocation(property.reference, district.center);
      expect(metresBetween(district.center, point), property.reference).toBeLessThanOrEqual(801);
    }
  });

  it("does not stack two listings from the same district on one pin", () => {
    const byDistrict = new Map<string, string[]>();
    for (const property of propertyFixtures) {
      byDistrict.set(property.districtId, [
        ...(byDistrict.get(property.districtId) ?? []),
        JSON.stringify(
          approximateLocation(property.reference, districts[property.districtId].center),
        ),
      ]);
    }
    for (const [district, points] of byDistrict) {
      expect(new Set(points).size, `${district} stacks its listings`).toBe(points.length);
    }
  });
});

describe("resolveLocation", () => {
  it("calls a derived point approximate", () => {
    const property = byReference("BL-1101");
    expect(property.coordinates, "fixtures must carry no invented coordinates").toBeUndefined();
    expect(resolveLocation(property).precision).toBe("approximate");
  });

  it("calls a supplied point exact, and uses it unchanged", () => {
    // What the back-office will send. The caveat has to switch itself off.
    const withCoordinates = { ...byReference("BL-1101"), coordinates: { lat: 31.6, lng: -8.0 } };
    expect(resolveLocation(withCoordinates)).toEqual({
      lat: 31.6,
      lng: -8.0,
      precision: "exact",
    });
  });

  it("gives every listing somewhere to be", () => {
    for (const property of propertyFixtures) {
      const location = resolveLocation(property);
      expect(Number.isFinite(location.lat), property.reference).toBe(true);
      expect(Number.isFinite(location.lng), property.reference).toBe(true);
    }
  });
});

describe("undescribedCount", () => {
  it("counts a photograph nobody described in any language", () => {
    expect(undescribedCount([{ alt: {} }, { alt: { fr: "La piscine" } }])).toBe(1);
  });

  it("does not count one described in English alone", () => {
    // Imperfect and not this problem: `altFor` falls back, so the gallery has a
    // name for it. The count exists to find the ones with no name at all.
    expect(undescribedCount([{ alt: { en: "The pool" } }])).toBe(0);
  });

  it("treats whitespace as no description", () => {
    expect(undescribedCount([{ alt: { fr: "   " } }])).toBe(1);
  });

  it("is zero for an empty gallery, so the editor says nothing", () => {
    expect(undescribedCount([])).toBe(0);
  });
});
