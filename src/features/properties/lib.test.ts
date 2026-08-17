import { describe, expect, it } from "vitest";
import { propertyFixtures } from "./fixtures";
import {
  localizeProperty,
  matchScore,
  pickSimilar,
  resolveTranslation,
  similarityScore,
  sortProperties,
  tokenize,
} from "./lib";
import type { Property } from "./types";

const byReference = (reference: string): Property => {
  const found = propertyFixtures.find((p) => p.reference === reference);
  if (!found) throw new Error(`fixture ${reference} is gone — update this test`);
  return found;
};

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
    const prices = sortProperties(propertyFixtures, "priceAsc").map((p) => p.price);

    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("orders by price descending", () => {
    const prices = sortProperties(propertyFixtures, "priceDesc").map((p) => p.price);

    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  it("puts the most recently listed first by default", () => {
    const dates = sortProperties(propertyFixtures).map((p) => Date.parse(p.listedAt));

    expect(dates).toEqual([...dates].sort((a, b) => b - a));
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
