// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { toProperty, type PropertyRow } from "./row";

vi.mock("server-only", () => ({}));

/**
 * The SQL→domain mapper, tested where it costs nothing to test.
 *
 * `row.ts` documents three conversions and calls each of them a bug that has
 * shipped somewhere before — and until now every one of them was reachable only
 * through a database test that `pnpm verify` skips. The golden snapshot covers
 * them against the real catalogue, but only when someone runs `pnpm test:db`
 * with a tunnel open, and only for values the twenty fixtures happen to
 * contain. `land_area: null`, an absent translation and an unknown district are
 * not among them.
 *
 * These are pure function calls on hand-built rows, so they run in the default
 * gate, on every machine, in milliseconds.
 */
const ROW: PropertyRow = {
  id: "p-01",
  reference: "BL-1101",
  district_id: "palmeraie",
  kind: "sale",
  type: "villa",
  status: "available",
  // The shape `pg` actually returns for `numeric` — a string, not a number.
  price: "12800000.00",
  currency: "MAD",
  bedrooms: 5,
  bathrooms: 4,
  built_area: 620,
  land_area: 4200,
  built_year: 2019,
  parking: 3,
  lat: null,
  lng: null,
  amenities: ["pool", "garden"],
  listed_at: "2026-07-28",
  translations: {
    fr: {
      slug: "villa-vue-atlas-palmeraie",
      title: "Villa vue Atlas, Palmeraie",
      description: "Une villa.",
      district: "Palmeraie",
      city: "Marrakech",
    },
  },
  media: [{ id: "BL-1101-01", url: "/a.jpg", width: 1600, height: 1067, alt: { fr: "Une villa" } }],
};

describe("toProperty", () => {
  it("turns a numeric price into a number, not the string pg returns", () => {
    // `"12800000.00" !== 12800000` would fail the golden snapshot on every
    // listing — and, before it got there, would render a price of "NaN M MAD"
    // through any arithmetic on the way.
    expect(toProperty(ROW).price).toBe(12_800_000);
    expect(typeof toProperty(ROW).price).toBe("number");
  });

  it("keeps the listing date as a calendar day, never a Date", () => {
    /*
     * `formatDate` was already bitten once by this: `new Date("2026-07-28")` is
     * UTC midnight, which prints as the 27th anywhere west of Greenwich. The
     * query casts to text so no timezone is ever applied; this asserts the
     * mapper does not undo that.
     */
    const property = toProperty(ROW);
    expect(property.listedAt).toBe("2026-07-28");
    expect(property.listedAt).not.toBeInstanceOf(Date);
  });

  it("reports an absent optional as undefined, not null", () => {
    // A card checks for absence to leave the slot out. `null` is truthy-adjacent
    // enough in JSX to print an empty row where nothing should be.
    const property = toProperty({ ...ROW, land_area: null, built_year: null });
    expect(property.landArea).toBeUndefined();
    expect(property.builtYear).toBeUndefined();
  });

  it("omits coordinates unless both halves are present", () => {
    expect(toProperty(ROW).coordinates).toBeUndefined();
    expect(toProperty({ ...ROW, lat: 31.6, lng: -8.0 }).coordinates).toEqual({
      lat: 31.6,
      lng: -8.0,
    });
    // Half a position is not a position — the column constraint forbids it, and
    // the mapper must not invent the other half if it ever arrives.
    expect(toProperty({ ...ROW, lat: 31.6, lng: null }).coordinates).toBeUndefined();
  });

  it("leaves an untranslated locale missing rather than empty", () => {
    // AC-9: one listing has no English at all. A `{}` here would make
    // `resolveTranslation` fall back to something that is not the French text.
    const property = toProperty(ROW);
    expect(property.translations.fr).toBeDefined();
    expect("en" in property.translations).toBe(false);
  });

  it("survives a listing with no media and no translations at all", () => {
    // The lateral joins yield `null`, not `[]`, when a listing has neither —
    // which is exactly the state a half-written draft is in.
    const property = toProperty({ ...ROW, media: null, translations: null });
    expect(property.media).toEqual([]);
    expect(property.translations).toEqual({});
  });

  it("refuses a district the TypeScript union no longer lists", () => {
    /*
     * A foreign key guarantees the district row exists; it cannot guarantee the
     * union in `districts.ts` still names it. Failing loudly beats a listing
     * that silently loses its neighbourhood page — and this is the one place in
     * the mapper that does not simply cast.
     */
    expect(() => toProperty({ ...ROW, district_id: "casablanca" })).toThrow(/unknown district/);
  });
});
