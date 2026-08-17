import { describe, expect, it } from "vitest";
import { formatApproxPrice, formatArea, formatPrice } from "./format";

/** Intl inserts non-breaking and narrow-no-break spaces; compare on digits. */
const normalise = (s: string) => s.replace(/[   ]/g, " ");

describe("formatPrice", () => {
  it("renders MAD for a French visitor", () => {
    const out = normalise(formatPrice(12_000_000, "MAD", "fr"));
    // Separator-agnostic: assert the grouping happened, not which glyph CLDR picks.
    expect(out.replace(/[^\d]/g, "")).toBe("12000000");
    expect(out).toMatch(/\d[.\s,]\d{3}/);
    expect(out).toMatch(/MAD|DH/);
  });

  it("groups fr-MA with dots, not the spaces fr-FR uses", () => {
    // Pinned deliberately: our French locale is fr-MA (Morocco), whose CLDR
    // grouping separator is ".". A French-from-France buyer sees 12.000.000
    // where they might expect 12 000 000. Flagged with B-7 for the client;
    // switching to fr-FR here is a one-line change in core/i18n localeTag.
    expect(normalise(formatPrice(12_000_000, "MAD", "fr"))).toContain("12.000.000");
  });

  it("renders EUR for an English visitor", () => {
    const out = normalise(formatPrice(1_100_000, "EUR", "en"));
    expect(out).toContain("1,100,000");
    expect(out).toContain("€");
  });

  it("never shows decimal centimes on an asking price", () => {
    expect(normalise(formatPrice(8_500_000.49, "MAD", "fr"))).not.toContain(",49");
  });
});

describe("formatApproxPrice", () => {
  it("marks a converted figure as approximate", () => {
    const out = formatApproxPrice(12_000_000, "MAD", "EUR", "fr");
    expect(out).not.toBeNull();
    expect(out).toMatch(/^≈ /);
    expect(normalise(out ?? "")).toContain("€");
  });

  it("returns null when source and target match, so no pointless ≈ is shown", () => {
    expect(formatApproxPrice(1_000_000, "EUR", "EUR", "fr")).toBeNull();
  });

  it("converts in the right direction", () => {
    // 12M MAD is roughly 1.1M EUR, not 130M.
    const digits = Number(
      (formatApproxPrice(12_000_000, "MAD", "EUR", "en") ?? "").replace(/[^\d]/g, ""),
    );
    expect(digits).toBeGreaterThan(900_000);
    expect(digits).toBeLessThan(1_400_000);
  });
});

describe("formatArea", () => {
  it("renders whole square metres", () => {
    const out = normalise(formatArea(1250.6, "fr"));
    expect(out).toMatch(/^1[.\s,]251 m²$/);
  });
});
