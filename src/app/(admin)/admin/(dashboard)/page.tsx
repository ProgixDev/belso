import Link from "next/link";
import { currentSession } from "@/core/session";
import { ADMIN_PREFIX } from "@/core/session-cookie";

/**
 * The back-office home.
 *
 * Deliberately thin for now: Phase 2 delivers the gate, and the listing screens
 * arrive in Phase 3. What it must not be is a dashboard — spec 011 puts
 * "reporting, analytics, dashboards" out of scope, because she needs to run her
 * catalogue rather than measure it.
 */
export default async function AdminHomePage() {
  // The layout above has already refused anyone without a session; this is the
  // memoised read of the same request's session, not a second lookup.
  const session = await currentSession();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl">Bonjour {session?.displayName}</h1>
        <p className="text-muted-foreground text-sm">
          Gérez le catalogue : créez un bien, modifiez-le, publiez-le.
        </p>
      </div>

      <Link
        href={`${ADMIN_PREFIX}/listings`}
        className="border-border/60 hover:border-foreground/30 rounded-lg border px-5 py-4 transition-colors"
      >
        <span className="block font-medium">Biens</span>
        <span className="text-muted-foreground text-sm">Le catalogue, brouillons compris.</span>
      </Link>
    </div>
  );
}
