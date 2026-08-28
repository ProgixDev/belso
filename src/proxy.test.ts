// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOCALE_COOKIE } from "@/core/i18n";

/**
 * Locale routing, whose failures are silent: a missed rewrite 404s a
 * translated URL, and a cookie written on a prefetch changes the language
 * under a visitor who never asked.
 *
 * It also composed with a Supabase session response until ADR-0008. Those two
 * tests went with it — deliberately, rather than being left mocking a module
 * that no longer exists.
 */

import { proxy } from "./proxy";

/**
 * A real browser navigation unless told otherwise: `sec-fetch-dest: document`
 * is what separates a visit from a prefetch, and the proxy keys off it.
 */
function request(
  path: string,
  init?: { acceptLanguage?: string; cookies?: string; dest?: string },
) {
  const headers = new Headers();
  headers.set("sec-fetch-dest", init?.dest ?? "document");
  if (init?.acceptLanguage) headers.set("accept-language", init.acceptLanguage);
  if (init?.cookies) headers.set("cookie", init.cookies);
  return new NextRequest(new URL(`http://localhost:3000${path}`), { headers });
}

/** Where `NextResponse.rewrite` records its destination. */
const rewriteTarget = (response: Response) => response.headers.get("x-middleware-rewrite");

describe("unlocalised paths", () => {
  // `/account`, `/sign-in` and `/auth/callback` were removed with Supabase
  // (ADR-0008). The rest still exist and must keep their bare paths — and the
  // list is worth keeping longer than the routes, because the back-office will
  // add its own unlocalised paths and this is what proves they stay bare.
  it.each(["/api/health", "/examples/tasks"])("passes %s through untouched", async (path) => {
    const response = await proxy(request(path));

    expect(response.headers.get("location")).toBeNull();
    expect(rewriteTarget(response)).toBeNull();
  });

  it("leaves files alone so robots.txt does not become /fr/robots.txt", async () => {
    for (const path of ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest"]) {
      const response = await proxy(request(path));
      expect(response.headers.get("location")).toBeNull();
    }
  });
});

describe("locale detection on a bare path", () => {
  it("sends / to the default locale and remembers the choice", async () => {
    const response = await proxy(request("/"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/fr");
    expect(response.cookies.get(LOCALE_COOKIE)?.value).toBe("fr");
  });

  it("honours Accept-Language", async () => {
    const response = await proxy(request("/", { acceptLanguage: "en-GB,en;q=0.9" }));

    expect(response.headers.get("location")).toBe("http://localhost:3000/en");
  });

  it("lets a stored choice beat the browser's header", async () => {
    const response = await proxy(
      request("/", { acceptLanguage: "en-GB,en;q=0.9", cookies: `${LOCALE_COOKIE}=fr` }),
    );

    expect(response.headers.get("location")).toBe("http://localhost:3000/fr");
  });

  it("keeps the rest of the path when prefixing the locale", async () => {
    const response = await proxy(request("/contact"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/fr/contact");
  });
});

describe("translated segment rewrite", () => {
  it("renders /fr/biens from the properties directory", async () => {
    const response = await proxy(request("/fr/biens", { cookies: `${LOCALE_COOKIE}=fr` }));

    expect(rewriteTarget(response)).toBe("http://localhost:3000/fr/properties");
  });

  it("carries the slug through", async () => {
    const response = await proxy(
      request("/fr/biens/villa-vue-atlas", { cookies: `${LOCALE_COOKIE}=fr` }),
    );

    expect(rewriteTarget(response)).toBe("http://localhost:3000/fr/properties/villa-vue-atlas");
  });

  it("does not rewrite when the public segment already is the internal one", async () => {
    const response = await proxy(
      request("/en/properties/villa", { cookies: `${LOCALE_COOKIE}=en` }),
    );

    expect(rewriteTarget(response)).toBeNull();
  });

  it("does not rewrite a bare locale root", async () => {
    const response = await proxy(request("/fr", { cookies: `${LOCALE_COOKIE}=fr` }));

    expect(rewriteTarget(response)).toBeNull();
  });
});

describe("locale persistence", () => {
  it("ignores a prefetch of the other language", async () => {
    // The bug this pins: the switcher is in the header of every page, so Next
    // prefetches the other language's URL as soon as it is in view. Counting
    // that as a choice silently flipped the stored language.
    //
    // Note the signal. Next strips its own `next-router-prefetch` header before
    // the proxy runs, so it cannot be used; `sec-fetch-dest` is a browser
    // header and reports `empty` for every fetch.
    const response = await proxy(
      request("/fr/biens", { cookies: `${LOCALE_COOKIE}=en`, dest: "empty" }),
    );

    expect(response.cookies.get(LOCALE_COOKIE)).toBeUndefined();
  });

  it("records the choice on a real navigation", async () => {
    const response = await proxy(request("/en", { cookies: `${LOCALE_COOKIE}=fr` }));

    expect(response.cookies.get(LOCALE_COOKIE)?.value).toBe("en");
  });

  it("does not rewrite the cookie when it already agrees", async () => {
    const response = await proxy(request("/fr", { cookies: `${LOCALE_COOKIE}=fr` }));

    expect(response.cookies.get(LOCALE_COOKIE)).toBeUndefined();
  });
});
