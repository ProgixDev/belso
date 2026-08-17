import { NextResponse, type NextRequest } from "next/server";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  detectLocale,
  isLocale,
  toInternalPath,
} from "@/core/i18n";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Named `proxy` per the Next 16 file convention — `middleware` is deprecated.
 *
 * Two jobs, in this order:
 *   1. Refresh the Supabase session and gate protected routes (`updateSession`).
 *   2. Put every storefront request under a locale and rewrite the translated
 *      public segment onto the real app-directory path (`/fr/biens/x` renders
 *      `/fr/properties/x`).
 *
 * The session response is *composed with*, never replaced: `updateSession`
 * returns a response carrying refreshed auth cookies, so a rewrite has to copy
 * them across or the visitor is silently signed out on any translated URL.
 */

/** Not part of the localised storefront — these keep their bare paths. */
const UNLOCALISED_PREFIXES = [
  "/api",
  "/auth",
  "/account",
  "/dashboard",
  "/sign-in",
  "/examples",
] as const;

function isUnlocalised(pathname: string): boolean {
  if (UNLOCALISED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  // Anything with a file extension: robots.txt, sitemap.xml, manifest.webmanifest.
  // Without this they would be redirected to /fr/robots.txt and quietly 404,
  // which the matcher's asset exclusions do not cover.
  const last = pathname.split("/").pop() ?? "";
  return last.includes(".");
}

/**
 * Is this a real navigation, rather than something the router fetched?
 *
 * This exists because of a bug that took a while to pin down: the locale
 * switcher sits in the header of every page, so Next prefetches the *other*
 * language's URL as soon as it is in view. Persisting the locale on every
 * localed request therefore let a prefetch silently overwrite the visitor's
 * stored language — a preference that appeared to work and then randomly did
 * not, which is how it surfaced (as a flaky test, not a report).
 *
 * The obvious guard — `Next-Router-Prefetch` — does not work: **Next strips its
 * own router headers before `proxy` runs**, so `rsc`, `next-router-prefetch`
 * and friends are simply absent here. Verified by dumping the received header
 * names. `Sec-Fetch-Dest` is a browser header, cannot be set from JavaScript,
 * and is `document` only for top-level navigations — every prefetch and RSC
 * fetch reports `empty`.
 *
 * Clicking the switcher is a client-side navigation and so does *not* land here
 * as a document request; that choice is recorded by the switcher itself.
 */
function isDocumentNavigation(request: NextRequest): boolean {
  return request.headers.get("sec-fetch-dest") === "document";
}

const localeCookie = {
  path: "/",
  maxAge: LOCALE_COOKIE_MAX_AGE,
  sameSite: "lax",
} as const;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isUnlocalised(pathname)) {
    return updateSession(request);
  }

  const first = pathname.split("/")[1] ?? "";

  // No locale in the path: send the visitor to the one we detect, and remember it.
  if (!isLocale(first)) {
    const locale = detectLocale(
      request.headers.get("accept-language"),
      request.cookies.get(LOCALE_COOKIE)?.value,
    );
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
    const redirect = NextResponse.redirect(url);
    redirect.cookies.set(LOCALE_COOKIE, locale, localeCookie);
    return redirect;
  }

  const sessionResponse = await updateSession(request);
  // A protected-route redirect from updateSession outranks anything we do here.
  if (sessionResponse.headers.get("location")) {
    return sessionResponse;
  }

  const internalPath = toInternalPath(pathname);
  let response = sessionResponse;

  if (internalPath && internalPath !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = internalPath;
    response = NextResponse.rewrite(url, { request });
    // Carry the refreshed auth cookies onto the rewritten response.
    for (const cookie of sessionResponse.cookies.getAll()) {
      response.cookies.set(cookie);
    }
  }

  // A locale in the URL is an explicit choice — persist it so the next bare
  // visit lands in the same language (AC-1).
  //
  // Only on a real navigation — see `isDocumentNavigation`. A prefetch of the
  // other language must never count as choosing it.
  if (isDocumentNavigation(request) && request.cookies.get(LOCALE_COOKIE)?.value !== first) {
    response.cookies.set(LOCALE_COOKIE, first, localeCookie);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
