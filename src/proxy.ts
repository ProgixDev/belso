import { NextResponse, type NextRequest } from "next/server";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  detectLocale,
  isLocale,
  toInternalPath,
} from "@/core/i18n";
import {
  ADMIN_PREFIX,
  ADMIN_SESSION_COOKIE,
  ADMIN_SIGN_IN_PATH,
  safeAdminPath,
} from "@/core/session-cookie";

/**
 * Named `proxy` per the Next 16 file convention — `middleware` is deprecated.
 *
 * One job: put every storefront request under a locale, and rewrite the
 * translated public segment onto the real app-directory path (`/fr/biens/x`
 * renders `/fr/properties/x`).
 *
 * It had a second until ADR-0008 — refreshing a Supabase session and gating
 * protected routes — which went with Supabase itself. The back-office will need
 * its own gate here, and the thing worth carrying forward from the old one is
 * this: a rewrite must copy the response's cookies across, or a signed-in
 * manager is silently signed out on every translated URL.
 */

/** Not part of the localised storefront — these keep their bare paths. */
const UNLOCALISED_PREFIXES = [
  "/api",
  "/auth",
  "/account",
  "/dashboard",
  "/sign-in",
  "/examples",
  // The back-office. It is French, but it is not part of the localised
  // storefront: there is no `/en/admin` and never will be, so locale-rewriting
  // it would send `/admin` to `/fr/admin`, which does not exist.
  ADMIN_PREFIX,
  // Uploaded photographs, served by a route handler. Their names end in
  // `.webp` so the extension rule below already covers them — this is here so
  // that a URL without an extension, should one ever be added, does not start
  // being redirected into a locale that has no such route.
  "/media",
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

/**
 * Bounce a signed-out browser to the sign-in page before the page renders.
 *
 * **This is not the gate, and reading it as one would be the expensive
 * mistake.** All it checks is that a cookie *exists*. It cannot check whether
 * the session behind it is real, live, or attached to an account that has since
 * been disabled, because verifying any of that means asking Postgres and this
 * file runs on Edge, where `pg` cannot open a socket. Anyone can set a cookie
 * named `belso_session` and get past this line.
 *
 * What it buys is that the ordinary signed-out visit — a bookmark, a stale tab
 * — lands on the sign-in form rather than rendering a layout that then
 * redirects. The authority is `admin/layout.tsx` for pages and
 * `requireSession()` inside every action for mutations.
 *
 * **GET only, deliberately.** A signed-out POST is left to reach the action so
 * that the action refuses it, which is the half of AC-1 that would otherwise
 * ship open — a Server Action is reachable without ever rendering the page it
 * lives on. Redirecting it here would make the e2e pass while proving nothing
 * about the action, which is precisely the reassurance we do not want.
 */
function gateAdmin(request: NextRequest, pathname: string): NextResponse {
  if (request.method !== "GET") return NextResponse.next({ request });
  if (pathname === ADMIN_SIGN_IN_PATH) return NextResponse.next({ request });
  if (request.cookies.has(ADMIN_SESSION_COOKIE)) return NextResponse.next({ request });

  const url = request.nextUrl.clone();
  url.pathname = ADMIN_SIGN_IN_PATH;
  url.search = "";
  // Validated even though it came from our own URL: `safeAdminPath` is the one
  // place that decides what a redirect target may be, and routing every value
  // through it is what keeps that true.
  const next = safeAdminPath(pathname);
  if (next && next !== ADMIN_PREFIX) url.searchParams.set("next", next);

  return NextResponse.redirect(url);
}

function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminPath(pathname)) {
    return gateAdmin(request, pathname);
  }

  if (isUnlocalised(pathname)) {
    return NextResponse.next({ request });
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

  const internalPath = toInternalPath(pathname);
  let response = NextResponse.next({ request });

  if (internalPath && internalPath !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = internalPath;
    response = NextResponse.rewrite(url, { request });
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
