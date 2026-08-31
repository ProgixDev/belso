import Link from "next/link";
import { signOutAction } from "@/features/admin";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/core/session";
import { ADMIN_PREFIX } from "@/core/session-cookie";

/**
 * The gate for every back-office **page**, and the navigation around them.
 *
 * A layout always runs for its children, so no page under it can forget to
 * check — which is the property that makes this the right place for it, and the
 * reason `/admin/connexion` is a sibling rather than a child.
 *
 * **It is not the gate for actions.** A Server Action is an independently
 * addressable POST endpoint: it is reachable without this layout ever
 * rendering, so "the layout checked" is not a check for a request that never
 * touched the layout. Every action calls `requireSession()` itself. AC-1 states
 * both halves separately for exactly this reason, and `e2e/admin-auth.spec.ts`
 * tests them separately.
 *
 * `requireSession()` redirects rather than returning null, so there is no way
 * to render this tree without a session — including by accident, in a future
 * edit that adds an early return above it.
 */
export default async function AdminDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border/60 flex items-center justify-between gap-4 border-b px-6 py-4">
        <div className="flex items-baseline gap-6">
          <Link href={ADMIN_PREFIX} className="font-serif text-lg">
            Espace de gestion
          </Link>
          <nav className="text-muted-foreground flex gap-4 text-sm">
            <Link href={`${ADMIN_PREFIX}/listings`} className="hover:text-foreground">
              Biens
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-muted-foreground text-sm">{session.displayName}</span>
          {/*
           * A form rather than a link: signing out changes state, and a GET
           * that changes state is a link a prefetcher can follow. The
           * storefront prefetches aggressively; the back-office would too.
           */}
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Se déconnecter
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
