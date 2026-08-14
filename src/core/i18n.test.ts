import { describe, expect, it } from "vitest";
import {
  defaultLocale,
  detectLocale,
  internalSegment,
  isLocale,
  locales,
  publicSegment,
  routeSegments,
  switchLocalePath,
  toInternalPath,
  toPublicPath,
} from "./i18n";

describe("isLocale", () => {
  it("accepts shipped locales and rejects everything else", () => {
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("en")).toBe(true);
    // Planned but not shipped — must not resolve until its dictionary exists.
    expect(isLocale("ar")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale("EN")).toBe(false);
  });
});

describe("segment map", () => {
  it("translates the properties segment for French", () => {
    expect(publicSegment("properties", "fr")).toBe("biens");
    expect(publicSegment("properties", "en")).toBe("properties");
  });

  it("round-trips every segment in every locale", () => {
    for (const locale of locales) {
      for (const key of Object.keys(routeSegments) as (keyof typeof routeSegments)[]) {
        expect(internalSegment(publicSegment(key, locale), locale)).toBe(key);
      }
    }
  });

  it("returns null for a segment that is not ours", () => {
    expect(internalSegment("account", "fr")).toBeNull();
    expect(internalSegment("biens", "en")).toBeNull();
  });
});

describe("toPublicPath / toInternalPath", () => {
  it("builds the visitor-facing URL", () => {
    expect(toPublicPath("/properties/villa-vue-atlas", "fr")).toBe("/fr/biens/villa-vue-atlas");
    expect(toPublicPath("/properties/villa-atlas-view", "en")).toBe(
      "/en/properties/villa-atlas-view",
    );
    expect(toPublicPath("/contact", "fr")).toBe("/fr/contact");
    expect(toPublicPath("/", "fr")).toBe("/fr");
  });

  it("maps a public URL back to the app-directory path", () => {
    expect(toInternalPath("/fr/biens/villa-vue-atlas")).toBe("/fr/properties/villa-vue-atlas");
    expect(toInternalPath("/en/properties/villa-atlas-view")).toBe(
      "/en/properties/villa-atlas-view",
    );
    expect(toInternalPath("/fr")).toBe("/fr");
  });

  it("round-trips: public → internal → public is stable", () => {
    for (const locale of locales) {
      for (const internal of ["/properties/some-slug", "/contact", "/legal/privacy"]) {
        const publicPath = toPublicPath(internal, locale);
        expect(toInternalPath(publicPath)).toBe(`/${locale}${internal}`);
      }
    }
  });

  it("returns null when the path carries no locale, so the caller can redirect", () => {
    expect(toInternalPath("/biens/villa")).toBeNull();
    expect(toInternalPath("/account")).toBeNull();
  });
});

describe("switchLocalePath", () => {
  it("keeps the visitor on the same page across a locale switch (AC-1)", () => {
    expect(switchLocalePath("/fr/biens", "en")).toBe("/en/properties");
    expect(switchLocalePath("/en/properties", "fr")).toBe("/fr/biens");
    expect(switchLocalePath("/fr/contact", "en")).toBe("/en/contact");
  });

  it("swaps the slug when the caller can resolve the translated one", () => {
    expect(switchLocalePath("/fr/biens/villa-vue-atlas", "en", "villa-atlas-view")).toBe(
      "/en/properties/villa-atlas-view",
    );
  });

  it("keeps the original slug when no translation is supplied", () => {
    expect(switchLocalePath("/fr/biens/villa-vue-atlas", "en")).toBe(
      "/en/properties/villa-vue-atlas",
    );
  });

  it("handles the bare root", () => {
    expect(switchLocalePath("/fr", "en")).toBe("/en");
    expect(switchLocalePath("/", "en")).toBe("/en");
  });
});

describe("detectLocale", () => {
  it("defaults to French with no signal", () => {
    expect(detectLocale(null)).toBe("fr");
    expect(detectLocale("")).toBe("fr");
    expect(defaultLocale).toBe("fr");
  });

  it("honours a stored choice above the browser header", () => {
    // plan.md §6: never trap someone in a language they did not pick.
    expect(detectLocale("fr-FR,fr;q=0.9", "en")).toBe("en");
    expect(detectLocale("en-GB,en;q=0.9", "fr")).toBe("fr");
  });

  it("ignores a malformed cookie and falls back to the header", () => {
    expect(detectLocale("en-GB,en;q=0.9", "de")).toBe("en");
  });

  it("reads the header, respecting q-values over document order", () => {
    expect(detectLocale("en-GB,en;q=0.9")).toBe("en");
    expect(detectLocale("de-DE,de;q=0.9,en;q=0.8")).toBe("en");
    expect(detectLocale("en;q=0.3,fr;q=0.9")).toBe("fr");
  });

  it("falls back to the default when no requested language is available", () => {
    expect(detectLocale("de-DE,de;q=0.9")).toBe("fr");
    // Arabic is planned but not shipped — must not resolve yet.
    expect(detectLocale("ar-MA,ar;q=0.9")).toBe("fr");
  });
});
